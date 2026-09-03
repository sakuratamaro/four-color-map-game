"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const handlers = require("../standard/standard-skill-handlers.js");

function streams(seed = 8501) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function macroMicroCells(macro) {
  const row = Math.floor(macro / 12);
  const col = macro % 12;
  const cells = [];
  for (let dy = 0; dy < 4; dy += 1) for (let dx = 0; dx < 4; dx += 1) cells.push((row * 4 + dy) * 48 + col * 4 + dx);
  return cells;
}

function fixture() {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "triple-shift", firstSeat: "A", hands: { A: { areaTripleShift: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  state.regions = {
    R1: { id: "R1", micro: [13, 25, 37].flatMap(macroMicroCells), sourceMacros: [13, 25, 37], controllers: ["A"], color: "red", isPending: false },
  };
  match.validateStandardState(state);
  return { state, rng };
}

function use(state, rng, payload = { axis: "ROW", index: 2, direction: "plus" }) {
  return match.applyStandardAction({ state, actor: "A", action: { type: "USE_SKILL", payload: { skill: "areaTripleShift", ...payload } }, expectedVersion: state.version, rngStreams: rng });
}

test("triple shift moves the center one macro and adjacent bands half a macro without RNG", () => {
  const { state, rng } = fixture();
  const beforeRng = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
  const original = new Set(state.regions.R1.micro);
  const plan = handlers.planTripleShift(state, { axis: "ROW", index: 2, direction: "plus" });
  assert.equal(plan.ok, true);
  assert.equal(plan.movedCount, 48);
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 0);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.areaTripleShift, 0);
  assert.equal(result.state.regions.R1.micro.length, 48);
  assert.equal(result.state.regions.R1.micro.includes(8 * 48 + 8), original.has(8 * 48 + 4));
  assert.equal(result.state.regions.R1.micro.includes(4 * 48 + 6), original.has(4 * 48 + 4));
  assert.deepEqual(Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()])), beforeRng);
  match.validateStandardState(result.state);
});

test("triple shift supports vertical negative movement and repeated transformed geometry", () => {
  const { state, rng } = fixture();
  const first = use(state, rng, { axis: "ROW", index: 2, direction: "minus" });
  assert.equal(first.ok, true);
  first.state.hands.A.areaTripleShift = 1;
  const second = use(first.state, rng, { axis: "COLUMN", index: 1, direction: "plus" });
  assert.equal(second.ok, true);
  match.validateStandardState(second.state);
});

test("edge, empty, world, and prepared paths reject atomically", () => {
  const cases = [];
  {
    const { state, rng } = fixture();
    cases.push({ state, rng, payload: { axis: "ROW", index: 0, direction: "plus" }, code: "INVALID_SHIFT_BAND" });
  }
  {
    const { state, rng } = fixture();
    cases.push({ state, rng, payload: { axis: "ROW", index: 8, direction: "plus" }, code: "EMPTY_SHIFT_BAND" });
  }
  {
    const { state, rng } = fixture();
    state.regions = { R1: { ...state.regions.R1, micro: [8 * 48 + 47], sourceMacros: [35] } };
    cases.push({ state, rng, payload: { axis: "ROW", index: 2, direction: "plus" }, code: "SHIFT_OUT_OF_WORLD" });
  }
  {
    const { state, rng } = fixture();
    state.regions = { R1: { ...state.regions.R1, micro: [7 * 48 + 4, 8 * 48 + 4], sourceMacros: [13, 25] } };
    cases.push({ state, rng, payload: { axis: "ROW", index: 2, direction: "plus" }, code: "SHIFT_DISCONNECTS_REGION" });
  }
  {
    const { state, rng } = fixture();
    state.regions = {};
    state.requiredSize = 1;
    state.rolledSize = 1;
    state.baseRequiredSize = 1;
    state.hands.A.areaCornerBloom = 1;
    const prepared = match.applyStandardAction({
      state,
      actor: "A",
      action: { type: "USE_SKILL", payload: { skill: "areaCornerBloom", sourceMacros: [26], macro: 26 } },
      expectedVersion: state.version,
      rngStreams: rng,
    }).state;
    cases.push({ state: prepared, rng, payload: { axis: "ROW", index: 2, direction: "plus" }, code: "PREPARED_OUTGOING_EXISTS" });
  }
  for (const { state, rng, payload, code } of cases) {
    const before = JSON.stringify(state);
    const result = use(state, rng, payload);
    assert.equal(result.code, code);
    assert.equal(result.state, state);
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.hands.A.areaTripleShift, 1);
  }
});

test("wrong seat, phase, unavailable card, and malformed targets reject before mutation", () => {
  const { state, rng } = fixture();
  state.phase = "COLOR";
  const wrongPhase = use(state, rng);
  assert.equal(wrongPhase.code, "WRONG_PHASE");
  assert.equal(wrongPhase.state, state);
  state.phase = "WORK";
  const wrongSeat = match.applyStandardAction({ state, actor: "B", action: { type: "USE_SKILL", payload: { skill: "areaTripleShift", axis: "ROW", index: 2, direction: "plus" } }, expectedVersion: state.version, rngStreams: rng });
  assert.equal(wrongSeat.code, "NOT_YOUR_TURN");
  state.hands.A.areaTripleShift = 0;
  assert.equal(use(state, rng).code, "SKILL_UNAVAILABLE");
  state.hands.A.areaTripleShift = 1;
  assert.equal(use(state, rng, { axis: "DIAGONAL", index: 2, direction: "plus" }).code, "INVALID_TARGET_SCHEMA");
});
