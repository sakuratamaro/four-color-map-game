# CPU palette / Kurogane100 fixed candidate evidence

CANON_RECEIPT version=shared-canon-v1.1 base=d9ce111d7d97019d55b3e90842602001e045ea04 request=UDL-20260910-051,ADD-20260913-KUROGANE-PALETTE-100 specs=docs/CPU_PALETTE_EFFICIENCY_20260913.md@9590a4212d69185fc93df31b552d9bd870d5a9a3 tests=standard-cpu-palette-efficiency,standard-kurogane-palette-charges,standard-cpu-rollout,standard-cpu-palette-sql-runtime,all-non-Playwright worktree=.codex-worktrees/cpu-palette-efficiency-20260913

Candidate:9590a4212d69185fc93df31b552d9bd870d5a9a3, branch codex/cpu-palette-efficiency-20260913, exact origin push confirmed. Base d9ce111d7d97019d55b3e90842602001e045ea04. Spec UDL-051-palette-v1.1 blob de0cc9e2299a8a69dd1bfbc9368cd98042ca9b9f.
[Complete fixed23-file diff](https://github.com/sakuratamaro/four-color-map-game/compare/d9ce111d7d97019d55b3e90842602001e045ea04...9590a4212d69185fc93df31b552d9bd870d5a9a3) fetched via GitHub: ahead2/behind0, all23 text patches available, no images. Fixed commit was tracked-clean before/after full tests; no product source changes since.

## Actual local executions

Bundled Node24.19.0, test-concurrency1, spec reporter. Pin PGlite0.5.8 installed with existing frozen lock/ignore-scripts, no upgrade.

Clean latest9590 full suite:148 of164 test files, excluded16 existing Playwright-require files for separate Windows browsers;998/998 PASS,fail0,skip0,cancel0,todo0. Started2026-09-12T22:43:29.816Z,finished22:45:34.136Z. Node duration124165.7562ms,wall124318ms,exit0,stderr empty. Actual session87917/chunk3dcd5d terminal summary, not inferred from commit. A read-only Git status at22:52 then later confirms tracked clean. Native browser/physical coverage is not part of this count.

Focused latest checks: F1 core10/10PASS8497.7516ms; Kurogane charges+actual full handler16/16PASS1297.908ms; combined10files101/101PASS11148.2008ms. Old/new SQL18/18 runtime plus final full rerun. New charges5tests include real100→99→98 across accepted windows, same-window rejection, exhausted charge, serialization restore, and old21/PvP/otherhand invariance. Full handler11tests include service-loaded saved identity, client-spoof rejection, current activation independence and no initialize retry refill.

Limits: authored deterministic observations, not historical match reconstruction, all10 stock-hand benchmark, measured strength/win rate, native Supabase race, actual browser console or physical acceptance. No production SQL/Edge/managed/main/Pages writes or live profiles/matches in this candidate's work.

## Failure and supersession history

Old all10-suppression fa2789c975095792fe4219b0aea5023b9eaa58f0 was frozen/pushed then explicitly superseded by later direct user Kurogane100 instruction before any review or publication. Its991/991 clean pass304806.1949ms is preserved but never substituted for latest9590 tests.

Initial authored palette fixtures failed first-seat/category-window assumptions; corrected fixtures follow actual CREATE/COLOR phases and own-WORK return. Legacy expected hashes generated from frozen publicd9ce, not the new implementation. Initial new100 consumption fixture4/5 failed by treating CREATE_FIRST as COLOR; fixed the fixture's action selection without weakening product assertions, then16/16 passed. These failures are not retroactively counted as passes.

Governance integration initially60/61: one old assertion still looked for completedF3 in the active successor slot due a line-ending patch miss. Corrected to retrieve the same exact immutableF3 in existing completed history. No release checker/source authentication loosened. Later rerun is separate evidence.

## Exact artifact digests

| Candidate file | SHA256 |
|---|---|
| supabase/functions/standard-game-action/index.ts | 6664cb433692c1e2301bc599f7f7af1939178d310460aacb5794d4eac8256b73 |
| supabase/functions/standard-game-action/standard-engine.bundle.js | b66c6b9491b6991d34db3ef2eca669661ca23c8ae3845d55dab6bc80f07c0349 |
| supabase/migrations/202609130002_standard_cpu_palette_efficiency.sql | 86d51b48525a36c616407c36429f6ed178ee2fb85ef44f78c1ba5ac3e345d33b |
| supabase/verification/standard_cpu_palette_efficiency_verify.sql | bbdd47d04517415dca9c5f2afc3ce877121d3cfd6d91aedf2041136b22a058ea |
| local app.bundle.js | 0bf2ff58555d2a33fd4576ea784c3eba1c256ebcabdea0e9e99718da1596f094 |

SQL verification asserts exact normalized prosrc/ACL for supported a848e4a470f6c367032651acc72b135b, current280767ea9fe41fe36e223e117f08b24d, startaa26d84704cbcd7b75e2daec8a4bcb91,31supported/30current,active CPU support. Actual PGlite SQL5/5 returned true; production NOT_RUN.

## Windows and release boundary

[Exact9590 Windows run34723536140](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34723536140): at2026-09-12T22:57:34Z IN_PROGRESS. Chrome103633567880 and Edge103633568024 CPU contract steps succeeded; Edge lifecycle succeeded, Chrome lifecycle intentionally skipped. Both online browser steps still in progress. No rerun requested. Final state must be read and saved separately before release.

F3d9ce/036/038 remains completed scoped proof in successor_goal.completed_independent_slices; consumed one-shotRei smoke is never reused.067 remains partial/rawFAIL with no automatic extra attempt. No new candidate approval exists yet; genuine exact9590 review is required. v14 source/intake update is not game or documentation-introduction approval.

### Final attempt1 and bounded diagnosis (2026-09-12T23:09Z)

Run34723536140 attempt1 completed FAILURE. Chrome103633567880 SUCCESS, contracts656/656 andonline145/145PASS612580.4907ms,completed22:56:01Z. Edge103633568024 FAILURE,contracts656/656/lifecycle79/79PASS,online144/145FAIL865834.2056ms,completed23:01:27Z. One unchanged testHalf/TripleShift390px at3259 timed out30000ms awaiting target4th-row text. Onlineapp/index/style andthetest file have zero diff fromd9ce. Focused unchanged localEdge executed separately1/1PASS7541.7016ms. RootcauseUNPROVEN, not a verified product regression or confirmed infrastructure flake. No tests loosened or skipped.

One intended failedEdgejob rerun reserved. GitHub connector returned403 integration permission; signed-inGUI exactjob exposed Re-runthisjob but input/state timed out, and one selection recovery failed. ActualAPI23:09 confirms stillattempt1/completedFAILURE; no secondCIstarted. No blind retries/anotherpipeline/policy weakening. Production gate remains FAILURE until real exact-SHA successfulrerun. Fixed candidate review can proceed in parallel only with this failure explicitly disclosed, not as a completed release gate.

Governance follow-up after the retained60/61failure: same5files61/61PASS708.7232ms,skip0,exit0. The existing completedF3record is now used in the historical test; exactapproval/consumedtrial checks remain strict. The transfer-ownerBRAIN_V9_TRANSFER edit is preserved uncommitted and excluded from this commander's commit.

## Actual dispatch and resumption receipt

Evidence1327deefee789adedf31301fc43e430fe9358c3f was pushed to the existing governance branch; GitHub full11file diff fetched with all patches. Product9590 remains unchanged. One4543-character request sent to genuine ChatGPT 改修ロールバック防止策. Reservation2026-09-12T23:14:20Z. First delivery read returnedoldv14+active; second returned actualuser message718d0bfa-6d26-4931-ac81-22a21542ec50, full body exactlyequal, no agentreply yet. Delivery confirmed23:17:18Z, no thirdread/noresend. Fixed20/40/100minute slots23:34:20Z/23:54:20Z/00:54:20Z; harddeadline2026-09-13T01:14:20Z. F3closed budget retained unchanged in completed_review_waits, no reset. Reviewpending is notapproval; CIattempt1 remainsfailed, retry hasnotstarted.

OpenAI Docs [existing-chat scheduling guidance](https://learn.chatgpt.com/docs/automations) used to reuse only automation ID automation. UpdateAPI ACTIVE, actual savedTOML exact prompt/status/target/time equality, updated_at1789255049992. NextactualRECEIVE23:34:20Z (08:34:20JST), not proof of futureexecution. check-commander-continuation --end-turn returns WAIT_REVIEW bound9590/request718d0bfa,errors[]. Final5filegovernance61/61PASS780.7884ms skip0, no product retestclaimed. Computer Use attempted only the CIrerun UI; after one failedrecovery it was stopped, not treated as a successfulrerun. Existingdirty root andtransfer-ownerBRAIN_V9_TRANSFER remain untouched. New main/Pages/Edge/DB/managed/live writes0.

## 2026-09-13 08:45 JST genuine039 receipt and no-production preparation

The original20minute slot was reserved at23:34:36Z and consumed once. An invalid maxOutputCharsPerItem30000 was rejected before reading; corrected20000 produced one actual read, with the original4543-character request exactly equal, completed/idle response fd9b3fa2-dd74-4379-a0e7-7cf05ad31ff9 (4311characters). Full response saved as CHATGPT-REVIEW-20260913-039: **APPROVE_WITH_CONDITIONS**, exact9590/base/spec/SQL002/Edge2/newmanaged setting. The conservative receipt anchor is23:34:36Z and completed read/save was confirmed by23:37:00Z. No replay of old036/037/038.

The new review explicitly approves Kurogane's exemption and finite100 initial charges. **B1 remains Windows Edge failure.** One unchanged failed Edge job rerun may satisfy CI without another review, using prior Chrome success and preserving original failure/unknown cause. A second failure requires diagnosis, not retry-until-green. Changed code/test/spec/SHA is outside039. The connector403, UI timeout and current-turn alternate browser-read auto-review rejection are not execution evidence. No bypass was attempted. A single precise manual Re-run this job request was sent to the user; started_runs remains0.

New039 canary preparation is scripts/live-standard-cpu-palette-canary.cjs and tests/governance-cpu-palette-canary.test.cjs, on the governance branch, **12/12 local fixture PASS515.3428ms**, skipped0. It requires original exact review source, sameSHA Edge attempt2 actual-success evidence, specified completed staging gates and exclusive CPU_PALETTE_LIVE_20260913.attempt.json admission. Only1newprofile/1Kurogane/240seconds/8CPU send attempts/1SURRENDER; no second attempt or F3/067 budget reuse. Final snapshot-v2 and own-profile results remain independent after failure. API-only leaves browser/console/physical/100hiddencharges/winrate unmeasured. Live reservation/profile/room/mutation count remains0. Product9590 worktree remains clean.

The combined6filegovernance suite initially passed72/73 (794.6721ms): the old explicit review-binding fixture did not yet list039. Added039's exact source/candidate/spec/SQL/managed-set/bounds; did not weaken existing bindings or product CI. Final73/73 PASS981.9193ms, skipped/cancelled/todo0. This is separate from the unchanged product998/998 and still-failed Windows Edge.

The wait is closed after one slot, original01:14:20Z expiry retained and two unused slots closed. Following OpenAI Docs [scheduled-task guidance](https://learn.chatgpt.com/docs/automations), only existing automation was updated to PAUSED; API and actual savedTOML agree, updated_at1789256614476, original schedule/target/name preserved, exact prompt readback. There is no running CI job to poll. Local preparation and independent reward audit are recorded; no approval-response polling or blind CI retry continues while the human-only restart is outstanding. This is not overall-goal completion or a claim that future resumption executed.

Independent v14 UDL046 code/history audit is REWARD_RANGE_AUDIT_20260913.md, fixed shared evidence011b95e:26/26 unchanged tests, first/base/candidate module blob identical. Original numeric adoption source remains unresolved; no economy change or rollback assumption.
