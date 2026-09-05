"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const cpu = require("../standard/standard-cpu.js");

const root = path.resolve(__dirname, "..");

function streams(seed = 7711) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function createdState(seed = 7711) {
  return match.createStandardMatch({
    matchId: `partial-macro-${seed}`,
    firstSeat: "A",
    loadouts: { A: { experimental: ["legalRecolor"] }, B: { experimental: ["legalRecolor"] } },
  }, streams(seed));
}

function macroMicroCells(macro, state) {
  const width = state.playableBounds.macroWidth;
  const scale = state.playableBounds.microScale;
  const microWidth = width * scale;
  const col = macro % width;
  const row = Math.floor(macro / width);
  const cells = [];
  for (let dy = 0; dy < scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) cells.push((row * scale + dy) * microWidth + col * scale + dx);
  }
  return cells;
}

function partialMacroState(seed = 7711) {
  const state = createdState(seed);
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  const macro13 = macroMicroCells(13, state);
  const macro14 = macroMicroCells(14, state);
  const occupiedHalf = macro14.filter((cell) => cell % state.microWidth < 10);
  state.regions = {
    R1: { id: "R1", micro: [...macro13, ...occupiedHalf], sourceMacros: [13, 14], controllers: ["B"], color: "red", isPending: false },
  };
  match.validateStandardState(state);
  return { state, occupiedHalf, freeHalf: macro14.filter((cell) => !occupiedHalf.includes(cell)) };
}

function applyCreate(state, sourceMacros, seed = 8811) {
  return match.applyStandardAction({
    state,
    actor: state.active,
    expectedVersion: state.version,
    action: { id: "partial-create", type: "CREATE_REGION", payload: { sourceMacros } },
    rngStreams: streams(seed),
  });
}

function loadBundleApi() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "standard-engine.bundle.js"), "utf8"), sandbox);
  return sandbox.FourColorStandardServerEngine;
}

test("ordinary CREATE_REGION claims only the free micro geometry inside a partially occupied macro", () => {
  const { state, occupiedHalf, freeHalf } = partialMacroState();
  const result = applyCreate(state, [14]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.regions.R2.sourceMacros, [14]);
  assert.deepEqual(result.state.regions.R2.micro, freeHalf);
  assert.equal(result.state.regions.R2.micro.some((cell) => occupiedHalf.includes(cell)), false);
  assert.deepEqual([result.state.active, result.state.phase, result.state.version], ["B", "COLOR", 1]);
  assert.equal(result.contactColorCount, 1);
});

test("ordinary CREATE_REGION rejects a fully occupied macro and disconnected free micro geometry", () => {
  const { state } = partialMacroState(7712);
  const full = applyCreate(state, [13]);
  assert.deepEqual([full.ok, full.code, full.state], [false, "REGION_OVERLAP", state]);

  const wrongSize = JSON.parse(JSON.stringify(state));
  wrongSize.requiredSize = wrongSize.rolledSize = wrongSize.baseRequiredSize = 2;
  const wrong = applyCreate(wrongSize, [14]);
  assert.deepEqual([wrong.ok, wrong.code, wrong.state], [false, "WRONG_REGION_SIZE", wrongSize]);

  const split = createdState(7713);
  split.phase = "WORK";
  split.requiredSize = split.rolledSize = split.baseRequiredSize = 1;
  const stripe = macroMicroCells(14, split).filter((cell) => cell % split.microWidth === 9);
  split.regions = { R1: { id: "R1", micro: stripe, sourceMacros: [14], controllers: ["B"], color: "blue", isPending: false } };
  match.validateStandardState(split);
  const disconnected = applyCreate(split, [14]);
  assert.deepEqual([disconnected.ok, disconnected.code, disconnected.state], [false, "REGION_NOT_CONNECTED", split]);
});

test("post-color legal-size search keeps a half-free macro playable instead of declaring BOARD_LOCK", () => {
  const state = createdState(7714);
  state.phase = "COLOR";
  state.active = "A";
  state.pending = "R1";
  state.requiredSize = state.rolledSize = state.baseRequiredSize = 1;
  const playable = [];
  for (let row = state.playableBounds.minRow; row <= state.playableBounds.maxRow; row += 1) {
    for (let col = state.playableBounds.minCol; col <= state.playableBounds.maxCol; col += 1) playable.push(row * state.playableBounds.macroWidth + col);
  }
  const pendingMicro = macroMicroCells(13, state);
  const macro14 = macroMicroCells(14, state);
  const freeHalf = new Set(macro14.filter((cell) => cell % state.microWidth >= 10));
  const coloredMicro = playable.flatMap((macro) => macroMicroCells(macro, state))
    .filter((cell) => !pendingMicro.includes(cell) && !freeHalf.has(cell));
  state.regions = {
    R1: { id: "R1", micro: pendingMicro, sourceMacros: [13], controllers: ["B"], color: null, isPending: true },
    R2: { id: "R2", micro: coloredMicro, sourceMacros: playable.filter((macro) => macro !== 13), controllers: ["B"], color: "red", isPending: false },
  };
  match.validateStandardState(state);
  const color = [...state.basicPalettes.A, state.bonusColors.A].find((candidate) => candidate !== "red");
  const result = match.applyStandardAction({ state, actor: "A", expectedVersion: 0, action: { type: "COLOR_REGION", payload: { color } }, rngStreams: streams(8814) });
  assert.equal(result.ok, true);
  assert.deepEqual([result.state.status, result.state.phase, result.state.requiredSize], ["ACTIVE", "WORK", 1]);
});

