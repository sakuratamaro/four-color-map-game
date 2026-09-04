"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 7001) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function microForMacro(macro) {
  const row = Math.floor(macro / 12);
  const col = macro % 12;
  const cells = [];
  for (let dy = 0; dy < 4; dy += 1) {
    for (let dx = 0; dx < 4; dx += 1) cells.push((row * 4 + dy) * 48 + col * 4 + dx);
  }
  return cells;
}

function fixture(macros = [13, 14, 15]) {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "split-fixture", firstSeat: "A", hands: { A: { colorRegionSplit: 1 }, B: {} } }, rng);
  state.phase = "COLOR";
  state.active = "A";
  state.requiredSize = macros.length;
  state.rolledSize = macros.length;
  state.baseRequiredSize = macros.length;
  state.regions = {
    R1: {
      id: "R1",
      micro: macros.flatMap(microForMacro),
      sourceMacros: [...macros],
      controllers: ["B"],
      color: null,
      isPending: true,
    },
  };
  state.pending = "R1";
  state.reserved = null;
  match.validateStandardState(state);
  return { state, rng };
}

function split(state, sourceMacros, rngStreams = streams(7002), regionId = "R1") {
  return match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "colorRegionSplit", regionId, sourceMacros } },
    expectedVersion: state.version,
    rngStreams,
  });
}

test("region split replaces the received pending region with deterministic connected halves", () => {
  const { state, rng } = fixture();
  const rngBefore = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
  const result = split(state, [13], rng);
  assert.equal(result.ok, true);
  assert.equal(result.status, "RESOLVED");
  assert.deepEqual([result.selectedId, result.returnedId], ["R2", "R3"]);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.colorRegionSplit, 0);
  assert.equal(result.state.skillsUsed.A, state.skillsUsed.A + 1);
  assert.equal(result.state.pending, "R2");
  assert.equal(result.state.reserved, "R3");
  assert.equal(result.state.regions.R1, undefined);
  assert.deepEqual(result.state.regions.R2.sourceMacros, [13]);
  assert.deepEqual(result.state.regions.R3.sourceMacros, [14, 15]);
  assert.deepEqual(result.state.regions.R2.controllers, []);
  assert.deepEqual(result.state.regions.R3.controllers, []);
  assert.equal(result.state.regions.R2.isPending, true);
  assert.equal(result.state.regions.R3.isReserved, true);
  assert.deepEqual(Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()])), rngBefore);
  assert.equal(result.publicState.reserved, "R3");
  assert.equal(JSON.stringify(result.privateState).includes("reserved"), false);
});

test("invalid, forged, empty, whole, duplicate, disconnected, and own-region splits are atomic", () => {
  const cases = [
    { selection: [], code: "SPLIT_SIDE_EMPTY" },
    { selection: [13, 14, 15], code: "SPLIT_SIDE_EMPTY" },
    { selection: [13, 13], code: "INVALID_SPLIT_SELECTION" },
    { selection: [13, 99], code: "INVALID_SPLIT_SELECTION" },
    { selection: [14], code: "SPLIT_SIDE_NOT_CONNECTED" },
  ];
  for (const entry of cases) {
    const { state, rng } = fixture();
    const before = JSON.stringify(state);
    const rngBefore = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
    const result = split(state, entry.selection, rng);
    assert.equal(result.ok, false);
    assert.equal(result.code, entry.code);
    assert.equal(result.state, state);
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()])), rngBefore);
  }
  {
    const { state } = fixture();
    assert.equal(split(state, [13], streams(), "R404").code, "INVALID_SPLIT_TARGET");
  }
  {
    const { state } = fixture();
    state.regions.R1.controllers = ["A"];
    assert.equal(split(state, [13]).code, "SPLIT_REQUIRES_OPPONENT_REGION");
  }
});

