"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 8801) { return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }

function fixture() {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "palette-random", firstSeat: "A", hands: { A: { disruptPaletteRandom: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  match.validateStandardState(state);
  return { state, rng };
}

function use(state, rng, actor = "A") {
  return match.applyStandardAction({ state, actor, action: { type: "USE_SKILL", payload: { skill: "disruptPaletteRandom" } }, expectedVersion: state.version, rngStreams: rng });
}

function palette(state, seat) { return [...state.basicPalettes[seat], state.bonusColors[seat]]; }

test("random palette corruption draws color and private slot exactly once each", () => {
  const { state, rng } = fixture();
  const beforePalette = palette(state, "B");
  const beforeRng = rng["skill-effect"].snapshot();
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 2);
  assert.equal(rng["skill-effect"].snapshot(), (beforeRng + 2 * 0x6d2b79f5) >>> 0);
  assert.equal(result.state.hands.A.disruptPaletteRandom, 0);
  assert.equal(result.state.version, state.version + 1);
  const effect = result.state.privateEffects.B.paletteDebuffs[0];
  assert.equal(effect.remaining, 1);
  assert.equal(effect.previousColor, beforePalette[effect.slot]);
  assert.equal(effect.injectedColor, result.color);
  assert.equal(palette(result.state, "B")[effect.slot], result.color);
  assert.equal(JSON.stringify(result.publicState).includes("paletteDebuffs"), false);
  assert.equal(JSON.stringify(result.publicState).includes(effect.previousColor), false);
  assert.equal(JSON.stringify(result.privateState).includes("paletteDebuffs"), false);
  assert.deepEqual(match.projectStandardPrivateState(result.state, "B").privateEffects.paletteDebuffs, [effect]);
  assert.equal(result.state.publicLog.at(-1).includes(result.color), true);
});

test("corrupted palette is authoritative for one coloring and then restores exactly", () => {
  const { state, rng } = fixture();
  const result = use(state, rng);
  const corrupted = result.state;
  const effect = corrupted.privateEffects.B.paletteDebuffs[0];
  const usesBefore = corrupted.bonusUsesRemaining.B;
  corrupted.active = "B";
  corrupted.phase = "COLOR";
  corrupted.regions.R1 = { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: null, isPending: true };
  corrupted.pending = "R1";
  const colored = match.applyStandardAction({ state: corrupted, actor: "B", action: { type: "COLOR_REGION", payload: { color: effect.injectedColor } }, expectedVersion: corrupted.version, rngStreams: rng });
  assert.equal(colored.ok, true);
  assert.equal(palette(colored.state, "B")[effect.slot], effect.previousColor);
  assert.equal(colored.state.privateEffects.B.paletteDebuffs, undefined);
  assert.equal(colored.state.bonusUsesRemaining.B, usesBefore - (effect.slot === 2 && !colored.state.basicPalettes.B.includes(effect.injectedColor) ? 1 : 0));
});

test("a permanent palette change on the corrupted slot cancels restoration", () => {
  const { state, rng } = fixture();
  const corrupted = use(state, rng).state;
  const effect = corrupted.privateEffects.B.paletteDebuffs[0];
  corrupted.active = "B";
  corrupted.phase = "COLOR";
  corrupted.hands.B.colorPaletteChange = 1;
  const replacement = engine.COLORS.find((color) => color !== effect.injectedColor);
  const changed = match.applyStandardAction({ state: corrupted, actor: "B", action: { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: effect.slot, color: replacement } }, expectedVersion: corrupted.version, rngStreams: rng });
  assert.equal(changed.ok, true);
  assert.equal(palette(changed.state, "B")[effect.slot], replacement);
  assert.equal(changed.state.privateEffects.B.paletteDebuffs, undefined);
});

test("wrong phase, seat, unavailable card, stale version, and missing RNG reject atomically", () => {
  const { state, rng } = fixture();
  const beforeRng = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
  state.phase = "COLOR";
  assert.equal(use(state, rng).code, "WRONG_PHASE");
  state.phase = "WORK";
  assert.equal(use(state, rng, "B").code, "NOT_YOUR_TURN");
  state.hands.A.disruptPaletteRandom = 0;
  assert.equal(use(state, rng).code, "SKILL_UNAVAILABLE");
  state.hands.A.disruptPaletteRandom = 1;
  const stale = match.applyStandardAction({ state, actor: "A", action: { type: "USE_SKILL", payload: { skill: "disruptPaletteRandom" } }, expectedVersion: state.version + 1, rngStreams: rng });
  assert.equal(stale.code, "VERSION_CONFLICT");
  assert.equal(use(state, {}).code, "RNG_REQUIRED_SKILL_EFFECT");
  assert.deepEqual(Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()])), beforeRng);
});

test("malformed or palette-inconsistent private debuffs fail closed", () => {
  const { state, rng } = fixture();
  const corrupted = use(state, rng).state;
  for (const mutate of [
    (copy) => { copy.privateEffects.B.paletteDebuffs[0].slot = 3; },
    (copy) => { copy.privateEffects.B.paletteDebuffs[0].remaining = 0; },
    (copy) => { copy.privateEffects.B.paletteDebuffs[0].previousColor = "purple"; },
    (copy) => { copy.privateEffects.B.paletteDebuffs[0].injectedColor = engine.COLORS.find((color) => color !== palette(copy, "B")[copy.privateEffects.B.paletteDebuffs[0].slot]); },
    (copy) => { copy.privateEffects.B.paletteDebuffs.push({ ...copy.privateEffects.B.paletteDebuffs[0] }); },
  ]) {
    const copy = JSON.parse(JSON.stringify(corrupted));
    mutate(copy);
    assert.throws(() => match.validateStandardState(copy), (error) => error.code === "INVALID_PALETTE_DEBUFFS");
  }
});
