# Standard mode specification

Status: Phase S0 frozen draft for local `standard-v5-alpha1` implementation. This document does not change the frozen solo v5 RC1, v4.9 baseline, online deployment, or Supabase state.

Product-loop and complexity priorities are defined in `docs/PRODUCT_CORE_LOOP.md`; those priorities govern player-facing simplification, progression, quiz hints, card sale, cosmetics, and the security boundary.

## Authority and scope

Behavior is resolved in this order:

1. verified v4.9 behavior in `index.html`;
2. explicit accepted project decisions;
3. current design documents;
4. older prototypes.

The standard/thoughtful mode is the main game. Quick mode remains a tutorial. Initial alpha is local-only and must support local two-player and human-versus-CPU play. It must not import Supabase or reuse/overwrite the solo RC1 save.

## Frozen RC boundaries

- Do not modify source commit `484768b`, evidence commit `764ff96`, the formal solo RC1 ZIP, its manifest, or SHA-256 `5286986169586D4CE30A33D043E55540E0DA251ABA7AE2A053F46B55B9C1F3C7`.
- A solo correction becomes `solo-v5-rc2`; it is never an in-place RC1 replacement.
- Standard mode uses its own modules, UI, schema, RNG domains, and save key.
- Save key: `fourColorMapGame.standard.v5.save`. Its versioned root is `{schemaVersion, rootRevision, economyVersion, profiles, activeMatch, reservations, rngSnapshot, receipts}`; it never cross-migrates v4.9 or solo saves. Receipt namespaces are `matchStart`, `matchConsumption`, `matchSettlement`, `cardSale`, `quizSettlement`, and `gachaDraw`.

## Transient terminal presentation boundary

- The permanent RESULT remains the accessible source of truth. The transient terminal reveal is a visual-only, `aria-hidden`, pointer-transparent page-session effect.
- Its complete input is `{eventId, headline, resultText}` where `eventId` is `matchId + ":" + finalMatchVersion` and the two strings come from the pure public terminal model. It does not receive or inspect root/session/private state, receipts, settlement ledgers, or RNG.
- It may start only after a newly applied terminal action is persisted. Duplicate receipts, failed action persistence, settlement transitions/retry, reload, history, and ordinary RESULT redraw do not start it. Terminal presentation clears and outranks contact presentation.

## v4.9 behavior retained

- Board: 12×12 macros, each split into 4×4 internal cells; initial writable bounds are 10×10.
- Ordinary die/required-size pool: `[1,1,2,2,3,4]`; area expansion may raise the current requirement to 5.
- Standard palette: three distinct colors drawn from four. One random palette slot is limited, leaving two ordinary unlimited slots plus one limited bonus-color slot.
- Limited-use pool: `[1,1,2,2,3,4]`, so P(1)=1/3, P(2)=1/3, P(3)=1/6, P(4)=1/6.
- Each player brings at most two distinct cards from each of color, area, and disruption: six cards total. A card appears once in the match hand only when inventory was positive at match creation.
- Existing cards are consumed at their successful effect-application boundary. Selection cancellation and a rejected precondition do not consume. Some v4.9 random cards intentionally consume on a valid activation even when their revealed random result adds no tactical value.
- Adjacency legality is not previewed to the human. A selectable adjacent-conflicting color still resolves as the ordinary illegal-color loss.
- Winner-affecting randomness must be deterministic and separated into named seed/RNG domains.

## Standard alpha engine and state contract

The pure engine API boundary is:

```text
createStandardMatch(config, rngStreams)
applyStandardAction({state, actor, action, expectedVersion, rngStreams})
validateStandardState(state)
projectStandardPublicState(state)
projectStandardPrivateState(state, seat)
encodeStandardMatch(state, rngSnapshot)
decodeStandardMatch(payload)
```

Only `CREATE_FIRST`, `COLOR`, `WORK`, and `GAME_OVER` are engine phases. `HANDOVER`, `MODAL`, `TARGET_SELECT`, `QUIZ`, `GACHA`, and `CPU_THINKING` are UI/session states. Quiz, gacha, and loadout editing are outside a match. Minimum engine action intents are `CREATE_REGION`, `COLOR_REGION`, `USE_SKILL`, `DECLARE_NO_COLOR`, and `SURRENDER`; `DECLARE_NO_COLOR` is internal/CPU validation only, while the player-facing control is simply `投了`. Accepted actions increase version by exactly one; rejected actions change no state, version, RNG, card, active seat, or phase.

