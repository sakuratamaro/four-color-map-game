# Shift-band test-coordinate repair

CANON_RECEIPT version=shared-canon-v1.1 governance=e85a504d3e44015e15c00134fdea0c8980e1ea38 public_base=954e1c5c52d5453fc9fee9872b2d7e922f850a39 candidate_base=84587830730c1f62cf8c502daac4d768886a3f4d request=UDL-20260906-014,UDL-20260910-054,UDL-20260907-023 specs=docs/UI_PLAY_SURFACE_20260912.md,docs/UI_PUBLIC_MATCH_ACTIONS_20260913.md tests=tests/standard-online-browser.test.cjs,tests/canvas-native-pointer.test.cjs,tests/standard-browser-gate-workflow.test.cjs worktree=.codex-worktrees/ui-public-match-actions-pointer-20260913

The existing root commander started normal local work2026-09-13T06:52:44Z. Previous turn was PROGRESS: reproducible controlled diagnosis, genuine043 receipt, exact-job discrepancy and delivered substantive correction. The current turn does not consume another review read before the original07:26:14Z slot.

## Fixed local successor

Candidate b9c91af38986d96b226906ab5485aa1fe0b64088, branch codex/ui-public-match-actions-pointer-20260913, clean derivative from845. Fresh remote main was954e1c5c52d5453fc9fee9872b2d7e922f850a39. Product code/assets remain byte-identical to845; feature spec remains UDL-023-public-actions-v1,blob468dad9e85fa633e47ea75a79628d18a0ad10565. Aggregate UI release base remains70e, and no parent orCPU approval transfers to this newSHA.

Five changed text files: tests/helpers/canvas-native-pointer.cjs, tests/canvas-native-pointer.test.cjs, tests/standard-online-browser.test.cjs, tests/standard-browser-gate-workflow.test.cjs, .github/workflows/standard-browser-gate.yml. No game/UI/catalog/runtime/CPU/SQL/Edge/managed/image changes.

The helper performs native actionability without clicking first, then measures the current canvas and computes the intended interior point. It accounts for the locator padding-box origin versus the game's border-box grid. The final action remains one ordinary locator click: no force, DOM dispatch, added sleep, lowered expected row, timeout increase or retry. Only the existing Half/TripleShift test uses this helper plus the new regression; all original row4/column3/highlight/exactpayload/outerboundary/cancel/focus/overflow assertions remain.

The new real-browser regression injects a real390x844 to390x630 viewport resize precisely at the native-readiness boundary, then requires a smaller current canvas, exactly one trusted pointerdown on row4 at the measured width, row4 UI text, action0 before confirmation and exact HalfShift ROW4/plus payload. The wrapper delegates both trial and actual clicks to the real locator; it does not fabricate target state or events.

