"""
Vocabulary extraction, lemmatisation, and frequency analysis.

Lemmatisation strategy
----------------------
Quechua is highly agglutinative.  A full morphological analyser does not
exist as an open-source Python library for Ayacucho-Chanka, so this module
uses a heuristic iterative suffix stripper.

The stripper tries to peel one suffix layer at a time — outermost first —
using the ordered suffix tables in config.py.  It stops when no suffix
matches or the remaining root would be shorter than MIN_LEMMA_LENGTH.

This is an approximation: it will sometimes conflate homographs and split
morphologically ambiguous forms.  The output is marked as auto-generated
(`_auto: true` in extensions) so curators know to review it.

Gloss extraction
----------------
For each lemma, candidate Spanish glosses are ranked by a TF-IDF-style
score over the parallel corpus.  Spanish words that appear across many
different Quechua lemma contexts (stopwords, grammar words) get low scores;
words that are distinctive to a particular lemma context rank high.
"""
from __future__ import annotations

import logging
import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

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
    frequency: int = 0          # total across all surface forms
    frequency_rank: int = 0     # 1 = most frequent
    frequency_band: str = "rare"
    morpheme_depth: int = 0     # suffix layers stripped
    stripped_glosses: List[str] = field(default_factory=list)  # suffix glosses
    estimated_pos: str = "other"

    # Filled by semantics module
    semantic_fields: List[str] = field(default_factory=list)
    gloss_candidates: List[str] = field(default_factory=list)  # Spanish
    example_ids: List[str] = field(default_factory=list)

    # Filled by difficulty module
    proficiency_level: str = "B2"
    difficulty_score: float = 4.5

    # Sources this lemma was observed in
    sources: Set[str] = field(default_factory=set)


# ---------------------------------------------------------------------------
# Suffix stripping
# ---------------------------------------------------------------------------

def _try_strip_one_layer(
    form: str,
) -> Optional[Tuple[str, str, str]]:
    """
    Attempt to strip exactly one suffix layer from `form`.

    Returns (root, gloss, pos_hint) or None if no suffix matched.

    Uses a global longest-match across all suffix layers to avoid the
    ambiguity where a short suffix (e.g. -na NMLZ) masks a longer one
    (e.g. -kuna PL).  Longer suffix wins; ties broken by layer order.
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
        morpheme_depth is the number of suffix layers removed.
        estimated_pos reflects the innermost suffix that gave a pos hint.
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
            pos = hint  # innermost non-ambiguous hint wins

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
) -> Dict[str, LemmaEntry]:
    """
    Build a lemma → LemmaEntry mapping from both corpora.

    Steps:
    1. Collect all Quechua surface forms from both corpora with frequencies.
    2. For each surface form, estimate a lemma via suffix stripping.
    3. Aggregate surface form frequencies under their lemma.
    4. Assign frequency rank and band.

    Returns the vocabulary store as a dict keyed by lemma string.
    """
    # Step 1: count surface forms across both corpora
    surface_counter: Counter = Counter()

    logger.info("Counting tokens from parallel corpus …")
    for tokens in tqdm(parallel_df["qu_tokens"], desc="Parallel tokens"):
        surface_counter.update(tokens)

    logger.info("Counting tokens from monolingual corpus …")
    for tokens in tqdm(mono_df["tokens"], desc="Mono tokens"):
        surface_counter.update(tokens)

    logger.info("Unique surface forms: %d", len(surface_counter))

    # Step 2 & 3: lemmatise and aggregate
    # lemma → (LemmaEntry being built, set of contributing surface forms)
    store: Dict[str, LemmaEntry] = {}
    surface_to_lemma: Dict[str, str] = {}  # for reference from other modules

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

        # Keep the minimum depth (root forms have depth 0; aggregate should
        # track whether the lemma itself was seen in bare form)
        if depth < entry.morpheme_depth:
            entry.morpheme_depth = depth
            if pos != "other":
                entry.estimated_pos = pos

    # Step 4: rank and assign bands
    ranked = sorted(store.values(), key=lambda e: e.frequency, reverse=True)
    for rank, entry in enumerate(ranked, start=1):
        entry.frequency_rank = rank
        entry.frequency_band = _assign_frequency_band(rank)

    # Tag sources (coarse: both corpora contributed to the same lemma pool)
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

_ES_STOPWORDS = frozenset(
    "el la los las un una de que en es para por con no se al del"
    " le su sus pero más como si yo tú él ella este esta esto eso"
    " aquí allí también ya muy bien mal".split()
)


def extract_glosses(
    parallel_df: pd.DataFrame,
    store: Dict[str, LemmaEntry],
    surface_to_lemma: Dict[str, str],
    top_k: int = 4,
) -> None:
    """
    Populate `gloss_candidates` on each LemmaEntry using a TF-IDF-style
    ranking over the parallel Spanish side.

    Modifies `store` in place.
    """
    logger.info("Extracting glosses from parallel corpus (TF-IDF) …")

    # Build: lemma → list of Spanish token sets (one per sentence)
    lemma_es_tokens: Dict[str, List[List[str]]] = defaultdict(list)

    for _, row in tqdm(
        parallel_df.iterrows(), total=len(parallel_df), desc="Indexing glosses"
    ):
        qu_tokens: List[str] = row["qu_tokens"]
        es_tokens: List[str] = row["es_tokens"]

        # Filter stopwords from Spanish side
        es_content = [t for t in es_tokens if t not in _ES_STOPWORDS and len(t) > 2]
        if not es_content:
            continue

        seen_lemmas: Set[str] = set()
        for qt in qu_tokens:
            lemma = surface_to_lemma.get(qt)
            if lemma and lemma in store:
                seen_lemmas.add(lemma)

        for lemma in seen_lemmas:
            lemma_es_tokens[lemma].append(es_content)

    # IDF: for each Spanish word, count how many distinct lemmas it co-occurs with
    word_lemma_sets: Dict[str, Set[str]] = defaultdict(set)
    for lemma, sentence_es_lists in lemma_es_tokens.items():
        for es_list in sentence_es_lists:
            for word in es_list:
                word_lemma_sets[word].add(lemma)

    n_lemmas = len(lemma_es_tokens)
    idf: Dict[str, float] = {
        word: math.log((n_lemmas + 1) / (len(lemma_set) + 1)) + 1.0
        for word, lemma_set in word_lemma_sets.items()
    }

    # TF-IDF score per lemma
    for lemma, sentence_es_lists in lemma_es_tokens.items():
        tf: Counter = Counter()
        for es_list in sentence_es_lists:
            tf.update(es_list)

        n_sentences = len(sentence_es_lists)
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
# Sentence → lemma index (used by schema writer for example_ids)
# ---------------------------------------------------------------------------

def build_sentence_lemma_index(
    parallel_df: pd.DataFrame,
    surface_to_lemma: Dict[str, str],
) -> Dict[str, List[int]]:
    """
    Return lemma → [sentence_index, ...] mapping for the parallel corpus.
    Used later to populate example_ids on vocabulary entries.
    """
    index: Dict[str, List[int]] = defaultdict(list)
    for sent_idx, row in parallel_df.iterrows():
        seen: Set[str] = set()
        for qt in row["qu_tokens"]:
            lemma = surface_to_lemma.get(qt)
            if lemma and lemma not in seen:
                index[lemma].append(int(sent_idx))
                seen.add(lemma)
    return index
