# Gacha entry diet

Version: `UDL-062-gacha-entry-v1`

CANON_RECEIPT version=shared-canon-v1.1 base=03bc21f6ba927f71ce05efc438827d547993b21c request=UDL-20260912-062 related=UDL-20260911-059 worktree=.codex-worktrees/gacha-entry-diet-20260914

## Authority

Adopted v14 user message `bbb2135e-cfd1-4da8-845b-9e3d07d8b29a` in ChatGPT `6aa229e7-e098-83ee-ac5e-d366a12653a4`. The existing UDL062 crosswalk is `BRAIN_V14_DELTA_INTAKE_20260913.json`; aliases `ADD-20260913-GACHA-FIVE-LEVEL-BUTTONS` / `ADD-20260913-GACHA-ODDS-ALL-LEVELS-ON-DEMAND`.

Direct user requirements: five visible Lv1–5 selections; the two explicit draw actions “1枚引く” / “全部引く”; remove repeated acquisition/balance paragraphs from normal view; initially closed odds entry with all five levels together, without promotional probability copy.

AI choices, not direct quotes: compact count and pressed state on native buttons, responsive5/3 columns, native details/table, acquisition rules in separate optional help. The existing registry builder derives odds from authoritative `standard/standard-gacha-transaction.js`; there is no second hand-maintained numeric UI table.

## Acceptance

1. Five counts and selection agree. Selection and details open/close perform draw0. Pointer/keyboard, >=44px targets, visible focus and no page overflow/fixed-nav obstruction at390/320px, short landscape and enlarged text.
2. Only explicit one/all starts new draws. All retains the existing100 cap, explained when stock exceeds100. Zero stock disables both actions and never silently switches Lv.
3. Preserve059 saved rewardLv versus quiz challengeLv, manual selection across hydration/tab changes, and pending-draw precedence. Busy/unsynced/handoff cannot create/replace draws. Preserve actionId/ticketLevel/count through errors/reload/retry.
4. Initially closed odds table contains allLv1–5 rows and rarity1–5 columns. Actual generated rates equal unchanged transaction definitions; opening/closing changes neither selectedLv nor draw count. Experimental cards remain excluded; remove promotional/floor copy, not odds.
5. Remove normal-view repeated inventory/acquisition/persistence prose but keep actual errors, pending-result recovery, necessary rules and outcome feedback. Existing result cards, saved CPU reward origin and pending rematch recovery are preserved. UDL060 all-screen lobby-first rematch work remains separate.

## Boundaries and proof

Pages_only; DB/Edge/managed[]; new image bytes0. No odds/price/reward/limit/server protocol/quiz/CPU/image/card-sale/profile changes. No new production profile/draw/quiz/match/live/cleanup budget. Fixtures are not production transactions or physical acceptance.

Parent publication70e→b9→87→df62→03bc is required; closed parent budgets and held21cc/8dd9/GOV exports stay closed. Quiz049 is not approval of this candidate. This slice needs its own fixed SHA, tests, Windows, genuine review and later release evidence. Physical and production gacha acceptance are NOT_RUN.

Regression mapping: `tests/standard-gacha-entry.test.cjs` (structure, guards, generated rates), `tests/standard-online-browser.test.cjs` (native UI/mocked transaction/recovery), existing quiz-reward-gacha, gacha-transaction, online-skill-registry, UI/matchmaking and release-preflight tests. Prose does not count as implemented tests.

