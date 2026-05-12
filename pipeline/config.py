from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PACK_ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = PACK_ROOT / "pipeline"
REPORT_DIR = PIPELINE_DIR / "reports"
OUTPUT_ROOT = PACK_ROOT / "quechua"
VOCAB_OUTPUT_DIR = OUTPUT_ROOT / "vocabulary" / "extracted"
EXAMPLES_OUTPUT_DIR = OUTPUT_ROOT / "examples"

# ---------------------------------------------------------------------------
# DataFrame column names (shared across all modules)
# ---------------------------------------------------------------------------

COL_QU = "qu"      # Quechua text column
COL_ES = "es"      # Spanish text column (parallel corpus)
COL_TEXT = "text"  # Quechua text column (monolingual corpus)

# ---------------------------------------------------------------------------
# HuggingFace dataset identifiers
# ---------------------------------------------------------------------------

PARALLEL_DATASET_ID = "somosnlp-hackathon-2022/spanish-to-quechua"
MONOLINGUAL_DATASET_ID = "Llamacha/monolingual-quechua-iic"

# ---------------------------------------------------------------------------
# Pack metadata
# ---------------------------------------------------------------------------

DIALECT = "ayacucho-chanka"
SCHEMA_VERSION = "1.0"
PACK_ID = "quechua"

# ---------------------------------------------------------------------------
# Frequency bands  (by rank, 1-indexed, inclusive on both ends)
# ---------------------------------------------------------------------------

FREQUENCY_BANDS: Dict[str, Tuple[int, int]] = {
    "core":   (1,    100),
    "high":   (101,  500),
    "medium": (501,  2000),
    "low":    (2001, 5000),
    "rare":   (5001, 10**9),
}

# ---------------------------------------------------------------------------
# Phonological feature sets (for Ayacucho-Chanka)
#
# Ayacucho lacks aspirated and ejective series.  The checks below are kept
# generic so the pipeline runs cleanly on Cusco-origin text too (useful for
# detecting dialect contamination in the corpus).
# ---------------------------------------------------------------------------

EJECTIVE_SEQUENCES: List[str] = ["ch'", "p'", "t'", "k'", "q'"]
ASPIRATED_SEQUENCES: List[str] = ["chh", "ph", "th", "kh", "qh"]
UVULAR_CHARS: List[str] = ["q"]   # plain uvular (non-aspirated, non-ejective)

# ---------------------------------------------------------------------------
# Morphological suffix tables
#
# Format: (suffix_string, Leipzig_gloss, host_pos_hint)
# Ordered longest-first within each group to maximise correct match.
# Stripping order during lemmatisation:
#   1. discourse / evidential (outermost)
#   2. subject agreement
#   3. tense / aspect
#   4. derivational (verb)
#   5. case / nominal
# ---------------------------------------------------------------------------

DISCOURSE_SUFFIXES: List[Tuple[str, str, str]] = [
    ("lla",   "SOFT",   "any"),
    ("chu",   "Q/NEG",  "any"),
    ("mi",    "DIR",    "any"),
    ("si",    "REP",    "any"),
    ("cha",   "DUBI",   "any"),
    ("m",     "DIR",    "any"),
    ("s",     "REP",    "any"),
]

VERB_AGREEMENT_SUFFIXES: List[Tuple[str, str, str]] = [
    ("nkichis", "2PL",      "verb"),
    ("nkichik", "2PL",      "verb"),
    ("nchis",   "1PL.INCL", "verb"),
    ("nchik",   "1PL.INCL", "verb"),
    ("yku",     "1PL.EXCL", "verb"),
    ("nku",     "3PL",      "verb"),
    ("nki",     "2SG",      "verb"),
    ("ni",      "1SG",      "verb"),
]

VERB_TENSE_SUFFIXES: List[Tuple[str, str, str]] = [
    ("chka",  "PROG", "verb"),
    ("sha",   "PROG", "verb"),
    ("rqa",   "PST",  "verb"),
    ("nqa",   "FUT",  "verb"),
]

VERB_DERIV_SUFFIXES: List[Tuple[str, str, str]] = [
    ("spa",  "SEQ.CV", "verb"),
    ("na",   "NMLZ",   "verb"),
    ("q",    "AGENT",  "verb"),
]

NOUN_SUFFIXES: List[Tuple[str, str, str]] = [
    ("niyuq", "HAVE", "noun"),
    ("kuna",  "PL",   "noun"),
    ("manta", "ABL",  "noun"),
    ("kama",  "LIM",  "noun"),
    ("man",   "ALL",  "noun"),
    ("wan",   "COM",  "noun"),
    ("yuq",   "HAVE", "noun"),
    ("pi",    "LOC",  "noun"),
    ("ta",    "ACC",  "noun"),
    ("pa",    "GEN",  "noun"),
    ("p",     "GEN",  "noun"),
]

