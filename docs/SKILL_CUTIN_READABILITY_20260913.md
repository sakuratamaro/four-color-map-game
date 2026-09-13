# Skill cut-in readability and observed results

Version: `UDL-065-readability-v1`

Owner: existing Codex commander. Request: `UDL-20260912-065`, alias `ADD-20260913-CUTIN-READABILITY-RESULT`.

`CANON_RECEIPT version=shared-canon-v1.1 base=d9ce111d7d97019d55b3e90842602001e045ea04 request=UDL-20260912-065 specs=AGENTS.md,docs/SHARED_CANON.md,docs/SKILL_CUTIN_20260912.md,docs/BRAIN_V14_DELTA_INTAKE_20260913.json tests=tests/standard-skill-cutin.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/skill-cutin-readability-20260913`

The entrypoint and v14 intake above are read from the existing shared branch `codex/dev-brain-current-20260910@36998082177e9ea5b5933a7389cbf87820b5d11c`. The clean product base is the separately verified main SHA above. Do not copy the governance branch's older product files into this slice.

## Source and adopted scope

The actual user message `bbb2135e-cfd1-4da8-845b-9e3d07d8b29a` in ChatGPT `6aa229e7-e098-83ee-ac5e-d366a12653a4` asks for slightly more reading time and a short explanation of the used skill and its result. The paired v14 package is `5339aea3-bc6b-4fb2-9467-ef8a082c0538`. Its 1.8-second value is an AI design proposal, not a user-mandated numeric rule.

This small Pages-only slice adopts 1,800 ms, with a stationary readable interval from 10% to 90% (1,440 ms). Reduced motion uses the same total duration without movement. This roughly doubles the old one-second window without pausing the match or requiring dismissal. The duration is shared between the JS cleanup timer and CSS animation.

An already displayed event may finish its bounded reading interval through a consecutive ordinary state update. Such an update invalidates pending, not-yet-displayed claims; it neither replays nor extends the old event. New skills replace the current card, without a queue. Scope changes, version gaps, hidden tabs, dialogs, contact/random reveals and terminal state still interrupt immediately. Version numbers, transport and match clocks are never modified.

## Evidence-only explanation

- Only a matching successful own action ACK may supply an otherwise unavailable skill name. Exact no-op ACK remains `空振り`, with no destination effect.
- Compare canonical distinct own available palette colors (not adjacency/legal moves), own visible seals and public geometry. State a verified change in color count, a replacement, seal count, required area size, area count, color or shape. The palette wording explicitly refers to the viewer.
- The summary is a short observation of the just-completed action, not a claim about the current board after later actions. Do not claim a win, rescue or success from a generic event.
- Opponent `USE_SKILL` does not contain a skill name. Keep the neutral title and do not read hidden opponent palette, hand, stock, bonus roles or private state. Known public `LEGAL_RECOLOR` may explain its observed color change without inventing a catalog title.
- No observable delta means neutral confirmed usage, not an invented effect or inferred no-op. Public-state-only summaries do not establish coverage of every skill's hidden effects.

Named opponent skills remain an explicit follow-up requiring separately reviewed public-event data. This partial slice does not mark the entire v14 skill-name/result request complete.

## Acceptance and non-change boundaries

Executable coverage must demonstrate result selection and privacy, order/duplicate normalization, the 1,800 ms DOM/CSS duration at 390/1280 px, readable placement, unchanged pointer/focus behavior, normal input and state updates while visible, delayed-claim cancellation, one event once, reduced motion, priority interrupts and optional-module failure. Screenshot inspection supplements tests; it is not physical-device acceptance.

No new image, game rule, CPU policy/charge, hand, reward, DB, Edge, managed flag or live-test entitlement. Preserve the fixed CPU candidate `9590a4212d69185fc93df31b552d9bd870d5a9a3` and review039's separate CI/release conditions. This new candidate needs its own fixed review, Windows gate and publication evidence; old025/026/028/039 approvals do not apply.

Initial state: implementation in progress; tests not yet run; commit/push/review/main/Pages/live not run. Follow-up evidence is recorded without amending a reviewed candidate.
