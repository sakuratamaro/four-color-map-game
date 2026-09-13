# UI845 review043 evidence correction

CANON_RECEIPT version=shared-canon-v1.1 governance=888e8ae7e62ed002a7eaae21d4a52776af1dc5a8 candidate=84587830730c1f62cf8c502daac4d768886a3f4d base=70e691b6f8f1d808476e80990d20df7862bfb782 request=UDL-20260907-023,UDL-20260906-014,UDL-20260910-054 specs=docs/UI_PUBLIC_MATCH_ACTIONS_20260913.md,docs/UI_PLAY_SURFACE_20260912.md tests=tests/standard-online-browser.test.cjs

## Genuine decision retained

Actual ChatGPT task 改修ロールバック防止策, 6aa229e7-e098-83ee-ac5e-d366a12653a4.
Original request ef4742c7-afbb-478b-8965-0210ef000f5e matched3852characters exactly.
Complete reply 23050cab-6dd2-494a-a14f-707f79a6a517,2754characters, read2026-09-13T06:27:21Z with the original40minute slot reserved before the one read.
Saved verbatim as CHATGPT-REVIEW-20260913-043 in CHATGPT_REVIEW_DECISIONS.json.
Decision HOLD is genuine and remains binding; the following log discrepancy does not authorize Codex to clear it.

Binding: candidate84587830730c1f62cf8c502daac4d768886a3f4d, base/release-after70e691b6f8f1d808476e80990d20df7862bfb782, canon shared-canon-v1.1, spec UDL-023-public-actions-v1/blob468dad9e85fa633e47ea75a79628d18a0ad10565, Pages_only, DB/Edge/managed sets[].

## B1 evidence mismatch

Review043 says online148/149 and a UDL066 catalog test timeout at the first cards-tab click. Its quoted job and SHA are the same as our evidence, but that failure identity is not in the exact job's actual failure summary.

After receiving043, the commander fetched Chrome job103679089219 logs once through the purpose-built GitHub job-log tool. The entire424292-character result equals the previously saved tool result exactly; no new run or retry was created.

[Original attempt1 Chrome job](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34740424933/job/103679089219)

Relevant exact lines below have only ANSI formatting escape sequences removed:

```text
2026-09-13T05:29:43.1500863Z [command]"C:\Program Files\Git\bin\git.exe" -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=1 origin +84587830730c1f62cf8c502daac4d768886a3f4d:refs/remotes/origin/codex/ui-public-match-actions-20260913
2026-09-13T05:29:45.2542888Z  * [new ref]         84587830730c1f62cf8c502daac4d768886a3f4d -> origin/codex/ui-public-match-actions-20260913
2026-09-13T05:29:45.5343314Z 84587830730c1f62cf8c502daac4d768886a3f4d
2026-09-13T05:29:45.9236526Z 84587830730c1f62cf8c502daac4d768886a3f4d
2026-09-13T05:31:08.5143620Z ℹ tests 657
2026-09-13T05:31:08.5144898Z ℹ pass 657
2026-09-13T05:31:08.5145919Z ℹ fail 0
2026-09-13T05:31:19.3964306Z ✔ UDL066 fresh catalog exposes all 21 native detail buttons without creating a profile or spending (3542.1235ms)
2026-09-13T05:37:09.1448839Z ✖ actual browser selects Half Shift and Triple Shift bands on the board at 390px (31939.8154ms)
2026-09-13T05:43:26.3122191Z ℹ tests 151
2026-09-13T05:43:26.3122863Z ℹ pass 150
2026-09-13T05:43:26.3123069Z ℹ fail 1
2026-09-13T05:43:26.3133708Z ✖ failing tests:
2026-09-13T05:43:26.3134985Z ✖ actual browser selects Half Shift and Triple Shift bands on the board at 390px (31939.8154ms)
2026-09-13T05:43:26.3136191Z     - waiting for locator('#skillTargetControls').getByText('対象：上から4行目') to be visible
2026-09-13T05:43:26.3139958Z     log: [ "  - waiting for locator('#skillTargetControls').getByText('対象：上から4行目') to be visible" ]
```

This proves checkout845, contract657/657, catalogPASS, and online150/151 with Half/TripleShift row4 locatorFAIL. It does not prove the actual CI root cause. The original job remains FAILURE, Edge151/151PASS remains separate, and the current frozen candidate is not published.

