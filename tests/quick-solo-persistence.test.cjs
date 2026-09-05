"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const engine = require("../online/quick-engine.js");
const cpu = require("../online/quick-cpu.js");
const saveCodec = require("../solo-v5/save-codec.js");

function action(sequence, state, type, payload = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    expectedVersion: state.version,
    type,
    payload,
  };
}

function paletteRandom() {
  const values = [0.01, 0.2, 0.4, 0.6, 0.8];
  let index = 0;
  return () => values[index++ % values.length];
}

function boundaryWorkState() {
  const rollRandom = () => 0;
  let state = engine.createQuickGame({ paletteRandom: paletteRandom(), rollRandom });
  state = engine.applyAction(state, "A", action(1, state, "CREATE_REGION", { macros: [13] }), { rollRandom }).state;
  state = engine.applyAction(state, "B", action(2, state, "COLOR_REGION", { color: state.palettes.B[0] }), { rollRandom }).state;
  state = engine.applyAction(state, "B", action(3, state, "CREATE_REGION", { macros: [14] }), { rollRandom }).state;
  const secondColor = state.palettes.A.find((color) => color !== state.regions.R1.color);
  assert.ok(secondColor, "fixture requires a rule-safe second color");
  state = engine.applyAction(state, "A", action(4, state, "COLOR_REGION", { color: secondColor }), { rollRandom }).state;
  assert.deepEqual([state.version, state.active, state.phase, state.requiredSize], [4, "A", "WORK", 1]);
  return state;
}

function leftBoundaryShift(state, sequence = 5) {
  return engine.applyAction(state, "A", action(sequence, state, "USE_SKILL", {
    skill: "areaHalfShift",
    macro: 13,
    direction: "left",
  }), { rollRandom: () => 0 }).state;
}

function savedRecord(state, { humanSeat = "B", cpuSeat = "A" } = {}) {
  return {
    schemaVersion: saveCodec.SAVE_SCHEMA_VERSION,
    engineVersion: saveCodec.ENGINE_VERSION,
    policyVersion: cpu.POLICY_VERSIONS.normal,
    savedAt: "2026-09-05T00:00:00.000Z",
    humanSeat,
    cpuSeat,
    difficulty: "normal",
    state,
    rngSnapshot: {
      version: saveCodec.RNG_VERSION,
      streams: saveCodec.STREAM_NAMES.map((name, index) => ({ name, state: index + 1 })),
    },
  };
}

test("CPU A can choose a legal left-boundary Half Shift, persist it, and continue to the human color turn", () => {
  const before = boundaryWorkState();
  const values = [0.9, 0, 0];
  let randomIndex = 0;
  const chosen = cpu.chooseAction({
    publicState: engine.publicState(before),
    ownPrivateState: engine.privateState(before, "A"),
    level: "normal",
    random: () => values[randomIndex++],
    idFactory: () => action(5, before, "USE_SKILL").id,
  });
  assert.deepEqual(chosen.payload, { skill: "areaHalfShift", macro: 13, direction: "left" });

  let shifted = engine.applyAction(before, "A", chosen, { rollRandom: () => 0 }).state;
  assert.ok(Object.values(shifted.regions).some((region) => region.sourceMacros.includes(12)));
  assert.doesNotThrow(() => saveCodec.validateState(shifted, engine));

  const next = cpu.chooseAction({
    publicState: engine.publicState(shifted),
    ownPrivateState: engine.privateState(shifted, "A"),
    level: "normal",
    random: () => 0.9,
    idFactory: () => action(6, shifted, "CREATE_REGION").id,
  });
  assert.equal(next.type, "CREATE_REGION");
  shifted = engine.applyAction(shifted, "A", next, { rollRandom: () => 0 }).state;
  assert.doesNotThrow(() => saveCodec.validateState(shifted, engine));
  assert.deepEqual([shifted.active, shifted.phase], ["B", "COLOR"]);
});

