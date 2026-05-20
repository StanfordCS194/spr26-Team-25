"""Typed models mirroring packs/schema.json. Hand-maintained per the
design decision in plan: lower tooling complexity than auto-generation;
drift is detectable via the CI validator (Phase 5)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Script(_Frozen):
    primary: Optional[str] = None
    unicodeRanges: List[str] = Field(..., min_length=1)
    direction: Literal["ltr", "rtl"] = "ltr"


class Vocabulary(_Frozen):
    lineFormat: Optional[str] = None
    transliterationScheme: Literal["none", "ipa", "romanization", "both"] = "none"


class Tutor(_Frozen):
    name: str
    personaShort: str
    welcomeGreeting: Optional[str] = None
    correctionStyle: Literal["gentle-restate", "direct", "socratic"] = "gentle-restate"
    responseLength: Literal["concise", "balanced", "thorough"] = "balanced"


class Level(_Frozen):
    id: str
    label: Optional[str] = None
    guidance: str


class Goal(_Frozen):
    id: str
    label: str
    guidance: str


class MorphologySegment(_Frozen):
    form: str
    gloss: str


class Morphology(_Frozen):
    segments: List[MorphologySegment] = Field(default_factory=list)


class DictionaryExample(_Frozen):
    target: str
    english: str


class Provenance(_Frozen):
    source: Optional[str] = None
    url: Optional[str] = None
    contributor: Optional[str] = None
    date: Optional[str] = None
    verified: Optional[bool] = None


class DictionaryEntry(_Frozen):
    word: str
    translit: Optional[str] = None
    ipa: Optional[str] = None
    meaning: str
    partOfSpeech: Optional[str] = None
    morphology: Optional[Morphology] = None
    examples: List[DictionaryExample] = Field(default_factory=list)
    dialect: Optional[str] = None
    audioUrl: Optional[str] = None
    provenance: Optional[Provenance] = None


class Dictionary(_Frozen):
    entries: List[DictionaryEntry] = Field(default_factory=list)


class Grounding(_Frozen):
    policy: Optional[Literal["open", "prefer", "strict"]] = None
    retrieval: Literal["none", "inline-all", "rag", "exact-lookup"] = "none"
    dictionaryRef: Optional[str] = None
    dictionary: Optional[Dictionary] = None
    uncertaintyPhrase: str = (
        "I'm not certain about that word — let's note it and check with a fluent speaker or reference."
    )

    @model_validator(mode="after")
    def _exclusive_dictionary_source(self) -> "Grounding":
        if self.dictionary is not None and self.dictionaryRef is not None:
            raise ValueError("grounding may set dictionary or dictionaryRef, not both")
        return self


class FallbackVoice(_Frozen):
    provider: Optional[str] = None
    voice: Optional[str] = None
    languageCode: Optional[str] = None
    rationale: Optional[str] = None


class Voice(_Frozen):
    provider: Literal["none", "google-tts", "elevenlabs", "azure", "recorded"] = "none"
    voice: Optional[str] = None
    languageCode: Optional[str] = None
    fallbackVoice: Optional[FallbackVoice] = None
    audioPerEntry: bool = False


class Sovereignty(_Frozen):
    license: str
    attribution: Optional[str] = None
    contact: Optional[str] = None
    restrictions: List[str] = Field(default_factory=list)
    communityPartnership: Optional[str] = None


class LanguagePack(_Frozen):
    """Top-level language pack. Field names mirror schema.json exactly so the
    schema validator and pydantic see the same JSON."""

    schema_field: Optional[str] = Field(default=None, alias="$schema")

    id: str
    schemaVersion: str = "1.0"
    version: Optional[str] = None

    displayName: str
    displayNameLocal: Optional[str] = None
    status: Literal["vibrant", "endangered", "dormant", "reconstructed"]
    family: Optional[str] = None
    dialect: Optional[str] = None
    iso639: Optional[str] = None

    script: Script
    vocabulary: Vocabulary = Field(default_factory=Vocabulary)
    tutor: Tutor
    levels: List[Level] = Field(default_factory=list)
    goals: List[Goal] = Field(default_factory=list)
    promptTemplate: str
    grounding: Grounding = Field(default_factory=Grounding)
    voice: Voice = Field(default_factory=Voice)
    sovereignty: Sovereignty

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)


class LearnerProfile(BaseModel):
    """Per-session learner state passed to prompt.compose. Field names are flat
    because that's what the existing /api/chat body uses."""

    level: str
    goal: str
    time_commitment: str = "30-60 minutes"

    model_config = ConfigDict(extra="forbid")
