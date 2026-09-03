"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { STANDARD_SKILLS } = require("../standard/standard-skill-registry.js");
const intents = require("../standard-online-v5/standard-online-skill-intents.js");

test("intent registry covers exactly the 19 canonical Standard cards", () => {
  const canonical = Object.values(STANDARD_SKILLS).filter((skill) => skill.v49Catalogued).map((skill) => skill.id).sort();
  assert.deepEqual(Object.keys(intents.TARGET_KIND).sort(), canonical);
  assert.equal(Object.keys(intents.TARGET_KIND).length, 19);
  assert.equal(Object.hasOwn(intents.TARGET_KIND, "legalRecolor"), false);
});

test("six no-target cards produce finite immediate payloads", () => {
  const ids = Object.entries(intents.TARGET_KIND).filter(([, kind]) => kind === "none").map(([id]) => id);
  assert.deepEqual(ids.sort(), ["areaDiePlus", "colorPrism", "colorRandomBorrow", "disruptPaletteRandom", "disruptRandomOne", "disruptRandomTwo"].sort());
  for (const skill of ids) assert.deepEqual(intents.buildSkillPayload(skill), { skill });
});

test("chosen colors cover borrow and every chosen disruption duration", () => {
  for (const skill of ["colorChoiceBorrow", "disruptChoiceOne", "disruptChoiceTwo", "disruptPaletteChoice", "disruptChoiceThree", "disruptForcedPalette"]) {
    assert.deepEqual(intents.buildSkillPayload(skill, { color: "green" }), { skill, color: "green" });
  }
  assert.throws(() => intents.buildSkillPayload("disruptChoiceOne", { color: "purple" }), /INVALID_SKILL_TARGET/);
});

test("palette, geometry, resize, and shift payloads are normalized without legality inference", () => {
  assert.deepEqual(intents.buildSkillPayload("colorPaletteChange", { slot: 2, color: "blue" }), { skill: "colorPaletteChange", slot: 2, color: "blue" });
  assert.deepEqual(intents.buildSkillPayload("colorRegionSplit", { regionId: "R12", sourceMacros: [15, 13] }), { skill: "colorRegionSplit", regionId: "R12", sourceMacros: [13, 15] });
  assert.deepEqual(intents.buildSkillPayload("areaMicroBloom", { sourceMacros: [26, 25] }), { skill: "areaMicroBloom", sourceMacros: [25, 26] });
  assert.deepEqual(intents.buildSkillPayload("areaCornerBloom", { sourceMacros: [26], macro: 26 }), { skill: "areaCornerBloom", sourceMacros: [26], macro: 26 });
  assert.deepEqual(intents.buildSkillPayload("areaResize", { mode: "expand", side: "left" }), { skill: "areaResize", mode: "expand", side: "left" });
  assert.deepEqual(intents.buildSkillPayload("areaHalfShift", { axis: "COLUMN", index: 1, direction: "plus" }), { skill: "areaHalfShift", axis: "COLUMN", index: 1, direction: "plus" });
  assert.deepEqual(intents.buildSkillPayload("areaTripleShift", { axis: "ROW", index: 2, direction: "minus" }), { skill: "areaTripleShift", axis: "ROW", index: 2, direction: "minus" });
});

test("malformed target values fail before an action identity is allocated", () => {
  for (const [skill, input] of [
    ["colorPaletteChange", { slot: 3, color: "red" }],
    ["colorRegionSplit", { regionId: "R0", sourceMacros: [13] }],
    ["areaMicroBloom", { sourceMacros: [13, 13] }],
    ["areaCornerBloom", { sourceMacros: [], macro: 13 }],
    ["areaResize", { mode: "grow", side: "left" }],
    ["areaHalfShift", { axis: "DIAGONAL", index: 1, direction: "plus" }],
  ]) assert.throws(() => intents.buildSkillPayload(skill, input), /INVALID_SKILL_TARGET/);
  assert.throws(() => intents.buildSkillPayload("legalRecolor", { regionId: "R1" }), /UNKNOWN_STANDARD_SKILL/);
});
