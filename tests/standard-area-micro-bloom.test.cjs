"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const handlers = require("../standard/standard-skill-handlers.js");

function streams(seed = 8101) {
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

function fixture(regionMicro = microForMacro(13)) {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "micro-bloom", firstSeat: "A", hands: { A: { areaMicroBloom: 1 }, B: {} } }, rng);
  state.phase = "WORK";
  state.active = "A";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: { id: "R1", micro: [...regionMicro], sourceMacros: [13], controllers: ["B"], color: "red", isPending: false },
  };
  match.validateStandardState(state);
  return { state, rng };
}

function use(state, rngStreams, sourceMacros = [26], actor = "A") {
  return match.applyStandardAction({
    state,
    actor,
    action: { type: "USE_SKILL", payload: { skill: "areaMicroBloom", sourceMacros } },
    expectedVersion: state.version,
    rngStreams,
  });
}

test("micro bloom resolves one deterministic point-contact candidate and persists a locked outgoing shape", () => {
  const { state, rng } = fixture();
  const candidates = handlers.microBloomCandidates(state, [26]);
  assert.equal(candidates.ok, true);
  assert.equal(candidates.candidates.length, 1);
  assert.deepEqual({ macro: candidates.candidates[0].macro, corner: candidates.candidates[0].corner, diagonalRegion: candidates.candidates[0].diagonalRegion }, {
    macro: 26, corner: "top-left", diagonalRegion: "R1",
  });
  const effectBefore = rng["skill-effect"].snapshot();
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.status, "RESOLVED");
  assert.equal(result.rngDraws, 1);
  assert.equal(rng["skill-effect"].snapshot(), (effectBefore + 0x6d2b79f5) >>> 0);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.areaMicroBloom, 0);
  assert.deepEqual(result.state.preparedOutgoing.actor, "A");
  assert.deepEqual(result.state.preparedOutgoing.sourceMacros, [26]);
  assert.equal(result.state.preparedOutgoing.micro.length, 19);
  assert.equal(result.state.preparedOutgoing.micro.includes(7 * 48 + 7), true);
  assert.deepEqual(result.state.preparedOutgoing.skills, ["areaMicroBloom"]);
  assert.deepEqual(result.publicState.preparedOutgoing, result.state.preparedOutgoing);
  assert.equal(Object.hasOwn(result.privateState, "preparedOutgoing"), false);
});

test("CREATE commits the prepared geometry, transfers one colored donor cell, and clears preparation", () => {
  const { state, rng } = fixture();
  const bloomed = use(state, rng).state;
  const result = match.applyStandardAction({
    state: bloomed,
    actor: "A",
    action: { type: "CREATE_REGION", payload: { sourceMacros: [26] } },
    expectedVersion: bloomed.version,
    rngStreams: rng,
  });
  assert.equal(result.ok, true);
  assert.equal(result.regionId, "R2");
  assert.equal(result.contactColorCount, 1);
  assert.equal(result.state.preparedOutgoing, null);
  assert.deepEqual([result.state.active, result.state.phase, result.state.pending], ["B", "COLOR", "R2"]);
  assert.equal(result.state.regions.R1.micro.length, 15);
  assert.equal(result.state.regions.R1.micro.includes(7 * 48 + 7), false);
  assert.equal(result.state.regions.R2.micro.length, 19);
  assert.equal(result.state.regions.R2.micro.includes(7 * 48 + 7), true);
  const owners = new Set(Object.values(result.state.regions).flatMap((region) => region.micro));
  assert.equal(owners.size, 34);
  match.validateStandardState(result.state);
});

test("prepared intrusion splits a bridge donor deterministically after reserving the pending ID", () => {
  const bridge = [6 * 48 + 7, 7 * 48 + 7, 7 * 48 + 6];
  const { state, rng } = fixture(bridge);
  const bloomed = use(state, rng).state;
  const created = match.applyStandardAction({
    state: bloomed,
    actor: "A",
    action: { type: "CREATE_REGION", payload: { sourceMacros: [26] } },
    expectedVersion: bloomed.version,
    rngStreams: rng,
  });
  assert.equal(created.ok, true);
  assert.deepEqual(Object.keys(created.state.regions).sort(), ["R1", "R2", "R3"]);
  assert.equal(created.state.pending, "R2");
  assert.deepEqual(created.state.regions.R1.micro, [6 * 48 + 7]);
  assert.deepEqual(created.state.regions.R3.micro, [7 * 48 + 6]);
  assert.equal(created.state.regions.R3.color, "red");
  assert.deepEqual(created.state.regions.R3.controllers, ["B"]);
  assert.equal(created.contactColorCount, 1);
});

test("invalid selections and candidate-zero uses reject without state, card, version, or RNG drift", () => {
  for (const sourceMacros of [[], [26, 26], [13], [27]]) {
    const { state, rng } = fixture();
    const stateBefore = JSON.stringify(state);
    const rngBefore = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
    const result = use(state, rng, sourceMacros);
    assert.equal(result.ok, false);
    assert.equal(result.state, state);
    assert.equal(JSON.stringify(state), stateBefore);
    assert.deepEqual(Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()])), rngBefore);
    assert.equal(state.hands.A.areaMicroBloom, 1);
  }
  const { state, rng } = fixture();
  state.phase = "COLOR";
  assert.equal(use(state, rng).code, "WRONG_PHASE");
  state.phase = "WORK";
  assert.equal(use(state, rng, [26], "B").code, "NOT_YOUR_TURN");
});

test("prepared selection mismatch, uncolored overlap, and malformed prepared saves fail closed", () => {
  const { state, rng } = fixture();
  const bloomed = use(state, rng).state;
  const before = JSON.stringify(bloomed);
  const mismatch = match.applyStandardAction({
    state: bloomed,
    actor: "A",
    action: { type: "CREATE_REGION", payload: { sourceMacros: [27] } },
    expectedVersion: bloomed.version,
    rngStreams: rng,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "PREPARED_SELECTION_MISMATCH");
  assert.equal(JSON.stringify(bloomed), before);

  const uncolored = JSON.parse(JSON.stringify(bloomed));
  uncolored.regions.R1.color = null;
  assert.throws(() => match.validateStandardState(uncolored), (error) => error.code === "INVALID_PREPARED_OUTGOING");
  const disconnected = JSON.parse(JSON.stringify(bloomed));
  disconnected.preparedOutgoing.micro = [0, 2];
  assert.throws(() => match.validateStandardState(disconnected), (error) => error.code === "INVALID_PREPARED_OUTGOING");
});

test("prepared outgoing state survives exact encode/decode and surrender without entering private projection", () => {
  const { state, rng } = fixture();
  const bloomed = use(state, rng).state;
  const snapshot = Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
  const decoded = match.decodeStandardMatch(match.encodeStandardMatch(bloomed, snapshot));
  assert.deepEqual(decoded.state, bloomed);
  assert.deepEqual(decoded.rngSnapshot, snapshot);
  assert.deepEqual(match.projectStandardPublicState(bloomed).preparedOutgoing, bloomed.preparedOutgoing);
  assert.equal(JSON.stringify(match.projectStandardPrivateState(bloomed, "B")).includes("preparedOutgoing"), false);
  const surrendered = match.applyStandardAction({ state: bloomed, actor: "A", action: { type: "SURRENDER" }, expectedVersion: bloomed.version });
  assert.equal(surrendered.ok, true);
  assert.equal(surrendered.state.terminalReason, "SURRENDER");
  assert.equal(surrendered.state.preparedOutgoing, null);
});
