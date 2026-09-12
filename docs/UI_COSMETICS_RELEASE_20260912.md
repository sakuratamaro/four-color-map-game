# UDL061 public release and bounded acceptance

CANON_RECEIPT version=shared-canon-v1.1 base=b81a1d52e8230d41ec9e69610d89bafc86d1d84e request=UDL-20260912-061 specs=AGENTS.md,docs/SHARED_CANON.md,docs/UI_COSMETIC_ITEM_ACTION_20260912.md,docs/STANDARD_PUBLIC_RELEASE_RUNBOOK.md tests=tests/standard-online-browser.test.cjs,tests/governance-cosmetic-item-canary.test.cjs worktree=.codex-worktrees/ui-cosmetics-20260912

State: **PUBLIC_VERIFIED** after the separately authorized bounded retry below. The original failed attempt remains unchanged.

## Completed acceptance supplement — actual scheduled normal run

Astra019 response f2aebe0a-d1a8-4966-85d6-9a09625f453b (request336393d6-5c0d-4294-810f-3a772f7b5bd6) explicitly approved one additional isolated-profile corrected canary. This is separate from019's062 REQUEST_CHANGES and does not replace018's exact product approval.

The same existing automation genuinely started NORMAL_WORK turn01a09462-aeab-7242-9c90-75104cc6df58 at06:51:30Z, after receiving turn01a09454-7d62-7530-91c9-9144a7ac0785 completed06:47:51Z. No self-send. The approved attempt was reserved once before preflight. Clean product/main remaineda757; public preflight passed before signup, saved in UI_COSMETICS_RETRY_PREFLIGHT_20260912.json. The canary verified all3public asset bytes before creating its profile.

UI_COSMETICS_RETRY_LIVE_20260912.json: **94/94 PASS**, completed06:54:48.243Z. Additional profiles1,3quizzes/30answers/6draws/17necessary spare sales, funding350. Golden purchase350→0, free and owned re-equip with no extra debit, no inventory/ticket/record/trophy changes from the cosmetic actions. Reload exact server-profile equality, exactly3nonduplicate200 ACKs, browser operation allowlist and console/pageerror/warnings0 all executed and passed. No matches, deletion, arbitrary credit, direct DB write, real-money operation or fault injection. Browser session closed, credentials not saved.

Actual screenshots390-purchased,1280-purchased,390-reloaded were visually inspected: golden card, equipped state and44px-plus controls fit; purchase feedback is inside the item, reload does not replay the old success message. Geometry reports horizontal overflowfalse, buttons72x45. PNGs remain local. Physical devices remainNOT_RUN.

Cumulative isolated profiles **2 = original1 + retry1**; cumulative funding6quizzes/60answers/12draws/33spare sales, cosmetic actions6. These cumulative counts do not redefine the per-attempt caps. Original failure and offline7/7 remain separate evidence. No further profile or canary rerun is needed.

## Publication evidence

- Candidate/main `a757c126e1325532bb11a719cf92d0d13401d3ae`; spec UDL-061-cosmetics-v1.1, blob `12eb7874f69b5c707104de79a2b631ac55aff345`. Pages_only, DB/Edge each[].
- Genuine Astra018: request c0629536-84d4-45cf-b3b3-e02fbf97b7a4, response c64ae754-9306-452b-83ad-0d9233eef7cc, designated chat6aa229e7-e098-83ee-ac5e-d366a12653a4.
- Fresh main b81a1d52e8230d41ec9e69610d89bafc86d1d84e, clean candidate and ancestry checked; normal force-free push and remote readback confirmed a757.
- Fresh API: exact Windows [34663861170](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34663861170) completed SUCCESS. Chrome103471714209 and Edge103471714128 both SUCCESS; each online131/131, contracts573/573, Edge lifecycle79/79. Chrome's intentionally omitted lifecycle workflow step is not a skipped product test.
- Same-SHA Pages [34671793635](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34671793635) completed SUCCESS. Candidate public preflight ok:true: UI_COSMETICS_PREFLIGHT_20260912.json.
- Before signup, public index, app36 and intent module2 all returned200 and matched candidate bytes exactly. Hashes: UI_COSMETICS_LIVE_20260912.json.

