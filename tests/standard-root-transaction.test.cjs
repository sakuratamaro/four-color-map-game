"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const tx = require("../standard/standard-root-transaction.js");

function fixture(inventory = { colorRandomBorrow: 5 }) {
  return save.createStandardSave({
    profiles: { playerA: save.createProfile({ name: "Player A", inventory }) },
    reservations: { playerA: { colorRandomBorrow: 2 } },
  });
}

function macroMicroCells(macro) {
  const macroRow = Math.floor(macro / 12);
  const macroCol = macro % 12;
  const cells = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) cells.push(((macroRow * 4) + row) * 48 + (macroCol * 4) + col);
  }
  return cells;
}

function settlementFixture({ cpu = false, fullPaint = false } = {}) {
  const streams = createRngDomains(4001, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({ matchId: cpu ? "cpu-final" : "pvp-final", firstSeat: "A" }, streams);
  state.status = "FINISHED";
  state.phase = "GAME_OVER";
  state.winner = "A";
  state.terminalReason = fullPaint ? "BOARD_LOCK" : "SURRENDER";
  state.version = 7;
  state.turn = 4;
  if (fullPaint) {
    state.regions = {};
    let index = 1;
    for (let row = 1; row <= 10; row += 1) for (let col = 1; col <= 10; col += 1) {
      const macro = row * 12 + col;
      const id = `R${index++}`;
      state.regions[id] = { id, sourceMacros: [macro], micro: macroMicroCells(macro), controllers: ["A"], color: "red", isPending: false };
    }
  }
  const profiles = { playerA: save.createProfile({ name: "Alice" }) };
  if (!cpu) profiles.playerB = save.createProfile({ name: "Bob" });
  const participants = cpu ? {
    A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "Alice" },
    B: { type: "CPU", difficulty: "normal", policyVersion: "standard-cpu-v1" },
  } : {
    A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "Alice" },
    B: { type: "PROFILE", profileId: "playerB", displayNameSnapshot: "Bob" },
  };
  return save.createStandardSave({ profiles, activeMatch: {
    state,
    rngSnapshot: {},
    participants,
    startedAt: "2026-08-30T00:00:00.000Z",
    finishedAt: null,
    settlement: { settled: false },
  }, reservations: Object.fromEntries(Object.values(participants).filter((participant) => participant.type === "PROFILE").map((participant) => [participant.profileId, {}])) });
}

test("standard save is one revisioned root with namespaced receipts", () => {
  const root = fixture();
  assert.equal(root.schemaVersion, 5);
  assert.equal(root.rootRevision, 0);
  assert.equal(root.economyVersion, "standard-alpha-economy-v1");
  assert.equal(root.profiles.playerA.profileId, "playerA");
  assert.equal(root.profiles.playerA.displayName, "Player A");
  assert.deepEqual(Object.keys(root.receipts), ["matchStart", "matchAction", "matchConsumption", "matchSettlement", "cardSale", "quizSettlement", "gachaDraw", "cosmeticAction"]);
});

