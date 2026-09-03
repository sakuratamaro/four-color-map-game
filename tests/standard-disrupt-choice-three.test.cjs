"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 9001) { return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }
function fixture() {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "choice-three-seal", firstSeat: "A", hands: { A: { disruptChoiceThree: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  match.validateStandardState(state);
  return { state, rng };
}
function use(state, rng, color = "red", actor = "A", expectedVersion = state.version) {
  return match.applyStandardAction({ state, actor, action: { type: "USE_SKILL", payload: { skill: "disruptChoiceThree", color } }, expectedVersion, rngStreams: rng });
}
function prepareColor(state, id, micro) {
  state.active = "B";
  state.phase = "COLOR";
  state.pending = id;
  state.regions[id] = { id, micro: [micro], sourceMacros: [], controllers: ["A"], color: null, isPending: true };
}

test("chosen long seal is public for three colorings, consumes once, and uses no RNG", () => {
  const { state, rng } = fixture();
  const before = rng["skill-effect"].snapshot();
  const result = use(state, rng, "red");
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 0);
  assert.equal(rng["skill-effect"].snapshot(), before);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.disruptChoiceThree, 0);
  assert.equal(result.publicState.publicEffects.B.seals.red, 3);
  assert.equal(result.state.privateEffects.A.curseBacklash, undefined);
});

test("an existing stronger seal remains while the card still resolves", () => {
  const { state, rng } = fixture();
  state.publicEffects.B.seals.blue = 4;
  const result = use(state, rng, "blue");
  assert.equal(result.ok, true);
  assert.equal(result.state.publicEffects.B.seals.blue, 4);
  assert.equal(result.state.hands.A.disruptChoiceThree, 0);
});

test("the long seal decrements after each successful target coloring and expires after the third", () => {
  const { state, rng } = fixture();
  let current = use(state, rng, "red").state;
  const legal = current.basicPalettes.B.find((color) => color !== "red") || current.bonusColors.B;
  for (const [index, micro] of [49, 400, 800].entries()) {
    prepareColor(current, `R${index + 1}`, micro);
    const colored = match.applyStandardAction({ state: current, actor: "B", action: { type: "COLOR_REGION", payload: { color: legal } }, expectedVersion: current.version, rngStreams: rng });
    assert.equal(colored.ok, true);
    current = colored.state;
    assert.equal(current.publicEffects.B.seals.red, 2 - index);
  }
});

test("invalid color, wrong seat, unavailable card, and stale version reject atomically", () => {
  const { state, rng } = fixture();
  const before = JSON.stringify(state);
  assert.equal(use(state, rng, "purple").code, "INVALID_TARGET_SCHEMA");
  assert.equal(use(state, rng, "red", "B").code, "NOT_YOUR_TURN");
  state.hands.A.disruptChoiceThree = 0;
  assert.equal(use(state, rng).code, "SKILL_UNAVAILABLE");
  state.hands.A.disruptChoiceThree = 1;
  assert.equal(use(state, rng, "red", "A", state.version + 1).code, "VERSION_CONFLICT");
  assert.equal(JSON.stringify(state), before);
});
