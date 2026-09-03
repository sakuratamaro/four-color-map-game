"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const { settleQuizReward } = require("../standard/standard-quiz-transaction.js");

function fixture() {
  const streams = engine.createRngDomains(7331, match.REQUIRED_RNG_STREAMS);
  return save.createStandardSave({
    profiles: { playerA: save.createProfile({ name: "Alice" }), playerB: save.createProfile({ name: "Bob" }) },
    rngSnapshot: engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS),
  });
}

function args(root, overrides = {}) {
  return {
    root,
    expectedRootRevision: root.rootRevision,
    operationId: "quiz-settle-1",
    quizSessionId: "quiz-session-1",
    profileId: "playerA",
    result: { correct: 7, wrong: 3, bestStreak: 4, selectedLevel: 4 },
    clock: { now: () => "2026-09-01T10:30:00.000Z" },
    storageAdapter: { setItem() {} },
    ...overrides,
  };
}

test("quiz settlement atomically records the result, adds difficulty-bearing tickets, and writes once", () => {
  const root = fixture();
  const writes = [];
  const settled = settleQuizReward(args(root, { storageAdapter: { setItem(key, value) { writes.push([key, value]); } } }));
  assert.equal(settled.code, "SETTLED");
  assert.equal(settled.root.rootRevision, 1);
  assert.equal(settled.root.profiles.playerA.gachaTickets[4], 3);
  assert.deepEqual(settled.root.profiles.playerA.quizRecords[4], { attempts: 1, bestCorrect: 7, bestStreak: 4, lastCorrect: 7, lastWrong: 3, lastCompletedAt: "2026-09-01T10:30:00.000Z" });
  assert.equal(settled.receipt.ticketLevel, 4);
  assert.equal(settled.receipt.ticketCount, 3);
  assert.equal(Object.keys(settled.root.receipts.quizSettlement).length, 1);
  assert.equal(writes.length, 1);
  assert.deepEqual(save.decodeStandardSave(writes[0][1]), settled.root);
  assert.deepEqual(root.profiles.playerA.gachaTickets, {});
});

test("same quiz settlement replays without clock or storage and changed facts conflict", () => {
  const committed = settleQuizReward(args(fixture()));
  const replay = settleQuizReward(args(committed.root, {
    expectedRootRevision: 0,
    clock: { now() { throw new Error("clock must not run"); } },
    storageAdapter: { setItem() { throw new Error("storage must not run"); } },
  }));
  assert.equal(replay.code, "ALREADY_SETTLED");
  assert.equal(replay.root, committed.root);
  assert.equal(settleQuizReward(args(committed.root, { result: { correct: 8, wrong: 2, bestStreak: 4, selectedLevel: 4 } })).code, "QUIZ_SETTLEMENT_CONFLICT");
  assert.equal(settleQuizReward(args(committed.root, { quizSessionId: "quiz-session-2" })).code, "IDEMPOTENCY_KEY_REUSE");
});

test("invalid, stale, and failed quiz settlements preserve root and award nothing", () => {
  const root = fixture();
  assert.equal(settleQuizReward(args(root, { result: { correct: 6, wrong: 2, bestStreak: 4, selectedLevel: 4 } })).code, "INVALID_QUIZ_RESULT");
  assert.equal(settleQuizReward(args(root, { expectedRootRevision: 7 })).code, "STALE_ROOT_REVISION");
  let attempts = 0;
  const retryingStorage = { setItem() { attempts += 1; if (attempts === 1) throw new Error("quota"); } };
  const failed = settleQuizReward(args(root, { storageAdapter: retryingStorage }));
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(failed.root, root);
  assert.equal(root.rootRevision, 0);
  assert.deepEqual(root.profiles.playerA.gachaTickets, {});
  assert.deepEqual(root.receipts.quizSettlement, {});
  const retried = settleQuizReward(args(root, { storageAdapter: retryingStorage }));
  assert.equal(retried.code, "SETTLED");
  assert.equal(attempts, 2);
});

test("repeated attempts preserve bests while updating last result and accumulating tickets", () => {
  const first = settleQuizReward(args(fixture()));
  const second = settleQuizReward(args(first.root, {
    operationId: "quiz-settle-2",
    quizSessionId: "quiz-session-2",
    result: { correct: 2, wrong: 3, bestStreak: 2, selectedLevel: 4 },
    clock: { now: () => "2026-09-01T10:31:00.000Z" },
  }));
  assert.equal(second.root.profiles.playerA.gachaTickets[4], 3);
  assert.equal(second.root.profiles.playerA.gachaTickets[3], 1);
  assert.deepEqual(second.root.profiles.playerA.quizRecords[4], { attempts: 2, bestCorrect: 7, bestStreak: 4, lastCorrect: 2, lastWrong: 3, lastCompletedAt: "2026-09-01T10:31:00.000Z" });
});

test("save validation rejects a quiz receipt whose ticket award differs from policy", () => {
  const committed = settleQuizReward(args(fixture()));
  const forged = JSON.parse(JSON.stringify(committed.root));
  forged.receipts.quizSettlement["quiz-session-1"].ticketCount = 9;
  assert.throws(() => save.validateStandardSave(forged), /INVALID_QUIZ_SETTLEMENT_RECEIPT/);
});
