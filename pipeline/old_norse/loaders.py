"""
Data loaders for the Old Norse ingestion pipeline.

Data strategy
-------------
Old Norse has limited parallel corpora on HuggingFace compared to modern
languages.  This module uses two data sources:

1. **Monolingual corpus** — CLTK's Heimskringla corpus (Snorri Sturluson's
   prose histories), downloaded via the CLTK FetchCorpus API on first run
   and cached to ~/cltk_data/.

2. **Parallel corpus** (ON ↔ EN) — Zoëga's Concise Dictionary of Old Icelandic
   (public domain, 1910), also via CLTK.  Each dictionary entry is treated as
   a minimal "sentence pair" (ON headword phrase → English definition) so that
   TF-IDF gloss extraction and semantic field assignment can operate over
   English content words, exactly as the Quechua pipeline uses Spanish.

Both DataFrames are normalised to match the column conventions expected by the
shared pipeline modules:

    parallel DataFrame  → columns: qu (ON text), es (EN text)
    monolingual DataFrame → columns: text (ON text)

These column names are internal implementation details and do not appear in
any output JSON.

Requirements
------------
    pip install cltk
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd

from .config import COL_ES, COL_QU, COL_TEXT, CLTK_DICT_CORPUS, CLTK_MONOLINGUAL_CORPUS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared CLTK helpers
# ---------------------------------------------------------------------------

def _require_cltk() -> None:
    try:
        import cltk  # noqa: F401
    except ImportError as exc:
        raise SystemExit(
            "The 'cltk' package is required for the Old Norse pipeline.\n"
            "Install it with:  pip install cltk"
        ) from exc


def _fetch_cltk_corpus(corpus_name: str, language: str = "non") -> Path:
    """
    Ensure a CLTK corpus is downloaded; return its local root directory.
    Downloads are cached to ~/cltk_data/ and skipped on subsequent runs.

    CLTK uses the ISO 639-3 code "non" for Old Norse (not "old_norse").
    """
    from cltk.data.fetch import FetchCorpus  # noqa: PLC0415

    cltk_root = Path.home() / "cltk_data" / language
    # CLTK stores text corpora under text/ and dict corpora under dictionary/
    for sub in ("text", "dictionary", "dict", ""):
        candidate = cltk_root / sub / corpus_name
        if candidate.exists():
            logger.info("Using cached CLTK corpus: %s", candidate)
            return candidate

    logger.info("Downloading CLTK corpus '%s' …", corpus_name)
    fetcher = FetchCorpus(language=language)
    fetcher.import_corpus(corpus_name)

    # Re-probe after download
    for sub in ("text", "dictionary", "dict", ""):
        candidate = cltk_root / sub / corpus_name
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        f"CLTK corpus '{corpus_name}' downloaded but directory not found "
        f"under {cltk_root}.  Check cltk_data layout."
    )


# ---------------------------------------------------------------------------
# Monolingual corpus loader
# ---------------------------------------------------------------------------

def _split_into_sentences(text: str) -> list[str]:
    """
    Crude sentence splitter for Old Norse prose.

    Splits on sentence-final punctuation followed by whitespace and an
    uppercase letter, or on paragraph boundaries.  Old Norse texts often
    use periods inconsistently, so paragraph splitting is the primary signal.
    """
    # Normalise line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Split on double newlines (paragraph breaks)
    paragraphs = re.split(r"\n{2,}", text)

    sentences: list[str] = []
    for para in paragraphs:
        para = para.strip()
        if not para or len(para) < 20:
            continue
        # Further split on sentence-ending punctuation inside paragraphs
        parts = re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÝÆØÞÐ])", para)
        for part in parts:
            part = part.strip()
            if len(part) >= 15:
                sentences.append(part)
    return sentences


def _load_monolingual_cltk(max_rows: Optional[int] = None) -> pd.DataFrame:
    """Load Old Norse prose text from the CLTK Heimskringla corpus."""
    corpus_dir = _fetch_cltk_corpus(CLTK_MONOLINGUAL_CORPUS)
    logger.info("Reading monolingual files from %s …", corpus_dir)

    all_sentences: list[str] = []
    txt_files = sorted(corpus_dir.rglob("*.txt")) + sorted(corpus_dir.rglob("*.TXT"))

    for txt_path in txt_files:
        try:
            text = txt_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        sentences = _split_into_sentences(text)
        all_sentences.extend(sentences)
        if max_rows is not None and len(all_sentences) >= max_rows:
            all_sentences = all_sentences[:max_rows]
            break

    logger.info("Loaded %d raw sentences from monolingual corpus.", len(all_sentences))
    return pd.DataFrame({COL_TEXT: all_sentences})


# ---------------------------------------------------------------------------
# Parallel corpus loader (Zoëga dictionary)
# ---------------------------------------------------------------------------

_ZOEGA_ENTRY_RE = re.compile(
    r"^([A-Za-zÁáÉéÍíÓóÚúÝýÆæØøÞþÐðǪǫ][^.]+?)\s*,\s*(.+)$"
)


def _parse_zoega_text(text: str) -> list[tuple[str, str]]:
    """
    Parse the plain-text Zoëga dictionary into (Old Norse phrase, English def) pairs.

    The Zoëga text has entries of the form:
        headword [-inflection], definition; further senses.

    We extract the headword and the first definition sentence.
    """
    pairs: list[tuple[str, str]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = _ZOEGA_ENTRY_RE.match(line)
        if m:
            on_phrase = m.group(1).strip().rstrip(",;.-")
            en_def = m.group(2).strip().rstrip(";.")
            # Keep only entries with meaningful content
            if len(on_phrase) >= 2 and len(en_def.split()) >= 2:
                pairs.append((on_phrase, en_def))
    return pairs


def _load_parallel_cltk(max_rows: Optional[int] = None) -> pd.DataFrame:
    """
    Load ON ↔ EN sentence pairs from the CLTK Zoëga dictionary.

    Falls back gracefully to an empty DataFrame with the right schema if the
    dictionary corpus is unavailable, allowing the pipeline to continue with
    monolingual-only vocabulary (no TF-IDF glosses).
    """
    try:
        corpus_dir = _fetch_cltk_corpus(CLTK_DICT_CORPUS)
    except Exception as exc:
        logger.warning(
            "Zoëga dictionary corpus unavailable (%s).  "
            "Falling back to starter vocabulary for TF-IDF glosses.",
            exc,
        )
        from .starter_vocab import STARTER_VOCAB  # noqa: PLC0415
        pairs_fb = [
            (lemma, info["en"])
            for lemma, info in STARTER_VOCAB.items()
            if "en" in info
        ]
        if pairs_fb:
            on_texts_fb, en_texts_fb = zip(*pairs_fb)
            return pd.DataFrame({COL_QU: list(on_texts_fb), COL_ES: list(en_texts_fb)})
        return pd.DataFrame(columns=[COL_QU, COL_ES])

    logger.info("Reading dictionary from %s …", corpus_dir)
    pairs: list[tuple[str, str]] = []

    candidate_files = (
        sorted(corpus_dir.rglob("*.yaml"))
        + sorted(corpus_dir.rglob("*.yml"))
        + sorted(corpus_dir.rglob("*.json"))
        + sorted(corpus_dir.rglob("*.txt"))
    )

    for txt_path in candidate_files:
        try:
            text = txt_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        # Dispatch by extension; fall back through parsers if the primary returns nothing
        ext = txt_path.suffix.lower()
        if ext in (".yaml", ".yml"):
            new_pairs = _parse_zoega_yaml(text)
        else:
            new_pairs = _parse_zoega_json(text)
            if not new_pairs:
                new_pairs = _parse_zoega_text(text)
        pairs.extend(new_pairs)

        if max_rows is not None and len(pairs) >= max_rows:
            pairs = pairs[:max_rows]
            break

    if not pairs:
        logger.warning(
            "No dictionary entries parsed.  Check CLTK corpus format.  "
            "Pipeline continuing without TF-IDF glosses."
        )
        return pd.DataFrame(columns=[COL_QU, COL_ES])

    logger.info("Loaded %d ON ↔ EN dictionary pairs.", len(pairs))
    on_texts, en_texts = zip(*pairs)
    return pd.DataFrame({COL_QU: list(on_texts), COL_ES: list(en_texts)})


def _parse_zoega_yaml(text: str) -> list[tuple[str, str]]:
    """
    Parse the CLTK Zoëga YAML dictionary.

    The file is a flat mapping of Old Norse headword → English definition string:
        "dagr": "m. day."
        "skip": "n. ship."

    Multi-line values (block scalars) are also handled by the YAML loader.
    Entries are shuffled so that dev-mode caps sample across the full alphabet
    rather than only the alphabetically-first entries.
    """
    import random  # noqa: PLC0415

    try:
        import yaml  # noqa: PLC0415
    except ImportError:
        return _parse_zoega_yaml_fallback(text)

    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError:
        return []

    if not isinstance(data, dict):
        return []

    pairs: list[tuple[str, str]] = []
    for hw, definition in data.items():
        hw = str(hw).strip().lstrip("-").strip()
        if not hw:
            continue
        if isinstance(definition, list):
            definition = "; ".join(str(d) for d in definition)
        definition = str(definition).strip()
        definition = " ".join(definition.split())  # collapse internal newlines
        if len(hw) >= 2 and len(definition.split()) >= 2:
            pairs.append((hw, definition))

    random.shuffle(pairs)
    return pairs


def _parse_zoega_yaml_fallback(text: str) -> list[tuple[str, str]]:
    """
    Minimal YAML-dict parser used when PyYAML is unavailable.
    Handles only simple single-line entries: "word": "definition"
    """
    pairs: list[tuple[str, str]] = []
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r'^"(.+?)"\s*:\s*"(.+)"', line)
        if m:
            hw = m.group(1).lstrip("-").strip()
            definition = m.group(2).strip()
            if len(hw) >= 2 and len(definition.split()) >= 2:
                pairs.append((hw, definition))
    return pairs


def _parse_zoega_json(text: str) -> list[tuple[str, str]]:
    """
    Parse CLTK's JSON-format Zoëga dictionary.

    Expected structure (list of entry objects):
        [{"headword": "...", "definitions": ["...", ...]}, ...]
    or
        [{"word": "...", "definition": "..."}, ...]
    """
    import json  # noqa: PLC0415

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []

    if not isinstance(data, list):
        data = list(data.values()) if isinstance(data, dict) else []

    pairs: list[tuple[str, str]] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        # Support multiple CLTK dictionary schema variants
        hw = entry.get("headword") or entry.get("word") or ""
        defs = entry.get("definitions") or entry.get("definition") or ""
        if isinstance(defs, list):
            defs = "; ".join(d for d in defs if isinstance(d, str))
        hw = str(hw).strip()
        defs = str(defs).strip()
        if hw and defs and len(hw) >= 2 and len(defs.split()) >= 2:
            pairs.append((hw, defs))
    return pairs


# ---------------------------------------------------------------------------
# Public API — RawCorpora dataclass + load_corpora()
# ---------------------------------------------------------------------------

@dataclass
class RawCorpora:
    parallel: pd.DataFrame    # columns: qu (ON), es (EN)
    monolingual: pd.DataFrame  # columns: text (ON)
    parallel_id: str
    monolingual_id: str
    parallel_rows_raw: int
    monolingual_rows_raw: int


def load_corpora(
    max_parallel: Optional[int] = None,
    max_monolingual: Optional[int] = None,
) -> RawCorpora:
    """
    Load and return both Old Norse corpora.

    Downloads CLTK data on first run; subsequent runs use the local cache.

    Args:
        max_parallel:    Cap on parallel (dictionary) rows for dev mode.
        max_monolingual: Cap on monolingual rows for dev mode.

    Returns:
        RawCorpora with both DataFrames and provenance metadata.
    """
    _require_cltk()

    logger.info("Loading Old Norse monolingual corpus (Heimskringla) …")
    mono_df = _load_monolingual_cltk(max_rows=max_monolingual)

    logger.info("Loading Old Norse parallel corpus (Zoëga dictionary) …")
    par_df = _load_parallel_cltk(max_rows=max_parallel)

    logger.info(
        "Loaded — parallel: %d rows | monolingual: %d rows",
        len(par_df), len(mono_df),
    )

    return RawCorpora(
        parallel=par_df,
        monolingual=mono_df,
        parallel_id=CLTK_DICT_CORPUS,
        monolingual_id=CLTK_MONOLINGUAL_CORPUS,
        parallel_rows_raw=len(par_df),
        monolingual_rows_raw=len(mono_df),
    )
