"use strict";

const match = require("../standard/standard-match.js");

const SETTLEMENT_STATES = Object.freeze(["PENDING", "FAILED", "SETTLED"]);
const TROPHY_LABELS = Object.freeze({
  fullPaint: "完塗り達成",
  fullPaint3: "完塗り3回達成",
  noSkillFullPaint: "スキルなし完塗り",
});

const TERMINAL_PRESENTATION_MAPPINGS = Object.freeze({
  ILLEGAL_COLOR: Object.freeze({ headline: "接色違反！", reason: (loser) => `${loser} が接色禁止に違反しました。` }),
  BOARD_LOCK: Object.freeze({
    headline: (mapCompleteWin) => mapCompleteWin === true ? "完塗り勝利！" : "盤面封鎖！",
    reason: (_loser, mapCompleteWin) => mapCompleteWin === true ? "盤面をすべて塗り切りました。" : "これ以上エリアを作れません。",
  }),
  SURRENDER: Object.freeze({ headline: (winner) => `${winner} の勝利`, reason: (loser) => `${loser} が投了しました。` }),
  SEALED_OUT: Object.freeze({ headline: "色封じによる詰み！", reason: (loser) => `${loser} は使える色がありません。` }),
  NO_LEGAL_COLOR: Object.freeze({ headline: "詰み！", reason: (loser) => `${loser} は塗れる色がありません。` }),
});

const mappedReasons = Object.keys(TERMINAL_PRESENTATION_MAPPINGS);
if (match.TERMINAL_REASONS.some((reason) => !mappedReasons.includes(reason)) || mappedReasons.some((reason) => !match.TERMINAL_REASONS.includes(reason))) {
  throw new Error("TERMINAL_PRESENTATION_MAPPING_MISMATCH");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function seatName(participantSnapshots, seat) {
  const snapshot = participantSnapshots?.[seat];
  return typeof snapshot?.displayNameSnapshot === "string" && snapshot.displayNameSnapshot.length
    ? snapshot.displayNameSnapshot
    : `Player ${seat}`;
}

function publicStats(settlementSummary, winnerSeat) {
  const source = settlementSummary?.bySeat?.[winnerSeat] || settlementSummary?.stats?.[winnerSeat] || settlementSummary?.stats;
  if (!source || !Number.isSafeInteger(source.currentWinStreak) || !Number.isSafeInteger(source.bestWinStreak)) return null;
  if (source.currentWinStreak < 0 || source.bestWinStreak < 0) return null;
  return { currentWinStreak: source.currentWinStreak, bestWinStreak: source.bestWinStreak };
}

function publicTrophies(settlementSummary) {
  if (!Array.isArray(settlementSummary?.unlockedTrophies)) return [];
  const unique = new Map();
  for (const value of settlementSummary.unlockedTrophies) {
    const trophyId = typeof value === "string" ? value : value?.trophyId;
    const seat = typeof value === "object" && ["A", "B"].includes(value?.seat) ? value.seat : null;
    if (Object.hasOwn(TROPHY_LABELS, trophyId)) unique.set(`${seat || ""}:${trophyId}`, { ...(seat ? { seat } : {}), id: trophyId, label: TROPHY_LABELS[trophyId] });
  }
  return [...unique.values()];
}

function failure(settlementState, code = "UNKNOWN_TERMINAL_REASON") {
  return deepFreeze({
    ok: false,
    code,
    winnerSeat: null,
    loserSeat: null,
    winnerName: "",
    loserName: "",
    headline: "対戦は終了しました",
    resultText: "",
    reasonText: "結果の詳細を表示できません。",
    settlementState: SETTLEMENT_STATES.includes(settlementState) ? settlementState : "PENDING",
    settlementText: "戦績の状態を確認できません。",
    mapCompleteWin: null,
    stats: null,
    unlockedTrophies: [],
  });
}

function buildTerminalPresentation({ publicResult, participantSnapshots, settlementStatus, settlementSummary } = {}) {
  if (!SETTLEMENT_STATES.includes(settlementStatus)) return failure("PENDING", "INVALID_SETTLEMENT_STATUS");
  const mapping = TERMINAL_PRESENTATION_MAPPINGS[publicResult?.terminalReason];
  if (!mapping || !["A", "B"].includes(publicResult?.winnerSeat)) return failure(settlementStatus);
  const winnerSeat = publicResult.winnerSeat;
  const loserSeat = winnerSeat === "A" ? "B" : "A";
  const winnerName = seatName(participantSnapshots, winnerSeat);
  const loserName = seatName(participantSnapshots, loserSeat);
  const mapCompleteWin = publicResult.terminalReason === "BOARD_LOCK" && publicResult.mapCompleteWin === true;
  const headline = typeof mapping.headline === "function"
    ? mapping.headline(publicResult.terminalReason === "SURRENDER" ? winnerName : mapCompleteWin)
    : mapping.headline;
  const reasonText = mapping.reason(loserName, mapCompleteWin);
  const settled = settlementStatus === "SETTLED";
  const settlementText = settlementStatus === "PENDING"
    ? "対戦結果は確定しました。戦績を保存しています。"
    : settlementStatus === "FAILED"
      ? "対戦は終了しましたが、戦績を保存できていません。"
      : "戦績を保存しました。";
  return deepFreeze({
    ok: true,
    code: "OK",
    winnerSeat,
    loserSeat,
    winnerName,
    loserName,
    headline,
    resultText: `${winnerName} の勝利`,
    reasonText,
    settlementState: settlementStatus,
    settlementText,
    mapCompleteWin: publicResult.terminalReason === "BOARD_LOCK" ? mapCompleteWin : false,
    stats: settled ? publicStats(settlementSummary, winnerSeat) : null,
    unlockedTrophies: settled ? publicTrophies(settlementSummary) : [],
  });
}

module.exports = { SETTLEMENT_STATES, TERMINAL_PRESENTATION_MAPPINGS, buildTerminalPresentation };
