"""
Serialise extracted data into Chronos JSON schema format.

Output files
------------
- quechua/vocabulary/extracted/vocabulary.json
    Array of vocabulary entries conforming to schema/vocabulary.schema.json.
    IDs are prefixed with "ext-" to distinguish from hand-curated entries.

- quechua/examples/parallel.json
    Array of sentence entries conforming to schema/sentence.schema.json.
    IDs are prefixed with "par-" (parallel corpus source).

- pipeline/reports/run_report.json
    Pipeline statistics for quality review.

ID stability
------------
Vocabulary IDs are derived from the lemma string (lower-kebab-case).
Sentence IDs are positional (par-000001) — stable across runs only if the
parallel corpus is deterministically ordered, which HuggingFace datasets
guarantee for fixed splits.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from .config import (
    DIALECT,
    EXAMPLES_OUTPUT_DIR,
    PACK_ID,
    REPORT_DIR,
    SCHEMA_VERSION,
    VOCAB_OUTPUT_DIR,
)
from .vocabulary import LemmaEntry

logger = logging.getLogger(__name__)

# Vocabulary entries in the top-N by frequency get example sentences attached.
# Beyond this threshold we skip example linking to keep file sizes manageable.
MAX_ENTRIES_WITH_EXAMPLES = 5000
# Maximum example sentence IDs stored per vocabulary entry.
MAX_EXAMPLES_PER_ENTRY = 5
# Minimum frequency for a lemma to be written to the vocabulary file.
MIN_FREQUENCY_TO_EXPORT = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_id_slug(text: str) -> str:
    """Convert a lemma to a valid Chronos ID slug (lowercase-kebab)."""
    text = text.lower().strip()
    # Replace apostrophes used in ejectives with nothing (p' → p)
    text = text.replace("'", "")
    # Replace any remaining non-alphanumeric characters with hyphens
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text


def _make_vocab_id(lemma: str, seen_ids: Dict[str, int]) -> str:
    base = "ext-" + _to_id_slug(lemma)
    if base not in seen_ids:
        seen_ids[base] = 1
        return base
    count = seen_ids[base] + 1
    seen_ids[base] = count
    return f"{base}-{count}"


def _infer_pos(entry: LemmaEntry) -> str:
    """
    Map the pipeline's estimated_pos to the Chronos schema POS enum.
    Falls back to 'other' for ambiguous cases.
    """
    mapping = {
        "verb":  "verb",
        "noun":  "noun",
        "adj":   "adjective",
        "adv":   "adverb",
        "other": "other",
    }
    return mapping.get(entry.estimated_pos, "other")


def _build_vocab_entry(
    entry: LemmaEntry,
    vocab_id: str,
    sentence_id_map: Dict[int, str],
) -> Dict[str, Any]:
    """Convert a LemmaEntry into a Chronos vocabulary schema dict."""

    definitions = []
    if entry.gloss_candidates:
        # Primary definition: top-ranked gloss
        definitions.append(
            {
                "gloss": ", ".join(entry.gloss_candidates[:2]),
                "dialect_scope": [DIALECT],
            }
        )
        # Additional senses from remaining gloss candidates
        for extra_gloss in entry.gloss_candidates[2:]:
            definitions.append(
                {"gloss": extra_gloss, "dialect_scope": [DIALECT]}
            )
    else:
        # Fallback: gloss unknown
        definitions.append(
            {"gloss": "[auto-extracted — gloss pending review]", "dialect_scope": [DIALECT]}
        )

    # Example sentence IDs (parallel corpus only, capped)
    raw_example_ids = [
        sentence_id_map[idx]
        for idx in entry.example_ids[:MAX_EXAMPLES_PER_ENTRY]
        if idx in sentence_id_map
    ]

    surface_forms = sorted(
        entry.surface_forms.keys(),
        key=lambda f: entry.surface_forms[f],
        reverse=True,
    )
    # Alternate forms: all surface forms that are not the lemma itself
    alternate_forms = [f for f in surface_forms if f != entry.lemma][:10]

    result: Dict[str, Any] = {
        "id": vocab_id,
        "lemma": entry.lemma,
        "pos": _infer_pos(entry),
        "definitions": definitions,
        "frequency_band": entry.frequency_band,
        "proficiency_level": entry.proficiency_level,
        "dialect_variants": {
            DIALECT: {"notes": "Auto-extracted from corpus; review recommended."}
        },
    }

    if alternate_forms:
        result["alternate_forms"] = alternate_forms
    if entry.semantic_fields:
        result["semantic_fields"] = entry.semantic_fields
    if raw_example_ids:
        result["example_ids"] = raw_example_ids

    result["tags"] = sorted(
        {entry.proficiency_level, entry.frequency_band}
        | set(entry.semantic_fields)
    )

    result["extensions"] = {
        "_auto": True,
        "_corpus_frequency": entry.frequency,
        "_corpus_sources": sorted(entry.sources),
        "_morpheme_depth": entry.morpheme_depth,
        "_difficulty_score": entry.difficulty_score,
        "_gloss_candidates_full": entry.gloss_candidates,
    }

    return result


def _build_sentence_entry(
    sent_id: str,
    qu_text: str,
    es_text: str,
    qu_tokens: List[str],
    surface_to_lemma: Dict[str, str],
    lemma_to_vocab_id: Dict[str, str],
    source_id: str,
    proficiency_level: str,
    semantic_fields: List[str],
) -> Dict[str, Any]:
    """Convert a parallel sentence pair into a Chronos sentence schema dict."""

    vocab_focus = list(
        dict.fromkeys(  # preserve order, deduplicate
            lemma_to_vocab_id[surface_to_lemma[t]]
            for t in qu_tokens
            if t in surface_to_lemma
            and surface_to_lemma[t] in lemma_to_vocab_id
        )
    )[:8]

    tags = sorted({proficiency_level} | set(semantic_fields))

    return {
        "id": sent_id,
        "text": qu_text,
        "translation": es_text,
        "dialect": DIALECT,
        "source": source_id,
        "vocabulary_focus": vocab_focus,
        "tags": tags,
        "extensions": {
            "_auto": True,
        },
    }


# ---------------------------------------------------------------------------
# Main serialisation functions
# ---------------------------------------------------------------------------

def write_vocabulary(
    store: Dict[str, LemmaEntry],
    sentence_id_map: Dict[int, str],
    parallel_id: str,
    mono_id: str,
) -> Dict[str, str]:
    """
    Write vocabulary entries to VOCAB_OUTPUT_DIR/vocabulary.json.

    Returns a dict: lemma → vocab_id (used by sentence writer).
    """
    VOCAB_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = VOCAB_OUTPUT_DIR / "vocabulary.json"

    # Sort by frequency (most frequent first) for stable output ordering
    sorted_entries = sorted(
        store.values(), key=lambda e: e.frequency, reverse=True
    )

    seen_ids: Dict[str, int] = {}
    lemma_to_vocab_id: Dict[str, str] = {}
    entries_out: List[Dict[str, Any]] = []

    for rank, entry in enumerate(sorted_entries, start=1):
        if entry.frequency < MIN_FREQUENCY_TO_EXPORT:
            continue

        vocab_id = _make_vocab_id(entry.lemma, seen_ids)
        lemma_to_vocab_id[entry.lemma] = vocab_id

        # Only attach example IDs for high-frequency entries (performance)
        if rank <= MAX_ENTRIES_WITH_EXAMPLES:
            pass  # example_ids already on entry

        vocab_entry = _build_vocab_entry(entry, vocab_id, sentence_id_map)
        entries_out.append(vocab_entry)

    output = {
        "$schema": "../../schema/vocabulary.schema.json",
        "_provenance": {
            "generated": date.today().isoformat(),
            "pack_id": PACK_ID,
            "dialect": DIALECT,
            "sources": [parallel_id, mono_id],
            "pipeline_version": "1.0.0",
            "note": (
                "Auto-generated. All entries marked _auto=true require "
                "human review before promotion to curated vocabulary files."
            ),
        },
        "entries": entries_out,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    logger.info("Wrote %d vocabulary entries → %s", len(entries_out), out_path)
    return lemma_to_vocab_id


def write_sentences(
    parallel_df: pd.DataFrame,
    surface_to_lemma: Dict[str, str],
    store: Dict[str, LemmaEntry],
    lemma_to_vocab_id: Dict[str, str],
    parallel_id: str,
    sentence_fields_map: Optional[Dict[int, List[str]]] = None,
) -> Dict[int, str]:
    """
    Write parallel sentence entries to EXAMPLES_OUTPUT_DIR/parallel.json.

    Returns sentence_id_map: DataFrame index → sentence ID string.
    """
    EXAMPLES_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = EXAMPLES_OUTPUT_DIR / "parallel.json"

    sentences_out: List[Dict[str, Any]] = []
    sentence_id_map: Dict[int, str] = {}

    for df_idx, row in parallel_df.iterrows():
        sent_id = f"par-{int(df_idx):06d}"
        sentence_id_map[int(df_idx)] = sent_id

        qu_tokens: List[str] = row["qu_tokens"]

        # Infer proficiency level from vocabulary in this sentence
        levels_seen = []
        for t in qu_tokens:
            lemma = surface_to_lemma.get(t)
            if lemma and lemma in store:
                levels_seen.append(store[lemma].proficiency_level)
        level = max(set(levels_seen), key=levels_seen.count) if levels_seen else "B2"

        # Semantic fields from sentence_fields_map if available
        fields = sentence_fields_map.get(int(df_idx), []) if sentence_fields_map else []

        entry = _build_sentence_entry(
            sent_id=sent_id,
            qu_text=row["qu"],
            es_text=row["es"],
            qu_tokens=qu_tokens,
            surface_to_lemma=surface_to_lemma,
            lemma_to_vocab_id=lemma_to_vocab_id,
            source_id=parallel_id,
            proficiency_level=level,
            semantic_fields=fields,
        )
        sentences_out.append(entry)

    output = {
        "$schema": "../../schema/sentence.schema.json",
        "_provenance": {
            "generated": date.today().isoformat(),
            "pack_id": PACK_ID,
            "dialect": DIALECT,
            "source": parallel_id,
            "pipeline_version": "1.0.0",
        },
        "sentences": sentences_out,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    logger.info("Wrote %d sentences → %s", len(sentences_out), out_path)
    return sentence_id_map


def write_report(
    store: Dict[str, LemmaEntry],
    parallel_clean_stats: dict,
    mono_clean_stats: dict,
    parallel_id: str,
    mono_id: str,
) -> None:
    """Write a JSON run report to REPORT_DIR/run_report.json."""
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REPORT_DIR / "run_report.json"

    # Aggregate statistics
    freq_band_dist: Dict[str, int] = {}
    level_dist: Dict[str, int] = {}
    pos_dist: Dict[str, int] = {}
    field_dist: Dict[str, int] = {}

    for entry in store.values():
        freq_band_dist[entry.frequency_band] = freq_band_dist.get(entry.frequency_band, 0) + 1
        level_dist[entry.proficiency_level] = level_dist.get(entry.proficiency_level, 0) + 1
        pos_dist[entry.estimated_pos] = pos_dist.get(entry.estimated_pos, 0) + 1
        for f in entry.semantic_fields:
            field_dist[f] = field_dist.get(f, 0) + 1

    top50 = [
        {"lemma": e.lemma, "frequency": e.frequency, "band": e.frequency_band}
        for e in sorted(store.values(), key=lambda x: x.frequency, reverse=True)[:50]
    ]

    report = {
        "generated": date.today().isoformat(),
        "dialect": DIALECT,
        "sources": {"parallel": parallel_id, "monolingual": mono_id},
        "parallel_cleaning": parallel_clean_stats,
        "monolingual_cleaning": mono_clean_stats,
        "vocabulary": {
            "total_lemmas": len(store),
            "exported_lemmas": sum(
                1 for e in store.values() if e.frequency >= MIN_FREQUENCY_TO_EXPORT
            ),
            "total_surface_forms": sum(
                len(e.surface_forms) for e in store.values()
            ),
            "frequency_band_distribution": freq_band_dist,
            "proficiency_level_distribution": level_dist,
            "pos_distribution": pos_dist,
            "semantic_field_distribution": dict(
                sorted(field_dist.items(), key=lambda x: x[1], reverse=True)
            ),
            "top_50_lemmas": top50,
        },
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("Run report written → %s", out_path)
