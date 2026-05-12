"""
Dataset loaders for the Chronos Quechua ingestion pipeline.

Handles HuggingFace dataset fetching and normalises both sources into
flat DataFrames with consistent column names regardless of the upstream
schema.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import pandas as pd

from .config import COL_ES, COL_QU, COL_TEXT

logger = logging.getLogger(__name__)


@dataclass
class RawCorpora:
    parallel: pd.DataFrame    # columns: qu, es
    monolingual: pd.DataFrame  # columns: text
    parallel_id: str
    monolingual_id: str
    parallel_rows_raw: int
    monolingual_rows_raw: int


def _load_hf_dataset(dataset_id: str, split: str = "train") -> pd.DataFrame:
    """
    Load a HuggingFace dataset split into a DataFrame.
    Imports `datasets` lazily so import errors surface with a clear message.
    """
    try:
        from datasets import load_dataset  # noqa: PLC0415
    except ImportError as exc:
        raise SystemExit(
            "The 'datasets' package is required.\n"
            "Install it with:  pip install -r requirements.txt"
        ) from exc

    logger.info("Loading %s (split=%s) …", dataset_id, split)
    ds = load_dataset(dataset_id, split=split, trust_remote_code=False)
    df = ds.to_pandas()
    logger.info("  → %d rows, columns: %s", len(df), list(df.columns))
    return df


def _normalise_parallel(df: pd.DataFrame, dataset_id: str) -> pd.DataFrame:
    """
    Return a DataFrame with exactly two columns: 'qu' and 'es'.

    Handles three common upstream schemas:
      1. Separate 'qu' and 'es' (or 'quechua'/'spanish') columns.
      2. A nested 'translation' dict column: {'qu': ..., 'es': ...}.
      3. Generic 'source'/'target' columns (assume es→qu order).
    """
    cols = set(df.columns)

    # Schema 1 – already flat
    qu_col = next((c for c in cols if c.lower() in ("qu", "quechua")), None)
    es_col = next((c for c in cols if c.lower() in ("es", "spanish", "español")), None)

    if qu_col and es_col:
        return df[[qu_col, es_col]].rename(columns={qu_col: COL_QU, es_col: COL_ES})

    # Schema 2 – nested translation dict
    if "translation" in cols:
        sample = df["translation"].dropna().iloc[0]
        if isinstance(sample, dict):
            qu_key = next((k for k in sample if k.lower() in ("qu", "quechua")), None)
            es_key = next((k for k in sample if k.lower() in ("es", "spanish", "español")), None)
            if qu_key and es_key:
                df = df.copy()
                df[COL_QU] = df["translation"].map(lambda d: d.get(qu_key) if isinstance(d, dict) else None)
                df[COL_ES] = df["translation"].map(lambda d: d.get(es_key) if isinstance(d, dict) else None)
                return df[[COL_QU, COL_ES]]

    # Schema 3 – source/target
    if "source" in cols and "target" in cols:
        logger.warning(
            "%s: guessing source=es, target=qu — verify this assumption.", dataset_id
        )
        return df[["source", "target"]].rename(
            columns={"source": COL_ES, "target": COL_QU}
        )

    raise ValueError(
        f"Cannot normalise parallel dataset '{dataset_id}'. "
        f"Found columns: {sorted(cols)}. "
        "Expected 'qu'/'es', 'translation', or 'source'/'target'."
    )


def _normalise_monolingual(df: pd.DataFrame, dataset_id: str) -> pd.DataFrame:
    """Return a DataFrame with a single 'text' column."""
    cols = set(df.columns)

    text_col = next(
        (c for c in cols if c.lower() in ("text", "sentence", "content", "quechua")),
        None,
    )
    if text_col:
        return df[[text_col]].rename(columns={text_col: COL_TEXT})

    raise ValueError(
        f"Cannot normalise monolingual dataset '{dataset_id}'. "
        f"Found columns: {sorted(cols)}. Expected 'text' or 'sentence'."
    )


def load_corpora(
    parallel_id: str,
    monolingual_id: str,
    parallel_split: str = "train",
    monolingual_split: str = "train",
    max_parallel: Optional[int] = None,
    max_monolingual: Optional[int] = None,
) -> RawCorpora:
    """
    Load and normalise both source datasets.

    Args:
        parallel_id:        HuggingFace dataset ID for the parallel corpus.
        monolingual_id:     HuggingFace dataset ID for the monolingual corpus.
        parallel_split:     Dataset split name (default 'train').
        monolingual_split:  Dataset split name (default 'train').
        max_parallel:       Cap on parallel rows (useful for quick dev runs).
        max_monolingual:    Cap on monolingual rows.

    Returns:
        RawCorpora with both DataFrames and provenance metadata.
    """
    par_raw = _load_hf_dataset(parallel_id, split=parallel_split)
    mono_raw = _load_hf_dataset(monolingual_id, split=monolingual_split)

    n_par_raw = len(par_raw)
    n_mono_raw = len(mono_raw)

    par_df = _normalise_parallel(par_raw, parallel_id)
    mono_df = _normalise_monolingual(mono_raw, monolingual_id)

    if max_parallel is not None:
        par_df = par_df.iloc[:max_parallel]
        logger.info("Parallel corpus capped at %d rows (dev mode).", max_parallel)
    if max_monolingual is not None:
        mono_df = mono_df.iloc[:max_monolingual]
        logger.info("Monolingual corpus capped at %d rows (dev mode).", max_monolingual)

    logger.info(
        "Loaded — parallel: %d rows | monolingual: %d rows",
        len(par_df), len(mono_df),
    )
    return RawCorpora(
        parallel=par_df,
        monolingual=mono_df,
        parallel_id=parallel_id,
        monolingual_id=monolingual_id,
        parallel_rows_raw=n_par_raw,
        monolingual_rows_raw=n_mono_raw,
    )
