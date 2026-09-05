"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { COLORS, createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 1) {
  return createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function create(seed = 1) {
  return match.createStandardMatch({
    matchId: `match-${seed}`,
    firstSeat: "A",
    loadouts: { A: { experimental: ["legalRecolor"] }, B: { experimental: ["legalRecolor"] } },
  }, streams(seed));
}

test("standard match creation is deterministic and validates the authoritative contract", () => {
  const left = create(42);
  const right = create(42);
  assert.deepEqual(left, right);
  assert.equal(match.validateStandardState(left), true);
  assert.equal(left.phase, "CREATE_FIRST");
  assert.equal(left.hands.A.legalRecolor, 1);
  for (const seat of ["A", "B"]) {
    assert.equal(left.basicPalettes[seat].length, 2);
    assert.equal(new Set([...left.basicPalettes[seat], left.bonusColors[seat]]).size, 3);
    assert.ok([1, 2, 3, 4].includes(left.bonusUsesRemaining[seat]));
  }
  assert.notEqual(
    [...left.basicPalettes.A, left.bonusColors.A].sort().join("|"),
    [...left.basicPalettes.B, left.bonusColors.B].sort().join("|"),
  );
});

test("public and private projections enforce the secret boundary", () => {
  const state = create(43);
  state.privateEffects.B.secretToken = "OPPONENT-ONLY-TOKEN";
  const publicState = match.projectStandardPublicState(state);
  const own = match.projectStandardPrivateState(state, "A");
  for (const key of ["basicPalettes", "bonusColors", "bonusUsesRemaining", "hands", "loadouts", "privateEffects"]) assert.equal(Object.hasOwn(publicState, key), false);
  assert.equal(Object.hasOwn(own, "seat"), true);
  assert.equal(Object.hasOwn(own, "B"), false);
  assert.equal(JSON.stringify(publicState).includes("OPPONENT-ONLY-TOKEN"), false);
  assert.equal(JSON.stringify(own).includes("OPPONENT-ONLY-TOKEN"), false);
});

test("rejected actions preserve state identity and bytes", () => {
  const state = create(44);
  const before = JSON.stringify(state);
  for (const input of [
    { actor: "A", action: { type: "SURRENDER" }, expectedVersion: 99 },
    { actor: "B", action: { type: "CREATE_REGION", payload: { sourceMacros: [13] } }, expectedVersion: 0 },
    { actor: "A", action: { type: "UNKNOWN" }, expectedVersion: 0 },
  ]) {
    const result = match.applyStandardAction({ state, rngStreams: streams(99), ...input });
    assert.equal(result.ok, false);
    assert.equal(result.state, state);
    assert.equal(JSON.stringify(state), before);
  }
});

test("create and color use intent actions and increment version once each", () => {
  const initial = create(45);
  const sourceMacros = Array.from({ length: initial.requiredSize }, (_, index) => 13 + index);
  const created = match.applyStandardAction({ state: initial, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros } }, expectedVersion: 0 });
  assert.equal(created.ok, true);
  assert.equal(created.state.version, 1);
  assert.equal(created.state.phase, "COLOR");
  assert.equal(created.state.active, "B");
  assert.equal(created.state.turn, 2);
  assert.equal(created.state.regions.R1.micro.length, initial.requiredSize * 16);
  assert.equal(created.contactColorCount, 0);
  const color = created.state.basicPalettes.B[0];
  const rng = streams(145);
  const dieBefore = rng.die.snapshot();
  const colored = match.applyStandardAction({ state: created.state, actor: "B", action: { type: "COLOR_REGION", payload: { color } }, expectedVersion: 1, rngStreams: rng });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.version, 2);
  assert.equal(colored.state.phase, "WORK");
  assert.equal(colored.state.active, "B");
  assert.equal(colored.state.requiredSize, colored.state.rolledSize);
  assert.equal(colored.state.baseRequiredSize, colored.state.rolledSize);
  assert.notEqual(rng.die.snapshot(), dieBefore);
});

