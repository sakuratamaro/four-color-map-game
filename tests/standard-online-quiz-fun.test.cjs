"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "standard-online-v5", "style.css"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");

test("every quiz question carries a readable mission, format, and thinking-step contract", () => {
  assert.match(edge, /function quizExperienceMeta\(/);
  assert.match(edge, /return \{ mission, formatLabel, thinkingSteps \}/);
  assert.match(edge, /const thinkingSteps = level >= 5 \? 3/);
  assert.match(html, /id="quizMission"/);
  assert.match(html, /id="quizThinkingSteps"/);
  assert.match(app, /function renderQuizExperience\(/);
  assert.match(app, /question\?\.mission/);
  assert.match(app, /question\?\.formatLabel/);
  assert.match(app, /question\?\.thinkingSteps/);
  assert.match(css, /\.quiz-mission\{[^}]*white-space:normal/);
});

test("immediate feedback includes one server-confirmed learning line", () => {
  assert.match(app, /function quizLearningLine\(/);
  assert.match(app, /feedback\?\.explanation/);
  assert.match(app, /なるほど：/);
  assert.match(css, /\.quiz-feedback-learning/);
});

test("confirmed answer results drive a restored, reward-neutral streak", () => {
  assert.match(html, /id="quizStreak"/);
  assert.match(app, /function quizCorrectStreak\(/);
  assert.match(app, /pendingQuiz\?\.answerResults/);
  assert.match(app, /streak >= 6/);
  assert.match(app, /streak >= 4/);
  assert.match(app, /streak >= 2/);
  assert.match(css, /\.quiz-streak\[data-tier="3"\]/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.quiz-streak\{animation:none\}\}/);
  assert.doesNotMatch(edge, /streak[^\n]{0,80}(reward|ticket|draw)/i);
});

test("streak calculation restores from confirmed results and resets on a miss or timeout", () => {
  const source = app.match(/function quizCorrectStreak\([\s\S]+?\n\}/)?.[0];
  assert.ok(source, "quizCorrectStreak must remain extractable");
  const context = vm.createContext({ pendingQuiz: { answerResults: [] } });
  new vm.Script(`${source}\nglobalThis.run = quizCorrectStreak;`).runInContext(context);
  const correct = { isCorrect: true, timedOut: false };
  assert.equal(context.run([correct, correct, correct]), 3);
  assert.equal(context.run([correct, { isCorrect: false, timedOut: false }, correct, correct]), 2);
  assert.equal(context.run([correct, correct, { isCorrect: true, timedOut: true }]), 0);
  assert.equal(context.run([]), 0);
});
