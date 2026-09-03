"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const start = require("../standard/standard-match-start.js");
const transaction = require("../standard/standard-match-transaction.js");

function alphaLoadout() {
  return { color: ["colorPrism"], area: ["areaHalfShift"], disrupt: ["disruptChoiceOne"], experimental: ["legalRecolor"] };
}

function rootFixture() {
  const streams = engine.createRngDomains(8801, match.REQUIRED_RNG_STREAMS);
  const rngSnapshot = engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS);
  const root = save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "Alice", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
      playerB: save.createProfile({ name: "Bob", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
    },
    rngSnapshot,
  });
  return start.startStandardMatch({
    root,
    expectedRootRevision: 0,
    operationId: "start-action-gate",
    matchId: "match-action-gate",
    ruleSetId: start.RULE_SET_IDS.ALPHA_SLICE,
    participants: {
      A: { type: "PROFILE", profileId: "playerA" },
      B: { type: "PROFILE", profileId: "playerB" },
    },
    loadouts: { A: alphaLoadout(), B: alphaLoadout() },
    firstSeat: "A",
    clock: { now: () => "2026-08-30T05:00:00.000Z" },
    storageAdapter: { setItem() {} },
  }).root;
}

function createAction(root, overrides = {}) {
  const size = root.activeMatch.state.requiredSize;
  return {
    root,
    expectedRootRevision: root.rootRevision,
    expectedMatchVersion: root.activeMatch.state.version,
    matchId: root.activeMatch.state.matchId,
    actorSeat: root.activeMatch.state.active,
    action: { id: "create-action-1", type: "CREATE_REGION", payload: { sourceMacros: Array.from({ length: size }, (_, index) => 13 + index) } },
    storageAdapter: { setItem() {} },
    ...overrides,
  };
}

test("contact color count contract accepts only integers from zero through four", () => {
  for (const value of [0, 1, 2, 3, 4]) assert.equal(transaction.validContactColorCount(value), true);
  for (const value of [-1, 5, 1.5, NaN, Infinity, null, undefined, "2"]) assert.equal(transaction.validContactColorCount(value), false);
});

test("accepted ordinary action persists match, RNG, root revision, and action receipt once", () => {
  const root = rootFixture();
  const writes = [];
  const result = transaction.dispatchStandardMatchAction(createAction(root, { storageAdapter: { setItem(key, value) { writes.push([key, value]); } } }));
  assert.equal(result.ok, true);
  assert.equal(result.saved, true);
  assert.equal(result.rootRevision, root.rootRevision + 1);
  assert.equal(result.matchVersion, root.activeMatch.state.version + 1);
  assert.equal(writes.length, 1);
  assert.equal(result.root.receipts.matchAction["match-action-gate:create-action-1"].resultCode, "OK");
  assert.equal(result.contactColorCount, 0);
  assert.equal(result.appliedNow, true);
  assert.equal(result.replayedReceipt, false);
  assert.deepEqual(save.decodeStandardSave(writes[0][1]), result.root);
  assert.equal(root.activeMatch.state.version, 0);
});

test("ordinary action replay is no-write and collision, stale root, and stale match fail closed", () => {
  const root = rootFixture();
  const original = createAction(root);
  const committed = transaction.dispatchStandardMatchAction(original);
  const replay = transaction.dispatchStandardMatchAction({ ...original,
    root: committed.root,
    expectedRootRevision: root.rootRevision,
    expectedMatchVersion: root.activeMatch.state.version,
    storageAdapter: { setItem() { throw new Error("replay must not write"); } },
  });
  assert.equal(replay.code, "IDEMPOTENT_REPLAY");
  assert.equal(replay.root, committed.root);
  assert.equal(replay.saved, false);
  assert.equal(replay.appliedNow, false);
  assert.equal(replay.replayedReceipt, true);
  assert.equal(replay.contactColorCount, undefined);
  const collision = transaction.dispatchStandardMatchAction(createAction(committed.root, {
    action: { id: "create-action-1", type: "SURRENDER" },
  }));
  assert.equal(collision.code, "IDEMPOTENCY_KEY_REUSE");
  assert.equal(transaction.dispatchStandardMatchAction(createAction(root, { expectedRootRevision: 99 })).code, "STALE_ROOT_REVISION");
  const staleMatch = transaction.dispatchStandardMatchAction(createAction(root, { expectedMatchVersion: 99 }));
  assert.equal(staleMatch.code, "STALE_MATCH_VERSION");
  assert.equal(staleMatch.appliedNow, false);
  assert.equal(staleMatch.replayedReceipt, false);
});

test("persistence failure preserves the caller root and creates no accepted-action receipt", () => {
  const root = rootFixture();
  const before = JSON.stringify(root);
  const result = transaction.dispatchStandardMatchAction(createAction(root, { storageAdapter: { setItem() { throw new Error("quota"); } } }));
  assert.equal(result.code, "PERSISTENCE_FAILED");
  assert.equal(result.appliedNow, false);
  assert.equal(result.replayedReceipt, false);
  assert.equal(result.root, root);
  assert.equal(JSON.stringify(root), before);
  assert.deepEqual(root.receipts.matchAction, {});
});

