# UDL-048 exact candidate review packet

CANON_RECEIPT version=shared-canon-v1.1 base=f8713d7006da0619b9c356d53a472754833fb910 request=UDL-20260910-048 specs=docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/QUIZ_MEMO_CALCULATOR_20260912.md tests=tests/standard-quiz-scratch.test.cjs,tests/standard-online-browser.test.cjs

Owner: existing commander task `01a07b56-616e-7733-9aae-90575659688e`. Shared-canon branch remains `codex/dev-brain-current-20260910`; product branch/worktree `codex/quiz-memo-calculator-20260912` is separate. No new resident controller or duplicate review queue.

- Candidate: `a6c24f496338412a7cb4e933b0faba06cb28ccce`
- Base: `f8713d7006da0619b9c356d53a472754833fb910`
- Product commit: `9478a9f9bcc104acbdf25a4f80861e0068f0c4fb`; final commit adds only the narrowly scoped CI trigger, its exact contract and runbook explanation.
- Specification: `UDL-048-memo-v1`, product `docs/QUIZ_MEMO_CALCULATOR_20260912.md`
- Specification Git blob: `3182edb815f723039ceacb41ae00e5e05391ee93`
- Review: game release / `Pages_only`, DB `[]`, Edge `[]`.
- Branch push confirmed; main and public Pages remain the base. No release approval claimed at packet preparation.

