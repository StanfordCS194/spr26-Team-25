# Adding a language to Chronos

This walkthrough goes from "I want to add language X" to "the validator accepts my pack" in about ten minutes. It assumes you have the repo checked out and can run `python3` and `node`.

## What you'll touch

For a new pack with id `<your-id>` you create one or two files:

```
packs/<your-id>.json                 always
packs/<your-id>/dictionary.json      only if you ship a separate dictionary
packs/<your-id>/LICENSE.md           only if the dictionary's license/attribution differs from MIT
```

And append one entry to:

```
frontend/lib/language-pack/registry.ts
```

That's it. You do not edit Python or TypeScript code.

## Step 1 — pick your starting template

| If your language is... | Start from |
|---|---|
| Vibrant / well-documented (e.g. Modern Spanish, Hindi) | `packs/ancient-greek.json` — no dictionary, `policy: "open"` |
| Endangered with a small curated vocabulary | `packs/classical-nahuatl.json` — inline `grounding.dictionary` |
| Endangered/dormant with a larger dictionary | `packs/ojibwe.json` — `dictionaryRef` to a sibling JSON file |

Copy your starting pack to `packs/<your-id>.json` and start editing.

## Step 2 — identity

Pick a stable id slug (lowercase, hyphens, no language version number). Examples: `modern-spanish`, `lakota`, `wopanaak`. The id is a contract — never change it after publication.

```json
"id": "your-id",
"displayName": "Your Language",
"displayNameLocal": "<endonym in the language's own script>",
"status": "vibrant" | "endangered" | "dormant" | "reconstructed",
"family": "Indo-European",
"iso639": "<ISO 639-3 code if assigned>"
```

`status` is the most important field on this list — it drives default grounding behavior. Be honest. A language with 100k speakers but most under age 5 is `endangered`, not `vibrant`.

## Step 3 — script

```json
"script": {
  "primary": "Latn-fiero",
  "unicodeRanges": ["U+0041-U+007A", "U+00C0-U+017F"],
  "direction": "ltr"
}
```

