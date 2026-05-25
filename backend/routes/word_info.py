import json
import re

from anthropic import AsyncAnthropic
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
_client = AsyncAnthropic()

# Request models for the two endpoints
class GlossaryRequest(BaseModel):
    greek_text: str  # The full Greek sentence from the caption

class WordInfoRequest(BaseModel):
    word: str        # The individual word the user clicked
    info_type: str   # "translation" | "morphology" | "examples" | "etymology"

# Prompts for each type of information the user can request.
# {word} is a placeholder filled in at request time inside word_info().
PROMPTS = {
    "translation": (
        "You are an expert in Ancient Greek and Modern Greek linguistics.\n"
        "Give a clear, concise translation of the Greek word «{word}».\n"
        "Include:\n"
        "1. Primary English meaning(s) with part of speech\n"
        "2. Any important secondary meanings\n"
        "3. A note if it's Ancient vs Modern Greek usage\n"
        "Keep it to 3–5 sentences. Plain text, no markdown."
    ),
    "morphology": (
        "You are an expert in Ancient Greek and Modern Greek linguistics.\n"
        "Analyze the word «{word}» morphologically.\n"
        "If it is a verb: identify the tense, person, number, and show the full present-tense conjugation table.\n"
        "If it is a noun or adjective: identify the case, gender, number, and show the full declension table.\n"
        "Use plain text with simple alignment. No markdown symbols."
    ),
    "examples": (
        "You are an expert in Ancient Greek literature.\n"
        "Give 2–3 examples of the word «{word}» used in Ancient Greek classical texts.\n"
        "For each example:\n"
        "- The Greek quote (a short phrase or sentence)\n"
        "- The source (author, work, book/chapter)\n"
        "- English translation of the quote\n"
        "Plain text only."
    ),
    "etymology": (
        "You are an expert in Greek etymology.\n"
        "Explain the etymology and word family of «{word}».\n"
        "Include:\n"
        "1. Root/stem meaning and Proto-Indo-European origin if known\n"
        "2. Related Greek words (compounds, derivatives)\n"
        "3. English or Spanish words derived from this Greek root\n"
        "Keep it engaging and educational. 4–6 sentences. Plain text."
    ),
    # new prompt type used by the dictionary page conjugation tab.
    # returns structured JSON so the frontend can render a proper table,
    # instead of plain text like the other prompts
    "conjugation_table": (
        "You are an Ancient Greek linguistics expert.\n"
        "Analyze the word «{word}» and return a JSON object.\n\n"
        "If it is a VERB, return exactly this shape:\n"
        '{{\n'
        '  "type": "verb",\n'
        '  "lemma": "dictionary form (1st person singular present)",\n'
        '  "meaning": "to ...",\n'
        '  "participles": {{"present": "...", "aorist": "...", "perfect": "..."}},\n'
        '  "indicative": {{\n'
        '    "tenses": ["Present", "Imperfect", "Aorist", "Future", "Perfect"],\n'
        '    "rows": [\n'
        '      {{"person": "1sg", "label": "ἐγώ", "forms": ["form", "form", "form", "form", "form"]}},\n'
        '      {{"person": "2sg", "label": "σύ", "forms": ["form", "form", "form", "form", "form"]}},\n'
        '      {{"person": "3sg", "label": "αὐτός", "forms": ["form", "form", "form", "form", "form"]}},\n'
        '      {{"person": "1pl", "label": "ἡμεῖς", "forms": ["form", "form", "form", "form", "form"]}},\n'
        '      {{"person": "2pl", "label": "ὑμεῖς", "forms": ["form", "form", "form", "form", "form"]}},\n'
        '      {{"person": "3pl", "label": "αὐτοί", "forms": ["form", "form", "form", "form", "form"]}}\n'
        '    ]\n'
        '  }}\n'
        '}}\n\n'
        "If it is a NOUN or ADJECTIVE, return exactly this shape:\n"
        '{{\n'
        '  "type": "noun",\n'
        '  "lemma": "dictionary form (nominative singular)",\n'
        '  "meaning": "...",\n'
        '  "gender": "masculine / feminine / neuter",\n'
        '  "declension": {{\n'
        '    "rows": [\n'
        '      {{"case": "Nominative", "singular": "...", "plural": "..."}},\n'
        '      {{"case": "Genitive",   "singular": "...", "plural": "..."}},\n'
        '      {{"case": "Dative",     "singular": "...", "plural": "..."}},\n'
        '      {{"case": "Accusative", "singular": "...", "plural": "..."}},\n'
        '      {{"case": "Vocative",   "singular": "...", "plural": "..."}}\n'
        '    ]\n'
        '  }}\n'
        '}}\n\n'
        "Return ONLY the JSON object, no other text."
    ),
    # structured dictionary entry, used by the /dictionary/[word] page.
    # returns JSON so the frontend can render numbered definitions and examples
    # like a proper lexicon entry, not plain text
    "dictionary_entry": (
        "You are an Ancient Greek lexicographer.\n"
        "Create a full dictionary entry for the Greek word «{word}».\n"
        "Return ONLY a JSON object with this exact shape:\n"
        "{{\n"
        '  "searched_word": "the exact word as searched, e.g. εστιν",\n'
        '  "searched_form_info": "grammatical description of the searched form, e.g. 3rd person singular present indicative",\n'
        '  "lemma": "citation form of the word",\n'
        '  "pronunciation": "romanization of the LEMMA, not the searched form, e.g. EI-mi for εἰμί",\n'
        '  "part_of_speech": "noun / verb / adjective / adverb / particle",\n'
        '  "gender": "masculine / feminine / neuter, or null if not a noun",\n'
        '  "period": "Ancient Greek / Modern Greek / Ancient and Modern Greek",\n'
        '  "sections": [\n'
        '    {{\n'
        '      "label": "uppercase grammatical label, e.g. TRANSITIVE VERB or MASCULINE NOUN",\n'
        '      "definitions": [\n'
        '        {{\n'
        '          "context": "brief usage context in parentheses, e.g. philosophical or referring to existence",\n'
        '          "meanings": [\n'
        '            {{\n'
        '              "english": "English meaning",\n'
        '              "example_greek": "short classical Greek phrase or sentence",\n'
        '              "example_english": "English translation of the example",\n'
        '              "source": "citation, e.g. Plato, Republic 514a or John 1:1 or Homer, Iliad 1.1, or null if unknown"\n'
        '            }}\n'
        '          ]\n'
        '        }}\n'
        '      ]\n'
        '    }}\n'
        '  ]\n'
        "}}\n\n"
        "Include 1 to 3 sections, each with 1 to 3 definitions. "
        "Use real classical examples from Homer, Plato, Aristotle, or the New Testament where possible. "
        "Return ONLY the JSON object, no other text."
    ),
}

