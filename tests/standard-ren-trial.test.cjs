"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const trial = require("../standard/standard-cpu-progression.js");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const roster = require("../standard/standard-cpu-roster.js");
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(seed = 7) { const value = trial.createRenTrial({ matchId: "trial-fixture", seed }); return { ...value, streams: engine.createRngDomainsFromSnapshot(value.rngSnapshot, match.REQUIRED_RNG_STREAMS) }; }
function act(value, type, payload) {
  const result = match.applyStandardAction({ state: value.state, actor: value.state.active, expectedVersion: value.state.version, rngStreams: value.streams, action: { type, payload } });
  assert.equal(result.ok, true, result.code); value.state = result.state; return result;
}

test("AC-064-01: truthful progression priority uses Ren records, with no inferred date or aggregate unlock", () => {
  assert.equal(trial.projectRenProgression({}).stage, "first_meeting");
  assert.equal(trial.projectRenProgression({ cpuStats: { wins: 99 } }).trialUnlocked, false);
  assert.equal(trial.projectRenProgression({ cpuCharacterStats: { ren: { matches: 1, wins: 0 } } }).stage, "returning");
  const saved = { cpuCharacterStats: { ren: { matches: 1, wins: 1 } } }, before = clone(saved);
  assert.equal(trial.projectRenProgression(saved).stage, "trial_unlocked");
  assert.deepEqual(saved, before, "missing firstWinAt is not invented");
  assert.equal(trial.projectRenProgression({ ...saved, learnedTechniques: ["techUnsealOne"] }).stage, "learned");
  for (const wins of ["1", null, -1, 1.2, Infinity]) assert.equal(trial.projectRenProgression({ cpuCharacterStats: { ren: { wins } } }).trialUnlocked, false);
});

test("AC-064-02: real valid template preserves requested contacts, normal dimensions and fixed loans", () => {
  const { state } = fixture();
  assert.equal(match.validateStandardState(state), true);
  assert.equal(state.playableBounds.macroWidth, 12); assert.equal(state.microWidth, 48);
  assert.equal(state.playableBounds.maxCol - state.playableBounds.minCol + 1, 6);
  assert.equal(state.playableBounds.maxRow - state.playableBounds.minRow + 1, 6);
  assert.deepEqual(engine.adjacentRegionIds(state, "R3").sort(), ["R1", "R2"]);
  for (const seat of ["A", "B"]) {
    assert.equal(state.techniques[seat].usesRemaining, 1);
    assert.deepEqual(state.hands[seat], Object.fromEntries(Object.values(trial.TRIAL_LOADOUT).flat().map(id => [id, 1])));
  }
  assert.equal(state.lastPublicTrace, null);
  assert.equal(state.skillsUsed.A, 0); assert.equal(state.skillsUsed.B, 0);
  assert.deepEqual(state.publicEffects.A.seals, { red: 2 });
  assert.deepEqual(state.privateEffects, { A: {}, B: {} });
  assert.equal(state.phase, "COLOR"); assert.equal(state.pending, "R3");
});

test("AC-064-02 path A: unseal red, then red retains the yellow bonus and continues", () => {
  const value = fixture();
  act(value, "USE_SKILL", { skill: "techUnsealOne", color: "red" });
  act(value, "COLOR_REGION", { color: "red" });
  assert.equal(value.state.phase, "WORK"); assert.notEqual(value.state.status, "FINISHED");
  assert.equal(value.state.bonusUsesRemaining.A, 1); assert.equal(value.state.techniques.A.usesRemaining, 0);
});

test("AC-064-02 path B: yellow spends the bonus and preserves unseal; no forced technique objective", () => {
  const value = fixture();
  act(value, "COLOR_REGION", { color: "yellow" });
  assert.equal(value.state.phase, "WORK"); assert.notEqual(value.state.status, "FINISHED");
  assert.equal(value.state.bonusUsesRemaining.A, 0); assert.equal(value.state.techniques.A.usesRemaining, 1);
});

test("AC-064-05: trial CPU unseals a useful own color, never an adjacent/empty/used target", () => {
  const value = fixture();
  value.state.active = "B"; value.state.skillCategoryWindow = { actor: "B", categories: [] };
  value.state.publicEffects.B.seals = { yellow: 2, green: 3, blue: 1 };
  const observation = () => ({ publicState: match.projectStandardPublicState(value.state), ownPrivateState: match.projectStandardPrivateState(value.state, "B") });
  const action = trial.chooseRenTrialAction({ ...observation(), policyVersion: trial.TRIAL_POLICY_VERSION, random: () => 0 });
  assert.deepEqual(action.payload, { skill: "techUnsealOne", color: "yellow" });
  act(value, action.type, action.payload);
  assert.deepEqual(trial.usefulUnsealActions(...Object.values(observation())), []);
  value.state.techniques.B.usesRemaining = 1; value.state.skillCategoryWindow.categories = [];
  value.state.publicEffects.B.seals.yellow = 0;
  assert.deepEqual(trial.usefulUnsealActions(...Object.values(observation())), []);
});

test("AC-064-05: source policy is exact and changing opponent secrets does not change trial CPU choice", () => {
  const value = fixture(); value.state.active = "B"; value.state.skillCategoryWindow.actor = "B";
  const choose = () => trial.chooseRenTrialAction({ publicState: match.projectStandardPublicState(value.state), ownPrivateState: match.projectStandardPrivateState(value.state, "B"), policyVersion: trial.TRIAL_POLICY_VERSION, random: () => 0.2 });
  const before = choose(); value.state.hands.A.colorPrism = 37; value.state.basicPalettes.A = ["green", "yellow"];
  assert.deepEqual(choose(), before);
  assert.throws(() => trial.chooseRenTrialAction({ policyVersion: "ren-unseal-trial-v2" }), /UNKNOWN_TRIAL_POLICY_VERSION/);
});

for (const route of ["red", "yellow"]) test(`AC-064-02 full WIN: ${route} route completes against the actual versioned Ren policy`, () => {
  const value = fixture(1), trace = [];
  if (route === "red") act(value, "USE_SKILL", { skill: "techUnsealOne", color: "red" });
  act(value, "COLOR_REGION", { color: route });
  for (let count = 0; count < 160 && value.state.status !== "FINISHED"; count++) {
    const seat = value.state.active;
    const observation = { publicState: match.projectStandardPublicState(value.state), ownPrivateState: match.projectStandardPrivateState(value.state, seat),
      random: () => value.streams["cpu-" + seat].next(), tieBreakRandom: () => value.streams["cpu-tie-break"].next() };
    const action = seat === "B" ? trial.chooseRenTrialAction({ ...observation, policyVersion: trial.TRIAL_POLICY_VERSION })
      : roster.chooseCharacterAction({ ...observation, characterId: "ren", policyVersion: roster.PRE_SPLIT_POLICY_VERSIONS.ren });
    trace.push({ actor: seat, type: action.type });
    act(value, action.type, action.payload);
    assert.equal(match.validateStandardState(value.state), true);
  }
  assert.equal(value.state.status, "FINISHED");
  assert.equal(value.state.winner, "A");
  assert.equal(value.state.terminalReason, "SURRENDER");
  assert.deepEqual(trace.at(-1), { actor: "B", type: "SURRENDER" }, "only the real CPU policy chooses its concession");
  assert.equal(value.state.techniques.A.usesRemaining, route === "red" ? 0 : 1);
  assert.ok(trace.some(action => action.type === "CREATE_REGION"));
});
