"""
English cognate annotation for Old Norse vocabulary.

Adds a ``cognates`` field to each LemmaEntry where the lemma has a known
modern English relative.  This is pedagogically powerful: English speakers
learning Old Norse can anchor new words to familiar ones.

COGNATE_MAP is a curated dict of Old Norse lemma → modern English cognate.
Words are only included when the semantic connection is clear to a non-specialist
(i.e. "ship" / "skip" is included; deep sound-shifts like "faðir" / "father"
where the connection is obvious are also included; false friends are excluded).

Called from run.py after build_vocabulary().
"""
from __future__ import annotations

import logging
from typing import Dict

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Curated cognate map
# ---------------------------------------------------------------------------

COGNATE_MAP: Dict[str, str] = {
    # Pronouns / determiners
    "ek":      "I",
    "þú":      "thou",
    "sá":      "that (demonstrative)",

    # Kinship
    "faðir":   "father",
    "móðir":   "mother",
    "sonr":    "son",
    "dóttir":  "daughter",
    "bróðir":  "brother",
    "systir":  "sister",
    "maðr":    "man",
    "karl":    "churl",
    "barn":    "bairn (Scots English: child)",
    "konungr": "king",
    "jarl":    "earl",
    "þræll":   "thrall",

    # Body
    "höfuð":   "head",
    "auga":    "eye",
    "eyra":    "ear",
    "hǫnd":    "hand",
    "fótr":    "foot",
    "hjarta":  "heart",
    "blóð":    "blood",
    "bein":    "bone",
    "hár":     "hair",
    "tunga":   "tongue",

    # Numbers
    "einn":    "one",
    "tveir":   "two",
    "þrír":    "three",
    "fjórir":  "four",
    "fimm":    "five",
    "sex":     "six",
    "sjau":    "seven",
    "átta":    "eight",
    "níu":     "nine",
    "tíu":     "ten",

    # Common verbs
    "vera":    "was / were (to be)",
    "hafa":    "have",
    "fara":    "fare (to travel)",
    "koma":    "come",
    "gefa":    "give",
    "taka":    "take",
    "bera":    "bear (to carry)",
    "bíta":    "bite",
    "ríða":    "ride",
    "finna":   "find",
    "binda":   "bind",
    "drekka":  "drink",
    "standa":  "stand",
    "falla":   "fall",
    "segja":   "say",
    "heyra":   "hear",
    "vita":    "wit (to know, archaic)",
    "skulu":   "shall",
    "vilja":   "will",
    "kalla":   "call",
    "sœkja":   "seek",
    "sjá":     "see",
    "kunna":   "con (to know, archaic)",
    "lífa":    "live",
    "deyja":   "die",

    # Adjectives
    "góðr":    "good",
    "lítill":  "little",
    "gamall":  "old",
    "ungr":    "young",
    "langr":   "long",
    "hár":     "high",
    "lágr":    "low",
    "svartr":  "swarthy (dark-complexioned)",
    "hvítr":   "white",
    "rauðr":   "red",
    "blár":    "blue",
    "nýr":     "new",
    "ríkr":    "rich",
    "sterkr":  "stark (strong)",
    "veikr":   "weak",

    # Nature & time
    "dagr":    "day",
    "nótt":    "night",
    "sumar":   "summer",
    "vetr":    "winter",
    "haust":   "harvest (archaic: autumn)",
    "sól":     "sol- (as in solar)",
    "máni":    "moon",
    "stjarna":  "star",
    "himinn":  "heaven",
    "jörð":    "earth",
    "sjór":    "sea",
    "vatn":    "water",
    "vindr":   "wind",
    "ís":      "ice",
    "snjór":   "snow",
    "steinn":  "stone",
    "dalr":    "dale (a valley)",
    "skógr":   "shaw (a small wood, archaic)",

    # Warfare
    "sverð":   "sword",
    "skjöldr": "shield",
    "hjálmr":  "helm (helmet)",
    "herr":    "harry (to raid)",
    "lög":     "law",
    "þing":    "thing (assembly, as in Althing)",
    "friðr":   "frith (peace, archaic)",

    # Seafaring
    "skip":    "ship",
    "bátr":    "boat",
    "segl":    "sail",
    "höfn":    "haven",
    "haf":     "heave-ho (related root)",

    # Mythology
    "goð":     "god",
    "álfr":    "elf",
    "rún":     "rune",

    # Common nouns
    "hús":     "house",
    "land":    "land",
    "vegr":    "way",
    "heimr":   "home",
    "líf":     "life",
    "dauði":   "death",
    "nafn":    "name",
    "orð":     "word",
    "saga":    "saga",
    "gull":    "gold",
    "silfr":   "silver",
    "hundr":   "hound",
    "fiskr":   "fish",
    "fugll":   "fowl",
    "ormr":    "worm",
    "brauð":   "bread",
    "mjöðr":   "mead",
    "bjórr":   "beer",
    "mjólk":   "milk",
    "vinr":    "win (archaic: to cherish)",
    "félag":   "fellow",
}


# ---------------------------------------------------------------------------
# Annotation function
# ---------------------------------------------------------------------------

def annotate_cognates(store: dict) -> None:
    """
    Add English cognate links to LemmaEntry objects in ``store``.

    Looks up each lemma in COGNATE_MAP.  If found, sets:
        entry.cognates["English"] = modern_english_word

    Modifies ``store`` in place.
    """
    hits = 0
    for lemma, entry in store.items():
        cognate = COGNATE_MAP.get(lemma)
        if cognate:
            entry.cognates["English"] = cognate
            hits += 1

    logger.info("Cognates annotated for %d / %d lemmas.", hits, len(store))
