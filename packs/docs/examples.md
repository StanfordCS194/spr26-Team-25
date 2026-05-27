# Example packs

The three reference packs in this repository are picked deliberately to cover the three patterns most new languages will fall into. This document walks through each one with the specific design decisions called out.

## Ancient Greek (`packs/ancient-greek.json`) — vibrant, no dictionary

**Pattern**: classical language with rich open scholarship, no living speaker community, no need for dictionary grounding.

**Key choices:**

- `status: "vibrant"` — classical Greek scholarship is mature and well-resourced; the model has good training data here.
- `grounding.policy: "open"` (default from status) — the model is allowed to extrapolate; this is the case where a hand-curated dictionary would be redundant.
- `grounding.retrieval: "none"` (default) — `{dictionary_context}` resolves to empty string in the prompt.
- `script.unicodeRanges: ["U+0370-U+03FF", "U+1F00-U+1FFF"]` — Greek + Greek Extended. Excluding Greek Extended would miss most polytonic accentuation.
- `vocabulary.lineFormat: "{word} ({translit}) = {meaning}"` — preserves today's format.
- Prompt template uses the **inline menu** style: levels and goals are enumerated as literal prose in the template. Why? This pack is a 1:1 reproduction of the prompt that's in production today. The `levels[]` and `goals[]` arrays exist as data (so a UI can list them), but the prompt template doesn't reference them. Both styles compose cleanly; this one happens to be the lower-risk migration.
- `sovereignty: "MIT"` with a community partnership statement explaining that Ancient Greek has no living speaker community to consult, so the partnership question is "draw from established philological scholarship."

**What this pack stress-tests in the schema:** nothing — it's the canonical "easy case." If a pack format can't express this, it's broken.

## Classical Nahuatl (`packs/classical-nahuatl.json`) — endangered, small inline dictionary

**Pattern**: a thematic vocabulary (color words) curated by the team's own parser, small enough to inline entirely in the system prompt.

**Key choices:**

- `status: "endangered"` — Classical Nahuatl is a historical literary register; Modern Nahuatl variants exist with living communities. The choice reflects "we should ground this carefully."
- `grounding.policy: "strict"` — only the dictionary's 31 colors are valid; tutor must not invent.
- `grounding.retrieval: "inline-all"` — entire dictionary in every prompt.
- `grounding.dictionary.entries` is inline (not `dictionaryRef`) — 31 entries is small enough that an external file would be ceremony.
- Prompt template uses the **placeholder-driven** style with `{level.guidance}` and `{goal.guidance}` injected per selection.
- `voice.provider: "none"` with `fallbackVoice` declaring English (en-US) as the approximate-language voice and a rationale field explaining why. This is the "no native TTS exists" pattern.

**What this pack stress-tests in the schema:**

- Inline dictionary representation (`grounding.dictionary.entries`).
- `inline-all` retrieval strategy.
- Strict-grounding-with-uncertainty: `{grounding.uncertaintyPhrase}` substitution.
- Fallback voice declaration with rationale.

## Ojibwe (`packs/ojibwe.json` + `packs/ojibwe/dictionary.json`) — polysynthetic, referenced dictionary

**Pattern**: endangered language with structural complexity (polysynthesis), authoritative external dictionary (Ojibwe People's Dictionary), and non-trivial sovereignty considerations.

**Key choices:**

- `status: "endangered"` — driving force for strict grounding and required community partnership statement.
- `grounding.dictionaryRef: "./ojibwe/dictionary.json"` — pack body stays small; dictionary lives in a sibling file. Once entries grow past ~50, this is the pattern.
- `grounding.policy: "strict"` (authored explicitly even though it's the default for endangered status) — explicit beats implicit when the constraint matters.
- `script.unicodeRanges: ["U+0041-U+007A", "U+00C0-U+017F"]` — the Fiero double-vowel system uses Latin + Latin Extended-A for the few diacritics that appear (e.g. the ' apostrophe is in ASCII).
- Dictionary entries carry **`morphology.segments`** with Leipzig-style glossing. Example:
  ```json
  {
    "word": "nimaamaa",
    "meaning": "my mother",
    "morphology": {
      "segments": [
        { "form": "ni-",     "gloss": "1SG.POSS" },
        { "form": "maamaa",  "gloss": "mother"   }
      ]
    }
  }
  ```
  This is the polysynthesis story in one entry: the headword *nimaamaa* isn't a unitary word — it composes the 1SG-possessive prefix *ni-* with the dependent root *maamaa*. A tutor that exposes this structure teaches the learner to read inflected forms they haven't seen before.
- `sovereignty.license: "CC-BY-NC-SA-3.0"` matching the upstream OPD license; full `attribution` string with URL; `restrictions: ["non-commercial", "attribution-required", "share-alike"]`; substantial `communityPartnership` statement.
- A sibling `packs/ojibwe/LICENSE.md` carries the long-form license, attribution, status of bundled entries, and corrections process.
- Every dictionary entry currently has `provenance.verified: false` — the pack honestly declares that fluent-speaker verification is pending.

**What this pack stress-tests in the schema:**

- `dictionaryRef` resolution.
- `morphology.segments` (the polysynthesis extension).
- Per-entry `provenance` with `verified` flag.
- Full `sovereignty` block including `attribution`, `restrictions`, `communityPartnership`.
- Sibling LICENSE.md pattern.

## What's not yet a reference pack

Some shapes worth building before declaring the schema "done":

- **A pack with a non-Latin syllabary** (Cherokee, Inuktitut). Would stress-test the Unicode ranges field beyond Greek's bicameral case. Cherokee is appealing for the syllabary itself but requires Cherokee Nation partnership per their Aug 2025 AI policy — see `docs/sovereignty.md`. Inuktitut syllabics + Roman dual orthography would be a cleaner first non-Latin example.
- **A reconstructed language pack** (e.g. Proto-Indo-European, reconstructed Wampanoag). Would exercise `status: "reconstructed"` and force the sovereignty discussion all the way through.
- **A pack with `audioUrl` populated**. The three current packs don't include audio URLs because we haven't licensed any. A pack that does — even just 10 entries with community-hosted recordings — would prove `audioPerEntry: true` and the planned UI integration.

These are good targets for "second wave" packs after the foundation is in production use.
