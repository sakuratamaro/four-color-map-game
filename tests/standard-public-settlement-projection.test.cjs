"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const tx = require("../standard/standard-root-transaction.js");
const { projectPublicSettlementSummary } = require("../standard/standard-local-session.js");
const { buildTerminalPresentation } = require("../standard-v5/terminal-presentation.js");

const settledAt = "2026-08-31T07:10:00.000Z";

function macroMicroCells(macro) {
  const macroRow = Math.floor(macro / 12);
  const macroCol = macro % 12;
  const cells = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) cells.push(((macroRow * 4) + row) * 48 + (macroCol * 4) + col);
  }
  return cells;
}

function terminalRoot({ fullPaint = false } = {}) {
  const streams = createRngDomains(9201, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({ matchId: "public-summary-match", firstSeat: "A" }, streams);
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
  return save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "開始時Alice" }),
      playerB: save.createProfile({ name: "開始時Bob" }),
    },
    reservations: { playerA: {}, playerB: {} },
    activeMatch: {
      state,
      rngSnapshot: {},
      participants: {
        A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "開始時Alice" },
        B: { type: "PROFILE", profileId: "playerB", displayNameSnapshot: "開始時Bob" },
      },
      startedAt: "2026-08-31T07:00:00.000Z",
      finishedAt: null,
      settlement: { settled: false },
    },
  });
}

function settle(root) {
  const result = tx.settleCompletedMatch({
    root,
    expectedRootRevision: root.rootRevision,
    operationId: "public-summary-match",
    matchId: "public-summary-match",
    clock: { now: () => settledAt },
    storageAdapter: { setItem() {} },
  });
  assert.equal(result.ok, true);
  return result.root;
}

test("PENDING and FAILED summaries disclose no stats, trophies, or receipt fields", () => {
  const root = terminalRoot();
  assert.deepEqual(projectPublicSettlementSummary({ root, matchId: "public-summary-match" }), { status: "PENDING" });
  assert.deepEqual(projectPublicSettlementSummary({ root, matchId: "public-summary-match", failureCode: "PERSISTENCE_FAILED" }), { status: "FAILED", code: "PERSISTENCE_FAILED" });
  const normalized = projectPublicSettlementSummary({ root, matchId: "public-summary-match", failureCode: "STALE_ROOT_REVISION" });
  assert.deepEqual(normalized, { status: "FAILED", code: "SETTLEMENT_FAILED" });
  for (const summary of [projectPublicSettlementSummary({ root, matchId: "public-summary-match" }), normalized]) {
    const encoded = JSON.stringify(summary);
    for (const key of ["stats", "troph", "receipt", "profileId", "operationId", "rootRevision"]) assert.equal(encoded.includes(key), false, key);
  }
});

test("SETTLED summary exposes only validated per-seat public results and stats", () => {
  const root = settle(terminalRoot());
  const summary = projectPublicSettlementSummary({ root, matchId: "public-summary-match" });
  assert.deepEqual(summary, {
    status: "SETTLED",
    bySeat: {
      A: { result: "WIN", wins: 1, losses: 0, currentWinStreak: 1, bestWinStreak: 1 },
      B: { result: "LOSS", wins: 0, losses: 1, currentWinStreak: 0, bestWinStreak: 0 },
    },
    unlockedTrophies: [],
  });
  assert.equal(Object.isFrozen(summary), true);
  assert.equal(Object.isFrozen(summary.bySeat.A), true);
  const encoded = JSON.stringify(summary);
  for (const key of ["profileId", "operationId", "resultFingerprint", "rootRevision", "receipts", "reservations", "palette", "bonus", "hand", "privateEffects", "rngSnapshot", "loadout"]) assert.equal(encoded.includes(key), false, key);
});

test("multiple newly unlocked trophies come only from the settled existing root", () => {
  const root = settle(terminalRoot({ fullPaint: true }));
  const summary = projectPublicSettlementSummary({ root, matchId: "public-summary-match" });
  assert.deepEqual(summary.unlockedTrophies, [
    { seat: "A", trophyId: "fullPaint" },
    { seat: "A", trophyId: "noSkillFullPaint" },
  ]);
  const view = buildTerminalPresentation({
    publicResult: { winnerSeat: "A", terminalReason: "BOARD_LOCK", mapCompleteWin: true },
    participantSnapshots: root.activeMatch.participants,
    settlementStatus: summary.status,
    settlementSummary: summary,
  });
  assert.deepEqual(view.stats, { currentWinStreak: 1, bestWinStreak: 1 });
  assert.deepEqual(view.unlockedTrophies, [
    { seat: "A", id: "fullPaint", label: "完塗り達成" },
    { seat: "A", id: "noSkillFullPaint", label: "スキルなし完塗り" },
  ]);
});

test("unsafe, negative, and inconsistent receipt values fail closed", () => {
  const base = settle(terminalRoot());
  for (const value of [-1, Number.MAX_SAFE_INTEGER + 1]) {
    const root = JSON.parse(JSON.stringify(base));
    root.receipts.matchSettlement.byMatchId["public-summary-match"].profileResults.playerA.stats.currentWinStreak = value;
    assert.deepEqual(projectPublicSettlementSummary({ root, matchId: "public-summary-match" }), { status: "FAILED", code: "INVALID_SETTLEMENT_SUMMARY" });
  }
  const mismatch = JSON.parse(JSON.stringify(base));
  mismatch.receipts.matchSettlement.byMatchId["public-summary-match"].profileResults.playerA.result = "LOSS";
  assert.deepEqual(projectPublicSettlementSummary({ root: mismatch, matchId: "public-summary-match" }), { status: "FAILED", code: "INVALID_SETTLEMENT_SUMMARY" });
});

test("wrong match and unfinished roots fail closed without synthesizing values", () => {
  assert.deepEqual(projectPublicSettlementSummary({ root: terminalRoot(), matchId: "other-match" }), { status: "FAILED", code: "INVALID_SETTLEMENT_SUMMARY" });
  const unfinished = terminalRoot();
  unfinished.activeMatch.state.status = "ACTIVE";
  unfinished.activeMatch.state.phase = "WORK";
  unfinished.activeMatch.state.winner = null;
  unfinished.activeMatch.state.terminalReason = null;
  assert.deepEqual(projectPublicSettlementSummary({ root: unfinished, matchId: "public-summary-match" }), { status: "FAILED", code: "INVALID_SETTLEMENT_SUMMARY" });
});
