# Skill workshop isolated release gate

Base: `9cea88bd9e2ac51bd07dbc9c977620548d1e849b`. Spec: `SKILL_WORKSHOP_V1`, `docs/SKILL_WORKSHOP_SPEC.md`.

This Pages-only slice adds the eleven-card offline workshop, a home link opening it separately, and its dedicated Windows gate. The new bundle embeds the existing public Standard core plus an isolated adapter. Ordinary engine source, ordinary generated bundles, card registry, gacha, profiles, migrations, Edge, managed settings and images are unchanged. The unrelated unpublished split-keep card is not a prerequisite and is not included.

Executable tests:

- `tests/standard-skill-workshop.test.cjs`: 20 tests covering all eleven effects, two-color adjacency, normal create/color continuation, all-or-nothing rejection, isolated RNG, category/silence lifetime, delayed resolution, replay, save validation and exclusion from ordinary registry.
- `tests/standard-skill-workshop-browser.test.cjs`: 5 cases in each Chrome/Edge. All eleven skills activate via real pointer controls at390px; keyboard activation, two-color rendering, reload, reuse of destroyed space, broken-save preservation, no external requests, ordinary-storage sentinels are asserted. This is an offline fixture, not a production online canary.
- Ordinary unchanged core contracts: `standard-match`, `standard-skill-dispatcher`, `standard-skill-catalog`.
- `node scripts/build-skill-workshop.mjs --check`: generated-byte match.

First local adapter run: 19/20; the silence-expiry fixture selected a nonadjacent shape. Corrected only that fixture's start macro50 to54, then20/20. Prototype on the prior development base passed78/78 combined contracts and Chrome5/5+Edge5/5. Those results are historical, not evidence for an untested public-base rebuild. Public-base final runs are recorded with the fixed candidate in the existing commander.

Windows verification, Astra approval, main/Pages publication and served-byte verification are distinct later gates; this document alone asserts none of them. Natural-play balance, competitive CPU integration, physical-device acceptance, full-silence original proposal and ordinary acquisition of these prototypes are not completed by this workshop.
