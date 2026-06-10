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
from pathlib import Path
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
    # which language pack to use, e.g. "ojibwe" 
    pack_id: str
    pack_data: Optional[dict] = None  # full pack JSON when user uploads their own pack
    level: str = "beginner"
    goal: str = "everyday-greetings"
    time_commitment: str = "30-60 minutes"
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    history: list = []

@router.post("/chat-packs")
async def chat_packs(body: PackChatMessage):
    # Generate a new session id if the frontend did not send one
    session_id = body.session_id or str(uuid.uuid4())

    if body.pack_data is not None:
        # User uploaded a custom pack so write it to a temp file and load it through the normal loader
        import tempfile
        import json as json_module
        import os

        # Resolve dictionaryRef for uploaded packs
        pack_copy = dict(body.pack_data)
        if 'grounding' in pack_copy and isinstance(pack_copy['grounding'], dict):
            grounding = dict(pack_copy['grounding'])
            dict_ref = grounding.pop('dictionaryRef', None)

            if dict_ref is not None:
                # If the pack id matches one on the server use that dictionary
                pack_id = pack_copy.get('id', '')
                server_dict = PACKS_DIR / pack_id / 'dictionary.json'
                if server_dict.exists():
                    grounding['dictionaryRef'] = str(server_dict)
                # Otherwise the user must include the dictionary inline under grounding.dictionary
                # so no action needed here for new languages

            pack_copy['grounding'] = grounding

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, dir='/tmp') as f:
            json_module.dump(pack_copy, f)
            temp_path = f.name
        try:
            from language_pack import load_path
            pack = load_path(temp_path)
        except Exception as e:
            return JSONResponse(status_code=400, content={"error": f"Invalid pack: {str(e)}"})
        finally:
            os.unlink(temp_path)
    else:
        # Load a built in pack by id
        try:
            pack = _get_pack(body.pack_id)
        except FileNotFoundError:
            return JSONResponse(
                status_code=400,
                content={"error": f"Pack '{body.pack_id}' not found."}
            )

    # Build the learner profile from the request fields
    profile = LearnerProfile(
        level=body.level,
        goal=body.goal,
        time_commitment=body.time_commitment,
    )

    # compose turns the pack and learner profile into a full system prompt
    system_prompt = compose(pack, profile)

    # Combine the conversation history with the new user message
    messages = body.history + [
        {"role": "user", "content": body.message}
    ]

    # Call Claude with the pack generated system prompt
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )

    assistant_response = response.content[0].text

    # Save the conversation to Supabase for learning progress tracking
    supabase.table("conversations").insert([
        {"session_id": session_id, "role": "user", "content": body.message, "user_id": body.user_id},
        {"session_id": session_id, "role": "assistant", "content": assistant_response, "user_id": body.user_id},
    ]).execute()

    # Extract vocabulary words the tutor introduced in this response
    try:
        vocab_rows = extract(pack, assistant_response, session_id=session_id)
        for row in vocab_rows:
            row["user_id"] = body.user_id
            # The vocabulary table column is named "greek" because in supabase the table column for target words is called "greek"
            # We reuse it here to store the target word regardless of language
            if "word" in row:
                row["greek"] = row.pop("word")
        if vocab_rows:
            supabase.table("vocabulary").insert(vocab_rows).execute()
    except Exception:
        # Vocabulary extraction is non critical so do not crash the response if it fails
        pass

    return {
        "response": assistant_response,
        "session_id": session_id,
        "pack_id": body.pack_id,
        "level": body.level,
    }

@router.get("/packs/{pack_id}")
async def get_pack_meta(pack_id: str):
    """Return display metadata for a single pack by id."""
    try:
        pack = _get_pack(pack_id)
        return {
            "id": pack.id,
            "name": pack.displayName,
            "tutorName": pack.tutor.name,
            "status": pack.status,
        }
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"error": f"Pack '{pack_id}' not found."})


@router.get("/packs")
async def list_packs():
    """Return metadata for every pack found in the packs directory."""
    packs_dir = Path(__file__).resolve().parents[1] / "packs"
    result = []
    for f in sorted(packs_dir.glob("*.json")):
        # Skip the schema file since it is not a language pack
        if f.name == "schema.json":
            continue
        try:
            pack = _get_pack(f.stem)
            result.append({
                "id": pack.id,
                "name": pack.displayName,
                "tutorName": pack.tutor.name,
                "status": pack.status,
            })
        except Exception:
            # Skip any pack that fails to load rather than crashing the whole list
            pass
    return {"packs": result}
