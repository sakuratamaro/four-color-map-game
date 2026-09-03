"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 8901) { return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }
function palette(state, seat) { return [...state.basicPalettes[seat], state.bonusColors[seat]]; }

function fixture() {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "palette-choice", firstSeat: "A", hands: { A: { disruptPaletteChoice: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  match.validateStandardState(state);
  return { state, rng };
}

function use(state, rng, color = "red", actor = "A", expectedVersion = state.version) {
  return match.applyStandardAction({ state, actor, action: { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color } }, expectedVersion, rngStreams: rng });
}

function prepareColor(state, id, micro) {
  state.active = "B";
  state.phase = "COLOR";
  state.pending = id;
  state.regions[id] = { id, micro: [micro], sourceMacros: [], controllers: ["A"], color: null, isPending: true };
}

test("chosen palette corruption draws one private slot and exposes only the chosen color publicly", () => {
  const { state, rng } = fixture();
  const before = rng["skill-effect"].snapshot();
  const result = use(state, rng, "yellow");
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 1);
  assert.equal(rng["skill-effect"].snapshot(), (before + 0x6d2b79f5) >>> 0);
  assert.equal(result.state.hands.A.disruptPaletteChoice, 0);
  const effect = result.state.privateEffects.B.paletteDebuffs[0];
  assert.equal(effect.injectedColor, "yellow");
  assert.equal(effect.remaining, 2);
  assert.equal(palette(result.state, "B")[effect.slot], "yellow");
  assert.equal(JSON.stringify(result.publicState).includes("paletteDebuffs"), false);
  assert.equal(JSON.stringify(result.privateState).includes("paletteDebuffs"), false);
  assert.deepEqual(match.projectStandardPrivateState(result.state, "B").privateEffects.paletteDebuffs, [effect]);
});

test("the authoritative injected slot persists for one coloring and restores after the second", () => {
  const { state, rng } = fixture();
  const corrupted = use(state, rng, "yellow").state;
  const effect = corrupted.privateEffects.B.paletteDebuffs[0];
  const playable = palette(corrupted, "B").find((color) => color !== corrupted.publicEffects.B.seals[color]);
  prepareColor(corrupted, "R1", 49);
  const first = match.applyStandardAction({ state: corrupted, actor: "B", action: { type: "COLOR_REGION", payload: { color: playable } }, expectedVersion: corrupted.version, rngStreams: rng });
  assert.equal(first.ok, true);
  assert.equal(first.state.privateEffects.B.paletteDebuffs[0].remaining, 1);
  assert.equal(palette(first.state, "B")[effect.slot], "yellow");
  prepareColor(first.state, "R2", 400);
  const second = match.applyStandardAction({ state: first.state, actor: "B", action: { type: "COLOR_REGION", payload: { color: playable } }, expectedVersion: first.state.version, rngStreams: rng });
  assert.equal(second.ok, true);
  assert.equal(second.state.privateEffects.B.paletteDebuffs, undefined);
  assert.equal(palette(second.state, "B")[effect.slot], effect.previousColor);
});

test("a permanent palette change on the corrupted slot cancels later restoration", () => {
  const { state, rng } = fixture();
  const corrupted = use(state, rng, "yellow").state;
  const effect = corrupted.privateEffects.B.paletteDebuffs[0];
  corrupted.active = "B";
  corrupted.phase = "COLOR";
  corrupted.hands.B.colorPaletteChange = 1;
  corrupted.pending = "R1";
  corrupted.regions.R1 = { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: null, isPending: true };
  const replacement = engine.COLORS.find((color) => color !== "yellow");
  const changed = match.applyStandardAction({ state: corrupted, actor: "B", action: { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: effect.slot, color: replacement } }, expectedVersion: corrupted.version, rngStreams: rng });
  assert.equal(changed.ok, true);
  assert.equal(changed.state.privateEffects.B.paletteDebuffs, undefined);
  assert.equal(palette(changed.state, "B")[effect.slot], replacement);
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