The authoritative match state explicitly owns `schemaVersion`, `engineVersion`, `mode`, `matchId`, `status`, `version`, `turn`, `active`, `phase`, `regions`, `pending`, `playableBounds`, `requiredSize`, `rolledSize`, `baseRequiredSize`, `basicPalettes`, `bonusColors`, `bonusUsesRemaining`, `hands`, `loadouts`, `publicEffects`, `privateEffects`, `interferenceLock`, `winner`, `terminalReason`, and `publicLog`.

The authoritative state owns:

- board geometry, regions, pending/reserved region, phase, active seat, turn, version, winner, and reason;
- each seat's three-slot palette, limited slot, and remaining limited uses;
- each seat's six-card match hand and successful-use counters;
- public seals/effects and private palette effects;
- quiz session only while a quiz is active;
- named RNG snapshots for `match-init`, `palette`, `bonus-color`, `bonus-use-count`, `die`, `skill-effect`, `cpu-A`, `cpu-B`, `cpu-tie-break`, `quiz-structure`, `quiz-content`, `quiz-choice-order`, `quiz-choice-rank`, `quiz-cosmetic-motion`, and `gacha`.

The public projection contains board geometry, colored-region colors, active seat, phase, required/rolled sizes, public skill use/effects, winner, and public log. A seat's private projection contains only its basic palette, bonus color and remainder, hand, loadout, and seat-private effects. The human UI and CPU receive public plus own-private projections, never the authoritative state, opponent palette/hand/bonus remainder/private effects, decision seeds, or RNG snapshots.

UI selection, open modal, handover overlay, animation, and scroll position are not authoritative state. Local handover must remove the previous seat's private DOM before showing the overlay; CSS hiding alone is insufficient.

Geometry effects do not reject an otherwise valid shift merely because one painted region becomes disconnected. After Half Shift—and after Three-Layer Fault when its modular handler is enabled—each disconnected component becomes its own region with the same color and controller history. New fragment IDs are allocated deterministically, then touching same-color components are merged by the common numeric-minimum rule. World exit and cell overlap remain atomic rejection conditions.

## Phase S1: ten-question quiz

The v4.9 generator catalog is retained but extracted from the single HTML into reviewable modules:

```text
standard/
  quiz-generator.js
  quiz-session.js
  hint-policy.js
  reward-policy.js
  standard-engine.js
standard-v5/
  index.html
  app.js
  style.css
```

Each run has exactly ten questions:

- instant: 2;
- normal: 5;
- hard: 2;
- spike slot: 1, containing an ordinary hard question or a low-probability extreme question.

Ordering constraints:

- Q1 is instant or normal;
- Q1–Q2 contain at least one instant question;
- spike appears at Q6 or later;
- hard/spike cannot occupy three consecutive questions;
- one template cannot occupy three consecutive questions;
- difficulty positions are generated from seeded constrained shuffle, not fixed slots.

Every question has six distinct displayed choices and exactly one correct choice. Correct display slot and the correct value's numeric rank are independently randomized. Tests cover all 36 slot×rank cells overall and stratify by difficulty and template. The existing 60,000-question regression remains a required gate.

### One-use hint

- one use per question;
- 3 seconds for instant/normal, 5 seconds for hard/spike;
- answer timer pauses for the whole display interval;
- player may close early;
- reopening is impossible;
- fixed, template-specific reviewed content only;
- no answer value, correct option, position, or substituted final calculation;
- no reward reduction.

The hint clock and answer clock are separate monotonic counters. Closing the hint resumes the answer timer with exactly its pre-hint remainder.

## Phase S2: server-style legal recolor

First existing-region interference effect: `legalRecolor`, recommended rarity ★3, timing `WORK`, standard mode only. Blanking remains unimplemented.

Eligible target:

- existing colored region;
- not pending or reserved;
- not deleted and not in a delayed operation.

Candidate colors are computed from public board state only:

```text
all four colors
minus colors of edge-adjacent colored regions
minus the target's current color
```

No candidate produces `NO_LEGAL_RECOLOR` with card, turn, version, save payload, and every RNG snapshot unchanged. A successful action uniformly draws from the unique sorted candidate set using effect RNG, consumes one card, and recolors the region. Because every adjacent color is excluded and geometry is unchanged, legal recolor must create zero same-color adjacent edges and must perform zero merges; any merge is an invariant failure. Numeric-minimum region ID merging remains the deterministic common rule after geometry-changing effects such as half-cell shift.

Tempo after success:

