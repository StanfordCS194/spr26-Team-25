# Field reference

Authoritative definition: [`packs/schema.json`](../schema.json). This page is human-readable narrative; the schema is the source of truth and what loaders validate against.

For every field below: **R** = required, **O** = optional, default value shown when relevant.

## Top-level

| Field | Type | R/O | Notes |
|---|---|---|---|
| `$schema` | string | O | Pointer to the schema (typically `"./schema.json"`). Enables IDE field hints. |
| `id` | string slug | **R** | Lowercase letters, digits, hyphens. Stable identifier — used in URLs, file paths, registry keys. Don't change after publication. |
| `schemaVersion` | string | O (`"1.0"`) | Pack schema version this file targets. Loaders may refuse incompatible versions. |
| `version` | string | O | Pack version. Bump when prompt, dictionary, or pedagogy change meaningfully. |
| `displayName` | string | **R** | English name (e.g. `"Ancient Greek"`). |
| `displayNameLocal` | string | O | Endonym in the language's own script (e.g. `"Ἑλληνική"`, `"Anishinaabemowin"`). Strongly encouraged. |
| `status` | enum | **R** | One of `vibrant`, `endangered`, `dormant`, `reconstructed`. Drives default grounding policy. |
| `family` | string | O | Language family. Informational. |
| `dialect` | string | O | Specific variety covered. |
| `iso639` | string | O | ISO 639-3 code if assigned. |

## `script` (R)

