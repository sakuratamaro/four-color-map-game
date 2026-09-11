"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const source = fs.readFileSync(path.join(__dirname, "../standard-online-v5/app.js"), "utf8");
const handler = source.match(/\$\("quizGoGacha"\)\.onclick = ([\s\S]+?);\r?\n\$\("gachaLevel"\)/)?.[1];
assert.ok(handler, "quiz reward click handler exists");
function click(lastQuizResult) {
  const calls = [];
  vm.runInNewContext(`(${handler})()`, { lastQuizResult, goToGacha: level => calls.push(level) });
  return calls;
}
test("UDL-059 uses the saved reward ticket level for every supported level", () => {
  for (const level of [1, 2, 3, 4, 5]) assert.deepEqual(click({ selectedLevel: 5, reward: { ticketLevel: level } }), [level]);
});
test("UDL-059 never guesses a level for an absent or invalid saved reward", () => {
  for (const result of [null, undefined, {}, { reward: {} }, ...[null, undefined, "2", 0, 6, 1.5, NaN].map(ticketLevel => ({ reward: { ticketLevel } }))]) {
    assert.deepEqual(click(result), []);
  }
});