test("coloring the selected half returns the reserved half before die or board-lock processing", () => {
  const { state, rng } = fixture();
  state.privateEffects.B.curseBacklash = 1;
  const divided = split(state, [13], rng);
  const beforeDie = rng.die.snapshot();
  const beforeEffect = rng["skill-effect"].snapshot();
  const firstColor = divided.state.basicPalettes.A[0];
  const first = match.applyStandardAction({
    state: divided.state,
    actor: "A",
    action: { type: "COLOR_REGION", payload: { color: firstColor } },
    expectedVersion: divided.state.version,
    rngStreams: rng,
  });
  assert.equal(first.ok, true);
  assert.equal(first.state.status, "ACTIVE");
  assert.deepEqual([first.state.active, first.state.phase, first.state.turn], ["B", "COLOR", divided.state.turn + 1]);
  assert.equal(first.state.pending, "R3");
  assert.equal(first.state.reserved, null);
  assert.equal(first.state.regions.R2.color, firstColor);
  assert.equal(first.state.regions.R2.isPending, false);
  assert.equal(first.state.regions.R3.isPending, true);
  assert.equal(first.state.regions.R3.isReserved, false);
  assert.equal(rng.die.snapshot(), beforeDie, "the die must not roll between split halves");
  assert.equal(rng["skill-effect"].snapshot(), (beforeEffect + 0x6d2b79f5) >>> 0, "returned COLOR resolves the receiving seat's curse");

  const secondColor = [...new Set(first.state.basicPalettes.B)].find((color) => color !== firstColor)
    || first.state.basicPalettes.B[0];
  const second = match.applyStandardAction({
    state: first.state,
    actor: "B",
    action: { type: "COLOR_REGION", payload: { color: secondColor } },
    expectedVersion: first.state.version,
    rngStreams: rng,
  });
  assert.equal(second.ok, true);
  assert.equal(second.state.pending, null);
  assert.equal(second.state.reserved, null);
  assert.equal(second.state.active, "B");
  assert.equal(second.state.phase, "WORK");
  assert.notEqual(rng.die.snapshot(), beforeDie, "normal work setup starts only after the returned half is colored");
});

test("split terminal paths remain authoritative and do not revive or prematurely return UI state", () => {
  const { state, rng } = fixture();
  const divided = split(state, [13], rng).state;
  const selectedColor = divided.basicPalettes.A[0];
  divided.regions.R4 = {
    id: "R4",
    micro: microForMacro(1),
    sourceMacros: [1],
    controllers: ["B"],
    color: selectedColor,
    isPending: false,
  };
  const illegal = match.applyStandardAction({
    state: divided,
    actor: "A",
    action: { type: "COLOR_REGION", payload: { color: selectedColor } },
    expectedVersion: divided.version,
    rngStreams: rng,
  });
  assert.equal(illegal.code, "ILLEGAL_COLOR");
  assert.deepEqual([illegal.state.status, illegal.state.phase, illegal.state.winner], ["FINISHED", "GAME_OVER", "B"]);
  assert.equal(illegal.state.pending, "R2");
  assert.equal(illegal.state.reserved, "R3");
  assert.equal(illegal.state.regions.R2.color, null);

  const surrenderedSource = fixture();
  const surrenderedSplit = split(surrenderedSource.state, [13], surrenderedSource.rng).state;
  const surrendered = match.applyStandardAction({
    state: surrenderedSplit,
    actor: "A",
    action: { type: "SURRENDER" },
    expectedVersion: surrenderedSplit.version,
  });
  assert.equal(surrendered.ok, true);
  assert.equal(surrendered.state.terminalReason, "SURRENDER");
  assert.equal(surrendered.state.reserved, "R3");
});

