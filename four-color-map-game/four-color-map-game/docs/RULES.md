# Rule Summary for Implementation

## Invariants

- A cell belongs to at most one Region.
- A pending Region is uncolored.
- A colored Region has exactly one color.
- Normal newly-created Regions are orthogonally connected.
- Except for the first Region, newly-created Regions touch an existing Region by an edge.
- A player may color a pending Region only with a color in `palette - adjacentColors`.

## Color phase

1. Receive pending Region.
2. Allow eligible color-phase skills.
3. Recalculate geometry/adjacency/palette after every skill.
4. Calculate playable colors.
5. If empty after the player finishes defensive actions: loss.
6. Otherwise color with exactly one playable color.

## Work phase

1. Allow eligible work-phase skills.
2. If Region Split already returned a child Region, skip normal region creation.
3. Otherwise create exactly one legal pending Region for the opponent.
4. If no legal Region exists: current player wins by map completion.

## Region Split

- Input: current pending Region.
- Output: two non-empty orthogonally connected children.
- Current player chooses which child to color.
- Other child becomes opponent's pending Region.
- No additional normal Region creation this turn.

## Grid Shift

- `shiftAxis = NONE | ROW | COLUMN`.
- First shift chooses ROW/COLUMN and locks it for the match.
- Each later use can independently select positive/negative half-cell direction.

## Same-color merge

After a geometry or recolor action, if separately identified same-color Regions become edge-adjacent, merge each connected same-color component into one Region.
