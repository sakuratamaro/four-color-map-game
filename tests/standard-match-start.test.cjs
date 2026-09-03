"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const start = require("../standard/standard-match-start.js");
const { STANDARD_SKILLS } = require("../standard/standard-skill-registry.js");

function rngSnapshot(seed = 7101) {
  const streams = engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
  return Object.fromEntries(match.REQUIRED_RNG_STREAMS.map((name) => [name, streams[name].snapshot()]));
}

function alphaLoadout() {
  return {
    color: ["colorPrism"],
    area: ["areaHalfShift"],
    disrupt: ["disruptChoiceOne"],
    experimental: ["legalRecolor"],
  };
}

function fixture() {
  return save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "Alice", inventory: { colorPrism: 1, areaHalfShift: 2, disruptChoiceOne: 1 } }),
      playerB: save.createProfile({ name: "Bob", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
    },
    rngSnapshot: rngSnapshot(),
  });
}

function args(root, overrides = {}) {
  return {
    root,
    expectedRootRevision: root.rootRevision,
    operationId: "start-op-1",
    matchId: "match-alpha-1",
    ruleSetId: start.RULE_SET_IDS.ALPHA_SLICE,
    participants: {
      A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "forged" },
      B: { type: "CPU", difficulty: "normal", policyVersion: "standard-cpu-v1" },
    },
    loadouts: { A: alphaLoadout(), B: alphaLoadout() },
    firstSeat: "A",
    clock: { now: () => "2026-08-30T04:30:00.000Z" },
    storageAdapter: { setItem() {} },
    ...overrides,
  };
}

test("quote is RNG-neutral and derives profile identity, reservations, loans, and CPU virtual cards", () => {
  const root = fixture();
  const before = JSON.stringify(root);
  const quote = start.quoteStandardMatchStart(args(root));
  assert.equal(quote.status, "READY");
  assert.equal(JSON.stringify(root), before);
  assert.equal(quote.participants.A.displayNameSnapshot, "Alice");
  assert.deepEqual(quote.reservations, { playerA: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } });
  assert.equal(quote.sources.A.legalRecolor, "EXPERIMENTAL_LOAN");
  assert.equal(quote.sources.B.colorPrism, "CPU_VIRTUAL");
  assert.equal(quote.sources.B.legalRecolor, "EXPERIMENTAL_LOAN");
});

test("start creates match, hand, reservations, receipt, and RNG snapshot in one write", () => {
  const root = fixture();
  const writes = [];
  const result = start.startStandardMatch(args(root, { storageAdapter: { setItem(key, value) { writes.push([key, value]); } } }));
  assert.equal(result.status, "STARTED");
  assert.equal(result.root.rootRevision, 1);
  assert.equal(result.root.activeMatch.ruleSetId, start.RULE_SET_IDS.ALPHA_SLICE);
  assert.equal(result.root.activeMatch.participants.A.displayNameSnapshot, "Alice");
  assert.equal(result.root.activeMatch.state.hands.A.legalRecolor, 1);
  assert.equal(result.root.activeMatch.state.hands.B.colorPrism, 1);
  assert.deepEqual(result.root.reservations, { playerA: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } });
  assert.equal(result.root.receipts.matchStart.byMatchId["match-alpha-1"].operationId, "start-op-1");
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], match.SAVE_KEY);
  assert.deepEqual(save.decodeStandardSave(writes[0][1]), result.root);
  assert.notDeepEqual(result.root.rngSnapshot, root.rngSnapshot);
  assert.equal(root.activeMatch, null);
});

test("PvP start fixes two distinct profile snapshots and reserves each inventory-backed hand", () => {
  const root = fixture();
  const result = start.startStandardMatch(args(root, {
    participants: {
      A: { type: "PROFILE", profileId: "playerA" },
      B: { type: "PROFILE", profileId: "playerB" },
    },
  }));
  assert.equal(result.status, "STARTED");
  assert.deepEqual(result.root.activeMatch.participants, {
    A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "Alice" },
    B: { type: "PROFILE", profileId: "playerB", displayNameSnapshot: "Bob" },
  });
  assert.deepEqual(result.root.reservations, {
    playerA: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 },
    playerB: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 },
  });
  assert.equal(result.root.profiles.playerA.inventory.areaHalfShift, 2);
  assert.equal(result.root.profiles.playerB.inventory.areaHalfShift, 1);
});

test("same match replay is no-write before revision checking; changed payload and operation reuse reject", () => {
  const root = fixture();
  const committed = start.startStandardMatch(args(root));
  const replay = start.startStandardMatch(args(committed.root, {
    expectedRootRevision: 0,
    operationId: "different-retry-id",
    clock: { now() { throw new Error("clock must not run"); } },
    storageAdapter: { setItem() { throw new Error("storage must not run"); } },
  }));
  assert.equal(replay.status, "ALREADY_STARTED");
  assert.equal(replay.root, committed.root);
  const conflictLoadouts = { A: alphaLoadout(), B: alphaLoadout() };
  conflictLoadouts.A.experimental = [];
  assert.equal(start.startStandardMatch(args(committed.root, { expectedRootRevision: 1, loadouts: conflictLoadouts })).code, "MATCH_START_CONFLICT");

  const reused = JSON.parse(JSON.stringify(committed.root));
  reused.activeMatch.settlement = { settled: true, operationId: "settled", resultFingerprint: "x", settledAt: "2026-08-30T04:31:00.000Z", rootRevision: 1 };
  reused.receipts.matchSettlement.byMatchId["match-alpha-1"] = { scope: "matchSettlement", operationId: "settled", matchId: "match-alpha-1", resultFingerprint: "x", winnerSeat: "A", terminalReason: "SURRENDER", settledAt: "2026-08-30T04:31:00.000Z", rootRevision: 1, profileResults: {} };
  reused.receipts.matchSettlement.operationIndex.settled = "match-alpha-1";
  reused.reservations = {};
  assert.equal(start.startStandardMatch(args(reused, { expectedRootRevision: 1, matchId: "match-alpha-2" })).code, "IDEMPOTENCY_KEY_REUSE");
});