- active seat passes to the opponent;
- phase stays `WORK`;
- `turn` stays unchanged because it counts committed region handoffs, not WORK decisions;
- `requiredSize` is unchanged;
- no die reroll occurs;
- the receiving seat must designate an ordinary region;
- another existing-region interference card is blocked until the next transition into `COLOR`.

Public Standard Online may expose this effect only through rule set `STANDARD_V5_LEGAL_RECOLOR_LAB_V1`: private-code human versus human, explicit matching setup consent, one virtual loan per seat outside the ordinary six-card loadout, and no profile, inventory, match-history, trophy, or reward mutation for the entire match. The lab is mutually exclusive with debug-unlimited mode and unavailable to public matchmaking and CPU rooms. The selected rule set is stored in authoritative state and rechecked against stored room setup markers on every action; a client action cannot opt itself into the lab. The committed public trace reveals only actor, target region, and resulting color after success. Candidate colors, probability, and success availability are never exposed before commit.

## Blanking boundary

Blanking is design-only with `implemented: false`. No blanking action, card, UI, enum, or engine branch may be added before recolor implementation, tests, and initial balance results are accepted. Open questions live in `docs/BLANKING_SKILL_DESIGN.md`.

## Bonus-color boundary

Each player owns three distinct colors from the four-color universe: two unlimited basic colors and one limited bonus color. v4.9 is authoritative: draw three distinct colors, then select one of those three palette slots as the bonus slot. Bonus uses are drawn from `[1,1,2,2,3,4]`. Only a successful ordinary `COLOR_REGION` using the bonus color decrements it; zero is unusable and the opponent's remainder is private. Illegal-color loss timing, prism's one-action four-color permission, palette-changing effects, and public color seals require explicit parity/precedence tests rather than being inferred from the bonus slot.

## Profile and persistence boundary

The standard alpha stores one revisioned root atomically under `fourColorMapGame.standard.v5.save`; profile, inventory, economy, reservation, match, RNG, and receipt data never use separate storage keys. Profiles use an immutable internal `profileId` plus a mutable `displayName`; schema 4 `activeMatch` owns board, match hand/use, immutable PROFILE/CPU participant snapshots, start/finish metadata, card-source classification, settlement marker, and RNG snapshot. Explicit v2-to-v3 and v3-to-v4 migrators preserve legacy data rather than silently reinterpreting it. `quoteStandardMatchStart` is RNG-neutral; `startStandardMatch` clones root/RNG, validates the rule set and inventory, creates PROFILE-only reservations, stores a two-index match-start receipt, increments root revision, and writes once. Exact replay is no-write idempotent before revision checking; payload conflict, operation-key reuse, stale roots, failed validation, and failed persistence leave the caller root and RNG unchanged. Only accepted card actions consume inventory and their matching reservation; settlement checks only inventory-backed hand entries, releases remaining reservations, and never consumes or restores loan/CPU-virtual cards. Match-settlement receipts are indexed by both match ID and operation ID so exact replay is idempotent while changed results or key reuse fail closed.

## Skill registry and result boundary

The modular registry contains the 19 existing v4.9 cards plus the separately identified experimental `legalRecolor`. A standard loadout still selects two distinct cards from each of the three v4.9 categories, six total; it does not reduce the catalog to six card types. Each selected card is normally available once per match, and profile inventory is consumed only when the common dispatcher returns `RESOLVED` and the single-root save succeeds.

Every skill definition owns identity, display name, category, rarity, timing, target schema, implementation/UI/gacha/experimental flags, private-information classification, RNG stream and expected draw count, consumption policy, and handler version. UI code submits intent only. `REJECTED` preserves state, version, hand, RNG, inventory, ledger, and storage; `CANCELLED` creates no engine action or action ID; `RESOLVED` may consume even when a v4.9 random effect is tactically empty. The dispatcher never uses tactical benefit as the consumption test.

## CPU observation

Standard CPU input is a frozen defensive projection containing only public state, own private state, public history, own loadout, own bonus-color remainder, and public effects. Opponent palette, hand, bonus-color remainder, and private effects are forbidden. Difficulty may change evaluation, never permissions or information.

## Initial balance gate

After legal recolor is stable, run 100 paired seeds for no-skill, recolor excluded, and recolor included conditions with seat swaps. Record engine rejection, loop/stop rate, duplicate consumption, seat wins, recolor-side wins, opportunity/use/success/failure, one-turn post-use outcome, game length, and board occupancy. No rule change is justified by a single seed or by win rate alone.

## Known v4.9/design differences

