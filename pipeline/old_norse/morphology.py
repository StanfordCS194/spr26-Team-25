"""
Verb class and grammatical gender annotation for Old Norse vocabulary.

Verb classes
------------
Old Norse verbs fall into two major divisions:

**Strong verbs** — use vowel alternation (ablaut) to mark tense; no dental suffix.
Seven classes defined by the stem vowel pattern:
    Class I   : í – ei – i – i    (e.g. bíta → beit → bitu → bitinn)
    Class II  : jú/ú – au – u – o (e.g. bjóða → bauð → buðu – boðinn)
    Class III : e – a – u – o     (e.g. binda → batt – bundu – bundinn)
    Class IV  : e – a – á – o     (e.g. bera – bar – báru – borinn)
    Class V   : e – a – á – e     (e.g. gefa – gaf – gáfu – gefinn)
    Class VI  : a – ó – ó – a     (e.g. fara – fór – fóru – farinn)
    Class VII : various reduplicated/ē origins (e.g. heita, falla, ráða)

**Weak verbs** — add a dental suffix (-ði/-ti/-ði) to mark the past tense:
    Class 1: i-stems; i-umlaut present (e.g. heyra, kalla with -ja forms)
    Class 2: a-stems; no i-umlaut (e.g. kalla, tala)
    Class 3: short-syllable i-stems (e.g. hafa, lifa)

**Preterite-present verbs** — their present tense looks like a strong preterite:
    (vita, mega, kunna, skulu, munu, eiga, þurfa, munu, verða)

**Anomalous verbs**: vera (to be), vilja (to want), ganga (to go)

Grammatical gender
------------------
Inferred primarily from the STARTER_VOCAB lookup table, with fallback suffix
heuristics for nouns not in the starter vocabulary.

Called from run.py after build_vocabulary().
"""
from __future__ import annotations

import logging
import re
from typing import Dict, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Strong verb class patterns (lemma-vowel based heuristics)
# ---------------------------------------------------------------------------

# Each entry: (lemma regex, class label)
# Matching is tried in order; first match wins.
_STRONG_PATTERNS = [
    # Class I  — stem contains í, ei variants in preterite
    (re.compile(r"[bdfghjklmnprstvþð]í[bdfghjklmnprstvþð]"), "strong.I"),
    # Class II — jóC, bjó, ljó, njó, rjó stems; or stríða, ríða, bíða etc.
    (re.compile(r"(bjó|ljó|njó|rjó|flj|þrý)"), "strong.II"),
    # Class III — VC cluster: bind, find, drink, help, etc.  Short vowel + CC
    (re.compile(r"[aeiouáéíóúý][lmnr][dfgkpstþ]"), "strong.III"),
    # Class IV — single sonorant after vowel: bera, nema, skera
    (re.compile(r"[eio][lmnr](?:a|ja)?$"), "strong.IV"),
    # Class V  — single non-sonorant after vowel: gefa, eta, meta
    (re.compile(r"[ei][bdfgkpstþ](?:a|ja)?$"), "strong.V"),
    # Class VI — a-stem present: fara, standa, grafa, slá
    (re.compile(r"^[bcdfghjklmnprstvþð]+a$"), "strong.VI"),
    # Class VII — fallback for heita, ráða, falla, halda, gróa, blóta
    (re.compile(r"(heita|ráð|falla|halda|gróa|blót|auka|eiga)"), "strong.VII"),
]

# Preterite-present verb stems (fixed list)
_PRET_PRES = frozenset([
    "vita", "mega", "kunna", "skulu", "munu", "eiga", "þurfa",
    "unna", "duga", "muna", "vilja",  # vilja is technically anomalous but grouped here
])

# Anomalous verbs
_ANOMALOUS = frozenset(["vera", "ganga", "vilja"])

# Weak verbs: class 1 ends in -ja or has i-umlaut indicator; class 2 regular -a
_WEAK1_SUFFIX = re.compile(r"(ja|ja$|ðja|yja)$")
_WEAK2_SUFFIX = re.compile(r"a$")


def _detect_verb_class(lemma: str) -> str:
    """Heuristically classify a verb lemma into its Old Norse class."""
    if lemma in _ANOMALOUS:
        return "anomalous"
    if lemma in _PRET_PRES:
        return "preterite-present"

    # Try strong patterns
    for pattern, cls in _STRONG_PATTERNS:
        if pattern.search(lemma):
            return cls

    # Weak heuristics
    if _WEAK1_SUFFIX.search(lemma):
        return "weak.1"
    if _WEAK2_SUFFIX.search(lemma):
        return "weak.2"

    return "weak.2"   # most common fallback


