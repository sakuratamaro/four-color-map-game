"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const intents = require("../standard-online-v5/standard-online-skill-intents.js");

test("a chosen borrowed yellow becomes an immediately usable COLOR button choice", () => {
  const privateState = {
    basicPalette: ["red", "blue"],
    bonusColor: "green",
    bonusUsesRemaining: 0,
    privateEffects: { temporaryColors: ["yellow"] },
  };

  assert.deepEqual(intents.availableColorChoices(privateState), ["red", "blue", "yellow"]);
});

test("borrowed colors are not confused with an exhausted bonus color", () => {
  const withoutBorrow = {
    basicPalette: ["red", "blue"],
    bonusColor: "yellow",
    bonusUsesRemaining: 0,
    privateEffects: {},
  };
  const withBorrow = {
    ...withoutBorrow,
    privateEffects: { temporaryColors: ["yellow"] },
  };

  assert.deepEqual(intents.availableColorChoices(withoutBorrow), ["red", "blue"]);
  assert.deepEqual(intents.availableColorChoices(withBorrow), ["red", "blue", "yellow"]);
});

test("the Standard online COLOR controls use the canonical private color choices", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../standard-online-v5/app.js"), "utf8");
  assert.match(source, /const colors = skillIntents\.availableColorChoices\(privateState\)/);
  assert.doesNotMatch(source, /const colors = \[\.\.\.new Set\(\[\.\.\.\(privateState\.basicPalette/);
});
