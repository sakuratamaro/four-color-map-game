"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const { createQuizQuestions } = require("../standard/quiz-session.js");
const { createStandardQuizController } = require("../standard/standard-quiz-controller.js");

function questions(seed = 9127) {
  const rng = createRngDomains(seed, ["structure", "content", "rank", "order"]);
  return createQuizQuestions({
    structureRandom: () => rng.structure.next(),
    contentRandom: () => rng.content.next(),
    rankRandom: () => rng.rank.next(),
    placementRandom: () => rng.order.next(),
  });
}

test("quiz controller exposes six inert labels without answer, value, rank, or correctness metadata", () => {
  const controller = createStandardQuizController({ questions: questions(), selectedLevel: 4 });
  const started = controller.begin(1000).projection;
  assert.equal(started.stage, "QUESTION");
  assert.equal(started.question.options.length, 6);
  assert.deepEqual(Object.keys(started.question).sort(), ["band", "options", "prompt", "timeMs", "type"]);
  for (const option of started.question.options) assert.deepEqual(Object.keys(option).sort(), ["id", "label"]);
});

test("hint freezes remaining time, blocks answers, expires once, and never changes reward", () => {
  const controller = createStandardQuizController({ questions: questions(9128), selectedLevel: 5 });
  const started = controller.begin(0).projection;
  const before = controller.projection(700).remainingMs;
  const hint = controller.openHint(700);
  assert.equal(hint.ok, true);
  assert.equal(controller.projection(1700).remainingMs, before);
  assert.equal(controller.answer(started.question.options[0].id, 1700).code, "HINT_ACTIVE");
  const expired = controller.tick(hint.endsAt).projection;
  assert.equal(expired.hintActive, false);
  assert.equal(expired.remainingMs, before);
});

test("three misses finish with a public reward only after explicit advance", () => {
  const source = questions(9129);
  const controller = createStandardQuizController({ questions: source, selectedLevel: 3 });
  let projection = controller.begin(0).projection;
  for (let miss = 0; miss < 3; miss += 1) {
    const correctLabel = source[miss].options.find((option) => option.isCorrect).label;
    const wrong = projection.question.options.find((option) => option.label !== correctLabel);
    const answered = controller.answer(wrong.id, miss * 1000 + 10);
    assert.equal(answered.correct, false);
    assert.equal(answered.projection.stage, "QUESTION");
    const advanced = controller.advance(miss * 1000 + 20);
    projection = advanced.projection;
  }
  assert.equal(projection.stage, "RESULT");
  assert.deepEqual(projection.reward, { draws: 1, ticketLevel: 2, reason: "三回目のミスによる救済" });
  assert.equal(projection.question, null);
  assert.deepEqual(controller.settlementFacts(), { ok: true, correct: 0, wrong: 3, bestStreak: 0, selectedLevel: 3 });
});
