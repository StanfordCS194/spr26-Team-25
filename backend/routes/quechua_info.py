import json
import re

from anthropic import AsyncAnthropic
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
_client = AsyncAnthropic()

class QuechuaTranslateRequest(BaseModel):
    glosses: list[str]  # Spanish glosses from the vocabulary

@router.post("/quechua-translate")
async def quechua_translate(req: QuechuaTranslateRequest):
    """Translates Spanish Quechua glosses to English via Claude Haiku."""
    result = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": (
                "Translate each of these short Spanish dictionary glosses to English. "
                "Return ONLY a JSON array of strings in the same order, e.g. [\"parents\", \"to run\"]. "
                "Keep each translation short (1-4 words).\n\n"
                f"Glosses: {json.dumps(req.glosses, ensure_ascii=False)}"
            )
        }],
    )
    raw = result.content[0].text.strip()
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if match:
        try:
            return {"translations": json.loads(match.group())}
        except json.JSONDecodeError:
            pass
    # fallback to Spanish if Claude response can't be parsed
    return {"translations": req.glosses}