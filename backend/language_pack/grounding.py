"""Materialize the {dictionary_context} placeholder per the pack's grounding strategy.

Strategies (grounding.retrieval):
  none          -> empty string (vibrant languages with no dictionary).
  inline-all    -> all entries rendered as a list, inlined directly into the system prompt.
                   Suitable for dictionaries up to ~500 entries.
  rag           -> NotImplemented in v1. Will embed entries and retrieve top-K against learner input.
  exact-lookup  -> NotImplemented in v1. Will regex-match learner input against the dictionary at request time.

For inline-all, entries render as: '<word> [<ipa>] = <meaning>' if ipa is set, else '<word> = <meaning>'.
"""

from __future__ import annotations

from .models import DictionaryEntry, LanguagePack


def materialize_dictionary_context(pack: LanguagePack) -> str:
    retrieval = pack.grounding.retrieval
    if retrieval == "none":
        return ""
    if retrieval == "inline-all":
        return _render_inline_all(pack)
    if retrieval == "rag":
        raise NotImplementedError("grounding.retrieval='rag' is reserved for a later phase.")
    if retrieval == "exact-lookup":
        raise NotImplementedError("grounding.retrieval='exact-lookup' is reserved for a later phase.")
    raise ValueError(f"Unknown grounding.retrieval: {retrieval}")


def _render_inline_all(pack: LanguagePack) -> str:
    if pack.grounding.dictionary is None:
        return ""
    lines = [_render_entry(e) for e in pack.grounding.dictionary.entries]
    return "\n".join(lines)


def _render_entry(entry: DictionaryEntry) -> str:
    head = entry.word
    if entry.ipa:
        head = f"{head} [{entry.ipa}]"
    return f"- {head} = {entry.meaning}"
