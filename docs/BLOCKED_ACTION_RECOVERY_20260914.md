# Blocked card actions: short reasons and recovery navigation

Version: `UDL-062-action-recovery-v1.1`

CANON_RECEIPT version=shared-canon-v1.1 origin_main=70e691b6f8f1d808476e80990d20df7862bfb782 base=c6b8ef5ca1df84aad182bf140304affee6595f68 request=UDL-20260912-062,ADD-20260913-BLOCKED-ACTION-RECOVERY-SHORTCUT specs=docs/BLOCKED_ACTION_RECOVERY_20260914.md,docs/PROFILE_COMPACT_20260914.md,docs/HOME_RULES_DIET_20260914.md,docs/STANDARD_MODE_SPEC.md tests=tests/standard-action-recovery.test.cjs,tests/standard-profile-compact.test.cjs,tests/standard-home-rules.test.cjs,tests/standard-gacha-entry.test.cjs,tests/standard-online-browser.test.cjs

## Authority and base

UDL-20260912-062 / ADD-20260913-BLOCKED-ACTION-RECOVERY-SHORTCUT. Explicit v14 user message `bbb2135e-cfd1-4da8-845b-9e3d07d8b29a` in the existing ChatGPT conversation `6aa229e7-e098-83ee-ac5e-d366a12653a4`, reconciled in the command center's BRAIN_V14_DELTA_INTAKE_20260913.json. The user asks for less card-sale explanation and a button to the screen that resolves blocked selling/loadout changes. “Go finish the match” is an example, not permission to finish it automatically.

Integrate exact compact profile `c6b8ef5ca1df84aad182bf140304affee6595f68` (Home45 and revised gachaaf) into the same recovery branch originally fixed at `47f4370cd2b47f42bd9fcc5dacbbd91a7ffb6586`. Their common base is `af1472d10044431be01665e122ea126da9b458a9`. Keep the original candidates and Home/profile worktrees unchanged. This local integration does not repair or bypass the Home CI failure.

## Presentation decisions and acceptance

1. Keep the sale explanation short. Retain the one-copy floor, protected-card rule, quote/confirmation, quantity/price/remaining-copy and high-rarity warnings. No blind immediate sale.
2. Derive recovery only from the current loaded room identity/status and the player's own pending setup/CPU entry. Unknown or mismatched room state must not invent a destination. Recompute on activation so a stale button cannot act on an old match.
3. Use the following navigation where it is relevant to a blocked action:

| Current state | Destination | Boundaries |
| --- | --- | --- |
| Own prepared waiting room / ready room | Existing setup heading, 準備に戻る | Do not submit setup, initialize, cancel or abandon on navigation |
| Playing room | Existing match heading, 対戦に戻る | Do not submit an action, surrender or create another room |
| Finished room retained locally | Existing persistent result, 対戦結果へ | Do not close the result, clear the room, claim a reward or start rematch |
| Pending setup / CPU-start identity | Existing review/setup screen | Do not clear the original draft, retry automatically or replace identity |
| Sale result unknown | Existing 前回の売却結果を確認 | Preserve pending action ID/payload across navigation and reload; no new sale or automatic retry |
| No surplus / protected-only surplus | Short specific reason; no fake destination | Preserve one copy and protected inventory; no pointless button |

4. Normal roomless loadout editing retains the existing explicit save. It must not create a CPU draft/room or submit setup. Matchmaking and actual pending operations retain their existing guards.
5. Recovery navigation performs zero game/economy writes and no new sync invalidation. Existing autonomous sync/CPU work is not reclassified as an action initiated by navigation. Only ordinary tab/focus UI state may change. Pending sale, quote, inventory/coins, room identity and draft identity remain unchanged.
6. Sale statuses distinguish idle/blocked/pending/error/success without replacing an in-flight or unconfirmed operation with a success message. Necessary server errors remain available. Navigation is not a declaration that the restriction is already resolved.
7. Native buttons support pointer/Enter/Space, >=44px targets, meaningful focus at the destination, and 390/768/1280 plus 320px enlarged text without horizontal overflow. No extra always-visible tutorial panel or duplicate action list.
8. While a sale response is unknown, opening the compact profile picker/details and Home tutorial must preserve the original sale payload, saved inventory/coins and pending message. Reload must not automatically resubmit. Only the existing explicit retry sends the same action ID, without a second award or inventory debit. Retain the separate B1 pending draw guard and exact Lv/actionId/count through the integrated Home/profile screens.

