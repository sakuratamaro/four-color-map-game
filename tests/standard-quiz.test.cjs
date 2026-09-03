"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRngDomains } = require("../standard/standard-engine.js");
const { HINTS, hintFor } = require("../standard/hint-policy.js");
const { rewardFor } = require("../standard/reward-policy.js");
const { QuizSession, createQuizQuestions, scheduleIsValid } = require("../standard/quiz-session.js");

function questionsFor(seed) {
  const rng = createRngDomains(seed, ["quizContent", "quizRank", "quizPlacement"]);
  return createQuizQuestions({ contentRandom: () => rng.quizContent.next(), rankRandom: () => rng.quizRank.next(), placementRandom: () => rng.quizPlacement.next() });
}

function hintInput(question) {
  return { templateId: question.templateKey, difficulty: question.band };
}

function canonicalQuestions(questions) {
  return questions.map((question) => ({
    templateKey: question.templateKey,
    type: question.type,
    prompt: question.prompt,
    timeMs: question.timeMs,
    answerLabel: question.answerLabel,
    answer: question.answer,
    level: question.level,
    band: question.band,
    extreme: question.extreme,
    correctPosition: question.options.findIndex((option) => option.isCorrect),
    options: question.options.map(({ label, value, isCorrect }) => ({ label, value, isCorrect })),
  }));
}

test("ten-question schedule satisfies the 2/5/2/1 constraints", () => {
  for (let seed = 1; seed <= 2000; seed += 1) {
    const questions = questionsFor(seed);
    const schedule = questions.map((question) => question.band);
    assert.equal(scheduleIsValid(schedule), true, `invalid seed ${seed}`);
    for (let index = 0; index <= questions.length - 3; index += 1) {
      const keys = questions.slice(index, index + 3).map((question) => `${question.level}:${question.templateKey}`);
      assert.notEqual(new Set(keys).size, 1, `three repeated templates at seed ${seed}`);
    }
  }
});

test("60,000 questions keep six unique choices and cover position by numeric rank", () => {
  const cells = Array.from({ length: 6 }, () => Array(6).fill(0));
  const byBand = new Map();
  const byTemplate = new Map();
  const generatorKeys = new Set();
  const comparisonGroups = { minimum: 0, maximum: 0, middle: 0 };
  let total = 0;
  for (let sessionSeed = 1; sessionSeed <= 6000; sessionSeed += 1) {
    for (const question of questionsFor(100000 + sessionSeed)) {
      assert.equal(question.options.length, 6);
      assert.equal(new Set(question.options.map((option) => option.label)).size, 6);
      assert.equal(question.options.filter((option) => option.isCorrect).length, 1);
      const position = question.options.findIndex((option) => option.isCorrect);
      const sorted = [...question.options].sort((left, right) => left.value - right.value);
      const rank = sorted.findIndex((option) => option.isCorrect);
      cells[position][rank] += 1;
      if (!byBand.has(question.band)) byBand.set(question.band, { positions: Array(6).fill(0), ranks: Array(6).fill(0) });
      byBand.get(question.band).positions[position] += 1;
      byBand.get(question.band).ranks[rank] += 1;
      const generatorKey = `${question.level}:${question.templateKey}`;
      if (!byTemplate.has(generatorKey)) byTemplate.set(generatorKey, Array(6).fill(0));
      byTemplate.get(generatorKey)[position] += 1;
      generatorKeys.add(generatorKey);
      if (question.templateKey === "compare") comparisonGroups[rank === 0 ? "minimum" : rank === 5 ? "maximum" : "middle"] += 1;
      total += 1;
    }
  }
  assert.equal(total, 60000);
  assert.equal(generatorKeys.size, 30);
  for (const row of cells) for (const count of row) assert.ok(count > 1200 && count < 2200, `biased cell ${count}`);

  const positionMarginals = cells.map((row) => row.reduce((sum, count) => sum + count, 0));
  const rankMarginals = cells[0].map((_, rank) => cells.reduce((sum, row) => sum + row[rank], 0));
  for (const count of [...positionMarginals, ...rankMarginals]) assert.ok(Math.abs(count - 10000) / 10000 < 0.03, `marginal deviation ${count}`);

  let chiSquare = 0;
  let maxPracticalDeviation = 0;
  for (let position = 0; position < 6; position += 1) {
    for (let rank = 0; rank < 6; rank += 1) {
      const expected = positionMarginals[position] * rankMarginals[rank] / total;
      chiSquare += (cells[position][rank] - expected) ** 2 / expected;
      maxPracticalDeviation = Math.max(maxPracticalDeviation, Math.abs(cells[position][rank] - expected) / expected);
    }
  }
  assert.ok(chiSquare < 50, `position/rank chi-square ${chiSquare}`);
  assert.ok(maxPracticalDeviation < 0.10, `position/rank max deviation ${maxPracticalDeviation}`);
  const classifierAccuracy = cells.reduce((sum, row) => sum + Math.max(...row), 0) / total;
  assert.ok(classifierAccuracy < 0.185, `position-only classifier accuracy ${classifierAccuracy}`);

  for (const band of ["instant", "normal", "hard", "spike"]) {
    const distribution = byBand.get(band);
    const bandTotal = distribution.positions.reduce((sum, count) => sum + count, 0);
    const expected = bandTotal / 6;
    for (const count of [...distribution.positions, ...distribution.ranks]) assert.ok(Math.abs(count - expected) / expected < 0.10, `${band} marginal ${count}`);
  }
  for (const [key, positions] of byTemplate) {
    const templateTotal = positions.reduce((sum, count) => sum + count, 0);
    assert.ok(positions.every((count) => count > 0), `${key} missing a correct position`);
    assert.ok(Math.max(...positions) / templateTotal < 0.35, `${key} template position concentration`);
  }
  const comparisonTotal = Object.values(comparisonGroups).reduce((sum, count) => sum + count, 0);
  assert.ok(Math.abs(comparisonGroups.minimum / comparisonTotal - 1 / 6) < 0.04);
  assert.ok(Math.abs(comparisonGroups.maximum / comparisonTotal - 1 / 6) < 0.04);
  assert.ok(Math.abs(comparisonGroups.middle / comparisonTotal - 4 / 6) < 0.04);
});

