# Standard Skill Category Audit

Status: design baseline for `UDL-20260906-012` / `UDL-20260906-013`

Read-only audit base: `origin/main@6c5f2c8`

Scope: standard v4.9 catalog 19 cards, plus the experimental-alpha / online-LAB `legalRecolor` compatibility boundary

## 1. Decision summary

### User decisions

- A player may resolve at most one skill from each usage category (`color`, `area`, `disrupt`) during one control window.
- The rule is server-authoritative and applies equally to normal play, CPU play, debug, LAB, retry, and replay.
- An accepted miss or accepted no-op uses the category opportunity. A rejected action, cancelled selection, or persistence failure does not.
- Bonus-color-related skills belong to color manipulation. The only current adoption candidate is **おまけ色補充**: add 2 to the current bonus-color uses, capped at 4. Other bonus-color proposals remain on hold because of power concerns.
- Strong CPU characters may have unlimited stock or replenishment for board-shape skills such as 角膨張 and shifts. This does not create an exception to the per-control-window area limit.

### Audit recommendations

- Keep the catalog category of all 19 v4.9 cards unchanged: 5 `color`, 6 `area`, and 8 `disrupt`.
- Add a separate registry field, named `usageCategory` in this document. Catalog category continues to drive catalog, loadout, inventory, and gacha behavior; usage category alone drives the per-control-window limit.
- Keep `legalRecolor` catalogued as `experimental`, outside the normal six-card loadout and gacha, but set `usageCategory: "color"`. This prevents `COLOR` skill -> `COLOR_REGION` -> `legalRecolor` in the same control window from using `experimental` as a fourth quota bucket.
- Treat one "turn" for this rule as a **control window**: the continuous interval in which the same seat retains `active`. A `COLOR -> WORK` phase transition does not reset it. Any `active` handoff starts a fresh window for the new seat.
- Enable the new contract only for a new engine version, recommended `5.0.0-alpha.3`. Existing `alpha.1` and `alpha.2` matches retain their current behavior until completion.

This agrees with `PROJECT_COMMAND_CENTER.md`: UDL-012 requires one card per category and server authority; UDL-013 requires the 19-card audit before implementation; the risk note requires new-engine-only behavior and the accepted/rejected boundary above.

## 2. Category model

`category` and `usageCategory` are deliberately orthogonal.

| Concern | Field / source | Rule |
|---|---|---|
| Catalog, six-card loadout, inventory, gacha pool | existing `category` | unchanged for all 19 cards |
| Per-control-window quota | new `usageCategory` | `color`, `area`, or `disrupt`; never supplied by the client |
| Experimental availability | existing `experimental`, `v49Catalogued`, `gachaEnabled`, LAB rule-set gate | unchanged |

The authoritative state should hold a small window value such as:

```js
skillCategoryWindow: {
  actor: "A",
  categories: ["color"]
}
```

The server derives the category from the registered skill definition. It must not accept a category from an action payload.

The numerical `state.turn` is not sufficient as the window key. `legalRecolor` transfers `active` while leaving `turn` unchanged. Conversely, ordinary coloring retains `active` while moving from `COLOR` to `WORK`, so phase changes are not reset points either.

This is the audit's explicit interpretation of "same turn" in UDL-012. The rejected alternative is a seat-plus-numeric-turn ledger: it would continue blocking a seat if control later returned while the numerical turn had not advanced, even though another seat had received and exercised control. The control-window definition instead follows the actual right to act and must be accepted as part of the alpha.3 contract before implementation.

## 3. Nineteen-card audit

All area and disrupt definitions have registry timing `WORK`; the current dispatcher allows such definitions in both `CREATE_FIRST` and `WORK`. The table states the effective phase.