@router.post("/word-glossary")
async def word_glossary(req: GlossaryRequest):
    """
    Accepts a full Greek sentence and returns a word-by-word translation map.
    Example response: { "λόγος": "word, reason", "ἐστί": "is" }

    This is called automatically when a new caption arrives so hover tooltips
    are ready before the user needs them.
    """
    result = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[
            {
                "role": "user",
                "content": (
                    "You are a Greek linguistics expert. "
                    "Given this Greek text, return a JSON object mapping each distinct "
                    "meaningful word (without punctuation) to a short English gloss (1–4 words). "
                    "Skip very minor particles if needed.\n\n"
                    f"Greek text: {req.greek_text}\n\n"
                    'Return ONLY the JSON object. Example: {"λόγος": "word, reason", "ἐστί": "is"}'
                ),
            }
        ],
    )

    raw = result.content[0].text.strip()

    # Claude sometimes adds surrounding text — use regex to extract just the JSON object
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return {"glossary": json.loads(match.group())}
        except json.JSONDecodeError:
            pass

    # If parsing fails, return an empty glossary — the frontend handles this gracefully
    return {"glossary": {}}

@router.post("/word-info")
async def word_info(req: WordInfoRequest):
    """
    Accepts a single Greek word and an info type, and returns a Claude-generated analysis.
    Called when the user clicks one of the four option buttons in the WordInfoPanel.
    """
    prompt_template = PROMPTS.get(req.info_type)
    if not prompt_template:
        return {"error": f"Unknown info_type: {req.info_type}"}

    # Fill in the {word} placeholder with the actual word
    result = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200 if req.info_type in ("dictionary_entry", "conjugation_table") else 600,
        messages=[{"role": "user", "content": prompt_template.format(word=req.word)}],
    )

    return {
        "word": req.word,
        "info_type": req.info_type,
        "content": result.content[0].text.strip(),
    }