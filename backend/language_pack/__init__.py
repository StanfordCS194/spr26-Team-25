"""Chronos language pack loader, prompt composer, and vocabulary extractor.

A language pack is a declarative JSON file (see packs/schema.json) describing
one language the tutor can teach. This package consumes packs at runtime:

- models:    typed mirror of the schema (pydantic)
- loader:    read + validate + apply defaults + resolve dictionaryRef
- prompt:    compose a system prompt from a pack + a learner profile
- extraction: build the vocabulary-extraction regex from the pack
- grounding:  materialize the {dictionary_context} placeholder

The package is opt-in. Existing routes are not modified.
"""

from .models import (
    LanguagePack,
    LearnerProfile,
    DictionaryEntry,
)
from .loader import load, load_path
from .prompt import compose
from .extraction import build_regex, extract
from .grounding import materialize_dictionary_context

__all__ = [
    "LanguagePack",
    "LearnerProfile",
    "DictionaryEntry",
    "load",
    "load_path",
    "compose",
    "build_regex",
    "extract",
    "materialize_dictionary_context",
]
