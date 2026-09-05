"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const bundle = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "standard-engine.bundle.js"), "utf8");
const edgeSource = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");
const LAB_RULE_SET = "STANDARD_V5_LEGAL_RECOLOR_LAB_V1";
const LOADOUT = Object.freeze({
  color: Object.freeze(["colorRandomBorrow", "colorChoiceBorrow"]),
  area: Object.freeze(["areaMicroBloom", "areaDiePlus"]),
  disrupt: Object.freeze(["disruptRandomOne", "disruptChoiceOne"]),
});

function api() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(bundle, sandbox, { filename: "standard-engine.bundle.js" });
  return sandbox.FourColorStandardServerEngine;
}

function create(engine, labMode) {
  const profiles = { A: engine.createStarterProfile("Lab A"), B: engine.createStarterProfile("Lab B") };
  return {
    profiles,
    created: engine.create({ matchId: `lab-${labMode}`, loadouts: { A: LOADOUT, B: LOADOUT }, profiles, seed: 77, firstSeat: "A", labMode }),
  };
}

test("lab creation keeps the ordinary six-card loadout and loans one symmetric recolor", () => {
  const engine = api();
  const { created } = create(engine, true);
  assert.equal(created.state.ruleSetId, LAB_RULE_SET);
  assert.equal(created.publicState.labRuleSetId, LAB_RULE_SET);
  assert.equal(created.publicState.debugUnlimitedSkills, undefined);
  assert.equal(created.privateA.hand.legalRecolor, 1);
  assert.equal(created.privateB.hand.legalRecolor, 1);
  assert.deepEqual(Object.keys(created.privateA.loadout).sort(), ["area", "color", "disrupt"]);
  assert.equal(JSON.stringify(created.privateA.loadout).includes("legalRecolor"), false);

  const normal = create(engine, false).created;
  assert.equal(normal.state.ruleSetId, "STANDARD_V5");
  assert.equal(normal.publicState.labRuleSetId, undefined);
  assert.equal(normal.privateA.hand.legalRecolor, undefined);
});

test("lab ruleset is immutable at action time and cannot combine with debug", () => {
  const engine = api();
  const { created } = create(engine, true);
  assert.throws(() => engine.create({
    matchId: "conflicting-experiment", loadouts: { A: LOADOUT, B: LOADOUT }, seed: 1, debugMode: true, labMode: true,
  }), /INVALID_LAB_MODE/);
  assert.throws(() => engine.apply({
    state: created.state, rngSnapshot: created.rngSnapshot, actor: "A", expectedVersion: 0,
    action: { type: "SURRENDER", payload: {} }, labMode: false,
  }), /LAB_RULE_SET_MISMATCH/);

  const normal = create(engine, false).created;
  const forged = JSON.parse(JSON.stringify(normal.state));
  forged.hands.A.legalRecolor = 1;
  const rejected = engine.apply({
    state: forged, rngSnapshot: normal.rngSnapshot, actor: "A", expectedVersion: 0,
    action: { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } }, labMode: false,
  });
  assert.deepEqual({ ok: rejected.ok, code: rejected.code }, { ok: false, code: "LAB_MODE_REQUIRED" });
  assert.throws(() => engine.applyProfiles({
    profiles: create(engine, false).profiles, beforeState: normal.state, nextState: normal.state,
    actor: "A", action: { type: "SURRENDER" }, finishedAt: "2026-09-06T00:00:00.000Z", labMode: true,
  }), /LAB_RULE_SET_MISMATCH/);
});

test("one lab recolor resolves publicly, passes WORK without advancing turn, and changes no profile", () => {
  const engine = api();
  const { profiles, created } = create(engine, true);
  const profileBytes = JSON.stringify(profiles);
  const sourceMacros = Array.from({ length: created.state.requiredSize }, (_, index) => 13 + index);
  const made = engine.apply({
    state: created.state, rngSnapshot: created.rngSnapshot, actor: "A", expectedVersion: 0,
    action: { type: "CREATE_REGION", payload: { sourceMacros } }, labMode: true,
  });
  assert.equal(made.ok, true);
  const paint = made.privateB.basicPalette[0];
  const colored = engine.apply({
    state: made.state, rngSnapshot: made.rngSnapshot, actor: "B", expectedVersion: 1,
    action: { type: "COLOR_REGION", payload: { color: paint } }, labMode: true,
  });
  assert.equal(colored.ok, true);
  const turnBefore = colored.state.turn;
  const recolored = engine.apply({
    state: colored.state, rngSnapshot: colored.rngSnapshot, actor: "B", expectedVersion: 2,
    action: { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } }, labMode: true,
  });
  assert.equal(recolored.ok, true);
  assert.equal(recolored.privateB.hand.legalRecolor, 0);
  assert.equal(recolored.state.turn, turnBefore);
  assert.equal(recolored.state.phase, "WORK");
  assert.equal(recolored.state.active, "A");
  assert.deepEqual(JSON.parse(JSON.stringify(recolored.publicState.lastPublicTrace)), {
    eventId: `${recolored.state.matchId}:3`, version: 3, type: "LEGAL_RECOLOR", actor: "B", regionId: "R1", color: recolored.state.regions.R1.color,
  });

  const progression = engine.applyProfiles({
    profiles, beforeState: colored.state, nextState: recolored.state, actor: "B",
    action: { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } },
    finishedAt: "2026-09-06T00:00:00.000Z", labMode: true,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(progression.changed)), { A: false, B: false });
  assert.equal(JSON.stringify(progression.profiles), profileBytes);
});

test("Edge derives lab agreement from stored setup metadata and fails closed", () => {
  assert.match(edgeSource, /const LAB_SETUP_KEY = "__experimentalLegalRecolor"/);
  assert.match(edgeSource, /setupRoom\.access_mode !== "private_code" \|\| setupRoom\.opponent_kind === "cpu"/);
  assert.match(edgeSource, /const labMode = labModeForRoom\(room\)/);
  assert.match(edgeSource, /if \(labMode === null\).*LAB_MODE_MISMATCH/);
  assert.match(edgeSource, /const labAgreement = labModeForRoom\(room\)/);
  assert.match(edgeSource, /debugAgreement === null \|\| labAgreement === null \|\| debugAgreement && labAgreement/);
  assert.match(edgeSource, /state: authority\.state as JsonObject,[\s\S]+labMode,/);
  assert.match(edgeSource, /applyProfiles\(\{[\s\S]+debugMode,[\s\S]+labMode,/);
  assert.doesNotMatch(edgeSource, /body\.labMode[\s\S]{0,300}FourColorStandardServerEngine\.apply/);
});
