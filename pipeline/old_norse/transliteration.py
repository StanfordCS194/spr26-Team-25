"""
Latin Old Norse → Elder Futhark Unicode transliteration.

Elder Futhark is the oldest runic alphabet, used roughly 2nd–8th centuries CE.
Each Old Norse Latin character is mapped to its closest Elder Futhark equivalent.

Notes
-----
- Long vowels (á é í ó ú ý) map to the same rune as their short counterparts;
  vowel length was not distinguished in runic writing.
- ø, ǫ both map to Othalan (ᛟ), the closest back/rounded vowel rune.
- æ maps to Ansuz (ᚨ), the front/open vowel rune.
- ð and þ are distinct phonemes but both map to Thurisaz (ᚦ) in Elder Futhark;
  the eth/thorn distinction postdates the Elder Futhark period.
- Characters with no rune equivalent are passed through unchanged.

Unicode block: U+16A0–U+16FF (Runic)
"""
from __future__ import annotations

ELDER_FUTHARK_MAP: dict[str, str] = {
    # Basic vowels
    "a": "ᚨ",  # Ansuz  (U+16A8)
    "á": "ᚨ",
    "æ": "ᚨ",  # closest front vowel
    "e": "ᛖ",  # Ehwaz  (U+16D6)
    "é": "ᛖ",
    "i": "ᛁ",  # Isa    (U+16C1)
    "í": "ᛁ",
    "o": "ᛟ",  # Othalan (U+16DF)
    "ó": "ᛟ",
    "ø": "ᛟ",  # front rounded → Othalan
    "ǿ": "ᛟ",
    "ǫ": "ᛟ",  # o-ogonek → Othalan
    "u": "ᚢ",  # Uruz   (U+16A2)
    "ú": "ᚢ",
    "y": "ᛃ",  # Jera   (U+16C3) — closest approximation
    "ý": "ᛃ",
    # Basic consonants
    "b": "ᛒ",  # Berkano (U+16D2)
    "d": "ᛞ",  # Dagaz  (U+16DE)
    "f": "ᚠ",  # Fehu   (U+16A0)
    "g": "ᚷ",  # Gebo   (U+16B7)
    "h": "ᚺ",  # Hagalaz (U+16BA)
    "j": "ᛃ",  # Jera   (U+16C3)
    "k": "ᚲ",  # Kenaz  (U+16A6)
    "l": "ᛚ",  # Laguz  (U+16DA)
    "m": "ᛗ",  # Mannaz (U+16D7)
    "n": "ᚾ",  # Nauthiz (U+16BE)
    "p": "ᛈ",  # Perthro (U+16C8)
    "r": "ᚱ",  # Raido  (U+16B1)
    "s": "ᛊ",  # Sowilo (U+16CA)
    "t": "ᛏ",  # Tiwaz  (U+16CF)
    "v": "ᚹ",  # Wunjo  (U+16B9)
    "w": "ᚹ",
    "z": "ᛉ",  # Algiz  (U+16C9)
    # Old Norse special characters
    "þ": "ᚦ",  # Thurisaz (U+16A6 — thorn)
    "ð": "ᚦ",  # Dagaz in late usage; historically Thurisaz sounds closest
}


RUNE_NAMES: dict[str, str] = {
    "ᚨ": "Ansuz",
    "ᚢ": "Uruz",
    "ᚦ": "Thurisaz",
    "ᚠ": "Fehu",
    "ᚷ": "Gebo",
    "ᚺ": "Hagalaz",
    "ᛁ": "Isa",
    "ᛃ": "Jera",
    "ᚲ": "Kenaz",
    "ᛚ": "Laguz",
    "ᛗ": "Mannaz",
    "ᚾ": "Nauthiz",
    "ᛟ": "Othalan",
    "ᛈ": "Perthro",
    "ᚱ": "Raido",
    "ᛊ": "Sowilo",
    "ᛏ": "Tiwaz",
    "ᚹ": "Wunjo",
    "ᛞ": "Dagaz",
    "ᛖ": "Ehwaz",
    "ᛒ": "Berkano",
    "ᛉ": "Algiz",
}


def to_elder_futhark(word: str) -> str:
    """
    Transliterate an Old Norse word (Latin orthography) into Elder Futhark runes.

    Characters without a rune mapping (digits, punctuation, unmapped letters)
    are passed through as-is so the function never loses information.

    Args:
        word: A single Old Norse word in lowercase Latin orthography.

    Returns:
        A string of Elder Futhark Unicode characters (mixed with any
        unmapped characters).

    Examples:
        >>> to_elder_futhark("heimr")
        'ᚺᛖᛁᛗᚱ'
        >>> to_elder_futhark("þórr")
        'ᚦᛟᚱᚱ'
        >>> to_elder_futhark("oðinn")
        'ᛟᚦᛁᚾᚾ'
    """
    return "".join(ELDER_FUTHARK_MAP.get(ch, ch) for ch in word.lower())


def to_elder_futhark_with_names(word: str) -> dict:
    """
    Transliterate a word and return both the rune string and each rune's name.

    Returns:
        {"runes": "ᛞᚨᚷᚱ", "names": ["Dagaz", "Ansuz", "Gebo", "Raido"]}
    """
    runes = to_elder_futhark(word)
    return {
        "runes": runes,
        "names": [RUNE_NAMES.get(r, r) for r in runes],
    }
