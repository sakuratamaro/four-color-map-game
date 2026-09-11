# UDL023 entrance — quiz-notice regression follow-up

SUBJECT_SHA `93c05c7c68576b28a126588d0716f0f56c015531`

BASE_SHA `a26ffd14a8f896d9d087dac032d8f079ece82f7d` (initial entrance was NOT published)

CANON_VERSION `shared-canon-v1.1`; SPEC_VERSION `UDL-023-entrance-v1.1`; SPEC_PATH `docs/UI_DIET_ENTRANCE_20260912.md`; SPEC_BLOB `dd839a5424fc13ecd9d6b604023666b1996cbd76`; scope `Pages_only`; DB[]/Edge[].

[Entire entrance candidate](https://github.com/sakuratamaro/four-color-map-game/compare/a26ffd14a8f896d9d087dac032d8f079ece82f7d...93c05c7c68576b28a126588d0716f0f56c015531). [Only the follow-up](https://github.com/sakuratamaro/four-color-map-game/compare/a9b2ff984c448819483286eae5acfa91530fc5db...93c05c7c68576b28a126588d0716f0f56c015531).

Initial Windows34635024201 failed both browsers: exactly the existing test `waiting-opponent arrival does not move or announce over a focused timed-quiz choice`, noticeOptionIntersect true, line3992. Removing the all-tab profile editor changed quiz positioning so the existing fixed recruitment notice could cover the focused choice. Reproduced locally before correction; not a flaky failure or a test to delete. Initial901/901 and focused9/9 did not prove this full-browser invariant.

The follow-up is four files: ui-diet.css adds `scroll-margin-block:90px` to quiz choices, index bumps only this CSS marker to v20260912-2, specification states the invariant, and a new native test exercises every option at390/900/1280px. Margin is present before notification arrival; no notification-triggered scroll, focus movement or announcement is introduced. The preexisting failing test is unchanged. No app.js/quiz/parser/timer/server changes in this follow-up; app remains v20260912-30.

Executed final exact clean nonbrowser **901/901 PASS**, skip0,89.993s. Actual Chrome **6/6** and Edge **6/6** include both new and unchanged notification regression, every-option geometries, three entrance routes, public find→wait/lost-no-recruit, and memo portrait. Initial exact candidate's9/9 entry lifecycle evidence is retained but not presented as rerun on the successor. Builders remain unchanged from the zero-diff initial run.

[Windows34636944139](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34636944139) is running on93c05c7; both jobs are required. No main/Pages publication yet. Exact review of93c05c7 is required; an a9b2ff9 approval cannot authorize it. Keep the original UI review wait start18:51:55Z, expiry20:51:55Z and consumed count; no reset/resend of the same delivered request.

Public plan is unchanged except CSS marker2: exact index/app/ui-diet.css bytes before one isolated profile; actual public navigation, keyboard, CPU roster, My Page and reload; no matchmaking write against real players. Script `scripts/live-standard-ui-entrance-canary.cjs`. All physical devices NOT_RUN. Later role-palette model becf83c is separate, local-only,5/5 including6144 private-own projections; no DOM or release claim, and not part of this approval.
