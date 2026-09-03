"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const handlers = require("../standard/standard-skill-handlers.js");

function streams(seed = 8401) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function microForMacro(macro) {
  const row = Math.floor(macro / 12);
  const col = macro % 12;
  const cells = [];
  for (let dy = 0; dy < 4; dy += 1) for (let dx = 0; dx < 4; dx += 1) cells.push((row * 4 + dy) * 48 + col * 4 + dx);
  return cells;
}

function fixture(hands = { areaCornerBloom: 1 }) {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "corner-bloom", firstSeat: "A", hands: { A: hands, B: {} } }, rng);
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  match.validateStandardState(state);
  return { state, rng };
}

function use(state, rng, macro = 26, sourceMacros = [26]) {
  return match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaCornerBloom", sourceMacros, macro } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
}

test("corner bloom expands all four available corners deterministically without RNG", () => {
  const { state, rng } = fixture();
  const before = rng["skill-effect"].snapshot();
  const plan = handlers.cornerBloomPlan(state, [26], 26);
  assert.equal(plan.ok, true);
  assert.equal(plan.plan.length, 12);
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.rngDraws, 0);
  assert.equal(rng["skill-effect"].snapshot(), before);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.areaCornerBloom, 0);
  assert.equal(result.state.preparedOutgoing.micro.length, 28);
  assert.deepEqual(result.state.preparedOutgoing.skills, ["areaCornerBloom"]);
  assert.deepEqual({ macro: result.macro, addedCount: result.addedCount }, { macro: 26, addedCount: 12 });
  match.validateStandardState(result.state);
});

test("corner bloom composes after micro bloom and the prepared shape survives validation and CREATE", () => {
  const { state, rng } = fixture({ areaMicroBloom: 1, areaCornerBloom: 1 });
  state.regions.R1 = { id: "R1", micro: microForMacro(13), sourceMacros: [13], controllers: ["B"], color: "red", isPending: false };
  const micro = match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaMicroBloom", sourceMacros: [26] } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
  assert.equal(micro.ok, true);
  const corner = use(micro.state, rng);
  assert.equal(corner.ok, true);
  assert.deepEqual(corner.state.preparedOutgoing.skills, ["areaMicroBloom", "areaCornerBloom"]);
  assert.equal(corner.state.preparedOutgoing.micro.length > micro.state.preparedOutgoing.micro.length, true);
  match.validateStandardState(corner.state);
  const created = match.applyStandardAction({
    state: corner.state,
    actor: "A",
    action: { type: "CREATE_REGION", payload: { sourceMacros: [26] } },
    expectedVersion: corner.state.version,
    rngStreams: rng,
  });
  assert.equal(created.ok, true);
  assert.equal(created.state.preparedOutgoing, null);
  assert.deepEqual(created.state.regions.R2.micro, corner.state.preparedOutgoing.micro);
});

test("invalid target and zero-candidate uses reject atomically", () => {
  const { state, rng } = fixture();
  const before = JSON.stringify(state);
  const badTarget = use(state, rng, 27);
  assert.equal(badTarget.code, "INVALID_CORNER_BLOOM_TARGET");
  assert.equal(JSON.stringify(state), before);

  const blockedCells = handlers.cornerBloomPlan(state, [26], 26).plan;
  state.regions.R1 = { id: "R1", micro: [...blockedCells], sourceMacros: [], controllers: [], color: null, isPending: false };
  match.validateStandardState(state);
  const blockedBefore = JSON.stringify(state);
  const blocked = use(state, rng);
  assert.equal(blocked.code, "NO_CORNER_BLOOM_CANDIDATE");
  assert.equal(blocked.state, state);
  assert.equal(JSON.stringify(state), blockedBefore);
  assert.equal(state.hands.A.areaCornerBloom, 1);
});

test("prepared corner bloom rejects a mismatched outgoing selection", () => {
  const { state, rng } = fixture();
  const prepared = use(state, rng).state;
  const mismatch = match.applyStandardAction({
    state: prepared,
    actor: "A",
    action: { type: "CREATE_REGION", payload: { sourceMacros: [27] } },
    expectedVersion: prepared.version,
    rngStreams: rng,
  });
  assert.equal(mismatch.code, "PREPARED_SELECTION_MISMATCH");
});
