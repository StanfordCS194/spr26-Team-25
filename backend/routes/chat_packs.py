import os
import uuid
from typing import Optional
from functools import lru_cache
from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic
from supabase import create_client
from dotenv import load_dotenv
from fastapi.responses import JSONResponse
import re

load_dotenv()

router = APIRouter()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# import the language pack system built by the team
# load reads and validates the JSON pack file
# compose turns the pack and a learner profile into a system prompt string
# extract finds vocabulary words in the tutor's response
# LearnerProfile holds the learner's level, goal, and time commitment
from language_pack import load, compose, extract, LearnerProfile


@lru_cache(maxsize=16)
def _get_pack(pack_id: str):
    # cache loaded packs so we do not re-read and re-validate the JSON on every request
    return load(pack_id)


class PackChatMessage(BaseModel):
    message: str
    # which language pack to use, e.g. "ojibwe" or "classical-nahuatl"
    pack_id: str
    level: str = "beginner"
    goal: str = "everyday-greetings"
    time_commitment: str = "30-60 minutes"
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    history: list = []


@router.post("/chat-packs")
async def chat_packs(body: PackChatMessage):
    # generate a new session id if the frontend did not send one
    session_id = body.session_id or str(uuid.uuid4())

    # load the pack for this language, raises FileNotFoundError if pack does not exist
    try:
        pack = _get_pack(body.pack_id)
    except FileNotFoundError:
        return JSONResponse(
            status_code=400,
            content={"error": f"Pack '{body.pack_id}' not found. Available packs: ojibwe, classical-nahuatl"}
        )

    # build the learner profile from the request fields
    profile = LearnerProfile(
        level=body.level,
        goal=body.goal,
        time_commitment=body.time_commitment,
    )

    # compose turns the pack data and learner profile into a full system prompt
    # this replaces the hardcoded SYSTEM_PROMPT used in the original chat.py
    system_prompt = compose(pack, profile)

    # combine the conversation history with the new user message
    messages = body.history + [
        {"role": "user", "content": body.message}
    ]

    # call Claude with the pack generated system prompt
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )

    assistant_response = response.content[0].text

    # save the conversation to Supabase for learning progress tracking
    supabase.table("conversations").insert([
        {"session_id": session_id, "role": "user", "content": body.message, "user_id": body.user_id},
        {"session_id": session_id, "role": "assistant", "content": assistant_response, "user_id": body.user_id},
    ]).execute()

    # extract vocabulary words the tutor introduced in this response
    # the pack defines the unicode ranges and line format so the extractor knows what to look for
    try:
        vocab_rows = extract(pack, assistant_response, session_id=session_id)
        for row in vocab_rows:
            row["user_id"] = body.user_id
            # the vocabulary table uses the column name "greek" for the target word
            # we rename "word" to "greek" here to match the existing schema
            if "word" in row:
                row["greek"] = row.pop("word")
        if vocab_rows:
            supabase.table("vocabulary").insert(vocab_rows).execute()
    except Exception:
        # vocabulary extraction is non-critical, do not crash the response if it fails
        pass

    return {
        "response": assistant_response,
        "session_id": session_id,
        "pack_id": body.pack_id,
        "level": body.level,
    }