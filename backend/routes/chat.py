import os
from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic
from dotenv import load_dotenv

# read .env file and get API key without having to write
# directly in the code
load_dotenv()

router = APIRouter()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

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
    history: list = []

@router.post("/chat")
async def chat(body: ChatMessage):
    messages = body.history + [
        {"role": "user", "content": body.message}
    ]
    
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=SYSTEM_PROMPT.format(level=body.level),
        messages=messages
    )
    
    return {
        "response": response.content[0].text,
        "level": body.level
    }