| Topic | v4.9 code | Accepted standard design | Resolution |
|---|---|---|---|
| Quiz pacing | Ten questions all use the selected level; only immediate repeated type is avoided. | 2/5/2/1 constrained effort curve. | New modular standard quiz implements the accepted curve; v4.9 remains unchanged. |
| Hint | No hint session exists. | One use, 3/5 seconds, paused timer, no reward penalty or answer leakage. | New modules only. |
| RNG | v4.9 uses ambient `Math.random()` for several setup/quiz/effect choices. | Winner-affecting random choices are seed managed. | Standard engine introduces named RNG domains; do not rewrite v4.9. |
| Merge ID | v4.9 merge follows object enumeration/first-found pair. | Legal recolor retains the numerically smallest region ID. | New recolor transition uses an explicit numeric comparator. |
| Consumption wording | Some valid random activations consume even when tactically ineffective. | Rejected/no-candidate/cancelled actions do not consume. | Preserve existing-card semantics unless separately approved; enforce strict non-consumption for legal recolor and new actions. |

## Post-action contact-color feedback

`contactColorCount` is the public integer count of distinct colors on colored regions that share at least one edge with the newly accepted pending region. Corner-only contact, uncolored regions, and the pending region itself do not count. Multiple edges to one region and multiple adjacent regions of the same color each contribute only one distinct color. The valid range is 0 through 4; any non-integer or out-of-range value is a transaction-contract failure, not a value for the UI to clamp.

Pending state is fail-closed. Exactly zero regions may have `isPending=true` when `pending=null`; otherwise exactly one uncolored region must have `isPending=true` and its id must equal `pending`. A colored pending region, multiple pending regions, an orphan pending flag, or a pending reference without the matching flag is `INVALID_PENDING_STATE`; contact feedback must not silently exclude and continue from such a state.

Only an immediately applied, successfully persisted `CREATE_REGION` may trigger feedback: 0–1 shows nothing, 2 shows `二色接触！`, 3 shows `三色圧力!!`, and 4 shows `四色包囲!!!`. The engine result is authoritative; the UI never scans DOM geometry or consults palettes, hands, bonus uses, rescue cards, private effects, or unpublished loadouts. `四色包囲!!!` reports four public board colors touching the new region and does not assert defeat.

Rejected, cancelled, stale, failed-persistence, idempotent replay, reload, handover reveal, coloring, skill, split, and settlement paths do not replay this feedback. On success the previous private DOM is destroyed, the public board and HANDOVER layer render, then a pointer-transparent, non-focusable public status layer appears for at most about one second. It consumes no game RNG, writes no storage, changes no revision, clears its transient children after completion, cancels its old timer on replacement/new match, and uses a reduced-motion fade without changing its text or tier.

A normal URL reload never reconstructs a transient contact presentation from the persisted receipt. It resumes the persisted public phase (including HANDOVER), leaves private projection DOM empty until an explicit reveal, and performs no presentation timer, action ID generation, storage write, revision change, receipt change, or game RNG draw.

Contact presentation is invariant under private-state substitution. With the same public board, action, action ID, and public rules, changing either seat's basic/bonus palette, bonus uses, hand, private effects, unpublished loadout, reservations, or rescue-card ownership must not change acceptance, public projection, action-result keys/flags, contact count/tier/text/live attributes, HANDOVER target, presentation count, or lifetime class.

The action-result identity contract is explicit: a newly persisted action returns `appliedNow=true, replayedReceipt=false`; an exact idempotent replay returns `appliedNow=false, replayedReceipt=true`; rejected and stale results return both false; persistence failure never returns `appliedNow=true`. Contact feedback additionally requires `status=RESOLVED`, `saved=true`, `CREATE_REGION`, and count 2–4.

Persistence accounting distinguishes a `setItem` attempt from a successful write. If persistence throws, the public session result uses the uniform non-success representation `contactColorCount=null`, records neither a receipt nor a state/revision/RNG change, and presents nothing. Retrying the same fingerprint and action ID after that failure is a new application because no receipt was persisted; once it succeeds, later identical resends are receipt replays and never re-present the contact effect.

Engine rejection and optimistic-concurrency rejection use that same non-success representation. Wrong region size, non-adjacent region, stale root revision, and stale match version each return `status=REJECTED`, `appliedNow=false`, `replayedReceipt=false`, and `contactColorCount=null`; they make no persistence attempt and cannot create HANDOVER or contact presentation state.

