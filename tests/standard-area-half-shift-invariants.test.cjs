"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const start = require("../standard/standard-match-start.js");
const transaction = require("../standard/standard-match-transaction.js");
const { createStandardLocalSession } = require("../standard/standard-local-session.js");

const EXPECTED_PRE_MICRO = Object.freeze([
  196, 197, 198, 199, 200, 201, 202, 203,
  244, 245, 246, 247, 248, 249, 250, 251,
  292, 293, 294, 295, 296, 297, 298, 299,
  340, 341, 342, 343, 344, 345, 346, 347,
]);

// Independent fixed oracle for COLUMN 1 / plus. The product shift planner is not used here.
const EXPECTED_POST_MICRO = Object.freeze([
  200, 201, 202, 203,
  248, 249, 250, 251,
  292, 293, 294, 295, 296, 297, 298, 299,
  340, 341, 342, 343, 344, 345, 346, 347,
  388, 389, 390, 391,
  436, 437, 438, 439,
]);

function alphaLoadout() {
  return { color: ["colorPrism"], area: ["areaHalfShift"], disrupt: ["disruptChoiceOne"], experimental: ["legalRecolor"] };
}

function sha(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function storageWith(payload) {
  let value = payload;
  const writes = [];
  return {
    writes,
    getItem(key) { return key === match.SAVE_KEY ? value : null; },
    setItem(key, next) { assert.equal(key, match.SAVE_KEY); writes.push(next); value = next; },
  };
}

function initialRoot() {
  const streams = engine.createRngDomains(9901, match.REQUIRED_RNG_STREAMS);
  const root = save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "Alice", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
      playerB: save.createProfile({ name: "Bob", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
    },
    rngSnapshot: engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS),
  });
  return start.startStandardMatch({
    root,
    expectedRootRevision: 0,
    operationId: "half-shift-start",
    matchId: "half-shift-match",
    ruleSetId: start.RULE_SET_IDS.ALPHA_SLICE,
    participants: {
      A: { type: "PROFILE", profileId: "playerA" },
      B: { type: "PROFILE", profileId: "playerB" },
    },
    loadouts: { A: alphaLoadout(), B: alphaLoadout() },
    firstSeat: "A",
    clock: { now: () => "2026-08-30T08:30:00.000Z" },
    storageAdapter: { setItem() {} },
  }).root;
}

function dispatch(root, actorSeat, id, type, payload, writes = []) {
  return transaction.dispatchStandardMatchAction({
    root,
    expectedRootRevision: root.rootRevision,
    expectedMatchVersion: root.activeMatch.state.version,
    matchId: root.activeMatch.state.matchId,
    actorSeat,
    action: { id, type, payload },
    storageAdapter: { setItem(key, value) { writes.push([key, value]); } },
  });
}

function preShiftRoot() {
  const started = initialRoot();
  assert.equal(started.activeMatch.state.requiredSize, 2);
  const created = dispatch(started, "A", "half-shift-create", "CREATE_REGION", { sourceMacros: [13, 14] });
  assert.equal(created.ok, true);
  const colored = dispatch(created.root, "B", "half-shift-color", "COLOR_REGION", { color: "green" });
  assert.equal(colored.ok, true);
  assert.equal(colored.root.activeMatch.state.phase, "WORK");
  return colored.root;
}

function ownerEntries(state) {
  return Object.values(state.regions).flatMap((region) => region.micro.map((cell) => [cell, region.id])).sort((a, b) => a[0] - b[0]);
}

function isConnected(cells, width) {
  if (!cells.length) return false;
  const remaining = new Set(cells);
  const queue = [cells[0]];
  remaining.delete(cells[0]);
  while (queue.length) {
    const cell = queue.shift();
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    for (const neighbor of neighbors) if (remaining.delete(neighbor)) queue.push(neighbor);
  }
  return remaining.size === 0;
}

function adjacency(state) {
  const owners = new Map(ownerEntries(state));
  return Object.fromEntries(Object.values(state.regions).map((region) => {
    const adjacent = new Set();
    for (const cell of region.micro) {
      const x = cell % state.microWidth;
      const neighbors = [cell - state.microWidth, cell + state.microWidth];
      if (x > 0) neighbors.push(cell - 1);
      if (x < state.microWidth - 1) neighbors.push(cell + 1);
      for (const neighbor of neighbors) {
        const owner = owners.get(neighbor);
        if (owner && owner !== region.id) adjacent.add(owner);
      }
    }
    return [region.id, [...adjacent].sort()];
  }));
}

function projectionHashes(root) {
  const storage = storageWith(save.encodeStandardSave(root));
  const session = createStandardLocalSession({
    storageAdapter: storage,
    clock: { now: () => "2026-08-30T08:31:00.000Z" },
    idFactory: (scope) => `projection-${scope}`,
  });
  const publicProjection = session.getPublicProjection();
  const privateProjection = session.revealPrivate("B").privateState;
  assert.equal(storage.writes.length, 0);
  return { public: sha(publicProjection), privateB: sha(privateProjection) };
}

function snapshot(root) {
  const state = root.activeMatch.state;
  const encoded = save.encodeStandardSave(root);
  return {
    rootRevision: root.rootRevision,
    matchVersion: state.version,
    rootHash: sha(root),
    matchHash: sha(state),
    rngHash: sha(root.rngSnapshot),
    storageHash: sha(encoded),
    projectionHashes: projectionHashes(root),
    hand: state.hands.B.areaHalfShift,
    inventory: root.profiles.playerB.inventory.areaHalfShift,
    reservation: root.reservations.playerB.areaHalfShift,
    actionReceipts: Object.keys(root.receipts.matchAction).length,
    consumptionReceipts: Object.keys(root.receipts.matchConsumption).length,
    regionIds: Object.keys(state.regions).sort(),
    owners: ownerEntries(state),
    occupied: ownerEntries(state).length,
    adjacency: adjacency(state),
    active: state.active,
    phase: state.phase,
    requiredSize: state.requiredSize,
    rolledSize: state.rolledSize,
    pending: state.pending,
  };
}