test("persistence failure rolls back every alpha action class without consuming cards or RNG", () => {
  const cases = [
    {
      name: "COLOR_REGION",
      prepare(root) {
        const state = root.activeMatch.state;
        state.active = "A";
        state.phase = "COLOR";
        state.pending = "R1";
        state.regions = {
          R1: { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: null, isPending: true },
        };
      },
      action: { type: "COLOR_REGION", payload: { color: "red" } },
    },
    {
      name: "colorPrism",
      prepare(root) {
        const state = root.activeMatch.state;
        state.active = "A";
        state.phase = "COLOR";
        state.pending = "R1";
        state.regions = {
          R1: { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: null, isPending: true },
        };
      },
      action: { type: "USE_SKILL", payload: { skill: "colorPrism" } },
    },
    {
      name: "areaHalfShift",
      prepare(root) {
        const state = root.activeMatch.state;
        state.active = "A";
        state.phase = "WORK";
        state.pending = null;
        state.regions = {
          R1: { id: "R1", micro: [196, 197, 244, 245], sourceMacros: [13], controllers: ["A"], color: "red", isPending: false },
        };
      },
      action: { type: "USE_SKILL", payload: { skill: "areaHalfShift", axis: "COLUMN", index: 1, direction: "plus" } },
    },
    {
      name: "disruptChoiceOne",
      prepare(root) {
        const state = root.activeMatch.state;
        state.active = "A";
        state.phase = "WORK";
        state.pending = null;
        state.regions = {
          R1: { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: "red", isPending: false },
        };
      },
      action: { type: "USE_SKILL", payload: { skill: "disruptChoiceOne", color: "red" } },
    },
    {
      name: "legalRecolor",
      prepare(root) {
        const state = root.activeMatch.state;
        state.active = "A";
        state.phase = "WORK";
        state.pending = null;
        state.regions = {
          R1: { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: "red", isPending: false },
          R2: { id: "R2", micro: [48], sourceMacros: [], controllers: ["B"], color: "blue", isPending: false },
        };
      },
      action: { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } },
    },
    {
      name: "SURRENDER",
      prepare(root) {
        root.activeMatch.state.active = "A";
      },
      action: { type: "SURRENDER" },
    },
  ];

  for (const scenario of cases) {
    const root = JSON.parse(JSON.stringify(rootFixture()));
    scenario.prepare(root);
    save.validateStandardSave(root);
    const before = JSON.stringify(root);
    const result = transaction.dispatchStandardMatchAction({
      root,
      expectedRootRevision: root.rootRevision,
      expectedMatchVersion: root.activeMatch.state.version,
      matchId: root.activeMatch.state.matchId,
      actorSeat: "A",
      action: { id: `rollback-${scenario.name}`, ...scenario.action },
      storageAdapter: { setItem() { throw new Error("quota"); } },
    });
    assert.equal(result.code, "PERSISTENCE_FAILED", scenario.name);
    assert.equal(result.root, root, scenario.name);
    assert.equal(JSON.stringify(root), before, scenario.name);
    assert.deepEqual(root.receipts.matchAction, {}, scenario.name);
  }
});

test("experimental loan consumes only match hand while persisting the accepted action exactly once", () => {
  const root = JSON.parse(JSON.stringify(rootFixture()));
  const state = root.activeMatch.state;
  state.active = "A";
  state.phase = "WORK";
  state.pending = null;
  state.regions = {
    R1: { id: "R1", micro: [0], sourceMacros: [], controllers: ["A"], color: "red", isPending: false },
    R2: { id: "R2", micro: [1], sourceMacros: [], controllers: ["B"], color: "blue", isPending: false },
  };
  save.validateStandardSave(root);
  const inventoryBefore = JSON.stringify(root.profiles.playerA.inventory);
  const reservationsBefore = JSON.stringify(root.reservations.playerA);
  const result = transaction.dispatchStandardMatchAction({
    root,
    expectedRootRevision: root.rootRevision,
    expectedMatchVersion: state.version,
    matchId: state.matchId,
    actorSeat: "A",
    action: { id: "loan-recolor-1", type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } },
    storageAdapter: { setItem() {} },
  });
  assert.equal(result.ok, true);
  assert.equal(result.root.activeMatch.state.hands.A.legalRecolor, 0);
  assert.equal(JSON.stringify(result.root.profiles.playerA.inventory), inventoryBefore);
  assert.equal(JSON.stringify(result.root.reservations.playerA), reservationsBefore);
  const receipt = result.root.receipts.matchConsumption["match-action-gate:loan-recolor-1"];
  assert.equal(receipt.matchId, "match-action-gate");
  assert.equal(receipt.actionId, "loan-recolor-1");
  assert.equal(receipt.profileId, "playerA");
  assert.equal(receipt.skill, "legalRecolor");
  assert.equal(receipt.source, "EXPERIMENTAL_LOAN");
  assert.equal(receipt.version, state.version + 1);
  assert.equal((state.hands.A.legalRecolor || 0) - (result.root.activeMatch.state.hands.A.legalRecolor || 0), 1);
  assert.equal((root.profiles.playerA.inventory.legalRecolor || 0) - (result.root.profiles.playerA.inventory.legalRecolor || 0), 0);
  assert.equal((root.reservations.playerA.legalRecolor || 0) - (result.root.reservations.playerA.legalRecolor || 0), 0);
  assert.equal(Object.keys(result.root.receipts.matchAction).length, 1);
  const replay = transaction.dispatchStandardMatchAction({
    root: result.root,
    expectedRootRevision: root.rootRevision,
    expectedMatchVersion: state.version,
    matchId: state.matchId,
    actorSeat: "A",
    action: { id: "loan-recolor-1", type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } },
    storageAdapter: { setItem() { throw new Error("replay must not write"); } },
  });
  assert.equal(replay.status, "RESOLVED");
  assert.equal(replay.code, "IDEMPOTENT_REPLAY");
  assert.equal(replay.saved, false);
  assert.equal(Object.keys(replay.root.receipts.matchConsumption).length, 1);
  assert.deepEqual(replay.root.receipts.matchConsumption["match-action-gate:loan-recolor-1"], receipt);
});
