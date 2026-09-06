"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const cpu = require("../standard/standard-cpu.js");
const { playGame } = require("../scripts/standard-cpu-selfplay.cjs");

function streams(seed = 9401) {
  return createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function macroMicroCells(macro) {
  const row = Math.floor(macro / 12);
  const col = macro % 12;
  const cells = [];
  for (let dy = 0; dy < 4; dy += 1) for (let dx = 0; dx < 4; dx += 1) cells.push((row * 4 + dy) * 48 + col * 4 + dx);
  return cells;
}

function workState(engineVersion = match.ENGINE_VERSION, controllers = ["B"]) {
  const rng = streams();
  const state = match.createStandardMatch({
    matchId: `cpu-colored-corner-${engineVersion.replaceAll(".", "-")}`,
    firstSeat: "A",
    engineVersion,
    hands: { A: { areaCornerBloom: 1, areaDiePlus: 1 }, B: {} },
  }, rng);
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: { id: "R1", micro: macroMicroCells(26), sourceMacros: [99], controllers, color: "red", isPending: false },
  };
  match.validateStandardState(state);
  return { state, rng };
}

function observation(state, difficulty = "hard") {
  return cpu.makeObservation({
    publicState: match.projectStandardPublicState(state),
    ownPrivateState: match.projectStandardPrivateState(state, state.active),
    difficulty,
  });
}

function coloredActions(state) {
  return cpu.enumerateCpuActions(observation(state)).filter((action) => action.type === "USE_SKILL"
    && action.payload.skill === "areaCornerBloom" && Object.hasOwn(action.payload, "regionId"));
}

test("alpha.4 CPU derives finite colored-corner targets from current public micro geometry without controllers", () => {
  let baseline;
  for (const controllers of [["A"], ["B"], ["A", "B"], []]) {
    const { state, rng } = workState(match.ENGINE_VERSION, controllers);
    const actions = coloredActions(state);
    assert.deepEqual(actions.map((action) => action.payload), [{ skill: "areaCornerBloom", regionId: "R1", macro: 26 }]);
    assert.equal(actions[0].metrics.addedCount, 12);
    if (baseline) assert.deepEqual(actions, baseline);
    else baseline = actions;
    const result = match.applyStandardAction({ state, actor: "A", action: actions[0], expectedVersion: state.version, rngStreams: rng });
    assert.deepEqual([result.ok, result.state.active, result.state.phase, result.state.version], [true, "A", "WORK", 1]);
  }
});

test("CPU excludes uncolored, reserved, deleted, and delayed regions from colored-corner enumeration", () => {
  const { state } = workState();
  state.regions.R2 = { id: "R2", micro: macroMicroCells(30), sourceMacros: [30], controllers: [], color: null, isPending: false };
  state.regions.R3 = { id: "R3", micro: macroMicroCells(34), sourceMacros: [34], controllers: [], color: null, isPending: false, isReserved: true };
  state.reserved = "R3";
  state.regions.R4 = { id: "R4", micro: macroMicroCells(38), sourceMacros: [38], controllers: [], color: "blue", isPending: false, deleted: true };
  state.regions.R5 = { id: "R5", micro: macroMicroCells(42), sourceMacros: [42], controllers: [], color: "yellow", isPending: false, delayed: true };
  state.regions.R6 = { id: "R6", micro: macroMicroCells(46), sourceMacros: [46], controllers: [], color: "green", isPending: false, delayState: { turns: 1 } };
  match.validateStandardState(state);
  assert.deepEqual(coloredActions(state).map((action) => action.payload.regionId), ["R1"]);
});

test("alpha.1, alpha.2, and alpha.3 CPU emit only the legacy outgoing corner-bloom payload", () => {
  for (const engineVersion of [match.LEGACY_ENGINE_VERSION, match.PREVIOUS_ENGINE_VERSION, match.CATEGORY_WINDOW_ENGINE_VERSION]) {
    const { state } = workState(engineVersion);
    const actions = cpu.enumerateCpuActions(observation(state)).filter((action) => action.payload?.skill === "areaCornerBloom");
    assert.ok(actions.length > 0, `${engineVersion}: missing outgoing candidate`);
    assert.equal(actions.some((action) => Object.hasOwn(action.payload, "regionId")), false, engineVersion);
    assert.equal(actions.every((action) => Array.isArray(action.payload.sourceMacros) && Number.isInteger(action.payload.macro)), true, engineVersion);
  }
});

test("the existing usage-category filter removes old and colored corner candidates after area use", () => {
  for (const engineVersion of [match.CATEGORY_WINDOW_ENGINE_VERSION, match.ENGINE_VERSION]) {
    const { state } = workState(engineVersion);
    state.skillCategoryWindow.categories = ["area"];
    const actions = cpu.enumerateCpuActions(observation(state));
    assert.equal(actions.some((action) => action.type === "USE_SKILL" && action.payload.skill === "areaCornerBloom"), false, engineVersion);
    assert.equal(actions.some((action) => action.type === "USE_SKILL" && action.payload.skill === "areaDiePlus"), false, engineVersion);
  }
});

test("CPU remains finite after resolving a colored corner and across bounded alpha.4 self-play", () => {
  const { state, rng } = workState();
  const action = coloredActions(state)[0];
  const resolved = match.applyStandardAction({ state, actor: "A", action, expectedVersion: state.version, rngStreams: rng });
  assert.equal(resolved.ok, true);
  const nextActions = cpu.enumerateCpuActions(observation(resolved.state));
  assert.ok(nextActions.length > 0);
  assert.equal(nextActions.some((candidate) => candidate.type === "USE_SKILL" && candidate.payload.skill === "areaCornerBloom"), false);

  for (const seed of [9410, 9411, 9412, 9413]) {
    const report = playGame({ seed, firstSeat: seed % 2 ? "A" : "B", levelA: "hard", levelB: "normal", maxActions: 300 });
    assert.equal(report.completed, true, `seed ${seed}`);
    assert.equal(report.rejectedActions, 0, `seed ${seed}: ${report.rejectedCode || "unknown"}`);
    assert.ok(report.acceptedActions > 0 && report.acceptedActions <= 300, `seed ${seed}: non-finite action count`);
  }
});