test("returning a split half automatically resolves blocked and sealed receiving seats", () => {
  const blockedSource = fixture();
  const blocked = split(blockedSource.state, [13], blockedSource.rng).state;
  const usable = [...blocked.basicPalettes.B, blocked.bonusColors.B];
  for (const [index, macro] of [2, 3, 26].entries()) {
    const id = `R${index + 4}`;
    blocked.regions[id] = { id, micro: microForMacro(macro), sourceMacros: [macro], controllers: ["A"], color: usable[index], isPending: false };
  }
  const blockedDie = blockedSource.rng.die.snapshot();
  const blockedResult = match.applyStandardAction({
    state: blocked,
    actor: "A",
    action: { type: "COLOR_REGION", payload: { color: blocked.basicPalettes.A[0] } },
    expectedVersion: blocked.version,
    rngStreams: blockedSource.rng,
  });
  assert.equal(blockedResult.ok, true);
  assert.deepEqual([blockedResult.state.status, blockedResult.state.phase, blockedResult.state.winner, blockedResult.state.terminalReason], ["FINISHED", "GAME_OVER", "A", "NO_LEGAL_COLOR"]);
  assert.equal(blockedResult.state.version, blocked.version + 1);
  assert.equal(blockedResult.state.pending, "R3");
  assert.equal(blockedResult.state.reserved, null);
  assert.equal(blockedSource.rng.die.snapshot(), blockedDie, "automatic split terminal does not roll the next die");

  const sealedSource = fixture();
  const sealed = split(sealedSource.state, [13], sealedSource.rng).state;
  sealed.publicEffects.B.seals = Object.fromEntries(engine.COLORS.map((color) => [color, 1]));
  const sealedResult = match.applyStandardAction({
    state: sealed,
    actor: "A",
    action: { type: "COLOR_REGION", payload: { color: sealed.basicPalettes.A[0] } },
    expectedVersion: sealed.version,
    rngStreams: sealedSource.rng,
  });
  assert.equal(sealedResult.ok, true);
  assert.deepEqual([sealedResult.state.status, sealedResult.state.phase, sealedResult.state.winner, sealedResult.state.terminalReason], ["FINISHED", "GAME_OVER", "A", "SEALED_OUT"]);
  assert.equal(sealedResult.state.version, sealed.version + 1);
  assert.equal(sealedResult.state.pending, "R3");
  assert.equal(sealedResult.state.reserved, null);
});

test("split halves preserve SEALED_OUT and NO_LEGAL_COLOR declaration semantics", () => {
  const noColorSource = fixture();
  const noColor = split(noColorSource.state, [13], noColorSource.rng).state;
  const onlyColor = noColor.basicPalettes.A[0];
  noColor.publicEffects.A.seals = Object.fromEntries(engine.COLORS.filter((color) => color !== onlyColor).map((color) => [color, 1]));
  noColor.regions.R4 = {
    id: "R4",
    micro: microForMacro(1),
    sourceMacros: [1],
    controllers: ["B"],
    color: onlyColor,
    isPending: false,
  };
  const declared = match.applyStandardAction({
    state: noColor,
    actor: "A",
    action: { type: "DECLARE_NO_COLOR" },
    expectedVersion: noColor.version,
  });
  assert.equal(declared.ok, true);
  assert.equal(declared.state.terminalReason, "NO_LEGAL_COLOR");
  assert.equal(declared.state.reserved, "R3");

  const sealedSource = fixture();
  const sealedSplit = split(sealedSource.state, [13], sealedSource.rng).state;
  const firstColor = sealedSplit.basicPalettes.A[0];
  const returned = match.applyStandardAction({
    state: sealedSplit,
    actor: "A",
    action: { type: "COLOR_REGION", payload: { color: firstColor } },
    expectedVersion: sealedSplit.version,
    rngStreams: sealedSource.rng,
  }).state;
  returned.publicEffects.B.seals = Object.fromEntries(engine.COLORS.map((color) => [color, 1]));
  const sealedOut = match.applyStandardAction({
    state: returned,
    actor: "B",
    action: { type: "DECLARE_NO_COLOR" },
    expectedVersion: returned.version,
  });
  assert.equal(sealedOut.ok, true);
  assert.equal(sealedOut.state.terminalReason, "SEALED_OUT");
  assert.equal(sealedOut.state.pending, "R3");
  assert.equal(sealedOut.state.reserved, null);
});

test("reserved-state validation and save round trip reject orphaned or contradictory halves", () => {
  const { state, rng } = fixture();
  const divided = split(state, [13], rng).state;
  const encoded = match.encodeStandardMatch(divided, Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()])));
  assert.deepEqual(match.decodeStandardMatch(encoded).state, divided);

  for (const mutate of [
    (draft) => { draft.reserved = null; },
    (draft) => { draft.reserved = "R404"; },
    (draft) => { draft.regions.R3.isPending = true; },
    (draft) => { draft.regions.R3.color = "red"; },
  ]) {
    const draft = JSON.parse(JSON.stringify(divided));
    mutate(draft);
    assert.throws(() => match.validateStandardState(draft), (error) => error.code === "INVALID_RESERVED_STATE" || error.code === "INVALID_PENDING_STATE");
  }
});
