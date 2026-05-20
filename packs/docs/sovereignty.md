# Sovereignty

Language data is not neutral. For endangered, dormant, and community-stewarded languages, decisions about who gets to teach, distribute, and modify a language's vocabulary are decisions language communities themselves have a right to make. The pack format's `sovereignty` block is the place where those decisions are recorded.

This is a required block, not metadata. The validator will refuse packs that don't declare a license.

## Why first-class

The motivating example: in **August 2025, the Cherokee Nation signed its first AI policy**, codifying that:

- Any AI use of Cherokee must receive backing from Cherokee-fluent speakers.
- An AI governance committee approves, prohibits, or limits proposed uses.
- "When it comes to the Cherokee language, Cherokee speakers must always be at the helm of any decisions of AI use involving the Cherokee language that would help perpetuate learning or preserve the spoken language."

A pack format that buries this kind of policy in a README would let it be ignored. Making `sovereignty` a required, structured field surfaces it: any UI showing a pack must have read the field, and the validator forces pack authors to think about it before publishing.

## The fields

```json
"sovereignty": {
  "license": "CC-BY-NC-SA-3.0",
  "attribution": "© The Ojibwe People's Dictionary. https://ojibwe.lib.umn.edu/",
  "contact": "https://ojibwe.lib.umn.edu/",
  "restrictions": ["non-commercial", "attribution-required", "share-alike"],
  "communityPartnership": "Educational MVP; production deployment requires consultation with OPD editors."
}
```

| Field | Required | What goes here |
|---|---|---|
| `license` | **Yes** | SPDX identifier (`MIT`, `CC-BY-NC-SA-3.0`, `Apache-2.0`) or descriptive string (`community-controlled`). |
| `attribution` | If license requires it | Verbatim text + URL the UI must surface for any entry shown. |
| `contact` | If applicable | Email or URL for permission requests, corrections, governance questions. |
| `restrictions` | If applicable | Free-form tags: `non-commercial`, `no-redistribution`, `attribution-required`, `community-approved-uses-only`, etc. Tags should be readable by humans, not parsed into a fixed enum. |
| `communityPartnership` | Required for endangered/dormant/reconstructed | Short statement of partnership status. Be specific about who, what, and how. |

## License options

| License | When it fits | Limits |
|---|---|---|
| `MIT`, `Apache-2.0`, `BSD-3-Clause` | Pack content you authored from scratch + the language is widely documented in open sources (Ancient Greek, Latin, Old English from the Bosworth-Toller corpus). | None — anyone can use, modify, redistribute, monetize. |
| `CC-BY-NC-SA-3.0` / `CC-BY-NC-SA-4.0` | Pack content drawn from a non-commercial-licensed community source (Ojibwe People's Dictionary, Wiktionary, many academic lexicons). | Cannot monetize without re-licensing. Derivative works must adopt the same license. |
| `CC-BY-SA-4.0` | Open-with-attribution + share-alike. Common for Wikipedia-derived data. | Derivative works must adopt the same license. |
| `community-controlled` | The language community has specific protocols and the license isn't a standard SPDX (e.g. Indigenous data sovereignty arrangements). | Document exactly what's allowed in `restrictions` and `communityPartnership`. |

When in doubt, ask the upstream source. "I assume this is fine" is not a license.

## Community partnership — what to write

The `communityPartnership` field is freeform but should answer three questions:

1. **What is the partnership status today?** Educational MVP / coordinated demo / production-blessed.
2. **Who maintains the upstream source?** Name the project, institution, or community.
3. **What is required before broader deployment?** Specific actions (consult editors, get committee approval, partner with a tribal language program).

Bad: `"Community-friendly."`

Better: `"Educational MVP. Entries are a curated starter set drawn from the Ojibwe People's Dictionary (University of Minnesota). Production deployment must coordinate with the OPD editors and the relevant Anishinaabe language programs (Bois Forte, Fond du Lac, Grand Portage, Leech Lake, Mille Lacs, White Earth, Red Cliff, Lac Courte Oreilles, and others)."`

The Ojibwe pack's `sovereignty.communityPartnership` and the longer `packs/ojibwe/LICENSE.md` are working examples.

## When the sibling LICENSE.md is appropriate

For packs with non-trivial licensing, ship a `packs/<id>/LICENSE.md` alongside the pack file. The pack's `sovereignty` block carries a short summary; the LICENSE.md carries the long form: full license text, detailed attribution, status of bundled entries, contact details, community partnership statement, corrections process.

See `packs/ojibwe/LICENSE.md` for the template.

## What the UI must do

Any UI surface that displays entries from a pack must:

1. Read `sovereignty.attribution` and display it visibly when entries are shown.
2. Respect `restrictions` in product decisions (no commercial use of an NC pack, no third-party redistribution of a no-redistribution pack).
3. If `sovereignty.contact` is set, link to it from a "data sources" surface so users can report errors or request changes.

These are not optional. A pack is a contract. Shipping a pack while ignoring its `sovereignty` block is the same as shipping software while ignoring its license.

## A note on dual-use

Some pack content is genuinely open: Ancient Greek lexicons from the 19th century, Sanskrit grammars from the 20th, etc. Some pack content is genuinely community-controlled: living endangered languages where the community has not granted permission for arbitrary AI use. The pack format does not encode an opinion about *what* a community should allow. It encodes the obligation that packs *declare* what their source allows, and that downstream consumers respect that declaration.

Pack authors: when you're unsure whether a source's license permits AI tutoring use, ask. The cost of asking is low; the cost of being wrong is reputational damage that's hard to undo.
