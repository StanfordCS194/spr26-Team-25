import os
import uuid
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic
from supabase import create_client
from dotenv import load_dotenv
from google.cloud import texttospeech
from fastapi.responses import StreamingResponse
import io
# for talking to tutor
import re
# para regex
import json
import tempfile

load_dotenv()

# Load Google Cloud credentials from environment variable (Railway deployment)
# Instead of using a JSON file (which would require committing secrets to git),
# we store the credentials JSON as an env var and write it to a temp file at the startup
creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
if creds_json:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write(creds_json)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = f.name

router = APIRouter()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# System prompt is the core of Chronos, defining the tutor's personality, 
# teaching methodology, and how it adapts to each learner's level and goal.
# This runs before every conversation and is never visible to the user. 
SYSTEM_PROMPT = """You are Chronos, an expert Ancient Greek tutor with deep knowledge of
classical literature, Koine Greek, philosophy, and ancient history.

LEARNER PROFILE:
- Level: {level}
- Goal: {goal}
- Time commitment: {time_commitment}

TEACHING APPROACH based on level:
- beginner: Start with the Greek alphabet and pronunciation. Introduce 2-3 new words per 
  response. Use transliteration alongside Greek script. Explain grammar simply with analogies.
- intermediate: Assume knowledge of the alphabet. Introduce grammar concepts directly. 
  Use more Greek script with less transliteration. Begin connecting words to texts.
- advanced: Engage as a peer. Discuss nuanced grammar, syntax, and textual interpretation. 
  Use Greek script primarily. Reference original texts directly.

TEACHING APPROACH based on goal:
- "Read philosophy (Plato, Aristotle)": Prioritize Attic Greek. Use philosophical vocabulary. 
  Reference passages from dialogues and treatises.
- "Read the New Testament": Focus on Koine Greek. Use biblical vocabulary and examples 
  from the Gospels and Epistles. Your role is strictly linguistic — teach the learner 
  to read and understand the Greek text independently. Never interpret theological meaning, 
  suggest doctrinal positions, or tell the learner what a passage means spiritually. 
  Help them understand what the words and grammar say, so they can form their own interpretation.
- "General curiosity & history": Balance vocabulary across domains. Use engaging historical 
  anecdotes and cultural context.
- "Academic coursework": Be precise with grammatical terminology. Reinforce formal 
  linguistic concepts such as declension, conjugation, and syntax.

ALWAYS:
- Introduce new Greek words in this format: Greek script (transliteration) = meaning
  Example: ἀγάπη (agápē) = love
- Gently correct mistakes by restating the correct form before explaining why
- End each response with one question or exercise to keep the learner engaged
- Keep responses focused and digestible — do not overwhelm the learner
- Never break character as a knowledgeable, encouraging tutor
"""

def extract_vocabulary(text: str, session_id: str) -> list:
    """
    Scans the tutor's response for Greek words in multiple formats:
    - ψυχή (psychḗ) = soul
    - **ψυχή (psychḗ)** = soul  
    - ## 1. **ψυχή (psychḗ)** = soul
    Extracts and formats them for saving to the vocabulary table.
    """
    import re
    # Broad pattern: find any Greek characters followed by (transliteration) = meaning
    pattern = r'([\u0370-\u03FF\u1F00-\u1FFF]+)\*{0,2}\s*\(([^)]+)\)\*{0,2}\s*[=:]\s*(.+)'
    matches = re.findall(pattern, text)
    
    vocab = []
    seen = set()  # Avoid saving duplicate words in the same response
    for greek, transliteration, meaning in matches:
        greek = greek.strip()
        if greek not in seen:
            seen.add(greek)
            vocab.append({
                "session_id": session_id,
                "greek": greek,
                "transliteration": transliteration.strip(),
                "meaning": meaning.strip().rstrip('*').strip()
            })
    return vocab

class ChatMessage(BaseModel):
    message: str
    level: str = "beginner"
    goal: str = "General curiosity & history"
    time_commitment: str = "30-60 minutes"
    session_id: Optional[str] = None
    user_id: Optional[str] = None # The logged-in user's ID from Supabase Auth
    history: list = []


@router.post("/chat")
async def chat(body: ChatMessage):
    # Generate a new session ID if one wasn't provided by the frontend
    session_id = body.session_id or str(uuid.uuid4())

    # Combine conversation history with the new message
    messages = body.history + [
        {"role": "user", "content": body.message}
    ]

    # Call the AI tutor with the personalized system prompt
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=SYSTEM_PROMPT.format(
            level=body.level,
            goal=body.goal,
            time_commitment=body.time_commitment
        ),
        messages=messages
    )

    assistant_response = response.content[0].text

    # Save both the user's message and the tutor's response to Supabase
    # so we can track learning progress over time
    supabase.table("conversations").insert([
        {"session_id": session_id, "role": "user", "content": body.message, "user_id": body.user_id},
        {"session_id": session_id, "role": "assistant", "content": assistant_response, "user_id": body.user_id}
    ]).execute()

    # Extract Greek vocabulary introduced in this response and save to vocabulary table
    vocab = extract_vocabulary(assistant_response, session_id)
    if vocab:
        # Add user_id to each vocabulary word before saving
        for word in vocab:
            word["user_id"] = body.user_id
        supabase.table("vocabulary").insert(vocab).execute()

    return {
        "response": assistant_response,
        "session_id": session_id,
        "level": body.level
    }

@router.get("/vocabulary/{session_id}")
async def get_vocabulary(session_id: str):
    """
    Returns all Greek vocabulary words learned in a given session.
    The frontend calls this endpoint to display the user's personal vocabulary list.
    """
    result = supabase.table("vocabulary")\
        .select("*")\
        .eq("session_id", session_id)\
        .order("created_at")\
        .execute()
    
    return {"vocabulary": result.data}

@router.post("/speak")
async def speak(body: dict):
    """
    Receives text from the frontend and returns an audio stream using Google Cloud TTS
    Uses a Greek female WaveNet voice that handles both English and Greek naturally.
    """
    text = body.get("text", "")
    # Remove markdown formatting so the TTS doesn't read symbols like asterisks out loud
    text = re.sub(r'\*+', '', text)        # Remove asterisks
    text = re.sub(r'#{1,6}\s*', '', text)  # Remove headers (##, ###, etc.)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)  # Remove links, keep text


    # Initialize the Google Cloud TTS client — credentials are loaded automatically
    # from the GOOGLE_APPLICATION_CREDENTIALS environment variable
    tts_client = texttospeech.TextToSpeechClient()

    # Wrap the text in a SynthesisInput object
    synthesis_input = texttospeech.SynthesisInput(text=text)

    # Use a Greek female WaveNet voice. Thick Greek accent. 
    voice = texttospeech.VoiceSelectionParams(
        language_code="el-GR",
        name="el-GR-Wavenet-A",
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
    )

    # American voice. Don't really like it because it does not pronounce
    # Greek words right. 
    # voice = texttospeech.VoiceSelectionParams(
    #     language_code="en-US",
    #     name="en-US-Neural2-F",
    #     ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
    # )

    # Request MP3 audio output
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    # Generate the audio
    response = tts_client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config
    )

    # Return the audio as a streaming MP3 response the browser can play directly
    return StreamingResponse(
        io.BytesIO(response.audio_content),
        media_type="audio/mpeg"
    )