After a persistence failure, the attempted action identity may live only in page-session memory. It is reusable only for the identical match, actor, action type, and canonical payload fingerprint. A changed selection or payload cancels that retry identity and the next dispatch generates a new ID; explicit reuse of the failed ID with a different fingerprint returns `ACTION_ID_PAYLOAD_MISMATCH` before storage. Reload and session teardown discard the ephemeral identity.

That retry fingerprint also includes the expected root revision and match version. Any root resync, revision/version transition, actor/phase transition, active-match replacement, match start, settlement, or teardown expires the pending identity. Once a selection changes, returning to the previous payload cannot resurrect its old ID. Pending identity is prohibited from storage, root/receipts, projections, DOM, console, and public logs.

Presentation tiers have deterministic classes `contact-pressure-2`, `contact-pressure-3`, and `contact-pressure-4`. Counts 0 and 1 return before any presentation DOM or timer is created. For counts 2–4, a temporary `role=status` / `aria-live=polite` layer is created after persistence and removed with all children when the effect ends or a new match clears it; no empty live region remains at rest.

The 300 ms gesture guard is scoped by an `interactionGeneration` token that changes whenever action-bearing DOM is replaced. This token is UI-only and must never enter saved match data, receipts, projections, or public/private schemas. The contract remains three-layered: native repeated-key suppression, same-generation in-flight/recent gesture suppression, and transaction idempotency at persistence.

After an action fails only at persistence, its retry identity lives in page memory solely while actor, action type, payload, root revision, match version, phase, and active match remain unchanged. A successful retry clears it before any later operation; even an identical later payload must receive a new ID. Normal URL reload calls `session.reload()`, clears this transient identity, and is the product's current root-resync path; no separate in-page resync control exists.

For a normal tier-4 `CREATE_REGION`, native pointer double-click and native Enter/Space repeat must resolve once per fresh interaction generation: one action ID, transaction, storage attempt/write, revision increment, action receipt, contact presentation, and HANDOVER. Keyup or the second pointer activation must not reveal the next player's private panel or activate an old or newly rendered control.

CREATE confirmation is an asynchronous UI boundary: while its action Promise is pending, the initiating control is disabled, exposes `aria-busy=true`, and the generation-scoped in-flight guard remains held even after the 300 ms recent-gesture interval. Presentation and HANDOVER occur only after a successful save. Every exit, including persistence failure, releases the in-flight guard and removes the busy state in `finally`; a same-intent retry may then reuse only the pending failed ID under the retry-fingerprint rules.

Gesture suppression is generation-local, not action-type-global. After A's CREATE renders HANDOVER and B reveals, B's COLOR and subsequent WORK-phase CREATE must remain immediately usable even when each authoritative operation begins within 300 ms of the previous one. Handover reveal itself is read-only: it changes no saved bytes or root/match revision. The later B CREATE uses a new interaction generation and cannot be rejected merely because A recently performed the same action type.

The contact live region has an externally verified publication boundary. Successful CREATE persistence precedes destructive removal of the previous seat's private DOM; the new pending public region and next COLOR phase then render, followed by visible unrevealed HANDOVER, before the live region is observable. At first observation no previous-seat private signature remains, the effect has no focusable/button/dialog descendants, uses `pointer-events:none`, and cannot own focus. Presentation adds no write, root/match revision, receipt, game RNG draw, or HANDOVER reveal beyond the committed CREATE.

Presentation input is narrowed at the function boundary: `showContactReveal(contactColorCount)` receives only the post-commit public count after the caller checks saved, newly applied, non-replayed `CREATE_REGION`. It must not receive or inspect the session, authoritative root, private projection, palettes, bonus state, hands, private effects, unpublished loadouts, or RNG snapshot.

Transient contact timers use a UI-only `contactPresentationGeneration` that is independent from `interactionGeneration` and absent from every saved/projection/receipt/RNG schema. Showing or clearing an effect advances the presentation generation. A timeout may remove the live region only when both its captured generation and node identity are still current; replacement also explicitly cancels the prior timer. Thus a queued stale callback cannot remove a newer tier or mutate game state.

Starting a new match begins by clearing any contact presentation. Given the same settlement-complete root, selected profiles, first seat, clock, and generated IDs, the saved next-match root and public/private HANDOVER state must be identical whether a contact layer was pending or absent. Cleanup adds no storage write of its own, leaves no empty live region, and makes every captured pre-cleanup timeout inert.

