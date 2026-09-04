"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const save = require("../standard/standard-save.js");

const root = path.join(__dirname, "..");
const edgeSource = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");
const bundle = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "standard-engine.bundle.js"), "utf8");

function loadApi() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(bundle, sandbox, { filename: "standard-engine.bundle.js" });
  return sandbox.FourColorStandardServerEngine;
}

const loadouts = {
  A: {
    color: ["colorPrism", "colorChoiceBorrow"],
    area: ["areaHalfShift", "areaDiePlus"],
    disrupt: ["disruptChoiceOne", "disruptRandomOne"],
  },
  B: {
    color: ["colorPaletteChange", "colorRandomBorrow"],
    area: ["areaResize", "areaTripleShift"],
    disrupt: ["disruptChoiceTwo", "disruptPaletteRandom"],
  },
};

test("debug duel accepts unowned cards, replenishes used skills, and changes no progression", () => {
  const api = loadApi();
  const emptyProfiles = Object.fromEntries(["A", "B"].map((seat) => [seat, save.createProfile({ name: `Debug ${seat}`, inventory: {} })]));
  const created = api.create({ matchId: "debug-unlimited", loadouts, profiles: emptyProfiles, seed: 77, firstSeat: "A", debugMode: true });
  assert.equal(created.publicState.debugUnlimitedSkills, true);
  assert.equal(created.privateA.hand.areaDiePlus, 1);

  const applied = api.apply({
    state: created.state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { id: "debug-skill-1", type: "USE_SKILL", payload: { skill: "areaDiePlus" } },
    debugMode: true,
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.privateA.hand.areaDiePlus, 1);
  assert.equal(applied.publicState.debugUnlimitedSkills, true);

  const progression = api.applyProfiles({
    profiles: emptyProfiles,
    beforeState: created.state,
    nextState: applied.state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaDiePlus" } },
    finishedAt: "2026-09-04T00:00:00.000Z",
    debugMode: true,
  });
  assert.equal(progression.changed.A, false);
  assert.equal(progression.changed.B, false);
  assert.equal(JSON.stringify(progression.profiles), JSON.stringify(emptyProfiles));
});

test("normal duel still rejects unowned cards", () => {
  const api = loadApi();
  const emptyProfiles = Object.fromEntries(["A", "B"].map((seat) => [seat, save.createProfile({ name: `Normal ${seat}`, inventory: {} })]));
  assert.throws(() => api.create({ matchId: "normal-owned", loadouts, profiles: emptyProfiles, seed: 77 }), /INSUFFICIENT_INVENTORY/);
});

test("Edge handler marks debug setup, requires agreement, and disables profile progression", () => {
  assert.match(edgeSource, /const DEBUG_SETUP_KEY = "__debugUnlimitedSkills"/);
  assert.match(edgeSource, /validateSeatLoadout\(debugMode[\s\S]+\? \{ loadout: loadout as JsonObject \}/);
  assert.match(edgeSource, /DEBUG_MODE_MISMATCH/);
  assert.match(edgeSource, /playableLoadout\(room\.setup_a as JsonObject\)/);
  assert.match(edgeSource, /debugModeForRoom\(room\) === true/);
  assert.match(edgeSource, /applyProfiles\(\{[\s\S]+debugMode,/);
});
