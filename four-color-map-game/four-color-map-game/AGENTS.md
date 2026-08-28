# AGENTS.md — Codex instructions

## Priority

Correctness of the game rules is more important than UI polish or implementation speed.

## Do not change these rules without explicit approval

- A player creates the region that the opponent must color.
- Except for the first region, a new region must share an edge with at least one existing region.
- Point contact is not adjacency under normal rules.
- Player palettes are conceptually secret.
- Zero playable colors does not immediately lose the match; color-phase defensive skills may be used first.
- Region Split: one child is colored by the current player and the other child becomes the opponent's pending region. No additional normal region creation occurs that turn.
- The first use of Grid Shift locks the match shift axis to ROW or COLUMN for the rest of the match.
- Shift sign/direction remains selectable on every use.
- Playable-area reduction never deletes existing regions.
- Palette Change never recolors already-colored regions.
- Quiz performance determines draw count; quiz difficulty determines rarity weights.
- Reward tiers do not stack; use only the highest achieved reward.
- Low quiz difficulty must retain a non-zero chance of the highest rarity.

## Architecture constraints

- `src/game/**` must not import React, React Native, Expo, Skia, SQLite, or Supabase.
- Keep balance numbers in `src/config/**`, not scattered through handlers.
- Prefer pure functions for rule validation and state transitions.
- Make random behavior injectable/seedable.
- UI must ask the engine what is legal; UI must not reimplement rules.
- Future server code must accept intended actions and validate them, not trust client-computed final state.

## Change procedure

For each rule change:

1. Add/update a test that describes the intended behavior.
2. Implement the smallest rule change.
3. Run typecheck/tests.
4. Update the relevant document if behavior changed.

## Current scope

Implement the local prototype first. Do not add Supabase, authentication, payments, ads, ranking, or matchmaking unless explicitly requested.