| Catalog / usage | Card | Effect and target | Accepted miss/no-op and rejection boundary | CPU use and combination impact |
|---|---|---|---|---|
| color / color | 色拾い・乱 (`colorRandomBorrow`) | `COLOR`; no target; draw one color currently present on the board and add it to temporary colors; 1 RNG draw | No board colors: reject. A color already held, sealed, or unusable beside the pending region is an accepted miss/no-op | CPU enumerates it when any board color exists. Its rescue estimate is probabilistic. A resolved color skill blocks all later color skills in the same window |
| color / color | 色借り (`colorChoiceBorrow`) | `COLOR`; choose a color currently present on the board and add it to temporary colors | Invalid or absent board color: reject. Already-held, sealed, or adjacency-blocked color: accepted miss/no-op | CPU enumerates board colors and can evaluate guaranteed rescue candidates |
| color / color | 四色解放 (`colorPrism`) | `COLOR`; set the private prism effect, making all four colors available subject to seals and adjacency | Reapplying an already-active prism is an accepted no-op | CPU lists it as a rescue candidate; current COLOR choice is still random across candidates. It can no longer stack with borrow or palette change in one window |
| color / color | エリア二分 (`colorRegionSplit`) | `COLOR`; split the opponent-origin pending region into two connected parts using `regionId` and `sourceMacros`; the reserved part returns for the opponent to color | Invalid, empty/full, duplicate, disconnected, or conflicting split: reject. A valid split that still provides no legal color is an accepted tactical miss | CPU enumerates connected bipartitions. It remains color because it is a COLOR-phase rescue; classifying it as area would permit split -> borrow/prism in one window. Coloring the selected part then hands back the reserved part |
| color / color | 持ち色変更 (`colorPaletteChange`) | `COLOR`; permanently replace one basic/bonus palette slot and clear a temporary debuff on that slot | Invalid slot/color or unchanged slot: reject. Replacing with a sealed or adjacency-blocked color is an accepted tactical miss | CPU enumerates each changed slot/color pair. Duplicate palette colors are currently legal and bonus-use count is preserved |
| area / area | ひとふくらみ (`areaMicroBloom`) | `CREATE_FIRST` or `WORK`; choose outgoing `sourceMacros`; randomly convert one point-contact candidate into edge contact and store the prepared shape; 1 RNG draw | Invalid outgoing selection or no candidate: reject before RNG. No accepted no-op exists | CPU uses only shapes with candidates. It currently stacks with 角膨張; the new area limit removes that same-window stack |
| area / area | エリア拡張 (`areaDiePlus`) | `CREATE_FIRST` or `WORK`; add one to the current required area, up to 5, when that size is placeable | At maximum, prepared shape present, or no legal +1 placement: reject. No accepted no-op exists | CPU checks +1 placement first. Its current bonus-preserving combination with 拡大縮小 becomes mutually exclusive in one window |
| area / area | 拡大縮小 (`areaResize`) | `CREATE_FIRST` or `WORK`; expand or shrink one writable board side, then recompute required size | Unavailable side or prepared shape: reject. A legal shrink that causes `BOARD_LOCK` is an accepted terminal result, not a no-op | CPU enumerates legal sides. Existing colored geometry and prior trophy history remain |
| area / area | 角膨張 (`areaCornerBloom`) | `CREATE_FIRST` or `WORK`; choose outgoing macros and a base macro, then add every available quarter-cell corner and store the prepared shape | Invalid target or no corner candidate: reject. No accepted no-op exists | CPU uses a conservative subset of server-legal plans. Unlimited CPU stock still means at most one area resolution per window |
| area / area | 半マスシフト (`areaHalfShift`) | `CREATE_FIRST` or `WORK`; shift all cells in one row/column band by half a macro; split disconnected regions and merge same-color contact | Empty band, world overflow, or overlap: reject. A real split is accepted; no no-op exists | CPU enumerates legal plans and avoids prepared shapes. The handler can currently succeed after preparation in some cases; the area limit closes that stacking path |
| area / area | 三層断層 (`areaTripleShift`) | `CREATE_FIRST` or `WORK`; shift a center band by one macro and its adjacent bands by half a macro, preserving connectivity | Invalid edge band, empty band, overflow, disconnect, overlap, or prepared shape: reject. No no-op exists | CPU enumerates legal plans. Debug replenishment no longer permits repeated same-window shifts |
| disrupt / disrupt | 色封じ・乱 (`disruptRandomOne`) | `CREATE_FIRST` or `WORK`; randomly choose one of four colors and set the opponent seal to at least 1; 1 RNG draw | A color absent from the current palette is an immediate tactical miss but leaves a seal that can affect later prism/borrow; an equal/stronger existing seal is an accepted effect no-op | CPU uses it. Prism does not bypass seals |
| disrupt / disrupt | 色封じ (`disruptChoiceOne`) | `CREATE_FIRST` or `WORK`; choose a color, set opponent seal to at least 1, and add one private curse-backlash to the user | Invalid color: reject. A non-held color is only an immediate palette miss because the seal remains; an existing seal can leave the seal portion unchanged, but curse-backlash still increases | CPU tries all four colors. Same-window curse stacking is removed |
| disrupt / disrupt | 二重封じ・乱 (`disruptRandomTwo`) | `CREATE_FIRST` or `WORK`; choose two distinct random colors and set both opponent seals to at least 1; 2 RNG draws | Absent colors are immediate tactical misses but their seals remain; already-effective seals, including a fully sealed target, can make the effect an accepted no-op | CPU uses it. It still covers two colors with one card, but cannot be followed by another disrupt in the window |
| disrupt / disrupt | 持ち色汚染・乱 (`disruptPaletteRandom`) | `CREATE_FIRST` or `WORK`; randomly choose a color and opponent private palette slot, replacing it for one coloring; 2 RNG draws | If all slots already equal the selected color, the visible no-op is still accepted | CPU uses it. A later 持ち色変更 on the slot clears the temporary debuff |
| disrupt / disrupt | 追封 (`disruptChoiceTwo`) | `CREATE_FIRST` or `WORK`; choose a color and set opponent seal to at least 2 successful colorings | Invalid color: reject. An absent color is an immediate tactical miss but the seal remains; seal already at least 2 is an accepted effect no-op | CPU tries all colors. Seal durations combine by `max`, not addition |
| disrupt / disrupt | 持ち色汚染 (`disruptPaletteChoice`) | `CREATE_FIRST` or `WORK`; choose a color and randomly select an opponent private slot, replacing it for two colorings; 1 RNG draw | If all slots already equal the chosen color, the no-op is accepted. Baseline code consumes the card; UDL-003's target rule retains card/inventory while still ending this disrupt opportunity | CPU tries all colors. Hitting the bonus slot can affect bonus usability |
| disrupt / disrupt | 長封 (`disruptChoiceThree`) | `CREATE_FIRST` or `WORK`; choose a color and set opponent seal to at least 3 successful colorings | Invalid color: reject. An absent color is an immediate tactical miss but the seal remains; seal already at least 3 is an accepted effect no-op | CPU tries all colors. It combines with shorter seals by `max` |
| disrupt / disrupt | 強制持ち替え (`disruptForcedPalette`) | `CREATE_FIRST` or `WORK`; choose a color and randomly replace one opponent palette slot permanently, clearing a temporary debuff there; 1 RNG draw | It is an accepted effect no-op only when the chosen slot already has the color and has no temporary debuff to clear | CPU tries all colors. It changes the candidate distribution of later palette pollution |

