"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 8701) { return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }

function fixture() {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "random-two-seal", firstSeat: "A", hands: { A: { disruptRandomTwo: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  match.validateStandardState(state);
  return { state, rng };
}

function use(state, rng, actor = "A") {
  return match.applyStandardAction({ state, actor, action: { type: "USE_SKILL", payload: { skill: "disruptRandomTwo" } }, expectedVersion: state.version, rngStreams: rng });
}

test("random double seal draws twice, chooses distinct public colors, and consumes once", () => {
  const { state, rng } = fixture();
  const before = rng["skill-effect"].snapshot();
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 2);
  assert.equal(rng["skill-effect"].snapshot(), (before + 2 * 0x6d2b79f5) >>> 0);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.disruptRandomTwo, 0);
  assert.equal(result.colors.length, 2);
  assert.equal(new Set(result.colors).size, 2);
  for (const color of result.colors) assert.equal(result.publicState.publicEffects.B.seals[color], 1);
});

test("one or two already sealed hits preserve stronger durations but still resolve", () => {
  const { state, rng } = fixture();
  for (const color of engine.COLORS) state.publicEffects.B.seals[color] = 3;
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.publicEffects.B.seals, { red: 3, blue: 3, yellow: 3, green: 3 });
  assert.equal(result.state.hands.A.disruptRandomTwo, 0);
  assert.equal(result.rngDraws, 2);
});

test("wrong phase, seat, unavailable card, stale version, and missing RNG reject atomically", () => {
  const { state, rng } = fixture();
  const beforeRng = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
  state.phase = "COLOR";
  assert.equal(use(state, rng).code, "WRONG_PHASE");
  state.phase = "WORK";
  assert.equal(use(state, rng, "B").code, "NOT_YOUR_TURN");
  state.hands.A.disruptRandomTwo = 0;
  assert.equal(use(state, rng).code, "SKILL_UNAVAILABLE");
  state.hands.A.disruptRandomTwo = 1;
  const stale = match.applyStandardAction({ state, actor: "A", action: { type: "USE_SKILL", payload: { skill: "disruptRandomTwo" } }, expectedVersion: state.version + 1, rngStreams: rng });
  assert.equal(stale.code, "VERSION_CONFLICT");
  assert.equal(use(state, {}).code, "RNG_REQUIRED_SKILL_EFFECT");
  assert.deepEqual(Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()])), beforeRng);
});

test("both one-turn seals expire together after the target colors", () => {
  const { state, rng } = fixture();
  const result = use(state, rng);
  const sealed = result.state;
  sealed.active = "B";
  sealed.phase = "COLOR";
  sealed.regions.R1 = { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: null, isPending: true };
  sealed.pending = "R1";
  const legalColor = sealed.basicPalettes.B.find((color) => !result.colors.includes(color));
  if (!legalColor) {
    sealed.privateEffects.B.prism = true;
  }
  const chosen = legalColor || engine.COLORS.find((color) => !result.colors.includes(color));
  const colored = match.applyStandardAction({ state: sealed, actor: "B", action: { type: "COLOR_REGION", payload: { color: chosen } }, expectedVersion: sealed.version, rngStreams: rng });
  assert.equal(colored.ok, true);
  for (const color of result.colors) assert.equal(colored.state.publicEffects.B.seals[color], 0);
});
