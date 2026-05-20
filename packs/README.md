# Chronos Language Packs

A **language pack** is a single JSON file that tells the Chronos tutor how to teach a language: who the tutor is, how to write the language, what the tutor knows, how strictly to defer to external sources, and under what license the data is shared.

Packs are isolated from the rest of the Chronos stack. The Greek app keeps working unchanged whether or not any pack is loaded. To add a new language, a contributor writes one file (plus an optional dictionary) — no code changes required.

## Repository layout

```
packs/
  schema.json                  JSON Schema (authoritative definition)
  ancient-greek.json           reference: vibrant language, no dictionary
  classical-nahuatl.json       reference: small inline dictionary
  ojibwe.json                  reference: polysynthetic, strict grounding
  ojibwe/dictionary.json       large dictionaries live in a sibling file
  ojibwe/LICENSE.md            per-pack license + attribution
  CONTRIBUTING.md              "add your language" walkthrough
  docs/
    overview.md                what a pack is, request lifecycle, mental model
    fields.md                  field-by-field reference
    grounding.md               dictionary grounding strategies (Phase 6)
    sovereignty.md             licensing, attribution, governance (Phase 6)
    pedagogy.md                writing effective prompt templates (Phase 6)
    examples.md                walkthroughs of the reference packs (Phase 6)
```

## Quick start: add a language in ten minutes

1. **Copy a template close to your case.**
   - Vibrant / well-resourced language (e.g. Modern Spanish): start from `ancient-greek.json`.
   - Endangered / dormant language requiring a dictionary: start from `classical-nahuatl.json`, then `ojibwe.json`.
2. **Edit identity fields**: `id`, `displayName`, `displayNameLocal`, `status`, `family`, `iso639`.
3. **Set the script.** Find the Unicode block(s) covering the writing system at [unicode.org/charts](https://www.unicode.org/charts/) and list them in `script.unicodeRanges`.
4. **Write the prompt template.** Borrow shape from `greek.json`. Use placeholders: `{tutor.name}`, `{displayName}`, `{learner.level}`, `{learner.goal}`, `{learner.time_commitment}`, `{level.guidance}`, `{goal.guidance}`, `{levels_menu}`, `{goals_menu}`, `{vocabulary.lineFormat}`, `{grounding.uncertaintyPhrase}`, `{dictionary_context}`.
5. **(Endangered/dormant only)** Add `grounding.policy: "strict"` and either an inline `grounding.dictionary` or a `grounding.dictionaryRef` to a sibling JSON file.
6. **Declare sovereignty.** Pick a license (SPDX identifier preferred). For community-owned data, include `attribution`, `contact`, `restrictions`, and `communityPartnership` describing your partnership status.
7. **Validate**:
   ```
   bash scripts/validate-packs.sh            # validates every pack in packs/
   cd backend && python3 -m language_pack validate <your-id>
   cd backend && python3 -m language_pack info <your-id>
   ```

   For an interactive REPL against the pack (requires `ANTHROPIC_API_KEY`):
   ```
   cd backend && python3 -m language_pack repl <your-id>
   ```

For the full step-by-step walkthrough, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Mental model in one paragraph

A pack is **data**, not code. The backend loader reads the JSON, merges in schema defaults, resolves the dictionary if separate, and produces a typed pack object. The prompt composer takes that pack plus a learner's profile (level, goal, time commitment) and produces a system prompt string. The vocabulary extractor builds a regex from `script.unicodeRanges` and `vocabulary.lineFormat` and pulls structured entries from the model's response. The grounding layer decides whether and how to inject the dictionary into the prompt. None of these components are language-specific — adding a new language never touches Python or TypeScript.

## Status

Built in six phases. Phases 1–5 are complete:

- **Phase 1** — schema + Greek/Nahuatl reference packs + skeleton docs.
- **Phase 2** — backend loader, prompt composer, vocabulary extractor (`backend/language_pack/`).
- **Phase 3** — frontend types, loader, registry (`frontend/lib/language-pack/`).
- **Phase 4** — Ojibwe pack with referenced dictionary and polysynthesis support.
- **Phase 5** — CLI (`python3 -m language_pack {validate, info, repl}`), CI lint, CONTRIBUTING.md.
- **Phase 6** — full documentation polish.

See [docs/overview.md](./docs/overview.md) for the architecture and [docs/fields.md](./docs/fields.md) for the full field reference. Walkthrough for adding a language: [CONTRIBUTING.md](./CONTRIBUTING.md).