### Experimental compatibility row

| Catalog / usage | Card | Effect and target | Boundary | Rationale |
|---|---|---|---|---|
| experimental / color | 塗り直し・乱 (`legalRecolor`) | `WORK` only; choose a colored, non-pending/reserved/delayed region and randomly recolor it to a color different from its current and adjacent colors; 1 RNG draw | Invalid target or zero candidate: reject. Success always changes color, passes `active` to the opponent, keeps `turn` and required size, and sets `interferenceLock` | Retaining experimental catalog behavior avoids six-card and gacha changes. Counting it as color closes the cross-phase experimental quota bypass. Online use is LAB-gated; local alpha and an injected CPU hand are separate supported test boundaries |

## 4. Resolution, card consumption, and category use

Category use follows the action result, not whether the effect was strategically useful:

| Outcome | Category opportunity | Card / inventory | RNG and persistence |
|---|---|---|---|
| Accepted effective result | used | follow that card's consumption policy | persist state, RNG, version, receipt, and category marker atomically |
| Accepted miss or accepted no-op | used | **separate policy**; baseline 6c5f2c8 handlers consume a card, while UDL-003 requires the all-three-slots-match no-op of `disruptPaletteChoice` to retain card and inventory | accepted RNG draws, version, category marker, and receipt persist once |
| Handler or dispatcher reject | unused | unchanged | no RNG draw for the category gate; no accepted receipt |
| UI selection cancel | unused | unchanged | action is not dispatched and no action ID is issued |
| Persistence failure | unused in authoritative state | unchanged in authoritative state | discard the candidate state/RNG/marker; retry reevaluates the action |
| Idempotent replay of an accepted action | already used by the original commit | no second consumption | replay receipt is returned before reapplying rules |

