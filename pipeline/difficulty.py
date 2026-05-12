"""
Multi-factor difficulty estimation for Quechua vocabulary items.

Factors
-------
1. Frequency band   — the primary driver.  Core vocabulary = A1.
2. Phonological complexity — ejectives/aspirates (rare in Ayacucho but
   detectable in corpus noise from Cusco forms) and uvular /q/.
3. Morpheme depth   — number of suffix layers stripped during lemmatisation.
   Deeper forms indicate higher morphosyntactic complexity.
4. Lemma length     — longer forms are harder to memorise and produce.

All factors combine into a single numeric score that maps to a CEFR level.
"""
from __future__ import annotations

import logging
from typing import Dict

from .config import (
    DIFFICULTY_BASE,
    DIFFICULTY_MODIFIERS,
    DIFFICULTY_THRESHOLDS,
    EJECTIVE_SEQUENCES,
    ASPIRATED_SEQUENCES,
    UVULAR_CHARS,
)
from .vocabulary import LemmaEntry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Per-lemma phonological analysis
# ---------------------------------------------------------------------------

def _has_ejective(lemma: str) -> bool:
    return any(seq in lemma for seq in EJECTIVE_SEQUENCES)


def _has_aspirated(lemma: str) -> bool:
    return any(seq in lemma for seq in ASPIRATED_SEQUENCES)


def _has_uvular(lemma: str) -> bool:
    """
    Check for plain uvular /q/ not part of an aspirated or ejective sequence.
    We strip known digraphs first to avoid false positives.
    """
    stripped = lemma
    for seq in EJECTIVE_SEQUENCES + ASPIRATED_SEQUENCES:
        stripped = stripped.replace(seq, "")
    return any(ch in stripped for ch in UVULAR_CHARS)


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

    if _has_ejective(entry.lemma):
        score += DIFFICULTY_MODIFIERS["has_ejective"]
    if _has_aspirated(entry.lemma):
        score += DIFFICULTY_MODIFIERS["has_aspirated"]
    if _has_uvular(entry.lemma):
        score += DIFFICULTY_MODIFIERS["has_uvular"]

    depth = entry.morpheme_depth
    if depth >= 4:
        score += DIFFICULTY_MODIFIERS["morpheme_depth_4p"]
    elif depth >= 2:
        score += DIFFICULTY_MODIFIERS["morpheme_depth_2_3"]

    n = len(entry.lemma)
    if n >= 13:
        score += DIFFICULTY_MODIFIERS["length_13p"]
    elif n >= 9:
        score += DIFFICULTY_MODIFIERS["length_9_12"]

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
