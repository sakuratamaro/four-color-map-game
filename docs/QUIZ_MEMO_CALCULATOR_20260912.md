# UDL-048: Level 5 scratch paper and calculator

CANON_RECEIPT version=shared-canon-v1.1 base=f8713d7006da0619b9c356d53a472754833fb910 request=UDL-20260910-048 specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md tests=tests/standard-quiz-scratch.test.cjs,tests/standard-online-browser.test.cjs

Specification version: `UDL-048-memo-v1`.
Owner: existing Codex commander, task `01a07b56-616e-7733-9aae-90575659688e`.
Worktree: `.codex-worktrees/quiz-memo-calculator-20260912`.
Branch: `codex/quiz-memo-calculator-20260912`.
Shared-canon routing and UDL-048 are read from the existing governance branch at `0e6b229deafe41883ce2508a38606481f590f17f`, not from the frozen root or the old optional-textarea proposal.

## Accepted boundary

- Level 5 only: Memo ON enables transparent, full-viewport pen/eraser/Undo/Clear and a four-operation calculator. Normal UI cannot receive pointer or keyboard activation until Memo OFF. OFF preserves visible ink and returns pointer/scroll access.
- Mouse, touch and pen use pointer capture and normalized coordinates; resize, orientation and DPR 1/2/3 preserve ink. Controls have at least 44 CSS px targets. Escape exits, focus is contained/restored, and background UI is inert only while ON.
- Memo is not a timer pause. Existing hint and room pauses remain authoritative. Timeout forces OFF and uses the original answer path without the memo/accidental-answer lock blocking it.
- One sessionStorage entry, scoped by session ID plus confirmed `answers.length`. Same-question render, reload, pending answer, transport failure and retry retain scratch data. Confirmed next question, completion, invalid/expired/abandoned session or new quiz clears it. Never erase unrelated storage.
- Scratch data and calculator state never enter `pendingQuiz`, answer/finish payloads, RPC, analytics or server. Helper modules receive no questions, answer keys, grading functions or private metadata.
- Calculator accepts digits, decimal point, parentheses, unary signs and + - × ÷ only. No dynamic code execution. Incomplete/invalid expressions, zero division, non-finite results, quota/corrupt storage and canvas failure must leave the quiz usable.
- No changes to option density, question generation, reward amounts/odds, CPU, game rules, DB or Edge. Memo toggling does not rerender options or reset their positions. OFF refreshes velocities only, with a 450 ms accidental-answer guard.

## Engineering defaults and verification

Initial defaults from the reviewed design: pen 3 CSS px, eraser 20 CSS px, 100 undo operations, 250 ms save debounce, 12,000 retained points per question, 512 KiB serialization budget, calculator history 8, expression 96 characters/64 tokens/12 nesting depth and 12 significant display digits. Resource ceilings fail closed for scratch input, never for answering.

Required checks: pure parser/state negative cases; actual Chrome/Edge level eligibility, drawing/eraser/Clear→Undo, OFF pointer/scroll, focus/Escape, timer timeout bypass, same-question reload, failed-answer retry preservation and successful-answer clearing, room handoff precedence, privacy payload checks, 390 px and desktop/rotation/DPR. Physical-device acceptance is separate and not inferred from browser emulation.

Memo entry sits immediately above the question. Opening and active viewport rotation align that entry and question below any top-fixed navigation without rebuilding the option DOM. The bottom-right tool panel keeps the calculator collapsed by default; its sticky OFF control remains reachable when the panel scrolls. The scratch canvas explicitly overrides the existing board canvas background/border so it is actually transparent.

Implementation is present; validation is in progress. No candidate release approval, Windows gate or publication is claimed yet. Goal completion requires those separate stages and public verification.

| Acceptance | Executable coverage |
| --- | --- |
| Arithmetic/invalid input, scope, corruption/quota, Undo/resource ceilings, no grading/network access | `tests/standard-quiz-scratch.test.cjs` |
| Native mouse ink, eraser, Clear→Undo, calculator, inert background, same-question reload, rotation/DPR3, unchanged option nodes/positions, accidental-answer lock | `UDL-048 memo ink…` in `tests/standard-online-browser.test.cjs` |
| Failed answer, same action ID through reload/retry, clear only after ACK, DPR2 | `UDL-048 failed answers…` |
| Existing timeout route, forced OFF, exactly one timeout, unchanged payload fields | `UDL-048 timeout exits…` |
| Lv.4 hidden, Lv.5 eligible, Canvas/quota failure with calculator/answer fallback | `UDL-048 lower levels…` |
| Keyboard/closed calculator focus traversal, Escape, 44px controls, fatal dialog precedence | `UDL-048 keyboard focus…` |
| Matchmaking handoff precedence without lost question | `UDL-048 matched-room…` |
| Browser-native pen/touch/cancel with one stroke per gesture | `UDL-048 native pen…` (browser input emulation, not physical acceptance) |
| Completion/session expiry clear, unrelated storage preserved | `UDL-048 completion…` |

The Windows workflow includes the pure scratch tests and the existing full online browser file on both Chrome and Edge. Tests are implementation, not prose-only acceptance. Their results and exact candidate are recorded separately after the candidate becomes clean.