## Bounded local diagnosis

The unchanged exact Shift test passed three ordinary local Chrome observer runs,1/1 each,skip0. No untouched local failure reproduced.

In a controlled fixture counterexperiment, changing the viewport after measurement reduced the actual board328 to292px. Reusing the old relative coordinate hit native row5; the product correctly showed row5 and the unchanged row4 assertion timed out. Under the same controlled resize, returning fresh geometry selected row4 and the complete original test, including exact Half/TripleShift action payloads, passed.

See [diagnosis](SHIFT_BAND_POINTER_DIAGNOSIS_20260913.md), [compact measurements](SHIFT_BAND_POINTER_DIAGNOSIS_20260913.json) and the fixture-only observer scripts/diagnose-shift-band-pointer.cjs. No product/test patch, timeout/assertion weakening, synthetic click, CI rerun, production or user-data change occurred. This is mechanism evidence, not originalCI-cause proof or a waiver for CPU039.

## Requested supplement

Ask the same real Astra reviewer once to correct B1's failure identity and judge the narrow next action on these exact sources. Proposed next work is test-coordinate stability plus deterministic resize coverage in a separate successorSHA, retaining all original row/highlight/payload assertions and requiring its own Windows/review gates. Do not implement a catalog rewrite based on the wrong log premise or resend the full16-file845 patch.

A same-logical845 supplement uses the original05:46:14Z start and07:46:14Z expiry, with only the original07:26:14Z read slot remaining. The first06:06:14Z slot stays forfeited;06:26:14Z was consumed once. No new120minute budget or silent approval.

Parent70e/042 source-artifact hold, release order, CPU100/9590/039, old040 rawFAIL and consumed trial,067/062/F3 remain unchanged. Additional live/profile/match/find/recruit0. Documentation export is not APPROVE_DOCS or game publication.

Governance verification: first shared-canon run17/18PASS failed because the new genuine043 had not yet been added to the explicit exact-binding fixture. Added that exact subject/base/spec/source binding and HOLD/raw-discrepancy preservation assertions without weakening the gate. The combined continuation/shared-canon/v14 suite then passed57/57, fail/skip/cancel0,397.0655ms. Observer syntax and git diff checks passed. Product845 remains clean; unrelated BRAIN_V9_TRANSFER SHA256 remains0c4e4c51074ed2a8f491144014ec57f133960f8748f6e88a1d96d47d4d0fa782.

## Supplement delivery and retained finite resume

Evidence commit d992a81035410a224ef07657c044b7b5209e73ee was pushed force-free to the explicitly authorized codex/dev-brain-current-20260910 branch; its correction document was fetched successfully from the fixed GitHub URL. Seven text files only, no images. This is evidence publication, not main/Pages or game publication.

One2308-character substantive supplement was reserved before send at2026-09-13T06:42:48Z and accepted by the same real ChatGPT task. Bounded delivery read1 returned only old043 while the task was active. Read2 found request e547dc5b-3f8a-4b02-80ad-7add9d3ab93e with the entire2308-character body exactly equal; actual task active and no assistant response in the retrieved turn. Verified by2026-09-13T06:48:31Z. No resend, new review consumption or approval inference. Exact body and source are in the existing public_match_followup.review_supplement; original request/reply043 remain in history and decisions.

The existing heartbeat automation alone is ACTIVE for2026-09-13T07:26:14Z (16:26:14JST), updated_at1789281934375, original target01a07b56-616e-7733-9aae-90575659688e. Complete actual TOML prompt/calendar/target were compared exactly after the API update. Original start05:46:14Z, expiry07:46:14Z, firstslot forfeiture and secondslot consumption are unchanged. This schedule is configuration evidence, not future execution evidence.

After saving the delivered supplement, the focused governance suite again passed57/57, fail/skip/cancel0,445.6497ms. The real end-turn checker returned WAIT_REVIEW for exact e547dc5b/845/original07:26slot with no errors and more than two minutes' margin. No extra reviewer read, old CI polling, product mutation, profile/match/live or production operation followed.

Current broad goal turn made PROGRESS through controlled diagnosis, genuine043 receipt, exact log reconciliation and delivered substantive supplement. The whole goal is not complete. Parent70e fresh-source and CPU039 human-operation holds are unchanged, not new approval requests. Kurogane100 remains adopted and implemented in frozen9590, not yet published.
