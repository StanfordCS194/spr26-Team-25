"""
Semantic field assignment for Old Norse vocabulary.

Strategy
--------
We use the English side of the parallel corpus (Zoëga dictionary definitions)
as a semantic signal, exactly mirroring the Quechua pipeline's use of Spanish.

For each Old Norse lemma, we look at the English definitions it appeared in
and check which predefined semantic field keywords those definitions contain.

A lemma is assigned to a field if the share of its co-occurring definitions
that contain that field's keywords exceeds FIELD_THRESHOLD.  Multiple fields
can be assigned.  Fields are ranked by coverage and capped at MAX_FIELDS.

Semantic field keywords are defined in config.py (English-language vocabulary
appropriate for Old Norse/Viking Age content: mythology, warfare, seafaring,
law, etc.)
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from typing import Dict, List, Set, Tuple

import pandas as pd
from tqdm import tqdm

from .config import SEMANTIC_FIELD_KEYWORDS
from .vocabulary import LemmaEntry

logger = logging.getLogger(__name__)

FIELD_THRESHOLD = 0.10   # fraction of co-sentences that must match a field
MAX_FIELDS = 3           # max semantic fields per lemma


def _build_sentence_field_map(
    parallel_df: pd.DataFrame,
) -> List[Set[str]]:
    """
    For each sentence in the parallel corpus, return the set of semantic
    fields whose keywords appear in the English side.
    """
    field_lists: Dict[str, List[str]] = SEMANTIC_FIELD_KEYWORDS
    result: List[Set[str]] = []

    for _, row in tqdm(
        parallel_df.iterrows(), total=len(parallel_df), desc="Mapping semantic fields"
    ):
        es_tokens_set: Set[str] = set(row.get("es_tokens", []))
        matched_fields: Set[str] = set()
        for field_name, keywords in field_lists.items():
            if es_tokens_set.intersection(keywords):
                matched_fields.add(field_name)
        result.append(matched_fields)

    return result


def assign_semantic_fields(
    parallel_df: pd.DataFrame,
    store: Dict[str, LemmaEntry],
    surface_to_lemma: Dict[str, str],
) -> None:
    """
    Populate `semantic_fields` on each LemmaEntry.
    Modifies `store` in place.  Skips gracefully if parallel_df is empty.
    """
    logger.info("Assigning semantic fields …")

    if parallel_df.empty or "qu_tokens" not in parallel_df.columns:
        logger.warning("Parallel corpus empty — skipping semantic field assignment.")
        return

    sentence_fields: List[Set[str]] = _build_sentence_field_map(parallel_df)

    lemma_field_hits: Dict[str, Counter] = defaultdict(Counter)
    lemma_sentence_count: Dict[str, int] = defaultdict(int)

    for sent_idx, row in tqdm(
        parallel_df.iterrows(), total=len(parallel_df), desc="Accumulating field hits"
    ):
        fields: Set[str] = sentence_fields[int(sent_idx)]
        if not fields:
            continue

        seen_lemmas: Set[str] = set()
        for qt in row["qu_tokens"]:
            lemma = surface_to_lemma.get(qt)
            if lemma and lemma in store and lemma not in seen_lemmas:
                seen_lemmas.add(lemma)

        for lemma in seen_lemmas:
            lemma_sentence_count[lemma] += 1
            for f in fields:
                lemma_field_hits[lemma][f] += 1

    for lemma, entry in store.items():
        n_sentences = lemma_sentence_count.get(lemma, 0)
        if n_sentences == 0:
            continue

        scored: List[Tuple[str, float]] = [
            (field, hits / n_sentences)
            for field, hits in lemma_field_hits[lemma].items()
            if hits / n_sentences >= FIELD_THRESHOLD
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        entry.semantic_fields = [f for f, _ in scored[:MAX_FIELDS]]

    assigned = sum(1 for e in store.values() if e.semantic_fields)
    logger.info(
        "Semantic fields assigned to %d / %d lemmas.", assigned, len(store)
    )
