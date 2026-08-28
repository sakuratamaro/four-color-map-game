# Quiz, skill variety, and long-term balance plan

This document records user requirements and the acceptance plan. It does not treat an idea as balanced merely because it is implemented.

## Math quiz fairness

### Answer-position requirements

- Exactly one answer is correct.
- The correct visual slot is independently randomized.
- The correct answer's numeric rank among the six choices is independently randomized.
- Correct slots and numeric ranks must be statistically distributed across all six buckets, overall and per difficulty.
- The 6×6 joint distribution of display slot × numeric rank must cover every cell and pass an independence check; balanced marginals alone are not sufficient.
- A slot-only predictor must remain near the 1/6 chance baseline.
- Generated distractors must be unique and must not accidentally equal the answer after rounding or formatting.
- A deterministic high-volume test must fail if a fixed answer slot, fixed letter, or fixed numeric rank returns.

The canonical v4.9 source already randomizes both numeric rank and visual position. `tests/v49-quiz-bias.test.cjs` turns that behavior into a regression gate instead of relying on visual inspection.

### Ten-question pacing

Each run should contain a shuffled effort curve rather than ten questions of identical texture:

- 2 instant-recognition questions (the user's “ミタッシュン” band)
- 5 normal questions
- 2 challenging but hand-solvable questions
- 0–1 rare spike questions that are difficult but remain realistic within the selected level

The order uses a constrained shuffle: question 1 is instant or normal, the first two contain at least one instant question, spike questions appear from question 6 onward, and neither hard questions nor a single template may form a predictable three-question streak.

Difficulty changes parameter size and reasoning steps, not just obscure notation. A hard question may combine two familiar ideas; it must not require remembering an unexplained specialist identity.

### Formula hints

- Every question has one hint use.
- The hint button shows the relevant formula, diagram, or first reasoning step for 3–5 seconds (3.5 seconds normally and 5 seconds for long hard hints).
- The answer timer pauses for the full hint display and transition, and the player may close the hint early. Once closed, it cannot be reopened for that question.
- The hint is specific to the generated problem type; it never reveals the substituted final answer.
- Formula-dependent categories such as combinations, sigma, sequences, and matrices must have hints.
- Hint use is logged for balancing, but the first release should not punish the player's reward. The timer behavior will be validated in human playtests before a penalty is considered.
- The same generator should offer multiple surface forms so the quiz rewards understanding rather than memorizing one template.

## Existing-region color skills

All random choices and legality checks must run in the server-authoritative engine during online play. A recolor may never create same-color edge adjacency unless the effect explicitly merges those regions as part of one validated transaction.

### Candidate cards

1. **風化** — Choose one painted region and return it to blank. It becomes the next pending region, so the effect creates a tempo trade-off instead of deleting progress for free.
2. **色変わり** — The player selects an eligible painted region and the server changes it to a uniformly selected legal different color. If no legal different color exists, the action fails without consuming the card. This is the first implementation candidate (★3).
3. **白化・乱** — One eligible painted region is selected randomly and blanked. Lower control permits a lower rarity than targeted blanking.
4. **色交換** — Swap the colors of two selected non-adjacent regions only when both resulting colors remain legal. No partial application.
5. **地層反転** — Choose a connected chain of two or three regions and rotate their colors if every post-rotation adjacency remains legal. High complexity, not automatically high power.
6. **再彩色予約** — Mark one painted region; after the opponent's next successful color action, that region receives a random legal different color. The delay gives visible counterplay.

### Balance guardrails

- Targeted blanking is once per match and cannot target a region created during the same turn.
- Random recolor selects uniformly from eligible regions and uniformly from legal different colors.
- No recolor card may directly declare a winner or force an unavoidable loss before the opponent receives an action.
- A failed precondition never consumes a card.
- A successful existing-region interference card replaces the user's normal region-designation action for that turn; at most one such effect may resolve per turn.
- Initial implementation priority is legal recolor (★3), then legal two-region swap (★4), delayed recolor (★3–4), targeted blanking (★4, once per match), and finally chain rotation (★5, once per match).
- Rarity means unusualness and complexity, not a strictly stronger effect.
- Competitive play must offer an equal-access format such as a mirrored loan pool or shared draft; owned inventory must not become pay-to-win.

## AI and simulation balance acceptance

Completion requires more than “the rules run.” The final candidate will be tested with deterministic simulations plus an adversarial Codex/ChatGPT design review.

### Seat balance

- Run paired games with identical seeds and loadouts while swapping Player A and Player B.
- Track win rate by seat, game length, cause of victory, and first irreversible advantage.
- Initial target: each seat remains within 48–52% in large deterministic simulations; investigate anything outside 45–55% before release. Always report sample size and a confidence interval, and do not rebalance from a small sample alone.

### Card dominance

- Compare every skill against no-skill and representative opposing loadouts.
- Flag cards with excessive win-rate lift, near-mandatory pick rate, unusually low counterplay, or frequent immediate wins.
- Test duplicate-action, stale-version, disconnect, and adversarial action sequences as well as ordinary play.
- Keep a balance report that distinguishes simulation evidence, AI qualitative judgment, and untested human-fun assumptions.

### Long-term and monetization principles

- Tips, supporter badges, cosmetics, names, effects, and trophies may express support but never improve match power.
- Avoid energy timers, paid rerolls, paid card strength, or intentionally frustrating loss loops.
- Reward mastery with cosmetic history, varied maps, puzzle challenges, and equal-footing competitive formats.
- AI self-play can find dominant tactics and rule exploits, but it cannot prove that a game is enjoyable. A small human playtest remains a release requirement after automated balance gates pass.