## Scope and verification

Pages_only, DB/Edge/managed changes[], images0. No card/economy/RNG/API/CPU rules, price or sale receipt changes. Preserve real surrender confirmation, six-slot/category rules, UDL061 inline purchase and UDL066 full catalog. PRODUCT_CORE_LOOP.md is referenced by the inherited spec but absent; do not invent its contents.

Test mapping: pure presentation contracts cover unknown/mismatched/stale input recomputation and operation precedence; native online fixtures cover ready/playing/finished and draft/pending recovery. Existing server-authoritative sale, cosmetic affordability, pending operations and roomless loadout regressions remain. Unit/static tests do not establish native acceptance; fixture browser passes do not establish own Windows CI, public delivery or physical-device acceptance.

Local only in this slice. No new CI run/rerun/status query, ChatGPT review send/read, push/main/Pages/DB/Edge/live/profile/match/draw. Preserve all closed budgets and exact external workflow holds. A future integrated candidate needs its own fresh scope, tests, genuine Astra and publication evidence.

## Integrated candidate boundaries

Use app20260914-9, ui-diet.css20260914-2, progression.css20260914-1 and action-recovery.js20260914-1. The release preflight binds all five exact assets including index.html and retains recovery, compact profile, Home, gacha and terminal contracts. The existing Windows contract selection contains recovery/Home/profile unit tests; no new branch trigger, dispatch, external route or CI is introduced. Frozen parent profilec6 app8/CSS2, Home45 app7/CSS1 and gachaaf app6 remain distinct evidence. Startup diagnostic1695064 is inherited, not replayed; original Home34787425617 failure, inconclusive cause and closed budgets are retained.

## Historical local verification for original47 (2026-09-14)

- Existing workflow-selected 78 contract files, including the new 9 pure/static tests: 708/708 PASS, zero skipped/cancelled (78,685.1725 ms).
- Existing owned native online fixture, final-byte serial runs: Chrome 15/15 PASS (52,425.9803 ms), then Edge 15/15 PASS (59,411.6506 ms). Each includes 9 new recovery cases and 6 existing regressions. Every fixture context/browser/server teardown completed. Browser names embedded in older test titles do not identify the executable; STANDARD_BROWSER selects the actual Chrome/Edge path. The mock restores a sale receipt profile only when it is newer than other mock operation state. The final recovery/runbook/online-sale-migration/harness check is 31/31 PASS (371.5847 ms).
- The unknown-sale fixture commits before dropping its response, persists mock server receipts/profile independently of client pending storage, and proves one inventory decrement/coin award across navigation, reload and the same-ID explicit retry. Navigation preserves pending CPU/setup identities and performs zero game/economy writes. Unconfirmed setup also disables a new sale even before setupRevision is acknowledged.
- Keyboard Enter/Space and real pointer recovery, 390/768/1280 and 320px with 200% root font-size passed. Saved Chrome/Edge screenshots are separate from physical-device acceptance. The initial screenshot timing was corrected to wait for the existing random-start notice to end; presentation code was not changed.
- Preserved failures: initial missing integration unit 7/8; first native 7/8 (nonexistent refresh selector); second native 13/14 (cosmetic refresh does not hydrate inventory); first contract run 706/707 (frozen parent runbook binding); targeted 21/22 (test path variable). The two inventory fixtures now initialize their own server state before boot rather than inventing a production refresh control. Frozen gacha parent markers remain intact; the successor has a separate current-asset contract.
- Raw logs, snapshots and later candidate receipt are in the existing commander worktree under `artifacts/blocked-action-recovery-20260914/`. No external Windows CI, genuine Astra review, public delivery, live production case or physical-device acceptance was run. Unknown/mismatched server snapshots are unit-tested, not newly native-tested.
