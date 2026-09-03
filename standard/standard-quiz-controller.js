"use strict";

const { QuizSession } = require("./quiz-session.js");

function publicQuestion(question) {
  if (!question) return null;
  return Object.freeze({
    type: question.type,
    prompt: question.prompt,
    timeMs: question.timeMs,
    band: question.band,
    options: Object.freeze(question.options.map(({ id, label }) => Object.freeze({ id, label }))),
  });
}

function createStandardQuizController({ questions, selectedLevel }) {
  const session = new QuizSession({ questions, selectedLevel });
  let resolution = null;
  let reward = null;

  function projection(now) {
    const snapshot = session.snapshot(now);
    return Object.freeze({
      stage: reward ? "RESULT" : snapshot.running ? "QUESTION" : "IDLE",
      selectedLevel,
      questionNumber: snapshot.index + 1,
      questionCount: questions.length,
      correct: snapshot.correct,
      wrong: snapshot.wrong,
      streak: snapshot.streak,
      bestStreak: snapshot.bestStreak,
      resolved: snapshot.resolved,
      hintUsed: snapshot.hintUsed,
      hintActive: snapshot.hintActive,
      remainingMs: snapshot.remainingMs,
      question: reward ? null : publicQuestion(session.question),
      resolution,
      reward,
    });
  }

  function begin(now) {
    session.begin(now);
    return Object.freeze({ ok: true, code: "STARTED", projection: projection(now) });
  }

  function openHint(now) {
    const result = session.openHint(now);
    return Object.freeze({ ...result, projection: projection(now) });
  }

  function answer(optionId, now) {
    const result = session.answer(optionId, now);
    if (result.ok) resolution = Object.freeze({ correct: result.correct, timedOut: result.timedOut, answerLabel: result.answerLabel });
    return Object.freeze({ ...result, projection: projection(now) });
  }

  function tick(now) {
    const result = session.tick(now);
    if (result?.ok && Object.hasOwn(result, "correct")) resolution = Object.freeze({ correct: result.correct, timedOut: result.timedOut, answerLabel: result.answerLabel });
    return Object.freeze({ ok: true, code: resolution && session.resolved ? "RESOLVED" : "TICK", projection: projection(now) });
  }

  function advance(now) {
    const result = session.advance(now);
    if (!result.ok) return Object.freeze({ ...result, projection: projection(now) });
    resolution = null;
    if (result.finished) reward = result.reward;
    return Object.freeze({ ...result, projection: projection(now) });
  }

  function settlementFacts() {
    if (!reward) return Object.freeze({ ok: false, code: "QUIZ_NOT_FINISHED" });
    const snapshot = session.snapshot(0);
    return Object.freeze({ ok: true, correct: snapshot.correct, wrong: snapshot.wrong, bestStreak: snapshot.bestStreak, selectedLevel });
  }

  return Object.freeze({ advance, answer, begin, openHint, projection, settlementFacts, tick });
}

module.exports = { createStandardQuizController, publicQuestion };
