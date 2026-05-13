import os
import re
import uuid
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Self-contained Elder Futhark transliteration
# Mirrors pipeline/old_norse/transliteration.py so this module has no runtime
# dependency on the pipeline package (which may not be deployed with the backend).
# ---------------------------------------------------------------------------

_ELDER_FUTHARK_MAP: dict = {
    "a": "ᚨ", "á": "ᚨ", "æ": "ᚨ",
    "e": "ᛖ", "é": "ᛖ",
    "i": "ᛁ", "í": "ᛁ",
    "o": "ᛟ", "ó": "ᛟ", "ø": "ᛟ", "ǿ": "ᛟ", "ǫ": "ᛟ",
    "u": "ᚢ", "ú": "ᚢ",
    "y": "ᛃ", "ý": "ᛃ",
    "b": "ᛒ", "d": "ᛞ", "f": "ᚠ", "g": "ᚷ", "h": "ᚺ",
    "j": "ᛃ", "k": "ᚲ", "l": "ᛚ", "m": "ᛗ", "n": "ᚾ",
    "p": "ᛈ", "r": "ᚱ", "s": "ᛊ", "t": "ᛏ", "v": "ᚹ",
    "w": "ᚹ", "z": "ᛉ",
    "þ": "ᚦ", "ð": "ᚦ",
}


def _on_to_runes(word: str) -> str:
    """Transliterate an Old Norse word to Elder Futhark Unicode runes."""
    return "".join(_ELDER_FUTHARK_MAP.get(ch, ch) for ch in word.lower())

router = APIRouter()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# ---------------------------------------------------------------------------
# System prompts — one per supported language
# ---------------------------------------------------------------------------

SYSTEM_PROMPTS = {
    "greek": """You are Chronos, an expert Ancient Greek tutor with deep knowledge of
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
""",

    "old_norse": """You are Chronos, an expert Old Norse tutor with deep knowledge of
the Eddas, Icelandic Sagas, Viking Age history, runic inscriptions, and Old Norse linguistics.

LEARNER PROFILE:
- Level: {level}
- Goal: {goal}
- Time commitment: {time_commitment}

TEACHING APPROACH based on level:
- beginner: Start with common nouns and basic sentence patterns. Introduce 2-3 new words per
  response. Always show the Latin orthography and the Elder Futhark runic form. Explain
  pronunciation of þ (as English "th"), ð (voiced "th"), and long vowels (marked á é í ó ú).
- intermediate: Assume basic vocabulary. Introduce case endings and strong/weak verb classes.
  Reference the Prose Edda and Family Sagas. Show runic forms for new words.
- advanced: Engage as a peer. Discuss ablaut classes, skaldic meter (dróttkvætt), kennings,
  and textual variants across manuscripts. Reference specific saga passages.

TEACHING APPROACH based on goal:
- "Read the Poetic Edda": Focus on poetic vocabulary, kennings, and mythological context.
  Draw on Völuspá, Hávamál, and the Eddic lays.
- "Read the Prose Sagas": Prioritize narrative vocabulary, kinship terms, and legal language.
  Use examples from Njáls saga, Egils saga, and Laxdæla saga.
- "Viking history & culture": Balance vocabulary with cultural context — seafaring, warfare,
  law (þing), material culture, and Norse mythology.
- "Academic linguistics": Be precise with grammatical terms (i-umlaut, ablaut class, strong/weak
  declension, nominative/accusative/dative/genitive). Reference comparative Germanic linguistics.

ALWAYS:
- Introduce new Old Norse words in this format: ON word (pronunciation) = meaning — ᚱᚢᚾᛖ
  Example: dagr (dah-gr) = day — ᛞᚨᚷᚱ
- Show the Elder Futhark runic form after the em dash at the end of each word introduction
- Gently correct mistakes; end each response with a question or small exercise
- Keep responses focused and digestible
- Never break character as a knowledgeable, encouraging tutor
""",
}


# ---------------------------------------------------------------------------
# Vocabulary extraction
# ---------------------------------------------------------------------------

