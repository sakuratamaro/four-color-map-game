# UDL011: エリア二分・保持

Specification: `UDL011-split-keep-draft-v1`. Base: `9cea88bd9e2ac51bd07dbc9c977620548d1e849b`.
Request: UDL-20260906-011; related UDL-20260906-010 and UDL-20260911-056.
This is the first new-card slice, not completion of the entire new-skill backlog.
The implementation is reviewable; this document does not assert Astra approval or publication.

## Intent and boundary

The user's 2026-09-26 direction prioritizes new skills, then match rewards, then seal-combo counterplay.
The prior request for a split that lets its user color both components is the source of this card.
Card details are delegated to the AIs; ★5 and the timing below remain subject to the designated review.
Existing cards are not replaced. Checkerboard/two-color regions, erosion, destruction, rewards, rarity odds,
CPU roster loadouts, images and the Ren trial template are outside this slice.

## Card contract

- ID `colorRegionSplitKeep`; display name エリア二分・保持; ordinary consumable COLOR card, ★5.
- One of the six ordinary loadout slots, not a learned technique or experimental loan.
- Target the received uncolored pending region, subject to the same ownership restriction as the old split.
- Select a nonempty proper subset of its source macros. Both macro and actual micro-cell partitions must
  be connected. Empty, whole, duplicated, foreign or disconnected choices reject without consumption,
  version change or RNG use. Existing one-cell pointer/keyboard targeting is reused.
- The selected component is colored first, then the remainder, both by the original user.
  Both are separate ordinary COLOR_REGION actions; ordinary adjacency and available-color checks apply.
- Active seat, numeric turn and the COLOR category window do not reset between the two paints.
  The skill consumes one card and one category use. Other COLOR skills, including 解封, cannot follow
  it in that same category window. It is not a promise of rescue from every seal position.
- Each successful paint separately spends a limited bonus color and ticks seals/palette effects.
  Prism and borrowed temporary colors retain their one-paint lifetime.
  Do not re-enter COLOR or apply the opponent's curse when promoting the retained component.
- After the second paint, normal WORK begins for the same user and the die rolls once.
  If the second paint is unavailable, the match stays active; surrender remains available.
  An explicitly illegal adjacent color still loses. Terminal actions clear the continuation.
- `retainedSplit` is a validated public marker containing actor, firstRegionId, secondRegionId and
  FIRST/SECOND. It contains no hidden palettes, hands or private effects. Save/reload preserves it.
  Existing action IDs and revision receipts provide exactly-once inventory consumption.

## Ordinary catalogue and compatibility

- `V49_SKILL_IDS` stays frozen at 19. `STANDARD_SKILL_IDS` contains the 20 ordinary cards.
  Acquisition, inventory, sale, six-card quotes, online/local selection and the card library use
  the current ordinary set; experimental cards and the learned technique remain separate.
- The probability table by rarity is unchanged. The color ★5 pool grows from one to two cards,
  so the existing ★5 color card's within-pool probability changes. This is not a reward rebalance.
- Only fresh matches whose loadout includes the new ID opt into `5.0.0-alpha.6`.
  All previously supported engine versions remain readable and keep their original transitions.
  Old snapshots do not receive the new marker or new hands. Old engines reject this card explicitly.
- Alpha.6 retains the alpha.5 learned-technique boundary: ordinary unequipped matches have an
  explicit disabled snapshot; equipped CPU matches keep their validated owned technique.
  The Ren trial remains its fixed alpha.5 template. CPU decks are not granted this card.
- The isolated server migration changes only `fcg_private.fcg_standard_guard_technique_snapshot()`
  to accept alpha.6 with the exact disabled snapshot or the existing ownership-checked CPU snapshot.
  It retains immutable snapshots, owner checks, trigger identity and revoked execute privileges.
  It neither rewrites existing matches nor grants inventory or changes profile/reward tables.

## Deployment contract (not executed by this document)

Candidate needs its own Windows gate and designated Astra review tied to its exact SHA, specification
blob, migration and Edge bundle. No former UI/CPU approval is reused.

1. Apply `202609260001_standard_split_keep_compat.sql` with bounded lock/statement timeouts.
2. Deploy the matching standard-game-action engine bundle and compatible Pages assets.
3. Verify exact deployed bytes and one bounded authorized new-card canary before claiming PUBLIC_VERIFIED.

The Edge index.ts contract/default remains unchanged; its generated bundle chooses alpha.6 from a
validated new-card loadout. Existing cached clients can display a gacha result via its displayName
fallback, but refresh is required for the new card's selection, explanation and continuation cues.
For rollback, retain an alpha.6-capable reader until every such match has ended. Do not blindly restore
the pre-card engine or discard new inventories/snapshots. A forward repair is the default recovery.

## Executable acceptance mapping

| Acceptance | Tests |
|---|---|
| AC011-K01 card separation, two paints, turn/category/die accounting | standard-color-region-split-keep.test.cjs |
| AC011-K02 invalid choices atomic, old split/old engine compatibility | standard-color-region-split-keep.test.cjs; standard-color-region-split.test.cjs |
| AC011-K03 seals/bonus/temporary effects, blocked remainder and terminals | standard-color-region-split-keep.test.cjs |
| AC011-K04 save/retry consumption and malformed continuation | standard-color-region-split-keep.test.cjs; standard-split-keep-sql-runtime.test.cjs |
| AC011-K05 actual worker/SQL initialization, replay, ownership and ACL | standard-split-keep-sql-runtime.test.cjs; standard-cpu-trial-sql-runtime.test.cjs |
| AC011-K06 ordinary catalogue, quote, sale, gacha and bundle parity | standard-gacha-transaction.test.cjs; standard-match-start.test.cjs; standard-loadout-quote.test.cjs; standard-profile.test.cjs; standard-online-skill-registry.test.cjs |
| AC011-K07 browser targeting, cancellation, lost reply retry and stage cues | standard-online-browser.test.cjs (colorRegionSplitKeep / UDL011 browser) |

Browser transport fixtures and PostgreSQL/WASM do not establish physical-device or production behavior.
Native multi-session database verification, remote Windows CI and publication are distinct gates.
No new CPU decision policy or new-card self-play strength claim is made in this slice.
