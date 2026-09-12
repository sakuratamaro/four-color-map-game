# UDL067 revision after the second Windows failure

CANON_RECEIPT version=shared-canon-v1.1 base=2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152 request=UDL-20260912-067,UDL-20260910-048,REG-UDL048-ROOM-SYNC specs=docs/SURRENDER_CONFIRMATION_20260913.md,docs/QUIZ_MEMO_CALCULATOR_20260912.md tests=tests/standard-online-browser.test.cjs,tests/standard-surrender-confirmation.test.cjs
Owner: existing commander01a07b56-616e-7733-9aae-90575659688e; existing branchcodex/surrender-confirmation-20260913. Pages_only DB[] Edge[]. No new profile/match in this revision's local tests.

## Genuine033 and original failed evidence

Actual ChatGPT2394c582-b972-492d-9ef9-7c48fa829a16 responding to28d25760-2a7a-4fe0-9c48-bb7ca4888b9a said APPROVE_WITH_CONDITIONS for exact23133ef52efb81c39d0623479b0ea7819f850f7d, base2fc, UDL-067-surrender-v1/blobe5f2c0617d3defcc8dc6105bf567f6ed59fb4432. It accepted B1's bounded resize synchronization, but required both same-SHA Windows jobs completed/success. At Astra's observation both were in progress. This is not an unconditional release approval and does not cover the new product/specification.

Subsequently Windows34708897042 completed FAILURE. Chrome103593903621 SUCCESS; Edge103593903473 FAILURE. Edge contracts595/595, lifecycle79/79, online143/144 (skip0) passed except original UDL-048 memo ink/calculator/focus/reload node-identity assertion at line393. Test duration17332.9985ms; online total778332.3956ms. The old B1 quiz-resize test passed on both jobs. Neither Windows failure is erased or called a pass.

Unchanged231 local Edge targeted original memo test:1/1 PASS10746.1666ms, test body10096.6522ms, cleanup normal. This was diagnostic baseline evidence, not a fix or CI retry.

## Deterministic diagnosis: REG-UDL048-ROOM-SYNC

The quizPhysics fixture also retains an existing private room; healthy playing-room fallback reads occur every15000ms. A same-room snapshot runs refreshRoom → render → renderQuiz. The latter unconditionally stopped physics and replaced option children, even while memo remained active on the same question.

Added a real mock-room invalidation test on unchanged231 product source. Edge0/1 FAIL7333.774ms (body6602.4511ms), skip0, normal cleanup. Saved diagnostic excerpt:
```
sameNodes:false, samePositions:true, active:true, answers:0
Element.replaceChildren (test audit)
renderQuiz app.js?v=20260913-41:3098:20
render app.js?v=20260913-41:3570:3
refreshRoom app.js?v=20260913-41:3451:8
```
This deterministically confirms a real existing UI regression; it is not hidden by making the fixture roomless or deleting the original assertion. Its correspondence with the CI failure follows the original line393 plus 17.3s duration and15s fallback; the original CI job did not capture this added stack, so those two evidence sets remain distinct.

Repair: retain the current motion/options when the rendered session, acknowledged question index, question/options, busy/room lock/pending answer and hint inputs are exactly unchanged and all existing nodes remain attached. Preserve clock synchronization. Changed inputs follow the original rebuild, listener teardown, retry and ACK paths. The new test forces two refreshes, preserving nodes/positions and zero answers; original assertions and all test timeouts/tolerances remain.

## Local revision evidence

Product c8325d290e0926eb599a05e32e563bf618f7f793:11files80add14delete relative231. App42; surrenderJS/CSS1 and all surrender logic/copy/assets/engines unchanged. Specification becomes UDL-067-surrender-v1.1/blob1e7e2a4c02acd58ed40ca0b6f2fbb0513f333463 to explicitly cover the regression.

- Initial repaired Edge original memo+new regression:2/2 PASS14696.0688ms, skip0.
- Chrome13/13 PASS105047.8117ms; Edge13/13 PASS105174.4439ms, skip0. Includes all memo cases, same-action failed-answer/ACK, hint, timeout exactly once, room handoff, full-button physics/reflow and per-question feedback. Local mock backends, not live or physical acceptance.
- Clean c832 non-Playwright141files936/937 PASS62605.2556ms. One static failure: runbook's current candidate asset still app41. The product/behavior tests are not altered.
- Final f507c0b2dd9701f3ac1867131150b5e48d0ada8d adds only three runbook cache references41→42. Specification blob unchanged. Final clean141files937/937 PASS61204.6228ms, fail/skip/cancel0. It is a separate success; c832's original static failure remains failed.
- Governance continuation36/36 PASS321.2623ms, including APPROVE_WITH_CONDITIONS routing to bounded CI/diagnosis/release checks without rewriting the review decision. Failed/in-progress CI never routes straight to release.

## Bounded post-publication preparation

Final branch push confirmed231→f507 (forceなし). [New Windows34710997698](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34710997698) was observed IN_PROGRESS on exactf507. No final CI success, main/Pages change or revised Astra approval is claimed.

scripts/live-standard-surrender-canary.cjs and tests/governance-surrender-canary.test.cjs are governance-only preparation, not run against production. Eight policy/identity/deadline/settlement/audit tests PASS184.2675ms after redaction hardening; no-opt-in CLI exit2, no network. One original240s deadline includes cleanup; ordinary work stops at155s to reserve85s. CPU6 and SURRENDER2 include all browser/direct retries/cleanup. Unknown result retries retain the complete first envelope; terminal read precedes cleanup and finished rooms receive no extra surrender. Rejected/unexpected operations, console, settlement and deadline are saved independently even after UI failure. Report uses a new path with exclusive-create; tokens/IDs/private state are not serialized. No new067live trial or physical-device result is claimed.

All old failures, genuine033's original scope and closed066/065/062 evidence remain. New candidate/specification requires its own exact Astra decision. Existing original067 wait17:15:08→19:15:08 UTC remains2/3 consumed; only18:55:08 slot remains if this revision is sent. No reset, extra controller, blind CI rerun or silence approval.