test("CPU exposes and chooses an authoritative half-free macro candidate without private opponent state", () => {
  const { state } = partialMacroState(7715);
  const observation = cpu.makeObservation({
    publicState: match.projectStandardPublicState(state),
    ownPrivateState: match.projectStandardPrivateState(state, "A"),
    difficulty: "hard",
  });
  const candidate = cpu.enumerateCpuActions(observation).find((action) => action.type === "CREATE_REGION" && action.payload.sourceMacros.length === 1 && action.payload.sourceMacros[0] === 14);
  assert.ok(candidate);
  assert.equal(applyCreate(state, candidate.payload.sourceMacros, 8815).ok, true);
  assert.equal(Object.hasOwn(observation.ownPrivateState, "B"), false);
  assert.equal(Object.hasOwn(observation.publicState, "basicPalettes"), false);
});

test("partial macro is a valid prepared-skill base and candidate-zero is not an invalid selection", () => {
  const { state, occupiedHalf, freeHalf } = partialMacroState(7717);
  state.hands.A.areaMicroBloom = 1;
  const noBloom = match.applyStandardAction({
    state,
    actor: "A",
    expectedVersion: state.version,
    action: { type: "USE_SKILL", payload: { skill: "areaMicroBloom", sourceMacros: [14] } },
    rngStreams: streams(8817),
  });
  assert.deepEqual([noBloom.ok, noBloom.code], [false, "NO_MICRO_BLOOM_CANDIDATE"]);
  assert.equal(noBloom.state, state);
  assert.equal(noBloom.state.hands.A.areaMicroBloom, 1);

  const cornerState = JSON.parse(JSON.stringify(state));
  cornerState.hands.A.areaCornerBloom = 1;
  const corner = match.applyStandardAction({
    state: cornerState,
    actor: "A",
    expectedVersion: cornerState.version,
    action: { type: "USE_SKILL", payload: { skill: "areaCornerBloom", sourceMacros: [14], macro: 14 } },
    rngStreams: streams(8818),
  });
  assert.equal(corner.ok, true);
  assert.equal(freeHalf.every((cell) => corner.state.preparedOutgoing.micro.includes(cell)), true);
  assert.equal(occupiedHalf.some((cell) => corner.state.preparedOutgoing.micro.includes(cell)), false);

  const created = applyCreate(corner.state, [14], 8819);
  assert.equal(created.ok, true);
  assert.deepEqual(created.state.regions.R2.micro, corner.state.preparedOutgoing.micro);
  assert.equal(created.state.preparedOutgoing, null);
});

test("CPU omits a macro-connected split whose public micro geometry would be rejected", () => {
  const state = createdState(7718);
  state.phase = "COLOR";
  state.active = "A";
  state.requiredSize = state.rolledSize = state.baseRequiredSize = 2;
  state.pending = "R6";
  state.hands.A.colorRegionSplit = 1;
  state.regions = {
    R6: {
      id: "R6",
      micro: [735, 736, 783, 784, 785, 786, 787, 788, 789, 790, 791, 832, 833, 834, 835, 836, 837, 838, 839, 880, 881, 882, 883, 884, 885, 886, 887, 928, 929, 930, 931, 932, 933, 934, 935],
      sourceMacros: [52, 53],
      controllers: ["B"],
      color: null,
      isPending: true,
    },
  };
  match.validateStandardState(state);
  const rejected = match.applyStandardAction({
    state,
    actor: "A",
    expectedVersion: state.version,
    action: { type: "USE_SKILL", payload: { skill: "colorRegionSplit", regionId: "R6", sourceMacros: [52] } },
    rngStreams: streams(8820),
  });
  assert.equal(rejected.code, "SPLIT_GEOMETRY_NOT_CONNECTED");

  const observation = cpu.makeObservation({
    publicState: match.projectStandardPublicState(state),
    ownPrivateState: match.projectStandardPrivateState(state, "A"),
    difficulty: "hard",
  });
  const invalidSplit = cpu.enumerateCpuActions(observation).find((action) => action.type === "USE_SKILL" && action.payload.skill === "colorRegionSplit");
  assert.equal(invalidSplit, undefined);
});

test("generated Edge bundle applies the same half-free macro geometry", () => {
  const api = loadBundleApi();
  const created = api.create({
    matchId: "partial-bundle",
    loadouts: {
      A: { color: ["colorRandomBorrow", "colorChoiceBorrow"], area: ["areaMicroBloom", "areaDiePlus"], disrupt: ["disruptRandomOne", "disruptChoiceOne"] },
      B: { color: ["colorRandomBorrow", "colorChoiceBorrow"], area: ["areaMicroBloom", "areaDiePlus"], disrupt: ["disruptRandomOne", "disruptChoiceOne"] },
    },
    seed: 7716,
    firstSeat: "A",
  });
  const state = created.state;
  state.phase = "WORK";
  state.requiredSize = state.rolledSize = state.baseRequiredSize = 1;
  const macro13 = macroMicroCells(13, state);
  const macro14 = macroMicroCells(14, state);
  const occupiedHalf = macro14.filter((cell) => cell % state.microWidth < 10);
  state.regions = { R1: { id: "R1", micro: [...macro13, ...occupiedHalf], sourceMacros: [13, 14], controllers: ["B"], color: "red", isPending: false } };
  const applied = api.apply({ state, rngSnapshot: created.rngSnapshot, actor: "A", expectedVersion: 0, action: { id: "bundle-partial", type: "CREATE_REGION", payload: { sourceMacros: [14] } } });
  assert.equal(applied.ok, true);
  assert.deepEqual(Array.from(applied.state.regions.R2.micro), macro14.filter((cell) => !occupiedHalf.includes(cell)));
});