# ---------------------------------------------------------------------------
# Gender heuristics (nouns not in starter_vocab)
# ---------------------------------------------------------------------------

# These suffix patterns are rough heuristics, not perfect
_GENDER_HEURISTICS = [
    # Strong masculine: nominative -r
    (re.compile(r"[^aeiouáéíóúý]r$"), "m"),
    # Weak masculine: -i ending
    (re.compile(r"[^aeiouáéíóúý]i$"), "m"),
    # Feminine: -a, -ing, -ung, -ning, or front-vowel stems ending in consonant
    (re.compile(r"a$"), "f"),
    (re.compile(r"(ing|ung|ning)$"), "f"),
    # Neuter: tends to end in consonant after short vowel, or -i after consonant
    (re.compile(r"[bdfghjklmnprstvþð]{2}$"), "n"),
]


def _detect_gender(lemma: str, pos: str) -> Optional[str]:
    """
    Infer grammatical gender from the lemma ending.
    Only applies to nouns (pos == 'noun').
    Returns None for verbs, adverbs, etc.
    """
    if pos not in ("noun", "other"):
        return None
    for pattern, gender in _GENDER_HEURISTICS:
        if pattern.search(lemma):
            return gender
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def annotate_morphology(store: dict, starter_vocab: Dict[str, dict]) -> None:
    """
    Populate ``verb_class`` and ``grammatical_gender`` on each LemmaEntry.

    Priority order:
    1. Starter vocab lookup (authoritative, hand-curated)
    2. Heuristic detection from lemma shape

    Also seeds ``cognates`` from ``starter_vocab["cognate_en"]`` if present
    (backup for entries that weren't found by cognates.annotate_cognates).

    Modifies ``store`` in place.
    """
    # Build a stripped-lemma → starter_vocab mapping so that dictionary-form
    # keys (e.g. "konungr") resolve to their stripped lemmas (e.g. "konung").
    # Import here to avoid circular imports at module load time.
    from .vocabulary import estimate_lemma  # noqa: PLC0415

    sv_by_lemma: Dict[str, dict] = {}
    for sv_key, sv_info in starter_vocab.items():
        sv_lemma, _, _ = estimate_lemma(sv_key)
        sv_by_lemma.setdefault(sv_lemma, sv_info)
        sv_by_lemma.setdefault(sv_key, sv_info)  # also keep the raw key

    verb_hits = 0
    gender_hits = 0
    cognate_hits = 0

    for lemma, entry in store.items():
        sv = sv_by_lemma.get(lemma, {})

        # --- Grammatical gender ---
        if not entry.grammatical_gender:
            if sv.get("gender"):
                entry.grammatical_gender = sv["gender"]
                gender_hits += 1
            else:
                inferred = _detect_gender(lemma, entry.estimated_pos)
                if inferred:
                    entry.grammatical_gender = inferred
                    gender_hits += 1

        # --- Verb class ---
        if not entry.verb_class and entry.estimated_pos == "verb":
            if sv.get("notes") and "strong" in sv.get("notes", ""):
                # Extract class from notes like "strong cl.IV"
                m = re.search(r"strong\s+cl\.([IVX1-7]+)", sv["notes"])
                entry.verb_class = f"strong.{m.group(1)}" if m else _detect_verb_class(lemma)
            elif sv.get("notes") and "weak" in sv.get("notes", ""):
                m = re.search(r"weak\s+cl\.([0-9]+)", sv["notes"])
                entry.verb_class = f"weak.{m.group(1)}" if m else _detect_verb_class(lemma)
            elif sv.get("notes") and "preterite-present" in sv.get("notes", ""):
                entry.verb_class = "preterite-present"
            elif sv.get("notes") and "anomalous" in sv.get("notes", ""):
                entry.verb_class = "anomalous"
            else:
                entry.verb_class = _detect_verb_class(lemma)
            verb_hits += 1

        # --- Backup cognate from starter_vocab ---
        if not entry.cognates and sv.get("cognate_en"):
            entry.cognates["English"] = sv["cognate_en"]
            if sv.get("cognate_de"):
                entry.cognates["German"] = sv["cognate_de"]
            cognate_hits += 1

    logger.info(
        "Morphology annotated — gender: %d, verb_class: %d, cognates (from starter): %d",
        gender_hits, verb_hits, cognate_hits,
    )
