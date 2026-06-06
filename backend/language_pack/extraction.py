"""Build a vocabulary-extraction regex from a pack and pull entries from text.

The regex is derived from two pack fields:

- script.unicodeRanges:  ['U+0370-U+03FF', 'U+1F00-U+1FFF']  ->  character class
- vocabulary.lineFormat: '{word} ({translit}) = {meaning}'   ->  pattern shape

Three placeholders are supported in lineFormat: {word}, {translit}, {meaning}.
Each becomes a regex capture group. Surrounding text is literal but with
markdown-tolerance baked in:

- whitespace becomes \\s*
- '=' becomes [=:] (some prompts use a colon instead)
- '{word}' may be followed by markdown asterisks (\\*{0,2})
- ')' may be followed by markdown asterisks (\\*{0,2})

For the Greek pack this produces a regex equivalent to the one
hardcoded in backend/routes/chat.py today.
"""

from __future__ import annotations

import re
from typing import Iterable, List, Optional

from .models import LanguagePack


def build_regex(pack: LanguagePack) -> re.Pattern:
    charclass = _unicode_ranges_to_charclass(pack.script.unicodeRanges)
    fmt = pack.vocabulary.lineFormat
    if fmt is None:
        raise ValueError(
            f"Pack '{pack.id}' has no vocabulary.lineFormat. loader._apply_post_load_defaults should have set one."
        )
    return re.compile(_compile_line_format(fmt, charclass))


def extract(pack: LanguagePack, text: str, session_id: Optional[str] = None) -> List[dict]:
    """Pull vocabulary lines out of an assistant response.

    Returns a list of {word, translit, meaning} dicts in order of appearance,
    deduplicated by word. session_id is included on each row when provided,
    mirroring chat.py's existing shape.
    """
    pattern = build_regex(pack)
    has_translit = "{translit}" in (pack.vocabulary.lineFormat or "")

    seen: set = set()
    rows: list = []
    for match in pattern.finditer(text):
        groups = match.groups()
        word = groups[0].strip()
        if word in seen:
            continue
        seen.add(word)
        if has_translit:
            translit = groups[1].strip()
            meaning = groups[2].strip().rstrip("*").strip()
        else:
            translit = None
            meaning = groups[1].strip().rstrip("*").strip()
        row: dict = {"word": word, "translit": translit, "meaning": meaning}
        if session_id is not None:
            row["session_id"] = session_id
        rows.append(row)
    return rows


_PLACEHOLDERS = (
    # ordered: each replaces from start-of-pattern
    ("{word}", "WORD_CAP"),
    ("{translit}", "TRANSLIT_CAP"),
    ("{meaning}", "MEANING_CAP"),
)


def _compile_line_format(fmt: str, charclass: str) -> str:
    """Build the regex source string from a lineFormat template.

    Placeholders become capture groups. Literal chars are escaped, with these
    tolerances applied at literal-emit time:
      - any literal '=' becomes '[=:]'
      - any literal ')' becomes '\\)\\*{0,2}' (markdown close after parens)
      - any literal ' ' becomes '\\s*'
    Consecutive '\\s*' are collapsed.
    """
    out: list = []
    i = 0
    n = len(fmt)
    while i < n:
        matched = False
        for ph, token in _PLACEHOLDERS:
            if fmt.startswith(ph, i):
                if token == "WORD_CAP":
                    # Word may be followed by closing markdown bold.
                    out.append(f"([{charclass}]+)\\*{{0,2}}")
                elif token == "TRANSLIT_CAP":
                    out.append(r"([^)]+)")
                elif token == "MEANING_CAP":
                    out.append(r"(.+)")
                i += len(ph)
                matched = True
                break
        if matched:
            continue

        ch = fmt[i]
        i += 1
        if ch.isspace():
            # Horizontal-only whitespace: prevents cross-line matches when the
            # script is Latin (e.g. an English sentence followed by 'word = meaning'
            # on the next line, where \s* would let 'sentence:' match 'word').
            out.append(r"[ \t]*")
        elif ch == "=":
            out.append(r"[=:]")
        elif ch == ")":
            out.append(r"\)\*{0,2}")
        else:
            out.append(re.escape(ch))

    pattern = "".join(out)
    # Collapse consecutive whitespace tolerances into one
    pattern = re.sub(r"(\[ \\t\]\*){2,}", r"[ \\t]*", pattern)
    return pattern


def _unicode_ranges_to_charclass(ranges: Iterable[str]) -> str:
    """Convert ['U+0370-U+03FF', ...] to a character class body like
    '\\u0370-\\u03FF...' suitable for use inside [...]."""
    parts: list = []
    for r in ranges:
        if "-" in r:
            lo, hi = r.split("-")
            parts.append(f"\\u{int(lo[2:], 16):04x}-\\u{int(hi[2:], 16):04x}")
        else:
            parts.append(f"\\u{int(r[2:], 16):04x}")
    return "".join(parts)