This separation is required by UDL-003: the no-op does not reveal the opponent's private palette through card disappearance, but it still ends the disrupt opportunity and prevents selecting a different color in the same window. Implementing the category rule must not preserve the baseline handler's unconditional `resolved()` card consumption for that branch.

## 5. Compatibility and subsystem impact

### Engine and persistence

- Create new matches as `5.0.0-alpha.3` with `skillCategoryWindow` required by validation.
- Continue validating and dispatching `alpha.1` and `alpha.2` with their old stacking behavior and no window field. Retrofitting an in-progress match is unsafe because earlier uses in its current control window cannot be reconstructed reliably.
- Put the category gate before RNG and the handler. Mark only an `ok: true` handler result. If the resolved skill transfers `active`, initialize an empty window for the new active seat; otherwise append the resolved category.
- Include the window in the authoritative JSON and public projection. A database schema migration is not expected because the authority is JSON, but source and generated server bundle must deploy together.

### CPU

- Filter CPU action enumeration by authoritative `usageCategory`; engine rejection alone can make CPU repeatedly choose a high-priority forbidden action and stop automatic progress.
- After a probabilistic color-rescue miss, another color skill is no longer available. Normal/hard policies should prefer a guaranteed rescue (choice/prism/evaluated palette or split) over random borrow when one exists; easy may retain the gamble.
- Unlimited board-operation stock or replenishment for strong CPUs changes availability only. It must not bypass `usageCategory: "area"`, so 角膨張, 半マスシフト, and 三層断層 remain usable on later control windows but cannot be chained within one.

### Debug and LAB

- Debug currently replenishes a successfully used card. It must not clear the category window. The UI meaning of infinity is therefore unlimited stock, not unlimited same-window activations.
- Online LAB uses the same server-authoritative gate. `legalRecolor` stays experimental and online-LAB-only but consumes the color opportunity. New alpha.3 local sessions and CPU observations with an explicitly injected hand must obey the same usage-category rule without weakening their separate availability gates.

### Retry and replay

- Preserve action-receipt preflight before version/category validation. A matching action ID and fingerprint returns the original receipt and never consumes a second card, RNG draw, or category opportunity.
- A reused ID with a different fingerprint remains `IDEMPOTENCY_KEY_REUSE`.
- Rejected attempts create no category marker. A database commit failure leaves old authority and RNG intact.

### Six-card loadout and gacha

