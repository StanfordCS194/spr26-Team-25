"""Command-line tool for working with Chronos language packs.

Usage:
    python -m language_pack <command> [args]

Commands:
    validate <pack-id-or-path>     Validate a pack (or all packs) against the schema and load it.
    info <pack-id>                 Print a summary of a pack's identity, dictionary, sovereignty.
    repl <pack-id>                 Open an interactive REPL against the pack via Anthropic.
                                   Requires ANTHROPIC_API_KEY in env.

Examples:
    python -m language_pack validate ancient-greek
    python -m language_pack validate                       # validates all packs
    python -m language_pack info ojibwe
    python -m language_pack repl classical-nahuatl
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from .grounding import materialize_dictionary_context
from .loader import PACKS_DIR, load, load_path
from .models import LanguagePack, LearnerProfile
from .prompt import compose


# ---------------------------------------------------------------------------
# validate
# ---------------------------------------------------------------------------

def _all_pack_paths() -> list[Path]:
    return sorted(p for p in PACKS_DIR.glob("*.json") if p.name != "schema.json")


def cmd_validate(args: argparse.Namespace) -> int:
    if args.target:
        candidates = [args.target]
    else:
        candidates = [p.stem for p in _all_pack_paths()]

    failed = 0
    for target in candidates:
        try:
            if Path(target).exists():
                pack = load_path(target)
            else:
                pack = load(target)
            dict_count = len(pack.grounding.dictionary.entries) if pack.grounding.dictionary else 0
            print(f"  OK     {pack.id:25}  status={pack.status:13}  entries={dict_count}")
        except Exception as exc:
            failed += 1
            print(f"  FAIL   {target}")
            for line in str(exc).splitlines():
                print(f"           {line}")
    print(f"\n{len(candidates) - failed}/{len(candidates)} packs validated")
    return 0 if failed == 0 else 1


# ---------------------------------------------------------------------------
# info
# ---------------------------------------------------------------------------

def cmd_info(args: argparse.Namespace) -> int:
    pack = load(args.pack_id)
    print(f"=== {pack.displayName} ({pack.id}) ===")
    print(f"  Local name:    {pack.displayNameLocal or '(none)'}")
    print(f"  Status:        {pack.status}")
    print(f"  Family:        {pack.family or '(unspecified)'}")
    print(f"  Dialect:       {pack.dialect or '(unspecified)'}")
    print(f"  ISO 639-3:     {pack.iso639 or '(unspecified)'}")
    print(f"  Script:        {pack.script.primary or '(unspecified)'} "
          f"({', '.join(pack.script.unicodeRanges)}, {pack.script.direction})")
    print()
    print(f"  Tutor:         {pack.tutor.name}")
    print(f"                 {pack.tutor.personaShort}")
    print()
    print(f"  Levels:        {len(pack.levels)}  ({', '.join(l.id for l in pack.levels) or '(none)'})")
    print(f"  Goals:         {len(pack.goals)}  ({', '.join(g.id for g in pack.goals) or '(none)'})")
    print()
    print(f"  Grounding:     policy={pack.grounding.policy}  retrieval={pack.grounding.retrieval}")
    if pack.grounding.dictionary:
        entries = pack.grounding.dictionary.entries
        with_morph = sum(1 for e in entries if e.morphology and e.morphology.segments)
        with_audio = sum(1 for e in entries if e.audioUrl)
        verified = sum(1 for e in entries if e.provenance and e.provenance.verified)
        print(f"                 entries={len(entries)}  with morphology={with_morph}  "
              f"with audio={with_audio}  verified={verified}")
    print()
    print(f"  Voice:         provider={pack.voice.provider}  voice={pack.voice.voice or '(none)'}")
    if pack.voice.fallbackVoice:
        fb = pack.voice.fallbackVoice
        print(f"                 fallback: {fb.provider or ''} {fb.voice or ''} ({fb.rationale or ''})")
    print()
    print(f"  Sovereignty:")
    print(f"    License:     {pack.sovereignty.license}")
    if pack.sovereignty.attribution:
        print(f"    Attribution: {pack.sovereignty.attribution}")
    if pack.sovereignty.restrictions:
        print(f"    Restrictions: {', '.join(pack.sovereignty.restrictions)}")
    if pack.sovereignty.communityPartnership:
        print(f"    Partnership: {pack.sovereignty.communityPartnership[:120]}"
              f"{'...' if len(pack.sovereignty.communityPartnership) > 120 else ''}")
    return 0


# ---------------------------------------------------------------------------
# repl
# ---------------------------------------------------------------------------

def cmd_repl(args: argparse.Namespace) -> int:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("error: ANTHROPIC_API_KEY is not set in the environment.", file=sys.stderr)
        return 2

    try:
        from anthropic import Anthropic  # imported lazily so validate/info don't require it
    except ImportError:
        print("error: the anthropic package is required for repl mode.", file=sys.stderr)
        print("       install it with: pip install anthropic", file=sys.stderr)
        return 2

    pack = load(args.pack_id)
    profile = LearnerProfile(
        level=args.level or _default_level(pack),
        goal=args.goal or _default_goal(pack),
        time_commitment=args.time or "30-60 minutes",
    )
    system_prompt = compose(pack, profile)

    print(f"=== REPL against {pack.displayName} ({pack.id}) ===")
    print(f"Tutor:    {pack.tutor.name}")
    print(f"Profile:  level={profile.level}  goal={profile.goal}  time={profile.time_commitment}")
    print(f"Model:    {args.model}")
    print(f"Dict ctx: {len(materialize_dictionary_context(pack))} chars")
    print("Type your message. Ctrl-D or 'exit' to quit.\n")

    client = Anthropic(api_key=api_key)
    history: list[dict] = []

    while True:
        try:
            user_msg = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user_msg or user_msg.lower() in {"exit", "quit"}:
            break
        history.append({"role": "user", "content": user_msg})
        response = client.messages.create(
            model=args.model,
            max_tokens=1024,
            system=system_prompt,
            messages=history,
        )
        assistant_text = response.content[0].text
        history.append({"role": "assistant", "content": assistant_text})
        print(f"\n{pack.tutor.name}> {assistant_text}\n")

    return 0


def _default_level(pack: LanguagePack) -> str:
    return pack.levels[0].id if pack.levels else "beginner"


def _default_goal(pack: LanguagePack) -> str:
    return pack.goals[0].id if pack.goals else "general"


# ---------------------------------------------------------------------------
# argparse wiring
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="language_pack",
        description="Validate, inspect, and chat with Chronos language packs.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_validate = sub.add_parser("validate", help="validate a pack against the schema (or all packs)")
    p_validate.add_argument("target", nargs="?", help="pack id or path; omit to validate all packs")
    p_validate.set_defaults(func=cmd_validate)

    p_info = sub.add_parser("info", help="print a pack's identity, dictionary stats, and sovereignty")
    p_info.add_argument("pack_id")
    p_info.set_defaults(func=cmd_info)

    p_repl = sub.add_parser("repl", help="open an interactive REPL against the pack via Anthropic")
    p_repl.add_argument("pack_id")
    p_repl.add_argument("--level", default=None)
    p_repl.add_argument("--goal", default=None)
    p_repl.add_argument("--time", default=None)
    p_repl.add_argument("--model", default="claude-haiku-4-5-20251001")
    p_repl.set_defaults(func=cmd_repl)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
