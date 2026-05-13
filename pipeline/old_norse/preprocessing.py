"""
Old Norse–aware text cleaning and tokenisation.

Key design decisions
--------------------
- Old Norse special characters (þ, ð, æ, ø, ǫ) and long-vowel diacritics
  (á, é, í, ó, ú, ý) are phonemically meaningful and MUST NOT be stripped
  or replaced during normalisation.
- Digits are dropped — numerals in corpus text are typically editorial
  annotations (chapter numbers, footnote markers) rather than lexical items.
- Very short tokens (< 2 characters) are discarded as noise.
- Sentences with suspiciously many Latin function words are flagged as
  contaminated and excluded (editorial apparatus, chapter headings in Latin).

Output column names mirror the Quechua pipeline so that shared modules
(vocabulary.py, semantics.py, schema_writer.py) can be reused unmodified:

    parallel DataFrame  → qu, es, qu_tokens, es_tokens
    monolingual DataFrame → text, tokens
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
    MIN_PARALLEL_QU_TOKENS,
    MIN_TOKENS,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Character-level normalisation
# ---------------------------------------------------------------------------

# Characters to preserve (Old Norse alphabet including special chars)
# We strip only "decorative" punctuation; apostrophes used as separator are OK.
_PUNCT_RE = re.compile(r"[^\wÁáÉéÍíÓóÚúÝýÆæØøÞþÐðǪǫ\s-]")
_LEADING_TRAILING_HYPHEN = re.compile(r"(?:^-|-$)")

# Latin function words used to detect editorial contamination in Old Norse text.
# High-frequency Latin words that should not appear in Old Norse prose.
_LATIN_STOPWORDS = frozenset(
    "et in de que est cum per ad non ut sed si vel cum ergo"
    " enim autem quod quia quando quam nisi ex ab".split()
)
_LATIN_CONTAMINATION_THRESHOLD = 0.35


def normalise_text(text: str) -> str:
    """
    Lowercase, collapse whitespace, strip punctuation while preserving
    all Old Norse special characters (þ ð æ ø ǫ á é í ó ú ý).
    """
    text = text.lower().strip()
    text = _PUNCT_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenise(text: str) -> List[str]:
    """
    Split normalised text into tokens, dropping pure digits and length-1 tokens.
    """
    tokens = normalise_text(text).split()
    return [
        t for t in tokens
        if len(t) >= 2 and not re.fullmatch(r"\d+", t)
    ]


def _latin_contamination_ratio(tokens: List[str]) -> float:
    if not tokens:
        return 0.0
    hits = sum(1 for t in tokens if t in _LATIN_STOPWORDS)
    return hits / len(tokens)


# ---------------------------------------------------------------------------
# Sentence-level quality filters
# ---------------------------------------------------------------------------

def _is_valid_parallel_pair(
    qu_tokens: List[str],
    es_tokens: List[str],
) -> Tuple[bool, Optional[str]]:
    """Return (True, None) if pair should be kept, else (False, reason)."""
    if len(qu_tokens) < MIN_PARALLEL_QU_TOKENS:
        return False, "qu_too_short"
    if len(qu_tokens) > MAX_TOKENS:
        return False, "qu_too_long"
    if len(es_tokens) < MIN_TOKENS:
        return False, "es_too_short"

    # Skip length-ratio check for dictionary-style entries (single ON headword).
    # Zoëga definitions are naturally much longer than the headword — e.g.
    # "skip" (1 token) → "ship; vessel used for seafaring" (5+ tokens).
    if len(qu_tokens) > 1:
        ratio = max(len(qu_tokens), len(es_tokens)) / max(
            min(len(qu_tokens), len(es_tokens)), 1
        )
        if ratio > MAX_LENGTH_RATIO:
            return False, "length_ratio"

    if _latin_contamination_ratio(qu_tokens) >= _LATIN_CONTAMINATION_THRESHOLD:
        return False, "latin_contamination"

    return True, None


def _is_valid_mono(tokens: List[str]) -> Tuple[bool, Optional[str]]:
    if len(tokens) < MIN_TOKENS:
        return False, "too_short"
    if len(tokens) > MAX_TOKENS:
        return False, "too_long"
    if _latin_contamination_ratio(tokens) >= _LATIN_CONTAMINATION_THRESHOLD:
        return False, "latin_contamination"
    return True, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def clean_parallel(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """
    Clean the parallel ON↔EN DataFrame.

    Returns:
        (cleaned_df, stats_dict)
        cleaned_df has columns: qu, es, qu_tokens, es_tokens
    """
    rows = []
    stats: dict = {"total": len(df), "kept": 0, "dropped": {}}

    if df.empty:
        logger.warning("Parallel corpus is empty — skipping parallel cleaning.")
        return pd.DataFrame(columns=["qu", "es", "qu_tokens", "es_tokens"]), stats

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
    Clean the monolingual Old Norse DataFrame.

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
