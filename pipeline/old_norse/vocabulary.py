"""
Vocabulary extraction, lemmatisation, and frequency analysis — Old Norse.

Lemmatisation strategy
----------------------
Old Norse is a heavily inflected Germanic language with four grammatical
cases, three genders, and strong/weak declension paradigms.  This module
uses the same heuristic iterative suffix stripper as the Quechua pipeline,
configured via the Old Norse suffix tables in config.py.

The stripper peels one suffix layer at a time (outermost first) using the
ordered suffix tables.  It stops when no suffix matches or the remaining
root would be shorter than MIN_LEMMA_LENGTH.

Gloss extraction
----------------
For each lemma, candidate English glosses are ranked by a TF-IDF-style
score over the parallel corpus (Zoëga dictionary entries treated as
sentence pairs).  English words that appear across many different ON lemma
contexts get low scores; words distinctive to a particular lemma rank high.
"""
from __future__ import annotations

import logging
import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
# Optional and Dict already imported above; repeated here for clarity in type hints

import pandas as pd
from tqdm import tqdm

from .config import (
    DISCOURSE_SUFFIXES,
    FREQUENCY_BANDS,
    MIN_LEMMA_LENGTH,
    MAX_STRIP_DEPTH,
    NOUN_SUFFIXES,
    SUFFIX_LAYERS,
    VERB_AGREEMENT_SUFFIXES,
    VERB_DERIV_SUFFIXES,
    VERB_TENSE_SUFFIXES,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lemma entry dataclass
# ---------------------------------------------------------------------------

@dataclass
class LemmaEntry:
    lemma: str
    surface_forms: Counter = field(default_factory=Counter)
    frequency: int = 0
    frequency_rank: int = 0
    frequency_band: str = "rare"
    morpheme_depth: int = 0
    stripped_glosses: List[str] = field(default_factory=list)
    estimated_pos: str = "other"

    # Filled by semantics module
    semantic_fields: List[str] = field(default_factory=list)
    gloss_candidates: List[str] = field(default_factory=list)
    example_ids: List[str] = field(default_factory=list)

    # Filled by difficulty module
    proficiency_level: str = "B2"
    difficulty_score: float = 4.5

    # Sources this lemma was observed in
    sources: Set[str] = field(default_factory=set)

    # Filled by morphology module
    verb_class: Optional[str] = None          # e.g. "strong.I", "weak.2", "preterite-present"
    grammatical_gender: Optional[str] = None  # "m", "f", "n"
    cognates: Dict[str, str] = field(default_factory=dict)  # {"English": "ship", "German": "Schiff"}


# ---------------------------------------------------------------------------
# Suffix stripping
# ---------------------------------------------------------------------------

def _try_strip_one_layer(
    form: str,
) -> Optional[Tuple[str, str, str]]:
    """
    Attempt to strip exactly one suffix layer from `form`.

    Returns (root, gloss, pos_hint) or None if no suffix matched.
    Uses global longest-match across all suffix layers.
    """
    best_candidate: Optional[str] = None
    best_gloss: str = ""
    best_pos: str = "other"
    best_len: int = 0

    for layer in SUFFIX_LAYERS:
        for suffix, gloss, pos in layer:
            if form.endswith(suffix) and len(suffix) > best_len:
                candidate = form[: -len(suffix)]
                if len(candidate) >= MIN_LEMMA_LENGTH:
                    best_candidate = candidate
                    best_gloss = gloss
                    best_pos = pos
                    best_len = len(suffix)

    if best_candidate is not None:
        return best_candidate, best_gloss, best_pos
    return None


def estimate_lemma(surface_form: str) -> Tuple[str, int, str]:
    """
    Iteratively strip suffixes to find a candidate lemma.

    Returns:
        (lemma, morpheme_depth, estimated_pos)
    """
    current = surface_form
    depth = 0
    pos = "other"

    for _ in range(MAX_STRIP_DEPTH):
        result = _try_strip_one_layer(current)
        if result is None:
            break
        current, _, hint = result
        depth += 1
        if hint != "any":
            pos = hint

    return current, depth, pos


# ---------------------------------------------------------------------------
# Vocabulary store builder
# ---------------------------------------------------------------------------

def _assign_frequency_band(rank: int) -> str:
    for band, (lo, hi) in FREQUENCY_BANDS.items():
        if lo <= rank <= hi:
            return band
    return "rare"


def build_vocabulary(
    parallel_df: pd.DataFrame,
    mono_df: pd.DataFrame,
    parallel_source_id: str,
    mono_source_id: str,
) -> Tuple[Dict[str, LemmaEntry], Dict[str, str]]:
    """
    Build a lemma → LemmaEntry mapping from both corpora.

    Returns the vocabulary store dict and a surface_form → lemma mapping.
    """
    surface_counter: Counter = Counter()

    if not parallel_df.empty and "qu_tokens" in parallel_df.columns:
        logger.info("Counting tokens from parallel corpus …")
        for tokens in tqdm(parallel_df["qu_tokens"], desc="Parallel tokens"):
            surface_counter.update(tokens)

    logger.info("Counting tokens from monolingual corpus …")
    for tokens in tqdm(mono_df["tokens"], desc="Mono tokens"):
        surface_counter.update(tokens)

    logger.info("Unique surface forms: %d", len(surface_counter))

    store: Dict[str, LemmaEntry] = {}
    surface_to_lemma: Dict[str, str] = {}

    logger.info("Lemmatising surface forms …")
    for surface_form, freq in tqdm(
        surface_counter.most_common(), desc="Lemmatising"
    ):
        lemma, depth, pos = estimate_lemma(surface_form)
        surface_to_lemma[surface_form] = lemma

        if lemma not in store:
            store[lemma] = LemmaEntry(
                lemma=lemma,
                morpheme_depth=depth,
                estimated_pos=pos,
            )

        entry = store[lemma]
        entry.surface_forms[surface_form] += freq
        entry.frequency += freq

        if depth < entry.morpheme_depth:
            entry.morpheme_depth = depth
            if pos != "other":
                entry.estimated_pos = pos

    ranked = sorted(store.values(), key=lambda e: e.frequency, reverse=True)
    for rank, entry in enumerate(ranked, start=1):
        entry.frequency_rank = rank
        entry.frequency_band = _assign_frequency_band(rank)

    for entry in store.values():
        for sf in entry.surface_forms:
            if sf in surface_counter:
                entry.sources.add(parallel_source_id)
                entry.sources.add(mono_source_id)

    logger.info(
        "Vocabulary store: %d unique lemmas  (top-5: %s)",
        len(store),
        [e.lemma for e in ranked[:5]],
    )
    return store, surface_to_lemma


# ---------------------------------------------------------------------------
# TF-IDF gloss extraction from parallel corpus
# ---------------------------------------------------------------------------

_EN_STOPWORDS = frozenset(
    "the a an of in to and for is are was were be been being"
    " have has had do does did will would could should may might"
    " it its this that these those he she we they at by with"
    " from or but not no nor so yet both either"
    # Zoëga grammatical abbreviations that leak into definitions
    " m f n v adv pron prep conj interj gen dat acc nom voc"
    " sg pl du str wk comp superl esp also only used poet"
    " see also cf freq rare late usu".split()
)

# Old Norse special characters — tokens containing these are ON inflected forms,
# not English glosses, and should be excluded from TF-IDF gloss extraction.
_ON_SPECIAL_CHARS = frozenset("áéíóúýæøþðǫǿÁÉÍÓÚÝÆØÞÐǪ")


def extract_glosses(
    parallel_df: pd.DataFrame,
    store: Dict[str, LemmaEntry],
    surface_to_lemma: Dict[str, str],
    top_k: int = 4,
) -> None:
    """
    Populate `gloss_candidates` on each LemmaEntry using TF-IDF over the
    English (dictionary definition) side of the parallel corpus.

    Modifies `store` in place.  Skips gracefully if parallel_df is empty.
    """
    if parallel_df.empty or "qu_tokens" not in parallel_df.columns:
        logger.warning("Parallel corpus empty or missing qu_tokens — skipping gloss extraction.")
        return

    logger.info("Extracting glosses from parallel corpus (TF-IDF) …")

    lemma_en_tokens: Dict[str, List[List[str]]] = defaultdict(list)

    for _, row in tqdm(
        parallel_df.iterrows(), total=len(parallel_df), desc="Indexing glosses"
    ):
        qu_tokens: List[str] = row["qu_tokens"]
        es_tokens: List[str] = row["es_tokens"]

        en_content = [
            t for t in es_tokens
            if t not in _EN_STOPWORDS
            and len(t) > 2
            and not any(c in _ON_SPECIAL_CHARS for c in t)  # drop ON-script tokens
        ]
        if not en_content:
            continue

        seen_lemmas: Set[str] = set()
        for qt in qu_tokens:
            lemma = surface_to_lemma.get(qt)
            if lemma and lemma in store:
                seen_lemmas.add(lemma)

        for lemma in seen_lemmas:
            lemma_en_tokens[lemma].append(en_content)

    word_lemma_sets: Dict[str, Set[str]] = defaultdict(set)
    for lemma, sentence_en_lists in lemma_en_tokens.items():
        for en_list in sentence_en_lists:
            for word in en_list:
                word_lemma_sets[word].add(lemma)

    n_lemmas = len(lemma_en_tokens)
    idf: Dict[str, float] = {
        word: math.log((n_lemmas + 1) / (len(lemma_set) + 1)) + 1.0
        for word, lemma_set in word_lemma_sets.items()
    }

    for lemma, sentence_en_lists in lemma_en_tokens.items():
        tf: Counter = Counter()
        for en_list in sentence_en_lists:
            tf.update(en_list)

        n_sentences = len(sentence_en_lists)
        scores: Dict[str, float] = {
            word: (count / n_sentences) * idf.get(word, 1.0)
            for word, count in tf.items()
        }

        top_words = sorted(scores, key=scores.__getitem__, reverse=True)[:top_k]
        if lemma in store:
            store[lemma].gloss_candidates = top_words

    filled = sum(1 for e in store.values() if e.gloss_candidates)
    logger.info("Glosses extracted for %d / %d lemmas.", filled, len(store))


# ---------------------------------------------------------------------------
# Sentence → lemma index (for example_ids)
# ---------------------------------------------------------------------------

def build_sentence_lemma_index(
    parallel_df: pd.DataFrame,
    surface_to_lemma: Dict[str, str],
) -> Dict[str, List[int]]:
    """
    Return lemma → [sentence_index, ...] mapping for the parallel corpus.
    """
    index: Dict[str, List[int]] = defaultdict(list)
    if parallel_df.empty or "qu_tokens" not in parallel_df.columns:
        return index
    for sent_idx, row in parallel_df.iterrows():
        seen: Set[str] = set()
        for qt in row["qu_tokens"]:
            lemma = surface_to_lemma.get(qt)
            if lemma and lemma not in seen:
                index[lemma].append(int(sent_idx))
                seen.add(lemma)
    return index
