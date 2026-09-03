"use strict";

const { generateQuestion, shuffle } = require("./quiz-generator.js");
const { hintFor } = require("./hint-policy.js");
const { rewardFor } = require("./reward-policy.js");

const BAND_COUNTS = Object.freeze({ instant: 2, normal: 5, hard: 2, spike: 1 });

function scheduleIsValid(schedule) {
  if (schedule.length !== 10) return false;
  if (!new Set(["instant", "normal"]).has(schedule[0])) return false;
  if (!schedule.slice(0, 2).includes("instant")) return false;
  if (schedule.indexOf("spike") < 5) return false;
  for (let index = 0; index <= schedule.length - 3; index += 1) {
    if (schedule.slice(index, index + 3).every((band) => band === "hard" || band === "spike")) return false;
  }
  return Object.entries(BAND_COUNTS).every(([band, count]) => schedule.filter((value) => value === band).length === count);
}

function createDifficultySchedule(random) {
  const source = Object.entries(BAND_COUNTS).flatMap(([band, count]) => Array(count).fill(band));
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const schedule = shuffle(random, source);
    if (scheduleIsValid(schedule)) return Object.freeze(schedule);
  }
  throw new Error("DIFFICULTY_SCHEDULE_EXHAUSTED");
}

function createQuizQuestions({ structureRandom, contentRandom, rankRandom, placementRandom }) {
  const schedule = createDifficultySchedule(structureRandom || contentRandom);
  const randoms = { content: contentRandom, rank: rankRandom, placement: placementRandom };
  const questions = [];
  for (const band of schedule) {
    let level;
    let extreme = false;
    if (band === "instant") level = 1;
    else if (band === "normal") level = contentRandom() < 0.5 ? 2 : 3;
    else if (band === "hard") level = 4;
    else {
      extreme = contentRandom() < 0.15;
      level = extreme ? 5 : 4;
    }
    const previous = questions.map((question) => `${question.level}:${question.templateKey}`);
    const generated = generateQuestion(level, randoms, previous.slice(-2).map((key) => key.split(":")[1]));
    questions.push(Object.freeze({ ...generated, band, extreme }));
  }
  return Object.freeze(questions);
}

class QuizSession {
  constructor({ questions, selectedLevel = 1 }) {
    if (!Array.isArray(questions) || questions.length !== 10) throw new TypeError("TEN_QUESTIONS_REQUIRED");
    this.questions = questions;
    this.selectedLevel = selectedLevel;
    this.index = 0;
    this.correct = 0;
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.running = false;
    this.resolved = false;
    this.hintUsed = false;
    this.hintActive = false;
    this.answerStartedAt = 0;
    this.answerRemainingMs = 0;
    this.hintEndsAt = 0;
  }

  get question() {
    return this.questions[this.index];
  }

  begin(now = 0) {
    if (this.running) throw new Error("SESSION_ALREADY_RUNNING");
    this.running = true;
    this.#startQuestion(now);
    return this.snapshot(now);
  }

  #startQuestion(now) {
    this.resolved = false;
    this.hintUsed = false;
    this.hintActive = false;
    this.answerRemainingMs = this.question.timeMs;
    this.answerStartedAt = now;
    this.hintEndsAt = 0;
  }

  timeRemainingMs(now) {
    if (!this.running || this.resolved || this.hintActive) return Math.max(0, this.answerRemainingMs);
    return Math.max(0, this.answerRemainingMs - (now - this.answerStartedAt));
  }

  openHint(now) {
    if (!this.running || this.resolved) return Object.freeze({ ok: false, code: "QUESTION_NOT_ACTIVE" });
    if (this.hintUsed) return Object.freeze({ ok: false, code: "HINT_ALREADY_USED" });
    this.answerRemainingMs = this.timeRemainingMs(now);
    if (this.answerRemainingMs <= 0) return this.timeout(now);
    const hint = hintFor({ templateId: this.question.templateKey, difficulty: this.question.band });
    this.hintUsed = true;
    this.hintActive = true;
    this.hintEndsAt = now + hint.durationMs;
    return Object.freeze({ ok: true, ...hint, endsAt: this.hintEndsAt });
  }

  closeHint(now) {
    if (!this.hintActive) return Object.freeze({ ok: false, code: "HINT_NOT_ACTIVE" });
    const resumeAt = Math.min(now, this.hintEndsAt);
    this.hintActive = false;
    this.answerStartedAt = resumeAt;
    this.hintEndsAt = 0;
    return Object.freeze({ ok: true, remainingMs: this.timeRemainingMs(now) });
  }

  tick(now) {
    if (this.hintActive && now >= this.hintEndsAt) this.closeHint(now);
    if (this.running && !this.resolved && this.timeRemainingMs(now) <= 0) return this.timeout(now);
    return this.snapshot(now);
  }

  answer(optionId, now) {
    if (this.hintActive) return Object.freeze({ ok: false, code: "HINT_ACTIVE" });
    if (!this.running || this.resolved) return Object.freeze({ ok: false, code: "QUESTION_NOT_ACTIVE" });
    if (this.timeRemainingMs(now) <= 0) return this.timeout(now);
    return this.#resolve(optionId === this.question.correctId, false, now);
  }

  timeout(now) {
    if (!this.running || this.resolved) return Object.freeze({ ok: false, code: "QUESTION_NOT_ACTIVE" });
    if (this.hintActive) this.closeHint(now);
    return this.#resolve(false, true, now);
  }

  #resolve(correct, timedOut, now) {
    this.answerRemainingMs = this.timeRemainingMs(now);
    this.resolved = true;
    if (correct) {
      this.correct += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.wrong += 1;
      this.streak = 0;
    }
    return Object.freeze({ ok: true, correct, timedOut, answerLabel: this.question.answerLabel });
  }

  advance(now) {
    if (!this.running || !this.resolved) return Object.freeze({ ok: false, code: "QUESTION_NOT_RESOLVED" });
    if (this.wrong >= 3 || this.index === this.questions.length - 1) {
      this.running = false;
      return Object.freeze({ ok: true, finished: true, reward: rewardFor({ correct: this.correct, wrong: this.wrong, bestStreak: this.bestStreak, selectedLevel: this.selectedLevel }) });
    }
    this.index += 1;
    this.#startQuestion(now);
    return Object.freeze({ ok: true, finished: false, question: this.question });
  }

  snapshot(now) {
    return Object.freeze({ index: this.index, running: this.running, resolved: this.resolved, hintUsed: this.hintUsed, hintActive: this.hintActive, remainingMs: this.timeRemainingMs(now), correct: this.correct, wrong: this.wrong, streak: this.streak, bestStreak: this.bestStreak });
  }
}

module.exports = { BAND_COUNTS, QuizSession, createDifficultySchedule, createQuizQuestions, scheduleIsValid };
