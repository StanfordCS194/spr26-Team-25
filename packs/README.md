# Chronos Language Packs

A **language pack** is a single JSON file that tells the Chronos tutor how to teach a language: who the tutor is, how to write the language, what the tutor knows, how strictly to defer to external sources, and under what license the data is shared.

Packs are isolated from the rest of the Chronos stack. The Greek app keeps working unchanged whether or not any pack is loaded. To add a new language, a contributor writes one file (plus an optional dictionary) — no code changes required.

## Repository layout

```
packs/
  schema.json                  JSON Schema (authoritative definition)
  greek.json                   reference: vibrant language, no dictionary
  nahuatl.json                 reference: small inline dictionary
  ojibwe.json                  reference: polysynthetic, strict grounding (Phase 4)
  ojibwe/dictionary.json       large dictionaries live in a sibling file
  ojibwe/LICENSE.md            per-pack license + attribution
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
   - Vibrant / well-resourced language (e.g. Modern Spanish): start from `greek.json`.
   - Endangered / dormant language requiring a dictionary: start from `nahuatl.json` once it exists, then `ojibwe.json`.
2. **Edit identity fields**: `id`, `displayName`, `displayNameLocal`, `status`, `family`, `iso639`.
3. **Set the script.** Find the Unicode block(s) covering the writing system at [unicode.org/charts](https://www.unicode.org/charts/) and list them in `script.unicodeRanges`.
4. **Write the prompt template.** Borrow shape from `greek.json`. Use placeholders: `{tutor.name}`, `{displayName}`, `{learner.level}`, `{learner.goal}`, `{learner.time_commitment}`, `{level.guidance}`, `{goal.guidance}`, `{levels_menu}`, `{goals_menu}`, `{vocabulary.lineFormat}`, `{grounding.uncertaintyPhrase}`, `{dictionary_context}`.
5. **(Endangered/dormant only)** Add `grounding.policy: "strict"` and either an inline `grounding.dictionary` or a `grounding.dictionaryRef` to a sibling JSON file.
6. **Declare sovereignty.** Pick a license (SPDX identifier preferred). For community-owned data, include `attribution`, `contact`, `restrictions`, and `communityPartnership` describing your partnership status.
7. **Validate** (Phase 5):
   ```
   python -m chronos.language_pack validate packs/your-language.json
   ```

## Mental model in one paragraph

A pack is **data**, not code. The backend loader reads the JSON, merges in schema defaults, resolves the dictionary if separate, and produces a typed pack object. The prompt composer takes that pack plus a learner's profile (level, goal, time commitment) and produces a system prompt string. The vocabulary extractor builds a regex from `script.unicodeRanges` and `vocabulary.lineFormat` and pulls structured entries from the model's response. The grounding layer decides whether and how to inject the dictionary into the prompt. None of these components are language-specific — adding a new language never touches Python or TypeScript.

## Status

This foundation is being built in six phases. The current state is **Phase 1**: schema + reference packs + skeleton docs. Loaders, the CLI harness, and full documentation arrive in later phases.

See `docs/overview.md` for the architecture and `docs/fields.md` for a full field reference.
