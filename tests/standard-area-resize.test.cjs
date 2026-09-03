"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 8301) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function microForMacro(macro) {
  const row = Math.floor(macro / 12);
  const col = macro % 12;
  const cells = [];
  for (let dy = 0; dy < 4; dy += 1) {
    for (let dx = 0; dx < 4; dx += 1) cells.push((row * 4 + dy) * 48 + col * 4 + dx);
  }
  return cells;
}

function fixture({ resizeCards = 1, requiredSize = 1 } = {}) {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "area-resize", firstSeat: "A", hands: { A: { areaResize: resizeCards }, B: {} } }, rng);
  state.phase = "WORK";
  state.active = "A";
  state.requiredSize = requiredSize;
  state.rolledSize = Math.min(requiredSize, 4);
  state.baseRequiredSize = Math.min(requiredSize, 4);
  return { state, rng };
}

function use(state, rngStreams, mode, side, actor = "A") {
  return match.applyStandardAction({
    state,
    actor,
    action: { type: "USE_SKILL", payload: { skill: "areaResize", mode, side } },
    expectedVersion: state.version,
    rngStreams,
  });
}

function snapshots(rng) {
  return Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
}

test("four expansions reach the world boundary and grow the persistent trophy target", () => {
  const { state, rng } = fixture({ resizeCards: 5 });
  const rngBefore = snapshots(rng);
  let current = state;
  for (const [side, count] of [["top", 110], ["left", 121], ["bottom", 132], ["right", 144]]) {
    const result = use(current, rng, "expand", side);
    assert.equal(result.ok, true);
    assert.equal(result.rngDraws, 0);
    assert.equal(result.state.trophyTargetMacros.length, count);
    current = result.state;
  }
  assert.deepEqual(current.playableBounds, { minCol: 0, maxCol: 11, minRow: 0, maxRow: 11, macroWidth: 12, microScale: 4 });
  assert.equal(current.hands.A.areaResize, 1);
  assert.deepEqual(snapshots(rng), rngBefore);
  const before = JSON.stringify(current);
  const unavailable = use(current, rng, "expand", "top");
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.code, "BOARD_SIDE_UNAVAILABLE");
  assert.equal(JSON.stringify(current), before);
});

test("shrink preserves colored geometry and historical trophy targets but blocks new writes", () => {
  const { state, rng } = fixture();
  state.regions = {
    R1: { id: "R1", sourceMacros: [13], micro: microForMacro(13), controllers: ["B"], color: "red", isPending: false },
  };
  const result = use(state, rng, "shrink", "left");
  assert.equal(result.ok, true);
  assert.equal(result.state.playableBounds.minCol, 2);
  assert.deepEqual(result.state.regions.R1, state.regions.R1);
  assert.equal(result.state.trophyTargetMacros.length, 100);
  assert.equal(result.state.trophyTargetMacros.includes(13), true);
  const outside = match.applyStandardAction({ state: result.state, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [13] } }, expectedVersion: result.state.version, rngStreams: rng });
  assert.equal(outside.ok, false);
  assert.equal(outside.code, "OUTSIDE_PLAYABLE_BOUNDS");
  const inside = match.applyStandardAction({ state: result.state, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: result.state.version, rngStreams: rng });
  assert.equal(inside.ok, true);
});

test("shrink stops at six macros and invalid intents are atomic", () => {
  const { state, rng } = fixture({ resizeCards: 5 });
  let current = state;
  for (let count = 0; count < 4; count += 1) {
    const result = use(current, rng, "shrink", "left");
    assert.equal(result.ok, true);
    current = result.state;
  }
  assert.equal(current.playableBounds.maxCol - current.playableBounds.minCol + 1, 6);
  const before = JSON.stringify(current);
  const rngBefore = snapshots(rng);
  const minimum = use(current, rng, "shrink", "left");
  assert.equal(minimum.code, "BOARD_SIDE_UNAVAILABLE");
  for (const [mode, side] of [["grow", "left"], ["expand", "north"], [null, "top"]]) {
    const invalid = use(current, rng, mode, side);
    assert.equal(invalid.code, "INVALID_TARGET_SCHEMA");
  }
  assert.equal(JSON.stringify(current), before);
  assert.deepEqual(snapshots(rng), rngBefore);
});