- The standard loadout remains exactly two distinct cards from each catalog category, six total. Two cards in one category become alternatives for different control windows rather than a same-window combo.
- Gacha remains rarity draw -> uniform choice among the three catalog categories -> uniform choice within the matching rarity/category pool. Because catalog categories do not change, probabilities do not change.
- `usageCategory` must never be used to build loadout or gacha pools.

## 6. Bonus-color expansion backlog

This section maps the latest user direction to `UDL-20260906-011` without promoting it into the current 19-card implementation.

| Label | Candidate | Catalog / usage | Recommendation |
|---|---|---|---|
| User decision | おまけ色補充: add 2 current bonus-color uses, cap 4 | color / color | retain as the sole current adoption candidate; it must obey the same color opportunity |
| User concern | Other bonus-color-related proposals | color / color if revisited | keep on hold because their power may be excessive; require rules/privacy/UX/category-gate review before promotion |

The refill card is not part of the audited v4.9 set and does not change the 19-card or gacha pools until a separate UDL-011 implementation decision is made.

## 7. Risks

### P0

1. Enforce the limit in the core/server dispatcher. UI-only disabling is bypassable by a forged action.
2. Use the active-seat control window, not only `turn` or phase, or `legalRecolor` handoff and `COLOR -> WORK` will be incorrect.
3. Record the category only after handler success and commit it atomically with state, the card/inventory result selected by that skill's consumption policy, RNG, version, and receipt. In particular, UDL-003 retains `disruptPaletteChoice` on its accepted no-op while still recording `disrupt` usage.
4. Keep idempotent replay preflight ahead of category validation; do not double-apply accepted retries.
5. Filter CPU candidates by used category and revise normal/hard probabilistic rescue behavior.
6. Apply the same rule to debug and LAB; neither replenishment nor experimental catalog status may create an extra quota.
7. Regenerate both `standard-v5/app.bundle.js` and `supabase/functions/standard-game-action/standard-engine.bundle.js` with the source change and enforce source/client/server bundle parity.
8. Gate the rule by the new engine version. Do not invalidate or silently change active `alpha.1` / `alpha.2` matches.

### P1

1. Project the window publicly so clients can disable all cards in a used category and explain that an accepted miss still used the opportunity.
2. Add localized handling for the new rejection code and clear stale target-selection UI after an authoritative update.
3. For the new engine, validate that a prepared outgoing shape cannot claim multiple area skills; preserve old prepared stacks for legacy engines.
4. Clarify allowed phases per skill. The generic `WORK` rule currently includes `CREATE_FIRST`, while `legalRecolor` performs a stricter WORK-only validation.
5. Reconcile documentation and registry meaning for `privateInformationEffect`; this is not a blocker for category enforcement.

## 8. Minimum implementation units

### A. Core contract

- Add `usageCategory` to all registry definitions: the 19 cards mirror catalog category, `legalRecolor` uses `color`.
- Add the `alpha.3` window state, validation, public projection, active-handoff reset helper, dispatcher gate, resolved-only marker, and rejection code.
- Preserve legacy engine behavior.

### B. CPU and focused tests

- Filter CPU enumeration and adjust normal/hard rescue ordering.
- Cover every registry mapping plus: same-category second-card reject, different-category acceptance, `COLOR` skill -> color -> `legalRecolor` reject, same numeric turn after active handoff, accepted miss/no-op, the UDL-003 retained-card/used-category branch, reject, cancel, persistence failure, replay, debug replenishment, online LAB, new alpha.3 local sessions, CPU injected-hand, and legacy matches.

### C. Client and online artifacts

- Run `scripts/build-standard-v5-bundle.mjs` and `scripts/build-standard-online-engine.mjs`, verify both generated bundles have no stale diff after a clean rebuild, run source/client/server parity checks, and deploy A-C together. No database migration is required for the JSON state field.

UI disabling and explanatory copy may follow after A-C because server safety is already established, but should land before public rollout for clarity.