test("card sale commits inventory, coins, receipt, and revision in one write", () => {
  const root = fixture();
  const writes = [];
  const quote = tx.quoteCardSale({ root, profileId: "playerA", skillId: "colorRandomBorrow", quantity: 3 });
  assert.equal(quote.code, "CONFIRMATION_REQUIRED");
  assert.deepEqual(quote.quote.confirmationReasons, ["LAST_SELLABLE_COPY"]);
  const result = tx.commitCardSale({
    root,
    expectedRootRevision: 0,
    operationId: "sale-1",
    profileId: "playerA",
    skillId: "colorRandomBorrow",
    quantity: 3,
    acceptedConfirmationReasons: ["LAST_SELLABLE_COPY"],
    storage: { setItem(key, value) { writes.push([key, value]); } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.root.rootRevision, 1);
  assert.equal(result.root.profiles.playerA.inventory.colorRandomBorrow, 2);
  assert.equal(result.root.profiles.playerA.coins, 30);
  assert.equal(result.receipt.economyVersion, "standard-alpha-economy-v1");
  assert.equal(result.receipt.rarity, 1);
  assert.equal(result.receipt.unitPrice, 10);
  assert.equal(result.receipt.quantity, 3);
  assert.equal(result.receipt.totalCoins, 30);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "fourColorMapGame.standard.v5.save");
  assert.deepEqual(save.decodeStandardSave(writes[0][1]), result.root);
  assert.equal(root.profiles.playerA.inventory.colorRandomBorrow, 5);
});

test("card sale replay is idempotent and changed payload is rejected", () => {
  const root = fixture({ colorRandomBorrow: 4 });
  const args = {
    root,
    expectedRootRevision: 0,
    operationId: "sale-replay",
    profileId: "playerA",
    skillId: "colorRandomBorrow",
    quantity: 2,
    acceptedConfirmationReasons: ["LAST_SELLABLE_COPY"],
    storage: { setItem() {} },
  };
  const committed = tx.commitCardSale(args);
  assert.equal(committed.ok, true);
  const replay = tx.commitCardSale({ ...args, root: committed.root, expectedRootRevision: 1, storage: { setItem() { throw new Error("must not write"); } } });
  assert.equal(replay.code, "IDEMPOTENT_REPLAY");
  assert.equal(replay.root, committed.root);
  const collision = tx.commitCardSale({ ...args, root: committed.root, expectedRootRevision: 1, quantity: 1 });
  assert.equal(collision.code, "IDEMPOTENCY_KEY_REUSE");
});

test("revision conflict, missing confirmation, and persistence failure preserve root", () => {
  const root = fixture({ colorRandomBorrow: 4 });
  const base = { root, operationId: "sale-fail", profileId: "playerA", skillId: "colorRandomBorrow", quantity: 2, acceptedConfirmationReasons: ["LAST_SELLABLE_COPY"] };
  assert.equal(tx.commitCardSale({ ...base, expectedRootRevision: 9, storage: { setItem() {} } }).code, "ROOT_REVISION_CONFLICT");
  assert.equal(tx.commitCardSale({ ...base, expectedRootRevision: 0, acceptedConfirmationReasons: [], storage: { setItem() {} } }).code, "CONFIRMATION_REQUIRED");
  const failed = tx.commitCardSale({ ...base, expectedRootRevision: 0, storage: { setItem() { throw new Error("quota"); } } });
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(failed.root, root);
  assert.equal(root.rootRevision, 0);
  assert.equal(root.profiles.playerA.inventory.colorRandomBorrow, 4);
  assert.equal(root.profiles.playerA.coins, 0);
  assert.equal(Object.keys(root.receipts.cardSale).length, 0);
});

test("malformed sale receipts and reservation overflow are rejected by root validation", () => {
  const invalidReceipt = JSON.parse(JSON.stringify(fixture()));
  invalidReceipt.receipts.cardSale["playerA:sale-x"] = { scope: "cardSale", totalCoins: -1 };
  assert.throws(() => save.validateStandardSave(invalidReceipt), /INVALID_CARD_SALE_RECEIPT/);
  const invalidReservation = JSON.parse(JSON.stringify(fixture()));
  invalidReservation.reservations.playerA.colorRandomBorrow = 99;
  assert.throws(() => save.validateStandardSave(invalidReservation), /RESERVATION_EXCEEDS_INVENTORY/);
});

test("completed PvP match settles both profiles atomically and replays by match id", () => {
  const root = settlementFixture();
  const writes = [];
  const result = tx.settleCompletedMatch({ root, expectedRootRevision: 0, operationId: "settle-1", matchId: "pvp-final", clock: { now: () => "2026-08-30T00:10:00.000Z" }, storageAdapter: { setItem(key, value) { writes.push([key, value]); } } });
  assert.equal(result.status, "SETTLED");
  assert.equal(result.root.rootRevision, 1);
  assert.equal(result.root.profiles.playerA.stats.wins, 1);
  assert.equal(result.root.profiles.playerA.stats.currentWinStreak, 1);
  assert.equal(result.root.profiles.playerB.stats.losses, 1);
  assert.equal(result.root.profiles.playerB.stats.currentWinStreak, 0);
  assert.equal(result.root.profiles.playerA.matchHistory[0].opponentProfileId, "playerB");
  assert.equal(result.root.profiles.playerA.matchHistory[0].displayNameSnapshot, "Alice");
  assert.equal(result.root.activeMatch.settlement.settled, true);
  assert.equal(writes.length, 1);
  const replay = tx.settleCompletedMatch({ root: result.root, expectedRootRevision: 0, operationId: "settle-retry", matchId: "pvp-final", clock: { now() { throw new Error("must not read clock"); } }, storageAdapter: { setItem() { throw new Error("must not write"); } } });
  assert.equal(replay.status, "ALREADY_SETTLED");
  assert.equal(replay.root, result.root);
  assert.equal(replay.rootRevision, 1);
});

test("CPU settlement updates only the human profile and derives full-paint trophies", () => {
  const root = settlementFixture({ cpu: true, fullPaint: true });
  const result = tx.settleCompletedMatch({ root, expectedRootRevision: 0, operationId: "settle-cpu", matchId: "cpu-final", clock: { now: () => "2026-08-30T00:20:00.000Z" }, storageAdapter: { setItem() {} } });
  assert.equal(result.status, "SETTLED");
  assert.deepEqual(Object.keys(result.root.profiles), ["playerA"]);
  assert.equal(result.root.profiles.playerA.stats.fullPaints, 1);
  assert.equal(result.root.profiles.playerA.trophies.fullPaint, true);
  assert.equal(result.root.profiles.playerA.trophies.noSkillFullPaint, true);
  assert.equal(result.root.profiles.playerA.matchHistory[0].opponentType, "CPU");
  assert.equal(result.root.profiles.playerA.matchHistory[0].cpuDifficulty, "normal");
  assert.equal(result.root.profiles.playerA.matchHistory[0].mapComplete, true);
});

test("settlement rejects stale, unfinished, conflicting, reused, and failed persistence paths", () => {
  const root = settlementFixture();
  const base = { root, operationId: "settle-gate", matchId: "pvp-final", clock: { now: () => "2026-08-30T00:30:00.000Z" } };
  assert.equal(tx.settleCompletedMatch({ ...base, expectedRootRevision: 9, storageAdapter: { setItem() {} } }).code, "STALE_ROOT_REVISION");
  const unfinished = JSON.parse(JSON.stringify(root));
  unfinished.activeMatch.state.status = "ACTIVE";
  unfinished.activeMatch.state.phase = "WORK";
  unfinished.activeMatch.state.winner = null;
  unfinished.activeMatch.state.terminalReason = null;
  assert.equal(tx.settleCompletedMatch({ ...base, root: unfinished, expectedRootRevision: 0, storageAdapter: { setItem() {} } }).code, "MATCH_NOT_COMPLETE");
  const failed = tx.settleCompletedMatch({ ...base, expectedRootRevision: 0, storageAdapter: { setItem() { throw new Error("quota"); } } });
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(failed.root, root);
  const reservationMismatch = JSON.parse(JSON.stringify(root));
  reservationMismatch.reservations.playerA.colorRandomBorrow = 1;
  reservationMismatch.profiles.playerA.inventory.colorRandomBorrow = 1;
  assert.equal(tx.settleCompletedMatch({ ...base, root: reservationMismatch, expectedRootRevision: 0, storageAdapter: { setItem() {} } }).code, "RESERVATION_HAND_MISMATCH");
  const committed = tx.settleCompletedMatch({ ...base, expectedRootRevision: 0, storageAdapter: { setItem() {} } });
  const conflict = JSON.parse(JSON.stringify(committed.root));
  conflict.activeMatch.state.winner = "B";
  assert.equal(tx.settleCompletedMatch({ ...base, root: conflict, expectedRootRevision: 1, storageAdapter: { setItem() {} } }).code, "SETTLEMENT_CONFLICT");
  const reused = JSON.parse(JSON.stringify(committed.root));
  reused.activeMatch.state.matchId = "another-match";
  reused.activeMatch.settlement = { settled: false };
  assert.equal(tx.settleCompletedMatch({ ...base, root: reused, expectedRootRevision: 1, matchId: "another-match", storageAdapter: { setItem() {} } }).code, "IDEMPOTENCY_KEY_REUSE");
});

test("explicit v2-to-v3-to-v4-to-v5 migration preserves data and marks legacy history", () => {
  const current = fixture();
  const v2 = JSON.parse(JSON.stringify(current));
  v2.schemaVersion = 2;
  v2.receipts.matchSettlement = {};
  const migrated = save.decodeStandardSave(JSON.stringify(v2));
  assert.equal(migrated.schemaVersion, 5);
  assert.deepEqual(migrated.receipts.matchStart, { byMatchId: {}, operationIndex: {} });
  assert.deepEqual(migrated.receipts.matchAction, {});
  assert.deepEqual(migrated.receipts.matchSettlement, { byMatchId: {}, operationIndex: {} });
  assert.equal(migrated.rootRevision, current.rootRevision);
  assert.equal(migrated.profiles.playerA.inventory.colorRandomBorrow, 5);
  assert.throws(() => save.decodeStandardSave(JSON.stringify({ ...v2, schemaVersion: 99 })), /INVALID_SAVE_SCHEMA/);
});

test("explicit v3-to-v4-to-v5 migration adds match-start, match-action, and root RNG state", () => {
  const current = fixture();
  const v3 = JSON.parse(JSON.stringify(current));
  v3.schemaVersion = 3;
  delete v3.receipts.matchStart;
  delete v3.rngSnapshot;
  const migrated = save.decodeStandardSave(JSON.stringify(v3));
  assert.equal(migrated.schemaVersion, 5);
  assert.deepEqual(migrated.receipts.matchStart, { byMatchId: {}, operationIndex: {} });
  assert.deepEqual(migrated.receipts.matchAction, {});
  assert.deepEqual(migrated.rngSnapshot, {});
});

test("explicit v4-to-v5 migration adds persistent action receipts without inferring actions", () => {
  const current = settlementFixture();
  const v4 = JSON.parse(JSON.stringify(current));
  v4.schemaVersion = 4;
  delete v4.receipts.matchAction;
  const migrated = save.decodeStandardSave(JSON.stringify(v4));
  assert.equal(migrated.schemaVersion, 5);
  assert.deepEqual(migrated.receipts.matchAction, {});
  assert.equal(migrated.rootRevision, current.rootRevision);
  assert.deepEqual(migrated.profiles, current.profiles);
  assert.deepEqual(migrated.activeMatch, current.activeMatch);
  assert.deepEqual(migrated.reservations, current.reservations);
  for (const namespace of ["matchStart", "matchConsumption", "matchSettlement", "cardSale", "quizSettlement", "gachaDraw"]) {
    assert.deepEqual(migrated.receipts[namespace], current.receipts[namespace]);
  }
});

test("v2 active-match migration creates immutable profile participants and requires a safe restart", () => {
  const current = settlementFixture();
  const v2 = JSON.parse(JSON.stringify(current));
  v2.schemaVersion = 2;
  v2.receipts.matchSettlement = {};
  v2.activeMatch.profileBySeat = { A: "playerA", B: "playerB" };
  delete v2.activeMatch.participants;
  delete v2.activeMatch.startedAt;
  delete v2.activeMatch.finishedAt;
  delete v2.activeMatch.settlement;
  const migrated = save.decodeStandardSave(JSON.stringify(v2));
  assert.deepEqual(migrated.activeMatch.participants, {
    A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "Alice" },
    B: { type: "PROFILE", profileId: "playerB", displayNameSnapshot: "Bob" },
  });
  assert.equal(migrated.activeMatch.startedAt, null);
  assert.equal(tx.settleCompletedMatch({ root: migrated, expectedRootRevision: 0, operationId: "legacy-settle", matchId: "pvp-final", clock: { now: () => "2026-08-30T00:40:00.000Z" }, storageAdapter: { setItem() {} } }).code, "MISSING_STARTED_AT");
});
