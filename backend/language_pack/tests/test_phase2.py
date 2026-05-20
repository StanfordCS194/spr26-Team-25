"""Phase 2 acceptance tests.

Run with: cd backend && python -m pytest language_pack/tests/

Two load-bearing assertions:
1. compose(load('ancient-greek'), profile) reproduces today's SYSTEM_PROMPT.format(...) byte-for-byte.
2. extract(greek_pack, sample_response) returns the same entries as today's hardcoded regex.

Plus coverage for Nahuatl loading, dictionary materialization, and post-load defaults.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

# Allow `import language_pack` when running from backend/
BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from language_pack import (  # noqa: E402
    LearnerProfile,
    compose,
    extract,
    load,
)


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

def _today_system_prompt() -> str:
    """Read SYSTEM_PROMPT literally out of routes/chat.py via the AST.
    Avoids importing chat.py (which has runtime deps on Anthropic/Supabase)."""
    chat_py = BACKEND / "routes" / "chat.py"
    tree = ast.parse(chat_py.read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "SYSTEM_PROMPT":
                    return node.value.value
    raise AssertionError("SYSTEM_PROMPT not found in chat.py")


def _todays_greek_regex() -> re.Pattern:
    """Replicate today's hardcoded regex from chat.py.extract_vocabulary."""
    return re.compile(r"([Ͱ-Ͽἀ-῿]+)\*{0,2}\s*\(([^)]+)\)\*{0,2}\s*[=:]\s*(.+)")


SAMPLE_ASSISTANT_RESPONSE = """
Let's learn three core Greek words today.

1. **ψυχή (psychḗ)** = soul — the seat of life and emotion in Homeric thought
2. λόγος (lógos) = word, reason
3. **ἀγάπη (agápē)** = love (selfless variety)

Question: which of these would Plato most likely use in a dialogue?
"""


# ---------------------------------------------------------------------------
# Acceptance 1: Greek prompt is reproduced byte-for-byte
# ---------------------------------------------------------------------------

def test_greek_prompt_matches_today_byte_for_byte():
    pack = load("ancient-greek")
    profile = LearnerProfile(
        level="beginner",
        goal="Read philosophy (Plato, Aristotle)",
        time_commitment="30-60 minutes",
    )
    composed = compose(pack, profile)
    expected = _today_system_prompt().format(
        level="beginner",
        goal="Read philosophy (Plato, Aristotle)",
        time_commitment="30-60 minutes",
    )
    assert composed == expected, "Greek composed prompt diverged from today's SYSTEM_PROMPT.format()"


def test_greek_prompt_for_all_canonical_profiles():
    pack = load("ancient-greek")
    today = _today_system_prompt()
    cases = [
        ("beginner", "Read philosophy (Plato, Aristotle)", "30-60 minutes"),
        ("intermediate", "Read the New Testament", "1-2 hours"),
        ("advanced", "Academic coursework", "2+ hours"),
        ("beginner", "General curiosity & history", "15-30 minutes"),
    ]
    for level, goal, tc in cases:
        profile = LearnerProfile(level=level, goal=goal, time_commitment=tc)
        composed = compose(pack, profile)
        expected = today.format(level=level, goal=goal, time_commitment=tc)
        assert composed == expected, f"Mismatch for ({level}, {goal}, {tc})"


# ---------------------------------------------------------------------------
# Acceptance 2: Vocab extractor matches today's behavior on a sample
# ---------------------------------------------------------------------------

def test_greek_extractor_matches_today_regex():
    pack = load("ancient-greek")
    pack_rows = extract(pack, SAMPLE_ASSISTANT_RESPONSE, session_id="sess-test")

    today_regex = _todays_greek_regex()
    today_matches = today_regex.findall(SAMPLE_ASSISTANT_RESPONSE)
    seen: set = set()
    today_rows: list = []
    for greek, translit, meaning in today_matches:
        greek = greek.strip()
        if greek in seen:
            continue
        seen.add(greek)
        today_rows.append({
            "session_id": "sess-test",
            "word": greek,
            "translit": translit.strip(),
            "meaning": meaning.strip().rstrip("*").strip(),
        })

    # Compare as ordered lists
    assert pack_rows == today_rows, (
        f"Extracted rows diverged.\n  pack:  {pack_rows}\n  today: {today_rows}"
    )


def test_greek_extractor_finds_expected_entries():
    pack = load("ancient-greek")
    rows = extract(pack, SAMPLE_ASSISTANT_RESPONSE)
    words = [r["word"] for r in rows]
    assert "ψυχή" in words
    assert "λόγος" in words
    assert "ἀγάπη" in words
    assert len(rows) == 3


# ---------------------------------------------------------------------------
# Nahuatl pack: loads, applies defaults, materializes dictionary, extracts
# ---------------------------------------------------------------------------

def test_nahuatl_loads_with_31_entries():
    pack = load("classical-nahuatl")
    assert pack.grounding.policy == "strict"
    assert pack.grounding.retrieval == "inline-all"
    assert pack.grounding.dictionary is not None
    assert len(pack.grounding.dictionary.entries) == 31


def test_nahuatl_dictionary_context_inlines_all_entries():
    pack = load("classical-nahuatl")
    profile = LearnerProfile(level="beginner", goal="everyday-colors", time_commitment="15-30 minutes")
    composed = compose(pack, profile)
    assert "chichiltic" in composed
    assert "[tʃitʃiltik]" in composed
    assert "the color red" in composed
    # Every dictionary entry's headword should appear in the composed prompt.
    for entry in pack.grounding.dictionary.entries:
        assert entry.word in composed, f"Missing dictionary entry in prompt: {entry.word}"


def test_nahuatl_extractor_uses_no_translit_format():
    pack = load("classical-nahuatl")
    sample = """
    A few colors for today:
    chichiltic = the color red
    coztic = the color yellow
    """
    rows = extract(pack, sample)
    words = [r["word"] for r in rows]
    assert "chichiltic" in words
    assert "coztic" in words
    # translit is None when lineFormat has no {translit}
    assert all(r["translit"] is None for r in rows)


# ---------------------------------------------------------------------------
# Post-load defaults
# ---------------------------------------------------------------------------

def test_greek_default_policy_is_open():
    pack = load("ancient-greek")
    assert pack.grounding.policy == "open"


def test_nahuatl_keeps_authored_strict_policy():
    pack = load("classical-nahuatl")
    assert pack.grounding.policy == "strict"


def test_vocabulary_line_format_resolved():
    greek = load("ancient-greek")
    assert greek.vocabulary.lineFormat == "{word} ({translit}) = {meaning}"
    nahuatl = load("classical-nahuatl")
    assert nahuatl.vocabulary.lineFormat == "{word} = {meaning}"


if __name__ == "__main__":
    # Allow `python test_phase2.py` for quick iteration.
    import traceback
    failures = 0
    tests = [v for k, v in list(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
        except Exception:
            failures += 1
            print(f"  FAIL  {t.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    sys.exit(0 if failures == 0 else 1)
