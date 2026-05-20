"""Load + validate + resolve refs + apply post-load defaults.

A pack on disk is plain JSON. After loading, this module:

1. Validates the raw JSON against packs/schema.json (jsonschema).
2. Constructs a LanguagePack via pydantic (typed mirror of the schema).
3. Resolves grounding.dictionaryRef against the pack's directory if set,
   producing an in-memory Dictionary.
4. Applies post-load defaults the schema cannot express:
   - grounding.policy: derived from status when not set.
   - vocabulary.lineFormat: derived from transliterationScheme when not set.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Union

from jsonschema import Draft202012Validator

from .models import Dictionary, Grounding, LanguagePack, Vocabulary

# Resolve packs/ at import time so callers don't pass paths repeatedly.
_REPO_ROOT = Path(__file__).resolve().parents[2]
PACKS_DIR = _REPO_ROOT / "packs"
SCHEMA_PATH = PACKS_DIR / "schema.json"


def _load_schema() -> dict:
    with SCHEMA_PATH.open() as f:
        return json.load(f)


_SCHEMA = _load_schema()
_VALIDATOR = Draft202012Validator(_SCHEMA)


def load(pack_id: str) -> LanguagePack:
    """Load by id. Looks up packs/<id>.json."""
    return load_path(PACKS_DIR / f"{pack_id}.json")


def load_path(path: Union[str, Path]) -> LanguagePack:
    """Load by filesystem path. Caller is responsible for the path."""
    path = Path(path).resolve()
    with path.open() as f:
        raw = json.load(f)

    errors = sorted(_VALIDATOR.iter_errors(raw), key=lambda e: e.path)
    if errors:
        msgs = []
        for e in errors[:5]:
            loc = ".".join(str(p) for p in e.absolute_path) or "<root>"
            msgs.append(f"  - {loc}: {e.message}")
        raise ValueError(f"Pack at {path} failed schema validation:\n" + "\n".join(msgs))

    pack = LanguagePack.model_validate(raw)
    pack = _resolve_dictionary_ref(pack, path.parent)
    pack = _apply_post_load_defaults(pack)
    return pack


def _resolve_dictionary_ref(pack: LanguagePack, pack_dir: Path) -> LanguagePack:
    """If grounding.dictionaryRef is set, load it and replace with an inline Dictionary."""
    if not pack.grounding.dictionaryRef:
        return pack

    ref_path = (pack_dir / pack.grounding.dictionaryRef).resolve()
    if not ref_path.is_file():
        raise FileNotFoundError(
            f"Pack '{pack.id}' references dictionary at {ref_path}, which does not exist."
        )
    with ref_path.open() as f:
        dict_data = json.load(f)

    dictionary = Dictionary.model_validate(dict_data)
    new_grounding = pack.grounding.model_copy(update={
        "dictionary": dictionary,
        "dictionaryRef": None,  # clear so callers don't try to resolve twice
    })
    return pack.model_copy(update={"grounding": new_grounding})


def _apply_post_load_defaults(pack: LanguagePack) -> LanguagePack:
    """Defaults the JSON Schema can't express (cross-field derivation)."""
    updates: dict = {}

    if pack.grounding.policy is None:
        policy = "open" if pack.status == "vibrant" else "strict"
        updates["grounding"] = pack.grounding.model_copy(update={"policy": policy})

    if pack.vocabulary.lineFormat is None:
        if pack.vocabulary.transliterationScheme == "none":
            fmt = "{word} = {meaning}"
        else:
            fmt = "{word} ({translit}) = {meaning}"
        updates["vocabulary"] = pack.vocabulary.model_copy(update={"lineFormat": fmt})

    return pack.model_copy(update=updates) if updates else pack
