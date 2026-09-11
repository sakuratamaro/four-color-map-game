# UDL-048 memo and calculator release

CANON_RECEIPT version=shared-canon-v1.1 base=f8713d7006da0619b9c356d53a472754833fb910 request=UDL-20260910-048 specs=AGENTS.md,docs/SHARED_CANON.md,docs/CHATGPT_COLLABORATION_OPERATION.md,docs/QUIZ_MEMO_CALCULATOR_20260912.md,docs/STANDARD_PUBLIC_RELEASE_RUNBOOK.md tests=scripts/live-standard-quiz-memo-canary.cjs,tests/governance-shared-canon.test.cjs,tests/standard-decision-reconciliation.test.cjs

## Exact release binding

- Normal user-resumed commander work, not a receive-only heartbeat.
- Clean product worktree: `.codex-worktrees/quiz-memo-calculator-20260912`; branch `codex/quiz-memo-calculator-20260912`; unchanged candidate `a6c24f496338412a7cb4e933b0faba06cb28ccce`.
- Base `f8713d7006da0619b9c356d53a472754833fb910`; spec `UDL-048-memo-v1`; blob `3182edb815f723039ceacb41ae00e5e05391ee93`.
- Scope `Pages_only`; DB `[]`; Edge `[]`. No deployments or database changes for this slice.
- Actual review `CHATGPT-REVIEW-20260912-009`, response `c2ade94f-bf09-40c8-b010-302d17264a30`, paired with request `94d51f28-a7ba-48fe-b175-dfb951eba226` in the designated Astra chat. Complete response and exact binding saved in `CHATGPT_REVIEW_DECISIONS.json`.
- Windows [34626368159](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34626368159) succeeded at the same SHA. Prior clean 900/900 and browser evidence are in `ASTRA_QUIZ_MEMO_REVIEW_20260912.md`; no redundant full test run needed for unchanged files.

## Review wait closure

The user-resumed bounded read found the complete approval. The first call failed argument validation (requested text limit too large); corrected to the supported 20,000 characters without any resend. The existing automation was set to PAUSED via its API and the saved config was read back: updated_at=1789148333425, prompt equality=true. Original 17:25 start and 19:25 expiry, automatic checks 0, remain preserved. No duplicate scheduler.

## Publication

Initial candidate `a6c24f4` was fast-forwarded from fresh `f8713d7` with no force; remote readback matched. Pages [34629235891](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34629235891) completed/success at this SHA, updated_at 2026-09-11T17:43:39Z. Candidate preflight passed and all seven served assets matched exact Git bytes. One isolated permitted profile completed one real Lv.5 quiz: functional **36/36 PASS**, one start/ten answers/one finish, no gacha/matches, no injected responses/clocks/game state, no errors, ink/calculator retained on reload and cleared on next ACK/completion. Evidence: `QUIZ_MEMO_LIVE_20260912.json`.

However, actual 390px screenshot inspection found the question outside the viewport. Native local reproduction confirmed question y=908..982 in an 844px viewport after opening Memo. The fixed bottom tabs have a computed top in pixels; the initial alignment counted them as a top obstruction. Functional 36/36 does not establish visual acceptance, and the goal remains incomplete. No data loss or quiz persistence defect was observed.

Follow-up candidate `c4be0ec19217b04186dc9d721b99760f103f0872` changes only top-edge recognition, the portrait calculator's scrollable height ceiling, cache markers, specification/runbook and regression. The new portrait→landscape→portrait native-input test first failed on a6c24f4, then passed after the fix. Spec `UDL-048-memo-v1.1`, blob `347b31327c14937530b019a4eb36b9a9e22d5a30`, base a6c24f4; DB/Edge []. New review and Windows run34630093000 pending. Approval009 is not reused. The public canary now explicitly asserts question visibility before and after calculator expansion. Physical devices remain NOT_RUN.

## Successor goal

Explicit user instruction on 2026-09-12 in this commander task: finish memo/calculator first, then make UI design simplification the next goal and start work. Existing transfer task `01a08d9e-ae35-7f70-a879-cb342dafef47` was asked for the latest brain ZIP, hash, manifest and parent/delta checks. v8 paired source is already queued; artifact verification is pending. The next goal is queued in existing coordination, not created early or substituted for this unfinished goal. Follow small reviewed UI slices; preserve published behavior and secrecy.

OpenAI Docs [Follow a goal](https://learn.chatgpt.com/use-cases/follow-goals) was consulted for durable goal operation. The product goal tool is used; no new controller or approval polling loop is created.