# Ordered stripping sequence: outermost first
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
MAX_STRIP_DEPTH = 6

# ---------------------------------------------------------------------------
# Sentence quality filters
# ---------------------------------------------------------------------------

MIN_TOKENS = 2
MAX_TOKENS = 30
# Max ratio between Spanish and Quechua token counts in a parallel pair.
# Extreme ratios indicate misalignment or noise.
MAX_LENGTH_RATIO = 5.0

# ---------------------------------------------------------------------------
# Semantic field keyword map  (Spanish keywords → semantic field name)
# ---------------------------------------------------------------------------

SEMANTIC_FIELD_KEYWORDS: Dict[str, List[str]] = {
    "kinship": [
        "madre", "padre", "hijo", "hija", "hermano", "hermana",
        "familia", "mamá", "papá", "abuelo", "abuela", "esposo",
        "esposa", "tío", "tía", "primo", "prima", "nieto", "nieta",
    ],
    "body": [
        "mano", "pie", "cabeza", "ojo", "boca", "nariz", "oreja",
        "corazón", "sangre", "cuerpo", "brazo", "pierna", "espalda",
        "dedo", "rodilla", "hombro", "vientre",
    ],
    "food": [
        "comer", "beber", "agua", "comida", "pan", "carne", "leche",
        "arroz", "maíz", "papa", "fruta", "bebida", "cocinar",
        "hambre", "sed", "alimento",
    ],
    "agriculture": [
        "tierra", "campo", "sembrar", "cosechar", "chacra", "llama",
        "alpaca", "ganado", "semilla", "riego", "cosecha", "arado",
        "cultivar", "pastorear",
    ],
    "emotions": [
        "amar", "querer", "odiar", "tristeza", "alegría", "miedo",
        "feliz", "triste", "amor", "enojo", "llorar", "reír",
        "sentir", "contento", "angustia",
    ],
    "motion": [
        "ir", "venir", "caminar", "correr", "llegar", "salir",
        "entrar", "regresar", "subir", "bajar", "andar", "marchar",
        "viajar", "partir",
    ],
    "communication": [
        "hablar", "decir", "escuchar", "preguntar", "responder",
        "llamar", "escribir", "leer", "contar", "narrar", "explicar",
        "avisar", "anunciar",
    ],
    "time": [
        "hoy", "mañana", "ayer", "ahora", "tiempo", "día", "noche",
        "año", "mes", "semana", "hora", "antes", "después", "pronto",
        "tarde", "temprano",
    ],
    "nature": [
        "agua", "río", "montaña", "sol", "luna", "árbol", "flor",
        "animal", "lluvia", "viento", "nieve", "mar", "lago",
        "piedra", "planta",
    ],
    "numbers": [
        "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete",
        "ocho", "nueve", "diez", "cien", "mil", "contar", "número",
    ],
    "social": [
        "persona", "gente", "comunidad", "pueblo", "señor", "señora",
        "niño", "niña", "hombre", "mujer", "amigo", "amiga",
        "vecino", "jefe", "líder",
    ],
    "cognition": [
        "saber", "conocer", "pensar", "creer", "entender", "recordar",
        "olvidar", "aprender", "enseñar", "estudiar", "verdad",
        "mentira", "imaginar", "soñar",
    ],
    "location": [
        "aquí", "allí", "casa", "lugar", "ciudad", "pueblo", "país",
        "arriba", "abajo", "dentro", "fuera", "cerca", "lejos",
    ],
    "possession": [
        "tener", "dar", "recibir", "llevar", "traer", "dejar",
        "quitar", "guardar", "comprar", "vender", "obtener",
    ],
    "cosmology": [
        "dios", "cielo", "alma", "espíritu", "sagrado", "rezar",
        "orar", "adorar", "creencia", "ritual", "ceremonia",
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
    "has_ejective":    0.75,
    "has_aspirated":   0.50,
    "has_uvular":      0.25,
    "morpheme_depth_2_3": 0.25,
    "morpheme_depth_4p":  0.50,
    "length_9_12":     0.25,
    "length_13p":      0.50,
}

# Map total score → CEFR level
DIFFICULTY_THRESHOLDS: List[Tuple[float, str]] = [
    (1.75, "A1"),
    (2.75, "A2"),
    (3.75, "B1"),
    (float("inf"), "B2"),
]
