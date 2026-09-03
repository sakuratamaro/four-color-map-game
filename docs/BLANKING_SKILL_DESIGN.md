# Blanking skill design hold

`implemented: false`

Blanking is not part of Phase S0–S2 implementation. No card, action enum, UI control, or engine mutation may be added until legal recolor is implemented, tested, and initially balanced.

Open decisions:

- whether a blanked region becomes `pending`, `reserved`, or a new explicit state;
- how a merged region can be restored without inventing lost pre-merge boundaries;
- how eligibility/failure avoids leaking opponent palette or private effects;
- whether no-candidate/non-consumption becomes a legality oracle;
- how forced immediate loss is prevented;
- whether success replaces normal designation, and which seat receives COLOR/WORK;
- exact version, turn, RNG, replay, persistence, and merge contracts.

Until every item has a public-state-only deterministic answer, blanking remains design-only.
