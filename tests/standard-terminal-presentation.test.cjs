"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const match = require("../standard/standard-match.js");
const rootTransaction = require("../standard/standard-root-transaction.js");
const save = require("../standard/standard-save.js");
const presentation = require("../standard-v5/terminal-presentation.js");

const snapshots = Object.freeze({
  A: Object.freeze({ type: "PROFILE", displayNameSnapshot: "開始時A" }),
  B: Object.freeze({ type: "PROFILE", displayNameSnapshot: "開始時B" }),
});
const sorted = (value) => [...value].sort();

function build(terminalReason, overrides = {}) {
  return presentation.buildTerminalPresentation({
    publicResult: { matchId: "match-terminal-1", finalMatchVersion: 8, winnerSeat: "B", terminalReason, mapCompleteWin: false, ...overrides.publicResult },
    participantSnapshots: snapshots,
    settlementStatus: overrides.settlementStatus || "SETTLED",
    settlementSummary: overrides.settlementSummary,
  });
}

test("all terminal allowlists and presentation mappings are exactly equal", () => {
  const expected = sorted(match.TERMINAL_REASONS);
  for (const values of [match.ENGINE_TERMINAL_REASONS, match.FINISHED_STATE_TERMINAL_REASONS, rootTransaction.SETTLEMENT_TERMINAL_REASONS, save.RECEIPT_TERMINAL_REASONS, Object.keys(presentation.TERMINAL_PRESENTATION_MAPPINGS)]) {
    assert.deepEqual(sorted(values), expected);
  }
  assert.equal(expected.includes("MAP_COMPLETE"), false);
});

test("the five mappings use match-start snapshot names and public-safe copy", () => {
  const cases = {
    ILLEGAL_COLOR: ["接色違反！", "開始時A が接色禁止に違反しました。"],
    BOARD_LOCK: ["盤面封鎖！", "これ以上エリアを作れません。"],
    SURRENDER: ["開始時B の勝利", "開始時A が投了しました。"],
    SEALED_OUT: ["色封じによる詰み！", "開始時A は使える色がありません。"],
    NO_LEGAL_COLOR: ["詰み！", "開始時A は塗れる色がありません。"],
  };
  for (const [reason, [headline, reasonText]] of Object.entries(cases)) {
    const result = build(reason);
    assert.equal(result.ok, true);
    assert.equal(result.headline, headline);
    assert.equal(result.resultText, "開始時B の勝利");
    assert.equal(result.reasonText, reasonText);
    assert.equal(JSON.stringify(result).includes(reason), false);
    assert.equal(Object.isFrozen(result), true);
  }
});

test("BOARD_LOCK only claims complete paint from the public derived fact", () => {
  const complete = build("BOARD_LOCK", { publicResult: { mapCompleteWin: true } });
  assert.equal(complete.headline, "完塗り勝利！");
  assert.equal(complete.reasonText, "盤面をすべて塗り切りました。");
  assert.equal(complete.mapCompleteWin, true);
  assert.equal(build("BOARD_LOCK").mapCompleteWin, false);
  for (const reason of match.TERMINAL_REASONS.filter((value) => value !== "BOARD_LOCK")) {
    assert.equal(build(reason, { publicResult: { mapCompleteWin: true } }).mapCompleteWin, false);
  }
});

test("PENDING and FAILED never predict stats or trophy unlocks", () => {
  const settlementSummary = { stats: { currentWinStreak: 7, bestWinStreak: 11 }, unlockedTrophies: ["fullPaint"] };
  const pending = build("SURRENDER", { settlementStatus: "PENDING", settlementSummary });
  const failed = build("SURRENDER", { settlementStatus: "FAILED", settlementSummary });
  for (const result of [pending, failed]) {
    assert.equal(result.stats, null);
    assert.deepEqual(result.unlockedTrophies, []);
  }
  assert.match(pending.settlementText, /保存しています/);
  assert.match(failed.settlementText, /保存できていません/);
});

test("SETTLED copies only declared public summary fields", () => {
  const result = build("BOARD_LOCK", {
    publicResult: { mapCompleteWin: true },
    settlementSummary: {
      stats: { currentWinStreak: 2, bestWinStreak: 5, wins: 99, hand: { x: 1 } },
      unlockedTrophies: ["fullPaint", "unknown", "fullPaint"],
      privateEffects: { A: { prism: true } },
    },
  });
  assert.deepEqual(result.stats, { currentWinStreak: 2, bestWinStreak: 5 });
  assert.deepEqual(result.unlockedTrophies, [{ id: "fullPaint", label: "完塗り達成" }]);
  const encoded = JSON.stringify(result);
  for (const forbidden of ["palette", "basicPalettes", "bonusColor", "bonusUsesRemaining", "hand", "privateState", "privateEffects", "rngSnapshot", "authoritativeState", "loadout", "wins"]) assert.equal(encoded.includes(forbidden), false, forbidden);
});

test("unknown reasons and invalid settlement status fail closed without echo", () => {
  const hostile = build("<img src=x onerror=alert(1)>");
  assert.equal(hostile.ok, false);
  assert.equal(hostile.code, "UNKNOWN_TERMINAL_REASON");
  assert.equal(JSON.stringify(hostile).includes("img"), false);
  const invalid = presentation.buildTerminalPresentation({ publicResult: { winnerSeat: "A", terminalReason: "SURRENDER" }, participantSnapshots: snapshots, settlementStatus: "DONE" });
  assert.equal(invalid.code, "INVALID_SETTLEMENT_STATUS");
  assert.equal(invalid.settlementState, "PENDING");
});

test("hostile snapshot names remain plain text and current profile-shaped input is ignored", () => {
  const result = presentation.buildTerminalPresentation({
    publicResult: { winnerSeat: "B", terminalReason: "SURRENDER" },
    participantSnapshots: {
      A: { displayNameSnapshot: '<img src=x onerror=alert(1)>', displayName: "現在A" },
      B: { displayNameSnapshot: '\"><svg onload=alert(1)>', displayName: "現在B" },
    },
    settlementStatus: "SETTLED",
  });
  assert.equal(result.winnerName, '\"><svg onload=alert(1)>');
  assert.equal(result.loserName, '<img src=x onerror=alert(1)>');
  assert.equal(result.resultText.includes("現在B"), false);
  assert.equal(typeof result.headline, "string");
  assert.equal(Object.values(result).some((value) => value && typeof value === "object" && "nodeType" in value), false);
});
