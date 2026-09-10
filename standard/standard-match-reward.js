"use strict";

const ECONOMY_VERSION = "standard-match-reward-v2";
const PVP_REWARD_WINDOW_MS = 60 * 60 * 1000;
const PVP_REWARD_LIMIT = 10;

const CPU_REWARD_BANDS = Object.freeze({
  yuzu: Object.freeze({ ticketLevel: 1, ticketCount: 2, band: "BEGINNER" }),
  ren: Object.freeze({ ticketLevel: 2, ticketCount: 1, band: "STANDARD" }),
  minato: Object.freeze({ ticketLevel: 2, ticketCount: 1, band: "STANDARD" }),
  koharu: Object.freeze({ ticketLevel: 2, ticketCount: 1, band: "STANDARD" }),
  aoi: Object.freeze({ ticketLevel: 2, ticketCount: 1, band: "STANDARD" }),
  kai: Object.freeze({ ticketLevel: 2, ticketCount: 1, band: "STANDARD" }),
  tsubasa: Object.freeze({ ticketLevel: 2, ticketCount: 2, band: "ADVANCED" }),
  shion: Object.freeze({ ticketLevel: 2, ticketCount: 2, band: "ADVANCED" }),
  rei: Object.freeze({ ticketLevel: 2, ticketCount: 2, band: "ADVANCED" }),
  kurogane: Object.freeze({ ticketLevel: 3, ticketCount: 2, band: "MASTER" }),
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function rewardError(code) {
  throw Object.assign(new Error(code), { code });
}

function isFiniteDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateMatchReward(reward) {
  if (!reward || typeof reward !== "object" || Array.isArray(reward)) rewardError("INVALID_MATCH_REWARD");
  if (reward.economyVersion !== ECONOMY_VERSION || !["pvp", "cpu"].includes(reward.mode)
      || typeof reward.awarded !== "boolean" || typeof reward.reason !== "string") rewardError("INVALID_MATCH_REWARD");
  if (reward.awarded) {
    if (!Number.isSafeInteger(reward.ticketLevel) || reward.ticketLevel < 1 || reward.ticketLevel > 5
        || !Number.isSafeInteger(reward.ticketCount) || reward.ticketCount < 1 || reward.ticketCount > 2) rewardError("INVALID_MATCH_REWARD");
  } else if (reward.ticketLevel !== null || reward.ticketCount !== 0 || reward.reason !== "PVP_REWARD_LIMIT") {
    rewardError("INVALID_MATCH_REWARD");
  }
  if (reward.mode === "pvp") {
    if (!Number.isSafeInteger(reward.rewardedPvpMatchesInWindow)
        || reward.rewardedPvpMatchesInWindow < 0 || reward.rewardedPvpMatchesInWindow > PVP_REWARD_LIMIT) rewardError("INVALID_MATCH_REWARD");
    if (reward.cpuCharacterId !== null || reward.cpuBand !== null) rewardError("INVALID_MATCH_REWARD");
    if (reward.awarded) {
      const expected = reward.reason === "PVP_WIN" ? [2, 1] : reward.reason === "PVP_LOSS" ? [1, 1] : null;
      if (!expected || reward.ticketLevel !== expected[0] || reward.ticketCount !== expected[1]) rewardError("INVALID_MATCH_REWARD");
    }
  } else if (reward.rewardedPvpMatchesInWindow !== null || !Object.hasOwn(CPU_REWARD_BANDS, reward.cpuCharacterId)) {
    rewardError("INVALID_MATCH_REWARD");
  } else {
    const band = CPU_REWARD_BANDS[reward.cpuCharacterId];
    const won = reward.reason === `CPU_WIN_${band.band}`;
    const lost = reward.reason === "CPU_LOSS";
    if ((!won && !lost) || reward.cpuBand !== band.band
        || reward.ticketLevel !== (won ? band.ticketLevel : 1)
        || reward.ticketCount !== (won ? band.ticketCount : 1)) rewardError("INVALID_MATCH_REWARD");
  }
  return true;
}

function priorRewardedPvpMatches(profile, finishedAt, matchId) {
  const cutoff = Date.parse(finishedAt) - PVP_REWARD_WINDOW_MS;
  return (profile.matchHistory || []).filter((entry) => entry?.matchId !== matchId
    && entry?.matchReward?.economyVersion === ECONOMY_VERSION
    && entry.matchReward.mode === "pvp"
    && entry.matchReward.awarded === true
    && isFiniteDate(entry.endedAt)
    && Date.parse(entry.endedAt) > cutoff
    && Date.parse(entry.endedAt) <= Date.parse(finishedAt)).length;
}

function quoteMatchReward({ profile, matchId, won, opponentKind, cpuCharacterId = null, finishedAt }) {
  if (!profile || typeof profile !== "object" || !Array.isArray(profile.matchHistory)
      || typeof matchId !== "string" || !matchId || typeof won !== "boolean" || !isFiniteDate(finishedAt)) rewardError("INVALID_MATCH_REWARD_INPUT");
  if (opponentKind === "pvp") {
    const previous = priorRewardedPvpMatches(profile, finishedAt, matchId);
    const awarded = previous < PVP_REWARD_LIMIT;
    const reward = {
      economyVersion: ECONOMY_VERSION,
      mode: "pvp",
      awarded,
      ticketLevel: awarded ? (won ? 2 : 1) : null,
      ticketCount: awarded ? 1 : 0,
      reason: awarded ? (won ? "PVP_WIN" : "PVP_LOSS") : "PVP_REWARD_LIMIT",
      rewardedPvpMatchesInWindow: previous + (awarded ? 1 : 0),
      cpuCharacterId: null,
      cpuBand: null,
    };
    validateMatchReward(reward);
    return Object.freeze(reward);
  }
  if (opponentKind !== "cpu" || !Object.hasOwn(CPU_REWARD_BANDS, cpuCharacterId)) rewardError("INVALID_MATCH_REWARD_INPUT");
  const band = CPU_REWARD_BANDS[cpuCharacterId];
  const reward = {
    economyVersion: ECONOMY_VERSION,
    mode: "cpu",
    awarded: true,
    ticketLevel: won ? band.ticketLevel : 1,
    ticketCount: won ? band.ticketCount : 1,
    reason: won ? `CPU_WIN_${band.band}` : "CPU_LOSS",
    rewardedPvpMatchesInWindow: null,
    cpuCharacterId,
    cpuBand: band.band,
  };
  validateMatchReward(reward);
  return Object.freeze(reward);
}

function applyMatchReward({ profile, matchId, reward }) {
  validateMatchReward(reward);
  const next = clone(profile);
  const matches = next.matchHistory.filter((entry) => entry?.matchId === matchId);
  if (matches.length !== 1 || matches[0].matchReward !== undefined) rewardError("MATCH_REWARD_ALREADY_RECORDED");
  matches[0].matchReward = clone(reward);
  if (reward.awarded) {
    const key = String(reward.ticketLevel);
    const current = next.gachaTickets?.[key] || 0;
    if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(current + reward.ticketCount)) rewardError("TICKET_COUNT_OVERFLOW");
    next.gachaTickets[key] = current + reward.ticketCount;
  }
  return Object.freeze(next);
}

module.exports = {
  CPU_REWARD_BANDS,
  ECONOMY_VERSION,
  PVP_REWARD_LIMIT,
  PVP_REWARD_WINDOW_MS,
  applyMatchReward,
  priorRewardedPvpMatches,
  quoteMatchReward,
  validateMatchReward,
};