test("stale revision, inventory shortage, and persistence failure preserve root", () => {
  const root = fixture();
  assert.equal(start.startStandardMatch(args(root, { expectedRootRevision: 9 })).code, "STALE_ROOT_REVISION");
  const short = JSON.parse(JSON.stringify(root));
  short.profiles.playerA.inventory.colorPrism = 0;
  assert.equal(start.startStandardMatch(args(short)).code, "INSUFFICIENT_INVENTORY");
  const official = { A: { color: ["colorPrism", "colorChoiceBorrow"], area: ["areaHalfShift", "areaResize"], disrupt: ["disruptChoiceOne", "disruptRandomOne"] }, B: { color: ["colorPrism", "colorChoiceBorrow"], area: ["areaHalfShift", "areaResize"], disrupt: ["disruptChoiceOne", "disruptRandomOne"] } };
  assert.equal(start.startStandardMatch(args(root, { ruleSetId: start.RULE_SET_IDS.STANDARD, loadouts: official })).code, "INSUFFICIENT_INVENTORY");
  const failed = start.startStandardMatch(args(root, { storageAdapter: { setItem() { throw Object.assign(new Error("quota"), { code: 22 }); } } }));
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(failed.root, root);
  assert.equal(root.rootRevision, 0);
  assert.equal(root.activeMatch, null);
  assert.deepEqual(root.reservations, {});
});

test("invalid or repeated loadout quote IDs reject before clock, RNG commit, or storage", () => {
  const root = fixture();
  const result = start.startStandardMatch(args(root, {
    quoteIds: { A: "same-quote", B: "same-quote" },
    clock: { now() { throw new Error("clock must not run"); } },
    storageAdapter: { setItem() { throw new Error("storage must not run"); } },
  }));
  assert.equal(result.code, "INVALID_LOADOUT_QUOTE_IDS");
  assert.equal(result.root, root);
  assert.equal(root.rootRevision, 0);
});

test("official Standard loadout accepts six implemented catalogued UI cards and excludes the experimental loan", () => {
  const root = fixture();
  const official = { A: { color: ["colorPrism", "colorChoiceBorrow"], area: ["areaHalfShift", "areaResize"], disrupt: ["disruptChoiceOne", "disruptRandomOne"] }, B: { color: ["colorPrism", "colorChoiceBorrow"], area: ["areaHalfShift", "areaResize"], disrupt: ["disruptChoiceOne", "disruptRandomOne"] } };
  for (const skillId of Object.values(official.A).flat()) root.profiles.playerA.inventory[skillId] = 1;
  const quote = start.quoteStandardMatchStart(args(root, { ruleSetId: start.RULE_SET_IDS.STANDARD, loadouts: official }));
  assert.equal(quote.code, "READY");
  assert.deepEqual(Object.keys(quote.reservations.playerA).sort(), Object.values(official.A).flat().sort());
  assert.equal(Object.hasOwn(quote.sources.A, "legalRecolor"), false);
});

test("every one of the 19 canonical cards can start inside a formal six-card Standard loadout", () => {
  const canonical = Object.entries(STANDARD_SKILLS).filter(([, definition]) => definition.v49Catalogued);
  assert.equal(canonical.length, 19);
  for (const [index, [skillId, definition]] of canonical.entries()) {
    const loadout = Object.fromEntries(["color", "area", "disrupt"].map((category) => {
      const ids = canonical.filter(([, entry]) => entry.category === category).map(([id]) => id);
      return [category, category === definition.category ? [skillId, ids.find((id) => id !== skillId)] : ids.slice(0, 2)];
    }));
    const root = fixture();
    for (const profile of Object.values(root.profiles)) for (const id of Object.values(loadout).flat()) profile.inventory[id] = 1;
    const result = start.startStandardMatch(args(root, {
      operationId: `all-cards-start-${index}`,
      matchId: `all-cards-match-${index}`,
      ruleSetId: start.RULE_SET_IDS.STANDARD,
      participants: { A: { type: "PROFILE", profileId: "playerA" }, B: { type: "PROFILE", profileId: "playerB" } },
      loadouts: { A: loadout, B: loadout },
    }));
    assert.equal(result.code, "STARTED", skillId);
    assert.equal(result.root.activeMatch.state.hands.A[skillId], 1, skillId);
  }
});

test("same seed and payload create identical initial state and root RNG snapshots", () => {
  const left = start.startStandardMatch(args(fixture(), { storageAdapter: { setItem() {} } }));
  const right = start.startStandardMatch(args(fixture(), { storageAdapter: { setItem() {} } }));
  assert.equal(left.receipt.initialStateHash, right.receipt.initialStateHash);
  assert.deepEqual(left.root.activeMatch.state, right.root.activeMatch.state);
  assert.deepEqual(left.root.rngSnapshot, right.root.rngSnapshot);
});

test("current root rejects reservations that are not backed by an active inventory-backed hand", () => {
  const committed = start.startStandardMatch(args(fixture()));
  const invalid = JSON.parse(JSON.stringify(committed.root));
  invalid.reservations.playerA.legalRecolor = 1;
  invalid.profiles.playerA.inventory.legalRecolor = 1;
  assert.throws(() => save.validateStandardSave(invalid), /LOADOUT_RESERVATION_MISMATCH/);
});