Reduced-motion preference may change only the transient animation. Normal motion uses one finite scale/fade; reduced motion uses a finite opacity-only fade with no non-identity transform, translation, shake, or flashing loop. Both modes must produce the same contact text/tier/accessibility contract, exact saved bytes, public result, revisions, receipts, card state, reservations, and game RNG snapshot.

`CONTACT_PRESENTATION: ACCEPTED` means retrospective feedback derived only from the persisted CREATE result and public board. It is explicitly not a legal-color guide, pre-action contact preview, or outcome forecast.

## Public terminal-result presentation contract

The terminal-reason vocabulary has one canonical source: `standard/standard-match.js` exports `TERMINAL_REASONS = [ILLEGAL_COLOR, BOARD_LOCK, SURRENDER, SEALED_OUT, NO_LEGAL_COLOR]`. Finished-state validation uses that same array, match settlement accepts only members of it, and settlement-receipt validation accepts only members of it. The engine, validator, settlement, and presentation allowlists must therefore remain byte-for-byte equivalent with set difference zero. `MAP_COMPLETE` is not a terminal reason; `mapCompleteWin` is a separately derived, public settlement fact that can be true only for a fully occupied and fully colored `BOARD_LOCK` win.

| Reason ID | Authoritative branch / function | Public trigger | Winner | Saved `GAME_OVER` | Settlement | `mapCompleteWin` | Trophy consequence | Normal product route | Existing harness route | Proposed public wording |
|---|---|---|---|---|---|---|---|---|---|---|
| `ILLEGAL_COLOR` | `colorRegion`: submitted color equals an adjacent region color | An accepted color submission violates the four-color contact rule | Other seat | Yes, by the ordinary action transaction | Yes | Always false | None | Color button | `standard-illegal-color-browser-terminal.test.cjs` | `接色違反です` |
| `BOARD_LOCK` | `colorRegion`: after a legal color, `bestLegalSize` returns 0 | The accepted color leaves no legal next region size | Acting seat | Yes, by the ordinary action transaction | Yes | True only when every playable macro is occupied and every region is colored/non-pending | Winner may unlock `fullPaint`, `fullPaint3`, and/or `noSkillFullPaint` after settlement | Color button | `standard-match.test.cjs`; `standard-root-transaction.test.cjs` | `盤面が完成しました` when `mapCompleteWin=true`; otherwise `これ以上エリアを作れません` |
| `SURRENDER` | `surrender` | Active player selects `投了` | Other seat | Yes, by the ordinary action transaction | Yes | Always false | None | `投了` button | `standard-settlement-inflight-browser.test.cjs`; `standard-local-two-player.test.cjs` | `{loserName} が投了しました` |
| `SEALED_OUT` | `declareNoColor`: `availableColors` is empty | During COLOR, the active seat has no usable palette color | Other seat | Yes, by the ordinary action transaction | Yes | Always false | None | No player-facing control; internal/CPU validation only | Engine path covered by `standard-match.test.cjs`; product browser route remains open | `{loserName} は使える色がありません` |
| `NO_LEGAL_COLOR` | `declareNoColor`: usable colors exist but every one is blocked by adjacent colors | During COLOR, the active seat has no legal color for the pending region | Other seat | Yes, by the ordinary action transaction | Yes | Always false | None | No player-facing control; internal/CPU validation only | `standard-no-color-browser-terminal.test.cjs` | `{loserName} は塗れる色がありません` |

Player names in terminal copy come only from immutable match-start `displayNameSnapshot` values. Seat IDs are the fail-closed fallback when a valid public snapshot is absent. Current UI strings that expose raw reason IDs are transitional and are not the accepted public presentation.

`buildTerminalPresentation({ publicResult, participantSnapshots, settlementStatus, settlementSummary })` is the pure presentation boundary. It accepts only the public winner seat and terminal reason, immutable match-start display-name snapshots, `PENDING` / `FAILED` / `SETTLED`, public settlement outcome including `mapCompleteWin`, and an explicitly public settlement summary containing only displayable streak values and newly unlocked trophy IDs. It returns frozen plain data only: settlement phase, winner/loser display labels, heading, reason text, `mapCompleteWin`, public trophy rows, and an audit result. It must not read or receive root/session/auth state, private projections, palettes, bonus uses, hands, private loadouts/effects, seal details beyond the already-public terminal outcome, reservations, receipts containing private facts, or any RNG state.

Unknown reason IDs fail closed to generic copy (`対戦が終了しました`) and an explicit `UNKNOWN_TERMINAL_REASON` audit failure; raw input is never interpolated into DOM or accessibility text. Unsettled and settled outputs are visibly distinct: the former says the result is being saved and contains no trophy claim, while the latter may show only public settlement facts. DOM construction uses `textContent` exclusively.

