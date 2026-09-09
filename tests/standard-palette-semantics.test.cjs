"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 9350) { return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }

function newColor(current) {
  return engine.COLORS[(engine.COLORS.indexOf(current) + 1) % engine.COLORS.length];
}

test("new matches preserve three distinct initial colors separately from later duplicate slots", () => {
  const state = match.createStandardMatch({ matchId: "palette-semantics", firstSeat: "A", hands: { A: { colorPaletteChange: 1 }, B: {} } }, streams());
  const initial = JSON.parse(JSON.stringify(state.initialPalettes.A));
  assert.equal(new Set([...initial.basic, initial.bonus]).size, 3);
  state.phase = "COLOR";
  state.regions.R1 = { id: "R1", micro: [49], sourceMacros: [], controllers: ["B"], color: null, isPending: true };
  state.pending = "R1";
  const duplicate = state.basicPalettes.A[1];
  const changed = match.applyStandardAction({ state, actor: "A", expectedVersion: state.version,
    action: { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: 0, color: duplicate } }, rngStreams: streams(9351) });
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.state.basicPalettes.A, [duplicate, duplicate]);
  assert.deepEqual(changed.state.initialPalettes.A, initial);
  const own = match.projectStandardPrivateState(changed.state, "A");
  assert.deepEqual(own.initialBasicPalette, initial.basic);
  assert.equal(own.initialBonusColor, initial.bonus);
  assert.deepEqual(own.basicPalette, [duplicate, duplicate]);
  assert.equal(JSON.stringify(changed.publicState).includes("initialPalettes"), false);
  assert.equal(JSON.stringify(match.projectStandardPrivateState(changed.state, "B")).includes(JSON.stringify(initial)), false);
});

test("private palette history remains ordered, bounded, reload-safe, and authoritative", () => {
  let state = match.createStandardMatch({ matchId: "palette-history", firstSeat: "A", hands: { A: { colorPaletteChange: 1 }, B: {} } }, streams(9360));
  state.phase = "COLOR";
  state.regions.R1 = { id: "R1", micro: [49], sourceMacros: [], controllers: ["B"], color: null, isPending: true };
  state.pending = "R1";
  for (let step = 0; step < 13; step += 1) {
    state.hands.A.colorPaletteChange = 1;
    state.skillCategoryWindow = { actor: "A", categories: [] };
    const before = state.basicPalettes.A[0];
    const color = newColor(before);
    const result = match.applyStandardAction({ state, actor: "A", expectedVersion: state.version,
      action: { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: 0, color } }, rngStreams: streams(9361 + step) });
    assert.equal(result.ok, true);
    state = result.state;
  }
  const history = state.privateEffects.A.paletteImpactHistory;
  assert.equal(history.length, 12);
  assert.deepEqual(history.map((event) => event.version), Array.from({ length: 12 }, (_, index) => index + 2));
  assert.ok(history.every((event) => event.actor === "A" && event.skill === "colorPaletteChange" && event.kind === "self"));
  assert.deepEqual(state.privateEffects.A.paletteImpactEvent, history.at(-1));
  assert.equal(JSON.stringify(match.projectStandardPublicState(state)).includes("paletteImpact"), false);
  assert.equal(JSON.stringify(match.projectStandardPrivateState(state, "B")).includes("paletteImpact"), false);
  const restored = match.decodeStandardMatch(match.encodeStandardMatch(state, engine.snapshotRngDomains(streams(9399), match.REQUIRED_RNG_STREAMS)));
  assert.deepEqual(restored.state.privateEffects.A.paletteImpactHistory, history);
  for (const mutate of [
    (copy) => { copy.privateEffects.A.paletteImpactHistory.at(-1).actor = "B"; },
    (copy) => { copy.privateEffects.A.paletteImpactHistory.at(-1).skill = "disruptForcedPalette"; },
    (copy) => { copy.privateEffects.A.paletteImpactHistory[1].version = copy.privateEffects.A.paletteImpactHistory[0].version; },
    (copy) => { copy.privateEffects.A.paletteImpactHistory.push({ ...copy.privateEffects.A.paletteImpactHistory.at(-1), version: copy.version, eventId: `${copy.matchId}:${copy.version}:palette-impact:A` }); },
    (copy) => { copy.privateEffects.A.paletteImpactEvent.injectedColor = copy.privateEffects.A.paletteImpactEvent.previousColor; },
  ]) {
    const copy = JSON.parse(JSON.stringify(state));
    mutate(copy);
    assert.throws(() => match.validateStandardState(copy), (error) => ["INVALID_PALETTE_IMPACT_EVENT", "INVALID_PALETTE_IMPACT_HISTORY"].includes(error.code));
  }
});

test("legacy active matches without initial snapshots or history remain valid", () => {
  const state = match.createStandardMatch({ matchId: "palette-legacy", firstSeat: "A" }, streams(9370));
  delete state.initialPalettes;
  state.version = 1;
  state.privateEffects.B.paletteImpactEvent = {
    eventId: "palette-legacy:1:palette-impact:B", version: 1, kind: "forced", slot: 0,
    previousColor: "red", injectedColor: "blue", remaining: 0,
  };
  assert.equal(match.validateStandardState(state), true);
  const own = match.projectStandardPrivateState(state, "B");
  assert.equal(own.initialBasicPalette, null);
  assert.equal(own.initialBonusColor, null);
});
