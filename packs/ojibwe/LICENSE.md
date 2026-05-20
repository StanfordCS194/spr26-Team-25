# Ojibwe pack — license, attribution, and use guidance

## License

This pack and its bundled dictionary are released under **Creative Commons
Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0)** to align
with the license of the authoritative dictionary they draw from.

License text: <https://creativecommons.org/licenses/by-nc-sa/3.0/>

## Authoritative source

The structured Ojibwe lexicon this pack is curated from is **The Ojibwe People's
Dictionary**, a project of the University of Minnesota's Department of American
Indian Studies and University Libraries, with editors Nora Livesay (Editor) and
John D. Nichols (Founder and Linguistic Editor).

- Website: <https://ojibwe.lib.umn.edu/>
- License: CC BY-NC-SA 3.0 Unported
- Attribution required: "© The Ojibwe People's Dictionary." with a link to
  the project URL.

Any UI that surfaces entries from this pack must carry that attribution
verbatim.

## Status of these specific entries

The 41 entries shipped in `dictionary.json` are a hand-curated **demonstration
starter set**, not a verbatim export from the Ojibwe People's Dictionary.
Every entry is marked `provenance.verified: false`. The intent is to:

1. Exercise the language-pack schema (`morphology.segments`, polysynthetic
   forms, possessed nouns, audio-per-entry expectations).
2. Give a contributor a concrete template to expand into a real dictionary.

Before any deployment beyond local development:

- Replace entries with verified content sourced directly from the Ojibwe
  People's Dictionary (or coordinated with its editors).
- Set `provenance.verified: true` only after fluent-speaker confirmation.
- Populate `audioUrl` per entry with the OPD-hosted recordings rather than
  re-hosting audio.

## Restrictions

- **Non-commercial.** This pack may not be used in a commercial product
  without renegotiating licensing with the Ojibwe People's Dictionary editors.
- **Attribution required** on any rendered entry.
- **Share-alike.** Derivative works carrying these entries must also adopt
  CC BY-NC-SA 3.0.

## Community partnership

Ojibwe is a living, endangered language with active speaker communities and
academic stewards. This educational MVP pack is provided to demonstrate the
shape of a community-source-grounded language pack. Production deployment
should be done in coordination with:

- The Ojibwe People's Dictionary editors (University of Minnesota).
- Anishinaabe language educators and tribal language programs in the relevant
  communities (Bois Forte, Fond du Lac, Grand Portage, Leech Lake, Mille Lacs,
  White Earth, Red Cliff, Lac Courte Oreilles, and others).

The pack file's `sovereignty.communityPartnership` field carries a short form
of this statement; this LICENSE.md is the canonical longer version.

## Reporting corrections

Errors in these starter entries — wrong IPA, mis-glossed segments, dialect
confusions — are expected. To suggest corrections, open an issue against the
Chronos repository. To contribute verified entries from the OPD, follow
attribution guidance at <https://ojibwe.lib.umn.edu/content/copyright-usage-restrictions>.