test("areaHalfShift rejected empty band is byte-stable and write-free", () => {
  const root = preShiftRoot();
  assert.deepEqual([...root.activeMatch.state.regions.R1.micro].sort((a, b) => a - b), EXPECTED_PRE_MICRO);
  const before = snapshot(root);
  const writes = [];
  const result = dispatch(root, "B", "half-shift-empty", "USE_SKILL", {
    skill: "areaHalfShift", axis: "COLUMN", index: 10, direction: "plus",
  }, writes);
  assert.equal(result.ok, false);
  assert.equal(result.code, "EMPTY_SHIFT_BAND");
  assert.equal(result.root, root);
  assert.equal(writes.length, 0);
  assert.deepEqual(snapshot(root), before);
});

test("areaHalfShift resolves once with exact transactional and micro topology invariants", () => {
  const root = preShiftRoot();
  const before = snapshot(root);
  const stateBefore = root.activeMatch.state;
  const nonGeometryBefore = { ...stateBefore.regions.R1 };
  delete nonGeometryBefore.micro;
  delete nonGeometryBefore.sourceMacros;
  const writes = [];
  const result = dispatch(root, "B", "half-shift-valid", "USE_SKILL", {
    skill: "areaHalfShift", axis: "COLUMN", index: 1, direction: "plus",
  }, writes);
  assert.equal(result.ok, true);
  assert.equal(writes.length, 1);
  const after = snapshot(result.root);
  const shifted = result.root.activeMatch.state;

  assert.equal(after.rootRevision, before.rootRevision + 1);
  assert.equal(after.matchVersion, before.matchVersion + 1);
  assert.equal(after.actionReceipts, before.actionReceipts + 1);
  assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
  assert.equal(after.hand, before.hand - 1);
  assert.equal(after.inventory, before.inventory - 1);
  assert.equal(after.reservation, before.reservation - 1);
  assert.equal(after.rngHash, before.rngHash);
  assert.equal(after.active, "B");
  assert.equal(after.phase, "WORK");
  assert.equal(after.requiredSize, before.requiredSize);
  assert.equal(after.rolledSize, before.rolledSize);
  assert.equal(after.pending, before.pending);

  assert.deepEqual(after.regionIds, ["R1"]);
  assert.deepEqual(shifted.regions.R1.micro, EXPECTED_POST_MICRO);
  assert.deepEqual(shifted.regions.R1.sourceMacros, [13, 14, 25]);
  assert.equal(after.occupied, before.occupied);
  assert.equal(new Set(shifted.regions.R1.micro).size, EXPECTED_POST_MICRO.length);
  assert.equal(after.owners.length, EXPECTED_POST_MICRO.length);
  assert.equal(after.owners.every(([, owner]) => owner === "R1"), true);
  assert.equal(shifted.regions.R1.micro.every((cell) => cell >= 0 && cell < shifted.microWidth ** 2), true);
  assert.equal(isConnected(shifted.regions.R1.micro, shifted.microWidth), true);
  assert.deepEqual(after.adjacency, { R1: [] });
  const nonGeometryAfter = { ...shifted.regions.R1 };
  delete nonGeometryAfter.micro;
  delete nonGeometryAfter.sourceMacros;
  assert.deepEqual(nonGeometryAfter, nonGeometryBefore);

  const movedBefore = EXPECTED_PRE_MICRO.filter((cell) => cell % 48 >= 4 && cell % 48 <= 7);
  const untouchedBefore = EXPECTED_PRE_MICRO.filter((cell) => cell % 48 >= 8 && cell % 48 <= 11);
  assert.deepEqual(movedBefore.map((cell) => cell + 96).sort((a, b) => a - b), EXPECTED_POST_MICRO.filter((cell) => cell % 48 >= 4 && cell % 48 <= 7));
  assert.deepEqual(untouchedBefore, EXPECTED_POST_MICRO.filter((cell) => cell % 48 >= 8 && cell % 48 <= 11));

  const persisted = save.decodeStandardSave(writes[0][1]);
  assert.deepEqual(persisted, result.root);
  assert.equal(sha(persisted), after.rootHash);
  assert.deepEqual(projectionHashes(persisted), after.projectionHashes);

  const duplicateWrites = [];
  const duplicate = dispatch(result.root, "B", "half-shift-second-id", "USE_SKILL", {
    skill: "areaHalfShift", axis: "COLUMN", index: 1, direction: "plus",
  }, duplicateWrites);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, "SKILL_UNAVAILABLE");
  assert.equal(duplicateWrites.length, 0);
  assert.equal(duplicate.root, result.root);
  assert.deepEqual(snapshot(duplicate.root), after);

  const nextWrites = [];
  const nextRegion = Array.from({ length: persisted.activeMatch.state.requiredSize }, (_, index) => 26 + index * 12);
  const nextCreate = dispatch(persisted, "B", "half-shift-next-create", "CREATE_REGION", { sourceMacros: nextRegion }, nextWrites);
  assert.equal(nextCreate.ok, true);
  assert.equal(nextWrites.length, 1);
  assert.equal(nextCreate.root.rootRevision, after.rootRevision + 1);
  assert.equal(nextCreate.root.activeMatch.state.version, after.matchVersion + 1);
  assert.equal(nextCreate.root.activeMatch.state.active, "A");
  assert.equal(nextCreate.root.activeMatch.state.phase, "COLOR");
});