| Field | Type | R/O | Notes |
|---|---|---|---|
| `primary` | string | O | ISO 15924 tag or descriptive label (e.g. `"Grek"`, `"Cher"`, `"Latn-fiero"`). |
| `unicodeRanges` | array of `"U+XXXX-U+YYYY"` strings | **R** | At least one. Used to build the vocabulary-extraction regex. Find ranges at [unicode.org/charts](https://www.unicode.org/charts/). |
| `direction` | enum | O (`"ltr"`) | `ltr` or `rtl`. |

## `vocabulary` (O)

How the tutor introduces vocabulary in text, and how the extractor finds it afterward.

| Field | Type | R/O | Notes |
|---|---|---|---|
| `lineFormat` | string | O | Template using `{word}`, `{translit}`, `{meaning}`. Defaults to `"{word} ({translit}) = {meaning}"` when `transliterationScheme != "none"`, else `"{word} = {meaning}"`. |
| `transliterationScheme` | enum | O (`"none"`) | `none`, `ipa`, `romanization`, `both`. Shown to the model; drives default `lineFormat`. |

## `tutor` (R)

| Field | Type | R/O | Notes |
|---|---|---|---|
| `name` | string | **R** | Tutor's name (e.g. `"Chronos"`, `"Citlali"`). |
| `personaShort` | string | **R** | One-sentence persona for the prompt. |
| `welcomeGreeting` | string | O | Auto-greeting on session start. |
| `correctionStyle` | enum | O (`"gentle-restate"`) | `gentle-restate`, `direct`, or `socratic`. |
| `responseLength` | enum | O (`"balanced"`) | `concise`, `balanced`, or `thorough`. May be overridden in the prompt template. |

## `levels` (O)

Free-form proficiency tiers. If omitted, loaders use generic beginner/intermediate/advanced placeholders.

| Field | Type | R/O | Notes |
|---|---|---|---|
| `id` | string | **R** | Slug used to select the level. |
| `label` | string | O | Human label for UI. |
| `guidance` | string | **R** | Pedagogical instructions injected into the prompt via `{level.guidance}` when this level is selected. |

## `goals` (O)

Same shape as `levels`, with `label` required (goals are shown to learners verbatim in UI).

## `promptTemplate` (R)

System prompt string with substitution placeholders. Supported placeholders:

| Placeholder | Resolves to |
|---|---|
| `{tutor.name}`, `{tutor.personaShort}` | Fields from `tutor`. |
| `{displayName}`, `{displayNameLocal}` | Top-level identity fields. |
| `{learner.level}`, `{learner.goal}`, `{learner.time_commitment}` | Values from the learner profile passed at compose time. |
| `{level.guidance}`, `{goal.guidance}` | The `guidance` string of the currently selected level/goal. |
| `{levels_menu}`, `{goals_menu}` | Rendered enumeration of all entries from `levels[]` / `goals[]`. |
| `{vocabulary.lineFormat}` | Resolved `vocabulary.lineFormat` string. |
| `{grounding.uncertaintyPhrase}` | The phrase to use when content is outside the dictionary. |
| `{dictionary_context}` | Dictionary content injected per `grounding.retrieval`. Empty string when no dictionary. |

Unknown placeholders are left literal. Two equivalent styles for level/goal menus:

- **Inline literal** (Greek's approach): the prompt template enumerates levels and goals as literal prose; `levels[]`/`goals[]` exist as UI metadata.
- **Placeholder-driven** (Ojibwe's approach): the prompt uses `{level.guidance}`/`{goal.guidance}` (or `{levels_menu}`/`{goals_menu}`); the arrays drive what the model sees.

Both compose cleanly. Pick whichever matches how separable you want pedagogy data from prose.

## `grounding` (O)

| Field | Type | R/O | Notes |
|---|---|---|---|
| `policy` | enum | O | `open`, `prefer`, or `strict`. Defaults: `vibrant -> open`, all others -> `strict`. |
| `retrieval` | enum | O (`"none"`) | `none`, `inline-all`, `rag`, or `exact-lookup`. `rag` is reserved for a future phase. |
| `dictionaryRef` | string path | O | Relative path to a sibling dictionary JSON file. Use when entries grow beyond a few dozen. |
| `dictionary` | object | O | Inline dictionary with an `entries` array. Mutually exclusive with `dictionaryRef`. |
| `uncertaintyPhrase` | string | O | What the tutor says when asked about content outside the dictionary under strict grounding. |

### Dictionary entry shape (`DictionaryEntry`)

| Field | Type | R/O | Notes |
|---|---|---|---|
| `word` | string | **R** | Headword in primary script. |
| `meaning` | string | **R** | English gloss. |
| `translit` | string \| null | O | Romanization if relevant. |
| `ipa` | string | O | IPA transcription. |
| `partOfSpeech` | string | O | Free-form (e.g. `"verb (animate intransitive)"`). |
| `morphology.segments[]` | array | O | Leipzig-style morpheme breakdown. `{form, gloss}` per segment. Critical for polysynthetic languages. |
| `examples[]` | array | O | `{target, english}` pairs. |
| `dialect` | string | O | When packs span multiple varieties. |
| `audioUrl` | URL | O | URL to a recorded pronunciation. Prefer community-hosted URLs. |
| `provenance` | object | O | `{source, url, contributor, date, verified}`. Citing where the entry came from. |

## `voice` (O)

| Field | Type | R/O | Notes |
|---|---|---|---|
| `provider` | enum | O (`"none"`) | `none`, `google-tts`, `elevenlabs`, `azure`, or `recorded`. `none` is honest when no TTS exists for the language. |
| `voice` | string | O | Provider-specific voice identifier (e.g. `"el-GR-Wavenet-A"`). |
| `languageCode` | string | O | BCP-47 tag passed to the TTS provider. |
| `fallbackVoice` | object | O | Approximate-language voice when no native TTS exists. Has `provider`, `voice`, `languageCode`, `rationale`. |
| `audioPerEntry` | boolean | O (`false`) | True if dictionary entries carry their own `audioUrl`. UI can play these alongside or instead of TTS. |

## `sovereignty` (R)

| Field | Type | R/O | Notes |
|---|---|---|---|
| `license` | string | **R** | SPDX identifier (`"MIT"`, `"CC-BY-NC-SA-3.0"`) or custom string (`"community-controlled"`). |
| `attribution` | string | O | Text/URL that must accompany surfaced content. The UI surfaces this. |
| `contact` | string | O | Point of contact for permission requests, corrections, or community questions. |
| `restrictions` | array of strings | O | Free-form tags (e.g. `"non-commercial"`, `"no-redistribution"`). |
| `communityPartnership` | string | O | Statement of partnership status. Required when targeting endangered/dormant/reconstructed languages for public deployment. |

## Common patterns

**Vibrant, well-resourced** (Greek, Spanish, Japanese): `status: vibrant`, no `grounding.dictionary`, `grounding.policy` defaults to `open`. The prompt template can enumerate levels/goals as literal text.

**Endangered with small curated vocabulary** (Nahuatl colors): `status: endangered`, `grounding.policy: strict`, `grounding.retrieval: inline-all`, inline `grounding.dictionary` with 20–100 entries.

**Endangered with full dictionary** (Ojibwe, Lakota, Cherokee): `status: endangered`, `grounding.policy: strict`, `grounding.retrieval: inline-all` for the curated starter set or `rag` once that lands, with `dictionaryRef` pointing to a sibling JSON file.

**Reconstructed / dormant** (Wampanoag, Old Norse, reconstructed proto-languages): `status: reconstructed` or `dormant`, `grounding.policy: strict`, explicit `sovereignty.communityPartnership` describing the source materials and any community endorsement.
