# UDL011 / UDL070: two ordinary rescue cards

Specification: `UDL011-rescue-cards-v1`. Base: `479e7a9d2b3fa72451a160d7a6885c94f4c92e90`.
Sources: UDL-20260906-010/011, UDL-20260911-056 (delegated card details),
UDL-20260920-070, and the existing `SKILL_WORKSHOP_SPEC.md` labUnseal/labRefillUnseal prototypes.
These ordinary-card details are an AI implementation proposal, not a quotation of a user decision.
This document asserts neither designated Astra approval nor publication.

## Scope and contract

- Add `colorUnsealOne` / 封印解除札, ordinary COLOR card, ★1. Choose one sealed color
  among the user's current two basic slots and bonus slot, even if that bonus is exhausted.
  Set only that color's seal to zero. Do not refill uses, borrow colors, change adjacency,
  reset the COLOR category, or consume the separate learned technique.
- Add `colorBonusRefillUnseal` / おまけ補充・解封, ordinary COLOR card, ★3. No target.
  Add one use to the current bonus color (cap four), and remove that color's seal.
  A full but sealed bonus still permits unsealing; an unsealed but non-full bonus permits refill.
  Full and unsealed rejects with no consumption. The existing experimental +2 refill is unchanged.
- Each success consumes one ordinary card and one COLOR category use, increments version once,
  and leaves actor, turn, geometry, learned-technique count and RNG unchanged.
  Rejected targets, wrong phase/owner/version, exhausted cards and already-used categories are atomic.
  Existing action-ID receipts continue to prevent double consumption.
- Rarity rationale: common, narrow one-color rescue should be accessible against common seals;
  the combined card can recover an exhausted bonus and unseal in one category use, so is ★3.
  This does not make the combined card universally stronger: it cannot target another basic color.
- A removed seal is not a guarantee of legal paint: adjacency, actual ownership and exhausted
  bonus uses still apply. Tests include rescue-to-paint and unseal-without-rescue positions.

## Compatibility and presentation

The frozen v4.9 catalogue remains 19; ordinary catalogue becomes 22. Both cards enter normal
inventory, six-card quotes, acquisition, sale and the online/local UI through the existing registry.
No old card or learned technique is replaced. Rarity probabilities and match rewards are unchanged;
adding cards changes the conditional within-category/rarity pool probabilities.

Only fresh loadouts carrying these IDs opt into the already published alpha.6 contract. No new
state field, engine transition, SQL schema, trial template or snapshot rule is introduced.
Old alpha.1-5 reject these new card IDs; old states and existing cards remain readable and unchanged.
Alpha.6 already supports disabled/owned learned-technique snapshots and the published retained split.
The fixed Ren trial, CPU decks/policies, small-v2 dice and 11-card offline workshop are preserved.

The online target picker shows only current owned sealed colors, using the player's own snapshot
and public seals, not opponent private information or inferred board legality. Bonus refill has no
extra confirmation. Cancel is local and sends no action. Descriptions remain in optional card help.

## Acceptance and release boundary

Executable checks cover acquisition/sale/loadout, engine rejection and atomicity, +1/cap/no-op,
category/learned-technique separation, save/reload, exactly-once transaction, private projections,
actual paint after rescue and existing split/technique/dice compatibility. Browser tests must cover
normal controls and cancellation before any claim of complete UI acceptance.

Release requires this candidate's own Windows gate and genuine Astra approval. Intended scope is
Pages plus the generated standard-game-action bundle; index.ts, DB and settings are unchanged.
Deploy a compatible reader before enabling the new card catalogue on Pages; after a new inventory
or match may contain these IDs, do not restore an older catalogue/worker that cannot retain them.
Production/private-profile injection, live gacha and additional live matches are not authorized by
this local specification. Any finite live proposal must be bound to the exact reviewed candidate.
