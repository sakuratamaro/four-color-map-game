"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const edge = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "standard-game-action", "index.ts"), "utf8");

function loadAnswerProjection() {
  const start = edge.indexOf("function quizAnswerProjection(");
  const end = edge.indexOf("function roomProjection(", start);
  assert.ok(start >= 0 && end > start, "quiz answer projection must remain extractable");
  const source = edge.slice(start, end)
    .replace("function quizAnswerProjection(row: JsonObject): JsonObject", "function quizAnswerProjection(row)");
  const context = vm.createContext({});
  new vm.Script(`${source}\nglobalThis.project = quizAnswerProjection;`).runInContext(context);
  return context.project;
}

test("sealed answer feedback exposes the accepted review item and no private session fields", () => {
  const project = loadAnswerProjection();
  const response = JSON.parse(JSON.stringify(project({
    duplicate: false,
    question_index: 2,
    answered_count: 3,
    is_correct: false,
    correct_option_id: "q3-4",
    correct_option_label: "50",
    explanation: "割合は、もとの量に割合を掛けます。",
    answer_ids: ["private"],
    explanations: ["private"],
    questions: [{ correctId: "private" }],
    service_secret: "private",
  })));
  assert.deepEqual(response, {
    duplicate: false,
    questionIndex: 2,
    answeredCount: 3,
    isCorrect: false,
    correctOptionId: "q3-4",
    correctOptionLabel: "50",
    explanation: "割合は、もとの量に割合を掛けます。",
  });
  assert.equal(JSON.stringify(response).includes("private"), false);
});

test("an exact DB replay remains visibly idempotent", () => {
  const project = loadAnswerProjection();
  const response = JSON.parse(JSON.stringify(project({
    duplicate: true,
    question_index: 0,
    answered_count: 1,
    is_correct: true,
    correct_option_id: "q1-2",
    correct_option_label: "8",
    explanation: "4 + 4 = 8",
  })));
  assert.equal(response.duplicate, true);
  assert.equal(response.isCorrect, true);
  assert.equal(response.correctOptionLabel, "8");
});
