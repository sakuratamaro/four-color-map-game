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
  assert.deepEqual(intents.LAB_TARGET_KIND, { legalRecolor: "existing-region" });
  assert.deepEqual(intents.EXPERIMENTAL_TARGET_KIND, { colorBonusRefill: "none" });
  assert.deepEqual(intents.buildSkillPayload("colorBonusRefill"), { skill: "colorBonusRefill" });
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
  assert.deepEqual(intents.buildSkillPayload("areaCornerBloom", { regionId: "R12", macro: 26 }), { skill: "areaCornerBloom", regionId: "R12", macro: 26 });
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
    ["areaCornerBloom", { sourceMacros: [13], regionId: "R1", macro: 13 }],
    ["areaCornerBloom", { macro: 13 }],
    ["areaCornerBloom", { regionId: "R0", macro: 13 }],
    ["areaResize", { mode: "grow", side: "left" }],
    ["areaHalfShift", { axis: "DIAGONAL", index: 1, direction: "plus" }],
  ]) assert.throws(() => intents.buildSkillPayload(skill, input), /INVALID_SKILL_TARGET/);
  assert.deepEqual(intents.buildSkillPayload("legalRecolor", { regionId: "R1" }), { skill: "legalRecolor", regionId: "R1" });
  assert.throws(() => intents.buildSkillPayload("legalRecolor", { regionId: "R0" }), /INVALID_SKILL_TARGET/);
});

test("color choice details retain owned zero-use bonus colors and merge every availability source", () => {
  const details = intents.colorChoiceDetails({
    basicPalette: ["red", "red", "corrupt"],
    bonusColor: "red",
    bonusUsesRemaining: 0,
    privateEffects: { temporaryColors: ["yellow", "corrupt"], prism: false },
  });
  assert.deepEqual(details.map((choice) => choice.color), ["red", "yellow"]);
  assert.deepEqual(details[0], {
    color: "red", isBasic: true, isBonus: true, bonusUsesRemaining: 0,
    isTemporary: false, isPrism: false, available: true,
  });
  assert.equal(details[1].isTemporary, true);
  assert.deepEqual(intents.availableColorChoices({
    basicPalette: [], bonusColor: "blue", bonusUsesRemaining: 0, privateEffects: {},
  }), []);
  assert.deepEqual(intents.colorChoiceDetails({
    basicPalette: [], bonusColor: "blue", bonusUsesRemaining: 0, privateEffects: {},
  }).map((choice) => [choice.color, choice.available, choice.bonusUsesRemaining]), [["blue", false, 0]]);
  assert.deepEqual(intents.availableColorChoices({
    basicPalette: [], bonusColor: "corrupt", bonusUsesRemaining: 9,
    privateEffects: { temporaryColors: [], prism: true },
  }), ["red", "blue", "yellow", "green"]);
});