[Playwright's native click documentation](https://playwright.dev/docs/api/class-locator#locator-click), read2026-09-13, documents trial actionability without the click. Local and workflow-pinned Playwright are1.62.1. The Windows workflow adds only this exact successor branch, the two exact helper/unit watch paths and the unit contract; Chrome/Edge, Windows2025,20minute bound, read-only permissions, serial test lists and unchanged prior gates remain.

## Executed evidence

- Initial helper unit3/3PASS153.9451ms.
- Native Chrome originalShift + newresize2/2PASS,skip0,10649.4054ms.
- Deliberately reversed measurement/readiness order in the new helper: unit2/3FAIL151.2484ms (old144.6/120 point versus fresh128.4/106.5), native newresize0/1FAIL4696.388ms (stale328px returned after actual resize). These are controlled mutation failures, not originalCI failures. Both completed and owned browsers closed before restoring the correct helper.
- Restored helper plus workflow/harness contracts14/14PASS251.7267ms,skip0.
- Native Edge originalShift + newresize2/2PASS,skip0,11505.9595ms.
- Syntax and git diff checks passed; b9c91af committed with clean worktree.
- At2026-09-13T07:09:16Z, the clean full non-browser run is RUNNING in local session98187:148/164 files selected solely by absence of direct actual Playwright require. The16 real-browser files are excluded, not claimed passed or skipped. Existing pinned PGlite dependency reused read-only, no install or DB connection.

The original845 Chrome150/151FAIL, Edge151/151PASS, genuine043HOLD and corrected failureidentity remain untouched. Controlled geometry proves a mechanism under imposed resize, not the root cause of that originalCI event. No blindCI rerun or CPU039 substitution. The pending2308-character supplement e547dc5b retains the original05:46:14Z start,07:26:14Z last read slot and07:46:14Z expiry. Parent70e source-person handoff, CPU100/9590/039 manualCI gate, old040/067/062/F3 and unrelated dirty BRAIN_V9_TRANSFER remain preserved.

## Publication

NOT_RUN. Local successor initially NOT_PUSHED,Windows NOT_RUN, new exactreview NOT_SENT. No production find/recruit, profile, match or live attempt. This local repair does not borrow043 or042, create a new wait budget or clear the parent70e release-order/source gate.

## Full local result and exact Windows handle

The local full run finished1002/1002PASS, fail/skip/cancel0,74901.551ms. The148-file selection excludes16 actual Playwright-import test files rather than labeling them passed. Existing threebuilders were then run once; all tracked outputs remained unchanged and the candidate worktree was clean.

b9c91af was pushed force-free to its exact new branch. New Windows run34744571394 attempt1 was created2026-09-13T07:10:33Z for exactlyb9. At07:15:59Z, Edge103689982812 and Chrome103689982883 were both IN_PROGRESS in online-browser, with generated bundles and contract steps successful, Edge local lifecycle successful and Chrome lifecycle's pre-existingSKIP preserved. No final Windows success is claimed.

Initial discovery used an unsupported filename-form workflow URL twice and returned connector INVALID_ARGUMENT/HTTP400; this was not evidence of a missing or failed CI run. Using the documented repository run collection with exact headSHA found the actual same new run. No credential, rerun, dispatch, alternate authorization or additional candidate commit was used to create a replacement.

Aggregate70e..b9 contains18 text files. UI_PUBLIC_MATCH_ACTIONS_POINTER_REVIEW_20260913.patch is54028characters/57353UTF-8bytes, SHA25667e987c08b3b654cee797f5723eb008600829867826933b4d8104f307ff24a6e and is byte-identical to the direct git diff. It includes all original UI845 changes plus the five-file test/CI repair. New review is NOT_SENT while the already delivered845 correction awaits its original lastslot; old043 cannot approve this newSHA.

The existing continuation checker now preserves this exact owned repair as NORMAL_WORK review preparation after the old review closes, without creating a second queue, publishing, rewriting any wait budget or inheriting approval. A due valid original review retains priority; wrong source/base/spec/changeset/owner or a send already attempted cannot route this preparation. Initial governance57/58FAIL correctly rejected a fixture whose pending envelope still saidPages_only after its active source-hold fixture changed toPages_Edge. Added an explicit invalid-binding assertion and corrected that fixture envelope; all58/58 then passed, fail/skip/cancel0,428.2631ms. No gate was waived.

OpenAI Docs was used only to update the same existing scheduled task, following the fetched official [scheduled-task documentation](https://learn.chatgpt.com/docs/automations). It influenced keeping the existing chat and recording durable current candidate/hold/stop instructions. Actual heartbeat remainsACTIVE for the original07:26:14Z slot, updated_at1789283959236, fullTOML prompt/calendar/target exact. No new model or scheduled-task implementation, original07:46:14Z deadline unchanged; configured future execution is not claimed observed.

## Genuine044 and terminal Windows evidence

Original100minute slot was consumed once before the paired read at2026-09-13T07:27:25Z. Complete genuine response e1d16e25-92cb-487e-83ca-14f0dce042a3 to exact2308-character e547dc5b is4499characters, actualtaskidle/turncompleted. Saved verbatim as044: HOLD845 remains; Astra withdraws its wrong catalog investigation and explicitly permits the narrow test repair, deterministic resize and successor-specific Windows without requiring an845 rerun. This is not approval ofb9.

New exactb9 Windows34744571394 attempt1 finishedSUCCESS at07:24:51Z. Finaljobs: Edge103689982812 SUCCESS; Chrome103689982883 SUCCESS. Both exactcheckout b9, contracts660/660 and online152/152PASS. Edge lifecycle79/79PASS, Chrome lifecycle's existingstepSKIP unchanged. OriginalShift and newresize each explicitlyPASS in both joblogs; UDL066 catalog alsoPASS. No wholeworkflow skip0 or CPU039 clearance claim.

Astra044 requests only845..successor five-file patch, product identity evidence and own Windows, not the original16file resend. SHIFT_BAND_POINTER_REPAIR_REVIEW_20260913.patch is the new submission artifact; the full18file aggregate was generated locally but is not sent as a duplicate. Git's generic whitespace check rejected its legitimate unified-diff blank context lines; do not strip these bytes to make a source-file style check green. Revision artifact is separately verified by exact gitdiff bytes and read-only applicability to frozen845, while ordinary source/doc changes retain git diff --check.

Originalreview checks are now2 consumed plus1forfeited, remaining0, originalexpiry07:46:14Z unchanged. A successor's fixed review request cannot reset that budget or imply publication. Parent70e source/releaseorder andCPU100/039/040/067/062/F3 remain preserved.

The five-file artifact passed exact15336byte/SHA256ca85807836d81b1167452f9c141eebb8f89ed030e8201fee411a8f71393ca295 comparison and read-only applicability to frozen845. Canonical currentUI now identifies b9, preserving full old845 review metadata in candidate_revision_history. Exact branch/worktree pairs alone route through the same helper; a mixed old/newpair is rejected, spent review slots cannot revive. Focused governance59/59PASS412.5341ms,skip0; normal startchecker selects SEND_REVIEW for b9. These governance changes are not claimed APPROVE_DOCS.

## Final handoff and finite stop

Eight explicit text files were committed/pushed asad566d6276f7d62cc1fc085c6244826abc50beae. Remote fixedfivefilepatch body matched all15219characters. A separate real blank EOF in the newly created reviewpacket initially failed ordinary whitespace checking; it was corrected before that commit. This is distinct from the legitimate unifieddiff context-line artifact; neither source checking nor patch byteproof was waived.

The root reserved one successor reviewsend and its first deliverycheck at07:45:28Z. SendAPI accepted at the exact existing realAstra destination. Deliverycheck1 returned old044pair whileactive; secondcheck was reserved before API and completed07:46:46Z, again old044pair/active. New body and requestID remainNOT_CONFIRMED; no third deliveryread, resend, newreviewconsumption or response claim. The exact sent body is retained in the existing slice. Delivery checks are not a new polling budget; the original2used+1forfeited slots and07:46:14Zexpiry remain closed.

Following the existing finite policy and OpenAI Docs skill, the same heartbeat was actuallyPAUSED; API and fullTOML string/calendar/target readback match, updated_at1789285754548, originalcreated_at1789048677730 unchanged. Endchecker STOP/FINITE_WAIT_ENDED_NO_SILENCE_APPROVAL, errors[], adjacentclock07:50:31Z. Final scoped governance59/59PASS412.1625ms,skip/cancel0. No scheduled execution is inferred. The broad usergoal remains active/incomplete and this actualprogress turn is not markedblocked; no livejob or eligible automaticreviewwait is claimed. Genuine newresponse/user resumption or independently eligible work can resume through the existing commander.

No main/Pages/Edge/DB/managed/live mutation in this turn. Parent70esource handoff, CPU100/039 separateCI gate and original failures remain. Optional18file aggregate remains local/untracked and was not resent. Unrelated BRAIN_V9_TRANSFER and artifact folders are preserved.
