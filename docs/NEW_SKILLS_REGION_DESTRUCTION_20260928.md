# UDL011 / UDL070: region destruction and designation cancellation

Specification: `UDL011-region-destruction-v1`.
Base: `1e6c8834a21f403a8c530b24e7956476865782f6`.
Sources: UDL-20260906-011, delegated details UDL-20260911-056, UDL-20260920-070,
ADD-20260911-REGION-DESTRUCTION-VS-UNCOLOR and the existing workshop prototypes.
This is an AI implementation proposal, not an already approved or published rule.

## Two different cards

- `disruptDemolish` / エリア破壊: ordinary ★4 DISRUPT, WORK. Remove one painted
  region with actual micro-area at most four full cells, irrespective of controller.
  All its cells become ordinary free cells. No pending/reserved/split/prepared shape may
  exist. Success costs one card/category/version; actor, turn, dice and RNG are unchanged.
  The actor must still designate the ordinary outgoing area. It is not a color-removal
  effect and does not cancel the opponent's incoming designation.
- `colorCancelRegion` / 指定の爆破: ordinary ★4 COLOR. Cancel the currently received
  original designation, not either half of a split. The original designator must select
  a *different set of macro cells* of the same required size (including an existing +1,
  maximum five), without skills, reroll, turn increment or another entry-backlash draw.
  At least one such alternative must exist; otherwise reject atomically.
  Reusing exactly the cancelled macro selection is forbidden, even in reversed order.
  After redesignation, the same receiver must paint, with their original used categories
  plus COLOR still consumed. No second cancellation, rescue-category reset or split escape.
  Seals, bonus counts and palette debuffs remain until the ordinary successful paint.
  Cancellation is a chance to change geometry, not a guarantee of escaping a seal combo.

The v7 assistant proposal forbidding deletion of incoming areas applies to the *painted-area*
destruction card; the later explicit incoming-designation request is implemented separately.
The sandbox allowed the sender to repeat the same selection and reset categories. That is not
adopted for normal play. The older general interference guideline to replace designation is
not applied to painted-area demolition: it frees space and leaves ordinary designation due,
as in its dedicated prototype. Both deviations are explicit review questions, not silent rules.
Rarity ★4 reflects broad geometry/control effects; no existing card is replaced.

## Compatibility, recovery and scope

Fresh loadouts carrying either ID opt into existing alpha.6; alpha.1-5 reject them.
Existing cards and old states do not acquire a new field. Only successful cancellation adds
strictly validated public `redesignation` state, with RESELECT and COLOR stages. It contains
only seats, macro IDs, used category IDs and stage, never hidden palettes/hands or RNG.
Paint, illegal-color termination and surrender remove it. Save/reload and authoritative
idempotency must preserve both stages and consume inventory exactly once.
CPU candidate filtering must honor the forced redesignation without changing its decks,
scoring, policy generation or use of private information.

Normal catalogue becomes 24; frozen v4.9 remains 19 and experimental cards remain separate.
Reward values, rarity probabilities, CPU rewards, small-v2 dice, retained split, learned
technique, workshop behavior, DB schema and Edge index/settings remain unchanged. Extra
cards do change the conditional within-rarity/category acquisition pool.

## Acceptance and publication

Tests must exercise demolition/free-cell reuse, area boundary including shifted geometry,
invalid targets/prepared/split, actual cancellation → different designation → legal paint,
no alternative, both-state save/reload, malformed state, category/turn/RNG/effect retention,
CPU legal redesignation, legacy rejection, inventory/action-ID replay and native UI cancellation.
Test prose is not an executed test. This candidate needs its own Windows tests and genuine
Astra candidate/spec review. Edge reader must precede Pages; do not restore an old reader or
catalogue after new inventories/states exist. No live/publication authority is implied here.
