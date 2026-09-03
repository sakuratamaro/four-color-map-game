"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { canonicalInteractionLoadouts, canonicalLoadoutFor, playGame, simulateCanonicalInteractionMatrix, simulateCanonicalSkillMatrix, simulatePaired } = require("../scripts/standard-cpu-selfplay.cjs");
const { V49_SKILL_IDS } = require("../standard/standard-skill-registry.js");

test("standard CPU self-play is deterministic and completes without rejected actions", () => {
  const first = playGame({ seed: 901, firstSeat: "A", levelA: "hard", levelB: "normal" });
  const second = playGame({ seed: 901, firstSeat: "A", levelA: "hard", levelB: "normal" });
  assert.deepEqual(first, second);
  assert.equal(first.completed, true);
  assert.equal(first.rejectedActions, 0);
  assert.notEqual(first.terminalReason, "ILLEGAL_COLOR");
});

test("paired simulation alternates first move and reports stable safety statistics", () => {
  const report = simulatePaired({ pairs: 4, seed: 902, levelFirst: "normal", levelSecond: "hard" });
  assert.equal(report.games, 8);
  assert.equal(report.completed, 8);
  assert.equal(report.rejectedActions, 0);
  assert.equal(report.illegalTerminals, 0);
  assert.equal(report.firstPolicyWins + report.secondPolicyWins, 8);
  assert.ok(report.meanActions > 0);
});

test("formal six-card matrix completes safely and exercises every canonical skill without one-card dominance", () => {
  const report = simulateCanonicalSkillMatrix({ seedsPerSkill: 1, seed: 12000, level: "hard" });
  assert.equal(report.games, 19);
  assert.equal(report.completed, 19);
  assert.equal(report.rejectedActions, 0);
  assert.equal(report.illegalTerminals, 0);
  for (const skill of V49_SKILL_IDS) {
    assert.ok(report.skillOpportunityCounts[skill] > 0, `${skill}: no opportunity`);
    assert.ok(report.skillUseCounts[skill] > 0, `${skill}: no accepted use`);
  }
  assert.ok(report.maxUseShare < 0.2, `single-skill share ${report.maxUseShare}`);
});

test("private noise cannot alter a formal canonical CPU action trace or result", () => {
  const loadout = canonicalLoadoutFor("disruptForcedPalette");
  const left = playGame({ seed: 13001, firstSeat: "B", levelA: "hard", levelB: "hard", loadoutA: loadout, loadoutB: loadout, privateNoise: "LEFT-SECRET" });
  const right = playGame({ seed: 13001, firstSeat: "B", levelA: "hard", levelB: "hard", loadoutA: loadout, loadoutB: loadout, privateNoise: "RIGHT-SECRET" });
  assert.deepEqual(left, right);
  assert.equal(JSON.stringify(left).includes("LEFT-SECRET"), false);
  assert.equal(JSON.stringify(right).includes("RIGHT-SECRET"), false);
});

test("deterministic formal loadouts cover every canonical pair and complete without interaction rejection", () => {
  const loadouts = canonicalInteractionLoadouts();
  assert.ok(loadouts.length < 40);
  assert.deepEqual(loadouts, canonicalInteractionLoadouts());
  const report = simulateCanonicalInteractionMatrix({ seed: 16000, level: "hard" });
  assert.equal(report.games, loadouts.length);
  assert.equal(report.completed, report.games);
  assert.equal(report.rejectedActions, 0);
  assert.equal(report.illegalTerminals, 0);
  assert.equal(report.coveredPairs, 171);
  assert.equal(report.expectedPairs, 171);
  for (const skill of V49_SKILL_IDS) {
    assert.ok(report.skillOpportunityCounts[skill] > 0, `${skill}: no pair-matrix opportunity`);
    assert.ok(report.skillUseCounts[skill] > 0, `${skill}: no pair-matrix use`);
  }
  assert.ok(report.maxUseShare < 0.2, `pair-matrix single-skill share ${report.maxUseShare}`);
});