Terminal presentation outranks and clears contact-pressure presentation. Its animation may run once only for the newly persisted action that first creates a valid terminal state; reload, receipt replay, settlement retry/completion, handover reveal, and render-only refresh must reconstruct stable result content without replaying the terminal animation. Presentation consumes no game RNG, performs no storage write, changes no revision or receipt, and cannot disclose either player's private state.

The pure model is implemented in `standard-v5/terminal-presentation.js` at commits `35b1aaf` / `741f535`. The engine, finished-state validator, settlement, receipt, and mapping sets are executable exported contracts and must remain identical. The model copies no unknown summary fields, exposes no internal reason ID in display strings, and returns no post-settlement stats or trophy rows while status is `PENDING` or `FAILED`. Root schema remains 5, match schema remains 1, and no migration or presentation-persistence field was added.

`projectPublicSettlementSummary({ root, matchId, failureCode })` is the domain/session boundary that may inspect a validated root internally but returns only a frozen discriminated union. `PENDING` contains only its status; `FAILED` contains a normalized public failure code; `SETTLED` contains per-seat WIN/LOSS plus nonnegative safe-integer wins, losses, current streak, and best streak, and validated newly unlocked trophy IDs. It never returns profile IDs, operation IDs, fingerprints, revisions, receipts, reservations, authoritative state, palettes, bonus data, hands, private effects, RNG, or loadouts. The transient failure code is page-session state and is cleared on reload, new match, terminal transition, or successful settlement.

The product static RESULT is implemented as a permanent DOM region and rendered through `renderStaticTerminalResult({ terminalPresentation, settlementSummary })`. Its constructor receives only DOM handles and the retry callback; render-time game data is limited to the two public models. PENDING shows the immutable winner/reason and save-in-progress text with stats, trophies, and retry hidden. FAILED shows the same immutable result plus safe fixed failure copy and the only retry control, without exposing the internal failure code. SETTLED shows only validated per-seat public stats and catalog-derived public trophy labels. The renderer creates user-derived content solely with `textContent` and text nodes, never HTML interpolation.

On terminal entry the UI clears the contact reveal, destructively clears private DOM, hides HANDOVER and modal presentation, disables commit/surrender and every board cell, renders the public GAME_OVER state, then renders PENDING before settlement. Settlement success or failure only redraws the permanent static RESULT. A normal reload of a settled root redraws that RESULT without settlement, presentation, storage, ID, revision, receipt, reservation, history, or RNG activity. The one-shot terminal reveal is deliberately not part of this static renderer and remains a separate transient responsibility.
## Terminal presentation identity and motion contract (verified 2026-08-31)

- At most one terminal presentation event identity is retained in memory. The event becomes seen only after its transient DOM and removal timer are both reserved successfully; reservation failure removes partial DOM and permits a safe retry.
- Presentation is downstream of a successfully persisted, newly applied terminal action. A persistence failure, rejected action, stale action, or idempotent receipt replay cannot start it. Static RESULT reconstruction and settlement redraw do not replay it.
- While a terminal action Promise is pending, the action remains gesture-locked beyond the 300 ms suppression window. A successful retry of an unchanged failed intent may reuse its pending action ID, but it yields exactly one authoritative terminal action, presentation, and settlement.
- The normal effect uses one finite scale/fade animation. `prefers-reduced-motion: reduce` uses one finite opacity-only animation. Motion preference cannot change root bytes, revisions, winner/reason, RESULT text, stats, history, settlement, receipts, writes, action IDs, focus, or pointer behavior.
- The transient layer is decorative (`aria-hidden=true`), pointer-transparent, and contains no focusable control. RESULT remains the durable accessible terminal record.
### Terminal admission across matches

- A transient terminal event is accepted only when its match ID equals the controller's current match and its captured page-session generation equals the current generation.
- Activating a different match clears the old transient node/timer, increments the non-persistent session generation, and resets the one-event identity. Activating the same match is idempotent.
- The action captures admission context before awaiting persistence. Consequently, an old asynchronous match-A result cannot re-enter after match B becomes current, even when A's event ID differs from B's last event ID.
- Match/session admission values are UI runtime state only. They are absent from root, active match, receipts, public/private projections, localStorage, DOM attributes, public logs, console, and game RNG state.
### Settlement and reload presentation idempotency

