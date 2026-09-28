# Color permutation cards v1 — proposed ordinary cards

Request: UDL-20260906-011; card-detail delegation UDL-20260911-056. Base d68b22bbbafeca896400bedcda1605ce646a5d0e. Spec UDL011-color-permutation-v1. These are AI-designed candidates, not an Astra release approval. The blanking design hold remains untouched.

## Two new cards, not replacements

- disruptColorSwap / 色交換 / DISRUPT / rarity4: select two distinct painted, non-edge-adjacent regions. Exchange their colors simultaneously only if all resulting edges touching either target remain legal.
- disruptColorRotate / 地層反転 / DISRUPT / rarity5: select three distinct painted regions in a chain (1 touches2;2 touches3). Move colors 1→2→3→1 simultaneously. Each actor may resolve this card once per match, even when a fixture/debug hand has extra charges. Two-region rotation is the separate swap card, not a hidden second form.

Both use WORK only. Pending, reserved, retained split, prepared outgoing, redesignation and delayed targets are excluded. No effect, invalid targets, adjacency failure or a repeated rotation reject with state/card/version/RNG/save unchanged. No random draw is used. Shapes, source macros, controllers and all untargeted colors remain unchanged; no merging or hidden palette/hand access occurs.

## Tempo and compatibility

Unlike the standalone workshop prototypes (which leave ordinary designation with the actor), normal cards follow existing legalRecolor's accepted tempo: success replaces this player's normal designation, passes WORK to the opponent, preserves turn/rolledSize/baseRequiredSize/requiredSize and causes no reroll. Opponent designates normally. Set interferenceLock until normal entry to COLOR; neither permutation nor legalRecolor can chain through the lock. This distinction is an explicit Astra design-review point, not an already approved prototype parity claim.

One success increments version once, consumes one card, uses the DISRUPT category, and resets the new actor's category window as a normal control handoff. Rotation adds optional public rotationUsedBy containing only the seats that actually used it; it never signals a secret hand before use. Old field-free saves remain field-free. Its exact seat-array schema is validated and preserved through reload/terminal states. New loadouts with either card opt into existing alpha6; alpha1–5 reject them. Old ID/version compatibility and all existing features remain protected; deployment must never revert to a reader/catalog unable to handle new IDs/state.

Normal catalog becomes26 (existing experiment2 separate; frozen v4.9 stays19). Both are eligible for ordinary same-rarity acquisition; rarity-level probability and reward values do not change, but the within-rarity candidate pool grows. CPU rosters/decks/scoring are not changed by this slice.

## Required acceptance

Core: successful simultaneous swap and ordered rotation, all post-edges, no-effect/no-candidate and forbidden flow atomicity, geometric preservation after shifted shapes, public-only decisions, no RNG draws, once-per-actor persistence, terminal/save/strict schema, alpha1–5 rejection, interference lock until COLOR, correct category/turn/die handoff.

Integration: ordinary inventory acquisition/one-time consumption; action-ID replay and altered replay; real worker + isolated SQL; online and local target UI, selection order/cancel, no precommit legality oracle, no resend after reload; generated bundle/cache parity; full candidate-specific Windows; genuine candidate/spec/DB/Edge review; authorized finite publication proof. These are acceptance requirements, not tests already executed. No DB schema/settings or new image change is planned.
