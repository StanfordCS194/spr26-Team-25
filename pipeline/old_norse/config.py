from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PACK_ROOT = Path(__file__).resolve().parent.parent.parent  # spr26-Team-25/
PIPELINE_DIR = PACK_ROOT / "pipeline"
REPORT_DIR = PIPELINE_DIR / "reports"
OUTPUT_ROOT = PACK_ROOT / "old_norse"
VOCAB_OUTPUT_DIR = OUTPUT_ROOT / "vocabulary" / "extracted"
EXAMPLES_OUTPUT_DIR = OUTPUT_ROOT / "examples"

# ---------------------------------------------------------------------------
# DataFrame column names
#
# We reuse "qu" and "es" as internal column labels (Old Norse and English
# respectively) so that shared vocabulary.py / semantics.py / schema_writer.py
# logic works without modification.  These names never appear in output JSON.
# ---------------------------------------------------------------------------

COL_QU = "qu"      # Old Norse text column (reuses Quechua slot name)
COL_ES = "es"      # English text column   (reuses Spanish slot name)
COL_TEXT = "text"  # Monolingual Old Norse column

# ---------------------------------------------------------------------------
# CLTK corpus identifiers
# (requires: pip install cltk)
# ---------------------------------------------------------------------------

CLTK_MONOLINGUAL_CORPUS = "old_norse_texts_heimskringla"   # Snorri's Heimskringla
CLTK_DICT_CORPUS = "cltk_non_zoega_dictionary"             # Zoëga concise dict

# Pack metadata
DIALECT = "west-norse"
SCHEMA_VERSION = "1.0"
PACK_ID = "old-norse"

# ---------------------------------------------------------------------------
# Frequency bands  (language-agnostic — same thresholds as Quechua)
# ---------------------------------------------------------------------------

FREQUENCY_BANDS: Dict[str, Tuple[int, int]] = {
    "core":   (1,    100),
    "high":   (101,  500),
    "medium": (501,  2000),
    "low":    (2001, 5000),
    "rare":   (5001, 10**9),
}

# ---------------------------------------------------------------------------
# Old Norse phonological feature sets  (for difficulty scoring)
# ---------------------------------------------------------------------------

THORN_ETH_CHARS: List[str] = ["þ", "ð"]
FRONT_ROUNDED_CHARS: List[str] = ["ø", "ǿ"]
OGONEK_CHARS: List[str] = ["ǫ"]
LONG_VOWELS: List[str] = ["á", "é", "í", "ó", "ú", "ý"]
ASH_CHAR: List[str] = ["æ"]

# ---------------------------------------------------------------------------
# Morphological suffix tables for Old Norse
#
# Format: (suffix_string, Leipzig_gloss, host_pos_hint)
# Ordered longest-first within each group.
#
# The five "layer" slot names mirror the Quechua config so that the shared
# vocabulary.py (which imports DISCOURSE_SUFFIXES, VERB_AGREEMENT_SUFFIXES,
# etc. by name) works without change.
#
# Stripping order — outermost first:
#   1. DISCOURSE_SUFFIXES      → definite article enclitics (-inn, -in, -it …)
#   2. VERB_AGREEMENT_SUFFIXES → middle voice (-sk) + presentparticiple (-andi)
#   3. VERB_TENSE_SUFFIXES     → weak preterite endings (-aði, -uðu …)
#   4. VERB_DERIV_SUFFIXES     → past participle forms (-inn, -at)
#   5. NOUN_SUFFIXES           → case / number endings (-um, -ar, -ir, -r …)
# ---------------------------------------------------------------------------

# Layer 1: Definite article enclitics (always outermost)
DISCOURSE_SUFFIXES: List[Tuple[str, str, str]] = [
    ("innar", "DEF.GEN.SG.F",  "any"),
    ("inum",  "DEF.DAT.PL",    "any"),
    ("inni",  "DEF.DAT.SG.F",  "any"),
    ("inn",   "DEF.NOM.SG.M",  "any"),
    ("ins",   "DEF.GEN.SG",    "any"),
    ("ina",   "DEF.ACC.SG.F",  "any"),
    ("in",    "DEF.NOM.SG.F",  "any"),
    ("it",    "DEF.NOM.SG.N",  "any"),
    ("num",   "DEF.DAT.PL",    "any"),
    ("na",    "DEF.ACC.PL",    "any"),
]

