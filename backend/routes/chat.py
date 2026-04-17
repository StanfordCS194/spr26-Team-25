import os
import uuid
from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

SYSTEM_PROMPT = """You are Chronos, an expert Ancient Greek tutor. 
You teach Ancient Greek through immersive, encouraging conversation.

Your approach:
- Always adapt to the user's level (beginner, intermediate, advanced)
- Introduce vocabulary and grammar naturally within conversation
- Gently correct mistakes and explain why
- Use historical context to make the language feel alive
- Respond in English but introduce Greek words and phrases progressively

Current user level: {level}
"""

class ChatMessage(BaseModel):
    message: str
    level: str = "beginner"
    session_id: str = None
    history: list = []

@router.post("/chat")
async def chat(body: ChatMessage):
    session_id = body.session_id or str(uuid.uuid4())
    
    messages = body.history + [
        {"role": "user", "content": body.message}
    ]
    
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=SYSTEM_PROMPT.format(level=body.level),
        messages=messages
    )
    
    assistant_response = response.content[0].text
    
    # Save to Supabase
    supabase.table("conversations").insert([
        {"session_id": session_id, "role": "user", "content": body.message},
        {"session_id": session_id, "role": "assistant", "content": assistant_response}
    ]).execute()
    
    return {
        "response": assistant_response,
        "session_id": session_id,
        "level": body.level
    }