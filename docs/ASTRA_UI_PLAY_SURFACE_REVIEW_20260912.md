# Board, role palette and hand — fixed release review

SUBJECT_SHA `6cd12ae888f26c9403fb504596f92f4d9a65b301`

BASE_SHA `93c05c7c68576b28a126588d0716f0f56c015531` (PUBLIC_VERIFIED entrance)

CANON_VERSION `shared-canon-v1.1`; SPEC_VERSION `UDL-052-054-063-play-v1`; SPEC_PATH `docs/UI_PLAY_SURFACE_20260912.md`; SPEC_BLOB `67d52446047eafb6a6c32e38e8e7c9538aea88b4`; scope `Pages_only`; DB[] / Edge[].

[Full fixed difference](https://github.com/sakuratamaro/four-color-map-game/compare/93c05c7c68576b28a126588d0716f0f56c015531...6cd12ae888f26c9403fb504596f92f4d9a65b301). [Specification](https://github.com/sakuratamaro/four-color-map-game/blob/6cd12ae888f26c9403fb504596f92f4d9a65b301/docs/UI_PLAY_SURFACE_20260912.md). Source is v8 userbbb21715/designc1c1a98e and genuine continuationd7a96f4c. Prior approval012 covers entrance93 only.

## What changed

- Four separate basic1/basic2/bonus/remaining roles; same colors do not merge. External role names, full accessible names and visible infinity/count/lock/cross. Fourth-role selector exposes all alternatives, including independent temporary grants matching an exhausted bonus. Pure own-projection model matches existing available-color union over6144 cases. It neither reads opponent private state nor predicts adjacency legality. Existing COLOR_REGION sends color only; consumption order and server guards unchanged.
- Board and palette fit normal390x844,768x900,1280x900 using actual fixed/sticky chrome boundaries. Minimum280px board and existing12-column zoom/pan/keyboard support remain. Short-height landscape and200-percent CSS-zoom proxy explicitly use the visible fallback. Turn guide fits normally; palette-change cause stays visible, not folded, and takes priority over duplicate guide text. requestAnimationFrame fitting does not move focus or pick cells.
- Own authoritative loadout renders six slots3x2; used cards remain disabled in place and readable. Optional description controls remain44px and do not add an activation step. Used-category prose comes after all six, avoiding position jumps. Match setup and public trace details are folded after the hand. Loan extras remain separate. Timing/category/pending guards unchanged.
-16 changed paths: app/index/new model/CSS, spec, focused tests, cache/runbook and existing Windows workflow's exact candidate branch. No engine, registry, bundle, DB, Edge, economy, CPU/card, result or cosmetics changes. app31/play CSS1/model1; memo and entrance asset versions preserved.

## Executed evidence and failures retained

Final clean6cd12ae: nonbrowser906/906 PASS (68.594s), actual installed Chrome22/22 (236.242s) and Edge22/22 (238.582s), skip0. Includes overlapping roles, temporary color action payload exactly once, old public-seal stale-click guard, torn/coherent CPU projection, viewport/hit targets/stable used-hand offsets, cause notification/reload/offline,12-column zoom, UDL023 entry and focused timed-quiz notice clearance, UDL048 portrait, UDL055 finished restore, immediate skills and public/private explanation boundaries. One local Edge browser-close timeout used the existing owned-browser cleanup fallback; suite completed successfully, not a production browser observation.

Final390/1280 board images and390 hand image were separately visually inspected. Early hand capture was occluded by fixed chrome and not accepted as visual evidence. The test now scrolls the real hand clear, checks all six description hit targets and takes a normal viewport screenshot without hiding chrome. Inactive card text was also made legible while preserving native disabled state.

Earlierc53 nonbrowser905/906 failed the existing test-declaration formatting guard;54 corrected the declaration without weakening the guard. Earlier54 nonbrowser906/906 and Edge19/19 are retained as earlier-candidate evidence, not a substitute for6cd. Older palette tests that assumed one button per color or no palette outside COLOR were updated explicitly to the adopted four-role/disabled-outside-turn contract; seal rejection and server-action assertions remain. Three generated builders produced zero diff, also verified by both6cd Windows jobs.

[Windows34642709902](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34642709902) is in progress as this packet is written. Both Chrome and Edge SUCCESS on exact6cd are required before release; local PASS does not waive it. No main/Pages publication yet.

## Bounded public verification after approval

Fresh main must still equal93 and be an ancestor. Force-free exact candidate push, same-SHA Pages SUCCESS, then public preflight and exact bytes of index/app/model/play CSS/ui-diet CSS before any profile. Script `scripts/live-standard-play-surface-canary.cjs` on the governance branch refuses execution without explicit live opt-in and exact clean candidate SHA; syntax check and no-argument refusal passed, live execution NOT_RUN.

Use one new anonymous test profile and one owned ordinary CPU-yuzu match (user-authorized). Ordinary setup/opening reaches COLOR. Actual public Chrome390 cold/reload and1280 checks real role data, board/palette hits, six-card grid, no inspection writes or console errors. Explicitly use one own borrowed-color card, confirm authoritative decrement, stable disabled slot and reload; then end only this owned match by normal surrender and confirm terminal state. No public matchmaking, existing players, quiz/gacha, deletions or secret output. Live overlap/seal/exhaustion combinations are NOT_RUN and rely on fixed-candidate fixtures, not fabricated public coverage. Physical devices NOT_RUN.

Please return an exact-candidate DECISION/SUBJECT_SHA/BLOCKERS/NOTES. Receipt/delivery, old approvals and silence are not approval. Remaining060/061/062 are tracked independently; the UI goal remains active.
