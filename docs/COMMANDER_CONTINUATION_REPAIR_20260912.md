# Commander continuation repair — 2026-09-12

Regression: REG-20260912-SELF-HANDOFF-01
Operation: commander-continuation-v1
Authority: the user's direct request in existing commander task 01a07b56-616e-7733-9aae-90575659688e, 「作業を再開し、また、このような不毛な停止が起きないように再発防止策を施してください」.

CANON_RECEIPT version=shared-canon-v1.1 base=a757c126e1325532bb11a719cf92d0d13401d3ae request=REG-20260912-SELF-HANDOFF-01,UDL-20260912-061/062 specs=AGENTS.md,docs/SHARED_CANON.md,docs/CHATGPT_COLLABORATION_OPERATION.md tests=tests/governance-commander-continuation.test.cjs,tests/governance-shared-canon.test.cjs

## Actual resumed work

062 review request was sent once with all 15-file raw diff, 57,256 characters, to the designated Astra chat. Actual message 336393d6-5c0d-4294-810f-3a772f7b5bd6; candidate6f8aeab0cbdfe9e013541f5cf30e16c93fb18cd3/basea757/spec UDL-062-copy-v1/blob9a3488f3b7e5d2c94666a64529a679bc863d8171/Pages_only/DB[]/Edge[].
Readback compared the first20,000 characters exactly, including all binding metadata and the review packet. The tool caps output at20,000; the entire diff tail was not independently compared. Two invalid-argument attempts retrieved nothing; one successful actual read, zero resends. The response was pending at delivery.

The same request reports061's actual published/partial state and asks disposition of one additional isolated profile to finish the repaired, bounded live canary. No additional profile, purchase, quiz, draw, match, deletion, main/Pages/DB/Edge change was performed in this repair turn. The original failed canary remains immutable evidence, not relabeled PASS.

The completed v9 source response7c83d564-d958-4c6e-9830-f363e81762f6 clears the obsolete “Astra still responding to v9” hold. Existing transfer owner's BRAIN_V9_TRANSFER_20260912.md was received and preserved: archive itself not downloaded/hashed/validated. Verified archive remainsv8. No new transfer task or bypass of blocked downloads.

## Root cause and implemented repair

The prior receive-only heartbeat saved approval, PAUSED the sole automation, then self-sent to its own active task. That send was steered into the same turn, not a separate normal worker. API acceptance was mistaken for execution and the ready release was stranded. The commander remains the release owner.

- Same task, same heartbeat IDautomation, same coordination JSON; no daemon, second scheduler, new task, or duplicate ledger.
- RECEIVE and NORMAL_WORK are phases fixed at the start of distinct actual scheduler runs.
- Receiving an exact review closes its finite wait, but queues a separate normal run when work is ready; it does not pause the whole system or self-send.
- Read-only checker resolves existing active/preparing slices and exact review bindings. It distinguishes ready-unsent, review-waiting, revision-required, approved-unpublished, and explicitly bounded live followup.
- End-turn check rejects actionable work paired with PAUSED or missing actual schedule readback.
- Three fixed20/40/100-minute checks and120-minute deadline remain. Late restarts skip missed polls, never burst-read or extend the original budget. Silence/other AI/Codex self-approval cannot authorize publication.
- Entry AGENTS and shared-canon routing now require the check. Normal owner selects the next clearly scoped existing request before ending when one is ready; the checker is not a replacement request ledger or whole-project discovery bot.
- Goal API's observed blocked label remains truthful; no fake completion/reset. The explicit resumed user turn and scheduled normal phases do the actual work.

## Verification

Initial related regression run:40/40 PASS, skip0,634ms (before adding the explicit live-followup routing case). Final run is recorded in the followup evidence below.

Final related regression run: **41/41 PASS**, skip0,605.5144ms. This includes10 executable continuation cases plus the existing canon/review/provenance/live-harness/reconciliation checks. `git diff --check` also passed. No product regression result is invented from these governance tests.

The new end-turn checker was deliberately run against the actual old PAUSED setting. It failed with ORPHANED_ACTIONABLE_WORK and ACTUAL_EXISTING_SCHEDULE_READBACK_REQUIRED. This reproduces the stale stop using real state, not only prose.

Existing automation was updated via the app API (not a hand-written TOML). API returned ACTIVE. Actual saved file readback confirms IDautomation, unchanged target and created_at1789048677730, updated_at1789193994241, statusACTIVE, exact full prompt equality. Next review receive run is2026-09-12 15:25:12 JST. Remaining fixed review slots15:45:12 and16:45:12, deadline17:05:12; checks0/3. Old061 budget remains closed with its original deadline.

After saving the verified setting, the end-turn checker returned exit0 with WAIT_REVIEW, exact062 subject/request, next slot06:25:12Z and no errors.

**Actual separately scheduled NORMAL_WORK execution: NOT_RUN at this record.** API readback and local transition tests are not substituted for that observation. The next genuine receive run must save source review and reserve a separate normal run; only that actual later run may record OBSERVED with its receipt and work result.

The [official OpenAI automation documentation](https://learn.chatgpt.com/docs/automations), fetched with OpenAI Docs, informed same-task reuse, local PC/app availability and the distinction between configuration and observing the first real run. PC-off/app-closed scheduled execution is not guaranteed.

## Review and publication boundary

This is user-authorized local operational remediation and reviewable governance evidence, not a game release candidate. No old APPROVE_DOCS is reused. A fixed governance commit will be available on the already authorized codex/dev-brain-current-20260910 branch; send its concise separate documentation review/report after the current062 response, not while Astra is generating. The independent062 game review and061 acceptance are not blocked on this documentation review.

Root worktree and other owners' uncommitted artifacts remain preserved. No game source or asset was modified. Original failure evidence, reviewed product SHAs, Windows/Pages evidence, and pending physical-device checks remain distinct.
