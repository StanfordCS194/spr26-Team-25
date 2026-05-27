# Grounding

Grounding is how a pack constrains the tutor to a known body of vocabulary. It is the single most important pack feature for endangered, dormant, and reconstructed languages — the cases where the underlying language model cannot be trusted to extrapolate.

This document covers two questions:

1. **Policy** — how strictly the tutor should defer to the dictionary (`grounding.policy`).
2. **Retrieval** — how dictionary content reaches the prompt (`grounding.retrieval`).

## Policy

```
grounding.policy: "open" | "prefer" | "strict"
```

| Policy | Behavior | When to use |
|---|---|---|
| `open` | Model extrapolates freely. Dictionary, if present, is reference material. | Vibrant, well-resourced languages (Modern Spanish, Mandarin). The model has rich training data; constraining it is unnecessary. |
| `prefer` | Model uses the dictionary first; fills in around it from training data, but flags fill-ins as such. | Mid-status languages: significant speaker community + good dictionaries + nontrivial gaps in model coverage. |
| `strict` | Model uses **only** what's in the dictionary. When asked about content outside it, the tutor says so honestly (using `grounding.uncertaintyPhrase`). | Endangered, dormant, reconstructed languages. Anything where wrong information would be worse than no information. |

Defaults derived from `status`:

- `vibrant` → `open`
- `endangered`, `dormant`, `reconstructed` → `strict`

Pack authors may override. The default is *opinionated* — strict-by-default for endangered languages reflects the ethical position that fabricating an endangered language is a harm, not a feature.

## Retrieval

```
grounding.retrieval: "none" | "inline-all" | "rag" | "exact-lookup"
```

| Retrieval | How it works | Scale | Status |
|---|---|---|---|
| `none` | No dictionary content reaches the prompt. | — | Default for packs without a dictionary. |
| `inline-all` | Every entry rendered into the `{dictionary_context}` placeholder. | Up to ~500 entries depending on entry size. | **Implemented in v1.** |
| `rag` | Embed entries, retrieve top-K against the learner's input each turn. | Thousands+. | Reserved; not implemented in v1. |
| `exact-lookup` | At request time, regex-match learner input against headwords and inject only matching entries. | Thousands+. | Reserved; not implemented in v1. |

### When to use `inline-all`

Small thematic vocabularies (the 31 Nahuatl colors, 41 Ojibwe starter entries) fit easily in the system prompt. Inline-all keeps the dictionary visible to the model for *every* turn, which matters because the learner may switch topics within a session and you don't want the model to "forget" earlier vocabulary.

Token cost: a 100-entry dictionary with morphology + IPA is roughly 3-5k tokens. For Claude Haiku 4.5, this is well under the per-message budget, and prompt caching makes the cost amortize across a session.

### When you'll need `rag` (future work)

Once a pack's dictionary exceeds ~500 entries, inline-all stops being practical. The Ojibwe People's Dictionary has thousands of entries; a real OPD-derived pack would need retrieval. v1 doesn't implement `rag` — it's a Phase 7+ concern that requires an embedding backend, a vector store, and per-turn retrieval logic. The schema reserves the field name so packs can declare their intent before the implementation lands.

### When you'd want `exact-lookup`

For dictionary-as-reference patterns: the learner asks "what does X mean?" and the system surfaces only the X entry (plus context). Cheap, scales arbitrarily, but loses the *teaching* mode where the tutor introduces new vocabulary proactively. Useful in combination with `inline-all` (small starter set always inlined; exact-lookup expands coverage on demand).

## How `{dictionary_context}` materializes

Under `retrieval: "inline-all"`, the placeholder resolves to:

```
- <word> [<ipa>] = <meaning>
- <word> [<ipa>] = <meaning>
...
```

One entry per line. IPA is included in brackets when the entry has it; omitted otherwise. The list is rendered in dictionary-source order — pack authors control ordering by ordering the `entries[]` array, which lets you put foundational words (basic colors, kinship, greetings) first.

This rendering is intentionally simple. A pack that wants richer rendering (e.g., examples per entry, dialect tags) can write a more elaborate prompt template that references `{dictionary_context}` and adds its own framing prose around it.

## `uncertaintyPhrase`

When `policy: "strict"`, the tutor's behavior in the unknown-word case is governed by `grounding.uncertaintyPhrase`. This is what the model says verbatim when asked about content outside the dictionary.

Default is generic. Pack authors should override with something that fits the tutor's voice and the language's community context:

- Nahuatl: `"That color isn't in my dictionary — let's stick with the ones I can teach you confidently."`
- Ojibwe: `"That word isn't in the dictionary I'm working from — let's stick with what I can teach you confidently, and you can check with a fluent speaker or the Ojibwe People's Dictionary."`

The Ojibwe phrasing is intentionally longer because it offers the learner a path forward (consult an authoritative source). For endangered languages, modeling "ask a fluent speaker" is itself pedagogy.

## Anti-patterns

- **Strict policy without a dictionary.** Validators won't catch this, but it makes the model unable to answer anything. Either provide a dictionary or use `open`/`prefer`.
- **Open policy on a reconstructed language.** The model will confidently make things up. Don't.
- **Treating `retrieval: "inline-all"` as free.** Token cost is real for large dictionaries. Profile before committing to it for 500+ entries.
- **Using `uncertaintyPhrase` as a confession of bad data.** It's a feature, not an apology — the honest "I don't know" is more valuable than a confident guess, especially for endangered languages where the learner may have no other resource.