## One live attempt: preserve its failure

Original UI_COSMETICS_LIVE_20260912.json is unchanged, ok:false, completed2026-09-12T04:01:51.391Z. One isolated profile,3 quizzes/30 timeout answers,6 draws,16 necessary spare-card sales, funding370. No extra profile, artificial credit, match, deletion, privileged write or production fault injection. Credentials existed only in the ephemeral process/browser, which was closed; none were saved for retry.

Actually observed:

- One item click purchased/equipped the350-coin golden nameplate, revision+1,370→20 coins; pending cleared after ACK and cosmetic action count1.
- Free default equip then owned golden equip: total revision+3, additional debit0, golden ownership exactly once; game inventory/tickets/records/protected cards/trophies unchanged.
- Purchased-item390/1280 geometry: no horizontal overflow,72×45px buttons, feedback inside item. Both screenshots visually inspected. PNGs stay local, not in the shared source commit.
- Reload completed and its awaited golden `装備中` button appeared. The next combined layout assertion failed.

NOT EXECUTED after failure: final server-profile equality after reload, final three-response ACK aggregation, browser-operation allowlist assertion and console-zero assertion. Reload geometry was not saved before the old assertion. Do not invent its values or count these checks as PASS. Physical devices NOT_RUN.

## REG-20260912-COSMETIC-CANARY-01: harness diagnosis

The combined predicate incorrectly required the transient `.cosmetic-item-status` message after full reload. In exact candidate app.js, cosmeticItemFeedback starts null; restored ownership/equipped state is separate. Existing product regression checks restored appearance, not replay of a prior success announcement.

The offline scripts/diagnose-cosmetic-reload.cjs reuses the unchanged candidate fixture with unrelated test registration disabled; this is not a claimed rerun of that suite. External requests are blocked. UI_COSMETICS_RELOAD_DIAGNOSIS_20260912.json is7/7 PASS: fixture profile/revision unchanged, no new cosmetic action,390/1280 controls fit with transient feedback absent, production request attempts0. The390 screenshot was visually inspected. This corroborates the incorrect predicate, **not** the unexecuted live final checks; the fixture catalog is not the real golden-nameplate catalog.

Only the governance harness changed: purchase still requires feedback, reload still requires the equipped button but not an old ACK announcement, and geometry/screenshot are saved before assertion. Initial focused harness regression4/4 PASS; a fifth check then protects the partial live evidence. Combined governance check initially23/24: the exact-review whitelist stopped at017 and rejected the genuinely received018. Adding018's observed SHA/base/spec/blob/scope binding fixes that test without weakening validation. Historical CPU waiting assertions now reference the closed061 budget rather than a predicted future slot. Product/spec/economy/server changes0. No product rollback is justified by the diagnosed harness defect. The original one-profile bound is consumed; no extra live run is authorized by this evidence entry.

## Ownership and continuation

Final selected governance regression:24/24 PASS, skipped0; git diff --check clean. This verifies the records/harness, not the four unexecuted live assertions.

This existing Codex task01a07b56-616e-7733-9aae-90575659688e itself performed the publication. Its preceding self-send was steered into the active heartbeat, not a separate normal worker; treating it as a completed handoff was wrong. The user's direct message resumed normal execution. No new commander/task/approval was created, and no self-send is repeated.

062 candidate6f8aeab0cbdfe9e013541f5cf30e16c93fb18cd3 still needs separate review before publication. Fresh Windows34664375319 Chrome/Edge SUCCESS, clean candidate/spec blob9a3488f3b7e5d2c94666a64529a679bc863d8171 and remote branch confirmed; main a757. Its packet includes this061 acceptance gap. UI goal and CPU work remain unfinished.