test("resize recalculates legal size while preserving an available die-plus bonus", () => {
  const { state, rng } = fixture();
  state.hands.A.areaDiePlus = 1;
  const expandedSize = match.applyStandardAction({ state, actor: "A", action: { type: "USE_SKILL", payload: { skill: "areaDiePlus" } }, expectedVersion: state.version, rngStreams: rng });
  assert.equal(expandedSize.ok, true);
  assert.deepEqual([expandedSize.state.baseRequiredSize, expandedSize.state.requiredSize], [1, 2]);
  const resized = use(expandedSize.state, rng, "expand", "top");
  assert.equal(resized.ok, true);
  assert.deepEqual([resized.state.baseRequiredSize, resized.state.requiredSize], [1, 2]);
  assert.equal(resized.state.hands.A.areaResize, 0);
});

test("resize after prepared outgoing geometry rejects without consuming", () => {
  const { state, rng } = fixture();
  state.hands.A.areaMicroBloom = 1;
  state.regions = {
    R1: { id: "R1", sourceMacros: [13], micro: microForMacro(13), controllers: ["B"], color: "red", isPending: false },
  };
  const bloomed = match.applyStandardAction({ state, actor: "A", action: { type: "USE_SKILL", payload: { skill: "areaMicroBloom", sourceMacros: [26] } }, expectedVersion: state.version, rngStreams: rng });
  assert.equal(bloomed.ok, true);
  const before = JSON.stringify(bloomed.state);
  const rngBefore = snapshots(rng);
  const result = use(bloomed.state, rng, "expand", "top");
  assert.equal(result.ok, false);
  assert.equal(result.code, "PREPARED_OUTGOING_EXISTS");
  assert.equal(JSON.stringify(bloomed.state), before);
  assert.deepEqual(snapshots(rng), rngBefore);
  assert.equal(bloomed.state.hands.A.areaResize, 1);
});

test("a legal shrink that removes the final writable cell resolves BOARD_LOCK without a false full-paint trophy", () => {
  const { state, rng } = fixture();
  const playable = [];
  for (let row = 1; row <= 10; row += 1) {
    for (let col = 1; col <= 10; col += 1) playable.push(row * 12 + col);
  }
  const occupied = playable.filter((macro) => macro !== 13);
  state.regions = {
    R1: { id: "R1", sourceMacros: occupied, micro: occupied.flatMap(microForMacro), controllers: ["B"], color: "red", isPending: false },
  };
  match.validateStandardState(state);
  const result = use(state, rng, "shrink", "left");
  assert.equal(result.ok, true);
  assert.deepEqual([result.state.status, result.state.phase, result.state.winner, result.state.terminalReason], ["FINISHED", "GAME_OVER", "A", "BOARD_LOCK"]);
  assert.deepEqual([result.state.baseRequiredSize, result.state.requiredSize], [0, 0]);
  assert.equal(result.state.hands.A.areaResize, 0);
  assert.equal(match.isMapCompleteWin(result.state), false);
});

test("bounds, trophy targets, projection, and encode/decode fail closed or round-trip exactly", () => {
  const { state, rng } = fixture();
  const expanded = use(state, rng, "expand", "top").state;
  const snapshot = snapshots(rng);
  const decoded = match.decodeStandardMatch(match.encodeStandardMatch(expanded, snapshot));
  assert.deepEqual(decoded.state, expanded);
  assert.deepEqual(decoded.rngSnapshot, snapshot);
  assert.deepEqual(match.projectStandardPublicState(expanded).trophyTargetMacros, expanded.trophyTargetMacros);
  assert.equal(JSON.stringify(match.projectStandardPrivateState(expanded, "A")).includes("trophyTargetMacros"), false);
  const malformedBounds = JSON.parse(JSON.stringify(expanded));
  malformedBounds.playableBounds.minRow = -1;
  assert.throws(() => match.validateStandardState(malformedBounds), (error) => error.code === "INVALID_PLAYABLE_BOUNDS");
  const missingTarget = JSON.parse(JSON.stringify(expanded));
  missingTarget.trophyTargetMacros = missingTarget.trophyTargetMacros.filter((macro) => macro !== 1);
  assert.throws(() => match.validateStandardState(missingTarget), (error) => error.code === "INVALID_TROPHY_TARGETS");
  const outsideGeometry = JSON.parse(JSON.stringify(expanded));
  outsideGeometry.regions.R1 = { id: "R1", sourceMacros: [13], micro: [48 * 48], controllers: ["A"], color: "red", isPending: false };
  assert.throws(() => match.validateStandardState(outsideGeometry), (error) => error.code === "INVALID_REGION_GEOMETRY");

  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.trophyTargetMacros;
  assert.equal(match.validateStandardState(legacy), true);
  assert.equal(match.projectStandardPublicState(legacy).trophyTargetMacros.length, 100);
  const migratedOnUse = use(legacy, rng, "shrink", "left");
  assert.equal(migratedOnUse.ok, true);
  assert.equal(migratedOnUse.state.trophyTargetMacros.length, 100);
});