test("fixed seeds reproduce quiz content, choice order, and correct positions", () => {
  for (const seed of [1, 777, 20260830, 0xffffffff]) {
    assert.deepEqual(canonicalQuestions(questionsFor(seed)), canonicalQuestions(questionsFor(seed)), `seed ${seed}`);
  }
});

test("hints are fixed, one-use, duration-scoped, and pause the answer timer", () => {
  const questions = questionsFor(777);
  const session = new QuizSession({ questions, selectedLevel: 4 });
  session.begin(1000);
  const before = session.timeRemainingMs(1800);
  const opened = session.openHint(1800);
  assert.equal(opened.ok, true);
  assert.equal(opened.durationMs, ["hard", "spike"].includes(session.question.band) ? 5000 : 3000);
  assert.equal(session.timeRemainingMs(2800), before);
  assert.equal(session.answer(session.question.correctId, 2800).code, "HINT_ACTIVE");
  assert.equal(session.closeHint(2800).ok, true);
  assert.equal(session.timeRemainingMs(3300), before - 500);
  assert.equal(session.openHint(3300).code, "HINT_ALREADY_USED");
  const hint = hintFor(hintInput(session.question));
  assert.equal(hint.text, HINTS[session.question.templateKey]);
  assert.ok(!session.question.options.some((option) => hint.text.includes(option.label)));
});

test("every retained generator has a reviewed non-answer hint with the correct duration", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 500 && seen.size < 30; seed += 1) {
    for (const question of questionsFor(900000 + seed)) {
      const key = `${question.level}:${question.templateKey}`;
      seen.add(key);
      const hint = hintFor(hintInput(question));
      assert.equal(hint.durationMs, ["hard", "spike"].includes(question.band) ? 5000 : 3000);
      assert.ok(!question.options.some((option) => hint.text.includes(option.label)), `${key} leaked an option label`);
      assert.ok(!hint.text.includes(question.answerLabel), `${key} leaked its answer`);
    }
  }
  assert.equal(seen.size, 30);
});

test("automatic hint expiry resumes the timer at the expiry boundary", () => {
  const generated = questionsFor(778);
  const hard = generated.find((question) => question.band === "hard");
  const questions = [hard, ...generated.filter((question) => question !== hard)];
  const session = new QuizSession({ questions });
  session.begin(0);
  const remaining = session.timeRemainingMs(700);
  const opened = session.openHint(700);
  assert.equal(opened.durationMs, 5000);
  session.tick(6200);
  assert.equal(session.snapshot(6200).hintActive, false);
  assert.equal(session.timeRemainingMs(6200), remaining - 500);
});

test("hint use never changes reward", () => {
  const input = { correct: 8, wrong: 2, bestStreak: 4, selectedLevel: 5 };
  assert.deepEqual(rewardFor(input), rewardFor({ ...input, hintUsed: true }));
});

test("reward policy matches v4.9 perfect, streak, rescue, completion, and failure cases", () => {
  const cases = [
    [{ correct: 10, wrong: 0, bestStreak: 10, selectedLevel: 5 }, { draws: 10, ticketLevel: 5, reason: "全問正解" }],
    [{ correct: 5, wrong: 3, bestStreak: 5, selectedLevel: 4 }, { draws: 5, ticketLevel: 4, reason: "五問以上の連続正解" }],
    [{ correct: 7, wrong: 3, bestStreak: 4, selectedLevel: 3 }, { draws: 3, ticketLevel: 3, reason: "累計七問以上正解" }],
    [{ correct: 6, wrong: 2, bestStreak: 4, selectedLevel: 2 }, { draws: 1, ticketLevel: 2, reason: "参加報酬" }],
    [{ correct: 2, wrong: 3, bestStreak: 2, selectedLevel: 5 }, { draws: 1, ticketLevel: 4, reason: "三回目のミスによる救済" }],
    [{ correct: 2, wrong: 3, bestStreak: 2, selectedLevel: 1 }, { draws: 1, ticketLevel: 1, reason: "三回目のミスによる救済" }],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(rewardFor(input), expected);
    assert.deepEqual(rewardFor({ ...input, hintUsed: true }), expected);
  }
});

test("hint policy accepts only reviewed public metadata", () => {
  const metadata = { templateId: "add", difficulty: "normal" };
  Object.defineProperties(metadata, {
    correctChoiceId: { get() { throw new Error("forbidden correctChoiceId read"); } },
    answer: { get() { throw new Error("forbidden answer read"); } },
    options: { get() { throw new Error("forbidden options read"); } },
  });
  assert.deepEqual(hintFor(metadata), { text: HINTS.add, durationMs: 3000 });
});