# Layer 2: Middle voice reflexive + present participle
VERB_AGREEMENT_SUFFIXES: List[Tuple[str, str, str]] = [
    ("umsk",  "MID.1PL",   "verb"),
    ("isk",   "MID.2SG",   "verb"),
    ("ask",   "MID.INF",   "verb"),
    ("andi",  "PRES.PART", "verb"),
    ("sk",    "MID",       "verb"),
    ("st",    "MID.2SG",   "verb"),
]

# Layer 3: Weak preterite endings
VERB_TENSE_SUFFIXES: List[Tuple[str, str, str]] = [
    ("uðum", "PST.1PL",  "verb"),
    ("uðut", "PST.2PL",  "verb"),
    ("uðu",  "PST.3PL",  "verb"),
    ("aðir", "PST.2SG",  "verb"),
    ("aði",  "PST.3SG",  "verb"),
    ("aðu",  "PST.3PL",  "verb"),
    ("ðum",  "PST.1PL",  "verb"),
    ("ðu",   "PST.3PL",  "verb"),
    ("ta",   "PST",      "verb"),
    ("ti",   "PST",      "verb"),
]

# Layer 4: Past participle / derivational verb forms
VERB_DERIV_SUFFIXES: List[Tuple[str, str, str]] = [
    ("inni", "PP.DAT.F",       "verb"),
    ("inn",  "PP.M",           "verb"),
    ("at",   "PP.N",           "verb"),
    ("in",   "PP.F",           "verb"),
    # Strong preterite person/number endings (after ablaut root has already changed)
    ("um",   "PST.1PL.STRONG", "verb"),
    ("ut",   "PST.2PL.STRONG", "verb"),
    ("t",    "PST.2SG.STRONG", "verb"),
    # Optative / subjunctive (important for saga syntax)
    ("ir",   "OPT.2SG",        "verb"),
    ("im",   "OPT.1PL",        "verb"),
]

# Layer 5: Noun/adjective case and number endings
NOUN_SUFFIXES: List[Tuple[str, str, str]] = [
    ("nnar", "GEN.SG.F",       "noun"),
    ("nni",  "DAT.SG.F",       "noun"),
    # Adjective comparative/superlative
    ("astri", "SUPERL.DAT.F",  "adj"),
    ("astr",  "SUPERL",        "adj"),
    ("asta",  "SUPERL.ACC",    "adj"),
    ("astan", "SUPERL.ACC.M",  "adj"),
    ("ari",   "COMP.DAT",      "adj"),
    ("ara",   "COMP.GEN.PL",   "adj"),
    ("an",    "ACC.SG.M.STR",  "noun"),
    # Dual number (archaic)
    ("u",     "NOM/ACC.DU",    "noun"),
    # Standard case endings
    ("um",    "DAT.PL",        "noun"),
    ("ar",    "GEN.SG/NOM.PL", "noun"),
    ("ir",    "NOM.PL.I",      "noun"),
    ("a",     "ACC/GEN.PL",    "noun"),
    ("i",     "DAT.SG",        "noun"),
    ("r",     "NOM.SG.M",      "noun"),
    ("s",     "GEN.SG",        "noun"),
]

# Ordered stripping sequence — outermost first
SUFFIX_LAYERS: List[List[Tuple[str, str, str]]] = [
    DISCOURSE_SUFFIXES,
    VERB_AGREEMENT_SUFFIXES,
    VERB_TENSE_SUFFIXES,
    VERB_DERIV_SUFFIXES,
    NOUN_SUFFIXES,
]

# Minimum characters a root must have after stripping
MIN_LEMMA_LENGTH = 3
# Maximum suffix layers to strip before giving up
MAX_STRIP_DEPTH = 5

# ---------------------------------------------------------------------------
# Sentence quality filters
# ---------------------------------------------------------------------------

MIN_TOKENS = 2              # Monolingual sentences must have at least this many tokens
MIN_PARALLEL_QU_TOKENS = 1  # Dictionary headwords may be single tokens
MAX_TOKENS = 30
MAX_LENGTH_RATIO = 5.0

# ---------------------------------------------------------------------------
# Semantic field keyword map  (English keywords → semantic field name)
# Used by semantics.py which checks the "es" (English) side of the corpus.
# ---------------------------------------------------------------------------