test("the same human Half Shift saves and reloads with the human turn intact", () => {
  const shifted = leftBoundaryShift(boundaryWorkState());
  assert.doesNotThrow(() => saveCodec.validateState(shifted, engine));

  const restored = saveCodec.decode(saveCodec.encode(savedRecord(shifted, { humanSeat: "A", cpuSeat: "B" })), engine, cpu);
  assert.deepEqual(restored.state, shifted);
  assert.deepEqual([restored.humanSeat, restored.cpuSeat, restored.state.active, restored.state.phase], ["A", "B", "A", "WORK"]);

  const continuation = cpu.chooseAction({
    publicState: engine.publicState(restored.state),
    ownPrivateState: engine.privateState(restored.state, restored.humanSeat),
    level: restored.difficulty,
    random: () => 0.9,
    idFactory: () => action(6, restored.state, "CREATE_REGION").id,
  });
  assert.equal(continuation.type, "CREATE_REGION");
  const continued = engine.applyAction(restored.state, restored.humanSeat, continuation, { rollRandom: () => 0 }).state;
  assert.deepEqual([continued.active, continued.phase], ["B", "COLOR"]);
});

test("decode canonicalizes a valid legacy v1 Half Shift save before strict validation", () => {
  const legacy = leftBoundaryShift(boundaryWorkState());
  legacy.regions.R1.sourceMacros = [13];
  legacy.regions.R2.sourceMacros = [14];
  assert.throws(() => saveCodec.validateState(legacy, engine), /invalid region macros/);

  const restored = saveCodec.decode(saveCodec.encode(savedRecord(legacy)), engine, cpu);
  assert.deepEqual(restored.state.regions.R1.sourceMacros, [12, 13]);
  assert.deepEqual(restored.state.regions.R2.sourceMacros, [13, 14]);
  assert.doesNotThrow(() => saveCodec.validateState(restored.state, engine));

  const roundTrip = saveCodec.decode(saveCodec.encode(savedRecord(restored.state)), engine, cpu);
  assert.deepEqual(roundTrip.state, restored.state);
});

test("corrupt saves cannot duplicate or move source macros beyond the world", () => {
  const valid = leftBoundaryShift(boundaryWorkState());
  const regionId = Object.keys(valid.regions).find((id) => valid.regions[id].sourceMacros.includes(12));
  assert.ok(regionId);

  for (const sourceMacros of [[144], [12, 12]]) {
    const corrupt = structuredClone(valid);
    corrupt.regions[regionId].sourceMacros = sourceMacros;
    assert.throws(
      () => saveCodec.decode(saveCodec.encode(savedRecord(corrupt)), engine, cpu),
      /invalid region macros/,
    );
  }

  const invalidGeometry = structuredClone(valid);
  invalidGeometry.regions[regionId].micro[0] = 48 * 48;
  assert.throws(
    () => saveCodec.decode(saveCodec.encode(savedRecord(invalidGeometry)), engine, cpu),
    /invalid region geometry/,
  );
});

test("world-valid source macros cannot disguise disconnected region geometry", () => {
  const corrupt = boundaryWorkState();
  const macroMicro = engine.internals.microForMacro(13);
  corrupt.regions.R1.micro = [macroMicro[0], macroMicro.at(-1)];
  corrupt.regions.R1.sourceMacros = [13];

  assert.throws(() => saveCodec.validateState(corrupt, engine), /invalid region geometry/);
  assert.throws(
    () => saveCodec.decode(saveCodec.encode(savedRecord(corrupt)), engine, cpu),
    /invalid region geometry/,
  );
});

test("new regions remain confined to playable bounds even though shifted geometry may occupy the world edge", () => {
  const state = engine.createQuickGame({ paletteRandom: paletteRandom(), rollRandom: () => 0 });
  assert.throws(
    () => engine.applyAction(state, "A", action(1, state, "CREATE_REGION", { macros: [12] }), { rollRandom: () => 0 }),
    (error) => error.code === "INVALID_SELECTION" && /outside playable bounds/.test(error.message),
  );
});

test("the Solo page cache-busts the corrected save codec", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "solo-v5", "index.html"), "utf8");
  assert.match(html, /save-codec\.js\?v=20260905-2/);
});
