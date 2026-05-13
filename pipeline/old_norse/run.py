"""
Chronos Old Norse ingestion pipeline — main entry point.

Usage
-----
# Full run (downloads CLTK corpora on first run; cached afterwards)
python -m pipeline.old_norse.run

# Development run with capped dataset sizes
python -m pipeline.old_norse.run --dev

# Custom caps
python -m pipeline.old_norse.run --max-parallel 5000 --max-mono 10000

Requirements
------------
    pip install cltk
    # CLTK will download corpora (~50 MB) on first run to ~/cltk_data/

Pipeline stages
---------------
1. LOAD       — fetch Heimskringla (monolingual) + Zoëga dict (parallel) via CLTK
2. CLEAN      — filter and tokenise sentences; preserve þ ð æ ø ǫ special chars
3. VOCAB      — lemmatise via Old Norse suffix stripping; frequency analysis
4. SEMANTIC   — assign semantic fields using English definition keywords
5. DIFFICULTY — estimate CEFR levels (frequency + Old Norse phonological features)
6. LINK       — build sentence ↔ vocabulary index for example_ids
7. WRITE      — serialise to Chronos JSON; adds Elder Futhark runic field per entry
8. REPORT     — write pipeline/reports/old_norse_run_report.json

Output files
------------
    old_norse/vocabulary/extracted/vocabulary.json
    old_norse/examples/parallel.json
    pipeline/reports/old_norse_run_report.json
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from typing import Optional

from .cognates import annotate_cognates
from .config import CLTK_DICT_CORPUS, CLTK_MONOLINGUAL_CORPUS
from .difficulty import estimate_difficulty_all
from .loaders import load_corpora
from .morphology import annotate_morphology
from .preprocessing import clean_monolingual, clean_parallel
from .schema_writer import write_report, write_sentences, write_vocabulary
from .semantics import assign_semantic_fields
from .starter_vocab import STARTER_VOCAB
from .vocabulary import (
    build_sentence_lemma_index,
    build_vocabulary,
    estimate_lemma,
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
logger = logging.getLogger("pipeline.old_norse.run")


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def run(
    max_parallel: Optional[int] = None,
    max_monolingual: Optional[int] = None,
) -> None:
    t0 = time.perf_counter()
    logger.info("=" * 60)
    logger.info("Chronos Old Norse Ingestion Pipeline  (West Norse)")
    logger.info("=" * 60)

    # ------------------------------------------------------------------
    # Stage 1: LOAD
    # ------------------------------------------------------------------
    logger.info("[1/8] Loading corpora …")
    corpora = load_corpora(
        max_parallel=max_parallel,
        max_monolingual=max_monolingual,
    )

    # ------------------------------------------------------------------
    # Stage 2: CLEAN
    # ------------------------------------------------------------------
    logger.info("[2/8] Cleaning and tokenising …")
    par_clean, par_stats = clean_parallel(corpora.parallel)
    mono_clean, mono_stats = clean_monolingual(corpora.monolingual)

    if mono_clean.empty:
        logger.error("No monolingual sentences survived cleaning. Aborting.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Stage 3: VOCABULARY
    # ------------------------------------------------------------------
    logger.info("[3/8] Building vocabulary …")
    store, surface_to_lemma = build_vocabulary(
        parallel_df=par_clean,
        mono_df=mono_clean,
        parallel_source_id=CLTK_DICT_CORPUS,
        mono_source_id=CLTK_MONOLINGUAL_CORPUS,
    )

    logger.info("[3/8] Extracting glosses (TF-IDF) …")
    extract_glosses(
        parallel_df=par_clean,
        store=store,
        surface_to_lemma=surface_to_lemma,
    )

    # Apply STARTER_VOCAB English translations as authoritative glosses.
    # For the 197 curated words, the starter_vocab "en" field is cleaner than
    # TF-IDF output from Zoëga (which mixes grammatical abbreviations and ON
    # inflected forms into the definition).  We override TF-IDF when a starter
    # match exists, and fall back to starter_vocab for entries with no TF-IDF
    # coverage at all.
    #
    # Matching: STARTER_VOCAB keys use dictionary forms (e.g. "dagr") while the
    # vocabulary store uses stripped lemmas (e.g. "dag"), so we apply the same
    # suffix stripper to STARTER_VOCAB keys to build the lookup.
    _sv_by_lemma: dict = {}
    for sv_key, sv_info in STARTER_VOCAB.items():
        sv_lemma, _, _ = estimate_lemma(sv_key)
        if sv_info.get("en"):
            _sv_by_lemma.setdefault(sv_lemma, sv_info)
            _sv_by_lemma.setdefault(sv_key, sv_info)   # also try the raw key

    _override_hits = _fallback_hits = 0
    for lemma, entry in store.items():
        sv = _sv_by_lemma.get(lemma)
        if sv and sv.get("en"):
            clean_gloss = [w.strip() for w in sv["en"].split(",")][:4]
            if entry.gloss_candidates:
                # Prepend clean starter gloss, then append unique TF-IDF extras
                seen_g: set = set(clean_gloss)
                extras = [g for g in entry.gloss_candidates[:2] if g not in seen_g]
                entry.gloss_candidates = clean_gloss + extras
                _override_hits += 1
            else:
                entry.gloss_candidates = clean_gloss
                _fallback_hits += 1

    logger.info(
        "Starter-vocab gloss: overrode %d TF-IDF entries, filled %d fallbacks.",
        _override_hits, _fallback_hits,
    )

    logger.info("[3/8] Annotating morphology (verb class + grammatical gender) …")
    annotate_morphology(store, STARTER_VOCAB)

    logger.info("[3/8] Annotating English cognates …")
    annotate_cognates(store)

    # ------------------------------------------------------------------
    # Stage 4: SEMANTIC FIELDS
    # ------------------------------------------------------------------
    logger.info("[4/8] Assigning semantic fields …")
    assign_semantic_fields(
        parallel_df=par_clean,
        store=store,
        surface_to_lemma=surface_to_lemma,
    )

    # ------------------------------------------------------------------
    # Stage 5: DIFFICULTY
    # ------------------------------------------------------------------
    logger.info("[5/8] Estimating difficulty levels …")
    estimate_difficulty_all(store)

    # ------------------------------------------------------------------
    # Stage 6: LINK sentences → vocabulary entries
    # ------------------------------------------------------------------
    logger.info("[6/8] Linking sentences to vocabulary entries …")
    lemma_sent_index = build_sentence_lemma_index(par_clean, surface_to_lemma)
    for lemma, sent_indices in lemma_sent_index.items():
        if lemma in store:
            store[lemma].example_ids = sent_indices[:5]

    # ------------------------------------------------------------------
    # Stage 7: WRITE
    # ------------------------------------------------------------------
    logger.info("[7/8] Writing output files …")

    sentence_id_map = write_sentences(
        parallel_df=par_clean,
        surface_to_lemma=surface_to_lemma,
        store=store,
        lemma_to_vocab_id={},
        parallel_id=CLTK_DICT_CORPUS,
    )

    lemma_to_vocab_id = write_vocabulary(
        store=store,
        sentence_id_map=sentence_id_map,
        parallel_id=CLTK_DICT_CORPUS,
        mono_id=CLTK_MONOLINGUAL_CORPUS,
    )

    # Re-write sentences now that we have vocab IDs
    write_sentences(
        parallel_df=par_clean,
        surface_to_lemma=surface_to_lemma,
        store=store,
        lemma_to_vocab_id=lemma_to_vocab_id,
        parallel_id=CLTK_DICT_CORPUS,
    )

    # ------------------------------------------------------------------
    # Stage 8: REPORT
    # ------------------------------------------------------------------
    logger.info("[8/8] Writing run report …")
    write_report(
        store=store,
        parallel_clean_stats=par_stats,
        mono_clean_stats=mono_stats,
        parallel_id=CLTK_DICT_CORPUS,
        mono_id=CLTK_MONOLINGUAL_CORPUS,
    )

    elapsed = time.perf_counter() - t0
    logger.info("=" * 60)
    logger.info("Pipeline complete in %.1fs.", elapsed)
    logger.info("Vocabulary → old_norse/vocabulary/extracted/vocabulary.json")
    logger.info("Sentences  → old_norse/examples/parallel.json")
    logger.info("Report     → pipeline/reports/old_norse_run_report.json")
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Chronos Old Norse ingestion pipeline",
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
        help="Maximum rows from the parallel corpus (Zoëga dictionary).",
    )
    p.add_argument(
        "--max-mono",
        type=int,
        default=None,
        metavar="N",
        help="Maximum rows from the monolingual corpus (Heimskringla).",
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
