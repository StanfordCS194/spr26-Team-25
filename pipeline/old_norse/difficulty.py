"""
Multi-factor difficulty estimation for Old Norse vocabulary items.

Factors
-------
1. Frequency band   — the primary driver.  Core vocabulary = A1.
2. Phonological complexity — Old Norse has several characters unfamiliar to
   English speakers: thorn (þ), eth (ð), o-ogonek (ǫ), front-rounded vowels
   (ø), ash (æ), and macron-marked long vowels (á é í ó ú ý).
3. Morpheme depth   — number of suffix layers stripped during lemmatisation.
   Deeper forms (many case/agreement layers) indicate higher complexity.
4. Lemma length     — longer forms are harder to memorise and produce.

All factors combine into a single numeric score that maps to a CEFR level.
"""
from __future__ import annotations

import logging
from typing import Dict

from .config import (
    ASH_CHAR,
    DIFFICULTY_BASE,
    DIFFICULTY_MODIFIERS,
    DIFFICULTY_THRESHOLDS,
    FRONT_ROUNDED_CHARS,
    LONG_VOWELS,
    OGONEK_CHARS,
    THORN_ETH_CHARS,
)
from .vocabulary import LemmaEntry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Per-lemma phonological analysis
# ---------------------------------------------------------------------------

def _has_thorn_eth(lemma: str) -> bool:
    """Return True if lemma contains þ (thorn) or ð (eth)."""
    return any(ch in lemma for ch in THORN_ETH_CHARS)


def _has_front_rounded(lemma: str) -> bool:
    """Return True if lemma contains ø or ǿ (front rounded vowels)."""
    return any(ch in lemma for ch in FRONT_ROUNDED_CHARS)


def _has_ogonek(lemma: str) -> bool:
    """Return True if lemma contains ǫ (o-ogonek)."""
    return any(ch in lemma for ch in OGONEK_CHARS)


def _has_long_vowel(lemma: str) -> bool:
    """Return True if lemma contains any macron-marked long vowel."""
    return any(ch in lemma for ch in LONG_VOWELS)


def _has_ash(lemma: str) -> bool:
    """Return True if lemma contains æ (ash)."""
    return any(ch in lemma for ch in ASH_CHAR)


# ---------------------------------------------------------------------------
# Score → CEFR level
# ---------------------------------------------------------------------------

def _score_to_level(score: float) -> str:
    for threshold, level in DIFFICULTY_THRESHOLDS:
        if score < threshold:
            return level
    return "B2"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def estimate_difficulty(entry: LemmaEntry) -> None:
    """
    Compute and set `difficulty_score` and `proficiency_level` on a
    LemmaEntry.  Modifies the entry in place.
    """
    score = DIFFICULTY_BASE.get(entry.frequency_band, 4.5)

    if _has_thorn_eth(entry.lemma):
        score += DIFFICULTY_MODIFIERS["has_thorn_eth"]
    if _has_front_rounded(entry.lemma):
        score += DIFFICULTY_MODIFIERS["has_front_rounded"]
    if _has_ogonek(entry.lemma):
        score += DIFFICULTY_MODIFIERS["has_ogonek"]
    if _has_long_vowel(entry.lemma):
        score += DIFFICULTY_MODIFIERS["has_long_vowel"]
    if _has_ash(entry.lemma):
        score += DIFFICULTY_MODIFIERS["has_ash"]

    depth = entry.morpheme_depth
    if depth >= 4:
        score += DIFFICULTY_MODIFIERS["morpheme_depth_4p"]
    elif depth >= 2:
        score += DIFFICULTY_MODIFIERS["morpheme_depth_2_3"]

    n = len(entry.lemma)
    if n >= 14:
        score += DIFFICULTY_MODIFIERS["length_14p"]
    elif n >= 10:
        score += DIFFICULTY_MODIFIERS["length_10_13"]

    entry.difficulty_score = round(score, 3)
    entry.proficiency_level = _score_to_level(score)


def estimate_difficulty_all(store: Dict[str, LemmaEntry]) -> None:
    """Apply difficulty estimation to every lemma in the store."""
    logger.info("Estimating difficulty for %d lemmas …", len(store))
    for entry in store.values():
        estimate_difficulty(entry)

    dist: Dict[str, int] = {}
    for entry in store.values():
        dist[entry.proficiency_level] = dist.get(entry.proficiency_level, 0) + 1
    logger.info("Proficiency distribution: %s", dist)
