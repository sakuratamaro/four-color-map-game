"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const engine = require("../standard/standard-engine.js");

const cell = (x, y) => y * 48 + x;
const region = (id, x, y, color, extra = {}) => ({ id, micro: [cell(x, y)], sourceMacros: [], controllers: [], color, isPending: false, ...extra });

function state(overrides = {}) {
  return {
    schemaVersion: 1,
    mode: "standard",
    version: 7,
    active: "A",
    phase: "WORK",
    turn: 4,
    requiredSize: 3,
    rolledSize: 4,
    pending: null,
    winner: null,
    regions: { R12: region("R12", 10, 10, "red") },
    palettes: { A: ["red", "blue", "yellow"], B: ["blue", "yellow", "green"] },
    hands: { A: { legalRecolor: 1 }, B: { legalRecolor: 1 } },
    skillsUsed: { A: 0, B: 0 },
    interferenceLock: false,
    log: [],
    ...overrides,
  };
}

test("candidate colors use only public adjacency and exclude the current color", () => {
  const base = state({ regions: {
    R12: region("R12", 10, 10, "red"),
    R3: region("R3", 9, 10, "blue"),
    R20: region("R20", 10, 9, "yellow"),
  } });
  assert.deepEqual(engine.legalRecolorCandidates(base, "R12"), ["green"]);
  const secretChanged = structuredClone(base);
  secretChanged.palettes = { A: ["green"], B: ["red"] };
  secretChanged.hands.B = { hiddenSkill: 99 };
  secretChanged.privateEffects = { B: { forcedColor: "green" } };
  assert.deepEqual(engine.legalRecolorCandidates(secretChanged, "R12"), ["green"]);
});

test("zero candidates preserve identity, state bytes, card, turn, version, and RNG", () => {
  const base = state({ regions: {
    R12: region("R12", 10, 10, "red"),
    R3: region("R3", 9, 10, "blue"),
    R5: region("R5", 11, 10, "yellow"),
    R8: region("R8", 10, 9, "green"),
  } });
  const before = JSON.stringify(base);
  const stream = engine.createStream(1234);
  const rngBefore = stream.snapshot();
  const result = engine.applyLegalRecolor(base, "A", "R12", { effectRandom: () => stream.next() });
  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_LEGAL_RECOLOR");
  assert.equal(result.state, base);
  assert.equal(JSON.stringify(base), before);
  assert.equal(stream.snapshot(), rngBefore);
});

test("success consumes exactly once and passes unchanged WORK requirement", () => {
  const base = state({ regions: {
    R12: region("R12", 10, 10, "red"),
    R3: region("R3", 9, 10, "blue"),
    R5: region("R5", 11, 10, "yellow"),
  } });
  let calls = 0;
  const result = engine.applyLegalRecolor(base, "A", "R12", { effectRandom: () => { calls += 1; return 0.99; } });
  assert.equal(result.ok, true);
  assert.equal(result.color, "green");
  assert.equal(calls, 1);
  assert.equal(result.state.hands.A.legalRecolor, 0);
  assert.equal(result.state.skillsUsed.A, 1);
  assert.equal(result.state.version, 8);
  assert.equal(result.state.active, "B");
  assert.equal(result.state.phase, "WORK");
  assert.equal(result.state.requiredSize, 3);
  assert.equal(result.state.rolledSize, 4);
  assert.equal(result.state.interferenceLock, true);
  assert.deepEqual(result.merge, { keptId: "R12", droppedIds: [] });
  assert.equal(engine.sameColorAdjacentCount(result.state, "R12"), 0);
  assert.equal(base.hands.A.legalRecolor, 1);
  assert.equal(base.version, 7);
});

test("same-color component merge keeps the smallest numeric region id independent of object order", () => {
  const make = (entries) => state({ regions: Object.fromEntries(entries.map(([id, value]) => [id, structuredClone(value)])) });
  const entries = [
    ["R12", region("R12", 10, 10, "green", { sourceMacros: [12], controllers: ["A"] })],
    ["R3", region("R3", 9, 10, "green", { sourceMacros: [3], controllers: ["B"] })],
    ["R20", region("R20", 8, 10, "green", { sourceMacros: [20], controllers: ["A"] })],
  ];
  for (const ordered of [entries, [...entries].reverse()]) {
    const current = make(ordered);
    const result = engine.mergeSameColorComponent(current, "R12");
    assert.equal(result.keptId, "R3");
    assert.deepEqual(result.droppedIds, ["R12", "R20"]);
    assert.deepEqual(Object.keys(current.regions), ["R3"]);
    assert.deepEqual(current.regions.R3.micro, [cell(8, 10), cell(9, 10), cell(10, 10)]);
    assert.deepEqual(current.regions.R3.sourceMacros, [3, 12, 20]);
    assert.deepEqual(current.regions.R3.controllers, ["A", "B"]);
  }
});

test("interference chaining is blocked until entering COLOR", () => {
  const base = state();
  const first = engine.applyLegalRecolor(base, "A", "R12", { effectRandom: () => 0 }).state;
  assert.throws(() => engine.applyLegalRecolor(first, "B", "R12", { effectRandom: () => 0 }), (error) => error.code === "INTERFERENCE_CHAINED");
  const colorState = { ...first, phase: "COLOR" };
  const unlocked = engine.onEnterColor(colorState);
  assert.equal(unlocked.interferenceLock, false);
  assert.equal(colorState.interferenceLock, true);
});

test("rejected targets never mutate or consume effect RNG", () => {
  const cases = [
    state({ phase: "COLOR" }),
    state({ active: "B" }),
    state({ regions: { R12: region("R12", 10, 10, null) } }),
    state({ pending: "R12", regions: { R12: region("R12", 10, 10, "red", { isPending: true }) } }),
    state({ regions: { R12: region("R12", 10, 10, "red", { delayed: true }) } }),
  ];
  for (const current of cases) {
    const before = JSON.stringify(current);
    let calls = 0;
    assert.throws(() => engine.applyLegalRecolor(current, "A", "R12", { effectRandom: () => { calls += 1; return 0; } }), engine.StandardRuleError);
    assert.equal(calls, 0);
    assert.equal(JSON.stringify(current), before);
  }
});
