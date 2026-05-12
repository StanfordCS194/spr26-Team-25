"""
Quechua-aware text cleaning and tokenisation.

Key design decisions:
- Apostrophes inside ejective consonant sequences (p', t', k', q', ch') are
  part of the grapheme and must NOT be treated as token boundaries.
- Digits are dropped — numerals in corpus text are typically Spanish loanwords
  or code-switched forms that don't belong in the Quechua vocabulary.
- Very short tokens (< 2 characters) are discarded as noise.
- Sentences with suspiciously many Spanish words are flagged; the heuristic
  checks for high-frequency Spanish function words absent in Quechua.
"""
from __future__ import annotations

import logging
import re
from typing import List, Optional, Tuple

import pandas as pd
from tqdm import tqdm

from .config import (
    COL_ES,
    COL_QU,
    COL_TEXT,
    MAX_LENGTH_RATIO,
    MAX_TOKENS,
    MIN_TOKENS,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Character-level normalisation
# ---------------------------------------------------------------------------

# Ejective digraph protection — we replace the apostrophe with a private-use
# codepoint before stripping punctuation, then restore it afterwards.
_EJECTIVE_RE = re.compile(r"(ch|p|t|k|q)'")
_PROTECT = ""  # private use area — safe placeholder

# Punctuation to strip (everything that is not alphanumeric, space, or the
# protected ejective placeholder).  We keep hyphens inside words to handle
# any compound forms.
_PUNCT_RE = re.compile(r"[^\w\s-]")
# Inline hyphens (word-internal) are kept; leading/trailing are stripped
_LEADING_TRAILING_HYPHEN = re.compile(r"(?:^-|-$)")

# High-frequency Spanish function words used to detect code-switching / noisy
# sentences in the Quechua column.
_SPANISH_STOPWORDS = frozenset(
    "el la los las un una de que en es para por con no se al del"
    " le su sus pero más como si yo tú él ella esto eso aquí allí".split()
)
# If this fraction of Quechua-column tokens are Spanish stopwords, skip the
# sentence entirely.
_SPANISH_CONTAMINATION_THRESHOLD = 0.40


def _protect_ejectives(text: str) -> str:
    return _EJECTIVE_RE.sub(lambda m: m.group(1) + _PROTECT, text)


def _restore_ejectives(text: str) -> str:
    return text.replace(_PROTECT, "'")


def normalise_text(text: str) -> str:
    """
    Lowercase, collapse whitespace, strip punctuation while preserving
    Quechua ejective apostrophes.
    """
    text = text.lower().strip()
    text = _protect_ejectives(text)
    text = _PUNCT_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = _restore_ejectives(text)
    return text


def tokenise(text: str) -> List[str]:
    """
    Split normalised text into tokens, dropping pure digits and length-1 tokens.
    """
    tokens = normalise_text(text).split()
    return [
        t for t in tokens
        if len(t) >= 2 and not t.isdigit() and not re.fullmatch(r"\d+", t)
    ]


def _spanish_contamination_ratio(tokens: List[str]) -> float:
    if not tokens:
        return 0.0
    hits = sum(1 for t in tokens if t in _SPANISH_STOPWORDS)
    return hits / len(tokens)


# ---------------------------------------------------------------------------
# Sentence-level quality filters
# ---------------------------------------------------------------------------

def _is_valid_parallel_pair(
    qu_tokens: List[str],
    es_tokens: List[str],
) -> Tuple[bool, Optional[str]]:
    """
    Return (True, None) if the pair should be kept, or (False, reason) if not.
    """
    if len(qu_tokens) < MIN_TOKENS:
        return False, "qu_too_short"
    if len(qu_tokens) > MAX_TOKENS:
        return False, "qu_too_long"
    if len(es_tokens) < MIN_TOKENS:
        return False, "es_too_short"

    ratio = max(len(qu_tokens), len(es_tokens)) / max(
        min(len(qu_tokens), len(es_tokens)), 1
    )
    if ratio > MAX_LENGTH_RATIO:
        return False, "length_ratio"

    if _spanish_contamination_ratio(qu_tokens) >= _SPANISH_CONTAMINATION_THRESHOLD:
        return False, "spanish_contamination"

    return True, None


def _is_valid_mono(tokens: List[str]) -> Tuple[bool, Optional[str]]:
    if len(tokens) < MIN_TOKENS:
        return False, "too_short"
    if len(tokens) > MAX_TOKENS:
        return False, "too_long"
    if _spanish_contamination_ratio(tokens) >= _SPANISH_CONTAMINATION_THRESHOLD:
        return False, "spanish_contamination"
    return True, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def clean_parallel(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """
    Clean the parallel DataFrame.

    Returns:
        (cleaned_df, stats_dict)
        cleaned_df has columns: qu, es, qu_tokens, es_tokens
    """
    rows = []
    stats: dict = {"total": len(df), "kept": 0, "dropped": {}}

    for _, row in tqdm(df.iterrows(), total=len(df), desc="Cleaning parallel", unit="rows"):
        qu_raw = row.get(COL_QU)
        es_raw = row.get(COL_ES)

        if not isinstance(qu_raw, str) or not isinstance(es_raw, str):
            stats["dropped"].setdefault("missing_field", 0)
            stats["dropped"]["missing_field"] += 1
            continue

        qu_tokens = tokenise(qu_raw)
        es_tokens = tokenise(es_raw)

        valid, reason = _is_valid_parallel_pair(qu_tokens, es_tokens)
        if not valid:
            stats["dropped"].setdefault(reason, 0)
            stats["dropped"][reason] += 1
            continue

        rows.append(
            {
                COL_QU: normalise_text(qu_raw),
                COL_ES: normalise_text(es_raw),
                "qu_tokens": qu_tokens,
                "es_tokens": es_tokens,
            }
        )
        stats["kept"] += 1

    logger.info(
        "Parallel: kept %d / %d  (dropped: %s)",
        stats["kept"], stats["total"], stats["dropped"],
    )
    return pd.DataFrame(rows), stats


def clean_monolingual(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """
    Clean the monolingual DataFrame.

    Returns:
        (cleaned_df, stats_dict)
        cleaned_df has columns: text, tokens
    """
    rows = []
    stats: dict = {"total": len(df), "kept": 0, "dropped": {}}

    for _, row in tqdm(df.iterrows(), total=len(df), desc="Cleaning monolingual", unit="rows"):
        raw = row.get(COL_TEXT)
        if not isinstance(raw, str):
            stats["dropped"].setdefault("missing_field", 0)
            stats["dropped"]["missing_field"] += 1
            continue

        tokens = tokenise(raw)
        valid, reason = _is_valid_mono(tokens)
        if not valid:
            stats["dropped"].setdefault(reason, 0)
            stats["dropped"][reason] += 1
            continue

        rows.append({"text": normalise_text(raw), "tokens": tokens})
        stats["kept"] += 1

    logger.info(
        "Monolingual: kept %d / %d  (dropped: %s)",
        stats["kept"], stats["total"], stats["dropped"],
    )
    return pd.DataFrame(rows), stats
