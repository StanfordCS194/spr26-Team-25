"""
Chronos Quechua ingestion pipeline — main entry point.

Usage
-----
# Full run (downloads datasets on first run; cached afterwards)
python -m pipeline.run

# Development run with capped dataset sizes
python -m pipeline.run --dev

# Only rebuild vocabulary (skip if parallel.json already exists)
python -m pipeline.run --vocab-only

# Custom dataset caps
python -m pipeline.run --max-parallel 10000 --max-mono 20000

Pipeline stages
---------------
1. LOAD     — fetch both corpora from HuggingFace
2. CLEAN    — filter and tokenise sentences
3. VOCAB    — lemmatise, frequency analysis, gloss extraction
4. SEMANTIC — assign semantic fields
5. DIFFICULTY — estimate CEFR levels
6. WRITE    — serialise to Chronos JSON schema files
7. REPORT   — write run_report.json
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from typing import Optional

from .config import (
    MONOLINGUAL_DATASET_ID,
    PARALLEL_DATASET_ID,
)
from .difficulty import estimate_difficulty_all
from .loaders import load_corpora
from .preprocessing import clean_monolingual, clean_parallel
from .schema_writer import write_report, write_sentences, write_vocabulary
from .semantics import assign_semantic_fields
from .vocabulary import (
    build_sentence_lemma_index,
    build_vocabulary,
    extract_glosses,
)

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
    level=logging.INFO,
    stream=sys.stdout,
)
logger = logging.getLogger("pipeline.run")


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def run(
    max_parallel: Optional[int] = None,
    max_monolingual: Optional[int] = None,
) -> None:
    t0 = time.perf_counter()
    logger.info("=" * 60)
    logger.info("Chronos Quechua Ingestion Pipeline  (Ayacucho-Chanka)")
    logger.info("=" * 60)

    # ------------------------------------------------------------------
    # Stage 1: LOAD
    # ------------------------------------------------------------------
    logger.info("[1/7] Loading corpora …")
    corpora = load_corpora(
        parallel_id=PARALLEL_DATASET_ID,
        monolingual_id=MONOLINGUAL_DATASET_ID,
        max_parallel=max_parallel,
        max_monolingual=max_monolingual,
    )

    # ------------------------------------------------------------------
    # Stage 2: CLEAN
    # ------------------------------------------------------------------
    logger.info("[2/7] Cleaning and tokenising …")
    par_clean, par_stats = clean_parallel(corpora.parallel)
    mono_clean, mono_stats = clean_monolingual(corpora.monolingual)

    if par_clean.empty:
        logger.error("No parallel sentences survived cleaning. Aborting.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Stage 3: VOCABULARY
    # ------------------------------------------------------------------
    logger.info("[3/7] Building vocabulary …")
    store, surface_to_lemma = build_vocabulary(
        parallel_df=par_clean,
        mono_df=mono_clean,
        parallel_source_id=PARALLEL_DATASET_ID,
        mono_source_id=MONOLINGUAL_DATASET_ID,
    )

    logger.info("[3/7] Extracting glosses (TF-IDF) …")
    extract_glosses(
        parallel_df=par_clean,
        store=store,
        surface_to_lemma=surface_to_lemma,
    )

    # ------------------------------------------------------------------
    # Stage 4: SEMANTIC FIELDS
    # ------------------------------------------------------------------
    logger.info("[4/7] Assigning semantic fields …")
    assign_semantic_fields(
        parallel_df=par_clean,
        store=store,
        surface_to_lemma=surface_to_lemma,
    )

    # ------------------------------------------------------------------
    # Stage 5: DIFFICULTY
    # ------------------------------------------------------------------
    logger.info("[5/7] Estimating difficulty levels …")
    estimate_difficulty_all(store)

    # ------------------------------------------------------------------
    # Stage 6: Build sentence → lemma index for example_ids
    # ------------------------------------------------------------------
    logger.info("[6/7] Linking sentences to vocabulary entries …")
    lemma_sent_index = build_sentence_lemma_index(par_clean, surface_to_lemma)
    for lemma, sent_indices in lemma_sent_index.items():
        if lemma in store:
            store[lemma].example_ids = sent_indices[:5]  # cap at 5

    # ------------------------------------------------------------------
    # Stage 7: WRITE
    # ------------------------------------------------------------------
    logger.info("[7/7] Writing output files …")

    # Write sentences first so we have the sentence_id_map
    sentence_id_map = write_sentences(
        parallel_df=par_clean,
        surface_to_lemma=surface_to_lemma,
        store=store,
        lemma_to_vocab_id={},   # placeholder; will be populated after vocab write
        parallel_id=PARALLEL_DATASET_ID,
    )

    # Write vocabulary (needs sentence_id_map for example_ids)
    lemma_to_vocab_id = write_vocabulary(
        store=store,
        sentence_id_map=sentence_id_map,
        parallel_id=PARALLEL_DATASET_ID,
        mono_id=MONOLINGUAL_DATASET_ID,
    )

    # Re-write sentences now that we have vocab IDs
    write_sentences(
        parallel_df=par_clean,
        surface_to_lemma=surface_to_lemma,
        store=store,
        lemma_to_vocab_id=lemma_to_vocab_id,
        parallel_id=PARALLEL_DATASET_ID,
    )

    write_report(
        store=store,
        parallel_clean_stats=par_stats,
        mono_clean_stats=mono_stats,
        parallel_id=PARALLEL_DATASET_ID,
        mono_id=MONOLINGUAL_DATASET_ID,
    )

    elapsed = time.perf_counter() - t0
    logger.info("=" * 60)
    logger.info("Pipeline complete in %.1fs.", elapsed)
    logger.info("Vocabulary → quechua/vocabulary/extracted/vocabulary.json")
    logger.info("Sentences  → quechua/examples/parallel.json")
    logger.info("Report     → pipeline/reports/run_report.json")
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Chronos Quechua ingestion pipeline",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument(
        "--dev",
        action="store_true",
        help="Development mode: cap parallel at 5,000 and mono at 10,000 rows.",
    )
    p.add_argument(
        "--max-parallel",
        type=int,
        default=None,
        metavar="N",
        help="Maximum rows to use from the parallel corpus.",
    )
    p.add_argument(
        "--max-mono",
        type=int,
        default=None,
        metavar="N",
        help="Maximum rows to use from the monolingual corpus.",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    max_par = args.max_parallel
    max_mono = args.max_mono

    if args.dev:
        max_par = max_par or 5_000
        max_mono = max_mono or 10_000
        logger.info("Dev mode: parallel=%d, mono=%d", max_par, max_mono)

    run(max_parallel=max_par, max_monolingual=max_mono)
