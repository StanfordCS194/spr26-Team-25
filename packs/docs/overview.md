# Overview

## What a pack is

A **language pack** is a declarative JSON file describing one language the Chronos tutor can teach. A pack contains everything a tutor needs at runtime that varies per language:

- **Identity** — slug, display names, vitality status, language family
- **Script** — Unicode ranges that constitute the writing system, direction
- **Vocabulary form** — how the tutor introduces new words in text
- **Tutor persona** — name, short biography, default response length, correction style
- **Pedagogy** — learner levels and goals, each with free-form guidance prose
- **Prompt template** — the system prompt with placeholders for learner profile and pack data
- **Grounding** — optional dictionary and policy for how strictly to defer to it
- **Voice** — optional TTS configuration, with explicit support for "no native TTS exists"
- **Sovereignty** — license, attribution, restrictions, community partnership status

Everything in a pack is data. Adding a new language never requires writing Python or TypeScript.

## What consumes a pack

| Consumer | Responsibility | Phase |
|---|---|---|
| `backend/language_pack/loader.py` | Read JSON, validate against schema, merge defaults, resolve `dictionaryRef`. | 2 |
| `backend/language_pack/prompt.py` | Substitute placeholders in `promptTemplate` using a learner profile to produce a system prompt string. | 2 |
| `backend/language_pack/extraction.py` | Build a vocabulary-extraction regex from `script.unicodeRanges` + `vocabulary.lineFormat`. Replaces today's hardcoded Greek regex. | 2 |
| `backend/language_pack/grounding.py` | Inject dictionary content into the prompt according to `grounding.retrieval`. | 2 |
| `frontend/lib/language-pack/loader.ts` | Load packs in the browser for display and (eventually) language selection. | 3 |
| `frontend/lib/language-pack/registry.ts` | Enumerate available packs. Future language picker reads from this. | 3 |
| `backend/language_pack/cli.py` | `validate`, `info`, `repl` — runnable harness, CI lint. | 5 |

The existing `/api/chat`, `app/page.tsx`, and the `/tutor/*` routes are unchanged. The pack interface is opt-in; nothing breaks if no pack is loaded.

## Request lifecycle (Phase 2 onward, when chat.py opts in)

```
┌──────────────────────────────────────────────────────────────────┐
│  packs/greek.json + packs/nahuatl.json + packs/ojibwe.json       │
│                          (on disk)                               │
└─────────────────────────────┬────────────────────────────────────┘
                              │ loader.load("ancient-greek")
                              ▼
                  ┌───────────────────────┐
                  │   LanguagePack        │   (pydantic / typed)
                  │  - identity           │
                  │  - script             │
                  │  - tutor              │
                  │  - levels / goals     │
                  │  - promptTemplate     │
                  │  - grounding          │
                  │  - sovereignty        │
                  └──┬────────────────────┘
                     │
   ┌─────────────────┼──────────────────────────┐
   │                 │                          │
   ▼                 ▼                          ▼
prompt.compose   extraction.build_regex   grounding.materialize
(pack, learner) (pack)                    (pack) -> dict_context
   │                 │                          │
   ▼                 ▼                          ▼
system_prompt    vocab_regex               injected via
   │             (used after the           {dictionary_context}
   ▼              LLM response)            placeholder
Anthropic API
```

## Why this shape

**Declarative beats imperative.** A contributor adding a language should not have to learn a Python module's internals. JSON with rich `description` fields surfaces in IDE tooltips.

**Defaults make small packs tiny.** A vibrant language with no dictionary needs ~6 fields. The same schema accommodates a dormant language with a 500-entry dictionary because all the heavy fields default sensibly when omitted.

**Sovereignty is first-class, not a metadata afterthought.** The Cherokee Nation's August 2025 AI policy mandates fluent-speaker partnership for any AI use of Cherokee. Other communities have similar protocols. The `sovereignty` block is required; it surfaces governance instead of hiding it in a README.

**Dictionary grounding is the niche-language story.** A pack with `grounding.policy: "strict"` plus an inline dictionary directly addresses the case where the LLM cannot be trusted to extrapolate — exactly when external sources are most important.

## When NOT to use packs

- Voice-mode-only concerns (live captioning format, LiveKit room setup) — these belong with the voice agent in `backend/agent.py`. A pack provides persona and dictionary; the voice agent decides how to surface them.
- One-off prompt experiments — packs are versioned, durable artifacts. Throwaway prompt tweaks belong in a feature branch on the existing Greek prompt.
- Tooling outside the runtime tutor — the offline `pipeline/` (Quechua corpus prep) is a sibling concept that may produce a dictionary file the pack then consumes, but the pipeline is not itself a pack.
