import os
import uuid
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic
from supabase import create_client
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from fastapi.responses import StreamingResponse
import io
# for talking to tutor

load_dotenv()

router = APIRouter()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
# ElevenLabs client for converting Chronos' text responses to realistic speech
eleven = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
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
    Receives text from the frontend and returns an audio stream using ElevenLabs TTS.
    The frontend plays this audio directly in the browser so the user hears Chronos speaking.
    """
    text = body.get("text", "")

    # Generate audio using ElevenLabs. "Rachel" is a clear, warm female English voice
    # Voice ID for Rachel: 21m00Tcm4TlvDq8ikWAM
    audio = eleven.text_to_speech.convert(
        text=text,
        voice_id="21m00Tcm4TlvDq8ikWAM",
        model_id="eleven_multilingual_v2",  # Supports both English and Greek pronunciation
        output_format="mp3_44100_128",
    )

    # Collect all audio chunks into a single bytes buffer
    audio_bytes = b"".join(audio)

    # Return the audio as a streaming MP3 response the browser can play directly
    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg"
    )
