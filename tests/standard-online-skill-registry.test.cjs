"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("../standard/standard-skill-registry.js");
const generated = require("../standard-online-v5/standard-skill-registry.generated.js");

const root = path.resolve(__dirname, "..");
const publicFields = [
  "id", "displayName", "category", "usageCategory", "rarity", "timing",
  "v49Catalogued", "standardUiEnabled", "alphaUiEnabled", "experimental",
  "standardEngineImplemented", "gachaEnabled",
];

test("browser skill metadata is generated exactly from the authoritative Standard registry", () => {
  assert.equal(generated.VERSION, "standard-skill-registry-generated-v1");
  assert.deepEqual(generated.v49SkillIds, V49_SKILL_IDS);
  assert.deepEqual(Object.keys(generated.skills), Object.keys(STANDARD_SKILLS));
  for (const [id, definition] of Object.entries(STANDARD_SKILLS)) {
    assert.deepEqual(generated.skills[id], Object.fromEntries(publicFields.map((field) => [field, definition[field]])));
    assert.equal(Number.isInteger(generated.skills[id].rarity), true, id);
    assert.equal(generated.skills[id].rarity >= 1 && generated.skills[id].rarity <= 5, true, id);
    assert.equal(Object.isFrozen(generated.skills[id]), true, id);
  }
  assert.equal(generated.v49SkillIds.length, 19);
  assert.deepEqual(Object.values(generated.skills).filter((definition) => definition.experimental).map((definition) => definition.id), ["colorBonusRefill", "legalRecolor"]);
  assert.equal(Object.isFrozen(generated.skills), true);
  assert.equal(Object.isFrozen(generated.v49SkillIds), true);
  assert.equal(Object.isFrozen(generated), true);
});

test("committed browser skill metadata is current", () => {
  const result = spawnSync(process.execPath, ["scripts/build-standard-online-skill-registry.mjs", "--check"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});
