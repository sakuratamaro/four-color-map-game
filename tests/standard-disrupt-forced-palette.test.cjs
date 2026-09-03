"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 9101) { return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }
function palette(state, seat) { return [...state.basicPalettes[seat], state.bonusColors[seat]]; }
function fixture() {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "forced-palette", firstSeat: "A", hands: { A: { disruptForcedPalette: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  match.validateStandardState(state);
  return { state, rng };
}
function use(state, rng, color = "red", actor = "A", expectedVersion = state.version) {
  return match.applyStandardAction({ state, actor, action: { type: "USE_SKILL", payload: { skill: "disruptForcedPalette", color } }, expectedVersion, rngStreams: rng });
}

test("forced palette draws one private slot, publishes only the chosen color, and changes it permanently", () => {
  const { state, rng } = fixture();
  const beforePalette = palette(state, "B");
  const beforeRng = rng["skill-effect"].snapshot();
  const color = engine.COLORS.find((candidate) => beforePalette.some((current) => current !== candidate));
  const result = use(state, rng, color);
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 1);
  assert.equal(rng["skill-effect"].snapshot(), (beforeRng + 0x6d2b79f5) >>> 0);
  assert.equal(result.state.hands.A.disruptForcedPalette, 0);
  const afterPalette = palette(result.state, "B");
  const changed = afterPalette.map((value, slot) => value !== beforePalette[slot] ? slot : -1).filter((slot) => slot >= 0);
  assert.equal(changed.length, 1);
  assert.equal(afterPalette[changed[0]], color);
  assert.equal(result.state.privateEffects.B.paletteDebuffs, undefined);
  assert.equal(JSON.stringify(result.publicState).includes("basicPalettes"), false);
  assert.deepEqual([...result.privateState.basicPalette, result.privateState.bonusColor], palette(result.state, "A"));
  const targetPrivate = match.projectStandardPrivateState(result.state, "B");
  assert.deepEqual([...targetPrivate.basicPalette, targetPrivate.bonusColor], afterPalette);
});

test("forced replacement restores and clears an existing temporary effect before permanent injection", () => {
  const { state, rng } = fixture();
  state.basicPalettes.B = ["red", "red"];
  state.bonusColors.B = "blue";
  state.privateEffects.B.paletteDebuffs = [{ slot: 2, previousColor: "green", injectedColor: "blue", remaining: 2 }];
  match.validateStandardState(state);
  const result = use(state, rng, "red");
  assert.equal(result.ok, true);
  assert.deepEqual(palette(result.state, "B"), ["red", "red", "red"]);
  assert.equal(result.state.privateEffects.B.paletteDebuffs, undefined);
});

test("an all-same legal empty replacement still consumes exactly one draw and one card", () => {
  const { state, rng } = fixture();
  state.basicPalettes.B = ["red", "red"];
  state.bonusColors.B = "red";
  const result = use(state, rng, "red");
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 1);
  assert.equal(result.state.hands.A.disruptForcedPalette, 0);
  assert.deepEqual(palette(result.state, "B"), ["red", "red", "red"]);
});

test("invalid color rejects before RNG while missing RNG and stale requests remain atomic", () => {
  const { state, rng } = fixture();
  const beforeState = JSON.stringify(state);
  const beforeRng = rng["skill-effect"].snapshot();
  assert.equal(use(state, rng, "purple").code, "INVALID_TARGET_SCHEMA");
  assert.equal(rng["skill-effect"].snapshot(), beforeRng);
  assert.equal(use(state, {}, "red").code, "RNG_REQUIRED_SKILL_EFFECT");
  assert.equal(use(state, rng, "red", "A", state.version + 1).code, "VERSION_CONFLICT");
  assert.equal(JSON.stringify(state), beforeState);
});