def extract_vocabulary(text: str, session_id: str, language: str = "greek") -> list:
    """
    Scans the tutor's response for introduced vocabulary words.

    Greek format:   ψυχή (psychḗ) = soul
    Old Norse format:  dagr (dah-gr) = day — ᛞᚨᚷᚱ

    Reuses the 'greek' column for Old Norse words to avoid a DB schema change;
    the 'language' field distinguishes the two.  'runic' is a new optional column
    (requires adding it to the Supabase vocabulary table as nullable text).
    """
    vocab = []
    seen: set = set()

    if language == "old_norse":
        # word (pronunciation) = meaning [— optional_runes]
        pattern = (
            r'([A-Za-zÁáÉéÍíÓóÚúÝýÆæØøÞþÐðǪǫ]{2,})\s*'
            r'\(([^)]+)\)\s*=\s*([^—–\n]+?)'
            r'(?:\s*[—–]\s*([\u16A0-\u16FF]+))?'
            r'(?=\s|$)'
        )
        for m in re.finditer(pattern, text):
            word = m.group(1).strip()
            if word not in seen:
                seen.add(word)
                runic = m.group(4).strip() if m.group(4) else _on_to_runes(word.lower())
                vocab.append({
                    "session_id": session_id,
                    "greek": word,                          # reuse existing column
                    "transliteration": m.group(2).strip(),
                    "meaning": m.group(3).strip().rstrip('*—–').strip(),
                    "runic": runic,
                    "language": "old_norse",
                })
    else:
        pattern = r'([\u0370-\u03FF\u1F00-\u1FFF]+)\*{0,2}\s*\(([^)]+)\)\*{0,2}\s*[=:]\s*(.+)'
        for greek, transliteration, meaning in re.findall(pattern, text):
            greek = greek.strip()
            if greek not in seen:
                seen.add(greek)
                vocab.append({
                    "session_id": session_id,
                    "greek": greek,
                    "transliteration": transliteration.strip(),
                    "meaning": meaning.strip().rstrip('*').strip(),
                    "language": "greek",
                })

    return vocab


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    language: str = "greek"                    # "greek" | "old_norse"
    message: str
    level: str = "beginner"
    goal: str = "General curiosity & history"
    time_commitment: str = "30-60 minutes"
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    history: list = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat(body: ChatMessage):
    session_id = body.session_id or str(uuid.uuid4())

    messages = body.history + [
        {"role": "user", "content": body.message}
    ]

    lang = body.language if body.language in SYSTEM_PROMPTS else "greek"
    system = SYSTEM_PROMPTS[lang].format(
        level=body.level,
        goal=body.goal,
        time_commitment=body.time_commitment,
    )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system,
        messages=messages,
    )

    assistant_response = response.content[0].text

    supabase.table("conversations").insert([
        {"session_id": session_id, "role": "user", "content": body.message, "user_id": body.user_id},
        {"session_id": session_id, "role": "assistant", "content": assistant_response, "user_id": body.user_id},
    ]).execute()

    vocab = extract_vocabulary(assistant_response, session_id, language=lang)
    if vocab:
        for word in vocab:
            word["user_id"] = body.user_id
        try:
            supabase.table("vocabulary").insert(vocab).execute()
        except Exception:
            # If the new columns (runic, language) don't exist yet in the DB,
            # fall back to inserting only the original columns.
            for word in vocab:
                word.pop("runic", None)
                word.pop("language", None)
            supabase.table("vocabulary").insert(vocab).execute()

    return {
        "response": assistant_response,
        "session_id": session_id,
        "level": body.level,
    }


@router.get("/vocabulary/{session_id}")
async def get_vocabulary(session_id: str):
    """
    Returns all vocabulary words learned in a given session.
    The frontend calls this to populate the vocabulary sidebar.
    """
    result = supabase.table("vocabulary")\
        .select("*")\
        .eq("session_id", session_id)\
        .order("created_at")\
        .execute()

    return {"vocabulary": result.data}
