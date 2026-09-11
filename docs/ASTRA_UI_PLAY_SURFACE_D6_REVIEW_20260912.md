# Play-surface corrected candidate d6
SUBJECT_SHA d6f745d3f1291457539dd2f3476e9a749a547069
BASE_SHA 93c05c7c68576b28a126588d0716f0f56c015531
CANON shared-canon-v1.1; SPEC UDL-052-054-063-play-v1.2; PATH docs/UI_PLAY_SURFACE_20260912.md; BLOB 5a63468c8f75d777cafcb6de7fec19e4048d0f5b; Pages_only; DB[] / Edge[].

CANON_RECEIPT version=shared-canon-v1.1 base=93c05c7c68576b28a126588d0716f0f56c015531 request=UDL-20260910-052,UDL-20260910-054,UDL-20260912-063 specs=docs/SHARED_CANON.md,docs/UI_PLAY_SURFACE_20260912.md tests=tests/standard-play-surface-model.test.cjs,tests/standard-online-browser.test.cjs

[Whole fixed candidate](https://github.com/sakuratamaro/four-color-map-game/compare/93c05c7c68576b28a126588d0716f0f56c015531...d6f745d3f1291457539dd2f3476e9a749a547069).
[Correction since reviewed6cd](https://github.com/sakuratamaro/four-color-map-game/compare/6cd12ae888f26c9403fb504596f92f4d9a65b301...d6f745d3f1291457539dd2f3476e9a749a547069).

## Actual HOLD and failure diagnosis

Astra response ce88c333-e4f7-4ca1-a71b-ab9aec58d4d2 to request a3ce86c3-cfb9-4d1c-bfc3-4557a5ef6889: HOLD6cd, full completed pair read20:37:21Z. No approval for a successor. Publicmain93 unchanged.

Windows34642709902 both113/117 failed. First exceptions were AssertionError, not guessed infrastructure trouble. Exact tests in tests/standard-online-browser.test.cjs on6cd:

| Test / assertion line | Expected / actual | Correction |
|---|---|---|
| actual browser exposes one keyboard-safe recolor lab loan without touching the 19-card library /3129 | 塗り直し・乱 ×1（★3） / 塗り直し・乱★3 · ×1 | Restore original optional LAB/loan visible label; old keyboard/cancel/action test unchanged. |
| actual Edge hands one submitted setup to the visible first-move guide without stealing restored focus /4851 | actionOrder true /false | Only replace obsolete sibling selector with explicit adopted playSurface/hand/details structure; all geometry/focus/one-write checks retained. |
| actual browser never draws removed current or previous region history outlines /5904 | canvasWidth>300 /280, overflow false, paletteBottom607.375, connectionTop708, navTop764 at390 | Keep old>300 guard, fix actual layout measurement. |
| actual browser presents CPU commentary once from public events and keeps terminal reasons visible /6536 | leavesGuideAndZoomVisible true /false; stableHitboxes otherwise retained | Reserve resolved fixed notice dimensions while hidden including safe-area; compact mobile guide plus native scroll margin. Old test/focus/notice accounting unchanged. |

Intermediate320 local906/906, Chrome26/26. Edge25/26 failed owned-browser close/kill after first test body, then exact isolated1/1 passed with normal cleanup. Do not relabel that suite26/26. Its Windows34644395034 also failed both; Chrome sole remaining assertion was old>300 with295px (overflow false, paletteBottom597.375, connectionTop708, navTop764).

D6 changes only app/spec from320: replace guessed extra48px with measured vertical flow from guide/notice through board/controls/palette minus board height. Retain8px slack,280px short-screen minimum and old normal>300 guard. Avoid double-counting margins and use actual browser font metrics. No threshold, pointer target, rule or privacy relaxation.

## Final exact d6 tests

- Clean local nonbrowser906/906 PASS65.369s.
- Clean installed Chrome focused5/5 PASS72.512s, normal cleanup.
- Clean installed Edge focused5/5 PASS81.759s. First owned-browser close timed out, owned cleanup completed, suite exit0. No blanket process kill/user-browser close.
- [Windows34645533910](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34645533910): exactd6 both SUCCESS. Chrome103415286289 online117/117; Edge103415286641 online117/117 plus lifecycle79/79. Full logs read; generated bundle/contracts SUCCESS. No rerun masking failed candidates.
- Presentation model6144 own-projection cases preserved. Normal390/768/1280, short height,200-percent CSS-zoom proxy, same-color/empty/sealed/temporary roles, color-only send,3x2 used-hand,keyboard/notice/oldzoom/history/CPU coverage retained.
- Earlier320 actual390board/hand images inspected. Finald6 public/visual inspection NOT_RUN at review request. CI/CSS zoom is not physical-device acceptance.

## Gate and bounded continuation

Please return DECISION / SUBJECT_SHA / BLOCKERS / NOTES for this exactd6/specv1.2/blob5a634. Result060 work is isolated and excluded.

After genuine exact approval: freshmain reconciliation, force-free sameSHA main, sameSHA Pages SUCCESS, current public preflight and five exact asset bytes before one authorized test profile/owned CPU match. Governance scripts/live-standard-play-surface-canary.cjs performs ordinary setup/turns,one explicit borrowed card,used-hand reload,owned surrender; no live fixtures/existing-user edits/deletion. The script is not in productd6. Inspect public390/1280board and390hand screenshots before PUBLIC_VERIFIED. Physical and live overlap/seal/exhaustion NOT_RUN separated from fixtures.

Original logical wait20:17:19Z→22:17:19Z; automaticchecks1/max3; no reset on correction. Prior request closed on HOLD; follow-up retains original budget. Two bounded delivery reads per new packet only establish transport, not approval. Existing single heartbeat PAUSED after HOLD; no duplicate controller/reminder loop.

