"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 8601) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function fixture() {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "random-seal", firstSeat: "A", hands: { A: { disruptRandomOne: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  match.validateStandardState(state);
  return { state, rng };
}

function use(state, rng, actor = "A") {
  return match.applyStandardAction({ state, actor, action: { type: "USE_SKILL", payload: { skill: "disruptRandomOne" } }, expectedVersion: state.version, rngStreams: rng });
}

test("random seal draws exactly once, publishes the selected color, and consumes once", () => {
  const { state, rng } = fixture();
  const before = rng["skill-effect"].snapshot();
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 1);
  assert.equal(rng["skill-effect"].snapshot(), (before + 0x6d2b79f5) >>> 0);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.disruptRandomOne, 0);
  assert.equal(result.state.publicEffects.B.seals[result.color], 1);
  assert.equal(result.publicState.publicEffects.B.seals[result.color], 1);
  assert.equal(result.privateState.seat, "A");
  assert.equal(result.state.publicLog.at(-1).includes(result.color), true);
});

test("already sealed color is a legal empty hit that still consumes and draws once", () => {
  const { state, rng } = fixture();
  const preview = engine.createRngDomains(8601, match.REQUIRED_RNG_STREAMS);
  const color = engine.COLORS[Math.floor(preview["skill-effect"].next() * engine.COLORS.length)];
  state.publicEffects.B.seals[color] = 3;
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.color, color);
  assert.equal(result.state.publicEffects.B.seals[color], 3);
  assert.equal(result.state.hands.A.disruptRandomOne, 0);
  assert.equal(result.rngDraws, 1);
});

test("wrong phase, wrong seat, unavailable card, stale version, and missing RNG reject atomically", () => {
  const { state, rng } = fixture();
  const before = JSON.stringify(state);
  const rngBefore = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
  state.phase = "COLOR";
  assert.equal(use(state, rng).code, "WRONG_PHASE");
  state.phase = "WORK";
  assert.equal(use(state, rng, "B").code, "NOT_YOUR_TURN");
  state.hands.A.disruptRandomOne = 0;
  assert.equal(use(state, rng).code, "SKILL_UNAVAILABLE");
  state.hands.A.disruptRandomOne = 1;
  const stale = match.applyStandardAction({ state, actor: "A", action: { type: "USE_SKILL", payload: { skill: "disruptRandomOne" } }, expectedVersion: state.version + 1, rngStreams: rng });
  assert.equal(stale.code, "VERSION_CONFLICT");
  const missingRng = use(state, {});
  assert.equal(missingRng.code, "RNG_REQUIRED_SKILL_EFFECT");
  assert.equal(missingRng.state, state);
  assert.equal(JSON.stringify({ ...state, phase: "WORK" }), before);
  assert.deepEqual(Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()])), rngBefore);
});

test("the one-turn seal expires only after the target completes a coloring", () => {
  const { state, rng } = fixture();
  const sealed = use(state, rng).state;
  const color = Object.keys(sealed.publicEffects.B.seals).find((candidate) => sealed.publicEffects.B.seals[candidate] === 1);
  sealed.active = "B";
  sealed.phase = "COLOR";
  sealed.regions.R1 = { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: null, isPending: true };
  sealed.pending = "R1";
  const legalColor = engine.COLORS.find((candidate) => candidate !== color && sealed.basicPalettes.B.includes(candidate));
  const colored = match.applyStandardAction({ state: sealed, actor: "B", action: { type: "COLOR_REGION", payload: { color: legalColor } }, expectedVersion: sealed.version, rngStreams: rng });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.publicEffects.B.seals[color], 0);
});
