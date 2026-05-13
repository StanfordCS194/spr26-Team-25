"""
Hardcoded starter vocabulary for the Old Norse pipeline.

This module provides a curated set of ~200 high-frequency Old Norse words
covering the most pedagogically important categories: pronouns, kinship,
body parts, numbers, common verbs, adjectives, mythological terms, and
everyday nouns.

Two purposes
------------
1. **Offline fallback** — when CLTK is unavailable or network access is
   restricted, ``loaders.py`` builds its parallel DataFrame from this dict
   instead, ensuring the pipeline always produces *something* useful.
2. **Gender and cognate seed** — ``morphology.py`` reads gender and English
   cognate annotations from this dict to annotate LemmaEntry objects that
   were also found in the corpus.

Entry schema
------------
Each entry is a dict with:
    en          English gloss (required)
    gender      Grammatical gender: "m", "f", "n" (optional)
    cognate_en  Modern English cognate (optional)
    cognate_de  Modern German cognate (optional)
    notes       Brief annotation (optional)
"""
from __future__ import annotations

from typing import Dict

STARTER_VOCAB: Dict[str, dict] = {
    # ---------------------------------------------------------------------------
    # Pronouns
    # ---------------------------------------------------------------------------
    "ek":       {"en": "I",           "gender": None},
    "þú":       {"en": "you (sg.)",   "gender": None},
    "hann":     {"en": "he",          "gender": "m"},
    "hon":      {"en": "she",         "gender": "f"},
    "þat":      {"en": "it, that",    "gender": "n"},
    "vér":      {"en": "we",          "gender": None},
    "þér":      {"en": "you (pl.)",   "gender": None},
    "þeir":     {"en": "they (m.)",   "gender": "m"},
    "þær":      {"en": "they (f.)",   "gender": "f"},
    "þau":      {"en": "they (n.)",   "gender": "n"},
    "sá":       {"en": "that, he",    "gender": "m"},
    "sú":       {"en": "that, she",   "gender": "f"},
    "sjá":      {"en": "this",        "gender": None},

    # ---------------------------------------------------------------------------
    # Kinship
    # ---------------------------------------------------------------------------
    "faðir":    {"en": "father",         "gender": "m", "cognate_en": "father",  "cognate_de": "Vater"},
    "móðir":    {"en": "mother",         "gender": "f", "cognate_en": "mother",  "cognate_de": "Mutter"},
    "sonr":     {"en": "son",            "gender": "m", "cognate_en": "son",     "cognate_de": "Sohn"},
    "dóttir":   {"en": "daughter",       "gender": "f", "cognate_en": "daughter"},
    "bróðir":   {"en": "brother",        "gender": "m", "cognate_en": "brother", "cognate_de": "Bruder"},
    "systir":   {"en": "sister",         "gender": "f", "cognate_en": "sister",  "cognate_de": "Schwester"},
    "maðr":     {"en": "man, person",    "gender": "m", "cognate_en": "man",     "cognate_de": "Mann"},
    "kona":     {"en": "woman, wife",    "gender": "f"},
    "karl":     {"en": "man, fellow",    "gender": "m", "cognate_en": "churl"},
    "barn":     {"en": "child",          "gender": "n", "cognate_en": "bairn (Scots)"},
    "afi":      {"en": "grandfather",    "gender": "m"},
    "amma":     {"en": "grandmother",    "gender": "f"},
    "frændi":   {"en": "kinsman",        "gender": "m"},
    "husfreyja":{"en": "mistress of house","gender": "f"},
    "konungr":  {"en": "king",           "gender": "m", "cognate_en": "king"},
    "jarl":     {"en": "earl, chieftain","gender": "m", "cognate_en": "earl"},
    "þræll":    {"en": "slave, thrall",  "gender": "m", "cognate_en": "thrall"},

    # ---------------------------------------------------------------------------
    # Body
    # ---------------------------------------------------------------------------
    "höfuð":    {"en": "head",      "gender": "n", "cognate_en": "head",   "cognate_de": "Haupt"},
    "auga":     {"en": "eye",       "gender": "n", "cognate_en": "eye",    "cognate_de": "Auge"},
    "eyra":     {"en": "ear",       "gender": "n", "cognate_en": "ear",    "cognate_de": "Ohr"},
    "nef":      {"en": "nose",      "gender": "n", "cognate_en": "neb (archaic)"},
    "muðr":     {"en": "mouth",     "gender": "m"},
    "tunga":    {"en": "tongue",    "gender": "f", "cognate_en": "tongue"},
    "hǫnd":     {"en": "hand",      "gender": "f", "cognate_en": "hand",   "cognate_de": "Hand"},
    "fótr":     {"en": "foot",      "gender": "m", "cognate_en": "foot",   "cognate_de": "Fuß"},
    "hjarta":   {"en": "heart",     "gender": "n", "cognate_en": "heart",  "cognate_de": "Herz"},
    "blóð":     {"en": "blood",     "gender": "n", "cognate_en": "blood",  "cognate_de": "Blut"},
    "bein":     {"en": "bone, leg", "gender": "n", "cognate_en": "bone"},
    "líkami":   {"en": "body",      "gender": "m"},
    "hár":      {"en": "hair",      "gender": "n", "cognate_en": "hair"},
    "aðr":      {"en": "vein, artery","gender": "f"},

    # ---------------------------------------------------------------------------
    # Numbers
    # ---------------------------------------------------------------------------
    "einn":     {"en": "one",    "cognate_en": "one",   "cognate_de": "ein"},
    "tveir":    {"en": "two",    "cognate_en": "two",   "cognate_de": "zwei"},
    "þrír":     {"en": "three",  "cognate_en": "three", "cognate_de": "drei"},
    "fjórir":   {"en": "four",   "cognate_en": "four",  "cognate_de": "vier"},
    "fimm":     {"en": "five",   "cognate_en": "five",  "cognate_de": "fünf"},
    "sex":      {"en": "six",    "cognate_en": "six",   "cognate_de": "sechs"},
    "sjau":     {"en": "seven",  "cognate_en": "seven", "cognate_de": "sieben"},
    "átta":     {"en": "eight",  "cognate_en": "eight", "cognate_de": "acht"},
    "níu":      {"en": "nine",   "cognate_en": "nine",  "cognate_de": "neun"},
    "tíu":      {"en": "ten",    "cognate_en": "ten",   "cognate_de": "zehn"},

    # ---------------------------------------------------------------------------
    # Common verbs
    # ---------------------------------------------------------------------------
    "vera":     {"en": "to be",           "notes": "anomalous verb"},
    "hafa":     {"en": "to have",         "cognate_en": "have",  "notes": "weak cl.3"},
    "gera":     {"en": "to do, make",     "cognate_en": "gar- (archaic prefix)"},
    "fara":     {"en": "to go, travel",   "cognate_en": "fare",  "notes": "strong cl.VI"},
    "koma":     {"en": "to come",         "cognate_en": "come",  "notes": "strong cl.IV"},
    "gefa":     {"en": "to give",         "cognate_en": "give",  "notes": "strong cl.V"},
    "taka":     {"en": "to take",         "cognate_en": "take",  "notes": "strong cl.VI"},
    "sjá":      {"en": "to see",          "cognate_en": "see",   "notes": "strong cl.V"},
    "segja":    {"en": "to say, tell",    "cognate_en": "say",   "notes": "weak cl.1 irregular"},
    "heyra":    {"en": "to hear",         "cognate_en": "hear",  "notes": "weak cl.1"},
    "vita":     {"en": "to know",         "cognate_en": "wit",   "notes": "preterite-present"},
    "mega":     {"en": "to be able to",   "notes": "preterite-present"},
    "skulu":    {"en": "shall, must",     "cognate_en": "shall", "notes": "preterite-present"},
    "vilja":    {"en": "to want, will",   "cognate_en": "will",  "notes": "anomalous"},
    "munu":     {"en": "will (future)",   "notes": "preterite-present"},
    "bera":     {"en": "to carry, bear",  "cognate_en": "bear",  "notes": "strong cl.IV"},
    "bíta":     {"en": "to bite",         "cognate_en": "bite",  "notes": "strong cl.I"},
    "ríða":     {"en": "to ride",         "cognate_en": "ride",  "notes": "strong cl.I"},
    "finna":    {"en": "to find",         "cognate_en": "find",  "notes": "strong cl.III"},
    "binda":    {"en": "to bind",         "cognate_en": "bind",  "notes": "strong cl.III"},
    "drekka":   {"en": "to drink",        "cognate_en": "drink", "notes": "strong cl.III"},
    "standa":   {"en": "to stand",        "cognate_en": "stand", "notes": "strong cl.VI"},
    "falla":    {"en": "to fall",         "cognate_en": "fall",  "notes": "strong cl.VII"},
    "heita":    {"en": "to be called, command","cognate_en": "hight (archaic)", "notes": "strong cl.VII"},
    "lífa":     {"en": "to live",         "cognate_en": "live"},
    "deyja":    {"en": "to die",          "cognate_en": "die"},
    "sœkja":    {"en": "to seek",         "cognate_en": "seek",  "notes": "weak irregular"},
    "berja":    {"en": "to strike, beat", "notes": "weak cl.1"},
    "kalla":    {"en": "to call, name",   "cognate_en": "call",  "notes": "weak cl.2"},
    "tala":     {"en": "to speak, count", "cognate_en": "tale (related)"},
    "eiga":     {"en": "to own, have",    "notes": "preterite-present"},
    "kunna":    {"en": "to know how to",  "cognate_en": "con (archaic)", "notes": "preterite-present"},

    # ---------------------------------------------------------------------------
    # Common adjectives
    # ---------------------------------------------------------------------------
    "góðr":     {"en": "good",    "gender": "m", "cognate_en": "good",  "cognate_de": "gut"},
    "illr":     {"en": "bad, evil","gender": "m"},
    "mikill":   {"en": "great, large","gender": "m", "cognate_en": "mickle (archaic)"},
    "lítill":   {"en": "little, small","gender": "m", "cognate_en": "little"},
    "gamall":   {"en": "old",     "gender": "m", "cognate_en": "old",  "cognate_de": "alt"},
    "ungr":     {"en": "young",   "gender": "m", "cognate_en": "young"},
    "sterkr":   {"en": "strong",  "gender": "m", "cognate_en": "stark"},
    "veikr":    {"en": "weak",    "gender": "m", "cognate_en": "weak"},
    "langr":    {"en": "long",    "gender": "m", "cognate_en": "long",  "cognate_de": "lang"},
    "skammr":   {"en": "short",   "gender": "m"},
    "hár":      {"en": "high, tall","gender": "m", "cognate_en": "high", "cognate_de": "hoch"},
    "lágr":     {"en": "low",     "gender": "m", "cognate_en": "low"},
    "svartr":   {"en": "black",   "gender": "m", "cognate_en": "swarthy"},
    "hvítr":    {"en": "white",   "gender": "m", "cognate_en": "white"},
    "rauðr":    {"en": "red",     "gender": "m", "cognate_en": "red",  "cognate_de": "rot"},
    "blár":     {"en": "blue, dark","gender": "m", "cognate_en": "blue"},
    "nýr":      {"en": "new",     "gender": "m", "cognate_en": "new",  "cognate_de": "neu"},
    "gamall":   {"en": "old",     "gender": "m"},
    "frjáls":   {"en": "free",    "gender": "m"},
    "ríkr":     {"en": "powerful, rich","gender": "m", "cognate_en": "rich"},
    "auðigr":   {"en": "wealthy", "gender": "m"},

    # ---------------------------------------------------------------------------
    # Nature & time
    # ---------------------------------------------------------------------------
    "dagr":     {"en": "day",     "gender": "m", "cognate_en": "day",   "cognate_de": "Tag"},
    "nótt":     {"en": "night",   "gender": "f", "cognate_en": "night", "cognate_de": "Nacht"},
    "ár":       {"en": "year",    "gender": "n", "cognate_en": "year (related)"},
    "sumar":    {"en": "summer",  "gender": "n", "cognate_en": "summer"},
    "vetr":     {"en": "winter",  "gender": "m", "cognate_en": "winter", "cognate_de": "Winter"},
    "vor":      {"en": "spring",  "gender": "n"},
    "haust":    {"en": "autumn",  "gender": "n", "cognate_en": "harvest (related)"},
    "sól":      {"en": "sun",     "gender": "f", "cognate_en": "sol- (prefix)", "cognate_de": "Sonne"},
    "máni":     {"en": "moon",    "gender": "m", "cognate_en": "moon",  "cognate_de": "Mond"},
    "stjarna":  {"en": "star",    "gender": "f", "cognate_en": "star",  "cognate_de": "Stern"},
    "himinn":   {"en": "sky, heaven","gender": "m","cognate_en": "heaven"},
    "jörð":     {"en": "earth, land","gender": "f","cognate_en": "earth"},
    "sjór":     {"en": "sea",     "gender": "m", "cognate_en": "sea",   "cognate_de": "See"},
    "á":        {"en": "river",   "gender": "f"},
    "vatn":     {"en": "water, lake","gender": "n","cognate_en": "water","cognate_de": "Wasser"},
    "eldr":     {"en": "fire",    "gender": "m", "cognate_en": "elder (fire in some dialects)"},
    "vindr":    {"en": "wind",    "gender": "m", "cognate_en": "wind",  "cognate_de": "Wind"},
    "ís":       {"en": "ice",     "gender": "m", "cognate_en": "ice",   "cognate_de": "Eis"},
    "snjór":    {"en": "snow",    "gender": "m", "cognate_en": "snow",  "cognate_de": "Schnee"},
    "steinn":   {"en": "stone",   "gender": "m", "cognate_en": "stone", "cognate_de": "Stein"},
    "mörk":     {"en": "forest",  "gender": "f"},
    "fjall":    {"en": "mountain","gender": "n"},
    "dalr":     {"en": "valley",  "gender": "m", "cognate_en": "dale"},
    "skógr":    {"en": "forest, wood","gender": "m","cognate_en": "shaw (archaic)"},

    # ---------------------------------------------------------------------------
    # Warfare & society
    # ---------------------------------------------------------------------------
    "sverð":    {"en": "sword",   "gender": "n", "cognate_en": "sword"},
    "skjöldr":  {"en": "shield",  "gender": "m", "cognate_en": "shield"},
    "spjót":    {"en": "spear",   "gender": "n", "cognate_en": "spit (related)"},
    "ör":       {"en": "arrow",   "gender": "f"},
    "bogi":     {"en": "bow",     "gender": "m", "cognate_en": "bow"},
    "öx":       {"en": "axe",     "gender": "f", "cognate_en": "axe"},
    "hjálmr":   {"en": "helmet",  "gender": "m", "cognate_en": "helm"},
    "brynja":   {"en": "mail coat, armour","gender": "f"},
    "orrusta":  {"en": "battle",  "gender": "f"},
    "víg":      {"en": "killing, slaying","gender": "n"},
    "herr":     {"en": "army, host","gender": "m","cognate_en": "harry (to raid)"},
    "friðr":    {"en": "peace",   "gender": "m"},
    "lög":      {"en": "law",     "gender": "n (pl.)", "cognate_en": "law"},
    "þing":     {"en": "assembly, thing","gender": "n","cognate_en": "thing (archaic)"},

    # ---------------------------------------------------------------------------
    # Seafaring
    # ---------------------------------------------------------------------------
    "skip":     {"en": "ship",    "gender": "n", "cognate_en": "ship",  "cognate_de": "Schiff"},
    "bátr":     {"en": "boat",    "gender": "m", "cognate_en": "boat"},
    "á":        {"en": "river",   "gender": "f"},
    "haf":      {"en": "open sea","gender": "n", "cognate_en": "have (archaic: haven)"},
    "höfn":     {"en": "harbour", "gender": "f", "cognate_en": "haven"},
    "segl":     {"en": "sail",    "gender": "n", "cognate_en": "sail"},
    "árr":      {"en": "oar",     "gender": "m", "cognate_en": "oar"},

    # ---------------------------------------------------------------------------
    # Mythology & religion
    # ---------------------------------------------------------------------------
    "goð":      {"en": "god, deity","gender": "n", "cognate_en": "god",  "cognate_de": "Gott"},
    "áss":      {"en": "Æsir god","gender": "m", "notes": "specifically one of the Æsir"},
    "dísir":    {"en": "female spirits","gender": "f (pl.)"},
    "norn":     {"en": "Norn (fate weaver)","gender": "f"},
    "valkyrja": {"en": "valkyrie","gender": "f"},
    "jötunn":   {"en": "giant",   "gender": "m"},
    "álfr":     {"en": "elf",     "gender": "m", "cognate_en": "elf"},
    "dvergar":  {"en": "dwarves", "gender": "m (pl.)"},
    "blót":     {"en": "blood sacrifice, ritual","gender": "n"},
    "rún":      {"en": "rune, secret","gender": "f", "cognate_en": "rune"},
    "seiðr":    {"en": "seiðr magic","gender": "m"},
    "skáld":    {"en": "skald, poet","gender": "m"},
    "Óðinn":    {"en": "Odin",    "gender": "m"},
    "Þórr":     {"en": "Thor",    "gender": "m"},
    "Freyr":    {"en": "Freyr",   "gender": "m"},
    "Freyja":   {"en": "Freyja",  "gender": "f"},
    "Loki":     {"en": "Loki",    "gender": "m"},
    "Heimdallr":{"en": "Heimdall","gender": "m"},
    "Yggdrasill":{"en": "Yggdrasil (world tree)","gender": "m"},
    "Valhöll":  {"en": "Valhalla","gender": "f"},
    "Ásgarðr":  {"en": "Asgard",  "gender": "m"},
    "Miðgarðr": {"en": "Midgard", "gender": "m", "cognate_en": "Midgard"},
    "Útgarðr":  {"en": "Utgard (outer realm)","gender": "m"},

    # ---------------------------------------------------------------------------
    # Common nouns (miscellaneous)
    # ---------------------------------------------------------------------------
    "hús":      {"en": "house",   "gender": "n", "cognate_en": "house", "cognate_de": "Haus"},
    "land":     {"en": "land, country","gender": "n","cognate_en": "land","cognate_de": "Land"},
    "vegr":     {"en": "way, road","gender": "m", "cognate_en": "way"},
    "heimr":    {"en": "home, world","gender": "m","cognate_en": "home"},
    "líf":      {"en": "life",    "gender": "n", "cognate_en": "life",  "cognate_de": "Leib"},
    "dauði":    {"en": "death",   "gender": "m", "cognate_en": "death"},
    "nafn":     {"en": "name",    "gender": "n", "cognate_en": "name",  "cognate_de": "Name"},
    "orð":      {"en": "word",    "gender": "n", "cognate_en": "word",  "cognate_de": "Wort"},
    "mál":      {"en": "speech, matter","gender": "n"},
    "saga":     {"en": "story, tale","gender": "f", "cognate_en": "saga"},
    "kvæði":    {"en": "poem, verse","gender": "n"},
    "gull":     {"en": "gold",    "gender": "n", "cognate_en": "gold",  "cognate_de": "Gold"},
    "silfr":    {"en": "silver",  "gender": "n", "cognate_en": "silver","cognate_de": "Silber"},
    "félag":    {"en": "fellowship, partnership","gender": "n","cognate_en": "fellow"},
    "vinr":     {"en": "friend",  "gender": "m", "cognate_en": "win (archaic: love)"},
    "óvinr":    {"en": "enemy, foe","gender": "m"},
    "hundr":    {"en": "dog, hound","gender": "m","cognate_en": "hound","cognate_de": "Hund"},
    "hestr":    {"en": "horse",   "gender": "m"},
    "kú":       {"en": "cow",     "gender": "f", "cognate_en": "cow",   "cognate_de": "Kuh"},
    "fiskr":    {"en": "fish",    "gender": "m", "cognate_en": "fish",  "cognate_de": "Fisch"},
    "fugll":    {"en": "bird",    "gender": "m", "cognate_en": "fowl"},
    "ormr":     {"en": "worm, dragon","gender": "m","cognate_en": "worm"},
    "brauð":    {"en": "bread",   "gender": "n", "cognate_en": "bread", "cognate_de": "Brot"},
    "mjöðr":    {"en": "mead",    "gender": "m", "cognate_en": "mead"},
    "bjórr":    {"en": "beer",    "gender": "m", "cognate_en": "beer",  "cognate_de": "Bier"},
    "mjólk":    {"en": "milk",    "gender": "f", "cognate_en": "milk",  "cognate_de": "Milch"},
}