test("later regions must touch the existing map by an edge", () => {
  const state = create(451);
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: { id: "R1", micro: Array.from({ length: 16 }, (_, index) => 196 + Math.floor(index / 4) * 48 + (index % 4)), sourceMacros: [13], controllers: ["A"], color: "red", isPending: false },
  };
  const disconnected = match.applyStandardAction({ state, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [100] } }, expectedVersion: 0 });
  assert.equal(disconnected.ok, false);
  assert.equal(disconnected.code, "REGION_NOT_ADJACENT");
  const adjacent = match.applyStandardAction({ state, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
  assert.equal(adjacent.ok, true);
  assert.equal(adjacent.contactColorCount, 1);
});

test("accepted region creation reports distinct public contact colors only after the action", () => {
  const state = create(4511);
  const microFor = (macro) => {
    const col = macro % 12;
    const row = Math.floor(macro / 12);
    const cells = [];
    for (let y = row * 4; y < row * 4 + 4; y += 1) for (let x = col * 4; x < col * 4 + 4; x += 1) cells.push(y * 48 + x);
    return cells;
  };
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: { id: "R1", micro: microFor(13), sourceMacros: [13], controllers: ["A"], color: "red", isPending: false },
    R2: { id: "R2", micro: microFor(15), sourceMacros: [15], controllers: ["B"], color: "blue", isPending: false },
  };
  const result = match.applyStandardAction({ state, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.contactColorCount, 2);
  assert.equal(Object.hasOwn(result.state, "contactColorCount"), false);
});

test("contact pressure tiers zero through four use fixed edge-contact oracles", () => {
  const microFor = (macro) => {
    const col = macro % 12;
    const row = Math.floor(macro / 12);
    const cells = [];
    for (let y = row * 4; y < row * 4 + 4; y += 1) for (let x = col * 4; x < col * 4 + 4; x += 1) cells.push(y * 48 + x);
    return cells;
  };
  const fixture = (colors) => {
    const state = create(4512 + colors.filter(Boolean).length);
    state.phase = "WORK";
    state.requiredSize = 1;
    state.rolledSize = 1;
    state.baseRequiredSize = 1;
    const sites = [
      { id: "R1", micro: microFor(13), sourceMacros: [13] },
      { id: "R2", micro: [3 * 48 + 8], sourceMacros: [] },
      { id: "R3", micro: [4 * 48 + 12], sourceMacros: [] },
      { id: "R4", micro: [8 * 48 + 8], sourceMacros: [] },
    ];
    state.regions = Object.fromEntries(sites.map((site, index) => [site.id, {
      ...site,
      controllers: [index % 2 ? "B" : "A"],
      color: colors[index] ?? null,
      isPending: false,
    }]));
    return state;
  };
  const cases = [
    { expected: 0, colors: [null, null, null, null] },
    { expected: 1, colors: ["red", "red", "red", "red"] },
    { expected: 2, colors: ["red", "blue", null, null] },
    { expected: 3, colors: ["red", "blue", "yellow", null] },
    { expected: 4, colors: ["red", "blue", "yellow", "green"] },
  ];
  for (const { expected, colors } of cases) {
    const result = match.applyStandardAction({ state: fixture(colors), actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.contactColorCount, expected);
  }
});

test("contact pressure counts edges only and ignores corner, pending, uncolored, order, and split duplicates", () => {
  const makeState = (reverse = false) => {
    const state = create(reverse ? 4521 : 4520);
    state.phase = "WORK";
    state.requiredSize = 1;
    state.rolledSize = 1;
    state.baseRequiredSize = 1;
    const entries = [
      ["R1", { id: "R1", micro: Array.from({ length: 16 }, (_, index) => 196 + Math.floor(index / 4) * 48 + (index % 4)), sourceMacros: [13], controllers: ["A"], color: "red", isPending: false }],
      ["R2", { id: "R2", micro: [3 * 48 + 7], sourceMacros: [], controllers: ["B"], color: "green", isPending: false }],
      ["R3", { id: "R3", micro: [3 * 48 + 8], sourceMacros: [], controllers: ["B"], color: null, isPending: false }],
      ["R4", { id: "R4", micro: [4 * 48 + 12], sourceMacros: [], controllers: ["A"], color: null, isPending: false }],
      ["R5", { id: "R5", micro: [5 * 48 + 12, 8 * 48 + 9], sourceMacros: [], controllers: ["B"], color: "yellow", isPending: false }],
    ];
    state.regions = Object.fromEntries(reverse ? entries.reverse() : entries);
    return state;
  };
  for (const reverse of [false, true]) {
    const result = match.applyStandardAction({ state: makeState(reverse), actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.contactColorCount, 2);
  }
  const rejected = match.applyStandardAction({ state: makeState(), actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [] } }, expectedVersion: 0 });
  assert.equal(rejected.ok, false);
  assert.equal(Object.hasOwn(rejected, "contactColorCount"), false);
});

