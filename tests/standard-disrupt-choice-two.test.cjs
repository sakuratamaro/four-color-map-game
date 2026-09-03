"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 8801) { return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }

function fixture() {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "choice-two-seal", firstSeat: "A", hands: { A: { disruptChoiceTwo: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  match.validateStandardState(state);
  return { state, rng };
}

function use(state, rng, color = "red", actor = "A", expectedVersion = state.version) {
  return match.applyStandardAction({
    state,
    actor,
    action: { type: "USE_SKILL", payload: { skill: "disruptChoiceTwo", color } },
    expectedVersion,
    rngStreams: rng,
  });
}

function prepareColor(state, id, micro) {
  state.active = "B";
  state.phase = "COLOR";
  state.pending = id;
  state.regions[id] = { id, micro: [micro], sourceMacros: [], controllers: ["A"], color: null, isPending: true };
}

test("chosen seal is public for two target colorings, consumes once, and uses no RNG", () => {
  const { state, rng } = fixture();
  const before = rng["skill-effect"].snapshot();
  const result = use(state, rng, "red");
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 0);
  assert.equal(rng["skill-effect"].snapshot(), before);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.disruptChoiceTwo, 0);
  assert.equal(result.state.publicEffects.B.seals.red, 2);
  assert.equal(result.publicState.publicEffects.B.seals.red, 2);
  assert.equal(result.state.privateEffects.A.curseBacklash, undefined);
});

test("existing stronger seal duration is preserved while the card still resolves", () => {
  const { state, rng } = fixture();
  state.publicEffects.B.seals.blue = 3;
  const result = use(state, rng, "blue");
  assert.equal(result.ok, true);
  assert.equal(result.state.publicEffects.B.seals.blue, 3);
  assert.equal(result.state.hands.A.disruptChoiceTwo, 0);
});

test("the seal ticks after each successful target coloring and expires after the second", () => {
  const { state, rng } = fixture();
  const sealed = use(state, rng, "red").state;
  const legal = sealed.basicPalettes.B.find((color) => color !== "red") || sealed.bonusColors.B;
  prepareColor(sealed, "R1", 49);
  const first = match.applyStandardAction({ state: sealed, actor: "B", action: { type: "COLOR_REGION", payload: { color: legal } }, expectedVersion: sealed.version, rngStreams: rng });
  assert.equal(first.ok, true);
  assert.equal(first.state.publicEffects.B.seals.red, 1);
  prepareColor(first.state, "R2", 400);
  const second = match.applyStandardAction({ state: first.state, actor: "B", action: { type: "COLOR_REGION", payload: { color: legal } }, expectedVersion: first.state.version, rngStreams: rng });
  assert.equal(second.ok, true);
  assert.equal(second.state.publicEffects.B.seals.red, 0);
});

test("invalid color, wrong seat, unavailable card, and stale version reject atomically", () => {
  const { state, rng } = fixture();
  const before = JSON.stringify(state);
  assert.equal(use(state, rng, "purple").code, "INVALID_TARGET_SCHEMA");
  assert.equal(use(state, rng, "red", "B").code, "NOT_YOUR_TURN");
  state.hands.A.disruptChoiceTwo = 0;
  assert.equal(use(state, rng).code, "SKILL_UNAVAILABLE");
  state.hands.A.disruptChoiceTwo = 1;
  assert.equal(use(state, rng, "red", "A", state.version + 1).code, "VERSION_CONFLICT");
  assert.equal(JSON.stringify(state), before);
});
