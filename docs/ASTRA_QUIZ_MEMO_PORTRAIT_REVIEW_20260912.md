# UDL-048 portrait correction: fixed candidate review

CANON_RECEIPT version=shared-canon-v1.1 base=a6c24f496338412a7cb4e933b0faba06cb28ccce request=UDL-20260910-048 specs=docs/QUIZ_MEMO_CALCULATOR_20260912.md tests=tests/standard-online-browser.test.cjs,scripts/live-standard-quiz-memo-canary.cjs

## Subject

- SUBJECT_SHA: `a26ffd14a8f896d9d087dac032d8f079ece82f7d`
- BASE_SHA: `a6c24f496338412a7cb4e933b0faba06cb28ccce`
- SPEC_VERSION: `UDL-048-memo-v1.1`
- SPEC_BLOB: `347b31327c14937530b019a4eb36b9a9e22d5a30`
- SPEC_PATH: `docs/QUIZ_MEMO_CALCULATOR_20260912.md`
- REVIEW_KIND: game_release; SCOPE: Pages_only; DB_CHANGE_SET: []; EDGE_CHANGE_SET: []
- [Complete fixed diff](https://github.com/sakuratamaro/four-color-map-game/compare/a6c24f496338412a7cb4e933b0faba06cb28ccce...a26ffd14a8f896d9d087dac032d8f079ece82f7d)
- [Exact specification](https://raw.githubusercontent.com/sakuratamaro/four-color-map-game/a26ffd14a8f896d9d087dac032d8f079ece82f7d/docs/QUIZ_MEMO_CALCULATOR_20260912.md)

## Public finding and correction

Approval009's exact initial candidate reached main and Pages34629235891 successfully. Candidate preflight, 7 full asset-byte comparisons and one real isolated Lv5 quiz passed 36/36 functional checks. The commander then inspected the public 390px screenshot and saw the question offscreen. The first public record is retained in `QUIZ_MEMO_LIVE_20260912.json`; it is not labeled visual acceptance or goal completion.

A native local Chrome reproduction placed the question at y=908..982 in a viewport844 high. The old `getComputedStyle(fixedBottomTabs).top !== "auto"` predicate treats a bottom-fixed bar's resolved pixel top as top navigation. The new geometry measures after entry scroll and only offsets chrome closer to the viewport top edge. The portrait calculator height is limited to62dvh with its existing internal scroll and sticky OFF button, leaving question space. No question content, answers or metadata are passed to helper modules.

Changes are limited to this positioning defect, portrait panel height, app v20260912-29 and CSS v20260912-2 markers, one native-input portrait→landscape→portrait regression, and specification/runbook consistency. Memo JS, parser, storage, time, answer dispatch, ink coordinates, game rules, engine, cards, CPU, rewards, DB and Edge are unchanged. No new workflow or branch trigger was added.

## Evidence and remaining gates

- New portrait regression failed on the original candidate before the fix, then passed on Chrome and Edge after it.
- c4be0ec implementation: actual Chrome UDL048 **9/9**, Edge new portrait **1/1**, skip0. New screenshot inspected: question remains visible above expanded tools.
- c4be0ec full nonbrowser: **899/900**, one old asset string in another runbook section failed. a26ffd1 changes only that documentation string; focused runbook **7/7**, then final clean a26ffd1 full nonbrowser **900/900**, skip0, 58.035s. Git diff confirms product and browser-test files are identical between c4be0ec and a26ffd1.
- Three generated bundles rebuilt with zero diff; product worktree clean at a26ffd1.
- Windows [34630426525](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34630426525) is the final exact-candidate gate. At preparation it is IN_PROGRESS, not passed. The earlier c4be0ec run34630093000 is retained and not substituted.
- Public follow-up not run yet. After genuine approval and Windows success: fresh main reconciliation, force-free main update, exact-SHA Pages, preflight, 7 byte comparisons, one permitted isolated profile/ordinary Lv5 quiz. The existing public canary adds explicit question visibility checks on memo open and calculator expansion (38 total). No state/clock/response injection, gacha, matches or deletion; physical NOT_RUN.

## Decision requested

Please return DECISION / SUBJECT_SHA / BLOCKERS / NOTES for this new fixed binding. Approval009 is not reused. Preserve the original finite review deadline rather than resetting it for this candidate revision. After this correction is publicly verified, the user explicitly requested the next goal be UI design simplification. That future design is not part of this game-release approval.