- A successful terminal action may start one transient terminal reveal before settlement. A settlement persistence failure changes only the durable static RESULT state to FAILED and exposes retry; it cannot start another terminal or contact reveal.
- A later successful settlement retry updates the public SETTLED summary and durable RESULT only. It cannot replay terminal/contact presentation, and it applies exactly one stats/history outcome.
- Loading an already settled RESULT from the normal URL rebuilds only durable public result UI. It performs no transient presentation, settlement, storage write, action/operation ID generation, private reveal, or active board-control restoration.
### Terminal native-input exactly-once contract

- Trusted pointer double-click, native Enter repeat, and native Space repeat on SURRENDER are one logical gesture within the current interaction generation.
- Each gesture may allocate and persist one terminal action, start one transient terminal reveal, and run one settlement. Key repeat or Space keyup cannot activate settlement retry, RESULT controls, or match start after terminal transition.
- Exactly one win/loss update, one history entry per participant, and one reservation release follow. Private DOM and active board controls are absent once GAME_OVER is rendered.

### Coordination provenance (2026-08-31)

- New authoritative coordination thread: `6a94d048-1940-83e8-8996-295fdb42e7c2`; processed handoff messages: userMessage `5156f673-83f5-4985-b16e-e6a6a8544da7`, agentMessage `dc0b2d18-6072-4c9d-863d-3a9a6743a730`.
- Former thread `6a90ba06-d1cc-83e8-b66a-b8b7a3794acd` is reference-only. The channel transition does not alter this specification, schema, migrations, accepted commits, or outstanding terminal gates.

### Five-reason browser-matrix evidence boundary (2026-08-31)

- Official instruction `dcc17453-8224-4a92-8689-3d00fbb47241` requires actual-browser evidence for `ILLEGAL_COLOR`, `BOARD_LOCK`, `SURRENDER`, `SEALED_OUT`, and `NO_LEGAL_COLOR` before later presentation gates.
- The test-only matrix injects counters only into the served browser bundle and verifies each reason through the normal transaction/presentation/settlement path. Declaration reasons use a test-only DOM control wired to the real private `dispatch` function because the alpha product intentionally has no declaration button; no legality oracle or debug hook is added to product files.
- At the 2026-08-31 boundary the evidence was partial (4/5) because `BOARD_LOCK` and a complete authoritative run were interrupted by host page-file exhaustion. This historical state is superseded by the 2026-09-01 five-reason acceptance immediately below.

### Five-reason browser-matrix acceptance (2026-09-01)

- Commit `5f2c061` validates the executable allowlist `ILLEGAL_COLOR`, `BOARD_LOCK`, `SURRENDER`, `SEALED_OUT`, `NO_LEGAL_COLOR` in five fresh Edge contexts per complete run. Two consecutive complete runs pass 6/6 with no skip, failure, or timeout.
- A newly persisted terminal action is the sole source of one transient reveal and one settlement. Post-terminal Pointer/Enter/Space, static-result redraw, and normal reload cannot allocate another action ID, write, reveal, contact presentation, outcome, or settlement.
- Fresh contexts begin without standard save data and do not share terminal action IDs. Test instrumentation remains outside the product bundle. This accepts the five-reason matrix only; name/XSS, teardown/contact priority, viewport, full-suite, and detached-clean acceptance remain separate gates.

### Terminal participant-name snapshot and XSS acceptance (2026-09-01)

- Terminal presentation identity uses the participant `displayNameSnapshot` captured by match start, not the mutable current profile name. The boundary holds through active-match reload, terminal persistence, settlement histories, and settled RESULT reload.
- Snapshot strings are rendered only through text nodes/text content in both transient and static terminal surfaces. HTML-, SVG-, and script-shaped names must not create payload nodes or execute side effects.

### Terminal presentation priority and teardown acceptance (2026-09-01)

- Terminal presentation has strict priority over any pending contact presentation. Clearing contact invalidates its timer generation, so a stale contact callback cannot remove or alter terminal UI.
- New-match activation clears the terminal node/timer and advances terminal session identity. Starting the same deterministic new match before or after transient removal must yield equivalent saved state and UI; callbacks captured from the former session are inert.

### Exact terminal viewport acceptance (2026-09-01)

- The transient terminal layer and static RESULT must fit without horizontal overflow at 390×844, 768×1024, and 1365×768. The transient card remains fully inside the viewport and retains pointer-transparent, focus-free, `aria-hidden` behavior.
- Settled reload remains byte-stable at every target size and must not reconstruct transient terminal/contact presentation or re-enter settlement/action/ID generation.