Find the Unicode block(s) covering your writing system at [unicode.org/charts](https://www.unicode.org/charts/). List every block your vocabulary uses. The pack's vocabulary-extraction regex is built from this list — too narrow and entries won't extract; too wide and false positives leak in.

## Step 4 — tutor and pedagogy

```json
"tutor": {
  "name": "Your tutor's name",
  "personaShort": "One sentence describing who they are."
},
"levels": [
  { "id": "beginner", "guidance": "..." },
  { "id": "intermediate", "guidance": "..." }
],
"goals": [
  { "id": "your-goal", "label": "Human label", "guidance": "What this means pedagogically" }
]
```

Levels and goals are free-form. You decide whether your language has three tiers, two, or one. The `guidance` strings are injected into the prompt verbatim when a learner selects that level/goal, so write them as instructions to the model.

## Step 5 — prompt template

Use `{tutor.name}`, `{displayName}`, `{displayNameLocal}`, `{learner.level}`, `{learner.goal}`, `{learner.time_commitment}`, `{level.guidance}`, `{goal.guidance}`, `{vocabulary.lineFormat}`, `{grounding.uncertaintyPhrase}`, and `{dictionary_context}` where needed.

Borrow the shape from `packs/ojibwe.json` (placeholder-driven) or `packs/ancient-greek.json` (literal inline). Both compose cleanly.

## Step 6 — dictionary (if your language needs one)

Two ways to attach a dictionary:

**Inline** (works for up to ~50 entries):

```json
"grounding": {
  "policy": "strict",
  "retrieval": "inline-all",
  "dictionary": {
    "entries": [
      { "word": "...", "meaning": "...", "ipa": "..." }
    ]
  }
}
```

**Referenced** (for 50+ entries):

```json
"grounding": {
  "policy": "strict",
  "retrieval": "inline-all",
  "dictionaryRef": "./<your-id>/dictionary.json"
}
```

Put the dictionary in `packs/<your-id>/dictionary.json` with shape `{"entries": [...]}`.

### What goes in each entry

Required: `word`, `meaning`. Strongly encouraged for endangered languages: `ipa`, `provenance.source`, `provenance.url`. For polysynthetic languages: `morphology.segments` using Leipzig glossing (`{form, gloss}` per morpheme — see `packs/ojibwe/dictionary.json`).

```json
{
  "word": "headword in native script",
  "meaning": "English gloss",
  "ipa": "phonetic transcription",
  "partOfSpeech": "free-form",
  "morphology": {
    "segments": [
      { "form": "ni-", "gloss": "1SG.POSS" },
      { "form": "stem", "gloss": "stem-meaning" }
    ]
  },
  "examples": [{ "target": "native sentence", "english": "translation" }],
  "audioUrl": "https://...",
  "provenance": {
    "source": "Authoritative dictionary name",
    "url": "https://...",
    "verified": false
  }
}
```

## Step 7 — sovereignty (required)

```json
"sovereignty": {
  "license": "MIT" | "CC-BY-NC-SA-3.0" | "community-controlled" | ...,
  "attribution": "If your dictionary requires attribution, the exact string to display",
  "contact": "Email or URL for permission requests / corrections",
  "restrictions": ["non-commercial", "attribution-required"],
  "communityPartnership": "A statement of your partnership status with the language community."
}
```

This block is required. For community-stewarded languages, fill it carefully — the UI will surface the attribution. For an open language with no specific community gate, `{"license": "MIT"}` is enough.

If your dictionary comes from a community-controlled source (e.g. a tribal language program, a research project), include a sibling `packs/<your-id>/LICENSE.md` with the full license text, attribution, contact, and community partnership statement. See `packs/ojibwe/LICENSE.md` for a working example.

## Step 8 — validate

```
bash scripts/validate-packs.sh
```

This runs the schema validator + pydantic loader against every pack in `packs/`. If your pack is well-formed, you'll see your id in the success list. If not, you'll get a structured error.

To validate just your pack:

```
cd backend && python3 -m language_pack validate <your-id>
```

To see a summary:

```
cd backend && python3 -m language_pack info <your-id>
```

To open a REPL against your pack (requires `ANTHROPIC_API_KEY`):

```
cd backend && python3 -m language_pack repl <your-id>
```

## Step 9 — register on the frontend

Append an entry to `frontend/lib/language-pack/registry.ts`:

```ts
{
  id: 'your-id',
  displayName: 'Your Language',
  displayNameLocal: '...',
  status: 'endangered',
  family: '...',
  url: '/packs/your-id.json',
}
```

The url assumes your pack will be served from Next.js's `/public/packs/` route. If your deployment serves packs from a different origin, point at it directly.

## Common patterns

- **Vibrant language, no dictionary**: `status: vibrant`, no `grounding.dictionary*`, prompt template can use literal levels/goals enumeration like the Greek pack.
- **Endangered with a small thematic vocabulary**: inline `grounding.dictionary.entries`, `grounding.retrieval: inline-all`, `grounding.policy: strict`. Pattern matches `classical-nahuatl.json`.
- **Endangered or dormant with a richer dictionary**: `grounding.dictionaryRef: "./<id>/dictionary.json"` pointing at a sibling JSON file. Add provenance per entry. Pattern matches `ojibwe.json`.
- **Reconstructed language**: `status: reconstructed`, explicit `sovereignty.communityPartnership` describing the source materials and any community endorsement. Mark every entry with `provenance.source` citing the historical text.

## When you get stuck

- `python3 -m language_pack validate <pack>` is verbose on the failing field.
- The authoritative type definitions are in `packs/schema.json` — every field has a `description` that surfaces in your editor as a tooltip.
- `packs/docs/fields.md` has a human-readable field reference.
- For pedagogy questions, `packs/docs/pedagogy.md` covers the design of prompt templates.
