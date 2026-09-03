"use strict";

const { STANDARD_SKILLS } = require("./standard-skill-registry.js");
const cosmetics = require("./standard-cosmetics.js");

const STARTER_SPOTLIGHT_SKILL = "areaHalfShift";
const ECONOMY_VERSION = "standard-alpha-economy-v1";
const SELL_PRICE_BY_RARITY = Object.freeze({ 1: 10, 2: 30, 3: 80, 4: 200, 5: 500 });
const CARD_COIN_VALUE = SELL_PRICE_BY_RARITY;
const TROPHY_IDS = Object.freeze(["fullPaint", "fullPaint3", "noSkillFullPaint"]);
const MAX_MATCH_HISTORY = 50;

class StandardProfileError extends Error {
  constructor(code) {
    super(code);
    this.name = "StandardProfileError";
    this.code = code;
  }
}

function assertProfile(condition, code) {
  if (!condition) throw new StandardProfileError(code);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonnegativeInteger(value, code) {
  assertProfile(Number.isSafeInteger(value) && value >= 0, code);
}

function createProgressionFields() {
  return {
    protectedSkills: { [STARTER_SPOTLIGHT_SKILL]: true },
    cosmeticsOwned: [...cosmetics.DEFAULT_COSMETIC_IDS],
    equipped: { ...cosmetics.DEFAULT_COSMETIC_BY_TYPE },
    trophies: Object.fromEntries(TROPHY_IDS.map((id) => [id, false])),
    trophyDates: {},
    stats: { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 },
    matchHistory: [],
  };
}

function validateProgressionFields(profile) {
  assertProfile(isRecord(profile.inventory), "INVALID_INVENTORY");
  for (const [skillId, count] of Object.entries(profile.inventory)) {
    assertProfile(Boolean(STANDARD_SKILLS[skillId]), "UNKNOWN_INVENTORY_SKILL");
    nonnegativeInteger(count, "INVALID_INVENTORY_COUNT");
  }
  nonnegativeInteger(profile.coins, "INVALID_COINS");
  assertProfile(isRecord(profile.protectedSkills), "INVALID_PROTECTED_SKILLS");
  for (const [skillId, protectedValue] of Object.entries(profile.protectedSkills)) {
    assertProfile(Boolean(STANDARD_SKILLS[skillId]), "UNKNOWN_PROTECTED_SKILL");
    assertProfile(typeof protectedValue === "boolean", "INVALID_PROTECTED_SKILL_VALUE");
  }
  cosmetics.validateCosmeticFields(profile);
  assertProfile(isRecord(profile.trophies), "INVALID_TROPHIES");
  for (const trophyId of TROPHY_IDS) assertProfile(typeof profile.trophies[trophyId] === "boolean", "INVALID_TROPHY_VALUE");
  assertProfile(isRecord(profile.trophyDates), "INVALID_TROPHY_DATES");
  for (const [trophyId, date] of Object.entries(profile.trophyDates)) {
    assertProfile(TROPHY_IDS.includes(trophyId) && typeof date === "string" && Number.isFinite(Date.parse(date)), "INVALID_TROPHY_DATE");
  }
  assertProfile(isRecord(profile.stats), "INVALID_MATCH_STATS");
  for (const key of ["wins", "losses", "currentWinStreak", "bestWinStreak", "fullPaints"]) nonnegativeInteger(profile.stats[key], "INVALID_MATCH_STAT");
  assertProfile(profile.stats.bestWinStreak >= profile.stats.currentWinStreak, "INVALID_WIN_STREAK");
  assertProfile(Array.isArray(profile.matchHistory) && profile.matchHistory.length <= MAX_MATCH_HISTORY, "INVALID_MATCH_HISTORY");
  for (const entry of profile.matchHistory) {
    assertProfile(isRecord(entry), "INVALID_MATCH_HISTORY_ENTRY");
    assertProfile(typeof entry.matchId === "string" && entry.matchId.length >= 1 && entry.matchId.length <= 64, "INVALID_HISTORY_MATCH_ID");
    assertProfile(entry.result === "WIN" || entry.result === "LOSS", "INVALID_HISTORY_RESULT");
    assertProfile(typeof entry.terminalReason === "string" && entry.terminalReason.length <= 80, "INVALID_HISTORY_REASON");
    assertProfile(typeof entry.endedAt === "string" && Number.isFinite(Date.parse(entry.endedAt)), "INVALID_HISTORY_DATE");
    assertProfile(typeof entry.fullPaint === "boolean", "INVALID_HISTORY_FULL_PAINT");
    nonnegativeInteger(entry.skillsUsed, "INVALID_HISTORY_SKILLS_USED");
    if (Object.hasOwn(entry, "mode")) {
      assertProfile(entry.mode === "standard", "INVALID_HISTORY_MODE");
      assertProfile(typeof entry.profileId === "string" && entry.profileId.length >= 1 && entry.profileId.length <= 64, "INVALID_HISTORY_PROFILE_ID");
      assertProfile(entry.opponentType === "PROFILE" || entry.opponentType === "CPU", "INVALID_HISTORY_OPPONENT_TYPE");
      assertProfile(typeof entry.displayNameSnapshot === "string" && entry.displayNameSnapshot.length >= 1 && entry.displayNameSnapshot.length <= 40, "INVALID_HISTORY_NAME");
      assertProfile(entry.opponentDisplayNameSnapshot === null || (typeof entry.opponentDisplayNameSnapshot === "string" && entry.opponentDisplayNameSnapshot.length >= 1 && entry.opponentDisplayNameSnapshot.length <= 40), "INVALID_HISTORY_OPPONENT_NAME");
      assertProfile(entry.opponentProfileId === null || (typeof entry.opponentProfileId === "string" && entry.opponentProfileId.length >= 1 && entry.opponentProfileId.length <= 64), "INVALID_HISTORY_OPPONENT_ID");
      assertProfile(entry.winnerSeat === "A" || entry.winnerSeat === "B", "INVALID_HISTORY_WINNER");
      assertProfile(typeof entry.startedAt === "string" && Number.isFinite(Date.parse(entry.startedAt)), "INVALID_HISTORY_STARTED_AT");
      assertProfile(typeof entry.finishedAt === "string" && Number.isFinite(Date.parse(entry.finishedAt)), "INVALID_HISTORY_FINISHED_AT");
      nonnegativeInteger(entry.turnCount, "INVALID_HISTORY_TURN_COUNT");
      nonnegativeInteger(entry.actionCount, "INVALID_HISTORY_ACTION_COUNT");
      assertProfile(typeof entry.mapComplete === "boolean", "INVALID_HISTORY_MAP_COMPLETE");
      if (entry.opponentType === "CPU") {
        assertProfile(["easy", "normal", "hard"].includes(entry.cpuDifficulty), "INVALID_HISTORY_CPU_DIFFICULTY");
        assertProfile(typeof entry.cpuPolicyVersion === "string" && entry.cpuPolicyVersion.length >= 1 && entry.cpuPolicyVersion.length <= 80, "INVALID_HISTORY_CPU_POLICY");
      } else {
        assertProfile(entry.opponentProfileId !== null && entry.opponentDisplayNameSnapshot !== null && entry.cpuDifficulty === null && entry.cpuPolicyVersion === null, "INVALID_HISTORY_PROFILE_OPPONENT");
      }
    }
  }
  return true;
}

function coinValueForSkill(skillId) {
  const skill = STANDARD_SKILLS[skillId];
  assertProfile(Boolean(skill) && skill.v49Catalogued, "UNKNOWN_SELLABLE_SKILL");
  return SELL_PRICE_BY_RARITY[skill.rarity];
}

function quoteCardSale({ profile, skillId, count, reservedCount = 0 }) {
  validateProgressionFields(profile);
  const value = coinValueForSkill(skillId);
  assertProfile(Number.isSafeInteger(count) && count >= 1, "INVALID_SALE_COUNT");
  nonnegativeInteger(reservedCount, "INVALID_RESERVED_COUNT");
  const owned = profile.inventory?.[skillId] || 0;
  nonnegativeInteger(owned, "INVALID_INVENTORY_COUNT");
  assertProfile(reservedCount <= owned, "INVALID_RESERVED_COUNT");
  assertProfile(profile.protectedSkills[skillId] !== true, "CARD_PROTECTED");
  const minimumRetainedCount = 1;
  const sellableCount = Math.max(0, owned - Math.max(reservedCount, minimumRetainedCount));
  assertProfile(count <= sellableCount, owned - count < minimumRetainedCount ? "KEEP_ONE_REQUIRED" : "CARD_RESERVED_OR_MISSING");
  const totalCoins = value * count;
  assertProfile(Number.isSafeInteger(totalCoins), "INVALID_ECONOMY_VALUE");
  assertProfile(Number.isSafeInteger(profile.coins + totalCoins), "COIN_OVERFLOW");
  const confirmationReasons = [];
  if (STANDARD_SKILLS[skillId].rarity >= 4) confirmationReasons.push("HIGH_RARITY");
  if (count === sellableCount) confirmationReasons.push("LAST_SELLABLE_COPY");
  return Object.freeze({
    status: confirmationReasons.length ? "CONFIRMATION_REQUIRED" : "READY",
    skillId,
    economyVersion: ECONOMY_VERSION,
    rarity: STANDARD_SKILLS[skillId].rarity,
    ownedCount: owned,
    reservedCount,
    sellableCount,
    count,
    valuePerCard: value,
    earnedCoins: totalCoins,
    remaining: owned - count,
    confirmationReasons: Object.freeze(confirmationReasons),
    requiresConfirmation: confirmationReasons.length > 0,
  });
}

function applyCardSale({ profile, skillId, count, reservedCount = 0, confirmed = false }) {
  const quote = quoteCardSale({ profile, skillId, count, reservedCount });
  assertProfile(!quote.requiresConfirmation || confirmed, "SALE_CONFIRMATION_REQUIRED");
  const next = clone(profile);
  next.inventory[skillId] = quote.remaining;
  next.coins += quote.earnedCoins;
  validateProgressionFields(next);
  return Object.freeze({ profile: Object.freeze(next), quote });
}

function applyKeepOneSale({ profile, skillId, reservedCount = 0, confirmed = false }) {
  const owned = profile.inventory?.[skillId] || 0;
  const count = owned - Math.max(1, reservedCount);
  assertProfile(count >= 1, "NO_EXCESS_CARDS");
  return applyCardSale({ profile, skillId, count, reservedCount, confirmed });
}

function setCardProtection(profile, skillId, protectedValue) {
  validateProgressionFields(profile);
  assertProfile(Boolean(STANDARD_SKILLS[skillId]), "UNKNOWN_SKILL");
  assertProfile(typeof protectedValue === "boolean", "INVALID_PROTECTION_VALUE");
  const next = clone(profile);
  next.protectedSkills[skillId] = protectedValue;
  validateProgressionFields(next);
  return Object.freeze(next);
}

function unlockTrophy(profile, trophyId, endedAt) {
  if (profile.trophies[trophyId]) return;
  profile.trophies[trophyId] = true;
  profile.trophyDates[trophyId] = endedAt;
}

function recordMatchOutcome({ profile, matchId, won, terminalReason, fullPaint = false, skillsUsed = 0, endedAt = new Date().toISOString() }) {
  validateProgressionFields(profile);
  assertProfile(typeof matchId === "string" && matchId.length >= 1 && matchId.length <= 64, "INVALID_HISTORY_MATCH_ID");
  assertProfile(typeof won === "boolean", "INVALID_MATCH_RESULT");
  assertProfile(typeof terminalReason === "string" && terminalReason.length <= 80, "INVALID_HISTORY_REASON");
  assertProfile(typeof fullPaint === "boolean", "INVALID_HISTORY_FULL_PAINT");
  nonnegativeInteger(skillsUsed, "INVALID_HISTORY_SKILLS_USED");
  assertProfile(typeof endedAt === "string" && Number.isFinite(Date.parse(endedAt)), "INVALID_HISTORY_DATE");
  assertProfile(!profile.matchHistory.some((entry) => entry.matchId === matchId), "MATCH_ALREADY_RECORDED");

  const next = clone(profile);
  if (won) {
    next.stats.wins += 1;
    next.stats.currentWinStreak += 1;
    next.stats.bestWinStreak = Math.max(next.stats.bestWinStreak, next.stats.currentWinStreak);
  } else {
    next.stats.losses += 1;
    next.stats.currentWinStreak = 0;
  }
  if (won && fullPaint) {
    next.stats.fullPaints += 1;
    unlockTrophy(next, "fullPaint", endedAt);
    if (next.stats.fullPaints >= 3) unlockTrophy(next, "fullPaint3", endedAt);
    if (skillsUsed === 0) unlockTrophy(next, "noSkillFullPaint", endedAt);
  }
  next.matchHistory.unshift({ matchId, result: won ? "WIN" : "LOSS", terminalReason, endedAt, fullPaint: won && fullPaint, skillsUsed });
  next.matchHistory = next.matchHistory.slice(0, MAX_MATCH_HISTORY);
  validateProgressionFields(next);
  return Object.freeze(next);
}

module.exports = {
  CARD_COIN_VALUE,
  ECONOMY_VERSION,
  MAX_MATCH_HISTORY,
  STARTER_SPOTLIGHT_SKILL,
  SELL_PRICE_BY_RARITY,
  StandardProfileError,
  TROPHY_IDS,
  applyCardSale,
  applyKeepOneSale,
  coinValueForSkill,
  createProgressionFields,
  quoteCardSale,
  recordMatchOutcome,
  setCardProtection,
  validateProgressionFields,
};