SEMANTIC_FIELD_KEYWORDS: Dict[str, List[str]] = {
    "mythology": [
        "odin", "thor", "freyr", "freya", "loki", "aesir", "vanir", "valhalla",
        "yggdrasil", "ragnarok", "norns", "valkyrie", "asgard", "midgard", "jotun",
        "giant", "dwarf", "elf", "god", "goddess",
    ],
    "warfare": [
        "sword", "shield", "battle", "warrior", "fight", "weapon", "axe", "spear",
        "helmet", "victory", "defeat", "army", "war", "combat", "enemy", "slain",
        "blood", "wound", "kill", "brave",
    ],
    "seafaring": [
        "ship", "sea", "sail", "voyage", "longship", "oar", "wind", "ocean",
        "harbour", "captain", "wave", "navigate", "boat", "crew", "anchor",
        "coast", "island", "row", "storm", "fleet",
    ],
    "kinship": [
        "father", "mother", "son", "daughter", "brother", "sister", "family",
        "wife", "husband", "kin", "uncle", "aunt", "cousin", "grandson", "clan",
        "child", "birth", "lineage", "heir", "widow",
    ],
    "law": [
        "law", "assembly", "oath", "judgment", "compensation", "honour", "shame",
        "verdict", "rights", "thing", "court", "justice", "penalty", "rule",
        "outlaw", "settle", "agree", "feud", "peace", "banish",
    ],
    "nature": [
        "mountain", "forest", "river", "snow", "ice", "stone", "fire", "water",
        "winter", "summer", "earth", "tree", "wind", "rock", "valley",
        "spring", "autumn", "sky", "sun", "moon",
    ],
    "religion": [
        "sacrifice", "ritual", "temple", "prayer", "magic", "rune", "fate",
        "spirit", "sacred", "worship", "divine", "blot", "omen", "prophecy",
        "seer", "destiny", "soul", "afterlife", "holy", "curse",
    ],
    "crafts": [
        "smith", "forge", "iron", "gold", "silver", "weave", "build", "carve",
        "craft", "tool", "hammer", "make", "work", "create", "fashion",
        "bronze", "wood", "metal", "loom", "timber",
    ],
    "food": [
        "eat", "drink", "meat", "bread", "milk", "mead", "feast", "hunt",
        "farm", "harvest", "fish", "cattle", "food", "cook", "ale",
        "grain", "butter", "cheese", "beer", "slaughter",
    ],
    "body": [
        "hand", "eye", "head", "heart", "blood", "arm", "foot", "mouth",
        "strength", "wound", "neck", "bone", "skin", "hair", "face",
        "shoulder", "leg", "finger", "teeth", "breath",
    ],
    "emotion": [
        "courage", "fear", "joy", "anger", "grief", "love", "pride", "wisdom",
        "cunning", "loyal", "brave", "sorrow", "rage", "hope", "shame",
        "hate", "trust", "bold", "coward", "envy",
    ],
    "wealth": [
        "gold", "silver", "treasure", "gift", "trade", "rich", "property",
        "reward", "hoard", "ring", "payment", "wealth", "money", "goods",
        "tribute", "ransom", "trade", "merchant", "profit", "plunder",
    ],
    "time": [
        "day", "night", "year", "summer", "winter", "age", "old", "young",
        "death", "life", "morning", "evening", "past", "future", "season",
        "hour", "generation", "era", "dawn", "dusk",
    ],
    "poetry": [
        "skald", "verse", "kenning", "saga", "tale", "speak", "word", "praise",
        "name", "story", "poem", "song", "tongue", "mouth", "voice",
        "recite", "compose", "memory", "fame", "glory",
    ],
}

# ---------------------------------------------------------------------------
# Difficulty scoring weights
# ---------------------------------------------------------------------------

DIFFICULTY_BASE: Dict[str, float] = {
    "core":   1.0,
    "high":   2.0,
    "medium": 3.0,
    "low":    4.0,
    "rare":   4.5,
}

# Modifiers added to the base score
DIFFICULTY_MODIFIERS: Dict[str, float] = {
    "has_thorn_eth":     0.50,   # þ or ð — phonologically marked consonants
    "has_front_rounded": 0.25,   # ø, ǿ   — unusual for English speakers
    "has_ogonek":        0.50,   # ǫ      — rare diacritical vowel
    "has_long_vowel":    0.25,   # á é í ó ú ý — macron marking
    "has_ash":           0.25,   # æ      — additional diacritical vowel
    "morpheme_depth_2_3": 0.25,
    "morpheme_depth_4p":  0.50,
    "length_10_13":      0.25,
    "length_14p":        0.50,
}

# Map total score → CEFR level
DIFFICULTY_THRESHOLDS: List[Tuple[float, str]] = [
    (1.75, "A1"),
    (2.75, "A2"),
    (3.75, "B1"),
    (float("inf"), "B2"),
]