[Fixed complete diff](https://github.com/sakuratamaro/four-color-map-game/compare/f8713d7006da0619b9c356d53a472754833fb910...a6c24f496338412a7cb4e933b0faba06cb28ccce)

[Fixed specification](https://github.com/sakuratamaro/four-color-map-game/blob/a6c24f496338412a7cb4e933b0faba06cb28ccce/docs/QUIZ_MEMO_CALCULATOR_20260912.md)

## Scope and implementation

Lv.5 only. Transparent full-viewport pen, eraser, 100-step Undo and undoable Clear; safe recursive-descent four-operation calculator with bounded expression and eight-entry history. Pointer capture for mouse/touch/pen, normalized coordinates, DPR cap 3 and frame-coalesced drawing. Memo ON makes normal background UI inert, pauses only option movement, not quiz time. OFF keeps ink visible but pointer-transparent, preserves option nodes/positions, resamples velocities and guards accidental answers for 450 ms. Original timeout, match handoff and fatal dialogs take priority.

One bounded sessionStorage entry uses session ID plus acknowledged answer index. Same question/reload/pending answer/transport failure/retry retain data; new acknowledged question, completion or invalid/expired/new session clears only scratch. Modules receive no question/answer/grading metadata and contain no network access or dynamic code execution. Canvas/quota/parser failures do not disable quiz answers. Existing answer/finish payloads, pendingQuiz persistence, hint/room pauses, option density, generator, rewards, odds, CPU, cards, DB/Edge/engine are unchanged.

Controls are at least 44px; keyboard focus wraps only through currently visible controls, Escape exits, and important dialogs preempt memo. Entry is immediately above the question; opening/rotation aligns it below desktop sticky navigation. Calculator starts collapsed; panel OFF stays sticky. Visual inspection caught and fixed inherited opaque board-canvas styling and the rotation scroll offset before the candidate was fixed.

## Executed checks and their limits

- Final clean `a6c24f4`: all 134 non-Playwright test files, **900/900 PASS**, fail/skip/cancel 0, 60.707 s. Prior product commit `9478a9f` also 900/900. No clean-candidate check was weakened.
- Pure arithmetic/state/privacy boundary: **38/38 PASS**.
- Actual local Chrome: **11/11 PASS**, including eight new UDL-048 cases and existing quiz regressions. Actual local Edge: **8/8 new cases PASS**. Final rotation/alignment change rechecked on both, **1/1 each**; product source is unchanged in final CI commit.
- Cases cover drawing/eraser/Clear→Undo; calculator invalid/zero division/limits; unchanged option DOM/positions; timer progression/timeout exactly once; same-question reload and same-action failed-answer retry; acknowledgement clearing; session completion/expiry; lower-level ineligibility; quota/canvas failure; keyboard/inert/Escape/critical dialog; matched-room precedence; browser-native pen/touch/cancel; 390px/rotation/DPR2/3 and payload privacy. Browser input emulation is not physical-device acceptance.
- All three existing builders ran; generated Local/Edge/registry bundles have zero diff. Product git diff --check and clean status pass.
- [Windows gate 34626368159](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34626368159), push event, exact `a6c24f4`. Chrome job `103352343608`, Edge `103352343857`. Both contract/build steps passed; full browser stage IN_PROGRESS at packet preparation, not yet a final PASS.
- Browser control connection failed twice; GitHub PR connector returned 403. No PR was created. The old CI-only remote branch is not an ancestor and was preserved. Existing workflow now also accepts pushes to this exact dedicated branch, with the same finite Windows Chrome/Edge jobs, read-only permissions and paths. No wildcard/main trigger or new workflow.
- Earlier failed tests are retained in the local logs: stale expected cache marker, dirty-candidate proof, an invalid payload-field expectation, and hidden-details keyboard traversal. Source/expectation issues were corrected and current checks rerun; none are asserted as passing in their failed state.

## Publication check plan, not yet executed

After genuine exact-candidate release review and Windows success, fresh main ancestry check, force-free main update and same-SHA Pages success are required. The bounded `scripts/live-standard-quiz-memo-canary.cjs` on the governance branch will first compare all seven relevant public assets with exact candidate Git bytes. Only after byte equality will it create one authorized isolated test profile, use one ordinary Lv.5 quiz, draw/calculate, verify running timer, OFF/reload/resize preservation, next-question ACK clearing and completion. It uses no response/clock/game-state injection, no existing player's session, no gacha/matches or data deletion. It records operation counts rather than credentials or player identifiers. Syntax/opt-in guard checks are separate from live success.

Public gameplay and physical devices are **NOT_RUN** at preparation. Candidate release approval is **PENDING**, never inferred from documents, old reviews, silence or Codex's own judgement.

## Independent incoming backlog

v7 is queued for deduplicated intake. The actual latest paired v8 user/Astra messages (`bbb21715-8ab0-4dfb-ad2f-b46883434765` / `c1c1a98e-749e-42ec-8a95-2ef30abd5035`, designated chat) were read while implementing. They replace color-position-fixed presentation with role-position-fixed separate slots and request simpler lobby/battle/purchase UI. This is queued separately; it does not revoke completed role identification/reward navigation or alter this memo candidate. No personal details from that conversation are copied into this public packet.

Please review this fixed candidate and return `DECISION`, `SUBJECT_SHA`, blockers and scope-bound notes. This request is not an attempt to reopen completed 052/055/059 reviews or use a documentation approval for game release.

## Delivery and gate completion receipt

Windows run `34626368159` finished **SUCCESS** at `2026-09-11T17:25:26Z` for exact `a6c24f4`, both Chrome `103352343608` and Edge `103352343857`. Product source was not amended during the run.

Review request was sent once through the existing ChatGPT connection. First bounded transport read still showed the preceding completed turn; the second confirmed user message `94d51f28-a7ba-48fe-b175-dfb951eba226` with **full prompt equality**. ChatGPT was generating, with no assistant decision yet. No resend or approval inference. Shared artifact at delivery was `19ecf246f71d00a2d8b97bad6c77180bca0c9177`; this later receipt is not a different product candidate.

The existing finite wait uses conservative start `2026-09-11T17:25:00Z`, checks at 17:45 / 18:05 / 19:05 UTC, maximum three and hard expiry 19:25 UTC, without resetting on restarts/candidate revisions. The previous completed UDL059 budget is retained separately. Opt-in guard for the live canary exited 2 with no network writes as required; live behavior and physical devices remain NOT_RUN.
