"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed = 8201) {
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

function fixture({ requiredSize = 1, hands = { A: { areaDiePlus: 1 }, B: {} } } = {}) {
  const rng = streams();
  const state = match.createStandardMatch({ matchId: "area-die-plus", firstSeat: "A", hands }, rng);
  state.phase = "WORK";
  state.active = "A";
  state.requiredSize = requiredSize;
  state.rolledSize = Math.min(requiredSize, 4);
  state.baseRequiredSize = Math.min(requiredSize, 4);
  return { state, rng };
}

function use(state, rngStreams, actor = "A") {
  return match.applyStandardAction({
    state,
    actor,
    action: { type: "USE_SKILL", payload: { skill: "areaDiePlus" } },
    expectedVersion: state.version,
    rngStreams,
  });
}

function snapshots(rng) {
  return Object.fromEntries(Object.entries(rng).map(([name, stream]) => [name, stream.snapshot()]));
}

test("area expansion raises this turn's required size by one without RNG", () => {
  const { state, rng } = fixture({ requiredSize: 4 });
  const rngBefore = snapshots(rng);
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.status, "RESOLVED");
  assert.equal(result.rngDraws, 0);
  assert.equal(result.requiredSize, 5);
  assert.equal(result.state.requiredSize, 5);
  assert.equal(result.state.baseRequiredSize, 4);
  assert.equal(result.state.hands.A.areaDiePlus, 0);
  assert.equal(result.state.skillsUsed.A, state.skillsUsed.A + 1);
  assert.equal(result.state.version, state.version + 1);
  assert.deepEqual(snapshots(rng), rngBefore);
});

test("area expansion rejects maximum and impossible sizes atomically", () => {
  const max = fixture({ requiredSize: 5 });
  const maxBefore = JSON.stringify(max.state);
  const maxRng = snapshots(max.rng);
  const atMax = use(max.state, max.rng);
  assert.equal(atMax.ok, false);
  assert.equal(atMax.code, "AREA_SIZE_MAX");
  assert.equal(atMax.state, max.state);
  assert.equal(JSON.stringify(max.state), maxBefore);
  assert.deepEqual(snapshots(max.rng), maxRng);

  const blocked = fixture();
  const playable = [];
  for (let row = 1; row <= 10; row += 1) {
    for (let col = 1; col <= 10; col += 1) playable.push(row * 12 + col);
  }
  const occupied = playable.slice(0, -1);
  blocked.state.regions = {
    R1: { id: "R1", sourceMacros: occupied, micro: occupied.flatMap(microForMacro), controllers: ["B"], color: "red", isPending: false },
  };
  match.validateStandardState(blocked.state);
  const blockedBefore = JSON.stringify(blocked.state);
  const blockedRng = snapshots(blocked.rng);
  const noRoom = use(blocked.state, blocked.rng);
  assert.equal(noRoom.ok, false);
  assert.equal(noRoom.code, "NO_LEGAL_REGION_SIZE");
  assert.equal(JSON.stringify(blocked.state), blockedBefore);
  assert.deepEqual(snapshots(blocked.rng), blockedRng);
  assert.equal(blocked.state.hands.A.areaDiePlus, 1);
});

test("area expansion rejects after outgoing geometry is prepared", () => {
  const { state, rng } = fixture({ hands: { A: { areaDiePlus: 1, areaMicroBloom: 1 }, B: {} } });
  state.regions = {
    R1: { id: "R1", sourceMacros: [13], micro: microForMacro(13), controllers: ["B"], color: "red", isPending: false },
  };
  const bloomed = match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaMicroBloom", sourceMacros: [26] } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
  assert.equal(bloomed.ok, true);
  const before = JSON.stringify(bloomed.state);
  const rngBefore = snapshots(rng);
  const result = use(bloomed.state, rng);
  assert.equal(result.ok, false);
  assert.equal(result.code, "PREPARED_OUTGOING_EXISTS");
  assert.equal(JSON.stringify(bloomed.state), before);
  assert.deepEqual(snapshots(rng), rngBefore);
  assert.equal(bloomed.state.hands.A.areaDiePlus, 1);
});

test("expanded size is enforced by CREATE and resets after the following color", () => {
  const { state, rng } = fixture();
  state.regions = {
    R1: { id: "R1", sourceMacros: [13], micro: microForMacro(13), controllers: ["B"], color: "red", isPending: false },
  };
  const expanded = use(state, rng).state;
  const wrong = match.applyStandardAction({ state: expanded, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: expanded.version, rngStreams: rng });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.code, "WRONG_REGION_SIZE");
  const created = match.applyStandardAction({ state: expanded, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14, 26] } }, expectedVersion: expanded.version, rngStreams: rng });
  assert.equal(created.ok, true);
  assert.deepEqual([created.state.active, created.state.phase], ["B", "COLOR"]);
  const color = created.state.basicPalettes.B.find((candidate) => candidate !== "red");
  assert.ok(color);
  const colored = match.applyStandardAction({ state: created.state, actor: "B", action: { type: "COLOR_REGION", payload: { color } }, expectedVersion: created.state.version, rngStreams: rng });
  assert.equal(colored.ok, true);
  assert.deepEqual([colored.state.active, colored.state.phase], ["B", "WORK"]);
  assert.equal(colored.state.requiredSize, colored.state.baseRequiredSize);
  assert.ok(colored.state.requiredSize >= 1 && colored.state.requiredSize <= 4);
});

test("wrong seat, phase, and unavailable-card attempts reject before mutation", () => {
  const { state, rng } = fixture();
  const before = JSON.stringify(state);
  const rngBefore = snapshots(rng);
  assert.equal(use(state, rng, "B").code, "NOT_YOUR_TURN");
  state.phase = "COLOR";
  assert.equal(use(state, rng).code, "WRONG_PHASE");
  state.phase = "WORK";
  state.hands.A.areaDiePlus = 0;
  assert.equal(use(state, rng).code, "SKILL_UNAVAILABLE");
  state.hands.A.areaDiePlus = 1;
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(snapshots(rng), rngBefore);
});

test("authoritative size fields reject malformed or out-of-range saves", () => {
  const { state } = fixture();
  for (const [field, value, code] of [
    ["rolledSize", 5, "INVALID_ROLLED_SIZE"],
    ["baseRequiredSize", -1, "INVALID_BASE_REQUIRED_SIZE"],
    ["requiredSize", 6, "INVALID_REQUIRED_SIZE"],
    ["requiredSize", 1.5, "INVALID_REQUIRED_SIZE"],
  ]) {
    const malformed = JSON.parse(JSON.stringify(state));
    malformed[field] = value;
    assert.throws(() => match.validateStandardState(malformed), (error) => error.code === code);
  }
});