test("entering COLOR automatically resolves NO_LEGAL_COLOR in the creating action", () => {
  const state = create(4522);
  const microFor = (macro) => {
    const col = macro % 12;
    const row = Math.floor(macro / 12);
    return Array.from({ length: 16 }, (_, index) => (row * 4 + Math.floor(index / 4)) * 48 + col * 4 + (index % 4));
  };
  const usable = [...state.basicPalettes.B, state.bonusColors.B];
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: { id: "R1", micro: microFor(13), sourceMacros: [13], controllers: ["A"], color: usable[0], isPending: false },
    R2: { id: "R2", micro: microFor(15), sourceMacros: [15], controllers: ["B"], color: usable[1], isPending: false },
    R3: { id: "R3", micro: [3 * 48 + 8], sourceMacros: [], controllers: ["A"], color: usable[2], isPending: false },
  };
  const before = JSON.stringify(state);
  const result = match.applyStandardAction({ state, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual([result.state.status, result.state.phase, result.state.winner, result.state.terminalReason], ["FINISHED", "GAME_OVER", "A", "NO_LEGAL_COLOR"]);
  assert.equal(result.state.version, 1);
  assert.equal(result.state.pending, "R4");
  assert.equal(result.contactColorCount, 3);
});

test("entering COLOR automatically resolves SEALED_OUT when no color is usable", () => {
  const state = create(4523);
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.publicEffects.B.seals = Object.fromEntries(COLORS.map((color) => [color, 1]));
  state.regions = {
    R1: { id: "R1", micro: Array.from({ length: 16 }, (_, index) => 196 + Math.floor(index / 4) * 48 + (index % 4)), sourceMacros: [13], controllers: ["A"], color: "red", isPending: false },
  };
  const result = match.applyStandardAction({ state, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
  assert.equal(result.ok, true);
  assert.deepEqual([result.state.status, result.state.phase, result.state.winner, result.state.terminalReason], ["FINISHED", "GAME_OVER", "A", "SEALED_OUT"]);
  assert.equal(result.state.version, 1);
  assert.equal(result.state.pending, "R2");
});

test("turn-3 blue contact only defeats a yellow-green player when both alternatives are sealed", () => {
  const microFor = (macro) => {
    const col = macro % 12;
    const row = Math.floor(macro / 12);
    return Array.from({ length: 16 }, (_, index) => (row * 4 + Math.floor(index / 4)) * 48 + col * 4 + (index % 4));
  };
  const fixture = () => {
    const state = create(4524);
    state.active = "B";
    state.turn = 3;
    state.phase = "WORK";
    state.requiredSize = 1;
    state.rolledSize = 1;
    state.baseRequiredSize = 1;
    state.basicPalettes.A = ["yellow", "green"];
    state.bonusColors.A = "blue";
    state.bonusUsesRemaining.A = 3;
    state.regions = {
      R1: { id: "R1", micro: microFor(13), sourceMacros: [13], controllers: ["B"], color: "blue", isPending: false },
    };
    return state;
  };
  const legal = fixture();
  const legalResult = match.applyStandardAction({ state: legal, actor: "B", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
  assert.deepEqual([legalResult.state.status, legalResult.state.active, legalResult.state.phase], ["ACTIVE", "A", "COLOR"]);

  const trapped = fixture();
  trapped.publicEffects.A.seals = { yellow: 1, green: 1 };
  const before = JSON.stringify(trapped);
  const trappedResult = match.applyStandardAction({ state: trapped, actor: "B", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
  assert.equal(JSON.stringify(trapped), before);
  assert.deepEqual([trappedResult.state.status, trappedResult.state.winner, trappedResult.state.terminalReason], ["FINISHED", "B", "NO_LEGAL_COLOR"]);

  const fullySealed = fixture();
  fullySealed.publicEffects.A.seals = { yellow: 1, green: 1, blue: 1 };
  const sealedResult = match.applyStandardAction({ state: fullySealed, actor: "B", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0 });
  assert.deepEqual([sealedResult.state.status, sealedResult.state.winner, sealedResult.state.terminalReason], ["FINISHED", "B", "SEALED_OUT"]);
});

test("no-color declaration is accepted only when every usable color is blocked", () => {
  const state = create(452);
  const usable = [...state.basicPalettes.A, state.bonusColors.A];
  state.phase = "COLOR";
  state.pending = "R4";
  state.regions = {
    R1: { id: "R1", micro: [48], sourceMacros: [], controllers: ["B"], color: usable[0], isPending: false },
    R2: { id: "R2", micro: [50], sourceMacros: [], controllers: ["B"], color: usable[1], isPending: false },
    R3: { id: "R3", micro: [1], sourceMacros: [], controllers: ["B"], color: usable[2], isPending: false },
    R4: { id: "R4", micro: [49], sourceMacros: [], controllers: ["B"], color: null, isPending: true },
  };
  const result = match.applyStandardAction({ state, actor: "A", action: { type: "DECLARE_NO_COLOR" }, expectedVersion: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.state.terminalReason, "NO_LEGAL_COLOR");
  state.regions.R3.color = ["red", "blue", "yellow", "green"].find((color) => !usable.includes(color));
  const rejected = match.applyStandardAction({ state, actor: "A", action: { type: "DECLARE_NO_COLOR" }, expectedVersion: 0 });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "COLOR_AVAILABLE");
});

test("post-color requirement shrinks to available geometry and closes a full board", () => {
  const state = create(453);
  const bounds = state.playableBounds;
  const playable = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) playable.push(row * bounds.macroWidth + col);
  }
  const last = playable.pop();
  const color = state.basicPalettes.A.find((entry) => entry !== "red") || state.basicPalettes.A[0];
  state.phase = "COLOR";
  state.pending = "R2";
  state.regions = {
    R1: { id: "R1", micro: [48], sourceMacros: playable, controllers: ["B"], color: color === "red" ? "blue" : "red", isPending: false },
    R2: { id: "R2", micro: [49], sourceMacros: [last], controllers: ["B"], color: null, isPending: true },
  };
  const result = match.applyStandardAction({ state, actor: "A", action: { type: "COLOR_REGION", payload: { color } }, expectedVersion: 0, rngStreams: streams(453) });
  assert.equal(result.ok, true);
  assert.equal(result.state.status, "FINISHED");
  assert.equal(result.state.phase, "GAME_OVER");
  assert.equal(result.state.winner, "A");
  assert.equal(result.state.terminalReason, "BOARD_LOCK");
  assert.equal(result.state.requiredSize, 0);
});

test("illegal coloring loses without consuming the bonus charge", () => {
  const base = create(46);
  const color = base.bonusColors.A;
  const uses = base.bonusUsesRemaining.A;
  base.regions = {
    R1: { id: "R1", micro: [0], sourceMacros: [], controllers: ["B"], color, isPending: false },
    R2: { id: "R2", micro: [1], sourceMacros: [], controllers: ["A"], color: null, isPending: true },
  };
  base.pending = "R2";
  base.phase = "COLOR";
  const result = match.applyStandardAction({ state: base, actor: "A", action: { type: "COLOR_REGION", payload: { color } }, expectedVersion: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.code, "ILLEGAL_COLOR");
  assert.equal(result.state.winner, "B");
  assert.equal(result.state.bonusUsesRemaining.A, uses);
});

test("encode/decode preserves authoritative state and RNG snapshot", () => {
  const state = create(47);
  const snapshot = Object.fromEntries(Object.entries(streams(47)).map(([name, stream]) => [name, stream.snapshot()]));
  const restored = match.decodeStandardMatch(match.encodeStandardMatch(state, snapshot));
  assert.deepEqual(restored.state, state);
  assert.deepEqual(restored.rngSnapshot, snapshot);
});

test("legal recolor is dispatched through USE_SKILL and consumes only skill-effect RNG", () => {
  const state = create(48);
  state.phase = "WORK";
  state.regions = {
    R1: { id: "R1", micro: [48], sourceMacros: [], controllers: ["A"], color: "red", isPending: false },
    R2: { id: "R2", micro: [49], sourceMacros: [], controllers: ["B"], color: "blue", isPending: false },
  };
  const rng = streams(48);
  const before = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
  const result = match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } },
    expectedVersion: 0,
    rngStreams: rng,
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.version, 1);
  assert.equal(result.state.interferenceLock, true);
  for (const [name, stream] of Object.entries(rng)) {
    assert.equal(stream.snapshot() === before[name], name !== "skill-effect", `${name} consumption`);
  }
});

test("named RNG domains isolate cosmetic, quiz, CPU, and match creation", () => {
  const baselineRng = streams(49);
  const noisyRng = streams(49);
  for (let index = 0; index < 10000; index += 1) noisyRng["quiz-cosmetic-motion"].next();
  for (let index = 0; index < 200; index += 1) noisyRng["quiz-content"].next();
  for (let index = 0; index < 50; index += 1) noisyRng["cpu-A"].next();
  assert.deepEqual(
    match.createStandardMatch({ matchId: "rng-isolation", firstSeat: "A" }, baselineRng),
    match.createStandardMatch({ matchId: "rng-isolation", firstSeat: "A" }, noisyRng),
  );
  assert.equal(baselineRng["cpu-B"].snapshot(), noisyRng["cpu-B"].snapshot());
  assert.equal(baselineRng.gacha.snapshot(), noisyRng.gacha.snapshot());
});

test("validator rejects overlapping authoritative regions", () => {
  const state = create(50);
  state.regions = {
    R1: { id: "R1", micro: [0], color: "red", isPending: false },
    R2: { id: "R2", micro: [0], color: "blue", isPending: false },
  };
  assert.throws(() => match.validateStandardState(state), (error) => error.code === "INVALID_REGION_GEOMETRY");
});

test("validator rejects colored, multiple, and mismatched pending regions", () => {
  const region = (id, micro, overrides = {}) => ({ id, micro: [micro], sourceMacros: [], controllers: ["A"], color: null, isPending: false, ...overrides });

  const colored = create(501);
  colored.pending = "R1";
  colored.regions = { R1: region("R1", 49, { color: "red", isPending: true }) };
  assert.throws(() => match.validateStandardState(colored), (error) => error.code === "INVALID_PENDING_STATE");

  const multiple = create(502);
  multiple.pending = "R1";
  multiple.regions = {
    R1: region("R1", 49, { isPending: true }),
    R2: region("R2", 50, { isPending: true }),
  };
  assert.throws(() => match.validateStandardState(multiple), (error) => error.code === "INVALID_PENDING_STATE");

  const missingFlag = create(503);
  missingFlag.pending = "R1";
  missingFlag.regions = { R1: region("R1", 49) };
  assert.throws(() => match.validateStandardState(missingFlag), (error) => error.code === "INVALID_PENDING_STATE");

  const orphanFlag = create(504);
  orphanFlag.pending = null;
  orphanFlag.regions = { R1: region("R1", 49, { isPending: true }) };
  assert.throws(() => match.validateStandardState(orphanFlag), (error) => error.code === "INVALID_PENDING_STATE");
});
