"use strict";(()=>{const modules={"standard/standard-engine.js":function(require,module,exports){
"use strict";

const COLORS = Object.freeze(["red", "blue", "yellow", "green"]);
const MICRO_WIDTH = 48;

class StandardRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StandardRuleError";
    this.code = code;
  }
}

function assertRule(condition, code, message) {
  if (!condition) throw new StandardRuleError(code, message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function numericRegionId(id) {
  const match = String(id).match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function compareRegionIds(left, right) {
  const delta = numericRegionId(left) - numericRegionId(right);
  return Number.isFinite(delta) && delta !== 0 ? delta : String(left).localeCompare(String(right));
}

function microNeighbors(index, width = MICRO_WIDTH) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result = [];
  if (x > 0) result.push(index - 1);
  if (x < width - 1) result.push(index + 1);
  if (y > 0) result.push(index - width);
  result.push(index + width);
  return result;
}

function ownerMap(state) {
  const result = new Map();
  for (const region of Object.values(state.regions || {})) {
    for (const micro of region.micro || []) {
      assertRule(Number.isInteger(micro) && micro >= 0, "INVALID_STATE", "Region geometry contains an invalid cell");
      assertRule(!result.has(micro), "INVALID_STATE", "Regions overlap");
      result.set(micro, region.id);
    }
  }
  return result;
}

function adjacentRegionIds(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  const width = state.microWidth || MICRO_WIDTH;
  const owners = ownerMap(state);
  const adjacent = new Set();
  for (const micro of region.micro || []) {
    for (const neighbor of microNeighbors(micro, width)) {
      const owner = owners.get(neighbor);
      if (owner && owner !== regionId) adjacent.add(owner);
    }
  }
  return [...adjacent].sort(compareRegionIds);
}

function legalRecolorCandidates(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  const blocked = new Set([region.color]);
  for (const adjacentId of adjacentRegionIds(state, regionId)) {
    const color = state.regions[adjacentId]?.color;
    if (color) blocked.add(color);
  }
  return Object.freeze(COLORS.filter((color) => !blocked.has(color)));
}

function sameColorAdjacentCount(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  if (!region.color) return 0;
  return adjacentRegionIds(state, regionId).filter((adjacentId) => state.regions[adjacentId]?.color === region.color).length;
}

function mergeSameColorComponent(state, startRegionId) {
  const start = state.regions[startRegionId];
  if (!start?.color) return Object.freeze({ keptId: startRegionId, droppedIds: [] });
  const component = new Set([startRegionId]);
  const queue = [startRegionId];
  while (queue.length) {
    const current = queue.shift();
    for (const adjacentId of adjacentRegionIds(state, current)) {
      if (!component.has(adjacentId) && state.regions[adjacentId]?.color === start.color) {
        component.add(adjacentId);
        queue.push(adjacentId);
      }
    }
  }
  const ids = [...component].sort(compareRegionIds);
  const keptId = ids[0];
  const droppedIds = ids.slice(1);
  if (!droppedIds.length) return Object.freeze({ keptId, droppedIds: [] });
  const kept = state.regions[keptId];
  kept.micro = [...new Set(ids.flatMap((id) => state.regions[id].micro || []))].sort((a, b) => a - b);
  kept.sourceMacros = [...new Set(ids.flatMap((id) => state.regions[id].sourceMacros || []))].sort((a, b) => a - b);
  kept.controllers = [...new Set(ids.flatMap((id) => state.regions[id].controllers || []))].sort();
  kept.color = start.color;
  kept.isPending = false;
  for (const id of droppedIds) delete state.regions[id];
  if (droppedIds.includes(state.pending)) state.pending = keptId;
  return Object.freeze({ keptId, droppedIds: Object.freeze(droppedIds) });
}

function validateLegalRecolorTarget(state, actor, regionId) {
  assertRule(actor === "A" || actor === "B", "NOT_A_PLAYER", "Actor must occupy a seat");
  assertRule(state.mode === "standard", "WRONG_MODE", "Legal recolor is standard-mode only");
  assertRule(state.phase === "WORK", "WRONG_PHASE", "Legal recolor is a work-phase skill");
  assertRule(state.active === actor, "NOT_YOUR_TURN", "It is not this player's turn");
  assertRule(!state.winner, "MATCH_FINISHED", "Match is already finished");
  assertRule(!state.interferenceLock, "INTERFERENCE_CHAINED", "Existing-region interference is locked until COLOR");
  assertRule((state.hands?.[actor]?.legalRecolor || 0) > 0, "SKILL_UNAVAILABLE", "Legal recolor is unavailable");
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  assertRule(Boolean(region.color), "INVALID_TARGET", "Target must already be colored");
  assertRule(state.pending !== regionId && !region.isPending, "INVALID_TARGET", "Pending region cannot be recolored");
  assertRule(!region.deleted && !region.delayed && !region.delayState, "INVALID_TARGET", "Deleted or delayed region cannot be recolored");
  return region;
}

function applyLegalRecolor(currentState, actor, regionId, options = {}) {
  validateLegalRecolorTarget(currentState, actor, regionId);
  const sameColorBefore = sameColorAdjacentCount(currentState, regionId);
  const candidates = legalRecolorCandidates(currentState, regionId);
  if (!candidates.length) return Object.freeze({ ok: false, code: "NO_LEGAL_RECOLOR", state: currentState, candidates });
  const effectRandom = options.effectRandom;
  assertRule(typeof effectRandom === "function", "RNG_REQUIRED", "Effect RNG is required");
  const draw = Number(effectRandom());
  assertRule(Number.isFinite(draw) && draw >= 0 && draw < 1, "INVALID_RANDOM", "Effect RNG must return [0, 1)");
  const color = candidates[Math.floor(draw * candidates.length)];
  const state = clone(currentState);
  state.regions[regionId].color = color;
  const sameColorAfter = sameColorAdjacentCount(state, regionId);
  assertRule(sameColorAfter === 0 && sameColorAfter <= sameColorBefore, "RECOLOR_ADJACENCY_INVARIANT", "Legal recolor created same-color adjacency");
  state.hands[actor].legalRecolor -= 1;
  state.skillsUsed = state.skillsUsed || { A: 0, B: 0 };
  state.skillsUsed[actor] = (state.skillsUsed[actor] || 0) + 1;
  const merge = Object.freeze({ keptId: regionId, droppedIds: Object.freeze([]) });
  state.active = other(actor);
  state.phase = "WORK";
  state.interferenceLock = true;
  state.version += 1;
  const logKey = Array.isArray(state.publicLog) ? "publicLog" : "log";
  state[logKey] = Array.isArray(state[logKey]) ? state[logKey] : [];
  state[logKey].push(`T${state.turn}  Player ${actor} legally recolored ${regionId} ${color}; WORK passed to Player ${state.active}.`);
  return Object.freeze({ ok: true, code: "OK", state, color, candidates, merge });
}

function onEnterColor(currentState) {
  if (!currentState.interferenceLock) return currentState;
  const state = clone(currentState);
  state.interferenceLock = false;
  return state;
}

function hashSeed(seed, name) {
  let value = (Number(seed) >>> 0) ^ 0x811c9dc5;
  for (const char of String(name)) {
    value ^= char.codePointAt(0);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value || 0x6d2b79f5;
}

function createStream(seed) {
  let state = seed >>> 0;
  return Object.freeze({
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    snapshot() {
      return state >>> 0;
    },
  });
}

function createRngDomains(seed, names = ["setup", "roll", "effect", "quizContent", "quizPlacement", "cpuDecision"]) {
  const streams = {};
  for (const name of names) streams[name] = createStream(hashSeed(seed, name));
  return Object.freeze(streams);
}

function createRngDomainsFromSnapshot(snapshot, names) {
  assertRule(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot), "INVALID_RNG_SNAPSHOT", "RNG snapshot must be an object");
  const streams = {};
  for (const name of names) {
    assertRule(Number.isSafeInteger(snapshot[name]) && snapshot[name] >= 0 && snapshot[name] <= 0xffffffff, "INVALID_RNG_SNAPSHOT", `Missing RNG stream: ${name}`);
    streams[name] = createStream(snapshot[name]);
  }
  return Object.freeze(streams);
}

function snapshotRngDomains(streams, names) {
  const snapshot = {};
  for (const name of names) {
    const value = streams?.[name]?.snapshot?.();
    assertRule(Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff, "INVALID_RNG_STREAM", `RNG stream cannot be snapshotted: ${name}`);
    snapshot[name] = value;
  }
  return Object.freeze(snapshot);
}

module.exports = {
  COLORS,
  StandardRuleError,
  adjacentRegionIds,
  applyLegalRecolor,
  compareRegionIds,
  createRngDomains,
  createRngDomainsFromSnapshot,
  createStream,
  hashSeed,
  legalRecolorCandidates,
  mergeSameColorComponent,
  onEnterColor,
  sameColorAdjacentCount,
  snapshotRngDomains,
};

},
"standard/standard-profile.js":function(require,module,exports){
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
    cpuStats: { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 },
    cpuCharacterStats: {},
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
  if (Object.hasOwn(profile, "cpuStats")) {
    assertProfile(isRecord(profile.cpuStats), "INVALID_CPU_MATCH_STATS");
    for (const key of ["wins", "losses", "currentWinStreak", "bestWinStreak", "fullPaints"]) nonnegativeInteger(profile.cpuStats[key], "INVALID_CPU_MATCH_STAT");
    assertProfile(profile.cpuStats.bestWinStreak >= profile.cpuStats.currentWinStreak, "INVALID_CPU_WIN_STREAK");
  }
  if (Object.hasOwn(profile, "cpuCharacterStats")) {
    assertProfile(isRecord(profile.cpuCharacterStats), "INVALID_CPU_CHARACTER_STATS");
    for (const [characterId, record] of Object.entries(profile.cpuCharacterStats)) {
      assertProfile(/^[a-z][a-z0-9-]{1,31}$/.test(characterId) && isRecord(record), "INVALID_CPU_CHARACTER_STAT");
      for (const key of ["matches", "wins", "losses"]) nonnegativeInteger(record[key], "INVALID_CPU_CHARACTER_STAT");
      assertProfile(record.matches === record.wins + record.losses, "INVALID_CPU_CHARACTER_STAT");
      assertProfile(record.firstWinAt === null || (typeof record.firstWinAt === "string" && Number.isFinite(Date.parse(record.firstWinAt))), "INVALID_CPU_CHARACTER_STAT");
    }
  }
  assertProfile(Array.isArray(profile.matchHistory) && profile.matchHistory.length <= MAX_MATCH_HISTORY, "INVALID_MATCH_HISTORY");
  for (const entry of profile.matchHistory) {
    assertProfile(isRecord(entry), "INVALID_MATCH_HISTORY_ENTRY");
    assertProfile(typeof entry.matchId === "string" && entry.matchId.length >= 1 && entry.matchId.length <= 64, "INVALID_HISTORY_MATCH_ID");
    assertProfile(entry.result === "WIN" || entry.result === "LOSS", "INVALID_HISTORY_RESULT");
    assertProfile(typeof entry.terminalReason === "string" && entry.terminalReason.length <= 80, "INVALID_HISTORY_REASON");
    assertProfile(typeof entry.endedAt === "string" && Number.isFinite(Date.parse(entry.endedAt)), "INVALID_HISTORY_DATE");
    assertProfile(typeof entry.fullPaint === "boolean", "INVALID_HISTORY_FULL_PAINT");
    nonnegativeInteger(entry.skillsUsed, "INVALID_HISTORY_SKILLS_USED");
    if (Object.hasOwn(entry, "onlineOpponentKind")) {
      assertProfile(entry.onlineOpponentKind === "cpu" && /^[a-z][a-z0-9-]{1,31}$/.test(entry.cpuCharacterId), "INVALID_ONLINE_CPU_HISTORY");
    }
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

function recordCpuMatchOutcome({ profile, matchId, cpuCharacterId, won, terminalReason, fullPaint = false, skillsUsed = 0, endedAt = new Date().toISOString() }) {
  validateProgressionFields(profile);
  assertProfile(typeof matchId === "string" && matchId.length >= 1 && matchId.length <= 64, "INVALID_HISTORY_MATCH_ID");
  assertProfile(/^[a-z][a-z0-9-]{1,31}$/.test(cpuCharacterId), "INVALID_CPU_CHARACTER_ID");
  assertProfile(typeof won === "boolean", "INVALID_MATCH_RESULT");
  assertProfile(typeof terminalReason === "string" && terminalReason.length <= 80, "INVALID_HISTORY_REASON");
  assertProfile(typeof fullPaint === "boolean", "INVALID_HISTORY_FULL_PAINT");
  nonnegativeInteger(skillsUsed, "INVALID_HISTORY_SKILLS_USED");
  assertProfile(typeof endedAt === "string" && Number.isFinite(Date.parse(endedAt)), "INVALID_HISTORY_DATE");
  assertProfile(!profile.matchHistory.some((entry) => entry.matchId === matchId), "MATCH_ALREADY_RECORDED");
  const next = clone(profile);
  next.cpuStats ||= { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 };
  next.cpuCharacterStats ||= {};
  if (won) {
    next.cpuStats.wins += 1;
    next.cpuStats.currentWinStreak += 1;
    next.cpuStats.bestWinStreak = Math.max(next.cpuStats.bestWinStreak, next.cpuStats.currentWinStreak);
  } else {
    next.cpuStats.losses += 1;
    next.cpuStats.currentWinStreak = 0;
  }
  const character = next.cpuCharacterStats[cpuCharacterId] || { matches: 0, wins: 0, losses: 0, firstWinAt: null };
  character.matches += 1;
  character[won ? "wins" : "losses"] += 1;
  if (won && character.firstWinAt === null) character.firstWinAt = endedAt;
  next.cpuCharacterStats[cpuCharacterId] = character;
  if (won && fullPaint) {
    next.cpuStats.fullPaints += 1;
    next.stats.fullPaints += 1;
    unlockTrophy(next, "fullPaint", endedAt);
    if (next.stats.fullPaints >= 3) unlockTrophy(next, "fullPaint3", endedAt);
    if (skillsUsed === 0) unlockTrophy(next, "noSkillFullPaint", endedAt);
  }
  next.matchHistory.unshift({ matchId, result: won ? "WIN" : "LOSS", terminalReason, endedAt, fullPaint: won && fullPaint, skillsUsed, onlineOpponentKind: "cpu", cpuCharacterId });
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
  recordCpuMatchOutcome,
  recordMatchOutcome,
  setCardProtection,
  validateProgressionFields,
};

},
"standard/standard-cosmetics.js":function(require,module,exports){
"use strict";

const COSMETIC_TYPES = Object.freeze(["board", "effect", "nameplate", "title"]);
const COSMETIC_TYPE_LABELS = Object.freeze({ board: "盤面枠", effect: "発動演出", nameplate: "名札", title: "称号" });
const DEFAULT_COSMETIC_BY_TYPE = Object.freeze({ board: "boardDefault", effect: "effectDefault", nameplate: "nameplateDefault", title: "titleNone" });
const COSMETIC_CATALOG = Object.freeze({
  boardDefault: Object.freeze({ cosmeticId: "boardDefault", name: "標準盤面", type: "board", price: 0, cssClass: "", preview: "DEFAULT", previewClass: "" }),
  boardAurora: Object.freeze({ cosmeticId: "boardAurora", name: "オーロラ盤面", type: "board", price: 600, cssClass: "skin-board-aurora", preview: "AURORA", previewClass: "aurora" }),
  boardGold: Object.freeze({ cosmeticId: "boardGold", name: "黄金盤面", type: "board", price: 900, cssClass: "skin-board-gold", preview: "GOLD", previewClass: "gold" }),
  boardCartographer: Object.freeze({ cosmeticId: "boardCartographer", name: "地図職人の盤面", type: "board", price: 0, cssClass: "skin-board-cartographer", preview: "CARTOGRAPHER", previewClass: "cartographer", trophyId: "fullPaint" }),
  effectDefault: Object.freeze({ cosmeticId: "effectDefault", name: "標準エフェクト", type: "effect", price: 0, cssClass: "", preview: "STANDARD FX", previewClass: "" }),
  effectSakura: Object.freeze({ cosmeticId: "effectSakura", name: "桜吹雪", type: "effect", price: 500, cssClass: "skin-effect-sakura", preview: "SAKURA FX", previewClass: "sakura" }),
  effectPrism: Object.freeze({ cosmeticId: "effectPrism", name: "四色プリズム", type: "effect", price: 850, cssClass: "skin-effect-prism", preview: "PRISM FX", previewClass: "prism" }),
  effectMasterpiece: Object.freeze({ cosmeticId: "effectMasterpiece", name: "完成地図の輝き", type: "effect", price: 0, cssClass: "skin-effect-masterpiece", preview: "MASTERPIECE", previewClass: "cartographer", trophyId: "fullPaint3" }),
  nameplateDefault: Object.freeze({ cosmeticId: "nameplateDefault", name: "標準名札", type: "nameplate", price: 0, cssClass: "", preview: "PLAYER", previewClass: "" }),
  nameplateGold: Object.freeze({ cosmeticId: "nameplateGold", name: "黄金名札", type: "nameplate", price: 350, cssClass: "skin-nameplate-gold", preview: "PLAYER ★", previewClass: "gold" }),
  titleNone: Object.freeze({ cosmeticId: "titleNone", name: "称号なし", type: "title", price: 0, cssClass: "", preview: "PLAYER", previewClass: "" }),
  titleArtisan: Object.freeze({ cosmeticId: "titleArtisan", name: "四色の匠", type: "title", price: 0, cssClass: "", preview: "四色の匠", previewClass: "prism", trophyId: "noSkillFullPaint" }),
});
const DEFAULT_COSMETIC_IDS = Object.freeze(Object.values(DEFAULT_COSMETIC_BY_TYPE));
const ALL_COSMETIC_CLASSES = Object.freeze([...new Set(Object.values(COSMETIC_CATALOG).map((item) => item.cssClass).filter(Boolean))]);

class StandardCosmeticError extends Error {
  constructor(code) {
    super(code);
    this.name = "StandardCosmeticError";
    this.code = code;
  }
}

function assertCosmetic(condition, code) {
  if (!condition) throw new StandardCosmeticError(code);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function effectiveEquipped(profile) {
  const equipped = {};
  for (const type of COSMETIC_TYPES) {
    const candidate = profile.equipped?.[type];
    const item = COSMETIC_CATALOG[candidate];
    equipped[type] = item?.type === type ? candidate : DEFAULT_COSMETIC_BY_TYPE[type];
  }
  return Object.freeze(equipped);
}

function validateCosmeticFields(profile) {
  assertCosmetic(Array.isArray(profile.cosmeticsOwned), "INVALID_COSMETICS");
  assertCosmetic(new Set(profile.cosmeticsOwned).size === profile.cosmeticsOwned.length, "DUPLICATE_COSMETIC");
  for (const cosmeticId of profile.cosmeticsOwned) assertCosmetic(Boolean(COSMETIC_CATALOG[cosmeticId]), "UNKNOWN_COSMETIC");
  assertCosmetic(profile.equipped && typeof profile.equipped === "object" && !Array.isArray(profile.equipped), "INVALID_EQUIPPED_COSMETICS");
  for (const [type, cosmeticId] of Object.entries(profile.equipped)) {
    assertCosmetic(COSMETIC_TYPES.includes(type) && COSMETIC_CATALOG[cosmeticId]?.type === type, "INVALID_EQUIPPED_COSMETIC");
    const item = COSMETIC_CATALOG[cosmeticId];
    const available = DEFAULT_COSMETIC_IDS.includes(cosmeticId) || profile.cosmeticsOwned.includes(cosmeticId) || (item.trophyId && profile.trophies?.[item.trophyId] === true);
    assertCosmetic(available, "EQUIPPED_COSMETIC_NOT_OWNED");
  }
  return true;
}

function quoteCosmeticAction({ profile, cosmeticId }) {
  validateCosmeticFields(profile);
  const item = COSMETIC_CATALOG[cosmeticId];
  assertCosmetic(Boolean(item), "UNKNOWN_COSMETIC");
  assertCosmetic(effectiveEquipped(profile)[item.type] !== cosmeticId, "ALREADY_EQUIPPED");
  if (item.trophyId) assertCosmetic(profile.trophies?.[item.trophyId] === true, "TROPHY_REQUIRED");
  const owned = DEFAULT_COSMETIC_IDS.includes(cosmeticId) || profile.cosmeticsOwned.includes(cosmeticId) || Boolean(item.trophyId);
  const purchaseRequired = !owned;
  const price = purchaseRequired ? item.price : 0;
  assertCosmetic(Number.isSafeInteger(profile.coins) && profile.coins >= price, "INSUFFICIENT_COINS");
  return Object.freeze({
    cosmeticId,
    name: item.name,
    type: item.type,
    price,
    purchaseRequired,
    action: purchaseRequired ? "PURCHASE_AND_EQUIP" : "EQUIP",
    coinsBefore: profile.coins,
    coinsAfter: profile.coins - price,
    trophyId: item.trophyId || null,
  });
}

function applyCosmeticAction({ profile, cosmeticId }) {
  const quote = quoteCosmeticAction({ profile, cosmeticId });
  const next = clone(profile);
  if (quote.purchaseRequired) next.cosmeticsOwned.push(cosmeticId);
  next.coins = quote.coinsAfter;
  next.equipped = { ...effectiveEquipped(next), [quote.type]: cosmeticId };
  validateCosmeticFields(next);
  return Object.freeze({ profile: Object.freeze(next), quote });
}

function projectCosmetics(profile) {
  validateCosmeticFields(profile);
  const equipped = effectiveEquipped(profile);
  const items = Object.values(COSMETIC_CATALOG).map((item) => {
    const trophyUnlocked = !item.trophyId || profile.trophies?.[item.trophyId] === true;
    const owned = DEFAULT_COSMETIC_IDS.includes(item.cosmeticId) || profile.cosmeticsOwned.includes(item.cosmeticId) || Boolean(item.trophyId && trophyUnlocked);
    return Object.freeze({ ...item, trophyId: item.trophyId || null, trophyUnlocked, owned, equipped: equipped[item.type] === item.cosmeticId });
  });
  return Object.freeze({ coins: profile.coins, equipped, items: Object.freeze(items) });
}

module.exports = {
  ALL_COSMETIC_CLASSES,
  COSMETIC_CATALOG,
  COSMETIC_TYPES,
  COSMETIC_TYPE_LABELS,
  DEFAULT_COSMETIC_BY_TYPE,
  DEFAULT_COSMETIC_IDS,
  StandardCosmeticError,
  applyCosmeticAction,
  effectiveEquipped,
  projectCosmetics,
  quoteCosmeticAction,
  validateCosmeticFields,
};

},
"standard/standard-skill-registry.js":function(require,module,exports){
"use strict";

function skill(id, displayName, category, rarity, timing, options = {}) {
  const implemented = Boolean(options.implemented);
  const v49Catalogued = options.v49Catalogued !== false;
  return Object.freeze({
    id,
    displayName,
    category,
    rarity,
    timing,
    targetSchema: options.targetSchema ?? null,
    implemented,
    standardEngineImplemented: implemented,
    alphaUiEnabled: Boolean(options.alphaUiEnabled),
    standardUiEnabled: options.standardUiEnabled === undefined ? implemented && v49Catalogued : Boolean(options.standardUiEnabled),
    gachaEnabled: options.gachaEnabled !== false,
    experimental: Boolean(options.experimental),
    privateInformationEffect: Boolean(options.privateInformationEffect),
    rngStream: options.rngStream ?? null,
    expectedRngDraws: options.expectedRngDraws ?? 0,
    consumptionPolicy: options.consumptionPolicy || "RESOLVED_V49",
    handlerVersion: options.handlerVersion ?? null,
    v49Catalogued,
  });
}

const STANDARD_SKILLS = Object.freeze({
  colorRandomBorrow: skill("colorRandomBorrow", "色拾い・乱", "color", 1, "COLOR", {
    implemented: true,
    privateInformationEffect: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    consumptionPolicy: "RESOLVED_ONLY_NO_CANDIDATE_REJECTED",
    handlerVersion: "color-random-borrow-v1",
  }),
  colorChoiceBorrow: skill("colorChoiceBorrow", "色借り", "color", 2, "COLOR", {
    targetSchema: { color: "color-id" },
    implemented: true,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_ONLY_VALID_BOARD_COLOR",
    handlerVersion: "color-choice-borrow-v1",
  }),
  colorPrism: skill("colorPrism", "四色解放", "color", 3, "COLOR", { implemented: true, handlerVersion: "color-prism-v1" }),
  colorRegionSplit: skill("colorRegionSplit", "エリア二分", "color", 4, "COLOR", {
    targetSchema: { regionId: "region-id", sourceMacros: "macro-index-array" },
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_CONNECTED_BIPARTITION",
    handlerVersion: "color-region-split-v1",
  }),
  colorPaletteChange: skill("colorPaletteChange", "持ち色変更", "color", 5, "COLOR", {
    targetSchema: { slot: "palette-slot", color: "color-id" },
    implemented: true,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_ONLY_CHANGED_SLOT",
    handlerVersion: "color-palette-change-v1",
  }),
  areaMicroBloom: skill("areaMicroBloom", "ひとふくらみ", "area", 1, "WORK", {
    targetSchema: { sourceMacros: "macro-index-array" },
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    consumptionPolicy: "RESOLVED_ONLY_POINT_CONTACT_CANDIDATE",
    handlerVersion: "area-micro-bloom-v1",
  }),
  areaDiePlus: skill("areaDiePlus", "エリア拡張", "area", 2, "WORK", {
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_LEGAL_SIZE_PLUS_ONE",
    handlerVersion: "area-die-plus-v1",
  }),
  areaResize: skill("areaResize", "拡大縮小", "area", 3, "WORK", {
    targetSchema: { mode: "expand-or-shrink", side: "board-side" },
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_AVAILABLE_BOARD_SIDE",
    handlerVersion: "area-resize-v1",
  }),
  areaCornerBloom: skill("areaCornerBloom", "角膨張", "area", 4, "WORK", {
    targetSchema: { sourceMacros: "macro-index-array", macro: "macro-index" },
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_AVAILABLE_CORNER_EXPANSION",
    handlerVersion: "area-corner-bloom-v1",
  }),
  areaHalfShift: skill("areaHalfShift", "半マスシフト", "area", 4, "WORK", { targetSchema: { axis: "row-or-column", index: "integer", direction: "minus-or-plus" }, implemented: true, handlerVersion: "area-half-shift-v1" }),
  areaTripleShift: skill("areaTripleShift", "三層断層", "area", 5, "WORK", {
    targetSchema: { axis: "row-or-column", index: "integer", direction: "minus-or-plus" },
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_CONNECTED_THREE_BAND_SHIFT",
    handlerVersion: "area-triple-shift-v1",
  }),
  disruptRandomOne: skill("disruptRandomOne", "色封じ・乱", "disrupt", 1, "WORK", {
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    consumptionPolicy: "RESOLVED_RANDOM_COLOR_INCLUDING_MISS",
    handlerVersion: "disrupt-random-one-v1",
  }),
  disruptChoiceOne: skill("disruptChoiceOne", "色封じ", "disrupt", 2, "WORK", { targetSchema: { color: "color-id" }, privateInformationEffect: true, implemented: true, handlerVersion: "disrupt-choice-one-v1" }),
  disruptRandomTwo: skill("disruptRandomTwo", "二重封じ・乱", "disrupt", 3, "WORK", {
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 2,
    consumptionPolicy: "RESOLVED_TWO_DISTINCT_RANDOM_COLORS_INCLUDING_MISS",
    handlerVersion: "disrupt-random-two-v1",
  }),
  disruptPaletteRandom: skill("disruptPaletteRandom", "持ち色汚染・乱", "disrupt", 3, "WORK", {
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 2,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_RANDOM_COLOR_AND_PRIVATE_SLOT",
    handlerVersion: "disrupt-palette-random-v1",
  }),
  disruptChoiceTwo: skill("disruptChoiceTwo", "追封", "disrupt", 4, "WORK", {
    targetSchema: { color: "color-id" },
    privateInformationEffect: true,
    implemented: true,
    consumptionPolicy: "RESOLVED_CHOSEN_COLOR_TWO_COLORINGS",
    handlerVersion: "disrupt-choice-two-v1",
  }),
  disruptPaletteChoice: skill("disruptPaletteChoice", "持ち色汚染", "disrupt", 4, "WORK", {
    targetSchema: { color: "color-id" },
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_CHOSEN_COLOR_AND_PRIVATE_RANDOM_SLOT",
    handlerVersion: "disrupt-palette-choice-v1",
  }),
  disruptChoiceThree: skill("disruptChoiceThree", "長封", "disrupt", 5, "WORK", {
    targetSchema: { color: "color-id" },
    privateInformationEffect: true,
    implemented: true,
    consumptionPolicy: "RESOLVED_CHOSEN_COLOR_THREE_COLORINGS",
    handlerVersion: "disrupt-choice-three-v1",
  }),
  disruptForcedPalette: skill("disruptForcedPalette", "強制持ち替え", "disrupt", 5, "WORK", {
    targetSchema: { color: "color-id" },
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_CHOSEN_COLOR_AND_PRIVATE_RANDOM_SLOT_PERMANENT",
    handlerVersion: "disrupt-forced-palette-v1",
  }),
  legalRecolor: skill("legalRecolor", "サーバー抽選による合法リカラー", "experimental", 3, "WORK", {
    targetSchema: { regionId: "region-id" },
    implemented: true,
    alphaUiEnabled: true,
    gachaEnabled: false,
    experimental: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    consumptionPolicy: "RESOLVED_ONLY_NO_CANDIDATE_REJECTED",
    handlerVersion: "legal-recolor-v1",
    v49Catalogued: false,
  }),
});

const V49_SKILL_IDS = Object.freeze(Object.values(STANDARD_SKILLS).filter((entry) => entry.v49Catalogued).map((entry) => entry.id));
const IMPLEMENTED_SKILL_IDS = Object.freeze(Object.values(STANDARD_SKILLS).filter((entry) => entry.implemented).map((entry) => entry.id));

module.exports = { IMPLEMENTED_SKILL_IDS, STANDARD_SKILLS, V49_SKILL_IDS };

},
"standard/standard-skill-handlers.js":function(require,module,exports){
"use strict";

const { COLORS, StandardRuleError, mergeSameColorComponent } = require("./standard-engine.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function consume(state, actor, skill) {
  state.hands[actor][skill] -= 1;
  state.skillsUsed[actor] = (state.skillsUsed[actor] || 0) + 1;
  state.version += 1;
}

function resolved(currentState, actor, skill, mutate, details = {}) {
  const state = clone(currentState);
  mutate(state);
  consume(state, actor, skill);
  return Object.freeze({ ok: true, code: "OK", state, ...details });
}

function applyColorPrism({ state, actor }) {
  return resolved(state, actor, "colorPrism", (next) => {
    next.privateEffects[actor] = next.privateEffects[actor] || {};
    next.privateEffects[actor].prism = true;
    next.publicLog.push(`T${next.turn} Player ${actor} enabled all four colors for this coloring.`);
  });
}

function usedBoardColors(state) {
  return [...new Set(Object.values(state.regions).map((region) => region.color).filter((color) => COLORS.includes(color)))];
}

function addTemporaryColor(state, actor, color) {
  state.privateEffects[actor] = state.privateEffects[actor] || {};
  const temporaryColors = new Set(state.privateEffects[actor].temporaryColors || []);
  temporaryColors.add(color);
  state.privateEffects[actor].temporaryColors = [...temporaryColors];
}

function applyColorRandomBorrow({ state, actor, random }) {
  const candidates = usedBoardColors(state);
  if (!candidates.length) return Object.freeze({ ok: false, code: "NO_BOARD_COLORS", state });
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const color = candidates[Math.floor(draw * candidates.length)];
  return resolved(state, actor, "colorRandomBorrow", (next) => {
    addTemporaryColor(next, actor, color);
    next.publicLog.push(`T${next.turn} Player ${actor} used random color borrow; the added color is private.`);
  });
}

function applyColorChoiceBorrow({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  if (!usedBoardColors(state).includes(payload.color)) return Object.freeze({ ok: false, code: "COLOR_NOT_USED_ON_BOARD", state });
  return resolved(state, actor, "colorChoiceBorrow", (next) => {
    addTemporaryColor(next, actor, payload.color);
    next.publicLog.push(`T${next.turn} Player ${actor} used chosen color borrow; the added color is private.`);
  });
}

function paletteColorAt(state, actor, slot) {
  return slot < 2 ? state.basicPalettes[actor][slot] : state.bonusColors[actor];
}

function setPaletteColorAt(state, actor, slot, color) {
  if (slot < 2) state.basicPalettes[actor][slot] = color;
  else state.bonusColors[actor] = color;
}

function clearPaletteDebuffAtSlot(state, actor, slot) {
  state.privateEffects[actor] = state.privateEffects[actor] || {};
  state.privateEffects[actor].paletteDebuffs = (state.privateEffects[actor].paletteDebuffs || []).filter((effect) => effect.slot !== slot);
  if (!state.privateEffects[actor].paletteDebuffs.length) delete state.privateEffects[actor].paletteDebuffs;
}

function applyColorPaletteChange({ state, actor, payload }) {
  if (!Number.isInteger(payload.slot) || payload.slot < 0 || payload.slot > 2 || !COLORS.includes(payload.color)) {
    return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  }
  if (paletteColorAt(state, actor, payload.slot) === payload.color) return Object.freeze({ ok: false, code: "PALETTE_COLOR_UNCHANGED", state });
  return resolved(state, actor, "colorPaletteChange", (next) => {
    clearPaletteDebuffAtSlot(next, actor, payload.slot);
    setPaletteColorAt(next, actor, payload.slot, payload.color);
    next.publicLog.push(`T${next.turn} Player ${actor} permanently changed one private palette slot.`);
  });
}

function microToMacro(cell, state) {
  const x = cell % state.microWidth;
  const y = Math.floor(cell / state.microWidth);
  const scale = state.playableBounds.microScale;
  return Math.floor(y / scale) * state.playableBounds.macroWidth + Math.floor(x / scale);
}

function nextRegionNumber(state) {
  return Math.max(0, ...Object.keys(state.regions).map((id) => Number(String(id).match(/\d+/)?.[0]) || 0)) + 1;
}

function applyColorRegionSplit({ state, actor, payload }) {
  const region = state.regions?.[payload.regionId];
  if (!region || payload.regionId !== state.pending || !region.isPending || region.color) {
    return Object.freeze({ ok: false, code: "INVALID_SPLIT_TARGET", state });
  }
  if ((region.controllers || []).includes(actor)) return Object.freeze({ ok: false, code: "SPLIT_REQUIRES_OPPONENT_REGION", state });
  if (state.reserved) return Object.freeze({ ok: false, code: "SPLIT_ALREADY_RESERVED", state });
  const original = [...new Set(region.sourceMacros || [])].sort((a, b) => a - b);
  const selected = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  const originalSet = new Set(original);
  if (selected.length !== payload.sourceMacros.length || !selected.every((macro) => originalSet.has(macro))) {
    return Object.freeze({ ok: false, code: "INVALID_SPLIT_SELECTION", state });
  }
  const selectedSet = new Set(selected);
  const returned = original.filter((macro) => !selectedSet.has(macro));
  if (!selected.length || !returned.length) return Object.freeze({ ok: false, code: "SPLIT_SIDE_EMPTY", state });
  if (!connected(selected, state.playableBounds.macroWidth) || !connected(returned, state.playableBounds.macroWidth)) {
    return Object.freeze({ ok: false, code: "SPLIT_SIDE_NOT_CONNECTED", state });
  }
  const selectedMicro = region.micro.filter((cell) => selectedSet.has(microToMacro(cell, state))).sort((a, b) => a - b);
  const returnedMicro = region.micro.filter((cell) => !selectedSet.has(microToMacro(cell, state))).sort((a, b) => a - b);
  if (!connected(selectedMicro, state.microWidth) || !connected(returnedMicro, state.microWidth)) {
    return Object.freeze({ ok: false, code: "SPLIT_GEOMETRY_NOT_CONNECTED", state });
  }
  return resolved(state, actor, "colorRegionSplit", (next) => {
    const firstNumber = nextRegionNumber(next);
    const selectedId = `R${firstNumber}`;
    const returnedId = `R${firstNumber + 1}`;
    delete next.regions[payload.regionId];
    next.regions[selectedId] = {
      id: selectedId,
      micro: selectedMicro,
      sourceMacros: selected,
      controllers: [],
      color: null,
      isPending: true,
      isReserved: false,
    };
    next.regions[returnedId] = {
      id: returnedId,
      micro: returnedMicro,
      sourceMacros: returned,
      controllers: [],
      color: null,
      isPending: false,
      isReserved: true,
    };
    next.pending = selectedId;
    next.reserved = returnedId;
    next.publicLog.push(`T${next.turn} Player ${actor} split ${payload.regionId} into ${selectedId} and reserved ${returnedId}.`);
  }, { selectedId: `R${nextRegionNumber(state)}`, returnedId: `R${nextRegionNumber(state) + 1}` });
}

function macroMicroCells(macro, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const col = macro % macroWidth;
  const row = Math.floor(macro / macroWidth);
  const cells = [];
  for (let dy = 0; dy < scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) cells.push((row * scale + dy) * state.microWidth + col * scale + dx);
  }
  return cells;
}

function validOutgoingMacros(state, sourceMacros) {
  const bounds = state.playableBounds;
  if (sourceMacros.length !== state.requiredSize || !connected(sourceMacros, bounds.macroWidth)) return false;
  const occupiedMacros = new Set(Object.values(state.regions).flatMap((region) => region.sourceMacros || []));
  return sourceMacros.every((macro) => {
    if (!Number.isInteger(macro) || macro < 0 || occupiedMacros.has(macro)) return false;
    const col = macro % bounds.macroWidth;
    const row = Math.floor(macro / bounds.macroWidth);
    return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
  });
}

function microCoordinateInPlayable(state, x, y) {
  const macroCol = Math.floor(x / state.playableBounds.microScale);
  const macroRow = Math.floor(y / state.playableBounds.microScale);
  const bounds = state.playableBounds;
  return x >= 0 && x < state.microWidth && y >= 0 && y < bounds.macroWidth * bounds.microScale
    && macroCol >= bounds.minCol && macroCol <= bounds.maxCol && macroRow >= bounds.minRow && macroRow <= bounds.maxRow;
}

function regionOwners(state) {
  return new Map(Object.values(state.regions).flatMap((region) => (region.micro || []).map((cell) => [cell, region.id])));
}

function shapeTouchesRegion(shape, regionId, owners, width) {
  for (const cell of shape) {
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    if (neighbors.some((neighbor) => !shape.has(neighbor) && owners.get(neighbor) === regionId)) return true;
  }
  return false;
}

function microBloomCandidates(state, sourceMacros) {
  if (!validOutgoingMacros(state, sourceMacros)) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", candidates: [] });
  const prepared = state.preparedOutgoing;
  if (prepared && (prepared.actor !== state.active || JSON.stringify(prepared.sourceMacros) !== JSON.stringify(sourceMacros))) {
    return Object.freeze({ ok: false, code: "PREPARED_SELECTION_MISMATCH", candidates: [] });
  }
  const base = new Set(prepared?.micro || sourceMacros.flatMap((macro) => macroMicroCells(macro, state)));
  const owners = regionOwners(state);
  const scale = state.playableBounds.microScale;
  const width = state.microWidth;
  const corners = [
    { name: "top-left", diagonal: [-1, -1], plan: [[-1, 0], [0, -1], [-1, -1]] },
    { name: "top-right", diagonal: [scale, -1], plan: [[scale, 0], [scale - 1, -1], [scale, -1]] },
    { name: "bottom-left", diagonal: [-1, scale], plan: [[-1, scale - 1], [0, scale], [-1, scale]] },
    { name: "bottom-right", diagonal: [scale, scale], plan: [[scale, scale - 1], [scale - 1, scale], [scale, scale]] },
  ];
  const candidates = [];
  for (const macro of sourceMacros) {
    const macroCol = macro % state.playableBounds.macroWidth;
    const macroRow = Math.floor(macro / state.playableBounds.macroWidth);
    const x0 = macroCol * scale;
    const y0 = macroRow * scale;
    for (const corner of corners) {
      const diagonalX = x0 + corner.diagonal[0];
      const diagonalY = y0 + corner.diagonal[1];
      if (!microCoordinateInPlayable(state, diagonalX, diagonalY)) continue;
      const diagonalCell = diagonalY * width + diagonalX;
      const diagonalRegion = owners.get(diagonalCell);
      if (!diagonalRegion || !state.regions[diagonalRegion]?.color || shapeTouchesRegion(base, diagonalRegion, owners, width)) continue;
      const plan = new Set();
      for (const [dx, dy] of corner.plan) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (!microCoordinateInPlayable(state, x, y)) continue;
        const cell = y * width + x;
        if (base.has(cell) || plan.has(cell)) continue;
        const owner = owners.get(cell);
        if (owner && !state.regions[owner]?.color) continue;
        const cellX = cell % width;
        const neighbors = [cell - width, cell + width];
        if (cellX > 0) neighbors.push(cell - 1);
        if (cellX < width - 1) neighbors.push(cell + 1);
        if (neighbors.some((neighbor) => base.has(neighbor) || plan.has(neighbor))) plan.add(cell);
      }
      if (!plan.size) continue;
      const expanded = new Set([...base, ...plan]);
      if (shapeTouchesRegion(expanded, diagonalRegion, owners, width)) {
        candidates.push(Object.freeze({ macro, corner: corner.name, diagonalRegion, plan: Object.freeze([...plan].sort((a, b) => a - b)), micro: Object.freeze([...expanded].sort((a, b) => a - b)) }));
      }
    }
  }
  return Object.freeze({ ok: true, candidates: Object.freeze(candidates) });
}

function cornerBloomPlan(state, sourceMacros, macro) {
  if (!validOutgoingMacros(state, sourceMacros)) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", plan: [], micro: [] });
  const prepared = state.preparedOutgoing;
  if (prepared && (prepared.actor !== state.active || JSON.stringify(prepared.sourceMacros) !== JSON.stringify(sourceMacros))) {
    return Object.freeze({ ok: false, code: "PREPARED_SELECTION_MISMATCH", plan: [], micro: [] });
  }
  if (!sourceMacros.includes(macro)) return Object.freeze({ ok: false, code: "INVALID_CORNER_BLOOM_TARGET", plan: [], micro: [] });
  const shape = new Set(prepared?.micro || sourceMacros.flatMap((sourceMacro) => macroMicroCells(sourceMacro, state)));
  const owners = regionOwners(state);
  const scale = state.playableBounds.microScale;
  const width = state.microWidth;
  const macroCol = macro % state.playableBounds.macroWidth;
  const macroRow = Math.floor(macro / state.playableBounds.macroWidth);
  const x0 = macroCol * scale;
  const y0 = macroRow * scale;
  const corners = [
    [[-1, 0], [0, -1], [-1, -1]],
    [[scale, 0], [scale - 1, -1], [scale, -1]],
    [[-1, scale - 1], [0, scale], [-1, scale]],
    [[scale, scale - 1], [scale - 1, scale], [scale, scale]],
  ];
  const planned = new Set();
  for (const corner of corners) {
    const cornerPlan = new Set();
    for (let pass = 0; pass < 3; pass += 1) {
      for (const [dx, dy] of corner) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (!microCoordinateInPlayable(state, x, y)) continue;
        const cell = y * width + x;
        if (shape.has(cell) || planned.has(cell) || cornerPlan.has(cell)) continue;
        const owner = owners.get(cell);
        if (owner && !state.regions[owner]?.color) continue;
        const cellX = cell % width;
        const neighbors = [cell - width, cell + width];
        if (cellX > 0) neighbors.push(cell - 1);
        if (cellX < width - 1) neighbors.push(cell + 1);
        if (neighbors.some((neighbor) => shape.has(neighbor) || planned.has(neighbor) || cornerPlan.has(neighbor))) cornerPlan.add(cell);
      }
    }
    for (const cell of cornerPlan) planned.add(cell);
  }
  return Object.freeze({
    ok: true,
    plan: Object.freeze([...planned].sort((a, b) => a - b)),
    micro: Object.freeze([...new Set([...shape, ...planned])].sort((a, b) => a - b)),
  });
}

function preparedOutgoingCandidates(state, sourceMacros, skills) {
  let shapes = [null];
  for (const skill of skills) {
    const nextShapes = [];
    for (const micro of shapes) {
      const candidateState = { ...state, preparedOutgoing: micro ? { actor: state.active, sourceMacros, micro, skills: [] } : null };
      if (skill === "areaMicroBloom") {
        const result = microBloomCandidates(candidateState, sourceMacros);
        if (result.ok) for (const candidate of result.candidates) nextShapes.push([...candidate.micro]);
      } else if (skill === "areaCornerBloom") {
        for (const macro of sourceMacros) {
          const result = cornerBloomPlan(candidateState, sourceMacros, macro);
          if (result.ok && result.plan.length) nextShapes.push([...result.micro]);
        }
      }
    }
    const unique = new Map(nextShapes.map((micro) => [JSON.stringify(micro), micro]));
    shapes = [...unique.values()];
  }
  return Object.freeze(shapes.map((micro) => Object.freeze(micro)));
}

function applyAreaMicroBloom({ state, actor, payload, random }) {
  const sourceMacros = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  if (sourceMacros.length !== payload.sourceMacros.length) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", state });
  const planned = microBloomCandidates(state, sourceMacros);
  if (!planned.ok) return Object.freeze({ ok: false, code: planned.code, state });
  if (!planned.candidates.length) return Object.freeze({ ok: false, code: "NO_MICRO_BLOOM_CANDIDATE", state });
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const picked = planned.candidates[Math.floor(draw * planned.candidates.length)];
  return resolved(state, actor, "areaMicroBloom", (next) => {
    next.preparedOutgoing = {
      actor,
      sourceMacros,
      micro: [...picked.micro],
      skills: [...new Set([...(next.preparedOutgoing?.skills || []), "areaMicroBloom"])],
    };
    next.publicLog.push(`T${next.turn} Player ${actor} used micro bloom at ${picked.macro} ${picked.corner}, creating edge contact with ${picked.diagonalRegion}.`);
  }, { macro: picked.macro, corner: picked.corner, diagonalRegion: picked.diagonalRegion, addedCount: picked.plan.length });
}

function applyAreaCornerBloom({ state, actor, payload }) {
  const sourceMacros = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  if (sourceMacros.length !== payload.sourceMacros.length) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", state });
  const planned = cornerBloomPlan(state, sourceMacros, payload.macro);
  if (!planned.ok) return Object.freeze({ ok: false, code: planned.code, state });
  if (!planned.plan.length) return Object.freeze({ ok: false, code: "NO_CORNER_BLOOM_CANDIDATE", state });
  return resolved(state, actor, "areaCornerBloom", (next) => {
    next.preparedOutgoing = {
      actor,
      sourceMacros,
      micro: [...planned.micro],
      skills: [...new Set([...(next.preparedOutgoing?.skills || []), "areaCornerBloom"])],
    };
    next.publicLog.push(`T${next.turn} Player ${actor} expanded all available corners of macro ${payload.macro}, adding ${planned.plan.length} microcells.`);
  }, { macro: payload.macro, addedCount: planned.plan.length });
}

function applyAreaDiePlus({ state, actor, hasLegalRegionOfSize }) {
  const desired = state.requiredSize + 1;
  if (desired > 5) return Object.freeze({ ok: false, code: "AREA_SIZE_MAX", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  if (typeof hasLegalRegionOfSize !== "function" || !hasLegalRegionOfSize(state, desired)) {
    return Object.freeze({ ok: false, code: "NO_LEGAL_REGION_SIZE", state });
  }
  return resolved(state, actor, "areaDiePlus", (next) => {
    next.requiredSize = desired;
    next.publicLog.push(`T${next.turn} Player ${actor} increased this turn's required area size to ${desired}.`);
  }, { requiredSize: desired });
}

function resizedBounds(state, mode, side) {
  if (!["expand", "shrink"].includes(mode) || !["top", "bottom", "left", "right"].includes(side)) return null;
  const bounds = state.playableBounds;
  const width = bounds.maxCol - bounds.minCol + 1;
  const height = bounds.maxRow - bounds.minRow + 1;
  const next = { ...bounds };
  if (mode === "expand") {
    if (side === "left" && bounds.minCol > 0) next.minCol -= 1;
    else if (side === "right" && bounds.maxCol < bounds.macroWidth - 1) next.maxCol += 1;
    else if (side === "top" && bounds.minRow > 0) next.minRow -= 1;
    else if (side === "bottom" && bounds.maxRow < bounds.macroWidth - 1) next.maxRow += 1;
    else return null;
  } else {
    if (["left", "right"].includes(side) && width <= 6) return null;
    if (["top", "bottom"].includes(side) && height <= 6) return null;
    if (side === "left") next.minCol += 1;
    else if (side === "right") next.maxCol -= 1;
    else if (side === "top") next.minRow += 1;
    else next.maxRow -= 1;
  }
  return next;
}

function playableMacros(bounds) {
  const result = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) result.push(row * bounds.macroWidth + col);
  }
  return result;
}

function applyAreaResize({ state, actor, payload, bestLegalSize }) {
  const nextBounds = resizedBounds(state, payload.mode, payload.side);
  if (!nextBounds) return Object.freeze({ ok: false, code: "BOARD_SIDE_UNAVAILABLE", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  if (typeof bestLegalSize !== "function") return Object.freeze({ ok: false, code: "LEGAL_SIZE_SERVICE_REQUIRED", state });
  const bonus = Math.max(0, state.requiredSize - state.baseRequiredSize);
  return resolved(state, actor, "areaResize", (next) => {
    const targets = new Set(next.trophyTargetMacros || playableMacros(state.playableBounds));
    next.playableBounds = nextBounds;
    if (payload.mode === "expand") {
      for (const macro of playableMacros(nextBounds)) targets.add(macro);
    }
    next.trophyTargetMacros = [...targets].sort((left, right) => left - right);
    const base = bestLegalSize(next, next.rolledSize);
    next.baseRequiredSize = base;
    if (base <= 0) {
      next.requiredSize = 0;
      next.status = "FINISHED";
      next.phase = "GAME_OVER";
      next.winner = actor;
      next.terminalReason = "BOARD_LOCK";
    } else {
      next.requiredSize = bestLegalSize(next, Math.min(5, base + bonus)) || base;
    }
    next.publicLog.push(`T${next.turn} Player ${actor} ${payload.mode === "expand" ? "expanded" : "shrunk"} the ${payload.side} writable board edge; colored geometry remains.`);
  }, { playableBounds: nextBounds });
}

function normalizeHalfShift(payload) {
  const axis = String(payload.axis || "").toUpperCase();
  const direction = String(payload.direction || "").toLowerCase();
  const index = Number(payload.index);
  if (!Number.isInteger(index) || !["ROW", "COLUMN"].includes(axis)) return null;
  const minus = ["minus", "left", "up", "-"].includes(direction);
  const plus = ["plus", "right", "down", "+"].includes(direction);
  if (!minus && !plus) return null;
  return { axis, index, delta: minus ? -2 : 2, direction: minus ? "minus" : "plus" };
}

function connected(cells, width) {
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

function connectedComponents(cells, width) {
  const remaining = new Set(cells);
  const parts = [];
  while (remaining.size) {
    const start = Math.min(...remaining);
    const part = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const cell = queue.shift();
      part.push(cell);
      const x = cell % width;
      const neighbors = [cell - width, cell + width];
      if (x > 0) neighbors.push(cell - 1);
      if (x < width - 1) neighbors.push(cell + 1);
      for (const neighbor of neighbors) if (remaining.delete(neighbor)) queue.push(neighbor);
    }
    parts.push(part.sort((a, b) => a - b));
  }
  return parts.sort((a, b) => a[0] - b[0]);
}

function sourceMacrosFromMicro(cells, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  return [...new Set(cells.map((cell) => {
    const x = cell % state.microWidth;
    const y = Math.floor(cell / state.microWidth);
    return Math.floor(y / scale) * macroWidth + Math.floor(x / scale);
  }))].sort((a, b) => a - b);
}

function planHalfShift(state, payload) {
  const request = normalizeHalfShift(payload);
  if (!request) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const width = state.microWidth;
  const height = macroWidth * scale;
  if (request.index < 0 || request.index >= macroWidth) return Object.freeze({ ok: false, code: "INVALID_SHIFT_BAND", state });
  const sets = {};
  let movedCount = 0;
  for (const [id, region] of Object.entries(state.regions)) {
    sets[id] = region.micro.map((cell) => {
      const x = cell % width;
      const y = Math.floor(cell / width);
      const inBand = request.axis === "ROW"
        ? Math.floor(y / scale) === request.index
        : Math.floor(x / scale) === request.index;
      if (!inBand) return cell;
      movedCount += 1;
      return request.axis === "ROW" ? cell + request.delta : cell + request.delta * width;
    });
  }
  if (!movedCount) return Object.freeze({ ok: false, code: "EMPTY_SHIFT_BAND", state });
  const occupied = new Set();
  let splitCount = 0;
  for (const cells of Object.values(sets)) {
    splitCount += Math.max(0, connectedComponents(cells, width).length - 1);
    for (const cell of cells) {
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (!Number.isInteger(cell) || x < 0 || x >= width || y < 0 || y >= height) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
      if (occupied.has(cell)) return Object.freeze({ ok: false, code: "SHIFT_OVERLAP", state });
      occupied.add(cell);
    }
  }
  return Object.freeze({ ok: true, ...request, movedCount, splitCount, sets });
}

function applyAreaHalfShift({ state, actor, payload }) {
  const plan = planHalfShift(state, payload);
  if (!plan.ok) return plan;
  return resolved(state, actor, "areaHalfShift", (next) => {
    for (const [id, cells] of Object.entries(plan.sets)) {
      next.regions[id].micro = [...cells].sort((a, b) => a - b);
      next.regions[id].sourceMacros = sourceMacrosFromMicro(cells, next);
    }
    let nextNumber = Math.max(0, ...Object.keys(next.regions).map((id) => Number(String(id).match(/\d+/)?.[0]) || 0)) + 1;
    for (const id of Object.keys(plan.sets).sort()) {
      const region = next.regions[id];
      const parts = connectedComponents(region.micro, next.microWidth);
      region.micro = parts[0];
      region.sourceMacros = sourceMacrosFromMicro(parts[0], next);
      for (const part of parts.slice(1)) {
        const newId = `R${nextNumber}`;
        nextNumber += 1;
        next.regions[newId] = {
          ...region,
          id: newId,
          micro: part,
          sourceMacros: sourceMacrosFromMicro(part, next),
          controllers: [...(region.controllers || [])],
          isPending: false,
        };
      }
    }
    const ids = Object.keys(next.regions).sort();
    for (const id of ids) if (next.regions[id]) mergeSameColorComponent(next, id);
    next.publicLog.push(`T${next.turn} Player ${actor} shifted ${plan.axis} ${plan.index} ${plan.direction} by half a macro cell${plan.splitCount ? `; split into ${plan.splitCount + 1} components` : ""}.`);
  }, { movedCount: plan.movedCount, splitCount: plan.splitCount, axis: plan.axis, index: plan.index, direction: plan.direction });
}

function planTripleShift(state, payload) {
  const request = normalizeHalfShift(payload);
  if (!request) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const width = state.microWidth;
  const height = macroWidth * scale;
  if (request.index <= 0 || request.index >= macroWidth - 1) return Object.freeze({ ok: false, code: "INVALID_SHIFT_BAND", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  const deltaByBand = new Map([
    [request.index - 1, request.delta],
    [request.index, request.delta * 2],
    [request.index + 1, request.delta],
  ]);
  const sets = {};
  let movedCount = 0;
  let outsideWorld = false;
  for (const [id, region] of Object.entries(state.regions)) {
    const cells = region.micro.map((cell) => {
      const x = cell % width;
      const y = Math.floor(cell / width);
      const band = request.axis === "ROW" ? Math.floor(y / scale) : Math.floor(x / scale);
      const delta = deltaByBand.get(band) || 0;
      if (!delta) return cell;
      movedCount += 1;
      const nextX = request.axis === "ROW" ? x + delta : x;
      const nextY = request.axis === "COLUMN" ? y + delta : y;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) outsideWorld = true;
      return nextY * width + nextX;
    });
    if (outsideWorld) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
    if (!connected(cells, width)) return Object.freeze({ ok: false, code: "SHIFT_DISCONNECTS_REGION", state });
    sets[id] = cells;
  }
  if (!movedCount) return Object.freeze({ ok: false, code: "EMPTY_SHIFT_BAND", state });
  const occupied = new Set();
  for (const cells of Object.values(sets)) {
    for (const cell of cells) {
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (!Number.isInteger(cell) || x < 0 || x >= width || y < 0 || y >= height) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
      if (occupied.has(cell)) return Object.freeze({ ok: false, code: "SHIFT_OVERLAP", state });
      occupied.add(cell);
    }
  }
  return Object.freeze({ ok: true, ...request, movedCount, sets });
}

function applyAreaTripleShift({ state, actor, payload }) {
  const plan = planTripleShift(state, payload);
  if (!plan.ok) return plan;
  return resolved(state, actor, "areaTripleShift", (next) => {
    for (const [id, cells] of Object.entries(plan.sets)) {
      next.regions[id].micro = [...cells].sort((a, b) => a - b);
      next.regions[id].sourceMacros = sourceMacrosFromMicro(cells, next);
    }
    const ids = Object.keys(next.regions).sort();
    for (const id of ids) if (next.regions[id]) mergeSameColorComponent(next, id);
    next.publicLog.push(`T${next.turn} Player ${actor} shifted ${plan.axis} ${plan.index} ${plan.direction}; the center band moved one macro and both adjacent bands moved half a macro.`);
  }, { movedCount: plan.movedCount, axis: plan.axis, index: plan.index, direction: plan.direction });
}

function applyDisruptChoiceOne({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceOne", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 1);
    next.privateEffects[actor] = next.privateEffects[actor] || {};
    next.privateEffects[actor].curseBacklash = (next.privateEffects[actor].curseBacklash || 0) + 1;
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target}; curse backlash is pending.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptChoiceTwo({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceTwo", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 2);
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target} for the next two colorings.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptChoiceThree({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceThree", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 3);
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target} for the next three colorings.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptRandomOne({ state, actor, random }) {
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const color = COLORS[Math.floor(draw * COLORS.length)];
  return resolved(state, actor, "disruptRandomOne", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[color] = Math.max(next.publicEffects[target].seals[color] || 0, 1);
    next.publicLog.push(`T${next.turn} Player ${actor} randomly sealed ${color} for Player ${target} for the next coloring.`);
  }, { color, target: other(actor) });
}

function applyDisruptRandomTwo({ state, actor, random }) {
  const firstDraw = Number(random());
  const secondDraw = Number(random());
  if (![firstDraw, secondDraw].every((draw) => Number.isFinite(draw) && draw >= 0 && draw < 1)) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const remaining = [...COLORS];
  const colors = [remaining.splice(Math.floor(firstDraw * remaining.length), 1)[0]];
  colors.push(remaining[Math.floor(secondDraw * remaining.length)]);
  return resolved(state, actor, "disruptRandomTwo", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    for (const color of colors) next.publicEffects[target].seals[color] = Math.max(next.publicEffects[target].seals[color] || 0, 1);
    next.publicLog.push(`T${next.turn} Player ${actor} randomly sealed ${colors.join(",")} for Player ${target} for the next coloring.`);
  }, { colors, target: other(actor) });
}

function applyDisruptPaletteRandom({ state, actor, random }) {
  const colorDraw = Number(random());
  const slotDraw = Number(random());
  if (![colorDraw, slotDraw].every((draw) => Number.isFinite(draw) && draw >= 0 && draw < 1)) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = COLORS[Math.floor(colorDraw * COLORS.length)];
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptPaletteRandom", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    const previousColor = paletteColorAt(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.privateEffects[target].paletteDebuffs = [{ slot, previousColor, injectedColor: color, remaining: 1 }, ...(next.privateEffects[target].paletteDebuffs || [])];
    next.publicLog.push(`T${next.turn} Player ${actor} randomly injected ${color} into one private palette slot of Player ${target} for the next coloring.`);
  }, { color, target });
}

function applyDisruptPaletteChoice({ state, actor, payload, random }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const slotDraw = Number(random());
  if (!Number.isFinite(slotDraw) || slotDraw < 0 || slotDraw >= 1) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = payload.color;
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptPaletteChoice", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    const previousColor = paletteColorAt(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.privateEffects[target].paletteDebuffs = [{ slot, previousColor, injectedColor: color, remaining: 2 }, ...(next.privateEffects[target].paletteDebuffs || [])];
    next.publicLog.push(`T${next.turn} Player ${actor} injected chosen ${color} into one private palette slot of Player ${target} for the next two colorings.`);
  }, { color, target });
}

function applyDisruptForcedPalette({ state, actor, payload, random }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const slotDraw = Number(random());
  if (!Number.isFinite(slotDraw) || slotDraw < 0 || slotDraw >= 1) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = payload.color;
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptForcedPalette", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.publicLog.push(`T${next.turn} Player ${actor} permanently injected chosen ${color} into one private palette slot of Player ${target}.`);
  }, { color, target });
}

function paletteBeforeSeals(state, actor) {
  const colors = new Set(state.basicPalettes[actor]);
  if (state.bonusUsesRemaining[actor] > 0) colors.add(state.bonusColors[actor]);
  if (state.privateEffects[actor]?.prism) for (const color of COLORS) colors.add(color);
  return [...colors];
}

function applyCurseBacklashOnEnterColor(state, actor, random) {
  const count = Math.max(0, Number(state.privateEffects[actor]?.curseBacklash) || 0);
  if (!count) return state;
  state.publicEffects[actor] = state.publicEffects[actor] || { seals: {} };
  state.publicEffects[actor].seals = state.publicEffects[actor].seals || {};
  const sealed = [];
  for (let index = 0; index < count; index += 1) {
    const candidates = paletteBeforeSeals(state, actor).filter((color) => !(state.publicEffects[actor].seals[color] > 0));
    if (!candidates.length) break;
    const draw = Number(random());
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
    const color = candidates[Math.floor(draw * candidates.length)];
    state.publicEffects[actor].seals[color] = Math.max(state.publicEffects[actor].seals[color] || 0, 1);
    sealed.push(color);
  }
  delete state.privateEffects[actor].curseBacklash;
  state.publicLog.push(sealed.length
    ? `Curse backlash sealed ${sealed.join(",")} for Player ${actor} for this coloring.`
    : `Curse backlash resolved empty for Player ${actor}.`);
  return state;
}

function tickSealsAfterColor(state, actor) {
  const seals = state.publicEffects?.[actor]?.seals || {};
  for (const color of COLORS) if (seals[color] > 0) seals[color] -= 1;
  return state;
}

function tickPaletteDebuffsAfterColor(state, actor) {
  const effects = state.privateEffects?.[actor]?.paletteDebuffs || [];
  const remaining = [];
  for (const effect of effects) {
    const nextRemaining = effect.remaining - 1;
    if (nextRemaining > 0) remaining.push({ ...effect, remaining: nextRemaining });
    else if (paletteColorAt(state, actor, effect.slot) === effect.injectedColor) setPaletteColorAt(state, actor, effect.slot, effect.previousColor);
  }
  if (remaining.length) state.privateEffects[actor].paletteDebuffs = remaining;
  else if (state.privateEffects?.[actor]) delete state.privateEffects[actor].paletteDebuffs;
  return state;
}

module.exports = {
  applyAreaCornerBloom,
  applyAreaDiePlus,
  applyAreaHalfShift,
  applyAreaMicroBloom,
  applyAreaResize,
  applyAreaTripleShift,
  applyColorChoiceBorrow,
  applyColorPaletteChange,
  applyColorRandomBorrow,
  applyColorPrism,
  applyColorRegionSplit,
  applyCurseBacklashOnEnterColor,
  applyDisruptChoiceOne,
  applyDisruptChoiceThree,
  applyDisruptChoiceTwo,
  applyDisruptForcedPalette,
  applyDisruptPaletteChoice,
  applyDisruptRandomOne,
  applyDisruptRandomTwo,
  applyDisruptPaletteRandom,
  microBloomCandidates,
  cornerBloomPlan,
  preparedOutgoingCandidates,
  planHalfShift,
  planTripleShift,
  tickSealsAfterColor,
  tickPaletteDebuffsAfterColor,
};

},
"standard/standard-skill-dispatcher.js":function(require,module,exports){
"use strict";

const { COLORS, StandardRuleError, applyLegalRecolor } = require("./standard-engine.js");
const { STANDARD_SKILLS } = require("./standard-skill-registry.js");
const { applyAreaCornerBloom, applyAreaDiePlus, applyAreaHalfShift, applyAreaMicroBloom, applyAreaResize, applyAreaTripleShift, applyColorChoiceBorrow, applyColorPaletteChange, applyColorRandomBorrow, applyColorPrism, applyColorRegionSplit, applyDisruptChoiceOne, applyDisruptChoiceThree, applyDisruptChoiceTwo, applyDisruptForcedPalette, applyDisruptPaletteChoice, applyDisruptPaletteRandom, applyDisruptRandomOne, applyDisruptRandomTwo } = require("./standard-skill-handlers.js");

const SKILL_RESULT = Object.freeze({ REJECTED: "REJECTED", CANCELLED: "CANCELLED", RESOLVED: "RESOLVED" });

function rejected(code, state) {
  return Object.freeze({ ok: false, status: SKILL_RESULT.REJECTED, code, state });
}

function nextRandom(rngStreams, name, counter) {
  const source = rngStreams?.[name];
  const value = typeof source === "function" ? source() : source?.next?.();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new StandardRuleError(`RNG_REQUIRED_${name.toUpperCase().replaceAll("-", "_")}`, "Named RNG stream is required");
  counter.count += 1;
  return value;
}

function validateTargetSchema(definition, payload) {
  if (!definition.targetSchema) return true;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (definition.id === "legalRecolor") return typeof payload.regionId === "string" && payload.regionId.length > 0;
  if (definition.id === "colorPrism") return true;
  if (definition.id === "colorChoiceBorrow") return typeof payload.color === "string" && COLORS.includes(payload.color);
  if (definition.id === "colorPaletteChange") return Number.isInteger(payload.slot) && payload.slot >= 0 && payload.slot <= 2 && typeof payload.color === "string" && COLORS.includes(payload.color);
  if (definition.id === "colorRegionSplit") return typeof payload.regionId === "string" && payload.regionId.length > 0
    && Array.isArray(payload.sourceMacros) && payload.sourceMacros.every(Number.isInteger);
  if (definition.id === "areaMicroBloom") return Array.isArray(payload.sourceMacros) && payload.sourceMacros.every(Number.isInteger);
  if (definition.id === "areaCornerBloom") return Array.isArray(payload.sourceMacros) && payload.sourceMacros.every(Number.isInteger) && Number.isInteger(payload.macro);
  if (definition.id === "areaResize") return ["expand", "shrink"].includes(payload.mode) && ["top", "bottom", "left", "right"].includes(payload.side);
  if (["disruptChoiceOne", "disruptChoiceTwo", "disruptChoiceThree", "disruptPaletteChoice", "disruptForcedPalette"].includes(definition.id)) return typeof payload.color === "string";
  if (definition.id === "areaHalfShift") return typeof payload.axis === "string" && Number.isInteger(payload.index) && typeof payload.direction === "string";
  if (definition.id === "areaTripleShift") return typeof payload.axis === "string" && Number.isInteger(payload.index) && typeof payload.direction === "string";
  return true;
}

const HANDLERS = Object.freeze({
  colorRandomBorrow({ state, actor, rngStreams, draws }) {
    return applyColorRandomBorrow({ state, actor, random: () => nextRandom(rngStreams, "skill-effect", draws) });
  },
  colorChoiceBorrow: applyColorChoiceBorrow,
  colorPaletteChange: applyColorPaletteChange,
  colorRegionSplit: applyColorRegionSplit,
  colorPrism: applyColorPrism,
  areaMicroBloom({ state, actor, payload, rngStreams, draws }) {
    return applyAreaMicroBloom({ state, actor, payload, random: () => nextRandom(rngStreams, "skill-effect", draws) });
  },
  areaCornerBloom: applyAreaCornerBloom,
  areaDiePlus: applyAreaDiePlus,
  areaResize: applyAreaResize,
  areaHalfShift: applyAreaHalfShift,
  areaTripleShift: applyAreaTripleShift,
  disruptChoiceOne: applyDisruptChoiceOne,
  disruptChoiceTwo: applyDisruptChoiceTwo,
  disruptChoiceThree: applyDisruptChoiceThree,
  disruptRandomOne({ state, actor, rngStreams, draws }) {
    return applyDisruptRandomOne({ state, actor, random: () => nextRandom(rngStreams, "skill-effect", draws) });
  },
  disruptRandomTwo({ state, actor, rngStreams, draws }) {
    return applyDisruptRandomTwo({ state, actor, random: () => nextRandom(rngStreams, "skill-effect", draws) });
  },
  disruptPaletteRandom({ state, actor, rngStreams, draws }) {
    return applyDisruptPaletteRandom({ state, actor, random: () => nextRandom(rngStreams, "skill-effect", draws) });
  },
  disruptPaletteChoice({ state, actor, payload, rngStreams, draws }) {
    return applyDisruptPaletteChoice({ state, actor, payload, random: () => nextRandom(rngStreams, "skill-effect", draws) });
  },
  disruptForcedPalette({ state, actor, payload, rngStreams, draws }) {
    return applyDisruptForcedPalette({ state, actor, payload, random: () => nextRandom(rngStreams, "skill-effect", draws) });
  },
  legalRecolor({ state, actor, payload, rngStreams, draws }) {
    return applyLegalRecolor(state, actor, payload.regionId, {
      effectRandom: () => nextRandom(rngStreams, "skill-effect", draws),
    });
  },
});

function dispatchStandardSkillAction({ state, actor, action, expectedVersion, rngStreams = {}, validateState, projectPublic, projectPrivate, hasLegalRegionOfSize, bestLegalSize }) {
  validateState(state);
  if (!action || action.type !== "USE_SKILL" || !action.payload || typeof action.payload.skill !== "string") return rejected("INVALID_SKILL_ACTION", state);
  if (actor !== "A" && actor !== "B") return rejected("NOT_A_PLAYER", state);
  if (expectedVersion !== state.version) return rejected("VERSION_CONFLICT", state);
  if (state.status === "FINISHED") return rejected("MATCH_FINISHED", state);
  const definition = STANDARD_SKILLS[action.payload.skill];
  if (!definition) return rejected("UNKNOWN_SKILL", state);
  if (!definition.implemented || !HANDLERS[definition.id]) return rejected("SKILL_NOT_IMPLEMENTED", state);
  if (state.active !== actor) return rejected("NOT_YOUR_TURN", state);
  const timingMatches = definition.timing === "WORK"
    ? state.phase === "WORK" || state.phase === "CREATE_FIRST"
    : state.phase === definition.timing;
  if (!timingMatches) return rejected("WRONG_PHASE", state);
  if ((state.hands?.[actor]?.[definition.id] || 0) <= 0) return rejected("SKILL_UNAVAILABLE", state);
  if (definition.experimental && state.interferenceLock) return rejected("INTERFERENCE_CHAINED", state);
  if (!validateTargetSchema(definition, action.payload)) return rejected("INVALID_TARGET_SCHEMA", state);

  const draws = { count: 0 };
  try {
    const applied = HANDLERS[definition.id]({ state, actor, payload: action.payload, rngStreams, draws, hasLegalRegionOfSize, bestLegalSize });
    if (!applied.ok) {
      if (draws.count !== 0) throw new Error("REJECTED_SKILL_CONSUMED_RNG");
      return rejected(applied.code, state);
    }
    if (applied.state.version !== state.version + 1) throw new Error("VERSION_INCREMENT_INVARIANT");
    if (typeof definition.expectedRngDraws === "number" && draws.count !== definition.expectedRngDraws) throw new Error("RNG_DRAW_COUNT_INVARIANT");
    validateState(applied.state);
    return Object.freeze({
      ...applied,
      ok: true,
      status: SKILL_RESULT.RESOLVED,
      definition,
      rngDraws: draws.count,
      publicState: projectPublic(applied.state),
      privateState: projectPrivate(applied.state, actor),
    });
  } catch (error) {
    if (error instanceof StandardRuleError) return rejected(error.code, state);
    throw error;
  }
}

function cancelStandardSkillSelection() {
  return Object.freeze({ ok: false, status: SKILL_RESULT.CANCELLED, dispatched: false, actionIdIssued: false });
}

module.exports = { SKILL_RESULT, cancelStandardSkillSelection, dispatchStandardSkillAction };

},
"standard/standard-match.js":function(require,module,exports){
"use strict";

const {
  COLORS,
  StandardRuleError,
  adjacentRegionIds,
} = require("./standard-engine.js");
const { dispatchStandardSkillAction } = require("./standard-skill-dispatcher.js");
const { applyCurseBacklashOnEnterColor, preparedOutgoingCandidates, tickPaletteDebuffsAfterColor, tickSealsAfterColor } = require("./standard-skill-handlers.js");

const SCHEMA_VERSION = 1;
const ENGINE_VERSION = "5.0.0-alpha.1";
const SAVE_KEY = "fourColorMapGame.standard.v5.save";
const PHASES = Object.freeze(["CREATE_FIRST", "COLOR", "WORK", "GAME_OVER"]);
const ACTIONS = Object.freeze(["CREATE_REGION", "COLOR_REGION", "USE_SKILL", "DECLARE_NO_COLOR", "SURRENDER"]);
const REQUIRED_RNG_STREAMS = Object.freeze([
  "match-init", "palette", "bonus-color", "bonus-use-count", "die", "skill-effect",
  "cpu-A", "cpu-B", "cpu-tie-break", "quiz-structure", "quiz-content",
  "quiz-choice-order", "quiz-choice-rank", "quiz-cosmetic-motion", "gacha",
]);
const DIE_POOL = Object.freeze([1, 1, 2, 2, 3, 4]);
const BONUS_USE_POOL = Object.freeze([1, 1, 2, 2, 3, 4]);
const TERMINAL_REASONS = Object.freeze(["ILLEGAL_COLOR", "BOARD_LOCK", "SURRENDER", "SEALED_OUT", "NO_LEGAL_COLOR"]);
const ENGINE_TERMINAL_REASONS = TERMINAL_REASONS;
const FINISHED_STATE_TERMINAL_REASONS = TERMINAL_REASONS;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fail(code, state) {
  return Object.freeze({ ok: false, code, state });
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function assertState(condition, code) {
  if (!condition) throw new StandardRuleError(code, code);
}

function nextRandom(rngStreams, name) {
  const source = rngStreams?.[name];
  const value = typeof source === "function" ? source() : source?.next?.();
  assertState(Number.isFinite(value) && value >= 0 && value < 1, "RNG_REQUIRED_" + name.toUpperCase().replaceAll("-", "_"));
  return value;
}

function shuffledColors(rngStreams) {
  const values = [...COLORS];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(nextRandom(rngStreams, "palette") * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values.slice(0, 3);
}

function initialSeatSecrets(rngStreams) {
  const palette = shuffledColors(rngStreams);
  const bonus = palette[Math.floor(nextRandom(rngStreams, "bonus-color") * palette.length)];
  const basic = palette.filter((color) => color !== bonus);
  const uses = BONUS_USE_POOL[Math.floor(nextRandom(rngStreams, "bonus-use-count") * BONUS_USE_POOL.length)];
  return { basic, bonus, uses };
}

function paletteSignature(secrets) {
  return [...secrets.basic, secrets.bonus].sort().join("|");
}

function handFromLoadout(loadout = {}) {
  const hand = {};
  for (const entries of Object.values(loadout)) {
    for (const skill of Array.isArray(entries) ? entries : []) hand[skill] = 1;
  }
  return hand;
}

function playableMacroIndices(bounds) {
  const result = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) result.push(row * bounds.macroWidth + col);
  }
  return result;
}

function createStandardMatch(config = {}, rngStreams = {}) {
  assertState(typeof config.matchId === "string" && config.matchId.length > 0, "MATCH_ID_REQUIRED");
  const A = initialSeatSecrets(rngStreams);
  let B = initialSeatSecrets(rngStreams);
  for (let retries = 0; paletteSignature(B) === paletteSignature(A) && retries < 15; retries += 1) {
    B = initialSeatSecrets(rngStreams);
  }
  if (paletteSignature(B) === paletteSignature(A)) {
    const missing = COLORS.find((color) => ![...B.basic, B.bonus].includes(color));
    B = { ...B, basic: [B.basic[1], missing] };
  }
  const active = config.firstSeat || (nextRandom(rngStreams, "match-init") < 0.5 ? "A" : "B");
  const rolledSize = DIE_POOL[Math.floor(nextRandom(rngStreams, "die") * DIE_POOL.length)];
  const loadouts = clone(config.loadouts || { A: {}, B: {} });
  const playableBounds = clone(config.playableBounds || { minCol: 1, maxCol: 10, minRow: 1, maxRow: 10, macroWidth: 12, microScale: 4 });
  const state = {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    mode: "standard",
    matchId: config.matchId,
    status: "ACTIVE",
    version: 0,
    turn: 1,
    active,
    phase: "CREATE_FIRST",
    regions: {},
    pending: null,
    reserved: null,
    preparedOutgoing: null,
    playableBounds,
    trophyTargetMacros: playableMacroIndices(playableBounds),
    microWidth: Number(config.microWidth) || 48,
    requiredSize: rolledSize,
    rolledSize,
    baseRequiredSize: rolledSize,
    basicPalettes: { A: A.basic, B: B.basic },
    bonusColors: { A: A.bonus, B: B.bonus },
    bonusUsesRemaining: { A: A.uses, B: B.uses },
    hands: config.hands ? clone(config.hands) : { A: handFromLoadout(loadouts.A), B: handFromLoadout(loadouts.B) },
    loadouts,
    publicEffects: clone(config.publicEffects || { A: { seals: {} }, B: { seals: {} } }),
    privateEffects: clone(config.privateEffects || { A: {}, B: {} }),
    interferenceLock: false,
    skillsUsed: { A: 0, B: 0 },
    winner: null,
    terminalReason: null,
    publicLog: ["Standard match created."],
  };
  validateStandardState(state);
  return state;
}

function validateStandardState(state) {
  assertState(state && typeof state === "object", "INVALID_STATE");
  assertState(state.schemaVersion === SCHEMA_VERSION, "INVALID_SCHEMA_VERSION");
  assertState(state.engineVersion === ENGINE_VERSION, "INVALID_ENGINE_VERSION");
  assertState(state.mode === "standard", "WRONG_MODE");
  assertState(typeof state.matchId === "string" && state.matchId.length > 0, "INVALID_MATCH_ID");
  assertState(Number.isInteger(state.version) && state.version >= 0, "INVALID_VERSION");
  assertState(Number.isInteger(state.turn) && state.turn >= 1, "INVALID_TURN");
  assertState(state.active === "A" || state.active === "B", "INVALID_ACTIVE_SEAT");
  assertState(PHASES.includes(state.phase), "INVALID_PHASE");
  assertState(state.status === "ACTIVE" || state.status === "FINISHED", "INVALID_STATUS");
  assertState(Number.isInteger(state.rolledSize) && state.rolledSize >= 1 && state.rolledSize <= 4, "INVALID_ROLLED_SIZE");
  assertState(Number.isInteger(state.baseRequiredSize) && state.baseRequiredSize >= 0 && state.baseRequiredSize <= 4, "INVALID_BASE_REQUIRED_SIZE");
  assertState(Number.isInteger(state.requiredSize) && state.requiredSize >= 0 && state.requiredSize <= 5, "INVALID_REQUIRED_SIZE");
  if (state.status === "ACTIVE") assertState(state.baseRequiredSize >= 1 && state.requiredSize >= 1, "INVALID_REQUIRED_SIZE");
  const bounds = state.playableBounds;
  assertState(bounds && [bounds.minCol, bounds.maxCol, bounds.minRow, bounds.maxRow, bounds.macroWidth, bounds.microScale].every(Number.isInteger)
    && bounds.macroWidth >= 6 && bounds.microScale >= 1 && state.microWidth === bounds.macroWidth * bounds.microScale
    && bounds.minCol >= 0 && bounds.minCol <= bounds.maxCol && bounds.maxCol < bounds.macroWidth
    && bounds.minRow >= 0 && bounds.minRow <= bounds.maxRow && bounds.maxRow < bounds.macroWidth
    && bounds.maxCol - bounds.minCol + 1 >= 6 && bounds.maxRow - bounds.minRow + 1 >= 6, "INVALID_PLAYABLE_BOUNDS");
  assertState(state.trophyTargetMacros === undefined || (Array.isArray(state.trophyTargetMacros)
    && new Set(state.trophyTargetMacros).size === state.trophyTargetMacros.length
    && state.trophyTargetMacros.every((macro) => Number.isInteger(macro) && macro >= 0 && macro < bounds.macroWidth * bounds.macroWidth)), "INVALID_TROPHY_TARGETS");
  const trophyTargets = new Set(state.trophyTargetMacros || playableMacroIndices(bounds));
  assertState(playableMacroIndices(bounds).every((macro) => trophyTargets.has(macro)), "INVALID_TROPHY_TARGETS");
  const worldMicroCount = state.microWidth * bounds.macroWidth * bounds.microScale;
  assertState(Boolean(state.regions) && typeof state.regions === "object", "INVALID_REGIONS");
  assertState(Boolean(state.hands) && Boolean(state.loadouts), "INVALID_CARDS");
  assertState(typeof state.interferenceLock === "boolean", "INVALID_INTERFERENCE_LOCK");
  assertState(Array.isArray(state.publicLog), "INVALID_PUBLIC_LOG");
  if (state.preparedOutgoing !== null && state.preparedOutgoing !== undefined) {
    const prepared = state.preparedOutgoing;
    assertState((prepared.actor === "A" || prepared.actor === "B") && Array.isArray(prepared.sourceMacros)
      && prepared.sourceMacros.length > 0 && new Set(prepared.sourceMacros).size === prepared.sourceMacros.length
      && prepared.sourceMacros.every((macro) => Number.isInteger(macro) && macro >= 0)
      && Array.isArray(prepared.micro) && prepared.micro.length > 0 && new Set(prepared.micro).size === prepared.micro.length
      && prepared.micro.every((cell) => Number.isInteger(cell) && cell >= 0)
      && Array.isArray(prepared.skills) && prepared.skills.length > 0
      && new Set(prepared.skills).size === prepared.skills.length
      && prepared.skills.every((skill) => ["areaMicroBloom", "areaCornerBloom"].includes(skill)), "INVALID_PREPARED_OUTGOING");
    const microHeight = bounds.macroWidth * bounds.microScale;
    assertState(state.status === "ACTIVE" && ["CREATE_FIRST", "WORK"].includes(state.phase)
      && prepared.actor === state.active && state.pending === null
      && prepared.sourceMacros.length === state.requiredSize
      && isConnected(prepared.sourceMacros, bounds.macroWidth)
      && prepared.sourceMacros.every((macro) => {
        const col = macro % bounds.macroWidth;
        const row = Math.floor(macro / bounds.macroWidth);
        return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
      })
      && prepared.micro.every((cell) => cell < state.microWidth * microHeight), "INVALID_PREPARED_OUTGOING");
    const uncoloredOccupied = new Set(Object.values(state.regions).filter((region) => !region.color).flatMap((region) => region.micro || []));
    assertState(prepared.micro.every((cell) => !uncoloredOccupied.has(cell)) && isConnected(prepared.micro, state.microWidth), "INVALID_PREPARED_OUTGOING");
    const candidates = preparedOutgoingCandidates({ ...state, preparedOutgoing: null }, prepared.sourceMacros, prepared.skills);
    assertState(candidates.some((candidate) => JSON.stringify(candidate) === JSON.stringify(prepared.micro)), "INVALID_PREPARED_OUTGOING");
  }
  const occupied = new Set();
  const pendingRegionIds = [];
  const reservedRegionIds = [];
  for (const [id, region] of Object.entries(state.regions)) {
    assertState(region?.id === id && Array.isArray(region.micro), "INVALID_REGION");
    if (region.isPending) {
      pendingRegionIds.push(id);
      assertState(region.color === null || region.color === undefined, "INVALID_PENDING_STATE");
    }
    if (region.isReserved) {
      reservedRegionIds.push(id);
      assertState(!region.isPending && (region.color === null || region.color === undefined), "INVALID_RESERVED_STATE");
    }
    for (const cell of region.micro) {
      assertState(Number.isInteger(cell) && cell >= 0 && cell < worldMicroCount && !occupied.has(cell), "INVALID_REGION_GEOMETRY");
      occupied.add(cell);
    }
  }
  assertState(pendingRegionIds.length <= 1, "INVALID_PENDING_STATE");
  if (state.pending === null) assertState(pendingRegionIds.length === 0, "INVALID_PENDING_STATE");
  else assertState(pendingRegionIds.length === 1 && pendingRegionIds[0] === state.pending, "INVALID_PENDING_STATE");
  assertState(reservedRegionIds.length <= 1, "INVALID_RESERVED_STATE");
  if (state.reserved === null || state.reserved === undefined) assertState(reservedRegionIds.length === 0, "INVALID_RESERVED_STATE");
  else assertState(reservedRegionIds.length === 1 && reservedRegionIds[0] === state.reserved && state.reserved !== state.pending, "INVALID_RESERVED_STATE");
  for (const seat of ["A", "B"]) {
    const basic = state.basicPalettes?.[seat];
    const bonus = state.bonusColors?.[seat];
    assertState(Array.isArray(basic) && basic.length === 2, "INVALID_PALETTE");
    assertState([...basic, bonus].every((color) => COLORS.includes(color)), "INVALID_PALETTE");
    assertState(Number.isInteger(state.bonusUsesRemaining?.[seat]) && state.bonusUsesRemaining[seat] >= 0, "INVALID_BONUS_USES");
    const temporaryColors = state.privateEffects?.[seat]?.temporaryColors;
    assertState(temporaryColors === undefined || (Array.isArray(temporaryColors)
      && temporaryColors.every((color) => COLORS.includes(color))
      && new Set(temporaryColors).size === temporaryColors.length), "INVALID_TEMPORARY_COLORS");
    const paletteDebuffs = state.privateEffects?.[seat]?.paletteDebuffs;
    assertState(paletteDebuffs === undefined || (Array.isArray(paletteDebuffs)
      && new Set(paletteDebuffs.map((effect) => effect.slot)).size === paletteDebuffs.length
      && paletteDebuffs.every((effect) => effect && Number.isInteger(effect.slot) && effect.slot >= 0 && effect.slot <= 2
        && COLORS.includes(effect.previousColor) && COLORS.includes(effect.injectedColor)
        && Number.isInteger(effect.remaining) && effect.remaining >= 1 && effect.remaining <= 2
        && (effect.slot < 2 ? state.basicPalettes[seat][effect.slot] : state.bonusColors[seat]) === effect.injectedColor)), "INVALID_PALETTE_DEBUFFS");
  }
  if (state.status === "FINISHED") assertState(state.phase === "GAME_OVER" && ["A", "B"].includes(state.winner) && FINISHED_STATE_TERMINAL_REASONS.includes(state.terminalReason), "INVALID_TERMINAL_STATE");
  if (state.phase === "GAME_OVER") assertState(state.status === "FINISHED", "INVALID_TERMINAL_STATE");
  return true;
}

function projectStandardPublicState(state) {
  validateStandardState(state);
  const keys = ["schemaVersion", "engineVersion", "mode", "matchId", "status", "version", "turn", "active", "phase", "regions", "pending", "reserved", "preparedOutgoing", "playableBounds", "trophyTargetMacros", "requiredSize", "rolledSize", "baseRequiredSize", "publicEffects", "interferenceLock", "winner", "terminalReason", "publicLog"];
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, clone(key === "trophyTargetMacros"
    ? (state.trophyTargetMacros || playableMacroIndices(state.playableBounds))
    : state[key])] )));
}

function projectStandardPrivateState(state, seat) {
  validateStandardState(state);
  assertState(seat === "A" || seat === "B", "NOT_A_PLAYER");
  return Object.freeze({
    seat,
    basicPalette: clone(state.basicPalettes[seat]),
    bonusColor: state.bonusColors[seat],
    bonusUsesRemaining: state.bonusUsesRemaining[seat],
    hand: clone(state.hands[seat]),
    loadout: clone(state.loadouts[seat]),
    privateEffects: clone(state.privateEffects[seat]),
  });
}

function isMapCompleteWin(state) {
  validateStandardState(state);
  if (state.status !== "FINISHED" || state.terminalReason !== "BOARD_LOCK" || !["A", "B"].includes(state.winner)) return false;
  const coloredOwners = new Set(Object.values(state.regions).filter((region) => region.color).flatMap((region) => region.micro || []));
  for (const macro of state.trophyTargetMacros || playableMacroIndices(state.playableBounds)) {
    if (macroMicroCells(macro, state.playableBounds, state.microWidth).some((cell) => !coloredOwners.has(cell))) return false;
  }
  return Object.values(state.regions).every((region) => Boolean(region.color) && !region.isPending);
}

function regionNumber(id) {
  const match = String(id).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function isConnected(cellsInput, width) {
  if (!cellsInput.length) return false;
  const cells = new Set(cellsInput);
  const seen = new Set([cellsInput[0]]);
  const queue = [cellsInput[0]];
  while (queue.length) {
    const cell = queue.shift();
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    for (const neighbor of neighbors) if (cells.has(neighbor) && !seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
  }
  return seen.size === cells.size;
}

function connectedComponents(cellsInput, width) {
  const remaining = new Set(cellsInput);
  const parts = [];
  while (remaining.size) {
    const start = Math.min(...remaining);
    const part = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const cell = queue.shift();
      part.push(cell);
      const x = cell % width;
      const neighbors = [cell - width, cell + width];
      if (x > 0) neighbors.push(cell - 1);
      if (x < width - 1) neighbors.push(cell + 1);
      for (const neighbor of neighbors) if (remaining.delete(neighbor)) queue.push(neighbor);
    }
    parts.push(part.sort((left, right) => left - right));
  }
  return parts.sort((left, right) => left[0] - right[0]);
}

function sourceMacrosFromMicro(cells, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  return [...new Set(cells.map((cell) => {
    const x = cell % state.microWidth;
    const y = Math.floor(cell / state.microWidth);
    return Math.floor(y / scale) * macroWidth + Math.floor(x / scale);
  }))].sort((left, right) => left - right);
}

function geometryTouchesExisting(micro, regions, microWidth) {
  const shape = new Set(micro);
  const occupied = new Set(Object.values(regions).flatMap((region) => region.micro || []));
  for (const cell of shape) {
    const x = cell % microWidth;
    const neighbors = [cell - microWidth, cell + microWidth];
    if (x > 0) neighbors.push(cell - 1);
    if (x < microWidth - 1) neighbors.push(cell + 1);
    if (neighbors.some((neighbor) => !shape.has(neighbor) && occupied.has(neighbor))) return true;
  }
  return false;
}

function transferPreparedIntrusions(state, micro, firstSplitNumber) {
  const owners = new Map(Object.values(state.regions).flatMap((region) => (region.micro || []).map((cell) => [cell, region.id])));
  const donors = new Set();
  for (const cell of micro) {
    const donorId = owners.get(cell);
    if (!donorId) continue;
    assertState(Boolean(state.regions[donorId]?.color), "PREPARED_OVERLAP_UNCOLORED");
    state.regions[donorId].micro = state.regions[donorId].micro.filter((candidate) => candidate !== cell);
    donors.add(donorId);
  }
  let nextNumber = firstSplitNumber;
  let splitCount = 0;
  let removedCount = 0;
  for (const donorId of [...donors].sort((left, right) => regionNumber(left) - regionNumber(right))) {
    const donor = state.regions[donorId];
    if (!donor.micro.length) {
      delete state.regions[donorId];
      removedCount += 1;
      continue;
    }
    const parts = connectedComponents(donor.micro, state.microWidth);
    donor.micro = parts[0];
    donor.sourceMacros = sourceMacrosFromMicro(parts[0], state);
    for (const part of parts.slice(1)) {
      const id = `R${nextNumber}`;
      nextNumber += 1;
      state.regions[id] = {
        ...donor,
        id,
        micro: part,
        sourceMacros: sourceMacrosFromMicro(part, state),
        controllers: [...(donor.controllers || [])],
        isPending: false,
        isReserved: false,
      };
      splitCount += 1;
    }
  }
  return Object.freeze({ donorCount: donors.size, splitCount, removedCount });
}

function macroMicroCells(macro, bounds, microWidth) {
  const macroWidth = bounds.macroWidth;
  const scale = bounds.microScale;
  const col = macro % macroWidth;
  const row = Math.floor(macro / macroWidth);
  const result = [];
  for (let dy = 0; dy < scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) result.push((row * scale + dy) * microWidth + col * scale + dx);
  }
  return result;
}

function touchesExistingRegion(sourceMacros, regions, macroWidth) {
  const occupied = new Set(Object.values(regions).flatMap((region) => region.sourceMacros || []));
  return sourceMacros.some((macro) => {
    const col = macro % macroWidth;
    const neighbors = [macro - macroWidth, macro + macroWidth];
    if (col > 0) neighbors.push(macro - 1);
    if (col < macroWidth - 1) neighbors.push(macro + 1);
    return neighbors.some((neighbor) => occupied.has(neighbor));
  });
}

function hasLegalRegionOfSize(state, size) {
  if (!Number.isInteger(size) || size < 1) return false;
  const bounds = state.playableBounds;
  const width = bounds.macroWidth;
  const occupied = new Set(Object.values(state.regions).flatMap((region) => region.sourceMacros || []));
  const free = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      const macro = row * width + col;
      if (!occupied.has(macro)) free.push(macro);
    }
  }
  if (free.length < size) return false;
  const freeSet = new Set(free);
  const seen = new Set();
  function search(selected, frontier) {
    const signature = [...selected].sort((a, b) => a - b).join(",");
    if (seen.has(signature)) return false;
    seen.add(signature);
    if (selected.size === size) return !occupied.size || touchesExistingRegion([...selected], state.regions, width);
    for (const macro of frontier) {
      const nextSelected = new Set(selected).add(macro);
      const nextFrontier = new Set(frontier);
      nextFrontier.delete(macro);
      const col = macro % width;
      const around = [macro - width, macro + width];
      if (col > 0) around.push(macro - 1);
      if (col < width - 1) around.push(macro + 1);
      for (const next of around) if (freeSet.has(next) && !nextSelected.has(next)) nextFrontier.add(next);
      if (search(nextSelected, nextFrontier)) return true;
    }
    return false;
  }
  for (const start of free) {
    const col = start % width;
    const around = [start - width, start + width];
    if (col > 0) around.push(start - 1);
    if (col < width - 1) around.push(start + 1);
    if (search(new Set([start]), new Set(around.filter((macro) => freeSet.has(macro))))) return true;
  }
  return false;
}

function bestLegalSize(state, maximum) {
  for (let size = maximum; size >= 1; size -= 1) if (hasLegalRegionOfSize(state, size)) return size;
  return 0;
}

function createRegion(state, actor, payload = {}, rngStreams = {}) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "CREATE_FIRST" || state.phase === "WORK", "WRONG_PHASE");
  assertState(!state.pending, "PENDING_EXISTS");
  const rawSourceMacros = Array.isArray(payload.sourceMacros) ? payload.sourceMacros : [];
  const sourceMacros = [...new Set(rawSourceMacros)].sort((a, b) => a - b);
  assertState(rawSourceMacros.length === sourceMacros.length, "DUPLICATE_REGION_CELL");
  const prepared = state.preparedOutgoing;
  if (prepared) {
    assertState(prepared.actor === actor, "PREPARED_WRONG_ACTOR");
    assertState(JSON.stringify(sourceMacros) === JSON.stringify(prepared.sourceMacros), "PREPARED_SELECTION_MISMATCH");
  }
  assertState(sourceMacros.length === state.requiredSize, "WRONG_REGION_SIZE");
  const bounds = state.playableBounds;
  assertState(sourceMacros.every((macro) => {
    if (!Number.isInteger(macro) || macro < 0) return false;
    const col = macro % bounds.macroWidth;
    const row = Math.floor(macro / bounds.macroWidth);
    return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
  }), "OUTSIDE_PLAYABLE_BOUNDS");
  assertState(isConnected(sourceMacros, bounds.macroWidth), "REGION_NOT_CONNECTED");
  const micro = prepared ? [...prepared.micro] : sourceMacros.flatMap((macro) => macroMicroCells(macro, bounds, state.microWidth));
  assertState(isConnected(micro, state.microWidth), "REGION_NOT_CONNECTED");
  if (Object.keys(state.regions).length) {
    assertState(prepared ? geometryTouchesExisting(micro, state.regions, state.microWidth) : touchesExistingRegion(sourceMacros, state.regions, bounds.macroWidth), "REGION_NOT_ADJACENT");
  }
  const occupied = new Set(Object.values(state.regions).flatMap((region) => region.micro || []));
  if (!prepared) assertState(micro.every((cell) => !occupied.has(cell)), "REGION_OVERLAP");
  const idNumber = Math.max(0, ...Object.keys(state.regions).map(regionNumber)) + 1;
  const id = `R${idNumber}`;
  const next = clone(state);
  const intrusion = prepared ? transferPreparedIntrusions(next, micro, idNumber + 1) : { donorCount: 0, splitCount: 0, removedCount: 0 };
  next.regions[id] = { id, micro, sourceMacros, controllers: [actor], color: null, isPending: true };
  next.pending = id;
  next.preparedOutgoing = null;
  next.active = other(actor);
  next.phase = "COLOR";
  next.turn += 1;
  next.interferenceLock = false;
  next.version += 1;
  next.publicLog.push(`T${next.turn - 1} Player ${actor} created ${id}${intrusion.donorCount ? ` with ${intrusion.donorCount} colored-region intrusion${intrusion.splitCount ? ` and ${intrusion.splitCount} donor split` : ""}${intrusion.removedCount ? ` and ${intrusion.removedCount} donor removal` : ""}` : ""}; Player ${next.active} must color it.`);
  applyCurseBacklashOnEnterColor(next, next.active, () => nextRandom(rngStreams, "skill-effect"));
  finishNoColorOnEntry(next, next.active);
  const contactColorCount = new Set(adjacentRegionIds(next, id)
    .map((regionId) => next.regions[regionId])
    .filter((region) => region && !region.isPending && region.color)
    .map((region) => region.color)).size;
  return { ok: true, code: "OK", state: next, regionId: id, contactColorCount };
}

function availableColors(state, actor) {
  const colors = new Set(state.basicPalettes[actor]);
  if (state.bonusUsesRemaining[actor] > 0) colors.add(state.bonusColors[actor]);
  for (const color of state.privateEffects[actor]?.temporaryColors || []) colors.add(color);
  if (state.privateEffects[actor]?.prism) for (const color of COLORS) colors.add(color);
  const seals = state.publicEffects?.[actor]?.seals || {};
  return [...colors].filter((color) => !(seals[color] > 0));
}

function noColorTerminalReason(state, actor) {
  const usable = availableColors(state, actor);
  const blocked = new Set(adjacentRegionIds(state, state.pending).map((id) => state.regions[id]?.color).filter(Boolean));
  if (!usable.every((color) => blocked.has(color))) return null;
  return usable.length === 0 ? "SEALED_OUT" : "NO_LEGAL_COLOR";
}

function finishNoColorOnEntry(state, actor, logMessage = `Player ${actor} has no usable color.`) {
  const reason = noColorTerminalReason(state, actor);
  if (!reason) return false;
  if (state.privateEffects[actor]?.temporaryColors) delete state.privateEffects[actor].temporaryColors;
  state.status = "FINISHED";
  state.phase = "GAME_OVER";
  state.winner = other(actor);
  state.terminalReason = reason;
  state.publicLog.push(logMessage);
  return true;
}

function colorRegion(state, actor, payload = {}, rngStreams = {}) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "COLOR" && state.pending, "WRONG_PHASE");
  const color = payload.color;
  assertState(COLORS.includes(color) && availableColors(state, actor).includes(color), "COLOR_UNAVAILABLE");
  const next = clone(state);
  if (adjacentRegionIds(state, state.pending).some((id) => state.regions[id].color === color)) {
    if (next.privateEffects[actor]?.prism) delete next.privateEffects[actor].prism;
    if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
    next.status = "FINISHED";
    next.phase = "GAME_OVER";
    next.winner = other(actor);
    next.terminalReason = "ILLEGAL_COLOR";
    next.version += 1;
    next.publicLog.push(`T${next.turn} Player ${actor} lost by illegal coloring.`);
    return { ok: true, code: "ILLEGAL_COLOR", state: next };
  }
  const target = next.regions[next.pending];
  target.color = color;
  target.isPending = false;
  if (!target.controllers.includes(actor)) target.controllers.push(actor);
  const prism = Boolean(next.privateEffects[actor]?.prism);
  const temporary = (next.privateEffects[actor]?.temporaryColors || []).includes(color);
  const hasUnlimitedBasicSlot = next.basicPalettes[actor].includes(color);
  if (!prism && !temporary && !hasUnlimitedBasicSlot && color === next.bonusColors[actor]) next.bonusUsesRemaining[actor] -= 1;
  if (prism) delete next.privateEffects[actor].prism;
  if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
  tickSealsAfterColor(next, actor);
  tickPaletteDebuffsAfterColor(next, actor);
  if (next.reserved) {
    const returnedId = next.reserved;
    const returned = next.regions[returnedId];
    next.reserved = null;
    returned.isReserved = false;
    returned.isPending = true;
    next.pending = returnedId;
    next.active = other(actor);
    next.phase = "COLOR";
    next.turn += 1;
    next.interferenceLock = false;
    applyCurseBacklashOnEnterColor(next, next.active, () => nextRandom(rngStreams, "skill-effect"));
    next.version += 1;
    next.publicLog.push(`Player ${actor} colored ${target.id}; split region ${returnedId} returned to Player ${next.active}.`);
    finishNoColorOnEntry(next, next.active);
    return { ok: true, code: "OK", state: next, returnedRegionId: returnedId };
  }
  next.pending = null;
  next.phase = "WORK";
  next.rolledSize = DIE_POOL[Math.floor(nextRandom(rngStreams, "die") * DIE_POOL.length)];
  next.baseRequiredSize = bestLegalSize(next, next.rolledSize);
  next.requiredSize = next.baseRequiredSize;
  if (next.requiredSize <= 0) {
    next.status = "FINISHED";
    next.phase = "GAME_OVER";
    next.winner = actor;
    next.terminalReason = "BOARD_LOCK";
  }
  next.version += 1;
  next.publicLog.push(`Player ${actor} colored ${target.id}.`);
  return { ok: true, code: "OK", state: next };
}

function surrender(state, actor) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  const next = clone(state);
  if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
  next.preparedOutgoing = null;
  next.status = "FINISHED";
  next.phase = "GAME_OVER";
  next.winner = other(actor);
  next.terminalReason = "SURRENDER";
  next.version += 1;
  next.publicLog.push(`Player ${actor} surrendered.`);
  return { ok: true, code: "OK", state: next };
}

function declareNoColor(state, actor) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "COLOR", "WRONG_PHASE");
  assertState(Boolean(noColorTerminalReason(state, actor)), "COLOR_AVAILABLE");
  const next = clone(state);
  finishNoColorOnEntry(next, actor, `Player ${actor} declared no usable color.`);
  next.version += 1;
  return { ok: true, code: "OK", state: next };
}

function applyStandardAction({ state, actor, action, expectedVersion, rngStreams = {} }) {
  validateStandardState(state);
  if (expectedVersion !== state.version) return fail("VERSION_CONFLICT", state);
  if (!action || !ACTIONS.includes(action.type)) return fail("UNKNOWN_ACTION", state);
  if (state.status === "FINISHED") return fail("MATCH_FINISHED", state);
  try {
    let result;
    if (action.type === "CREATE_REGION") result = createRegion(state, actor, action.payload, rngStreams);
    else if (action.type === "COLOR_REGION") result = colorRegion(state, actor, action.payload, rngStreams);
    else if (action.type === "DECLARE_NO_COLOR") result = declareNoColor(state, actor);
    else if (action.type === "SURRENDER") result = surrender(state, actor);
    else {
      return dispatchStandardSkillAction({
        state,
        actor,
        action,
        expectedVersion,
        rngStreams,
        validateState: validateStandardState,
        projectPublic: projectStandardPublicState,
        projectPrivate: projectStandardPrivateState,
        hasLegalRegionOfSize,
        bestLegalSize,
      });
    }
    if (result.ok) {
      assertState(result.state.version === state.version + 1, "VERSION_INCREMENT_INVARIANT");
      validateStandardState(result.state);
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof StandardRuleError) return fail(error.code, state);
    throw error;
  }
}

function encodeStandardMatch(state, rngSnapshot) {
  validateStandardState(state);
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, state, rngSnapshot: clone(rngSnapshot || {}) });
}

function decodeStandardMatch(payload) {
  const decoded = typeof payload === "string" ? JSON.parse(payload) : clone(payload);
  assertState(decoded?.schemaVersion === SCHEMA_VERSION, "INVALID_SAVE_SCHEMA");
  validateStandardState(decoded.state);
  return Object.freeze({ state: decoded.state, rngSnapshot: decoded.rngSnapshot || {} });
}

module.exports = {
  ACTIONS,
  BONUS_USE_POOL,
  DIE_POOL,
  ENGINE_VERSION,
  ENGINE_TERMINAL_REASONS,
  FINISHED_STATE_TERMINAL_REASONS,
  PHASES,
  REQUIRED_RNG_STREAMS,
  SAVE_KEY,
  SCHEMA_VERSION,
  TERMINAL_REASONS,
  applyStandardAction,
  createStandardMatch,
  decodeStandardMatch,
  encodeStandardMatch,
  isMapCompleteWin,
  projectStandardPrivateState,
  projectStandardPublicState,
  validateStandardState,
};

},
"standard/standard-save.js":function(require,module,exports){
"use strict";

const match = require("./standard-match.js");
const profileModel = require("./standard-profile.js");
const cosmetics = require("./standard-cosmetics.js");
const { rewardFor } = require("./reward-policy.js");
const { STANDARD_SKILLS } = require("./standard-skill-registry.js");

const SAVE_SCHEMA_VERSION = 5;
const PREVIOUS_SCHEMA_VERSION = 4;
const V3_SCHEMA_VERSION = 3;
const LEGACY_SCHEMA_VERSION = 2;
const ECONOMY_VERSION = "standard-alpha-economy-v1";
const RECEIPT_SCOPES = Object.freeze(["matchStart", "matchAction", "matchConsumption", "matchSettlement", "cardSale", "quizSettlement", "gachaDraw", "cosmeticAction"]);
const MAX_SAVE_BYTES = 2 * 1024 * 1024;
const RECEIPT_TERMINAL_REASONS = match.TERMINAL_REASONS;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

class StandardSaveError extends Error {
  constructor(code) {
    super(code);
    this.name = "StandardSaveError";
    this.code = code;
  }
}

function assertSave(condition, code) {
  if (!condition) throw new StandardSaveError(code);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeRecord(record, code) {
  assertSave(isRecord(record), code);
  for (const key of Object.keys(record)) {
    assertSave(!["__proto__", "prototype", "constructor"].includes(key), code);
  }
  return record;
}

function nonnegativeInteger(value, code) {
  assertSave(Number.isSafeInteger(value) && value >= 0, code);
}

function validateProfile(profile, profileId) {
  safeRecord(profile, "INVALID_PROFILE");
  assertSave(ID_PATTERN.test(profileId), "INVALID_PROFILE_ID");
  assertSave(profile.profileId === profileId, "PROFILE_ID_MISMATCH");
  assertSave(typeof profile.displayName === "string" && profile.displayName.length >= 1 && profile.displayName.length <= 40, "INVALID_PROFILE_NAME");
  safeRecord(profile.quizRecords, "INVALID_QUIZ_RECORDS");
  safeRecord(profile.gachaTickets, "INVALID_GACHA_TICKETS");
  for (const [level, record] of Object.entries(profile.quizRecords)) {
    assertSave(/^[1-5]$/.test(level), "INVALID_QUIZ_RECORD_LEVEL");
    safeRecord(record, "INVALID_QUIZ_RECORD");
    for (const field of ["attempts", "bestCorrect", "bestStreak", "lastCorrect", "lastWrong"]) nonnegativeInteger(record[field], "INVALID_QUIZ_RECORD");
    assertSave(record.bestCorrect <= 10 && record.bestStreak <= record.bestCorrect && record.lastCorrect <= 10 && record.lastWrong <= 3 && record.lastCorrect + record.lastWrong <= 10, "INVALID_QUIZ_RECORD");
    assertSave(typeof record.lastCompletedAt === "string" && Number.isFinite(Date.parse(record.lastCompletedAt)), "INVALID_QUIZ_RECORD");
  }
  safeRecord(profile.inventory, "INVALID_INVENTORY");
  for (const [level, count] of Object.entries(profile.gachaTickets)) {
    assertSave(/^[1-5]$/.test(level), "INVALID_GACHA_TICKET_LEVEL");
    nonnegativeInteger(count, "INVALID_GACHA_TICKET_COUNT");
  }
  for (const count of Object.values(profile.inventory)) nonnegativeInteger(count, "INVALID_INVENTORY_COUNT");
  nonnegativeInteger(profile.coins, "INVALID_COINS");
  assertSave(Array.isArray(profile.achievements) && profile.achievements.every((item) => typeof item === "string" && item.length <= 80), "INVALID_ACHIEVEMENTS");
  profileModel.validateProgressionFields(profile);
}

function validateActiveMatch(activeMatch) {
  if (activeMatch === null) return;
  safeRecord(activeMatch, "INVALID_ACTIVE_MATCH");
  match.validateStandardState(activeMatch.state);
  safeRecord(activeMatch.rngSnapshot, "INVALID_RNG_SNAPSHOT");
  if (Object.hasOwn(activeMatch, "ruleSetId")) assertSave(typeof activeMatch.ruleSetId === "string" && activeMatch.ruleSetId.length >= 1 && activeMatch.ruleSetId.length <= 80, "INVALID_RULE_SET_ID");
  if (Object.hasOwn(activeMatch, "cardSources")) {
    safeRecord(activeMatch.cardSources, "INVALID_CARD_SOURCES");
    for (const seat of ["A", "B"]) {
      safeRecord(activeMatch.cardSources[seat], "INVALID_CARD_SOURCES");
      for (const [skillId, source] of Object.entries(activeMatch.cardSources[seat])) {
        assertSave(ID_PATTERN.test(skillId) && ["INVENTORY_BACKED", "EXPERIMENTAL_LOAN", "CPU_VIRTUAL"].includes(source), "INVALID_CARD_SOURCE");
      }
    }
  }
  safeRecord(activeMatch.participants, "INVALID_PARTICIPANTS");
  for (const seat of ["A", "B"]) {
    const participant = safeRecord(activeMatch.participants[seat], "INVALID_PARTICIPANT");
    assertSave(participant.type === "PROFILE" || participant.type === "CPU", "INVALID_PARTICIPANT_TYPE");
    if (participant.type === "PROFILE") {
      assertSave(ID_PATTERN.test(participant.profileId), "INVALID_PARTICIPANT_PROFILE");
      assertSave(typeof participant.displayNameSnapshot === "string" && participant.displayNameSnapshot.length >= 1 && participant.displayNameSnapshot.length <= 40, "INVALID_PARTICIPANT_NAME");
    } else {
      assertSave(["easy", "normal", "hard"].includes(participant.difficulty), "INVALID_CPU_DIFFICULTY");
      assertSave(typeof participant.policyVersion === "string" && participant.policyVersion.length >= 1 && participant.policyVersion.length <= 80, "INVALID_CPU_POLICY");
    }
  }
  const profileIds = Object.values(activeMatch.participants).filter((participant) => participant.type === "PROFILE").map((participant) => participant.profileId);
  assertSave(new Set(profileIds).size === profileIds.length && profileIds.length >= 1, "DUPLICATE_OR_MISSING_PROFILE_PARTICIPANT");
  assertSave(activeMatch.startedAt === null || (typeof activeMatch.startedAt === "string" && Number.isFinite(Date.parse(activeMatch.startedAt))), "INVALID_MATCH_STARTED_AT");
  assertSave(activeMatch.finishedAt === null || (typeof activeMatch.finishedAt === "string" && Number.isFinite(Date.parse(activeMatch.finishedAt))), "INVALID_MATCH_FINISHED_AT");
  safeRecord(activeMatch.settlement, "INVALID_MATCH_SETTLEMENT_STATE");
  assertSave(typeof activeMatch.settlement.settled === "boolean", "INVALID_MATCH_SETTLEMENT_STATE");
  if (activeMatch.settlement.settled) {
    assertSave(ID_PATTERN.test(activeMatch.settlement.operationId), "INVALID_MATCH_SETTLEMENT_STATE");
    assertSave(typeof activeMatch.settlement.resultFingerprint === "string" && activeMatch.settlement.resultFingerprint.length <= 256, "INVALID_MATCH_SETTLEMENT_STATE");
    assertSave(typeof activeMatch.settlement.settledAt === "string" && Number.isFinite(Date.parse(activeMatch.settlement.settledAt)), "INVALID_MATCH_SETTLEMENT_STATE");
    nonnegativeInteger(activeMatch.settlement.rootRevision, "INVALID_MATCH_SETTLEMENT_STATE");
  }
}

function validateConsumptionReceipts(ledger) {
  safeRecord(ledger, "INVALID_CONSUMPTION_RECEIPTS");
  for (const entry of Object.values(ledger)) {
    safeRecord(entry, "INVALID_LEDGER_ENTRY");
    assertSave(ID_PATTERN.test(entry.matchId), "INVALID_LEDGER_MATCH");
    assertSave(ID_PATTERN.test(entry.actionId), "INVALID_LEDGER_ACTION");
    const source = entry.source || "INVENTORY_BACKED";
    assertSave(["INVENTORY_BACKED", "EXPERIMENTAL_LOAN", "CPU_VIRTUAL"].includes(source), "INVALID_LEDGER_SOURCE");
    if (source === "INVENTORY_BACKED") assertSave(ID_PATTERN.test(entry.profileId), "INVALID_LEDGER_PROFILE");
    else assertSave(entry.profileId === null || ID_PATTERN.test(entry.profileId), "INVALID_LEDGER_PROFILE");
    assertSave(ID_PATTERN.test(entry.skill), "INVALID_LEDGER_SKILL");
    nonnegativeInteger(entry.version, "INVALID_LEDGER_VERSION");
    if (Object.hasOwn(entry, "actionFingerprint")) assertSave(typeof entry.actionFingerprint === "string" && entry.actionFingerprint.length <= 1024, "INVALID_ACTION_FINGERPRINT");
  }
}

function validateReceipts(receipts) {
  safeRecord(receipts, "INVALID_RECEIPTS");
  for (const scope of RECEIPT_SCOPES.filter((scope) => !["matchStart", "matchSettlement", "cosmeticAction"].includes(scope))) safeRecord(receipts[scope], "INVALID_RECEIPT_SCOPE");
  safeRecord(receipts.cosmeticAction || {}, "INVALID_RECEIPT_SCOPE");
  safeRecord(receipts.matchStart, "INVALID_MATCH_START_RECEIPTS");
  safeRecord(receipts.matchStart.byMatchId, "INVALID_MATCH_START_RECEIPTS");
  safeRecord(receipts.matchStart.operationIndex, "INVALID_MATCH_START_RECEIPTS");
  for (const [matchId, entry] of Object.entries(receipts.matchStart.byMatchId)) {
    safeRecord(entry, "INVALID_MATCH_START_RECEIPT");
    assertSave(ID_PATTERN.test(matchId) && entry.matchId === matchId && ID_PATTERN.test(entry.operationId), "INVALID_MATCH_START_RECEIPT");
    assertSave(entry.scope === "matchStart" && typeof entry.ruleSetId === "string" && entry.ruleSetId.length <= 80, "INVALID_MATCH_START_RECEIPT");
    assertSave(typeof entry.requestFingerprint === "string" && entry.requestFingerprint.length <= 256, "INVALID_MATCH_START_RECEIPT");
    assertSave(typeof entry.actionFingerprint === "string" && entry.actionFingerprint.length <= 2048, "INVALID_MATCH_START_RECEIPT");
    assertSave(typeof entry.seedMaterialFingerprint === "string" && entry.seedMaterialFingerprint.length <= 256, "INVALID_MATCH_START_RECEIPT");
    assertSave(typeof entry.initialStateHash === "string" && entry.initialStateHash.length <= 256, "INVALID_MATCH_START_RECEIPT");
    assertSave(typeof entry.startedAt === "string" && Number.isFinite(Date.parse(entry.startedAt)), "INVALID_MATCH_START_RECEIPT");
    nonnegativeInteger(entry.rootRevision, "INVALID_MATCH_START_RECEIPT");
    safeRecord(entry.reservations, "INVALID_MATCH_START_RECEIPT");
    validateReservations(entry.reservations);
    if (Object.hasOwn(entry, "quoteIds")) {
      safeRecord(entry.quoteIds, "INVALID_MATCH_START_RECEIPT");
      assertSave(Object.keys(entry.quoteIds).length === 2 && typeof entry.quoteIds.A === "string" && typeof entry.quoteIds.B === "string" && ID_PATTERN.test(entry.quoteIds.A) && ID_PATTERN.test(entry.quoteIds.B) && entry.quoteIds.A !== entry.quoteIds.B, "INVALID_MATCH_START_RECEIPT");
    }
  }
  for (const [operationId, matchId] of Object.entries(receipts.matchStart.operationIndex)) {
    assertSave(ID_PATTERN.test(operationId) && ID_PATTERN.test(matchId), "INVALID_MATCH_START_INDEX");
    assertSave(receipts.matchStart.byMatchId[matchId]?.operationId === operationId, "INVALID_MATCH_START_INDEX");
  }
  safeRecord(receipts.matchSettlement, "INVALID_SETTLEMENT_RECEIPTS");
  safeRecord(receipts.matchSettlement.byMatchId, "INVALID_SETTLEMENT_RECEIPTS");
  safeRecord(receipts.matchSettlement.operationIndex, "INVALID_SETTLEMENT_RECEIPTS");
  for (const [matchId, entry] of Object.entries(receipts.matchSettlement.byMatchId)) {
    safeRecord(entry, "INVALID_SETTLEMENT_RECEIPT");
    assertSave(ID_PATTERN.test(matchId) && entry.matchId === matchId && ID_PATTERN.test(entry.operationId), "INVALID_SETTLEMENT_RECEIPT");
    assertSave(entry.scope === "matchSettlement", "INVALID_SETTLEMENT_RECEIPT");
    assertSave(typeof entry.resultFingerprint === "string" && entry.resultFingerprint.length <= 256, "INVALID_SETTLEMENT_RECEIPT");
    assertSave(["A", "B"].includes(entry.winnerSeat) && RECEIPT_TERMINAL_REASONS.includes(entry.terminalReason), "INVALID_SETTLEMENT_RECEIPT");
    assertSave(typeof entry.settledAt === "string" && Number.isFinite(Date.parse(entry.settledAt)), "INVALID_SETTLEMENT_RECEIPT");
    nonnegativeInteger(entry.rootRevision, "INVALID_SETTLEMENT_RECEIPT");
    safeRecord(entry.profileResults, "INVALID_SETTLEMENT_RECEIPT");
    for (const [profileId, result] of Object.entries(entry.profileResults)) {
      assertSave(ID_PATTERN.test(profileId), "INVALID_SETTLEMENT_PROFILE_RESULT");
      safeRecord(result, "INVALID_SETTLEMENT_PROFILE_RESULT");
      assertSave(result.result === "WIN" || result.result === "LOSS", "INVALID_SETTLEMENT_PROFILE_RESULT");
      safeRecord(result.stats, "INVALID_SETTLEMENT_PROFILE_RESULT");
      safeRecord(result.trophies, "INVALID_SETTLEMENT_PROFILE_RESULT");
    }
  }
  for (const [operationId, matchId] of Object.entries(receipts.matchSettlement.operationIndex)) {
    assertSave(ID_PATTERN.test(operationId) && ID_PATTERN.test(matchId), "INVALID_SETTLEMENT_INDEX");
    assertSave(receipts.matchSettlement.byMatchId[matchId]?.operationId === operationId, "INVALID_SETTLEMENT_INDEX");
  }
  for (const [key, entry] of Object.entries(receipts.matchAction)) {
    safeRecord(entry, "INVALID_MATCH_ACTION_RECEIPT");
    assertSave(entry.scope === "matchAction", "INVALID_MATCH_ACTION_RECEIPT");
    assertSave(ID_PATTERN.test(entry.matchId) && ID_PATTERN.test(entry.actionId), "INVALID_MATCH_ACTION_RECEIPT");
    assertSave(key === `${entry.matchId}:${entry.actionId}`, "INVALID_MATCH_ACTION_RECEIPT_KEY");
    assertSave(["A", "B"].includes(entry.actorSeat), "INVALID_MATCH_ACTION_RECEIPT");
    assertSave(typeof entry.actionFingerprint === "string" && entry.actionFingerprint.length <= 2048, "INVALID_MATCH_ACTION_RECEIPT");
    assertSave(typeof entry.resultCode === "string" && entry.resultCode.length >= 1 && entry.resultCode.length <= 80, "INVALID_MATCH_ACTION_RECEIPT");
    nonnegativeInteger(entry.matchVersion, "INVALID_MATCH_ACTION_RECEIPT");
    nonnegativeInteger(entry.rootRevision, "INVALID_MATCH_ACTION_RECEIPT");
  }
  validateConsumptionReceipts(receipts.matchConsumption);
  for (const [quizSessionId, entry] of Object.entries(receipts.quizSettlement)) {
    safeRecord(entry, "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    assertSave(ID_PATTERN.test(quizSessionId) && entry.quizSessionId === quizSessionId && entry.scope === "quizSettlement", "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    assertSave(ID_PATTERN.test(entry.operationId) && ID_PATTERN.test(entry.profileId), "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    assertSave(typeof entry.resultFingerprint === "string" && entry.resultFingerprint.length <= 256, "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    for (const field of ["correct", "wrong", "bestStreak", "selectedLevel", "ticketLevel", "ticketCount", "rootRevision"]) nonnegativeInteger(entry[field], "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    assertSave(entry.correct <= 10 && entry.wrong <= 3 && entry.bestStreak <= entry.correct && entry.selectedLevel >= 1 && entry.selectedLevel <= 5 && entry.ticketLevel >= 1 && entry.ticketLevel <= 5 && entry.ticketCount >= 1 && entry.ticketCount <= 10, "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    assertSave(entry.correct + entry.wrong <= 10 && (entry.wrong === 3 || entry.correct + entry.wrong === 10), "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    assertSave(typeof entry.reason === "string" && entry.reason.length >= 1 && entry.reason.length <= 80, "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    assertSave(typeof entry.completedAt === "string" && Number.isFinite(Date.parse(entry.completedAt)), "INVALID_QUIZ_SETTLEMENT_RECEIPT");
    const expectedReward = rewardFor(entry);
    assertSave(entry.ticketLevel === expectedReward.ticketLevel && entry.ticketCount === expectedReward.draws && entry.reason === expectedReward.reason, "INVALID_QUIZ_SETTLEMENT_RECEIPT");
  }
  for (const entry of Object.values(receipts.cardSale)) {
    safeRecord(entry, "INVALID_CARD_SALE_RECEIPT");
    assertSave(entry.scope === "cardSale", "INVALID_CARD_SALE_RECEIPT");
    assertSave(ID_PATTERN.test(entry.operationId) && ID_PATTERN.test(entry.profileId) && ID_PATTERN.test(entry.skillId), "INVALID_CARD_SALE_RECEIPT");
    assertSave(entry.economyVersion === ECONOMY_VERSION, "INVALID_CARD_SALE_RECEIPT");
    assertSave(Number.isInteger(entry.rarity) && entry.rarity >= 1 && entry.rarity <= 5, "INVALID_CARD_SALE_RECEIPT");
    nonnegativeInteger(entry.unitPrice, "INVALID_CARD_SALE_RECEIPT");
    nonnegativeInteger(entry.quantity, "INVALID_CARD_SALE_RECEIPT");
    nonnegativeInteger(entry.totalCoins, "INVALID_CARD_SALE_RECEIPT");
    nonnegativeInteger(entry.rootRevision, "INVALID_CARD_SALE_RECEIPT");
    assertSave(entry.unitPrice * entry.quantity === entry.totalCoins && Number.isSafeInteger(entry.totalCoins), "INVALID_CARD_SALE_RECEIPT");
    assertSave(typeof entry.actionFingerprint === "string" && entry.actionFingerprint.length <= 2048, "INVALID_CARD_SALE_RECEIPT");
  }
  for (const [operationId, entry] of Object.entries(receipts.gachaDraw)) {
    safeRecord(entry, "INVALID_GACHA_DRAW_RECEIPT");
    assertSave(ID_PATTERN.test(operationId) && entry.operationId === operationId && entry.scope === "gachaDraw" && ID_PATTERN.test(entry.profileId), "INVALID_GACHA_DRAW_RECEIPT");
    for (const field of ["ticketLevel", "ticketCount", "rngBefore", "rngAfter", "rootRevision"]) nonnegativeInteger(entry[field], "INVALID_GACHA_DRAW_RECEIPT");
    assertSave(entry.ticketLevel >= 1 && entry.ticketLevel <= 5 && entry.ticketCount >= 1 && entry.ticketCount <= 100 && entry.rngBefore <= 0xffffffff && entry.rngAfter <= 0xffffffff, "INVALID_GACHA_DRAW_RECEIPT");
    assertSave(typeof entry.actionFingerprint === "string" && entry.actionFingerprint.length <= 256, "INVALID_GACHA_DRAW_RECEIPT");
    assertSave(typeof entry.drawnAt === "string" && Number.isFinite(Date.parse(entry.drawnAt)), "INVALID_GACHA_DRAW_RECEIPT");
    assertSave(Array.isArray(entry.draws) && entry.draws.length === entry.ticketCount, "INVALID_GACHA_DRAW_RECEIPT");
    for (const draw of entry.draws) {
      safeRecord(draw, "INVALID_GACHA_DRAW_RECEIPT");
      const skill = STANDARD_SKILLS[draw.skillId];
      assertSave(draw.ticketLevel === entry.ticketLevel && Number.isSafeInteger(draw.rarity) && draw.rarity >= 1 && draw.rarity <= 5, "INVALID_GACHA_DRAW_RECEIPT");
      assertSave(["color", "area", "disrupt"].includes(draw.category) && skill?.v49Catalogued && skill.gachaEnabled && !skill.experimental && skill.category === draw.category && skill.rarity === draw.rarity, "INVALID_GACHA_DRAW_RECEIPT");
    }
  }
  for (const [key, entry] of Object.entries(receipts.cosmeticAction || {})) {
    safeRecord(entry, "INVALID_COSMETIC_ACTION_RECEIPT");
    assertSave(entry.scope === "cosmeticAction" && key === `${entry.profileId}:${entry.operationId}`, "INVALID_COSMETIC_ACTION_RECEIPT");
    assertSave(ID_PATTERN.test(entry.operationId) && ID_PATTERN.test(entry.profileId) && ID_PATTERN.test(entry.cosmeticId), "INVALID_COSMETIC_ACTION_RECEIPT");
    assertSave(["PURCHASE_AND_EQUIP", "EQUIP"].includes(entry.action) && ["board", "effect", "nameplate", "title"].includes(entry.type), "INVALID_COSMETIC_ACTION_RECEIPT");
    const item = cosmetics.COSMETIC_CATALOG[entry.cosmeticId];
    assertSave(Boolean(item) && item.type === entry.type, "INVALID_COSMETIC_ACTION_RECEIPT");
    nonnegativeInteger(entry.price, "INVALID_COSMETIC_ACTION_RECEIPT");
    assertSave(entry.action === "PURCHASE_AND_EQUIP" ? item.price > 0 && entry.price === item.price : entry.price === 0, "INVALID_COSMETIC_ACTION_RECEIPT");
    nonnegativeInteger(entry.coinsAfter, "INVALID_COSMETIC_ACTION_RECEIPT");
    nonnegativeInteger(entry.rootRevision, "INVALID_COSMETIC_ACTION_RECEIPT");
    assertSave(typeof entry.actionFingerprint === "string" && entry.actionFingerprint.length <= 256, "INVALID_COSMETIC_ACTION_RECEIPT");
  }
}

function validateReservations(reservations) {
  safeRecord(reservations, "INVALID_RESERVATIONS");
  for (const [profileId, skills] of Object.entries(reservations)) {
    assertSave(ID_PATTERN.test(profileId), "INVALID_RESERVATION_PROFILE");
    safeRecord(skills, "INVALID_RESERVATION_SKILLS");
    for (const [skillId, count] of Object.entries(skills)) {
      assertSave(ID_PATTERN.test(skillId), "INVALID_RESERVATION_SKILL");
      nonnegativeInteger(count, "INVALID_RESERVATION_COUNT");
    }
  }
}

function validateStandardSave(root) {
  safeRecord(root, "INVALID_SAVE_ROOT");
  assertSave(root.schemaVersion === SAVE_SCHEMA_VERSION, "INVALID_SAVE_SCHEMA");
  nonnegativeInteger(root.rootRevision, "INVALID_ROOT_REVISION");
  assertSave(root.economyVersion === ECONOMY_VERSION, "INVALID_ECONOMY_VERSION");
  safeRecord(root.profiles, "INVALID_PROFILES");
  for (const [profileId, profile] of Object.entries(root.profiles)) validateProfile(profile, profileId);
  validateActiveMatch(root.activeMatch);
  validateReservations(root.reservations);
  safeRecord(root.rngSnapshot, "INVALID_ROOT_RNG_SNAPSHOT");
  for (const value of Object.values(root.rngSnapshot)) assertSave(Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff, "INVALID_ROOT_RNG_SNAPSHOT");
  validateReceipts(root.receipts);
  for (const [profileId, skills] of Object.entries(root.reservations)) {
    assertSave(Object.hasOwn(root.profiles, profileId), "UNKNOWN_RESERVATION_PROFILE");
    for (const [skillId, count] of Object.entries(skills)) assertSave(count <= (root.profiles[profileId].inventory[skillId] || 0), "RESERVATION_EXCEEDS_INVENTORY");
  }
  if (root.activeMatch) {
    for (const participant of Object.values(root.activeMatch.participants)) if (participant.type === "PROFILE") assertSave(Object.hasOwn(root.profiles, participant.profileId), "UNKNOWN_MATCH_PROFILE");
    if (root.activeMatch.settlement.settled) {
      const activeReceipt = root.receipts.matchSettlement.byMatchId[root.activeMatch.state.matchId];
      assertSave(Boolean(activeReceipt), "MISSING_ACTIVE_SETTLEMENT_RECEIPT");
      assertSave(activeReceipt.operationId === root.activeMatch.settlement.operationId
        && activeReceipt.resultFingerprint === root.activeMatch.settlement.resultFingerprint
        && activeReceipt.settledAt === root.activeMatch.settlement.settledAt
        && activeReceipt.rootRevision === root.activeMatch.settlement.rootRevision, "ACTIVE_SETTLEMENT_RECEIPT_MISMATCH");
    }
    if (root.activeMatch.cardSources && !root.activeMatch.settlement.settled) {
      for (const seat of ["A", "B"]) {
        const participant = root.activeMatch.participants[seat];
        const hand = root.activeMatch.state.hands[seat] || {};
        const reservationSkills = participant.type === "PROFILE" ? Object.keys(root.reservations[participant.profileId] || {}) : [];
        const skillIds = new Set([...Object.keys(root.activeMatch.cardSources[seat]), ...Object.keys(hand), ...reservationSkills]);
        for (const skillId of skillIds) {
          const source = root.activeMatch.cardSources[seat][skillId];
          const expected = source === "INVENTORY_BACKED" ? (hand[skillId] || 0) : 0;
          const actual = participant.type === "PROFILE" ? (root.reservations[participant.profileId]?.[skillId] || 0) : 0;
          assertSave(actual === expected, "LOADOUT_RESERVATION_MISMATCH");
        }
      }
    }
  }
  return true;
}

function createProfile({ name, inventory = {}, gachaTickets = {} }) {
  return Object.freeze({
    displayName: name,
    quizRecords: {},
    gachaTickets: clone(gachaTickets),
    inventory: clone(inventory),
    coins: 0,
    achievements: [],
    ...profileModel.createProgressionFields(),
  });
}

function createStandardSave({ profiles, activeMatch = null, reservations = {}, rngSnapshot = {} }) {
  const normalizedProfiles = Object.fromEntries(Object.entries(clone(profiles)).map(([profileId, profile]) => [profileId, { profileId, ...profile }]));
  const root = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    rootRevision: 0,
    economyVersion: ECONOMY_VERSION,
    profiles: normalizedProfiles,
    activeMatch: activeMatch === null ? null : clone(activeMatch),
    reservations: clone(reservations),
    rngSnapshot: clone(rngSnapshot),
    receipts: Object.fromEntries(RECEIPT_SCOPES.map((scope) => [scope, ["matchStart", "matchSettlement"].includes(scope) ? { byMatchId: {}, operationIndex: {} } : {}])),
  };
  validateStandardSave(root);
  return Object.freeze(root);
}

function encodeStandardSave(root) {
  validateStandardSave(root);
  const payload = JSON.stringify(root);
  assertSave(byteLength(payload) <= MAX_SAVE_BYTES, "SAVE_TOO_LARGE");
  return payload;
}

function decodeStandardSave(payload) {
  assertSave(typeof payload === "string", "INVALID_SAVE_PAYLOAD");
  assertSave(byteLength(payload) <= MAX_SAVE_BYTES, "SAVE_TOO_LARGE");
  let decoded;
  try {
    decoded = JSON.parse(payload);
  } catch {
    throw new StandardSaveError("INVALID_SAVE_JSON");
  }
  let migrated = decoded;
  if (migrated?.schemaVersion === LEGACY_SCHEMA_VERSION) migrated = migrateStandardRootV2ToV3(migrated);
  if (migrated?.schemaVersion === V3_SCHEMA_VERSION) migrated = migrateStandardRootV3ToV4(migrated);
  if (migrated?.schemaVersion === PREVIOUS_SCHEMA_VERSION) migrated = migrateStandardRootV4ToV5(migrated);
  validateStandardSave(migrated);
  return Object.freeze(migrated);
}

function migrateStandardRootV2ToV3(rootV2) {
  assertSave(rootV2?.schemaVersion === LEGACY_SCHEMA_VERSION, "INVALID_MIGRATION_SOURCE");
  const next = clone(rootV2);
  next.schemaVersion = V3_SCHEMA_VERSION;
  for (const profile of Object.values(next.profiles || {})) profile.matchHistory = (profile.matchHistory || []).map((entry) => ({ ...entry, legacyV2: true }));
  next.receipts.matchSettlement = { byMatchId: {}, operationIndex: {} };
  if (next.activeMatch) {
    const profileBySeat = next.activeMatch.profileBySeat;
    next.activeMatch.participants = Object.fromEntries(["A", "B"].map((seat) => {
      const profileId = profileBySeat[seat];
      return [seat, { type: "PROFILE", profileId, displayNameSnapshot: next.profiles[profileId]?.displayName || profileId }];
    }));
    delete next.activeMatch.profileBySeat;
    next.activeMatch.startedAt = null;
    next.activeMatch.finishedAt = null;
    next.activeMatch.settlement = { settled: false };
  }
  return Object.freeze(next);
}

function migrateStandardRootV3ToV4(rootV3) {
  assertSave(rootV3?.schemaVersion === V3_SCHEMA_VERSION, "INVALID_MIGRATION_SOURCE");
  const next = clone(rootV3);
  next.schemaVersion = PREVIOUS_SCHEMA_VERSION;
  next.rngSnapshot = clone(next.rngSnapshot || {});
  next.receipts.matchStart = { byMatchId: {}, operationIndex: {} };
  return Object.freeze(next);
}

function migrateStandardRootV4ToV5(rootV4) {
  assertSave(rootV4?.schemaVersion === PREVIOUS_SCHEMA_VERSION, "INVALID_MIGRATION_SOURCE");
  const next = clone(rootV4);
  next.schemaVersion = SAVE_SCHEMA_VERSION;
  next.receipts.matchAction = {};
  validateStandardSave(next);
  return Object.freeze(next);
}

function ledgerKey(matchId, actionId) {
  return `${matchId}:${actionId}`;
}

function commitAcceptedCardAction({ root, beforeState, result, actor, actionId, actionFingerprint = null, rngSnapshot }) {
  validateStandardSave(root);
  assertSave(result?.ok === true, "ACTION_NOT_ACCEPTED");
  assertSave(["A", "B"].includes(actor), "INVALID_ACTOR");
  assertSave(ID_PATTERN.test(actionId), "INVALID_ACTION_ID");
  assertSave(result.state.matchId === beforeState.matchId && result.state.version === beforeState.version + 1, "INVALID_ACTION_RESULT");

  const changes = [];
  const beforeHand = beforeState.hands[actor];
  const afterHand = result.state.hands[actor];
  for (const skill of new Set([...Object.keys(beforeHand), ...Object.keys(afterHand)])) {
    const difference = (beforeHand[skill] || 0) - (afterHand[skill] || 0);
    if (difference !== 0) changes.push({ skill, difference });
  }
  assertSave(changes.length === 1 && changes[0].difference === 1, "CARD_NOT_CONSUMED_ONCE");

  const { skill } = changes[0];
  assertSave(ID_PATTERN.test(skill), "INVALID_LEDGER_SKILL");
  const key = ledgerKey(beforeState.matchId, actionId);
  const existing = root.receipts.matchConsumption[key];
  if (existing) {
    const expectedProfile = root.activeMatch?.participants?.[actor]?.profileId;
    assertSave(existing.matchId === beforeState.matchId && existing.actionId === actionId && existing.profileId === expectedProfile && existing.skill === skill && existing.version === result.state.version && (!actionFingerprint || existing.actionFingerprint === actionFingerprint), "ACTION_ID_COLLISION");
    return root;
  }

  assertSave(root.activeMatch?.state?.matchId === beforeState?.matchId, "ACTIVE_MATCH_MISMATCH");
  assertSave(root.activeMatch.state.version === beforeState.version, "ACTIVE_MATCH_VERSION_MISMATCH");

  const participant = root.activeMatch.participants[actor];
  const source = root.activeMatch.cardSources?.[actor]?.[skill] || "INVENTORY_BACKED";
  const profileId = participant?.type === "PROFILE" ? participant.profileId : null;
  if (source === "INVENTORY_BACKED") {
    assertSave(participant?.type === "PROFILE", "CPU_CARD_NOT_OWNED");
    assertSave((root.profiles[profileId].inventory[skill] || 0) > 0, "INVENTORY_EMPTY");
  }
  const next = clone(root);
  if (source === "INVENTORY_BACKED") next.profiles[profileId].inventory[skill] -= 1;
  if (source === "INVENTORY_BACKED" && Object.hasOwn(next.reservations, profileId)) {
    const reserved = next.reservations[profileId][skill] || 0;
    assertSave(reserved >= 1, "RESERVATION_CONSUMPTION_MISMATCH");
    next.reservations[profileId][skill] = reserved - 1;
  }
  next.activeMatch = { ...clone(root.activeMatch), state: clone(result.state), rngSnapshot: clone(rngSnapshot || {}) };
  next.rootRevision += 1;
  next.receipts.matchConsumption[key] = { matchId: beforeState.matchId, actionId, profileId, skill, version: result.state.version };
  if (root.activeMatch.cardSources) next.receipts.matchConsumption[key].source = source;
  if (actionFingerprint) next.receipts.matchConsumption[key].actionFingerprint = actionFingerprint;
  validateStandardSave(next);
  return Object.freeze(next);
}

function persistStandardSave(storage, root) {
  const payload = encodeStandardSave(root);
  storage.setItem(match.SAVE_KEY, payload);
  return payload;
}

module.exports = {
  ECONOMY_VERSION,
  LEGACY_SCHEMA_VERSION,
  MAX_SAVE_BYTES,
  PREVIOUS_SCHEMA_VERSION,
  RECEIPT_TERMINAL_REASONS,
  V3_SCHEMA_VERSION,
  RECEIPT_SCOPES,
  SAVE_SCHEMA_VERSION,
  StandardSaveError,
  commitAcceptedCardAction,
  createProfile,
  createStandardSave,
  decodeStandardSave,
  encodeStandardSave,
  migrateStandardRootV2ToV3,
  migrateStandardRootV3ToV4,
  migrateStandardRootV4ToV5,
  persistStandardSave,
  validateStandardSave,
};

},
"standard/standard-root-transaction.js":function(require,module,exports){
"use strict";

const save = require("./standard-save.js");
const profileModel = require("./standard-profile.js");
const cosmetics = require("./standard-cosmetics.js");
const match = require("./standard-match.js");

const CARD_SALE_RECEIPT_LIMIT = 256;
const COSMETIC_ACTION_RECEIPT_LIMIT = 256;
const SETTLEMENT_TERMINAL_REASONS = match.TERMINAL_REASONS;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function fingerprint(payload) {
  return JSON.stringify(canonical(payload));
}

function stableHash(payload) {
  const text = typeof payload === "string" ? payload : fingerprint(payload);
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function failure(code, root, extra = {}) {
  return Object.freeze({ ok: false, code, root, saved: false, ...extra });
}

function receiptKey(entityId, operationId) {
  return `${entityId}:${operationId}`;
}

function pruneCardSaleReceipts(receipts) {
  const entries = Object.entries(receipts);
  if (entries.length <= CARD_SALE_RECEIPT_LIMIT) return;
  entries.sort((a, b) => a[1].rootRevision - b[1].rootRevision || a[0].localeCompare(b[0]));
  for (const [key] of entries.slice(0, entries.length - CARD_SALE_RECEIPT_LIMIT)) delete receipts[key];
}

function pruneCosmeticActionReceipts(receipts) {
  const entries = Object.entries(receipts);
  if (entries.length <= COSMETIC_ACTION_RECEIPT_LIMIT) return;
  entries.sort((a, b) => a[1].rootRevision - b[1].rootRevision || a[0].localeCompare(b[0]));
  for (const [key] of entries.slice(0, entries.length - COSMETIC_ACTION_RECEIPT_LIMIT)) delete receipts[key];
}

function quoteCardSale({ root, profileId, skillId, quantity }) {
  try {
    save.validateStandardSave(root);
    if (!ID_PATTERN.test(profileId) || !root.profiles[profileId]) return failure("UNKNOWN_PROFILE", root);
    const reservedCount = root.reservations[profileId]?.[skillId] || 0;
    const quote = profileModel.quoteCardSale({ profile: root.profiles[profileId], skillId, count: quantity, reservedCount });
    return Object.freeze({ ok: true, code: quote.status, root, quote });
  } catch (error) {
    return failure(error.code || "SALE_REJECTED", root);
  }
}

function commitCardSale({ root, expectedRootRevision, operationId, profileId, skillId, quantity, acceptedConfirmationReasons = [], storage }) {
  try {
    save.validateStandardSave(root);
  } catch (error) {
    return failure(error.code || "INVALID_SAVE", root);
  }
  if (root.rootRevision !== expectedRootRevision) return failure("ROOT_REVISION_CONFLICT", root);
  if (!ID_PATTERN.test(operationId) || !ID_PATTERN.test(profileId)) return failure("INVALID_OPERATION_ID", root);
  const payload = { profileId, skillId, quantity, acceptedConfirmationReasons: [...acceptedConfirmationReasons].sort() };
  const actionFingerprint = fingerprint(payload);
  const key = receiptKey(profileId, operationId);
  const existing = root.receipts.cardSale[key];
  if (existing) {
    if (existing.actionFingerprint !== actionFingerprint) return failure("IDEMPOTENCY_KEY_REUSE", root);
    return Object.freeze({ ok: true, code: "IDEMPOTENT_REPLAY", root, receipt: Object.freeze(clone(existing)), saved: false });
  }

  const preflight = quoteCardSale({ root, profileId, skillId, quantity });
  if (!preflight.ok) return preflight;
  const required = preflight.quote.confirmationReasons;
  if (required.some((reason) => !acceptedConfirmationReasons.includes(reason))) return failure("CONFIRMATION_REQUIRED", root, { quote: preflight.quote });

  let changed;
  try {
    changed = profileModel.applyCardSale({
      profile: root.profiles[profileId],
      skillId,
      count: quantity,
      reservedCount: preflight.quote.reservedCount,
      confirmed: true,
    });
  } catch (error) {
    return failure(error.code || "SALE_REJECTED", root);
  }

  const next = clone(root);
  next.profiles[profileId] = clone(changed.profile);
  next.rootRevision += 1;
  const receipt = {
    scope: "cardSale",
    operationId,
    profileId,
    skillId,
    economyVersion: save.ECONOMY_VERSION,
    rarity: preflight.quote.rarity,
    unitPrice: preflight.quote.valuePerCard,
    quantity,
    totalCoins: preflight.quote.earnedCoins,
    rootRevision: next.rootRevision,
    actionFingerprint,
  };
  next.receipts.cardSale[key] = receipt;
  pruneCardSaleReceipts(next.receipts.cardSale);
  try {
    save.validateStandardSave(next);
    save.persistStandardSave(storage, next);
  } catch (error) {
    return failure(error instanceof save.StandardSaveError ? error.code : "PERSISTENCE_FAILED", root);
  }
  return Object.freeze({ ok: true, code: "COMMITTED", root: Object.freeze(next), receipt: Object.freeze(clone(receipt)), quote: preflight.quote, saved: true });
}

function quoteCosmeticAction({ root, profileId, cosmeticId }) {
  try {
    save.validateStandardSave(root);
    if (!ID_PATTERN.test(profileId) || !root.profiles[profileId]) return failure("UNKNOWN_PROFILE", root);
    const quote = cosmetics.quoteCosmeticAction({ profile: root.profiles[profileId], cosmeticId });
    return Object.freeze({ ok: true, code: "READY", root, quote });
  } catch (error) {
    return failure(error.code || "COSMETIC_ACTION_REJECTED", root);
  }
}

function commitCosmeticAction({ root, expectedRootRevision, operationId, profileId, cosmeticId, storage }) {
  try {
    save.validateStandardSave(root);
  } catch (error) {
    return failure(error.code || "INVALID_SAVE", root);
  }
  if (root.rootRevision !== expectedRootRevision) return failure("ROOT_REVISION_CONFLICT", root);
  if (!ID_PATTERN.test(operationId) || !ID_PATTERN.test(profileId)) return failure("INVALID_OPERATION_ID", root);
  const actionFingerprint = fingerprint({ profileId, cosmeticId });
  const key = receiptKey(profileId, operationId);
  const existing = root.receipts.cosmeticAction?.[key];
  if (existing) {
    if (existing.actionFingerprint !== actionFingerprint) return failure("IDEMPOTENCY_KEY_REUSE", root);
    return Object.freeze({ ok: true, code: "IDEMPOTENT_REPLAY", root, receipt: Object.freeze(clone(existing)), saved: false });
  }
  const preflight = quoteCosmeticAction({ root, profileId, cosmeticId });
  if (!preflight.ok) return preflight;
  let changed;
  try {
    changed = cosmetics.applyCosmeticAction({ profile: root.profiles[profileId], cosmeticId });
  } catch (error) {
    return failure(error.code || "COSMETIC_ACTION_REJECTED", root);
  }
  const next = clone(root);
  next.profiles[profileId] = clone(changed.profile);
  next.rootRevision += 1;
  if (!next.receipts.cosmeticAction) next.receipts.cosmeticAction = {};
  const receipt = {
    scope: "cosmeticAction",
    operationId,
    profileId,
    cosmeticId,
    type: changed.quote.type,
    action: changed.quote.action,
    price: changed.quote.price,
    coinsAfter: changed.quote.coinsAfter,
    rootRevision: next.rootRevision,
    actionFingerprint,
  };
  next.receipts.cosmeticAction[key] = receipt;
  pruneCosmeticActionReceipts(next.receipts.cosmeticAction);
  try {
    save.validateStandardSave(next);
    save.persistStandardSave(storage, next);
  } catch (error) {
    return failure(error instanceof save.StandardSaveError ? error.code : "PERSISTENCE_FAILED", root);
  }
  return Object.freeze({ ok: true, code: "COMMITTED", root: Object.freeze(next), receipt: Object.freeze(clone(receipt)), quote: changed.quote, saved: true });
}

function settlementFacts(root, matchId) {
  save.validateStandardSave(root);
  const activeMatch = root.activeMatch;
  if (!activeMatch) throw Object.assign(new Error("NO_ACTIVE_MATCH"), { code: "NO_ACTIVE_MATCH" });
  const state = activeMatch.state;
  if (state.matchId !== matchId) throw Object.assign(new Error("MATCH_ID_MISMATCH"), { code: "MATCH_ID_MISMATCH" });
  match.validateStandardState(state);
  if (state.phase !== "GAME_OVER" || state.status !== "FINISHED") throw Object.assign(new Error("MATCH_NOT_COMPLETE"), { code: "MATCH_NOT_COMPLETE" });
  if (!SETTLEMENT_TERMINAL_REASONS.includes(state.terminalReason)) throw Object.assign(new Error("UNKNOWN_TERMINAL_REASON"), { code: "UNKNOWN_TERMINAL_REASON" });
  if (!activeMatch.startedAt) throw Object.assign(new Error("MISSING_STARTED_AT"), { code: "MISSING_STARTED_AT" });
  const participantFacts = Object.fromEntries(["A", "B"].map((seat) => {
    const participant = activeMatch.participants[seat];
    return [seat, participant.type === "PROFILE"
      ? { type: "PROFILE", profileId: participant.profileId }
      : { type: "CPU", difficulty: participant.difficulty, policyVersion: participant.policyVersion }];
  }));
  const publicState = match.projectStandardPublicState(state);
  const finalStateHash = stableHash(publicState);
  const mapComplete = match.isMapCompleteWin(state);
  const facts = {
    matchId,
    mode: state.mode,
    engineVersion: state.engineVersion,
    finalMatchVersion: state.version,
    finalStateHash,
    participants: participantFacts,
    winnerSeat: state.winner,
    terminalReason: state.terminalReason,
    turnCount: state.turn,
    actionCount: state.version,
    mapComplete,
  };
  return { activeMatch, state, facts, resultFingerprint: stableHash(facts) };
}

function historyContextFor({ activeMatch, state, seat, finishedAt, mapComplete }) {
  const participant = activeMatch.participants[seat];
  const opponentSeat = seat === "A" ? "B" : "A";
  const opponent = activeMatch.participants[opponentSeat];
  return {
    mode: state.mode,
    profileId: participant.profileId,
    opponentProfileId: opponent.type === "PROFILE" ? opponent.profileId : null,
    opponentType: opponent.type,
    displayNameSnapshot: participant.displayNameSnapshot,
    opponentDisplayNameSnapshot: opponent.type === "PROFILE" ? opponent.displayNameSnapshot : null,
    winnerSeat: state.winner,
    startedAt: activeMatch.startedAt,
    finishedAt,
    turnCount: state.turn,
    actionCount: state.version,
    mapComplete,
    cpuDifficulty: opponent.type === "CPU" ? opponent.difficulty : null,
    cpuPolicyVersion: opponent.type === "CPU" ? opponent.policyVersion : null,
  };
}

function applyMatchSettlementToDraft({ draftRoot, operationId, matchId, clock }) {
  const { activeMatch, state, facts, resultFingerprint } = settlementFacts(draftRoot, matchId);
  const settledAt = clock.now();
  if (typeof settledAt !== "string" || !Number.isFinite(Date.parse(settledAt))) throw Object.assign(new Error("INVALID_CLOCK"), { code: "INVALID_CLOCK" });
  const finishedAt = activeMatch.finishedAt || settledAt;
  const profileResults = {};
  for (const seat of ["A", "B"]) {
    const participant = activeMatch.participants[seat];
    if (participant.type !== "PROFILE") continue;
    const profileId = participant.profileId;
    const reserved = draftRoot.reservations[profileId] || {};
    if (typeof reserved !== "object" || Array.isArray(reserved)) throw Object.assign(new Error("MISSING_MATCH_RESERVATION"), { code: "MISSING_MATCH_RESERVATION" });
    const hand = state.hands[seat] || {};
    const sources = activeMatch.cardSources?.[seat] || Object.fromEntries(Object.keys(hand).map((skillId) => [skillId, "INVENTORY_BACKED"]));
    const skillIds = new Set([...Object.keys(reserved), ...Object.keys(hand), ...Object.keys(sources)]);
    for (const skillId of skillIds) {
      const expected = sources[skillId] === "INVENTORY_BACKED" ? (hand[skillId] || 0) : 0;
      if ((reserved[skillId] || 0) !== expected) throw Object.assign(new Error("RESERVATION_HAND_MISMATCH"), { code: "RESERVATION_HAND_MISMATCH" });
    }
    const context = historyContextFor({ activeMatch, state, seat, finishedAt, mapComplete: facts.mapComplete });
    const updated = profileModel.recordMatchOutcome({
      profile: draftRoot.profiles[profileId],
      matchId,
      won: state.winner === seat,
      terminalReason: state.terminalReason,
      fullPaint: state.winner === seat && facts.mapComplete,
      skillsUsed: state.skillsUsed[seat] || 0,
      endedAt: settledAt,
    });
    const mutable = clone(updated);
    Object.assign(mutable.matchHistory[0], context);
    draftRoot.profiles[profileId] = mutable;
    delete draftRoot.reservations[profileId];
    profileResults[profileId] = { result: state.winner === seat ? "WIN" : "LOSS", stats: clone(mutable.stats), trophies: clone(mutable.trophies) };
  }
  draftRoot.rootRevision += 1;
  const receipt = {
    scope: "matchSettlement",
    operationId,
    matchId,
    resultFingerprint,
    winnerSeat: state.winner,
    terminalReason: state.terminalReason,
    settledAt,
    rootRevision: draftRoot.rootRevision,
    profileResults: clone(profileResults),
  };
  draftRoot.receipts.matchSettlement.byMatchId[matchId] = receipt;
  draftRoot.receipts.matchSettlement.operationIndex[operationId] = matchId;
  draftRoot.activeMatch.finishedAt = finishedAt;
  draftRoot.activeMatch.settlement = { settled: true, operationId, resultFingerprint, settledAt, rootRevision: draftRoot.rootRevision };
  return { receipt, profileResults, facts };
}

function settleCompletedMatch({ root, expectedRootRevision, operationId, matchId, clock, storageAdapter }) {
  if (!ID_PATTERN.test(operationId) || !ID_PATTERN.test(matchId)) return failure("INVALID_OPERATION_ID", root, { status: "REJECTED" });
  let current;
  try {
    current = settlementFacts(root, matchId);
  } catch (error) {
    return failure(error.code || "SETTLEMENT_REJECTED", root, { status: "REJECTED" });
  }
  const receipts = root.receipts.matchSettlement;
  const byMatch = receipts.byMatchId[matchId];
  if (byMatch) {
    if (byMatch.resultFingerprint !== current.resultFingerprint) return failure("SETTLEMENT_CONFLICT", root, { status: "REJECTED" });
    return Object.freeze({ ok: true, status: "ALREADY_SETTLED", code: "ALREADY_SETTLED", root, rootRevision: root.rootRevision, receipt: Object.freeze(clone(byMatch)), profileResults: Object.freeze(clone(byMatch.profileResults)), saved: false });
  }
  const indexedMatch = receipts.operationIndex[operationId];
  if (indexedMatch && indexedMatch !== matchId) return failure("IDEMPOTENCY_KEY_REUSE", root, { status: "REJECTED" });
  if (root.rootRevision !== expectedRootRevision) return failure("STALE_ROOT_REVISION", root, { status: "REJECTED" });

  const draft = clone(root);
  let applied;
  try {
    applied = applyMatchSettlementToDraft({ draftRoot: draft, operationId, matchId, clock });
    save.validateStandardSave(draft);
    save.persistStandardSave(storageAdapter, draft);
  } catch (error) {
    return failure(error instanceof save.StandardSaveError ? error.code : (error.code || "PERSISTENCE_FAILED"), root, { status: "REJECTED" });
  }
  return Object.freeze({ ok: true, status: "SETTLED", code: "SETTLED", root: Object.freeze(draft), rootRevision: draft.rootRevision, receipt: Object.freeze(clone(applied.receipt)), profileResults: Object.freeze(clone(applied.profileResults)), saved: true });
}

module.exports = { CARD_SALE_RECEIPT_LIMIT, COSMETIC_ACTION_RECEIPT_LIMIT, SETTLEMENT_TERMINAL_REASONS, applyMatchSettlementToDraft, commitCardSale, commitCosmeticAction, fingerprint, quoteCardSale, quoteCosmeticAction, receiptKey, settleCompletedMatch, settlementFacts, stableHash };

},
"standard/standard-loadout-quote.js":function(require,module,exports){
"use strict";

const save = require("./standard-save.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("./standard-skill-registry.js");
const { stableHash } = require("./standard-root-transaction.js");

const STANDARD_MODE = "STANDARD_V5";
const STANDARD_REGISTRY_REVISION = "standard-skill-registry-v1";
const DEFAULT_QUOTE_TTL_MS = 5 * 60 * 1000;
const LOADOUT_CATEGORIES = Object.freeze(["color", "area", "disrupt"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function rejected(code, extra = {}) {
  return deepFreeze({ ok: false, status: "REJECTED", code, ...extra });
}

function timestamp(value, code) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw Object.assign(new Error(code), { code });
  return value;
}

function normalizeStandardLoadout(loadout) {
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout)) throw Object.assign(new Error("INVALID_LOADOUT"), { code: "INVALID_LOADOUT" });
  if (Object.keys(loadout).length !== LOADOUT_CATEGORIES.length || Object.keys(loadout).some((category) => !LOADOUT_CATEGORIES.includes(category))) {
    throw Object.assign(new Error("INVALID_STANDARD_LOADOUT"), { code: "INVALID_STANDARD_LOADOUT" });
  }
  const normalized = {};
  const all = [];
  for (const category of LOADOUT_CATEGORIES) {
    const ids = loadout[category];
    if (!Array.isArray(ids) || ids.length !== 2 || ids.some((id) => typeof id !== "string")) {
      throw Object.assign(new Error("INVALID_STANDARD_LOADOUT"), { code: "INVALID_STANDARD_LOADOUT" });
    }
    normalized[category] = [...ids];
    all.push(...ids);
    for (const skillId of ids) {
      const definition = STANDARD_SKILLS[skillId];
      if (!definition || definition.category !== category || !definition.v49Catalogued || !definition.standardEngineImplemented || !definition.standardUiEnabled || definition.experimental) {
        throw Object.assign(new Error("SKILL_NOT_AVAILABLE"), { code: "SKILL_NOT_AVAILABLE" });
      }
    }
  }
  if (new Set(all).size !== all.length) throw Object.assign(new Error("DUPLICATE_LOADOUT_SKILL"), { code: "DUPLICATE_LOADOUT_SKILL" });
  return normalized;
}

function projectStandardInventory({ root, actorId }) {
  try {
    save.validateStandardSave(root);
    if (!ID_PATTERN.test(actorId || "") || !root.profiles[actorId]) return rejected("UNKNOWN_PROFILE");
    const profile = root.profiles[actorId];
    const items = V49_SKILL_IDS.filter((skillId) => STANDARD_SKILLS[skillId].standardUiEnabled && !STANDARD_SKILLS[skillId].experimental).map((skillId) => {
      const definition = STANDARD_SKILLS[skillId];
      const ownedCount = profile.inventory[skillId] || 0;
      const reservedCount = root.reservations[actorId]?.[skillId] || 0;
      const availableCount = ownedCount - reservedCount;
      if (![ownedCount, reservedCount, availableCount].every((count) => Number.isSafeInteger(count) && count >= 0)) {
        throw Object.assign(new Error("INVALID_INVENTORY_PROJECTION"), { code: "INVALID_INVENTORY_PROJECTION" });
      }
      return { skillId, category: definition.category, rarity: definition.rarity, ownedCount, reservedCount, availableCount, standardUiEnabled: true };
    });
    return deepFreeze({ ok: true, status: "READY", code: "READY", actorId, inventoryRevision: root.rootRevision, registryRevision: STANDARD_REGISTRY_REVISION, items });
  } catch (error) {
    return rejected(error.code || "INVENTORY_PROJECTION_REJECTED");
  }
}

function quoteDigest(quote) {
  return stableHash({
    quoteId: quote.quoteId,
    actorId: quote.actorId,
    seat: quote.seat,
    roomId: quote.roomId,
    mode: quote.mode,
    normalizedLoadout: quote.normalizedLoadout,
    inventoryRevision: quote.inventoryRevision,
    registryRevision: quote.registryRevision,
    createdAt: quote.createdAt,
    expiresAt: quote.expiresAt,
  });
}

function createStandardLoadoutQuote({ root, expectedRootRevision, quoteId, actorId, seat, roomId, loadout, now, ttlMs = DEFAULT_QUOTE_TTL_MS }) {
  try {
    save.validateStandardSave(root);
    if (![quoteId, actorId, roomId].every((id) => ID_PATTERN.test(id || ""))) return rejected("INVALID_QUOTE_ID");
    if (!["A", "B"].includes(seat)) return rejected("INVALID_SEAT");
    if (!root.profiles[actorId]) return rejected("UNKNOWN_PROFILE");
    if (root.rootRevision !== expectedRootRevision) return rejected("STALE_INVENTORY_REVISION");
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 60 * 60 * 1000) return rejected("INVALID_QUOTE_TTL");
    const createdAt = timestamp(now, "INVALID_CLOCK");
    const expiresAt = new Date(Date.parse(createdAt) + ttlMs).toISOString();
    const normalizedLoadout = normalizeStandardLoadout(loadout);
    const inventory = projectStandardInventory({ root, actorId });
    if (!inventory.ok) return inventory;
    const byId = Object.fromEntries(inventory.items.map((item) => [item.skillId, item]));
    for (const skillId of Object.values(normalizedLoadout).flat()) if (byId[skillId]?.availableCount < 1) return rejected("INSUFFICIENT_INVENTORY");
    const quote = {
      quoteId,
      actorId,
      seat,
      roomId,
      mode: STANDARD_MODE,
      normalizedLoadout,
      inventoryRevision: root.rootRevision,
      registryRevision: STANDARD_REGISTRY_REVISION,
      createdAt,
      expiresAt,
    };
    quote.loadoutDigest = quoteDigest(quote);
    return deepFreeze({ ok: true, status: "QUOTED", code: "QUOTED", quote });
  } catch (error) {
    return rejected(error.code || "LOADOUT_QUOTE_REJECTED");
  }
}

function verifyStandardLoadoutQuote({ root, quote, quoteId, actorId, seat, roomId, now }) {
  try {
    save.validateStandardSave(root);
    if (!quote || typeof quote !== "object" || Array.isArray(quote)) return rejected("UNKNOWN_QUOTE");
    if (quote.quoteId !== quoteId || quote.actorId !== actorId) return rejected("QUOTE_OWNER_MISMATCH");
    if (quote.seat !== seat) return rejected("QUOTE_SEAT_MISMATCH");
    if (quote.roomId !== roomId) return rejected("QUOTE_ROOM_MISMATCH");
    if (quote.mode !== STANDARD_MODE) return rejected("QUOTE_MODE_MISMATCH");
    if (quote.registryRevision !== STANDARD_REGISTRY_REVISION) return rejected("STALE_REGISTRY_REVISION");
    if (quote.inventoryRevision !== root.rootRevision) return rejected("STALE_INVENTORY_REVISION");
    timestamp(quote.createdAt, "INVALID_QUOTE");
    if (Date.parse(timestamp(now, "INVALID_CLOCK")) >= Date.parse(timestamp(quote.expiresAt, "INVALID_QUOTE"))) return rejected("QUOTE_EXPIRED");
    const normalizedLoadout = normalizeStandardLoadout(quote.normalizedLoadout);
    if (quoteDigest({ ...quote, normalizedLoadout }) !== quote.loadoutDigest) return rejected("QUOTE_DIGEST_MISMATCH");
    const inventory = projectStandardInventory({ root, actorId });
    if (!inventory.ok) return inventory;
    const byId = Object.fromEntries(inventory.items.map((item) => [item.skillId, item]));
    for (const skillId of Object.values(normalizedLoadout).flat()) if (byId[skillId]?.availableCount < 1) return rejected("INSUFFICIENT_INVENTORY");
    return deepFreeze({ ok: true, status: "VERIFIED", code: "VERIFIED", quote: { ...clone(quote), normalizedLoadout } });
  } catch (error) {
    return rejected(error.code || "LOADOUT_QUOTE_REJECTED");
  }
}

module.exports = {
  DEFAULT_QUOTE_TTL_MS,
  LOADOUT_CATEGORIES,
  STANDARD_MODE,
  STANDARD_REGISTRY_REVISION,
  createStandardLoadoutQuote,
  normalizeStandardLoadout,
  projectStandardInventory,
  quoteDigest,
  verifyStandardLoadoutQuote,
};

},
"standard/standard-match-start.js":function(require,module,exports){
"use strict";

const engine = require("./standard-engine.js");
const match = require("./standard-match.js");
const save = require("./standard-save.js");
const { STANDARD_SKILLS } = require("./standard-skill-registry.js");
const { stableHash } = require("./standard-root-transaction.js");

const INITIAL_CONFIG_VERSION = "standard-match-init-v1";
const RULE_SET_IDS = Object.freeze({ STANDARD: "STANDARD_V5", ALPHA_SLICE: "STANDARD_V5_ALPHA_SLICE" });
const ALPHA_SLICE_SKILLS = Object.freeze(["colorPrism", "areaHalfShift", "disruptChoiceOne", "legalRecolor"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function fingerprint(value) {
  return JSON.stringify(canonical(value));
}

function rejected(code, root, extra = {}) {
  return Object.freeze({ ok: false, status: "REJECTED", code, root, saved: false, ...extra });
}

function normalizeLoadout(loadout) {
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout)) throw Object.assign(new Error("INVALID_LOADOUT"), { code: "INVALID_LOADOUT" });
  const normalized = {};
  for (const [category, entries] of Object.entries(loadout)) {
    if (!Array.isArray(entries) || entries.some((id) => typeof id !== "string")) throw Object.assign(new Error("INVALID_LOADOUT"), { code: "INVALID_LOADOUT" });
    normalized[category] = [...entries];
  }
  return normalized;
}

function flatSkills(loadout) {
  return Object.values(loadout).flat();
}

function validateRuleSetLoadout(ruleSetId, loadout) {
  const ids = flatSkills(loadout);
  if (new Set(ids).size !== ids.length) throw Object.assign(new Error("DUPLICATE_LOADOUT_SKILL"), { code: "DUPLICATE_LOADOUT_SKILL" });
  if (ruleSetId === RULE_SET_IDS.STANDARD) {
    const categories = ["color", "area", "disrupt"];
    if (Object.keys(loadout).some((category) => !categories.includes(category))) throw Object.assign(new Error("INVALID_STANDARD_LOADOUT"), { code: "INVALID_STANDARD_LOADOUT" });
    if (categories.some((category) => loadout[category]?.length !== 2) || ids.length !== 6) throw Object.assign(new Error("INVALID_STANDARD_LOADOUT"), { code: "INVALID_STANDARD_LOADOUT" });
    for (const category of categories) for (const id of loadout[category]) {
      const definition = STANDARD_SKILLS[id];
      if (!definition || definition.category !== category || !definition.v49Catalogued || !definition.standardEngineImplemented || !definition.standardUiEnabled) {
        throw Object.assign(new Error("SKILL_NOT_AVAILABLE"), { code: "SKILL_NOT_AVAILABLE" });
      }
    }
    return;
  }
  if (ruleSetId === RULE_SET_IDS.ALPHA_SLICE) {
    if (ids.length !== ALPHA_SLICE_SKILLS.length || ALPHA_SLICE_SKILLS.some((id) => !ids.includes(id))) throw Object.assign(new Error("INVALID_ALPHA_SLICE_LOADOUT"), { code: "INVALID_ALPHA_SLICE_LOADOUT" });
    for (const [category, entries] of Object.entries(loadout)) for (const id of entries) {
      const definition = STANDARD_SKILLS[id];
      if (!definition?.standardEngineImplemented) throw Object.assign(new Error("SKILL_NOT_IMPLEMENTED"), { code: "SKILL_NOT_IMPLEMENTED" });
      if (definition.category !== category) throw Object.assign(new Error("INVALID_ALPHA_SLICE_LOADOUT"), { code: "INVALID_ALPHA_SLICE_LOADOUT" });
    }
    return;
  }
  throw Object.assign(new Error("UNKNOWN_RULE_SET"), { code: "UNKNOWN_RULE_SET" });
}

function normalizeParticipants(root, participants) {
  if (!participants || typeof participants !== "object" || Array.isArray(participants)) throw Object.assign(new Error("INVALID_PARTICIPANTS"), { code: "INVALID_PARTICIPANTS" });
  const normalized = {};
  for (const seat of ["A", "B"]) {
    const participant = participants[seat];
    if (!participant || typeof participant !== "object" || Array.isArray(participant)) throw Object.assign(new Error("INVALID_PARTICIPANT"), { code: "INVALID_PARTICIPANT" });
    if (participant.type === "PROFILE") {
      const profile = root.profiles[participant.profileId];
      if (!ID_PATTERN.test(participant.profileId || "") || !profile) throw Object.assign(new Error("UNKNOWN_PROFILE"), { code: "UNKNOWN_PROFILE" });
      normalized[seat] = { type: "PROFILE", profileId: participant.profileId, displayNameSnapshot: profile.displayName };
    } else if (participant.type === "CPU") {
      if (!["easy", "normal", "hard"].includes(participant.difficulty) || typeof participant.policyVersion !== "string" || !participant.policyVersion) {
        throw Object.assign(new Error("INVALID_CPU_PARTICIPANT"), { code: "INVALID_CPU_PARTICIPANT" });
      }
      normalized[seat] = { type: "CPU", difficulty: participant.difficulty, policyVersion: participant.policyVersion };
    } else {
      throw Object.assign(new Error("INVALID_PARTICIPANT_TYPE"), { code: "INVALID_PARTICIPANT_TYPE" });
    }
  }
  const profileIds = Object.values(normalized).filter((entry) => entry.type === "PROFILE").map((entry) => entry.profileId);
  if (!profileIds.length || new Set(profileIds).size !== profileIds.length) throw Object.assign(new Error("DUPLICATE_OR_MISSING_PROFILE_PARTICIPANT"), { code: "DUPLICATE_OR_MISSING_PROFILE_PARTICIPANT" });
  return normalized;
}

function reservationPlan(root, participants, loadouts) {
  const reservations = {};
  const sources = { A: {}, B: {} };
  for (const seat of ["A", "B"]) {
    const participant = participants[seat];
    for (const skillId of flatSkills(loadouts[seat])) {
      const loan = skillId === "legalRecolor";
      const source = loan ? "EXPERIMENTAL_LOAN" : (participant.type === "CPU" ? "CPU_VIRTUAL" : "INVENTORY_BACKED");
      sources[seat][skillId] = source;
      if (source !== "INVENTORY_BACKED") continue;
      const count = root.profiles[participant.profileId].inventory[skillId] || 0;
      if (count < 1) throw Object.assign(new Error("INSUFFICIENT_INVENTORY"), { code: "INSUFFICIENT_INVENTORY" });
      reservations[participant.profileId] ||= {};
      reservations[participant.profileId][skillId] = 1;
    }
  }
  return { reservations, sources };
}

function requestFacts({ matchId, ruleSetId, participants, loadouts, firstSeat }) {
  return {
    matchId,
    ruleSetId,
    mode: "standard",
    participants: Object.fromEntries(["A", "B"].map((seat) => [seat, participants[seat].type === "PROFILE"
      ? { type: "PROFILE", profileId: participants[seat].profileId }
      : { type: "CPU", difficulty: participants[seat].difficulty, policyVersion: participants[seat].policyVersion }])),
    loadouts,
    firstSeat: firstSeat || null,
    engineVersion: match.ENGINE_VERSION,
    initialConfigVersion: INITIAL_CONFIG_VERSION,
  };
}

function quoteStandardMatchStart({ root, expectedRootRevision, operationId, matchId, ruleSetId, participants, loadouts, firstSeat = null }) {
  try {
    save.validateStandardSave(root);
    if (!ID_PATTERN.test(operationId || "") || !ID_PATTERN.test(matchId || "")) return rejected("INVALID_OPERATION_ID", root);
    if (firstSeat !== null && !["A", "B"].includes(firstSeat)) return rejected("INVALID_FIRST_SEAT", root);
    const normalizedParticipants = normalizeParticipants(root, participants);
    const normalizedLoadouts = Object.fromEntries(["A", "B"].map((seat) => [seat, normalizeLoadout(loadouts?.[seat])]));
    const facts = requestFacts({ matchId, ruleSetId, participants: normalizedParticipants, loadouts: normalizedLoadouts, firstSeat });
    const requestFingerprint = stableHash(facts);
    const existing = root.receipts.matchStart.byMatchId[matchId];
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) return rejected("MATCH_START_CONFLICT", root);
      const reusedMatch = root.receipts.matchStart.operationIndex[operationId];
      if (reusedMatch && reusedMatch !== matchId) return rejected("IDEMPOTENCY_KEY_REUSE", root);
      return Object.freeze({ ok: true, status: "ALREADY_STARTED", code: "ALREADY_STARTED", root, saved: false, receipt: Object.freeze(clone(existing)) });
    }
    const indexedMatch = root.receipts.matchStart.operationIndex[operationId];
    if (indexedMatch && indexedMatch !== matchId) return rejected("IDEMPOTENCY_KEY_REUSE", root);
    if (root.rootRevision !== expectedRootRevision) return rejected("STALE_ROOT_REVISION", root);
    for (const seat of ["A", "B"]) validateRuleSetLoadout(ruleSetId, normalizedLoadouts[seat]);
    if (root.activeMatch && (!root.activeMatch.settlement?.settled || Object.values(root.reservations).some((entry) => Object.values(entry).some((count) => count > 0)))) {
      return rejected(root.activeMatch.settlement?.settled ? "ACTIVE_MATCH_RESERVATION_REMAINS" : "ACTIVE_MATCH_EXISTS", root);
    }
    if (Object.values(root.reservations).some((entry) => Object.values(entry).some((count) => count > 0))) return rejected("RESERVATION_INCONSISTENT", root);
    for (const name of match.REQUIRED_RNG_STREAMS) if (!Number.isSafeInteger(root.rngSnapshot[name])) return rejected("RNG_SNAPSHOT_REQUIRED", root);
    const plan = reservationPlan(root, normalizedParticipants, normalizedLoadouts);
    const seedMaterialFingerprint = stableHash(root.rngSnapshot);
    const actionFingerprint = stableHash({ ...facts, seedMaterialFingerprint });
    return Object.freeze({
      ok: true,
      status: "READY",
      code: "READY",
      root,
      saved: false,
      requestFingerprint,
      actionFingerprint,
      seedMaterialFingerprint,
      participants: Object.freeze(clone(normalizedParticipants)),
      loadouts: Object.freeze(clone(normalizedLoadouts)),
      reservations: Object.freeze(clone(plan.reservations)),
      sources: Object.freeze(clone(plan.sources)),
    });
  } catch (error) {
    return rejected(error.code || "MATCH_START_REJECTED", root);
  }
}

function startStandardMatch(args) {
  const quote = quoteStandardMatchStart(args);
  if (!quote.ok || quote.status === "ALREADY_STARTED") return quote;
  const { root, operationId, matchId, ruleSetId, quoteIds = null, firstSeat = null, clock, storageAdapter } = args;
  if (quoteIds !== null && (!quoteIds || typeof quoteIds !== "object" || Array.isArray(quoteIds)
    || !ID_PATTERN.test(quoteIds.A || "") || !ID_PATTERN.test(quoteIds.B || "")
    || quoteIds.A === quoteIds.B)) return rejected("INVALID_LOADOUT_QUOTE_IDS", root);
  const draft = clone(root);
  try {
    const startedAt = clock.now();
    if (typeof startedAt !== "string" || !Number.isFinite(Date.parse(startedAt))) throw Object.assign(new Error("INVALID_CLOCK"), { code: "INVALID_CLOCK" });
    const streams = engine.createRngDomainsFromSnapshot(draft.rngSnapshot, match.REQUIRED_RNG_STREAMS);
    const state = match.createStandardMatch({ matchId, firstSeat, loadouts: quote.loadouts }, streams);
    draft.rngSnapshot = clone(engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS));
    draft.reservations = clone(quote.reservations);
    draft.activeMatch = {
      ruleSetId,
      state,
      rngSnapshot: clone(draft.rngSnapshot),
      participants: clone(quote.participants),
      cardSources: clone(quote.sources),
      startedAt,
      finishedAt: null,
      settlement: { settled: false },
    };
    draft.rootRevision += 1;
    const receipt = {
      scope: "matchStart",
      operationId,
      matchId,
      ruleSetId,
      requestFingerprint: quote.requestFingerprint,
      actionFingerprint: quote.actionFingerprint,
      seedMaterialFingerprint: quote.seedMaterialFingerprint,
      initialStateHash: stableHash(match.projectStandardPublicState(state)),
      startedAt,
      rootRevision: draft.rootRevision,
      reservations: clone(quote.reservations),
    };
    if (quoteIds !== null) receipt.quoteIds = clone({ A: quoteIds.A, B: quoteIds.B });
    draft.receipts.matchStart.byMatchId[matchId] = receipt;
    draft.receipts.matchStart.operationIndex[operationId] = matchId;
    save.validateStandardSave(draft);
    save.persistStandardSave(storageAdapter, draft);
    return Object.freeze({ ok: true, status: "STARTED", code: "STARTED", root: Object.freeze(draft), rootRevision: draft.rootRevision, receipt: Object.freeze(clone(receipt)), saved: true });
  } catch (error) {
    const code = error instanceof save.StandardSaveError || typeof error?.code === "string" ? error.code : "PERSISTENCE_FAILED";
    return rejected(code || "PERSISTENCE_FAILED", root);
  }
}

module.exports = {
  ALPHA_SLICE_SKILLS,
  INITIAL_CONFIG_VERSION,
  RULE_SET_IDS,
  quoteStandardMatchStart,
  startStandardMatch,
};

},
"standard/standard-match-transaction.js":function(require,module,exports){
"use strict";

const engine = require("./standard-engine.js");
const match = require("./standard-match.js");
const save = require("./standard-save.js");

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function fingerprint({ matchId, actorSeat, action }) {
  return JSON.stringify(canonical({ matchId, actorSeat, type: action.type, payload: action.payload || {} }));
}

function receiptKey(matchId, actionId) {
  return `${matchId}:${actionId}`;
}

function rejected(code, root, extra = {}) {
  return Object.freeze({ ok: false, status: "REJECTED", code, root, saved: false, appliedNow: false, replayedReceipt: false, ...extra });
}

function snapshotRng(rngStreams) {
  return Object.fromEntries(match.REQUIRED_RNG_STREAMS.map((name) => [name, rngStreams[name].snapshot()]));
}

function replayResult(root, receipt) {
  return Object.freeze({
    ok: true,
    status: "RESOLVED",
    code: "IDEMPOTENT_REPLAY",
    resultCode: receipt.resultCode,
    root,
    rootRevision: root.rootRevision,
    matchVersion: root.activeMatch.state.version,
    receipt: Object.freeze(clone(receipt)),
    publicState: match.projectStandardPublicState(root.activeMatch.state),
    appliedNow: false,
    replayedReceipt: true,
    saved: false,
  });
}

function validContactColorCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= 4;
}

function dispatchStandardMatchAction({
  root,
  expectedRootRevision,
  expectedMatchVersion,
  matchId,
  actorSeat,
  action,
  storageAdapter,
}) {
  try {
    save.validateStandardSave(root);
  } catch (error) {
    return rejected(error.code || "INVALID_SAVE", root);
  }
  if (!ID_PATTERN.test(matchId) || !ID_PATTERN.test(action?.id || "")) return rejected("INVALID_ACTION_ID", root);
  if (!['A', 'B'].includes(actorSeat) || !action || typeof action.type !== "string") return rejected("INVALID_ACTION", root);
  const activeMatch = root.activeMatch;
  if (!activeMatch) return rejected("NO_ACTIVE_MATCH", root);
  if (activeMatch.state.matchId !== matchId) return rejected("MATCH_ID_MISMATCH", root);

  const actionFingerprint = fingerprint({ matchId, actorSeat, action });
  const key = receiptKey(matchId, action.id);
  const existing = root.receipts.matchAction[key];
  if (existing) {
    if (existing.actionFingerprint !== actionFingerprint) return rejected("IDEMPOTENCY_KEY_REUSE", root);
    return replayResult(root, existing);
  }
  if (root.rootRevision !== expectedRootRevision) return rejected("STALE_ROOT_REVISION", root);
  if (activeMatch.state.version !== expectedMatchVersion) return rejected("STALE_MATCH_VERSION", root);

  let rngStreams;
  try {
    rngStreams = engine.createRngDomainsFromSnapshot(activeMatch.rngSnapshot, match.REQUIRED_RNG_STREAMS);
  } catch {
    return rejected("INVALID_RNG_SNAPSHOT", root);
  }
  const result = match.applyStandardAction({
    state: activeMatch.state,
    actor: actorSeat,
    action,
    expectedVersion: expectedMatchVersion,
    rngStreams,
  });
  if (!result.ok) return rejected(result.code, root);
  if (action.type === "CREATE_REGION" && !validContactColorCount(result.contactColorCount)) {
    return rejected("INVALID_CONTACT_COLOR_COUNT", root);
  }

  const rngSnapshot = snapshotRng(rngStreams);
  let next;
  try {
    if (action.type === "USE_SKILL") {
      next = clone(save.commitAcceptedCardAction({
        root,
        beforeState: activeMatch.state,
        result,
        actor: actorSeat,
        actionId: action.id,
        actionFingerprint,
        rngSnapshot,
      }));
    } else {
      next = clone(root);
      next.activeMatch.state = clone(result.state);
      next.activeMatch.rngSnapshot = clone(rngSnapshot);
      next.rootRevision += 1;
    }
    const receipt = {
      scope: "matchAction",
      matchId,
      actionId: action.id,
      actorSeat,
      actionFingerprint,
      resultCode: result.code,
      matchVersion: result.state.version,
      rootRevision: next.rootRevision,
    };
    next.receipts.matchAction[key] = receipt;
    save.validateStandardSave(next);
    save.persistStandardSave(storageAdapter, next);
    return Object.freeze({
      ok: true,
      status: "RESOLVED",
      code: result.code,
      root: Object.freeze(next),
      rootRevision: next.rootRevision,
      matchVersion: result.state.version,
      receipt: Object.freeze(clone(receipt)),
      publicState: match.projectStandardPublicState(result.state),
      contactColorCount: action.type === "CREATE_REGION" ? result.contactColorCount : null,
      appliedNow: true,
      replayedReceipt: false,
      saved: true,
    });
  } catch (error) {
    return rejected(error instanceof save.StandardSaveError ? error.code : "PERSISTENCE_FAILED", root);
  }
}

module.exports = { dispatchStandardMatchAction, fingerprint, receiptKey, validContactColorCount };

},
"standard/standard-local-session.js":function(require,module,exports){
"use strict";

const match = require("./standard-match.js");
const matchStart = require("./standard-match-start.js");
const matchTransaction = require("./standard-match-transaction.js");
const rootTransaction = require("./standard-root-transaction.js");
const save = require("./standard-save.js");
const profileModel = require("./standard-profile.js");
const loadoutQuote = require("./standard-loadout-quote.js");
const quizTransaction = require("./standard-quiz-transaction.js");
const gachaTransaction = require("./standard-gacha-transaction.js");
const cosmetics = require("./standard-cosmetics.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("./standard-skill-registry.js");

const ALPHA_INVENTORY_SKILLS = Object.freeze(["colorPrism", "areaHalfShift", "disruptChoiceOne"]);
const STANDARD_INVENTORY_SKILLS = Object.freeze(V49_SKILL_IDS.filter((skillId) => STANDARD_SKILLS[skillId].standardUiEnabled));
const ALPHA_LOADOUT = Object.freeze({
  color: Object.freeze(["colorPrism"]),
  area: Object.freeze(["areaHalfShift"]),
  disrupt: Object.freeze(["disruptChoiceOne"]),
  experimental: Object.freeze(["legalRecolor"]),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function invalidSettlementSummary() {
  return deepFreeze({ status: "FAILED", code: "INVALID_SETTLEMENT_SUMMARY" });
}

function projectPublicSettlementSummary({ root, matchId, failureCode = null } = {}) {
  try {
    save.validateStandardSave(root);
    const activeMatch = root.activeMatch;
    if (!activeMatch || activeMatch.state.matchId !== matchId || activeMatch.state.status !== "FINISHED") return invalidSettlementSummary();
    const receipt = root.receipts.matchSettlement.byMatchId[matchId];
    if (!receipt) {
      if (failureCode) return deepFreeze({ status: "FAILED", code: failureCode === "PERSISTENCE_FAILED" ? failureCode : "SETTLEMENT_FAILED" });
      return deepFreeze({ status: "PENDING" });
    }
    if (!activeMatch.settlement?.settled || receipt.matchId !== matchId || receipt.winnerSeat !== activeMatch.state.winner || receipt.terminalReason !== activeMatch.state.terminalReason) return invalidSettlementSummary();
    const bySeat = {};
    const unlockedTrophies = [];
    for (const seat of ["A", "B"]) {
      const participant = activeMatch.participants[seat];
      const result = receipt.winnerSeat === seat ? "WIN" : "LOSS";
      if (participant.type === "CPU") {
        bySeat[seat] = { result };
        continue;
      }
      const profileResult = receipt.profileResults[participant.profileId];
      const stats = profileResult?.stats;
      const fields = ["wins", "losses", "currentWinStreak", "bestWinStreak"];
      if (profileResult?.result !== result || !stats || fields.some((field) => !Number.isSafeInteger(stats[field]) || stats[field] < 0)) return invalidSettlementSummary();
      bySeat[seat] = { result, ...Object.fromEntries(fields.map((field) => [field, stats[field]])) };
      const profile = root.profiles[participant.profileId];
      for (const trophyId of profileModel.TROPHY_IDS) {
        if (profileResult.trophies?.[trophyId] === true && profile?.trophyDates?.[trophyId] === receipt.settledAt) unlockedTrophies.push({ seat, trophyId });
      }
    }
    return deepFreeze({ status: "SETTLED", bySeat, unlockedTrophies });
  } catch {
    return invalidSettlementSummary();
  }
}

function loadRoot(storageAdapter) {
  const payload = storageAdapter.getItem(match.SAVE_KEY);
  return payload === null ? null : save.decodeStandardSave(payload);
}

function profileSetupProjection(root, profileId, skillIds = ALPHA_INVENTORY_SKILLS) {
  const profile = root.profiles[profileId];
  if (!profile) return null;
  const cards = Object.fromEntries(skillIds.map((skillId) => {
    const owned = profile.inventory[skillId] || 0;
    const reserved = root.reservations[profileId]?.[skillId] || 0;
    const definition = STANDARD_SKILLS[skillId];
    return [skillId, Object.freeze({
      skillId,
      category: definition.category,
      rarity: definition.rarity,
      ownedCount: owned,
      reservedCount: reserved,
      availableCount: owned - reserved,
      standardUiEnabled: Boolean(definition.standardUiEnabled),
      owned,
      reserved,
      available: owned - reserved,
    })];
  }));
  return Object.freeze({ profileId, displayName: profile.displayName, cards: Object.freeze(cards) });
}

function setupProjection(root, ruleSetId = matchStart.RULE_SET_IDS.ALPHA_SLICE) {
  if (!root) return Object.freeze({ stage: "SETUP", profiles: Object.freeze([]), canStart: false, code: "NO_LOCAL_SAVE" });
  const standard = ruleSetId === matchStart.RULE_SET_IDS.STANDARD;
  const skillIds = standard ? STANDARD_INVENTORY_SKILLS : ALPHA_INVENTORY_SKILLS;
  const profiles = Object.keys(root.profiles).sort().map((profileId) => profileSetupProjection(root, profileId, skillIds));
  const projection = {
    stage: "SETUP",
    ruleSetId,
    ruleLabel: standard ? "標準・熟考モード" : "標準α・機能検証用",
    profiles: Object.freeze(profiles),
  };
  if (!standard) projection.experimentalLoan = Object.freeze({ skillId: "legalRecolor", count: 1, inventoryBacked: false, reserved: 0 });
  return Object.freeze(projection);
}

function gachaProjection(root, profileId) {
  const profile = root?.profiles?.[profileId];
  if (!profile) return Object.freeze({ ok: false, code: "UNKNOWN_PROFILE" });
  return Object.freeze({
    ok: true,
    profileId,
    displayName: profile.displayName,
    tickets: Object.freeze(Object.fromEntries([1, 2, 3, 4, 5].map((level) => [level, profile.gachaTickets[String(level)] || 0]))),
  });
}

function cardSaleProjection(root, profileId) {
  const profile = root?.profiles?.[profileId];
  if (!profile) return Object.freeze({ ok: false, code: "UNKNOWN_PROFILE" });
  const items = STANDARD_INVENTORY_SKILLS.map((skillId) => {
    const definition = STANDARD_SKILLS[skillId];
    const ownedCount = profile.inventory[skillId] || 0;
    const reservedCount = root.reservations[profileId]?.[skillId] || 0;
    const protectedCard = profile.protectedSkills[skillId] === true;
    return Object.freeze({
      skillId,
      category: definition.category,
      rarity: definition.rarity,
      ownedCount,
      reservedCount,
      sellableCount: protectedCard ? 0 : Math.max(0, ownedCount - Math.max(1, reservedCount)),
      protected: protectedCard,
      valuePerCard: profileModel.coinValueForSkill(skillId),
    });
  });
  return deepFreeze({ ok: true, profileId, displayName: profile.displayName, coins: profile.coins, items });
}

function cosmeticProjection(root, profileId) {
  const profile = root?.profiles?.[profileId];
  if (!profile) return Object.freeze({ ok: false, code: "UNKNOWN_PROFILE" });
  const projected = cosmetics.projectCosmetics(profile);
  return deepFreeze({ ok: true, profileId, displayName: profile.displayName, trophies: clone(profile.trophies), trophyDates: clone(profile.trophyDates), stats: clone(profile.stats), ...projected });
}

function resultProjection(root) {
  const activeMatch = root?.activeMatch;
  if (!activeMatch?.settlement?.settled) return null;
  const receipt = root.receipts.matchSettlement.byMatchId[activeMatch.state.matchId];
  if (!receipt) return null;
  return Object.freeze({
    stage: "RESULT",
    matchId: activeMatch.state.matchId,
    winnerSeat: receipt.winnerSeat,
    terminalReason: receipt.terminalReason,
    mapCompleteWin: match.isMapCompleteWin(activeMatch.state),
    participants: Object.freeze(clone(activeMatch.participants)),
    settlementSummary: projectPublicSettlementSummary({ root, matchId: activeMatch.state.matchId }),
    settledAt: receipt.settledAt,
  });
}

function stageProjection(root, settlementFailureCode = null) {
  if (!root?.activeMatch) return setupProjection(root);
  if (root.activeMatch.settlement.settled) return resultProjection(root);
  const publicState = match.projectStandardPublicState(root.activeMatch.state);
  if (publicState.status === "FINISHED") return Object.freeze({
    stage: "SETTLEMENT_PENDING",
    publicState,
    participants: Object.freeze(clone(root.activeMatch.participants)),
    publicResult: Object.freeze({
      matchId: publicState.matchId,
      finalMatchVersion: publicState.version,
      winnerSeat: publicState.winner,
      terminalReason: publicState.terminalReason,
      mapCompleteWin: match.isMapCompleteWin(root.activeMatch.state),
    }),
    settlementSummary: projectPublicSettlementSummary({ root, matchId: publicState.matchId, failureCode: settlementFailureCode }),
  });
  return Object.freeze({ stage: "HANDOVER", seat: publicState.active, publicState });
}

function createStandardLocalSession({ storageAdapter, clock, idFactory }) {
  if (!storageAdapter || typeof storageAdapter.getItem !== "function" || typeof storageAdapter.setItem !== "function") throw new TypeError("STORAGE_ADAPTER_REQUIRED");
  if (!clock || typeof clock.now !== "function") throw new TypeError("CLOCK_REQUIRED");
  if (typeof idFactory !== "function") throw new TypeError("ID_FACTORY_REQUIRED");
  let root = loadRoot(storageAdapter);
  // Ephemeral only: a failed persistence attempt may be retried with the same
  // identity, but that identity must never survive a changed intent or reload.
  let pendingActionRetry = null;
  let settlementFailureCode = null;
  const loadoutQuotes = new Map();
  const usedLoadoutQuotes = new Map();

  function reload() {
    pendingActionRetry = null;
    settlementFailureCode = null;
    loadoutQuotes.clear();
    usedLoadoutQuotes.clear();
    root = loadRoot(storageAdapter);
    return stageProjection(root, settlementFailureCode);
  }

  function requestedLoadouts(ruleSetId, loadouts) {
    if (loadouts !== undefined && loadouts !== null) return clone(loadouts);
    return ruleSetId === matchStart.RULE_SET_IDS.ALPHA_SLICE ? { A: clone(ALPHA_LOADOUT), B: clone(ALPHA_LOADOUT) } : null;
  }

  function getInventoryProjection(actorId) {
    if (!root) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE" });
    return loadoutQuote.projectStandardInventory({ root, actorId });
  }

  function quoteLoadout({ actorId, seat, roomId, loadout, quoteId = idFactory("quote"), ttlMs = loadoutQuote.DEFAULT_QUOTE_TTL_MS }) {
    if (!root) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE" });
    if (loadoutQuotes.has(quoteId) || usedLoadoutQuotes.has(quoteId)) return Object.freeze({ ok: false, status: "REJECTED", code: "QUOTE_ID_REUSE" });
    const result = loadoutQuote.createStandardLoadoutQuote({
      root,
      expectedRootRevision: root.rootRevision,
      quoteId,
      actorId,
      seat,
      roomId,
      loadout,
      now: clock.now(),
      ttlMs,
    });
    if (result.ok) loadoutQuotes.set(quoteId, result.quote);
    return result;
  }

  function verifySeatQuotes({ profileAId, profileBId, matchId, operationId, quoteIds }) {
    if (!quoteIds || typeof quoteIds !== "object" || Array.isArray(quoteIds)) return Object.freeze({ ok: false, status: "REJECTED", code: "LOADOUT_QUOTES_REQUIRED" });
    const verified = {};
    const now = clock.now();
    for (const [seat, actorId] of [["A", profileAId], ["B", profileBId]]) {
      const quoteId = quoteIds[seat];
      const used = usedLoadoutQuotes.get(quoteId);
      if (used) {
        if (used.operationId !== operationId || used.matchId !== matchId) return Object.freeze({ ok: false, status: "REJECTED", code: "QUOTE_ALREADY_USED", used });
        verified[seat] = loadoutQuotes.get(quoteId);
        continue;
      }
      const result = loadoutQuote.verifyStandardLoadoutQuote({ root, quote: loadoutQuotes.get(quoteId), quoteId, actorId, seat, roomId: matchId, now });
      if (!result.ok) return result;
      verified[seat] = result.quote;
    }
    if (quoteIds.A === quoteIds.B) return Object.freeze({ ok: false, status: "REJECTED", code: "QUOTE_ID_REUSE" });
    return Object.freeze({ ok: true, status: "VERIFIED", code: "VERIFIED", quotes: Object.freeze(verified) });
  }

  function quoteStart({ profileAId, profileBId, matchId, operationId, firstSeat = null, ruleSetId = matchStart.RULE_SET_IDS.ALPHA_SLICE, loadouts = null }) {
    if (!root) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE", setup: setupProjection(root) });
    let quoteIds = null;
    let effectiveLoadouts = requestedLoadouts(ruleSetId, loadouts);
    if (ruleSetId === matchStart.RULE_SET_IDS.STANDARD) {
      if (profileAId === profileBId) return Object.freeze({ ok: false, status: "REJECTED", code: "DUPLICATE_OR_MISSING_PROFILE_PARTICIPANT", setup: setupProjection(root, ruleSetId) });
      const now = clock.now();
      const candidates = {};
      for (const [seat, actorId] of [["A", profileAId], ["B", profileBId]]) {
        const quoteId = idFactory("quote");
        const result = loadoutQuote.createStandardLoadoutQuote({ root, expectedRootRevision: root.rootRevision, quoteId, actorId, seat, roomId: matchId, loadout: effectiveLoadouts?.[seat], now });
        if (!result.ok) return Object.freeze({ ...result, setup: setupProjection(root, ruleSetId) });
        candidates[seat] = result.quote;
      }
      quoteIds = Object.freeze(Object.fromEntries(["A", "B"].map((seat) => [seat, candidates[seat].quoteId])));
      effectiveLoadouts = Object.fromEntries(["A", "B"].map((seat) => [seat, candidates[seat].normalizedLoadout]));
      const result = matchStart.quoteStandardMatchStart({
        root,
        expectedRootRevision: root.rootRevision,
        operationId,
        matchId,
        ruleSetId,
        participants: { A: { type: "PROFILE", profileId: profileAId }, B: { type: "PROFILE", profileId: profileBId } },
        loadouts: effectiveLoadouts,
        firstSeat,
      });
      if (!result.ok) return Object.freeze({ ok: result.ok, status: result.status, code: result.code, setup: setupProjection(root, ruleSetId) });
      for (const seat of ["A", "B"]) loadoutQuotes.set(candidates[seat].quoteId, candidates[seat]);
      return Object.freeze({ ok: true, status: "READY", code: "READY", quoteIds, quotes: Object.freeze(clone(candidates)), setup: setupProjection(root, ruleSetId) });
    }
    const result = matchStart.quoteStandardMatchStart({
      root,
      expectedRootRevision: root.rootRevision,
      operationId,
      matchId,
      ruleSetId,
      participants: {
        A: { type: "PROFILE", profileId: profileAId },
        B: { type: "PROFILE", profileId: profileBId },
      },
      loadouts: effectiveLoadouts,
      firstSeat,
    });
    return Object.freeze({ ok: result.ok, status: result.status, code: result.code, quoteIds, setup: setupProjection(root, ruleSetId) });
  }

  function startMatch({ profileAId, profileBId, firstSeat = null, ruleSetId = matchStart.RULE_SET_IDS.ALPHA_SLICE, loadouts = null, quoteIds = null, matchId = idFactory("match"), operationId = idFactory("start") }) {
    pendingActionRetry = null;
    settlementFailureCode = null;
    if (!root) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE", stage: "SETUP" });
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE", stage: "SETUP" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, status: "REJECTED", code: error.code || "PERSISTENCE_FAILED", matchId, operationId, projection: root.activeMatch ? stageProjection(root, settlementFailureCode) : setupProjection(root, ruleSetId) });
    }
    let effectiveLoadouts = requestedLoadouts(ruleSetId, loadouts);
    if (ruleSetId === matchStart.RULE_SET_IDS.STANDARD) {
      const verified = verifySeatQuotes({ profileAId, profileBId, matchId, operationId, quoteIds });
      if (!verified.ok) return Object.freeze({ ok: false, status: verified.status, code: verified.code, matchId, operationId, projection: root.activeMatch ? stageProjection(root, settlementFailureCode) : setupProjection(root, ruleSetId) });
      effectiveLoadouts = Object.fromEntries(["A", "B"].map((seat) => [seat, verified.quotes[seat].normalizedLoadout]));
    }
    const result = matchStart.startStandardMatch({
      root,
      expectedRootRevision: root.rootRevision,
      operationId,
      matchId,
      ruleSetId,
      participants: {
        A: { type: "PROFILE", profileId: profileAId },
        B: { type: "PROFILE", profileId: profileBId },
      },
      loadouts: effectiveLoadouts,
      quoteIds: ruleSetId === matchStart.RULE_SET_IDS.STANDARD ? quoteIds : null,
      firstSeat,
      clock,
      storageAdapter,
    });
    if (result.ok && result.root !== root) root = result.root;
    if (result.ok && ruleSetId === matchStart.RULE_SET_IDS.STANDARD) for (const seat of ["A", "B"]) {
      const quoteId = quoteIds[seat];
      usedLoadoutQuotes.set(quoteId, Object.freeze({ operationId, matchId }));
    }
    const projection = root.activeMatch ? stageProjection(root, settlementFailureCode) : setupProjection(root, ruleSetId);
    return Object.freeze({ ok: result.ok, status: result.status, code: result.code, matchId, operationId, projection });
  }

  function revealPrivate(seat) {
    if (!root?.activeMatch || root.activeMatch.state.status === "FINISHED") return Object.freeze({ ok: false, code: "PRIVATE_VIEW_UNAVAILABLE" });
    if (root.activeMatch.state.active !== seat) return Object.freeze({ ok: false, code: "NOT_ACTIVE_SEAT" });
    return Object.freeze({ ok: true, seat, privateState: match.projectStandardPrivateState(root.activeMatch.state, seat) });
  }

  function cancelPendingActionRetry() {
    const cancelled = pendingActionRetry !== null;
    pendingActionRetry = null;
    return cancelled;
  }

  function dispatchAction({ actorSeat, type, payload = {}, actionId = null }) {
    if (!root?.activeMatch) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_ACTIVE_MATCH", saved: false });
    const previousSeat = root.activeMatch.state.active;
    const matchId = root.activeMatch.state.matchId;
    const actionFingerprint = matchTransaction.fingerprint({ matchId, actorSeat, action: { type, payload } });
    const retryFingerprint = JSON.stringify({
      actionFingerprint,
      expectedRootRevision: root.rootRevision,
      expectedMatchVersion: root.activeMatch.state.version,
    });
    if (pendingActionRetry && pendingActionRetry.fingerprint !== retryFingerprint && actionId !== pendingActionRetry.actionId) pendingActionRetry = null;
    if (pendingActionRetry && actionId === pendingActionRetry.actionId && retryFingerprint !== pendingActionRetry.fingerprint) {
      return Object.freeze({
        ok: false,
        status: "REJECTED",
        code: "ACTION_ID_PAYLOAD_MISMATCH",
        actionId,
        saved: false,
        appliedNow: false,
        replayedReceipt: false,
        actionType: type,
        activeChanged: false,
        finished: root.activeMatch.state.status === "FINISHED",
        contactColorCount: null,
        projection: null,
      });
    }
    let resolvedActionId = actionId;
    if (!resolvedActionId) {
      if (pendingActionRetry?.fingerprint === retryFingerprint) resolvedActionId = pendingActionRetry.actionId;
      else {
        pendingActionRetry = null;
        resolvedActionId = idFactory("action");
      }
    } else if (pendingActionRetry && resolvedActionId !== pendingActionRetry.actionId) {
      pendingActionRetry = null;
    }
    const result = matchTransaction.dispatchStandardMatchAction({
      root,
      expectedRootRevision: root.rootRevision,
      expectedMatchVersion: root.activeMatch.state.version,
      matchId,
      actorSeat,
      action: { id: resolvedActionId, type, payload },
      storageAdapter,
    });
    if (result.code === "PERSISTENCE_FAILED") pendingActionRetry = { actionId: resolvedActionId, fingerprint: retryFingerprint };
    else if (pendingActionRetry?.actionId === resolvedActionId) pendingActionRetry = null;
    if (result.ok && result.root !== root) root = result.root;
    if (result.ok && root.activeMatch.state.status === "FINISHED") settlementFailureCode = null;
    const currentSeat = root.activeMatch.state.active;
    return Object.freeze({
      ok: result.ok,
      status: result.status,
      code: result.code,
      actionId: resolvedActionId,
      saved: result.saved,
      appliedNow: result.appliedNow === true,
      replayedReceipt: result.replayedReceipt === true,
      actionType: type,
      activeChanged: result.ok && previousSeat !== currentSeat,
      finished: root.activeMatch.state.status === "FINISHED",
      contactColorCount: result.ok && Number.isInteger(result.contactColorCount) ? result.contactColorCount : null,
      projection: result.ok ? stageProjection(root, settlementFailureCode) : null,
    });
  }

  function settle() {
    pendingActionRetry = null;
    if (!root?.activeMatch) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_ACTIVE_MATCH" });
    const matchId = root.activeMatch.state.matchId;
    const result = rootTransaction.settleCompletedMatch({
      root,
      expectedRootRevision: root.rootRevision,
      operationId: matchId,
      matchId,
      clock,
      storageAdapter,
    });
    if (result.ok && result.root !== root) root = result.root;
    settlementFailureCode = result.ok ? null : result.code;
    return Object.freeze({ ok: result.ok, status: result.status, code: result.code, projection: result.ok ? resultProjection(root) : stageProjection(root, settlementFailureCode) });
  }

  function settleQuizReward({ operationId, quizSessionId, profileId, result }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, status: "REJECTED", code: error.code || "PERSISTENCE_FAILED" });
    }
    const settled = quizTransaction.settleQuizReward({ root, expectedRootRevision: root.rootRevision, operationId, quizSessionId, profileId, result, clock, storageAdapter });
    if (settled.ok && settled.root !== root) root = settled.root;
    return Object.freeze({ ok: settled.ok, status: settled.status, code: settled.code, saved: settled.saved, receipt: settled.receipt, reward: settled.reward, setup: setupProjection(root, matchStart.RULE_SET_IDS.STANDARD) });
  }

  function drawGacha({ operationId, profileId, ticketLevel, count }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, status: "REJECTED", code: error.code || "PERSISTENCE_FAILED" });
    }
    const drawn = gachaTransaction.drawGacha({ root, expectedRootRevision: root.rootRevision, operationId, profileId, ticketLevel, count, clock, storageAdapter });
    if (drawn.ok && drawn.root !== root) root = drawn.root;
    return Object.freeze({ ok: drawn.ok, status: drawn.status, code: drawn.code, saved: drawn.saved, receipt: drawn.receipt, draws: drawn.draws, gacha: gachaProjection(root, profileId), setup: setupProjection(root, matchStart.RULE_SET_IDS.STANDARD) });
  }

  function quoteCardSale({ profileId, skillId, quantity }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, code: error.code || "PERSISTENCE_FAILED" });
    }
    return rootTransaction.quoteCardSale({ root, profileId, skillId, quantity });
  }

  function commitCardSale({ operationId, profileId, skillId, quantity, acceptedConfirmationReasons = [] }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, code: error.code || "PERSISTENCE_FAILED" });
    }
    const committed = rootTransaction.commitCardSale({ root, expectedRootRevision: root.rootRevision, operationId, profileId, skillId, quantity, acceptedConfirmationReasons, storage: storageAdapter });
    if (committed.ok && committed.root !== root) root = committed.root;
    return Object.freeze({ ok: committed.ok, code: committed.code, saved: committed.saved, receipt: committed.receipt, quote: committed.quote, sale: cardSaleProjection(root, profileId), setup: setupProjection(root, matchStart.RULE_SET_IDS.STANDARD) });
  }

  function quoteCosmeticAction({ profileId, cosmeticId }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, code: error.code || "PERSISTENCE_FAILED" });
    }
    return rootTransaction.quoteCosmeticAction({ root, profileId, cosmeticId });
  }

  function commitCosmeticAction({ operationId, profileId, cosmeticId }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, code: error.code || "PERSISTENCE_FAILED" });
    }
    const committed = rootTransaction.commitCosmeticAction({ root, expectedRootRevision: root.rootRevision, operationId, profileId, cosmeticId, storage: storageAdapter });
    if (committed.ok && committed.root !== root) root = committed.root;
    return Object.freeze({ ok: committed.ok, code: committed.code, saved: committed.saved, receipt: committed.receipt, quote: committed.quote, cosmetics: cosmeticProjection(root, profileId), setup: setupProjection(root, matchStart.RULE_SET_IDS.STANDARD) });
  }

  return Object.freeze({
    cancelPendingActionRetry,
    commitCardSale,
    commitCosmeticAction,
    dispatchAction,
    drawGacha,
    getCardSaleProjection: (profileId) => cardSaleProjection(root, profileId),
    getCosmeticProjection: (profileId) => cosmeticProjection(root, profileId),
    getGachaProjection: (profileId) => gachaProjection(root, profileId),
    getPublicProjection: () => root?.activeMatch ? match.projectStandardPublicState(root.activeMatch.state) : null,
    getPublicSettlementSummary: () => root?.activeMatch ? projectPublicSettlementSummary({ root, matchId: root.activeMatch.state.matchId, failureCode: settlementFailureCode }) : null,
    getResultProjection: () => resultProjection(root),
    getSetupProjection: (ruleSetId = matchStart.RULE_SET_IDS.ALPHA_SLICE) => setupProjection(root, ruleSetId),
    getStageProjection: () => stageProjection(root, settlementFailureCode),
    quoteStart,
    quoteLoadout,
    quoteCardSale,
    quoteCosmeticAction,
    reload,
    revealPrivate,
    settle,
    settleQuizReward,
    startMatch,
    getInventoryProjection,
  });
}

module.exports = { ALPHA_INVENTORY_SKILLS, ALPHA_LOADOUT, STANDARD_INVENTORY_SKILLS, cardSaleProjection, cosmeticProjection, createStandardLocalSession, gachaProjection, projectPublicSettlementSummary, resultProjection, setupProjection, stageProjection };

},
"standard/quiz-generator.js":function(require,module,exports){
"use strict";

let optionSerial = 1;

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function sample(random, values) {
  return values[randomInt(random, 0, values.length - 1)];
}

function shuffle(random, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInt(random, 0, index);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function roundTo(value, digits = 0) {
  const power = 10 ** digits;
  return Math.round((value + Number.EPSILON) * power) / power;
}

function formatNumber(value, digits = 4) {
  if (Number.isInteger(value)) return String(value);
  return String(roundTo(value, digits)).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

function factorial(value) {
  let result = 1;
  for (let current = 2; current <= value; current += 1) result *= current;
  return result;
}

function combination(n, r) {
  const count = Math.min(r, n - r);
  let result = 1;
  for (let index = 1; index <= count; index += 1) result = result * (n - count + index) / index;
  return Math.round(result);
}

function option(label, value, isCorrect = false) {
  return Object.freeze({ id: `standard-opt-${optionSerial++}`, label: String(label), value, isCorrect });
}

function makeRankedNumericOptions(answer, { digits = 0, formatter = null, count = 6, rankRandom, placementRandom }) {
  const correctRank = randomInt(rankRandom, 0, count - 1);
  const belowCount = correctRank;
  const aboveCount = count - 1 - correctRank;
  const integer = digits === 0;
  const unit = integer ? Math.max(1, Math.round(Math.max(1, Math.abs(answer)) * 0.045)) : 10 ** (-digits);
  const used = new Set([formatNumber(answer, Math.max(digits, 6))]);
  const build = (side, targetCount) => {
    const values = [];
    let guard = 0;
    while (values.length < targetCount && guard++ < 500) {
      const multiplier = randomInt(rankRandom, 1, Math.max(12, count * 4));
      const jitter = integer ? randomInt(rankRandom, 0, Math.max(1, Math.round(unit))) : randomInt(rankRandom, 0, 4) * unit;
      const value = roundTo(answer + side * (unit * multiplier + jitter), digits);
      const key = formatNumber(value, Math.max(digits, 6));
      if (!used.has(key)) {
        used.add(key);
        values.push(value);
      }
    }
    while (values.length < targetCount) {
      const value = roundTo(answer + side * unit * (values.length + 17), digits);
      const key = formatNumber(value, Math.max(digits, 6));
      if (!used.has(key)) {
        used.add(key);
        values.push(value);
      }
    }
    return values;
  };
  const below = build(-1, belowCount);
  const above = build(1, aboveCount);
  const render = formatter || ((value) => formatNumber(value, digits));
  const items = [
    ...below.map((value) => option(render(value), value)),
    option(render(answer), answer, true),
    ...above.map((value) => option(render(value), value)),
  ];
  return shuffle(placementRandom, items);
}

function numericQuestion(templateKey, type, prompt, answer, level, randoms, { bonusMs = 0, digits = 0, formatter = null } = {}) {
  const options = makeRankedNumericOptions(answer, { digits, formatter, rankRandom: randoms.rank, placementRandom: randoms.placement });
  return {
    templateKey,
    type,
    prompt,
    options,
    correctId: options.find((entry) => entry.isCorrect).id,
    timeMs: [0, 10000, 13000, 18000, 25000, 40000][level] + bonusMs,
    answerLabel: formatter ? formatter(answer) : formatNumber(answer, digits),
    answer,
    level,
  };
}

function mixedNumberEntry(level, random, usedValues, usedLabels) {
  const forms = level >= 3 ? ["fraction", "decimal", "percent", "root"] : ["fraction", "decimal", "percent"];
  for (let tries = 0; tries < 300; tries += 1) {
    const form = sample(random, forms);
    let label;
    let value;
    if (form === "fraction") {
      const denominator = randomInt(random, 2, level >= 4 ? 18 : 10);
      const numerator = randomInt(random, level >= 4 ? -denominator * 2 : 1, denominator * 3);
      const divisor = gcd(numerator, denominator);
      label = `${numerator / divisor}/${denominator / divisor}`;
      value = numerator / denominator;
    } else if (form === "decimal") {
      const digits = level >= 3 ? randomInt(random, 1, 3) : randomInt(random, 1, 2);
      const scale = 10 ** digits;
      value = randomInt(random, level >= 4 ? -150 : 5, level >= 4 ? 350 : 160) / scale;
      label = value.toFixed(digits);
    } else if (form === "percent") {
      const percent = randomInt(random, level >= 4 ? -80 : 5, level >= 4 ? 250 : 160);
      value = percent / 100;
      label = `${percent}%`;
    } else {
      const root = randomInt(random, 2, level >= 5 ? 180 : 80);
      const scale = sample(random, [1, 10]);
      value = Math.sqrt(root) / scale;
      label = `√${root}${scale === 10 ? "/10" : ""}`;
    }
    const valueKey = roundTo(value, 7).toString();
    if (!usedValues.has(valueKey) && !usedLabels.has(label)) {
      usedValues.add(valueKey);
      usedLabels.add(label);
      return { label, value };
    }
  }
  throw new Error("COMPARISON_OPTION_EXHAUSTED");
}

function comparisonQuestion(level, _askMax, randoms) {
  const usedValues = new Set();
  const usedLabels = new Set();
  const entries = [];
  while (entries.length < 6) entries.push(mixedNumberEntry(level, randoms.content, usedValues, usedLabels));
  const targetRank = randomInt(randoms.rank, 0, entries.length - 1);
  const chosen = [...entries].sort((left, right) => left.value - right.value)[targetRank];
  const options = shuffle(randoms.placement, entries.map((entry) => option(entry.label, entry.value, entry === chosen)));
  const target = targetRank === 0 ? "一番小さい" : targetRank === entries.length - 1 ? "一番大きい" : `小さい方から${targetRank + 1}番目の`;
  return { templateKey: "compare", type: "大小比較", prompt: `次のうち${target}数を選べ！`, options, correctId: options.find((entry) => entry.isCorrect).id, timeMs: [0, 13000, 17000, 22000, 32000, 47000][level], answerLabel: chosen.label, answer: chosen.value, level };
}

function generatorsFor(randoms) {
  const r = randoms.content;
  const n = (key, type, prompt, answer, level, extra) => numericQuestion(key, type, prompt, answer, level, randoms, extra);
  return {
    1: [
      ["add", () => { const a = randomInt(r, 5, 75); const b = randomInt(r, 3, 45); return n("add", "加算", `${a} + ${b} = ?`, a + b, 1); }],
      ["subtract", () => { const a = randomInt(r, 25, 110); const b = randomInt(r, 2, a - 1); return n("subtract", "減算", `${a} − ${b} = ?`, a - b, 1); }],
      ["multiply", () => { const a = randomInt(r, 2, 12); const b = randomInt(r, 2, 12); return n("multiply", "乗算", `${a} × ${b} = ?`, a * b, 1); }],
      ["divide", () => { const b = randomInt(r, 2, 12); const answer = randomInt(r, 2, 14); return n("divide", "除算", `${b * answer} ÷ ${b} = ?`, answer, 1); }],
      ["missing", () => { const answer = randomInt(r, 2, 30); const b = randomInt(r, 2, 30); return n("missing", "穴埋め", `□ + ${b} = ${answer + b}　□ = ?`, answer, 1, { bonusMs: 1000 }); }],
      ["compare", () => comparisonQuestion(1, true, randoms)],
    ],
    2: [
      ["linear", () => { const x = randomInt(r, -9, 18); const a = randomInt(r, 2, 8); const b = randomInt(r, -12, 12); return n("linear", "一次方程式", `${a}x ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`} = ${a * x + b}　x = ?`, x, 2, { bonusMs: 3000 }); }],
      ["percent", () => { const base = randomInt(r, 4, 40) * 10; const percent = sample(r, [5, 10, 15, 20, 25, 30, 40, 50, 60, 75]); const answer = base * percent / 100; return n("percent", "割合", `${base} の ${percent}% は？`, answer, 2, { bonusMs: 2000, digits: Number.isInteger(answer) ? 0 : 1 }); }],
      ["order", () => { const a = randomInt(r, 2, 15); const b = randomInt(r, 2, 12); const c = randomInt(r, 2, 9); return n("order", "計算順序", `${a} + ${b} × ${c} = ?`, a + b * c, 2, { bonusMs: 1000 }); }],
      ["unit", () => { const kg = randomInt(r, 1, 25) / 10; return n("unit", "単位換算", `${kg.toFixed(1)} kg = ? g`, Math.round(kg * 1000), 2, { bonusMs: 2000 }); }],
      ["average", () => { const values = Array.from({ length: 4 }, () => randomInt(r, 5, 30)); values[3] += (4 - values.reduce((a, b) => a + b, 0) % 4) % 4; return n("average", "平均", `平均を求めよ：${values.join("、")}`, values.reduce((a, b) => a + b, 0) / 4, 2, { bonusMs: 3000 }); }],
      ["compare", () => comparisonQuestion(2, r() < 0.8, randoms)],
    ],
    3: [
      ["power", () => { const a = randomInt(r, 2, 7); const power = randomInt(r, 2, 5); return n("power", "累乗", `${a}^${power} = ?`, a ** power, 3, { bonusMs: 2000 }); }],
      ["root", () => { const root = randomInt(r, 2, 24); return n("root", "平方根", `√${root * root} = ?`, root, 3, { bonusMs: 2000 }); }],
      ["factorial", () => { const value = randomInt(r, 3, 7); return n("factorial", "階乗", `${value}! = ?`, factorial(value), 3, { bonusMs: 5000 }); }],
      ["sigma", () => { const end = randomInt(r, 4, 9); return n("sigma", "Σ", `Σ(k=1→${end}) k = ?`, end * (end + 1) / 2, 3, { bonusMs: 6000 }); }],
      ["expression", () => { const x = randomInt(r, 2, 12); const a = randomInt(r, 2, 6); const b = randomInt(r, 1, 10); const c = randomInt(r, 1, 8); return n("expression", "展開不要の式", `${a}(${x} + ${b}) − ${c} = ?`, a * (x + b) - c, 3, { bonusMs: 3000 }); }],
      ["compare", () => comparisonQuestion(3, true, randoms)],
    ],
    4: [
      ["quadratic", () => { const small = randomInt(r, 1, 9); const large = randomInt(r, small + 1, 13); return n("quadratic", "二次方程式", `x² − ${small + large}x + ${small * large} = 0\n小さい解 x = ?`, small, 4, { bonusMs: 5000 }); }],
      ["combination", () => { const total = randomInt(r, 6, 11); const selected = randomInt(r, 2, Math.min(4, total - 2)); return n("combination", "組合せ", `${total}C${selected} = ?`, combination(total, selected), 4, { bonusMs: 6000 }); }],
      ["sequence", () => { const first = randomInt(r, 1, 12); const difference = randomInt(r, 2, 8); const index = randomInt(r, 6, 12); return n("sequence", "等差数列", `初項 ${first}、公差 ${difference} の等差数列\n第${index}項は？`, first + (index - 1) * difference, 4, { bonusMs: 6000 }); }],
      ["matrixAdd", () => { const A = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => randomInt(r, -5, 8))); const B = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => randomInt(r, -5, 8))); const row = randomInt(r, 0, 1); const column = randomInt(r, 0, 1); return n("matrixAdd", "行列加算", `A=[[${A[0].join(", ")}], [${A[1].join(", ")}]]\nB=[[${B[0].join(", ")}], [${B[1].join(", ")}]]\nA+B の ${row + 1}行${column + 1}列成分は？`, A[row][column] + B[row][column], 4, { bonusMs: 8000 }); }],
      ["determinant", () => { const a = randomInt(r, -6, 8); const b = randomInt(r, -6, 8); const c = randomInt(r, -6, 8); const d = randomInt(r, -6, 8); return n("determinant", "行列式", `det [[${a}, ${b}], [${c}, ${d}]] = ?`, a * d - b * c, 4, { bonusMs: 7000 }); }],
      ["sigma", () => { const end = randomInt(r, 4, 8); const a = randomInt(r, 2, 5); const b = randomInt(r, -3, 6); return n("sigma", "Σ", `Σ(k=1→${end}) (${a}k ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`}) = ?`, a * end * (end + 1) / 2 + b * end, 4, { bonusMs: 8000 }); }],
    ],
    5: [
      ["matrixMultiply", () => { const A = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => randomInt(r, -4, 6))); const B = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => randomInt(r, -4, 6))); const row = randomInt(r, 0, 1); const column = randomInt(r, 0, 1); return n("matrixMultiply", "行列積", `A=[[${A[0].join(", ")}], [${A[1].join(", ")}]]\nB=[[${B[0].join(", ")}], [${B[1].join(", ")}]]\nAB の ${row + 1}行${column + 1}列成分は？`, A[row][0] * B[0][column] + A[row][1] * B[1][column], 5, { bonusMs: 10000 }); }],
      ["sigmaSquare", () => { const end = randomInt(r, 4, 8); const a = randomInt(r, 1, 4); const b = randomInt(r, -4, 7); return n("sigmaSquare", "複合Σ", `Σ(k=1→${end}) (${a}k² ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`}) = ?`, a * end * (end + 1) * (2 * end + 1) / 6 + b * end, 5, { bonusMs: 10000 }); }],
      ["factorialRatio", () => { const total = randomInt(r, 6, 10); const count = randomInt(r, 2, 4); return n("factorialRatio", "階乗比", `${total}! / ${total - count}! = ?`, factorial(total) / factorial(total - count), 5, { bonusMs: 7000 }); }],
      ["system", () => { const x = randomInt(r, -6, 9); const y = randomInt(r, -6, 9); const a = randomInt(r, 2, 5); const b = randomInt(r, 1, 4); const c = randomInt(r, 1, 4); const d = randomInt(r, 2, 5); return n("system", "連立方程式", `${a}x + ${b}y = ${a * x + b * y}\n${c}x − ${d}y = ${c * x - d * y}\nx = ?`, x, 5, { bonusMs: 9000 }); }],
      ["determinantProduct", () => { const values = Array.from({ length: 8 }, () => randomInt(r, -5, 7)); const [a, b, c, d, e, f, g, h] = values; return n("determinantProduct", "行列式の積", `A=[[${a}, ${b}], [${c}, ${d}]]\nB=[[${e}, ${f}], [${g}, ${h}]]\ndet(AB) = ?`, (a * d - b * c) * (e * h - f * g), 5, { bonusMs: 10000 }); }],
      ["compare", () => comparisonQuestion(5, true, randoms)],
    ],
  };
}

function generateQuestion(level, randoms, previousTemplateKeys = []) {
  const catalog = generatorsFor(randoms)[level];
  const blocked = previousTemplateKeys.length >= 2 && previousTemplateKeys.at(-1) === previousTemplateKeys.at(-2) ? previousTemplateKeys.at(-1) : null;
  const candidates = blocked ? catalog.filter(([key]) => key !== blocked) : catalog;
  const [templateKey, generate] = sample(randoms.content, candidates);
  const question = generate();
  if (question.templateKey !== templateKey) throw new Error("TEMPLATE_KEY_MISMATCH");
  return Object.freeze({ ...question, options: Object.freeze(question.options) });
}

module.exports = { generateQuestion, makeRankedNumericOptions, randomInt, shuffle };

},
"standard/hint-policy.js":function(require,module,exports){
"use strict";

const HINT_MS = Object.freeze({ instant: 3000, normal: 3000, hard: 5000, spike: 5000 });

const HINTS = Object.freeze({
  add: "位をそろえ、同じ位どうしを足します。",
  subtract: "位をそろえ、必要なら上の位から借ります。",
  multiply: "片方を分けて分配法則で考えると確認しやすくなります。",
  divide: "割る数を掛けて元の数になる候補を探します。",
  missing: "等式の両辺へ同じ操作をして空欄だけを残します。",
  compare: "同じ尺度へ直してから順序を比べます。",
  linear: "定数項を移し、最後に係数で割ります。",
  percent: "百分率を割合へ直して元の量へ掛けます。",
  order: "括弧、掛け算・割り算、足し算・引き算の順です。",
  unit: "単位間の倍率を確認して小数点を移します。",
  average: "合計を個数で割ります。",
  power: "底を指数の回数だけ掛け合わせます。",
  root: "自分自身を掛けると根号内になる数を探します。",
  factorial: "自然数をひとつずつ下げながら掛け合わせます。",
  sigma: "規則を確認し、各項の合計として整理します。",
  expression: "括弧の中を先に処理します。",
  quadratic: "積と和が係数に合う組を探します。",
  combination: "順序を区別しない選び方として整理します。",
  sequence: "初項へ、公差を必要回数だけ加えます。",
  matrixAdd: "同じ行・同じ列の成分どうしを足します。",
  determinant: "主対角の積から逆対角の積を引きます。",
  matrixMultiply: "指定行と指定列の対応成分を掛けて足します。",
  sigmaSquare: "二乗和と定数項の和へ分けて整理します。",
  factorialRatio: "分子と分母で共通する階乗部分を消します。",
  system: "片方の文字を消去できるよう式をそろえます。",
  determinantProduct: "積の行列式は、それぞれの行列式の積として考えられます。",
});

function hintDurationMs(band) {
  if (!Object.hasOwn(HINT_MS, band)) throw new RangeError("UNKNOWN_DIFFICULTY_BAND");
  return HINT_MS[band];
}

function hintFor({ templateId, difficulty }) {
  const text = HINTS[templateId];
  if (!text) throw new RangeError("UNKNOWN_HINT_TEMPLATE");
  return Object.freeze({ text, durationMs: hintDurationMs(difficulty) });
}

module.exports = { HINTS, HINT_MS, hintDurationMs, hintFor };

},
"standard/reward-policy.js":function(require,module,exports){
"use strict";

function rewardFor({ correct, wrong, bestStreak, selectedLevel }) {
  let draws = 1;
  let ticketLevel = selectedLevel;
  let reason = "参加報酬";
  if (correct === 10) {
    draws = 10;
    reason = "全問正解";
  } else if (bestStreak >= 5) {
    draws = 5;
    reason = "五問以上の連続正解";
  } else if (correct >= 7) {
    draws = 3;
    reason = "累計七問以上正解";
  } else if (wrong >= 3) {
    ticketLevel = Math.max(1, selectedLevel - 1);
    reason = "三回目のミスによる救済";
  }
  return Object.freeze({ draws, ticketLevel, reason });
}

module.exports = { rewardFor };

},
"standard/quiz-session.js":function(require,module,exports){
"use strict";

const { generateQuestion, shuffle } = require("./quiz-generator.js");
const { hintFor } = require("./hint-policy.js");
const { rewardFor } = require("./reward-policy.js");

const BAND_COUNTS = Object.freeze({ instant: 2, normal: 5, hard: 2, spike: 1 });

function scheduleIsValid(schedule) {
  if (schedule.length !== 10) return false;
  if (!new Set(["instant", "normal"]).has(schedule[0])) return false;
  if (!schedule.slice(0, 2).includes("instant")) return false;
  if (schedule.indexOf("spike") < 5) return false;
  for (let index = 0; index <= schedule.length - 3; index += 1) {
    if (schedule.slice(index, index + 3).every((band) => band === "hard" || band === "spike")) return false;
  }
  return Object.entries(BAND_COUNTS).every(([band, count]) => schedule.filter((value) => value === band).length === count);
}

function createDifficultySchedule(random) {
  const source = Object.entries(BAND_COUNTS).flatMap(([band, count]) => Array(count).fill(band));
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const schedule = shuffle(random, source);
    if (scheduleIsValid(schedule)) return Object.freeze(schedule);
  }
  throw new Error("DIFFICULTY_SCHEDULE_EXHAUSTED");
}

function createQuizQuestions({ structureRandom, contentRandom, rankRandom, placementRandom }) {
  const schedule = createDifficultySchedule(structureRandom || contentRandom);
  const randoms = { content: contentRandom, rank: rankRandom, placement: placementRandom };
  const questions = [];
  for (const band of schedule) {
    let level;
    let extreme = false;
    if (band === "instant") level = 1;
    else if (band === "normal") level = contentRandom() < 0.5 ? 2 : 3;
    else if (band === "hard") level = 4;
    else {
      extreme = contentRandom() < 0.15;
      level = extreme ? 5 : 4;
    }
    const previous = questions.map((question) => `${question.level}:${question.templateKey}`);
    const generated = generateQuestion(level, randoms, previous.slice(-2).map((key) => key.split(":")[1]));
    questions.push(Object.freeze({ ...generated, band, extreme }));
  }
  return Object.freeze(questions);
}

class QuizSession {
  constructor({ questions, selectedLevel = 1 }) {
    if (!Array.isArray(questions) || questions.length !== 10) throw new TypeError("TEN_QUESTIONS_REQUIRED");
    this.questions = questions;
    this.selectedLevel = selectedLevel;
    this.index = 0;
    this.correct = 0;
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.running = false;
    this.resolved = false;
    this.hintUsed = false;
    this.hintActive = false;
    this.answerStartedAt = 0;
    this.answerRemainingMs = 0;
    this.hintEndsAt = 0;
  }

  get question() {
    return this.questions[this.index];
  }

  begin(now = 0) {
    if (this.running) throw new Error("SESSION_ALREADY_RUNNING");
    this.running = true;
    this.#startQuestion(now);
    return this.snapshot(now);
  }

  #startQuestion(now) {
    this.resolved = false;
    this.hintUsed = false;
    this.hintActive = false;
    this.answerRemainingMs = this.question.timeMs;
    this.answerStartedAt = now;
    this.hintEndsAt = 0;
  }

  timeRemainingMs(now) {
    if (!this.running || this.resolved || this.hintActive) return Math.max(0, this.answerRemainingMs);
    return Math.max(0, this.answerRemainingMs - (now - this.answerStartedAt));
  }

  openHint(now) {
    if (!this.running || this.resolved) return Object.freeze({ ok: false, code: "QUESTION_NOT_ACTIVE" });
    if (this.hintUsed) return Object.freeze({ ok: false, code: "HINT_ALREADY_USED" });
    this.answerRemainingMs = this.timeRemainingMs(now);
    if (this.answerRemainingMs <= 0) return this.timeout(now);
    const hint = hintFor({ templateId: this.question.templateKey, difficulty: this.question.band });
    this.hintUsed = true;
    this.hintActive = true;
    this.hintEndsAt = now + hint.durationMs;
    return Object.freeze({ ok: true, ...hint, endsAt: this.hintEndsAt });
  }

  closeHint(now) {
    if (!this.hintActive) return Object.freeze({ ok: false, code: "HINT_NOT_ACTIVE" });
    const resumeAt = Math.min(now, this.hintEndsAt);
    this.hintActive = false;
    this.answerStartedAt = resumeAt;
    this.hintEndsAt = 0;
    return Object.freeze({ ok: true, remainingMs: this.timeRemainingMs(now) });
  }

  tick(now) {
    if (this.hintActive && now >= this.hintEndsAt) this.closeHint(now);
    if (this.running && !this.resolved && this.timeRemainingMs(now) <= 0) return this.timeout(now);
    return this.snapshot(now);
  }

  answer(optionId, now) {
    if (this.hintActive) return Object.freeze({ ok: false, code: "HINT_ACTIVE" });
    if (!this.running || this.resolved) return Object.freeze({ ok: false, code: "QUESTION_NOT_ACTIVE" });
    if (this.timeRemainingMs(now) <= 0) return this.timeout(now);
    return this.#resolve(optionId === this.question.correctId, false, now);
  }

  timeout(now) {
    if (!this.running || this.resolved) return Object.freeze({ ok: false, code: "QUESTION_NOT_ACTIVE" });
    if (this.hintActive) this.closeHint(now);
    return this.#resolve(false, true, now);
  }

  #resolve(correct, timedOut, now) {
    this.answerRemainingMs = this.timeRemainingMs(now);
    this.resolved = true;
    if (correct) {
      this.correct += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.wrong += 1;
      this.streak = 0;
    }
    return Object.freeze({ ok: true, correct, timedOut, answerLabel: this.question.answerLabel });
  }

  advance(now) {
    if (!this.running || !this.resolved) return Object.freeze({ ok: false, code: "QUESTION_NOT_RESOLVED" });
    if (this.wrong >= 3 || this.index === this.questions.length - 1) {
      this.running = false;
      return Object.freeze({ ok: true, finished: true, reward: rewardFor({ correct: this.correct, wrong: this.wrong, bestStreak: this.bestStreak, selectedLevel: this.selectedLevel }) });
    }
    this.index += 1;
    this.#startQuestion(now);
    return Object.freeze({ ok: true, finished: false, question: this.question });
  }

  snapshot(now) {
    return Object.freeze({ index: this.index, running: this.running, resolved: this.resolved, hintUsed: this.hintUsed, hintActive: this.hintActive, remainingMs: this.timeRemainingMs(now), correct: this.correct, wrong: this.wrong, streak: this.streak, bestStreak: this.bestStreak });
  }
}

module.exports = { BAND_COUNTS, QuizSession, createDifficultySchedule, createQuizQuestions, scheduleIsValid };

},
"standard/standard-quiz-controller.js":function(require,module,exports){
"use strict";

const { QuizSession } = require("./quiz-session.js");

function publicQuestion(question) {
  if (!question) return null;
  return Object.freeze({
    type: question.type,
    prompt: question.prompt,
    timeMs: question.timeMs,
    band: question.band,
    options: Object.freeze(question.options.map(({ id, label }) => Object.freeze({ id, label }))),
  });
}

function createStandardQuizController({ questions, selectedLevel }) {
  const session = new QuizSession({ questions, selectedLevel });
  let resolution = null;
  let reward = null;

  function projection(now) {
    const snapshot = session.snapshot(now);
    return Object.freeze({
      stage: reward ? "RESULT" : snapshot.running ? "QUESTION" : "IDLE",
      selectedLevel,
      questionNumber: snapshot.index + 1,
      questionCount: questions.length,
      correct: snapshot.correct,
      wrong: snapshot.wrong,
      streak: snapshot.streak,
      bestStreak: snapshot.bestStreak,
      resolved: snapshot.resolved,
      hintUsed: snapshot.hintUsed,
      hintActive: snapshot.hintActive,
      remainingMs: snapshot.remainingMs,
      question: reward ? null : publicQuestion(session.question),
      resolution,
      reward,
    });
  }

  function begin(now) {
    session.begin(now);
    return Object.freeze({ ok: true, code: "STARTED", projection: projection(now) });
  }

  function openHint(now) {
    const result = session.openHint(now);
    return Object.freeze({ ...result, projection: projection(now) });
  }

  function answer(optionId, now) {
    const result = session.answer(optionId, now);
    if (result.ok) resolution = Object.freeze({ correct: result.correct, timedOut: result.timedOut, answerLabel: result.answerLabel });
    return Object.freeze({ ...result, projection: projection(now) });
  }

  function tick(now) {
    const result = session.tick(now);
    if (result?.ok && Object.hasOwn(result, "correct")) resolution = Object.freeze({ correct: result.correct, timedOut: result.timedOut, answerLabel: result.answerLabel });
    return Object.freeze({ ok: true, code: resolution && session.resolved ? "RESOLVED" : "TICK", projection: projection(now) });
  }

  function advance(now) {
    const result = session.advance(now);
    if (!result.ok) return Object.freeze({ ...result, projection: projection(now) });
    resolution = null;
    if (result.finished) reward = result.reward;
    return Object.freeze({ ...result, projection: projection(now) });
  }

  function settlementFacts() {
    if (!reward) return Object.freeze({ ok: false, code: "QUIZ_NOT_FINISHED" });
    const snapshot = session.snapshot(0);
    return Object.freeze({ ok: true, correct: snapshot.correct, wrong: snapshot.wrong, bestStreak: snapshot.bestStreak, selectedLevel });
  }

  return Object.freeze({ advance, answer, begin, openHint, projection, settlementFacts, tick });
}

module.exports = { createStandardQuizController, publicQuestion };

},
"standard/standard-quiz-transaction.js":function(require,module,exports){
"use strict";

const save = require("./standard-save.js");
const { rewardFor } = require("./reward-policy.js");
const { stableHash } = require("./standard-root-transaction.js");

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const QUIZ_RECEIPT_LIMIT = 256;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rejected(code, root, extra = {}) {
  return Object.freeze({ ok: false, status: "REJECTED", code, root, saved: false, ...extra });
}

function normalizeResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw Object.assign(new Error("INVALID_QUIZ_RESULT"), { code: "INVALID_QUIZ_RESULT" });
  const { correct, wrong, bestStreak, selectedLevel } = result;
  if (![correct, wrong, bestStreak, selectedLevel].every(Number.isSafeInteger)
    || correct < 0 || correct > 10 || wrong < 0 || wrong > 3 || bestStreak < 0 || bestStreak > correct
    || selectedLevel < 1 || selectedLevel > 5 || correct + wrong > 10
    || (wrong !== 3 && correct + wrong !== 10)) throw Object.assign(new Error("INVALID_QUIZ_RESULT"), { code: "INVALID_QUIZ_RESULT" });
  return Object.freeze({ correct, wrong, bestStreak, selectedLevel });
}

function pruneReceipts(receipts) {
  const entries = Object.entries(receipts);
  if (entries.length <= QUIZ_RECEIPT_LIMIT) return;
  entries.sort((left, right) => left[1].rootRevision - right[1].rootRevision || left[0].localeCompare(right[0]));
  for (const [key] of entries.slice(0, entries.length - QUIZ_RECEIPT_LIMIT)) delete receipts[key];
}

function settleQuizReward({ root, expectedRootRevision, operationId, quizSessionId, profileId, result, clock, storageAdapter }) {
  try { save.validateStandardSave(root); } catch (error) { return rejected(error.code || "INVALID_SAVE", root); }
  if (![operationId, quizSessionId, profileId].every((value) => typeof value === "string" && ID_PATTERN.test(value))) return rejected("INVALID_OPERATION_ID", root);
  if (!root.profiles[profileId]) return rejected("UNKNOWN_PROFILE", root);
  let facts;
  try { facts = normalizeResult(result); } catch (error) { return rejected(error.code || "INVALID_QUIZ_RESULT", root); }
  const reward = rewardFor(facts);
  const resultFingerprint = stableHash({ profileId, quizSessionId, facts, reward });
  const existing = root.receipts.quizSettlement[quizSessionId];
  if (existing) {
    if (existing.resultFingerprint !== resultFingerprint || existing.operationId !== operationId) return rejected("QUIZ_SETTLEMENT_CONFLICT", root);
    return Object.freeze({ ok: true, status: "ALREADY_SETTLED", code: "ALREADY_SETTLED", root, receipt: Object.freeze(clone(existing)), reward: Object.freeze(clone(reward)), saved: false });
  }
  if (Object.values(root.receipts.quizSettlement).some((receipt) => receipt.operationId === operationId)) return rejected("IDEMPOTENCY_KEY_REUSE", root);
  if (root.rootRevision !== expectedRootRevision) return rejected("STALE_ROOT_REVISION", root);
  let completedAt;
  try {
    completedAt = clock.now();
    if (typeof completedAt !== "string" || !Number.isFinite(Date.parse(completedAt))) throw Object.assign(new Error("INVALID_CLOCK"), { code: "INVALID_CLOCK" });
  } catch (error) {
    return rejected(error.code || "INVALID_CLOCK", root);
  }

  const next = clone(root);
  const profile = next.profiles[profileId];
  const ticketKey = String(reward.ticketLevel);
  const currentTickets = profile.gachaTickets[ticketKey] || 0;
  if (!Number.isSafeInteger(currentTickets + reward.draws)) return rejected("TICKET_COUNT_OVERFLOW", root);
  profile.gachaTickets[ticketKey] = currentTickets + reward.draws;
  const recordKey = String(facts.selectedLevel);
  const previous = profile.quizRecords[recordKey] || { attempts: 0, bestCorrect: 0, bestStreak: 0, lastCorrect: 0, lastWrong: 0, lastCompletedAt: completedAt };
  profile.quizRecords[recordKey] = {
    attempts: previous.attempts + 1,
    bestCorrect: Math.max(previous.bestCorrect, facts.correct),
    bestStreak: Math.max(previous.bestStreak, facts.bestStreak),
    lastCorrect: facts.correct,
    lastWrong: facts.wrong,
    lastCompletedAt: completedAt,
  };
  next.rootRevision += 1;
  const receipt = {
    scope: "quizSettlement",
    operationId,
    quizSessionId,
    profileId,
    resultFingerprint,
    ...facts,
    ticketLevel: reward.ticketLevel,
    ticketCount: reward.draws,
    reason: reward.reason,
    completedAt,
    rootRevision: next.rootRevision,
  };
  next.receipts.quizSettlement[quizSessionId] = receipt;
  pruneReceipts(next.receipts.quizSettlement);
  try {
    save.validateStandardSave(next);
    save.persistStandardSave(storageAdapter, next);
  } catch (error) {
    return rejected(error instanceof save.StandardSaveError ? error.code : "PERSISTENCE_FAILED", root);
  }
  return Object.freeze({ ok: true, status: "SETTLED", code: "SETTLED", root: Object.freeze(next), receipt: Object.freeze(clone(receipt)), reward: Object.freeze(clone(reward)), saved: true });
}

module.exports = { QUIZ_RECEIPT_LIMIT, normalizeResult, settleQuizReward };

},
"standard/standard-gacha-transaction.js":function(require,module,exports){
"use strict";

const engine = require("./standard-engine.js");
const match = require("./standard-match.js");
const save = require("./standard-save.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("./standard-skill-registry.js");
const { stableHash } = require("./standard-root-transaction.js");

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const GACHA_DRAW_LIMIT = 100;
const CATEGORIES = Object.freeze(["color", "area", "disrupt"]);
const GACHA_ODDS = Object.freeze({
  1: Object.freeze({ 1: 55, 2: 30, 3: 12, 4: 2.8, 5: 0.2 }),
  2: Object.freeze({ 1: 40, 2: 35, 3: 19, 4: 5.5, 5: 0.5 }),
  3: Object.freeze({ 1: 25, 2: 35, 3: 28, 4: 10, 5: 2 }),
  4: Object.freeze({ 1: 10, 2: 25, 3: 35, 4: 24, 5: 6 }),
  5: Object.freeze({ 1: 2, 2: 8, 3: 30, 4: 40, 5: 20 }),
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function rejected(code, root, extra = {}) { return Object.freeze({ ok: false, status: "REJECTED", code, root, saved: false, ...extra }); }

function pool(category, rarity) {
  return V49_SKILL_IDS.filter((skillId) => {
    const skill = STANDARD_SKILLS[skillId];
    return skill.gachaEnabled && !skill.experimental && skill.category === category && skill.rarity === rarity;
  });
}

function rarityFrom(randomValue, ticketLevel) {
  const odds = GACHA_ODDS[ticketLevel];
  if (!odds || typeof randomValue !== "number" || randomValue < 0 || randomValue >= 1) throw Object.assign(new Error("INVALID_GACHA_INPUT"), { code: "INVALID_GACHA_INPUT" });
  let cumulative = 0;
  for (let rarity = 1; rarity <= 5; rarity += 1) {
    cumulative += odds[rarity] / 100;
    if (randomValue < cumulative || rarity === 5) return rarity;
  }
  return 5;
}

function drawOne(stream, ticketLevel) {
  const rarity = rarityFrom(stream.next(), ticketLevel);
  const category = CATEGORIES[Math.floor(stream.next() * CATEGORIES.length)];
  const candidates = pool(category, rarity);
  if (!candidates.length) throw Object.assign(new Error("EMPTY_GACHA_POOL"), { code: "EMPTY_GACHA_POOL" });
  const skillId = candidates[Math.floor(stream.next() * candidates.length)];
  return Object.freeze({ ticketLevel, rarity, category, skillId });
}

function drawGacha({ root, expectedRootRevision, operationId, profileId, ticketLevel, count, clock, storageAdapter }) {
  try { save.validateStandardSave(root); } catch (error) { return rejected(error.code || "INVALID_SAVE", root); }
  if (![operationId, profileId].every((value) => typeof value === "string" && ID_PATTERN.test(value))) return rejected("INVALID_OPERATION_ID", root);
  if (!root.profiles[profileId]) return rejected("UNKNOWN_PROFILE", root);
  if (!Number.isSafeInteger(ticketLevel) || ticketLevel < 1 || ticketLevel > 5 || !Number.isSafeInteger(count) || count < 1 || count > GACHA_DRAW_LIMIT) return rejected("INVALID_GACHA_INPUT", root);
  const actionFingerprint = stableHash({ profileId, ticketLevel, count });
  const existing = root.receipts.gachaDraw[operationId];
  if (existing) {
    if (existing.actionFingerprint !== actionFingerprint) return rejected("IDEMPOTENCY_KEY_REUSE", root);
    return Object.freeze({ ok: true, status: "ALREADY_DRAWN", code: "ALREADY_DRAWN", root, receipt: Object.freeze(clone(existing)), draws: Object.freeze(clone(existing.draws)), saved: false });
  }
  if (root.rootRevision !== expectedRootRevision) return rejected("STALE_ROOT_REVISION", root);
  const ticketKey = String(ticketLevel);
  const available = root.profiles[profileId].gachaTickets[ticketKey] || 0;
  if (available < count) return rejected("INSUFFICIENT_GACHA_TICKETS", root, { available });

  let drawnAt;
  try {
    drawnAt = clock.now();
    if (typeof drawnAt !== "string" || !Number.isFinite(Date.parse(drawnAt))) throw Object.assign(new Error("INVALID_CLOCK"), { code: "INVALID_CLOCK" });
  } catch (error) { return rejected(error.code || "INVALID_CLOCK", root); }

  const stream = engine.createRngDomainsFromSnapshot(root.rngSnapshot, match.REQUIRED_RNG_STREAMS).gacha;
  const rngBefore = root.rngSnapshot.gacha;
  let draws;
  try { draws = Array.from({ length: count }, () => drawOne(stream, ticketLevel)); } catch (error) { return rejected(error.code || "GACHA_DRAW_REJECTED", root); }
  const rngAfter = stream.snapshot();
  const next = clone(root);
  next.profiles[profileId].gachaTickets[ticketKey] = available - count;
  for (const draw of draws) next.profiles[profileId].inventory[draw.skillId] = (next.profiles[profileId].inventory[draw.skillId] || 0) + 1;
  next.rngSnapshot.gacha = rngAfter;
  next.rootRevision += 1;
  const receipt = {
    scope: "gachaDraw",
    operationId,
    profileId,
    ticketLevel,
    ticketCount: count,
    actionFingerprint,
    rngBefore,
    rngAfter,
    draws: clone(draws),
    drawnAt,
    rootRevision: next.rootRevision,
  };
  next.receipts.gachaDraw[operationId] = receipt;
  try {
    save.validateStandardSave(next);
    save.persistStandardSave(storageAdapter, next);
  } catch (error) { return rejected(error instanceof save.StandardSaveError ? error.code : "PERSISTENCE_FAILED", root); }
  return Object.freeze({ ok: true, status: "DRAWN", code: "DRAWN", root: Object.freeze(next), receipt: Object.freeze(clone(receipt)), draws: Object.freeze(clone(draws)), saved: true });
}

module.exports = { CATEGORIES, GACHA_DRAW_LIMIT, GACHA_ODDS, drawGacha, drawOne, pool, rarityFrom };

},
"standard/local-two-player-controller.js":function(require,module,exports){
"use strict";

const {
  applyStandardAction,
  projectStandardPrivateState,
  projectStandardPublicState,
} = require("./standard-match.js");

function clearPrivateDom(root) {
  if (!root) return;
  root.replaceChildren();
  for (const attribute of [...(root.attributes || [])]) {
    const name = String(attribute.name || "").toLowerCase();
    if (name === "title" || name.startsWith("aria-") || name.startsWith("data-")) root.removeAttribute(attribute.name);
  }
}

class LocalTwoPlayerController {
  constructor({
    state,
    rngStreams,
    renderPublic,
    renderPrivate,
    clearPrivate,
    showHandover,
    hideHandover,
    applyAction = applyStandardAction,
    projectPublic = projectStandardPublicState,
    projectPrivate = projectStandardPrivateState,
  }) {
    this.state = state;
    this.rngStreams = rngStreams;
    this.revealedSeat = null;
    this.renderPublic = renderPublic;
    this.renderPrivate = renderPrivate;
    this.clearPrivate = clearPrivate;
    this.showHandover = showHandover;
    this.hideHandover = hideHandover;
    this.applyAction = applyAction;
    this.projectPublic = projectPublic;
    this.projectPrivate = projectPrivate;
  }

  start() {
    this.#concealAndHandover();
  }

  revealCurrentSeat() {
    if (this.state.status === "FINISHED") return Object.freeze({ ok: false, code: "MATCH_FINISHED" });
    this.hideHandover();
    this.revealedSeat = this.state.active;
    this.renderPublic(this.projectPublic(this.state));
    this.renderPrivate(this.projectPrivate(this.state, this.revealedSeat));
    return Object.freeze({ ok: true, seat: this.revealedSeat });
  }

  dispatch(action) {
    if (this.revealedSeat !== this.state.active) return Object.freeze({ ok: false, code: "PRIVATE_VIEW_NOT_REVEALED", state: this.state });
    const previousSeat = this.state.active;
    const result = this.applyAction({
      state: this.state,
      actor: previousSeat,
      action,
      expectedVersion: this.state.version,
      rngStreams: this.rngStreams,
    });
    if (!result.ok) return result;
    this.state = result.state;
    if (this.state.status === "FINISHED") {
      this.revealedSeat = null;
      this.clearPrivate();
      this.renderPublic(this.projectPublic(this.state));
      this.hideHandover();
    } else if (this.state.active !== previousSeat) {
      this.#concealAndHandover();
    } else {
      this.renderPublic(this.projectPublic(this.state));
      this.renderPrivate(this.projectPrivate(this.state, this.revealedSeat));
    }
    return result;
  }

  dispatchAutomated(actor, action) {
    if (actor !== this.state.active) return Object.freeze({ ok: false, code: "NOT_YOUR_TURN", state: this.state });
    this.revealedSeat = null;
    this.clearPrivate();
    const result = this.applyAction({
      state: this.state,
      actor,
      action,
      expectedVersion: this.state.version,
      rngStreams: this.rngStreams,
    });
    if (!result.ok) return result;
    this.state = result.state;
    if (this.state.status === "FINISHED") {
      this.renderPublic(this.projectPublic(this.state));
      this.hideHandover();
    } else {
      this.renderPublic(this.projectPublic(this.state));
      this.showHandover(Object.freeze({ seat: this.state.active, phase: this.state.phase }));
    }
    return result;
  }

  #concealAndHandover() {
    this.revealedSeat = null;
    this.clearPrivate();
    this.renderPublic(this.projectPublic(this.state));
    this.showHandover(Object.freeze({ seat: this.state.active, phase: this.state.phase }));
  }
}

module.exports = { LocalTwoPlayerController, clearPrivateDom };

},
"standard-v5/terminal-presentation.js":function(require,module,exports){
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

},
"standard-v5/static-terminal-result.js":function(require,module,exports){
"use strict";

function createTextElement(document, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function safeStats(summary, seat) {
  if (summary?.status !== "SETTLED") return null;
  const source = summary.bySeat?.[seat];
  if (!source || !["WIN", "LOSS"].includes(source.result)) return null;
  const fields = ["wins", "losses", "currentWinStreak", "bestWinStreak"];
  if (fields.some((field) => !Number.isSafeInteger(source[field]) || source[field] < 0)) return null;
  return Object.freeze({ result: source.result, ...Object.fromEntries(fields.map((field) => [field, source[field]])) });
}

function createStaticTerminalResultRenderer({ document, container, retrySettlement }) {
  if (!document || !container || typeof retrySettlement !== "function") throw new TypeError("STATIC_TERMINAL_RENDERER_INPUT_REQUIRED");
  const headline = container.querySelector("#terminalHeadline");
  const winner = container.querySelector("#terminalWinner");
  const reason = container.querySelector("#terminalReason");
  const settlementStatus = container.querySelector("#settlementStatus");
  const stats = container.querySelector("#terminalStats");
  const trophies = container.querySelector("#unlockedTrophies");
  const retry = container.querySelector("#retrySettlement");
  if ([headline, winner, reason, settlementStatus, stats, trophies, retry].some((element) => !element)) throw new Error("STATIC_TERMINAL_DOM_REQUIRED");

  retry.addEventListener("click", () => {
    if (!retry.hidden && !retry.disabled) retrySettlement();
  });

  function clearOptionalSections() {
    stats.replaceChildren();
    stats.hidden = true;
    trophies.replaceChildren();
    trophies.hidden = true;
    retry.hidden = true;
    retry.disabled = false;
    retry.removeAttribute("aria-busy");
  }

  function appendSeatStats(terminalPresentation, settlementSummary, seat) {
    const publicStats = safeStats(settlementSummary, seat);
    if (!publicStats) return;
    const name = seat === terminalPresentation.winnerSeat ? terminalPresentation.winnerName : terminalPresentation.loserName;
    const group = document.createElement("section");
    group.className = "terminal-seat-stats";
    group.appendChild(createTextElement(document, "h3", name));
    const list = document.createElement("dl");
    for (const [label, value] of [
      ["結果", publicStats.result === "WIN" ? "勝利" : "敗北"],
      ["通算勝利", publicStats.wins],
      ["通算敗北", publicStats.losses],
      ["現在連勝", publicStats.currentWinStreak],
      ["最高連勝", publicStats.bestWinStreak],
    ]) {
      list.append(createTextElement(document, "dt", label), createTextElement(document, "dd", String(value)));
    }
    group.appendChild(list);
    stats.appendChild(group);
  }

  function renderStaticTerminalResult({ terminalPresentation, settlementSummary }) {
    clearOptionalSections();
    container.hidden = false;
    const valid = terminalPresentation?.ok === true;
    headline.textContent = valid ? terminalPresentation.headline : "対戦は終了しました";
    winner.textContent = valid ? terminalPresentation.resultText : "対戦結果を表示できません。";
    reason.textContent = valid ? terminalPresentation.reasonText : "結果の詳細を表示できません。";
    settlementStatus.textContent = valid ? terminalPresentation.settlementText : "戦績の状態を確認できません。";
    if (!valid) return;

    if (terminalPresentation.settlementState === "FAILED") {
      retry.hidden = false;
      return;
    }
    if (terminalPresentation.settlementState !== "SETTLED" || settlementSummary?.status !== "SETTLED") return;

    appendSeatStats(terminalPresentation, settlementSummary, "A");
    appendSeatStats(terminalPresentation, settlementSummary, "B");
    stats.hidden = stats.childElementCount === 0;
    if (!Array.isArray(terminalPresentation.unlockedTrophies) || terminalPresentation.unlockedTrophies.length === 0) return;
    trophies.appendChild(createTextElement(document, "h3", "今回解除したトロフィー"));
    const list = document.createElement("ul");
    for (const trophy of terminalPresentation.unlockedTrophies) {
      const owner = trophy.seat === terminalPresentation.winnerSeat
        ? terminalPresentation.winnerName
        : trophy.seat === terminalPresentation.loserSeat
          ? terminalPresentation.loserName
          : "";
      list.appendChild(createTextElement(document, "li", owner ? `${owner}：${trophy.label}` : trophy.label));
    }
    trophies.appendChild(list);
    trophies.hidden = false;
  }

  function setRetryBusy(busy) {
    if (retry.hidden) return;
    retry.disabled = busy === true;
    if (busy === true) retry.setAttribute("aria-busy", "true");
    else retry.removeAttribute("aria-busy");
  }

  function hide() {
    clearOptionalSections();
    container.hidden = true;
  }

  return Object.freeze({ hide, renderStaticTerminalResult, setRetryBusy });
}

module.exports = { createStaticTerminalResultRenderer };

},
"standard-v5/terminal-reveal.js":function(require,module,exports){
"use strict";

function createTerminalRevealController({ document, clearContactReveal, schedule = setTimeout, cancel = clearTimeout } = {}) {
  if (!document?.body || typeof document.createElement !== "function") throw new TypeError("TERMINAL_REVEAL_DOCUMENT_REQUIRED");
  if (typeof clearContactReveal !== "function") throw new TypeError("TERMINAL_REVEAL_CONTACT_CLEAR_REQUIRED");
  let lastShownEventId = null;
  let generation = 0;
  let currentNode = null;
  let currentTimer = null;
  let currentMatchId = null;
  let currentSessionGeneration = 0;

  function clear() {
    generation += 1;
    if (currentTimer !== null) cancel(currentTimer);
    currentTimer = null;
    currentNode?.remove();
    currentNode = null;
  }

  function activateSession(matchId = null) {
    const nextMatchId = typeof matchId === "string" && matchId ? matchId : null;
    if (nextMatchId === currentMatchId) {
      return Object.freeze({ matchId: currentMatchId, sessionGeneration: currentSessionGeneration });
    }
    clear();
    currentMatchId = nextMatchId;
    currentSessionGeneration += 1;
    lastShownEventId = null;
    return Object.freeze({ matchId: currentMatchId, sessionGeneration: currentSessionGeneration });
  }

  function getSessionContext() {
    return Object.freeze({ matchId: currentMatchId, sessionGeneration: currentSessionGeneration });
  }

  function showTerminalReveal({ eventId, matchId, sessionGeneration, headline, resultText } = {}) {
    if (typeof matchId !== "string" || !matchId || matchId !== currentMatchId) return false;
    if (!Number.isSafeInteger(sessionGeneration) || sessionGeneration !== currentSessionGeneration) return false;
    if (typeof eventId !== "string" || !eventId || eventId === lastShownEventId) return false;
    if (typeof headline !== "string" || !headline || typeof resultText !== "string" || !resultText) return false;

    clearContactReveal();
    clear();
    const token = ++generation;
    const layer = document.createElement("div");
    const card = document.createElement("div");
    const kicker = document.createElement("p");
    const title = document.createElement("p");
    const result = document.createElement("p");
    layer.className = "terminal-reveal";
    layer.setAttribute("aria-hidden", "true");
    card.className = "terminal-reveal-card";
    kicker.className = "terminal-reveal-kicker";
    title.className = "terminal-reveal-headline";
    result.className = "terminal-reveal-result";
    kicker.textContent = "MATCH COMPLETE";
    title.textContent = headline;
    result.textContent = resultText;
    card.append(kicker, title, result);
    layer.appendChild(card);
    document.body.appendChild(layer);
    currentNode = layer;
    try {
      currentTimer = schedule(() => {
        if (token !== generation || currentNode !== layer) return;
        layer.remove();
        currentNode = null;
        currentTimer = null;
      }, 1200);
    } catch (error) {
      layer.remove();
      currentNode = null;
      currentTimer = null;
      throw error;
    }
    lastShownEventId = eventId;
    return true;
  }

  return Object.freeze({ activateSession, clear, getSessionContext, showTerminalReveal });
}

module.exports = { createTerminalRevealController };

},
"standard-v5/app.js":function(require,module,exports){
"use strict";

const { clearPrivateDom } = require("../standard/local-two-player-controller.js");
const { createRngDomains } = require("../standard/standard-engine.js");
const { createQuizQuestions } = require("../standard/quiz-session.js");
const { createStandardQuizController } = require("../standard/standard-quiz-controller.js");
const { createStandardLocalSession } = require("../standard/standard-local-session.js");
const { RULE_SET_IDS } = require("../standard/standard-match-start.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("../standard/standard-skill-registry.js");
const { ALL_COSMETIC_CLASSES, COSMETIC_CATALOG, COSMETIC_TYPE_LABELS } = require("../standard/standard-cosmetics.js");
const { buildTerminalPresentation } = require("./terminal-presentation.js");
const { createStaticTerminalResultRenderer } = require("./static-terminal-result.js");
const { createTerminalRevealController } = require("./terminal-reveal.js");

const COLOR_NAMES = Object.freeze({ red: "赤", blue: "青", yellow: "黄", green: "緑" });
const PRESENTATION_KEY = "fourColorMapGame.standard.v5.presentation";
const LOADOUT_CATEGORIES = Object.freeze(["color", "area", "disrupt"]);
const LOADOUT_CATEGORY_NAMES = Object.freeze({ color: "色操作", area: "エリア操作", disrupt: "相手妨害" });
const TROPHY_PRESENTATION = Object.freeze({
  fullPaint: Object.freeze({ name: "完塗り", icon: "🏆", description: "トロフィー対象面積を100％実彩色して勝利", reward: "地図職人の盤面" }),
  fullPaint3: Object.freeze({ name: "地図職人", icon: "🗺️", description: "完塗りを累計3回達成", reward: "完成地図の輝き" }),
  noSkillFullPaint: Object.freeze({ name: "四色の匠", icon: "✨", description: "スキルを使わず完塗りして勝利", reward: "称号・四色の匠" }),
});

function boot() {
  const byId = (id) => document.getElementById(id);
  const board = byId("board");
  const privatePanel = byId("privatePanel");
  const status = byId("status");
  const notice = byId("notice");
  const handover = byId("handover");
  const handoverSeat = byId("handoverSeat");
  const ruleSet = byId("ruleSet");
  const profileA = byId("profileA");
  const profileB = byId("profileB");
  const firstPlayer = byId("firstPlayer");
  const startMatch = byId("startMatch");
  const setupDetails = byId("setupDetails");
  const loadoutBuilder = byId("loadoutBuilder");
  const loadoutA = byId("loadoutA");
  const loadoutB = byId("loadoutB");
  const loadoutAStatus = byId("loadoutAStatus");
  const loadoutBStatus = byId("loadoutBStatus");
  const quizSetup = byId("quizSetup");
  const quizProfile = byId("quizProfile");
  const quizLevel = byId("quizLevel");
  const startQuiz = byId("startQuiz");
  const quizStatus = byId("quizStatus");
  const quizPlay = byId("quizPlay");
  const quizCounter = byId("quizCounter");
  const quizScore = byId("quizScore");
  const quizTimeBar = byId("quizTimeBar");
  const quizQuestion = byId("quizQuestion");
  const quizOptions = byId("quizOptions");
  const quizHint = byId("quizHint");
  const quizNext = byId("quizNext");
  const quizHintText = byId("quizHintText");
  const quizResult = byId("quizResult");
  const quizSaveReward = byId("quizSaveReward");
  const gachaProfile = byId("gachaProfile");
  const gachaLevel = byId("gachaLevel");
  const gachaDrawOne = byId("gachaDrawOne");
  const gachaDrawAll = byId("gachaDrawAll");
  const gachaTickets = byId("gachaTickets");
  const gachaStatus = byId("gachaStatus");
  const gachaRetry = byId("gachaRetry");
  const gachaResults = byId("gachaResults");
  const cardSaleProfile = byId("cardSaleProfile");
  const cardSaleSkill = byId("cardSaleSkill");
  const cardSaleQuantity = byId("cardSaleQuantity");
  const cardSaleQuote = byId("cardSaleQuote");
  const cardSaleCoins = byId("cardSaleCoins");
  const cardSaleStatus = byId("cardSaleStatus");
  const cardSaleConfirmation = byId("cardSaleConfirmation");
  const cardSaleConfirmationText = byId("cardSaleConfirmationText");
  const cardSaleCommit = byId("cardSaleCommit");
  const cardSaleCancel = byId("cardSaleCancel");
  const cardSaleRetry = byId("cardSaleRetry");
  const cosmeticProfile = byId("cosmeticProfile");
  const cosmeticCoins = byId("cosmeticCoins");
  const collectionIdentity = byId("collectionIdentity");
  const cosmeticStatus = byId("cosmeticStatus");
  const cosmeticCatalog = byId("cosmeticCatalog");
  const cosmeticConfirmation = byId("cosmeticConfirmation");
  const cosmeticConfirmationText = byId("cosmeticConfirmationText");
  const cosmeticCommit = byId("cosmeticCommit");
  const cosmeticCancel = byId("cosmeticCancel");
  const cosmeticRetry = byId("cosmeticRetry");
  const trophyCatalog = byId("trophyCatalog");
  const resultPanel = byId("resultPanel");
  const commitRegion = byId("commitRegion");
  const surrender = byId("surrender");
  const sizeRevealEnabled = byId("sizeRevealEnabled");
  const paletteRevealEnabled = byId("paletteRevealEnabled");
  const eventReveal = byId("eventReveal");
  const eventRevealCard = byId("eventRevealCard");
  const eventRevealKicker = byId("eventRevealKicker");
  const eventRevealVisual = byId("eventRevealVisual");
  const eventRevealTitle = byId("eventRevealTitle");
  const eventRevealDetail = byId("eventRevealDetail");
  let contactReveal = null;
  let contactRevealTimer = null;
  // UI-only effect generation. It is independent from action/control generations and is never persisted.
  let contactPresentationGeneration = 0;
  const selected = new Set();
  const initialPaletteShown = new Set();
  let presentationState = {};
  let revealedSeat = null;
  let targetMode = null;
  let pendingStart = null;
  let quizController = null;
  let quizActorId = null;
  let quizActorName = null;
  let activeQuizHint = null;
  let pendingQuizSettlement = null;
  let quizRewardSaved = false;
  let pendingGacha = null;
  let lastGachaResults = [];
  let pendingCardSale = null;
  let pendingCosmeticAction = null;
  const selectedLoadouts = Object.fromEntries(["A", "B"].map((seat) => [seat, Object.fromEntries(LOADOUT_CATEGORIES.map((category) => [category, new Set()]))]));
  let idCounter = 0;
  // UI-only render generation. It scopes every action-bearing control and is never persisted.
  let interactionGeneration = 0;
  const inFlightGestures = new Set();
  const recentGestureUntil = new Map();

  const makeId = (scope) => {
    if (globalThis.crypto?.randomUUID) return `${scope}-${globalThis.crypto.randomUUID()}`;
    idCounter += 1;
    return `${scope}-${Date.now().toString(36)}-${idCounter}`;
  };
  const session = createStandardLocalSession({ storageAdapter: localStorage, clock: { now: () => new Date().toISOString() }, idFactory: makeId });
  const terminalResultRenderer = createStaticTerminalResultRenderer({ document, container: resultPanel, retrySettlement: () => runGesture("settlement-retry", settleAndRender) });
  const terminalRevealController = createTerminalRevealController({ document, clearContactReveal });

  function quizNow() { return performance.now(); }

  function createQuestions() {
    const seedBuffer = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(seedBuffer);
    else seedBuffer[0] = Date.now() >>> 0;
    const rng = createRngDomains(seedBuffer[0], ["quiz-structure", "quiz-content", "quiz-choice-rank", "quiz-choice-order"]);
    return createQuizQuestions({
      structureRandom: () => rng["quiz-structure"].next(),
      contentRandom: () => rng["quiz-content"].next(),
      rankRandom: () => rng["quiz-choice-rank"].next(),
      placementRandom: () => rng["quiz-choice-order"].next(),
    });
  }

  function renderQuizProfiles(projection) {
    if (quizController?.projection(quizNow()).stage === "QUESTION") return;
    const previous = quizProfile.value;
    quizProfile.replaceChildren();
    for (const profile of projection.profiles) {
      const option = document.createElement("option");
      option.value = profile.profileId;
      option.textContent = profile.displayName;
      quizProfile.appendChild(option);
    }
    if ([...quizProfile.options].some((option) => option.value === previous)) quizProfile.value = previous;
  }

  function quizIsBlockedByMatch() {
    return session.getPublicProjection()?.status === "ACTIVE";
  }

  function renderQuiz(projection = quizController?.projection(quizNow()) || null) {
    const playing = projection?.stage === "QUESTION";
    const finished = projection?.stage === "RESULT";
    quizSetup.hidden = playing;
    quizPlay.hidden = !playing;
    quizResult.hidden = !finished;
    quizSaveReward.hidden = !finished || quizRewardSaved || !pendingQuizSettlement;
    quizProfile.disabled = playing;
    quizLevel.disabled = playing;
    startQuiz.disabled = playing || quizIsBlockedByMatch() || !quizProfile.value || (finished && !quizRewardSaved);
    startQuiz.textContent = finished ? "もう一度挑戦" : "10問チャレンジ開始";
    if (!projection) {
      quizStatus.textContent = quizIsBlockedByMatch() ? "対戦中は数字ラッシュを開始できません。" : "レベルを選んで開始してください。";
      return;
    }
    if (finished) {
      quizStatus.textContent = "チャレンジ終了";
      quizResult.textContent = `${quizActorName || "プレイヤー"}：${projection.correct}問正解・${projection.wrong}ミス。${quizRewardSaved ? "獲得" : "獲得予定"}：Lv.${projection.reward.ticketLevel} ガチャ券 ${projection.reward.draws}枚（${projection.reward.reason}）。${quizRewardSaved ? "報酬を保存しました。" : "報酬はまだ保存されていません。"}`;
      return;
    }
    quizCounter.textContent = `${projection.questionNumber} / ${projection.questionCount}`;
    quizScore.textContent = `正解 ${projection.correct} / ミス ${projection.wrong} / 連続 ${projection.streak}`;
    quizQuestion.textContent = projection.question.prompt;
    quizTimeBar.style.width = `${Math.max(0, Math.min(100, projection.remainingMs / projection.question.timeMs * 100))}%`;
    quizOptions.replaceChildren();
    for (const option of projection.question.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      button.disabled = projection.resolved || projection.hintActive;
      suppressRepeatedActivation(button);
      button.onclick = () => runGesture(`quiz-answer:${projection.questionNumber}`, () => {
        const result = quizController.answer(option.id, quizNow());
        renderQuiz(result.projection);
      });
      quizOptions.appendChild(button);
    }
    quizHint.disabled = projection.hintUsed || projection.resolved;
    quizNext.hidden = !projection.resolved;
    quizHintText.hidden = !projection.hintActive || !activeQuizHint;
    quizHintText.textContent = projection.hintActive ? activeQuizHint || "" : "";
    if (projection.resolution) quizStatus.textContent = projection.resolution.timedOut ? `時間切れ。正解は ${projection.resolution.answerLabel}` : projection.resolution.correct ? "正解！" : `不正解。正解は ${projection.resolution.answerLabel}`;
    else quizStatus.textContent = projection.hintActive ? "ヒント表示中：解答時間は停止しています。" : "答えを選んでください。";
  }

  function renderGachaProfiles(projection) {
    if (pendingGacha) return;
    const previous = gachaProfile.value;
    gachaProfile.replaceChildren();
    for (const profile of projection.profiles) {
      const option = document.createElement("option");
      option.value = profile.profileId;
      option.textContent = profile.displayName;
      gachaProfile.appendChild(option);
    }
    if ([...gachaProfile.options].some((option) => option.value === previous)) gachaProfile.value = previous;
  }

  function renderGacha() {
    const projection = session.getGachaProjection(gachaProfile.value);
    if (!projection.ok) {
      gachaTickets.textContent = "利用できるプロフィールがありません。";
      gachaDrawOne.disabled = true;
      gachaDrawAll.disabled = true;
      return;
    }
    for (const option of gachaLevel.options) option.textContent = `Lv.${option.value}（${projection.tickets[option.value]}枚）`;
    const available = projection.tickets[gachaLevel.value] || 0;
    gachaTickets.textContent = [1, 2, 3, 4, 5].map((level) => `Lv.${level} ×${projection.tickets[level]}`).join(" / ");
    gachaProfile.disabled = Boolean(pendingGacha);
    gachaLevel.disabled = Boolean(pendingGacha);
    gachaDrawOne.disabled = Boolean(pendingGacha) || available < 1;
    gachaDrawAll.disabled = Boolean(pendingGacha) || available < 1;
    gachaRetry.hidden = !pendingGacha;
    gachaResults.replaceChildren();
    for (const draw of lastGachaResults) {
      const card = document.createElement("article");
      card.className = `gacha-card r${draw.rarity}`;
      const stars = document.createElement("div");
      stars.className = "gacha-stars";
      stars.textContent = "★".repeat(draw.rarity);
      const heading = document.createElement("h3");
      heading.textContent = STANDARD_SKILLS[draw.skillId].displayName;
      const detail = document.createElement("p");
      detail.textContent = `${LOADOUT_CATEGORY_NAMES[draw.category]} / Lv.${draw.ticketLevel}券`;
      card.append(stars, heading, detail);
      gachaResults.appendChild(card);
    }
  }

  function runGachaDraw(count = null) {
    if (!pendingGacha) {
      const projection = session.getGachaProjection(gachaProfile.value);
      const available = projection.ok ? projection.tickets[gachaLevel.value] || 0 : 0;
      const requested = count === null ? available : count;
      if (requested < 1) { gachaStatus.textContent = "このレベルのガチャ券がありません。"; return; }
      pendingGacha = { operationId: makeId("gacha"), profileId: gachaProfile.value, ticketLevel: Number(gachaLevel.value), count: requested };
    }
    const result = session.drawGacha(pendingGacha);
    if (!result.ok) {
      gachaStatus.textContent = `抽選を保存できません（${result.code}）。同じ抽選IDで再試行できます。`;
      renderGacha();
      return;
    }
    lastGachaResults = [...result.draws];
    pendingGacha = null;
    gachaStatus.textContent = `${result.draws.length}枚を獲得し、券と在庫を一度だけ保存しました。`;
    renderGachaProfiles(result.setup);
    renderCardSaleProfiles(result.setup);
    renderCosmeticProfiles(result.setup);
    renderLoadoutBuilder(result.setup);
    renderGacha();
    renderCardSale();
    renderCosmetics();
  }

  function renderCardSaleProfiles(projection) {
    if (pendingCardSale) return;
    const previous = cardSaleProfile.value;
    cardSaleProfile.replaceChildren();
    for (const profile of projection.profiles) {
      const option = document.createElement("option");
      option.value = profile.profileId;
      option.textContent = profile.displayName;
      cardSaleProfile.appendChild(option);
    }
    if ([...cardSaleProfile.options].some((option) => option.value === previous)) cardSaleProfile.value = previous;
  }

  function renderCardSale() {
    const projection = session.getCardSaleProjection(cardSaleProfile.value);
    if (!projection.ok) {
      cardSaleCoins.textContent = "利用できるプロフィールがありません。";
      cardSaleQuote.disabled = true;
      return;
    }
    const previousSkill = pendingCardSale?.skillId || cardSaleSkill.value;
    cardSaleSkill.replaceChildren();
    for (const item of projection.items) {
      const option = document.createElement("option");
      option.value = item.skillId;
      option.disabled = item.sellableCount < 1;
      option.textContent = `${STANDARD_SKILLS[item.skillId].displayName} ★${item.rarity}（所持${item.ownedCount}・売却可${item.sellableCount}${item.protected ? "・保護中" : ""}）`;
      cardSaleSkill.appendChild(option);
    }
    if ([...cardSaleSkill.options].some((option) => option.value === previousSkill && !option.disabled)) cardSaleSkill.value = previousSkill;
    else {
      const firstSellable = [...cardSaleSkill.options].find((option) => !option.disabled);
      if (firstSellable) cardSaleSkill.value = firstSellable.value;
    }
    const item = projection.items.find((entry) => entry.skillId === cardSaleSkill.value);
    const max = item?.sellableCount || 0;
    cardSaleQuantity.max = String(Math.max(1, max));
    if (!pendingCardSale && (!Number.isSafeInteger(Number(cardSaleQuantity.value)) || Number(cardSaleQuantity.value) < 1 || Number(cardSaleQuantity.value) > max)) cardSaleQuantity.value = max > 0 ? "1" : "0";
    cardSaleCoins.textContent = `${projection.displayName}のコイン：${projection.coins}`;
    const locked = Boolean(pendingCardSale);
    cardSaleProfile.disabled = locked;
    cardSaleSkill.disabled = locked || max < 1;
    cardSaleQuantity.disabled = locked || max < 1;
    cardSaleQuote.disabled = locked || max < 1;
    cardSaleConfirmation.hidden = !locked || pendingCardSale.failed;
    cardSaleRetry.hidden = !locked || !pendingCardSale.failed;
  }

  function prepareCardSale() {
    const quantity = Number(cardSaleQuantity.value);
    const quoted = session.quoteCardSale({ profileId: cardSaleProfile.value, skillId: cardSaleSkill.value, quantity });
    if (!quoted.ok) { cardSaleStatus.textContent = `売却できません（${quoted.code}）。`; return; }
    pendingCardSale = {
      operationId: makeId("sale"),
      profileId: cardSaleProfile.value,
      skillId: cardSaleSkill.value,
      quantity,
      acceptedConfirmationReasons: [...quoted.quote.confirmationReasons],
      quote: quoted.quote,
      failed: false,
    };
    const warnings = quoted.quote.confirmationReasons.map((reason) => reason === "HIGH_RARITY" ? "高レアカードを含みます" : "売却可能な最後の余剰分です");
    cardSaleConfirmationText.textContent = `${STANDARD_SKILLS[pendingCardSale.skillId].displayName}を${quantity}枚売却し、${quoted.quote.earnedCoins}コインを獲得します。売却後は${quoted.quote.remaining}枚です。${warnings.length ? `注意：${warnings.join("、")}。` : ""}`;
    cardSaleStatus.textContent = "内容を確認して売却を確定してください。";
    renderCardSale();
  }

  function commitPreparedCardSale() {
    if (!pendingCardSale) return;
    const result = session.commitCardSale(pendingCardSale);
    if (!result.ok) {
      pendingCardSale.failed = true;
      cardSaleStatus.textContent = `売却を保存できません（${result.code}）。同じ売却IDで再試行できます。`;
      renderCardSale();
      return;
    }
    const sold = pendingCardSale;
    pendingCardSale = null;
    cardSaleStatus.textContent = `${STANDARD_SKILLS[sold.skillId].displayName}を${sold.quantity}枚売却し、${result.receipt.totalCoins}コインを一度だけ保存しました。`;
    renderQuizProfiles(result.setup);
    renderGachaProfiles(result.setup);
    renderCardSaleProfiles(result.setup);
    renderCosmeticProfiles(result.setup);
    renderLoadoutBuilder(result.setup);
    renderGacha();
    renderCardSale();
    renderCosmetics();
  }

  function cancelCardSale() {
    pendingCardSale = null;
    cardSaleStatus.textContent = "売却をキャンセルしました。";
    renderCardSale();
  }

  function renderCosmeticProfiles(projection) {
    if (pendingCosmeticAction) return;
    const previous = cosmeticProfile.value;
    cosmeticProfile.replaceChildren();
    for (const profile of projection.profiles) {
      const option = document.createElement("option");
      option.value = profile.profileId;
      option.textContent = profile.displayName;
      cosmeticProfile.appendChild(option);
    }
    if ([...cosmeticProfile.options].some((option) => option.value === previous)) cosmeticProfile.value = previous;
  }

  function applyCosmeticClasses(projection) {
    document.body.classList.remove(...ALL_COSMETIC_CLASSES);
    for (const cosmeticId of Object.values(projection.equipped)) {
      const cssClass = COSMETIC_CATALOG[cosmeticId]?.cssClass;
      if (cssClass) document.body.classList.add(cssClass);
    }
  }

  function renderCosmetics() {
    const projection = session.getCosmeticProjection(cosmeticProfile.value);
    if (!projection.ok) {
      cosmeticCoins.textContent = "利用できるプロフィールがありません。";
      cosmeticCatalog.replaceChildren();
      trophyCatalog.replaceChildren();
      return;
    }
    applyCosmeticClasses(projection);
    const title = COSMETIC_CATALOG[projection.equipped.title]?.name;
    collectionIdentity.textContent = title && projection.equipped.title !== "titleNone" ? `${projection.displayName}｜${title}` : projection.displayName;
    cosmeticCoins.textContent = `コイン：${projection.coins}`;
    const locked = Boolean(pendingCosmeticAction);
    cosmeticProfile.disabled = locked;
    cosmeticCatalog.replaceChildren();
    for (const item of projection.items) {
      const card = document.createElement("article");
      card.className = `collection-card${item.equipped ? " equipped" : ""}${!item.trophyUnlocked ? " locked" : ""}`;
      const type = document.createElement("strong");
      type.textContent = COSMETIC_TYPE_LABELS[item.type];
      const preview = document.createElement("div");
      preview.className = `collection-preview${item.previewClass ? ` ${item.previewClass}` : ""}`;
      preview.textContent = item.preview;
      const name = document.createElement("h3");
      name.textContent = item.name;
      const detail = document.createElement("p");
      detail.textContent = item.trophyId ? `トロフィー「${TROPHY_PRESENTATION[item.trophyId].name}」で解放` : item.price > 0 ? `${item.price}コイン・対戦能力への効果なし` : "無料・対戦能力への効果なし";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.equipped ? "装備中" : !item.trophyUnlocked ? "未解放" : item.owned ? "装備する" : "購入して装備";
      button.disabled = locked || item.equipped || !item.trophyUnlocked;
      suppressRepeatedActivation(button);
      button.onclick = () => runGesture("cosmetic-quote", () => prepareCosmeticAction(item.cosmeticId));
      card.append(type, preview, name, detail, button);
      cosmeticCatalog.appendChild(card);
    }
    cosmeticConfirmation.hidden = !locked || pendingCosmeticAction.failed;
    cosmeticRetry.hidden = !locked || !pendingCosmeticAction.failed;
    trophyCatalog.replaceChildren();
    for (const [trophyId, presentation] of Object.entries(TROPHY_PRESENTATION)) {
      const unlocked = projection.trophies[trophyId] === true;
      const card = document.createElement("article");
      card.className = `collection-card${unlocked ? "" : " locked"}`;
      const heading = document.createElement("h3");
      heading.textContent = `${presentation.icon} ${presentation.name}`;
      const description = document.createElement("p");
      description.textContent = presentation.description;
      const state = document.createElement("p");
      state.textContent = unlocked ? `解除済み${projection.trophyDates[trophyId] ? `：${projection.trophyDates[trophyId]}` : ""}｜報酬：${presentation.reward}` : `未解除｜報酬：${presentation.reward}`;
      card.append(heading, description, state);
      trophyCatalog.appendChild(card);
    }
  }

  function prepareCosmeticAction(cosmeticId) {
    const quoted = session.quoteCosmeticAction({ profileId: cosmeticProfile.value, cosmeticId });
    if (!quoted.ok) { cosmeticStatus.textContent = `購入・装備できません（${quoted.code}）。`; return; }
    pendingCosmeticAction = { operationId: makeId("cosmetic"), profileId: cosmeticProfile.value, cosmeticId, quote: quoted.quote, failed: false };
    cosmeticConfirmationText.textContent = quoted.quote.purchaseRequired
      ? `${quoted.quote.name}を${quoted.quote.price}コインで購入して装備します。残高は${quoted.quote.coinsAfter}コインになります。`
      : `${quoted.quote.name}を装備します。コインは消費しません。`;
    cosmeticStatus.textContent = "内容を確認して確定してください。";
    renderCosmetics();
  }

  function commitPreparedCosmeticAction() {
    if (!pendingCosmeticAction) return;
    const result = session.commitCosmeticAction(pendingCosmeticAction);
    if (!result.ok) {
      pendingCosmeticAction.failed = true;
      cosmeticStatus.textContent = `購入・装備を保存できません（${result.code}）。同じ処理IDで再試行できます。`;
      renderCosmetics();
      return;
    }
    const completed = pendingCosmeticAction;
    pendingCosmeticAction = null;
    cosmeticStatus.textContent = `${COSMETIC_CATALOG[completed.cosmeticId].name}を一度だけ保存して装備しました。`;
    renderQuizProfiles(result.setup);
    renderGachaProfiles(result.setup);
    renderCardSaleProfiles(result.setup);
    renderCosmeticProfiles(result.setup);
    renderLoadoutBuilder(result.setup);
    renderCardSale();
    renderCosmetics();
  }

  function cancelCosmeticAction() {
    pendingCosmeticAction = null;
    cosmeticStatus.textContent = "購入・装備をキャンセルしました。";
    renderCosmetics();
  }

  function say(text) { notice.textContent = text; }

  function runGesture(group, action) {
    const now = Date.now();
    if (inFlightGestures.has(group) || now < (recentGestureUntil.get(group) || 0)) return;
    inFlightGestures.add(group);
    recentGestureUntil.set(group, now + 300);
    let result;
    try {
      result = action();
    } catch (error) {
      inFlightGestures.delete(group);
      throw error;
    }
    if (result && typeof result.finally === "function") return result.finally(() => inFlightGestures.delete(group));
    inFlightGestures.delete(group);
    return result;
  }

  function suppressRepeatedActivation(control) {
    control.onkeydown = (event) => {
      if (event.repeat && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
  }

  function actionGestureGroup(type, payload) {
    if (type === "USE_SKILL") return `skill:${payload.skill}:${interactionGeneration}`;
    return `action:${type}:${interactionGeneration}`;
  }

  function loadPresentationPreferences() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PRESENTATION_KEY) || "{}"); } catch { saved = {}; }
    presentationState = saved && typeof saved === "object" ? saved : {};
    sizeRevealEnabled.checked = saved.sizeReveal !== false;
    paletteRevealEnabled.checked = saved.paletteReveal !== false;
    for (const key of Array.isArray(saved.paletteShown) ? saved.paletteShown.slice(-32) : []) {
      if (typeof key === "string") initialPaletteShown.add(key);
    }
  }

  function savePresentationPreferences() {
    const paletteShown = [...initialPaletteShown].slice(-32);
    presentationState = { ...presentationState, sizeReveal: sizeRevealEnabled.checked, paletteReveal: paletteRevealEnabled.checked, paletteShown };
    try { localStorage.setItem(PRESENTATION_KEY, JSON.stringify(presentationState)); } catch { /* cosmetic preference only */ }
  }

  function showReveal({ kicker = "", icon = "", title, detail = "", tone = "" }) {
    eventRevealCard.className = `event-reveal-card ${tone}`.trim();
    eventRevealKicker.textContent = kicker;
    eventRevealVisual.replaceChildren();
    eventRevealVisual.textContent = icon;
    eventRevealTitle.textContent = title;
    eventRevealDetail.textContent = detail;
    eventReveal.hidden = false;
  }

  function clearPrivate() {
    interactionGeneration += 1;
    revealedSeat = null;
    targetMode = null;
    selected.clear();
    clearPrivateDom(privatePanel);
  }

  function regionAt(publicState, macro) {
    return Object.values(publicState.regions).find((region) => (region.sourceMacros || []).includes(macro));
  }

  function showContactReveal(contactColorCount) {
    const reveals = {
      2: { title: "二色接触！", detail: "相手の選択肢へ圧力", tone: "warn" },
      3: { title: "三色圧力!!", detail: "強いエリア工作", tone: "warn" },
      4: { title: "四色包囲!!!", detail: "全色が一点へ集中", tone: "epic" },
    };
    const reveal = reveals[contactColorCount];
    if (!reveal) return;
    const presentationGeneration = ++contactPresentationGeneration;
    if (contactRevealTimer) clearTimeout(contactRevealTimer);
    if (!contactReveal) {
      contactReveal = document.createElement("div");
      contactReveal.id = "contactReveal";
      contactReveal.className = "contact-reveal";
      contactReveal.setAttribute("role", "status");
      contactReveal.setAttribute("aria-live", "polite");
      contactReveal.setAttribute("aria-atomic", "true");
      document.body.appendChild(contactReveal);
    }
    const card = document.createElement("div");
    const title = document.createElement("p");
    const detail = document.createElement("p");
    card.className = `contact-reveal-card contact-pressure-${contactColorCount} ${reveal.tone === "epic" ? "epic" : ""}`.trim();
    title.textContent = reveal.title;
    detail.textContent = reveal.detail;
    card.append(title, detail);
    contactReveal.replaceChildren(card);
    const presentationNode = contactReveal;
    contactRevealTimer = setTimeout(() => {
      if (presentationGeneration !== contactPresentationGeneration || contactReveal !== presentationNode) return;
      contactReveal?.remove();
      contactReveal = null;
      contactRevealTimer = null;
    }, 900);
  }

  function clearContactReveal() {
    contactPresentationGeneration += 1;
    if (contactRevealTimer) clearTimeout(contactRevealTimer);
    contactRevealTimer = null;
    contactReveal?.remove();
    contactReveal = null;
  }

  function handleResolved(result, actorSeat, terminalSessionContext) {
    if (!result.ok) {
      say(result.code === "NO_LEGAL_RECOLOR" ? "変更先がありません。カードは消費されませんでした。" : `操作できません（${result.code}）。`);
      const privateResult = session.revealPrivate(actorSeat);
      if (privateResult.ok) renderPrivate(privateResult.privateState);
      return;
    }
    targetMode = null;
    selected.clear();
    if (result.finished) {
      clearPrivate();
      renderPublic(session.getPublicProjection());
      const terminalPresentation = renderResult(result.projection);
      const publicResult = result.projection?.publicResult;
      if (result.status === "RESOLVED" && result.saved && result.appliedNow && !result.replayedReceipt
        && result.projection?.publicState?.status === "FINISHED" && terminalPresentation?.ok === true
        && typeof publicResult?.matchId === "string" && Number.isSafeInteger(publicResult?.finalMatchVersion)) {
        terminalRevealController.showTerminalReveal({
          eventId: `${publicResult.matchId}:${publicResult.finalMatchVersion}`,
          matchId: publicResult.matchId,
          sessionGeneration: terminalSessionContext.sessionGeneration,
          headline: terminalPresentation.headline,
          resultText: terminalPresentation.resultText,
        });
      }
      settleAndRender();
      return;
    }
    if (result.activeChanged) {
      clearPrivate();
      renderStage(result.projection);
      if (result.status === "RESOLVED" && result.saved && result.appliedNow && !result.replayedReceipt && result.actionType === "CREATE_REGION") {
        showContactReveal(result.contactColorCount);
      }
      return;
    }
    renderPublic(session.getPublicProjection());
    const privateResult = session.revealPrivate(actorSeat);
    if (privateResult.ok) renderPrivate(privateResult.privateState);
  }

  function dispatch(type, payload = {}) {
    if (!revealedSeat) return;
    return runGesture(actionGestureGroup(type, payload), async () => {
      const actorSeat = revealedSeat;
      if (!actorSeat) return;
      const terminalSessionContext = terminalRevealController.getSessionContext();
      const activeControl = type === "CREATE_REGION" ? commitRegion : null;
      if (activeControl) {
        activeControl.disabled = true;
        activeControl.setAttribute("aria-busy", "true");
      }
      try {
        const result = await session.dispatchAction({ actorSeat, type, payload });
        say(result.ok ? "操作を保存しました。" : `操作できません（${result.code}）。`);
        handleResolved(result, actorSeat, terminalSessionContext);
        return result;
      } finally {
        if (activeControl?.isConnected) {
          activeControl.removeAttribute("aria-busy");
          const publicState = session.getPublicProjection();
          activeControl.disabled = !revealedSeat || !publicState || !["CREATE_FIRST", "WORK"].includes(publicState.phase);
        }
      }
    });
  }

  function renderPublic(publicState) {
    if (!publicState) {
      status.textContent = "対戦データがありません。";
      board.replaceChildren();
      return;
    }
    status.textContent = publicState.status === "FINISHED"
      ? "対戦終了。公開結果をご確認ください。"
      : `Turn ${publicState.turn}・Player ${publicState.active}・${publicState.phase}・指定 ${publicState.requiredSize}マス`;
    board.replaceChildren();
    const bounds = publicState.playableBounds;
    const preparedMacros = new Set(publicState.preparedOutgoing?.sourceMacros || []);
    for (let macro = 0; macro < 144; macro += 1) {
      const col = macro % 12;
      const row = Math.floor(macro / 12);
      const region = regionAt(publicState, macro);
      const cell = document.createElement("button");
      cell.type = "button";
      suppressRepeatedActivation(cell);
      cell.className = `cell${region?.color ? ` ${region.color}` : ""}${region?.isPending ? " pending" : ""}`;
      const inside = col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
      if (!inside) cell.classList.add("outside");
      const cornerTargets = targetMode?.kind === "areaCornerBloom" ? new Set(targetMode.sourceMacros) : null;
      if (!inside || publicState.status === "FINISHED" || (cornerTargets ? !cornerTargets.has(macro) : Boolean(publicState.preparedOutgoing))) cell.disabled = true;
      if (selected.has(macro) || preparedMacros.has(macro)) cell.classList.add("selected");
      cell.onclick = () => {
        if (!cell.isConnected) return;
        if (!revealedSeat) return;
        if (targetMode?.kind === "areaCornerBloom") {
          if (!targetMode.sourceMacros.includes(macro)) return;
          const sourceMacros = [...targetMode.sourceMacros];
          targetMode = null;
          dispatch("USE_SKILL", { skill: "areaCornerBloom", sourceMacros, macro });
          return;
        }
        if (publicState.preparedOutgoing) return;
        if (targetMode?.kind === "areaResize") return;
        if (targetMode?.kind === "colorRegionSplit") {
          if (publicState.phase !== "COLOR" || region?.id !== publicState.pending) return;
          session.cancelPendingActionRetry();
          selected.has(macro) ? selected.delete(macro) : selected.add(macro);
          renderPublic(session.getPublicProjection());
          const privateResult = session.revealPrivate(revealedSeat);
          if (privateResult.ok) renderPrivate(privateResult.privateState);
          return;
        }
        if (targetMode === "legalRecolor" && region?.color) {
          targetMode = null;
          dispatch("USE_SKILL", { skill: "legalRecolor", regionId: region.id });
          return;
        }
        if (!["CREATE_FIRST", "WORK"].includes(publicState.phase) || region || !inside) return;
        session.cancelPendingActionRetry();
        selected.has(macro) ? selected.delete(macro) : selected.add(macro);
        renderPublic(session.getPublicProjection());
        const privateResult = session.revealPrivate(revealedSeat);
        if (privateResult.ok) renderPrivate(privateResult.privateState);
      };
      board.appendChild(cell);
    }
    commitRegion.disabled = !revealedSeat || targetMode?.kind === "colorRegionSplit" || targetMode?.kind === "areaResize" || targetMode?.kind === "areaCornerBloom" || !["CREATE_FIRST", "WORK"].includes(publicState.phase);
    surrender.disabled = !revealedSeat || publicState.status === "FINISHED";
  }

  function appendButton(text, disabled, onClick, className = "skill") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.disabled = disabled;
    suppressRepeatedActivation(button);
    const controlGeneration = interactionGeneration;
    button.onclick = () => {
      if (controlGeneration !== interactionGeneration || !button.isConnected) return;
      onClick();
    };
    privatePanel.appendChild(button);
  }

  function renderPrivate(own) {
    interactionGeneration += 1;
    const controlGeneration = interactionGeneration;
    clearPrivateDom(privatePanel);
    const heading = document.createElement("h2");
    heading.className = "private-title";
    heading.textContent = `Player ${own.seat} の情報`;
    privatePanel.appendChild(heading);
    const palette = document.createElement("div");
    palette.className = "palette";
    const prism = Boolean(own.privateEffects?.prism);
    const temporaryColors = own.privateEffects?.temporaryColors || [];
    const ownedColors = prism ? Object.keys(COLOR_NAMES) : own.basicPalette.concat(own.bonusColor, temporaryColors);
    for (const color of [...new Set(ownedColors)]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `color ${color}`;
      const isBonus = color === own.bonusColor && !prism && !temporaryColors.includes(color) && !own.basicPalette.includes(color);
      button.textContent = isBonus ? `${COLOR_NAMES[color]}（残${own.bonusUsesRemaining}）` : COLOR_NAMES[color];
      const publicState = session.getPublicProjection();
      button.disabled = publicState.phase !== "COLOR" || (isBonus && own.bonusUsesRemaining <= 0) || (publicState.publicEffects?.[own.seat]?.seals?.[color] || 0) > 0 || targetMode !== null;
      suppressRepeatedActivation(button);
      button.onclick = () => {
        if (controlGeneration !== interactionGeneration || !button.isConnected) return;
        dispatch("COLOR_REGION", { color });
      };
      palette.appendChild(button);
    }
    privatePanel.appendChild(palette);
    const publicState = session.getPublicProjection();
    const phase = publicState.phase;
    const usedBoardColors = [...new Set(Object.values(publicState.regions).map((region) => region.color).filter((color) => Object.hasOwn(COLOR_NAMES, color)))];
    if (own.hand.colorRandomBorrow > 0) appendButton("色拾い・乱", targetMode !== null || phase !== "COLOR", () => dispatch("USE_SKILL", { skill: "colorRandomBorrow" }));
    if (own.hand.colorChoiceBorrow > 0) appendButton("色借り", targetMode !== null || phase !== "COLOR" || usedBoardColors.length === 0, () => {
      targetMode = "colorChoiceBorrow";
      say("盤面ですでに使用されている色から1色選んでください。");
      renderPrivate(own);
    });
    if (targetMode === "colorChoiceBorrow") {
      const label = document.createElement("p");
      label.textContent = "借りる色（盤面で使用済み）";
      privatePanel.appendChild(label);
      for (const color of usedBoardColors) appendButton(`借りる：${COLOR_NAMES[color]}`, false, () => {
        targetMode = null;
        dispatch("USE_SKILL", { skill: "colorChoiceBorrow", color });
      });
      appendButton("色借りをキャンセル", false, () => {
        targetMode = null;
        say("色借りの選択を解除しました。");
        renderPrivate(own);
      });
    }
    if (own.hand.colorPaletteChange > 0) appendButton("持ち色変更", targetMode !== null || phase !== "COLOR", () => {
      targetMode = { kind: "colorPaletteChange", slot: null };
      say("変更する持ち色枠を選んでください。おまけ色の残り回数は枠に残ります。");
      renderPrivate(own);
    });
    if (targetMode?.kind === "colorPaletteChange") {
      const slots = [...own.basicPalette, own.bonusColor];
      if (targetMode.slot === null) {
        const label = document.createElement("p");
        label.textContent = "変更する持ち色枠";
        privatePanel.appendChild(label);
        for (const [slot, color] of slots.entries()) appendButton(`変更枠${slot + 1}：${COLOR_NAMES[color]}${slot === 2 ? `（おまけ・残${own.bonusUsesRemaining}）` : ""}`, false, () => {
          targetMode = { kind: "colorPaletteChange", slot };
          say(`枠${slot + 1}の変更先を選んでください。重複色も選べます。`);
          renderPrivate(own);
        });
      } else {
        const currentColor = slots[targetMode.slot];
        const label = document.createElement("p");
        label.textContent = `枠${targetMode.slot + 1}の変更先（現在：${COLOR_NAMES[currentColor]}）`;
        privatePanel.appendChild(label);
        for (const color of Object.keys(COLOR_NAMES).filter((candidate) => candidate !== currentColor)) appendButton(`変更先：${COLOR_NAMES[color]}`, false, () => {
          const slot = targetMode.slot;
          targetMode = null;
          dispatch("USE_SKILL", { skill: "colorPaletteChange", slot, color });
        });
      }
      appendButton("持ち色変更をキャンセル", false, () => {
        targetMode = null;
        say("持ち色変更の選択を解除しました。");
        renderPrivate(own);
      });
    }
    if (own.hand.colorRegionSplit > 0) {
      const pendingRegion = publicState.regions[publicState.pending];
      appendButton("エリア二分", targetMode !== null || phase !== "COLOR" || !pendingRegion || (pendingRegion.sourceMacros || []).length < 2, () => {
        selected.clear();
        targetMode = { kind: "colorRegionSplit" };
        say("受取エリア上で、先に自分が彩色する側を選んでください。両側とも連結が必要です。");
        renderPublic(publicState);
        renderPrivate(own);
      });
    }
    if (targetMode?.kind === "colorRegionSplit") {
      const label = document.createElement("p");
      label.textContent = `先に彩色する側：${selected.size}マス選択中`;
      privatePanel.appendChild(label);
      appendButton("エリア二分を確定", selected.size === 0, () => {
        const regionId = publicState.pending;
        const sourceMacros = [...selected].sort((a, b) => a - b);
        dispatch("USE_SKILL", { skill: "colorRegionSplit", regionId, sourceMacros });
      });
      appendButton("エリア二分をキャンセル", false, () => {
        targetMode = null;
        selected.clear();
        session.cancelPendingActionRetry();
        say("エリア二分の選択を解除しました。");
        renderPublic(publicState);
        renderPrivate(own);
      });
    }
    appendButton("四色解放", targetMode !== null || phase !== "COLOR" || !(own.hand.colorPrism > 0), () => dispatch("USE_SKILL", { skill: "colorPrism" }));
    if (own.hand.areaMicroBloom > 0) {
      const sourceMacros = publicState.preparedOutgoing?.sourceMacros || [...selected].sort((a, b) => a - b);
      appendButton("ひとふくらみ", targetMode !== null || !["CREATE_FIRST", "WORK"].includes(phase) || sourceMacros.length !== publicState.requiredSize, () => {
        dispatch("USE_SKILL", { skill: "areaMicroBloom", sourceMacros });
      });
    }
    if (own.hand.areaCornerBloom > 0) {
      const sourceMacros = publicState.preparedOutgoing?.sourceMacros || [...selected].sort((a, b) => a - b);
      appendButton("角膨張", targetMode !== null || !["CREATE_FIRST", "WORK"].includes(phase) || sourceMacros.length !== publicState.requiredSize, () => {
        targetMode = { kind: "areaCornerBloom", sourceMacros: [...sourceMacros] };
        say("選択エリア内で、四隅を膨張させる1マスを選んでください。");
        renderPublic(publicState);
        renderPrivate(own);
      });
    }
    if (targetMode?.kind === "areaCornerBloom") appendButton("角膨張をキャンセル", false, () => {
      targetMode = null;
      session.cancelPendingActionRetry();
      say("角膨張の対象選択を解除しました。");
      renderPublic(publicState);
      renderPrivate(own);
    });
    if (own.hand.areaDiePlus > 0) {
      appendButton("エリア拡張", targetMode !== null || !["CREATE_FIRST", "WORK"].includes(phase) || Boolean(publicState.preparedOutgoing), () => {
        dispatch("USE_SKILL", { skill: "areaDiePlus" });
      });
    }
    if (own.hand.areaResize > 0 && targetMode?.kind !== "areaResize") {
      appendButton("拡大縮小", targetMode !== null || !["CREATE_FIRST", "WORK"].includes(phase) || Boolean(publicState.preparedOutgoing), () => {
        targetMode = { kind: "areaResize", mode: null };
        say("盤面を拡大するか縮小するか選んでください。");
        renderPrivate(own);
      });
    }
    if (targetMode?.kind === "areaResize") {
      if (!targetMode.mode) {
        appendButton("盤面を拡大", false, () => { targetMode = { kind: "areaResize", mode: "expand" }; renderPrivate(own); });
        appendButton("盤面を縮小", false, () => { targetMode = { kind: "areaResize", mode: "shrink" }; renderPrivate(own); });
      } else {
        const bounds = publicState.playableBounds;
        const boardWidth = bounds.maxCol - bounds.minCol + 1;
        const boardHeight = bounds.maxRow - bounds.minRow + 1;
        for (const [side, label] of [["top", "上"], ["bottom", "下"], ["left", "左"], ["right", "右"]]) {
          const vertical = side === "top" || side === "bottom";
          const unavailable = targetMode.mode === "expand"
            ? (side === "top" ? bounds.minRow === 0 : side === "bottom" ? bounds.maxRow === bounds.macroWidth - 1 : side === "left" ? bounds.minCol === 0 : bounds.maxCol === bounds.macroWidth - 1)
            : (vertical ? boardHeight <= 6 : boardWidth <= 6);
          appendButton(`${label}側を${targetMode.mode === "expand" ? "拡大" : "縮小"}`, unavailable, () => {
            dispatch("USE_SKILL", { skill: "areaResize", mode: targetMode.mode, side });
          });
        }
      }
      appendButton("拡大縮小をキャンセル", false, () => {
        targetMode = null;
        session.cancelPendingActionRetry();
        say("拡大縮小の選択を解除しました。");
        renderPrivate(own);
      });
    }
    appendButton("合法リカラー（実験貸与）", phase !== "WORK" || !(own.hand.legalRecolor > 0) || targetMode === "legalRecolor", () => {
      targetMode = "legalRecolor";
      say("彩色済みエリアを1つ選んでください。");
      renderPrivate(own);
    });
    if (targetMode === "legalRecolor") appendButton("対象選択をキャンセル", false, () => {
      targetMode = null;
      say("対象選択を解除しました。");
      renderPrivate(own);
    });
    if (own.hand.disruptChoiceOne > 0) {
      const label = document.createElement("p");
      label.textContent = "色封じ（全4色から選択）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(COLOR_NAMES[color], phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptChoiceOne", color }));
    }
    if (own.hand.disruptChoiceTwo > 0) {
      const label = document.createElement("p");
      label.textContent = "追封（全4色から選択・2彩色）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(`追封：${COLOR_NAMES[color]}`, phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptChoiceTwo", color }));
    }
    if (own.hand.disruptChoiceThree > 0) {
      const label = document.createElement("p");
      label.textContent = "長封（全4色から選択・3彩色）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(`長封：${COLOR_NAMES[color]}`, phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptChoiceThree", color }));
    }
    if (own.hand.disruptRandomOne > 0) appendButton("色封じ・乱", targetMode !== null || phase !== "WORK", () => {
      dispatch("USE_SKILL", { skill: "disruptRandomOne" });
    });
    if (own.hand.disruptRandomTwo > 0) appendButton("二重封じ・乱", targetMode !== null || phase !== "WORK", () => {
      dispatch("USE_SKILL", { skill: "disruptRandomTwo" });
    });
    if (own.hand.disruptPaletteRandom > 0) appendButton("持ち色汚染・乱", targetMode !== null || phase !== "WORK", () => {
      dispatch("USE_SKILL", { skill: "disruptPaletteRandom" });
    });
    if (own.hand.disruptPaletteChoice > 0) {
      const label = document.createElement("p");
      label.textContent = "持ち色汚染（注入色を選択・2彩色）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(`汚染：${COLOR_NAMES[color]}`, phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptPaletteChoice", color }));
    }
    if (own.hand.disruptForcedPalette > 0) {
      const label = document.createElement("p");
      label.textContent = "強制持ち替え（恒久注入色を選択）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(`強制：${COLOR_NAMES[color]}`, phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptForcedPalette", color }));
    }
    if ((own.privateEffects?.paletteDebuffs || []).length) {
      const notice = document.createElement("p");
      notice.textContent = `持ち色汚染中：残り${Math.max(...own.privateEffects.paletteDebuffs.map((effect) => effect.remaining))}彩色`;
      privatePanel.appendChild(notice);
    }
    if (own.hand.areaHalfShift > 0) {
      const controls = document.createElement("div");
      const axis = document.createElement("select");
      for (const value of ["COLUMN", "ROW"]) { const option = document.createElement("option"); option.value = value; option.textContent = value === "COLUMN" ? "縦帯" : "横帯"; axis.appendChild(option); }
      const index = document.createElement("input");
      index.type = "number"; index.min = "0"; index.max = "47"; index.value = "1"; index.setAttribute("aria-label", "基準位置");
      const direction = document.createElement("select");
      for (const value of ["plus", "minus"]) { const option = document.createElement("option"); option.value = value; option.textContent = value === "plus" ? "正方向" : "逆方向"; direction.appendChild(option); }
      const apply = document.createElement("button");
      apply.type = "button"; apply.textContent = "半マスシフトを確定"; apply.disabled = phase !== "WORK";
      suppressRepeatedActivation(apply);
      apply.onclick = () => {
        if (controlGeneration !== interactionGeneration || !apply.isConnected) return;
        dispatch("USE_SKILL", { skill: "areaHalfShift", axis: axis.value, index: Number(index.value), direction: direction.value });
      };
      controls.append(axis, index, direction, apply);
      privatePanel.appendChild(controls);
    }
    if (own.hand.areaTripleShift > 0) {
      const controls = document.createElement("div");
      const axis = document.createElement("select");
      for (const value of ["COLUMN", "ROW"]) { const option = document.createElement("option"); option.value = value; option.textContent = value === "COLUMN" ? "縦の三層" : "横の三層"; axis.appendChild(option); }
      const index = document.createElement("input");
      index.type = "number"; index.min = "1"; index.max = "10"; index.value = "2"; index.setAttribute("aria-label", "中央帯");
      const direction = document.createElement("select");
      for (const value of ["plus", "minus"]) { const option = document.createElement("option"); option.value = value; option.textContent = value === "plus" ? "正方向" : "逆方向"; direction.appendChild(option); }
      const apply = document.createElement("button");
      apply.type = "button"; apply.textContent = "三層断層を確定"; apply.disabled = phase !== "WORK" || Boolean(publicState.preparedOutgoing);
      suppressRepeatedActivation(apply);
      apply.onclick = () => {
        if (controlGeneration !== interactionGeneration || !apply.isConnected) return;
        dispatch("USE_SKILL", { skill: "areaTripleShift", axis: axis.value, index: Number(index.value), direction: direction.value });
      };
      controls.append(axis, index, direction, apply);
      privatePanel.appendChild(controls);
    }
  }

  function showHandover(projection) {
    terminalRevealController.clear();
    clearPrivate();
    renderPublic(projection.publicState);
    handoverSeat.textContent = `Player ${projection.seat}・${projection.publicState.phase}`;
    handover.hidden = false;
  }

  function renderResult(projection) {
    clearContactReveal();
    clearPrivate();
    handover.hidden = true;
    eventReveal.hidden = true;
    notice.textContent = "";
    commitRegion.disabled = true;
    surrender.disabled = true;
    const publicResult = projection.publicResult || {
      matchId: projection.matchId,
      winnerSeat: projection.winnerSeat,
      terminalReason: projection.terminalReason,
      mapCompleteWin: projection.mapCompleteWin,
    };
    const settlementSummary = projection.settlementSummary;
    const terminalPresentation = buildTerminalPresentation({
      publicResult,
      participantSnapshots: projection.participants,
      settlementStatus: settlementSummary?.status,
      settlementSummary,
    });
    terminalResultRenderer.renderStaticTerminalResult({ terminalPresentation, settlementSummary });
    return terminalPresentation;
  }

  async function settleAndRender() {
    terminalResultRenderer.setRetryBusy(true);
    const settled = await session.settle();
    renderResult(settled.projection);
  }

  function clearLoadoutSelection(seat = null) {
    for (const targetSeat of seat ? [seat] : ["A", "B"]) for (const category of LOADOUT_CATEGORIES) selectedLoadouts[targetSeat][category].clear();
  }

  function selectedStandardLoadouts() {
    return Object.fromEntries(["A", "B"].map((seat) => [seat, Object.fromEntries(LOADOUT_CATEGORIES.map((category) => [
      category,
      V49_SKILL_IDS.filter((skillId) => STANDARD_SKILLS[skillId].category === category && selectedLoadouts[seat][category].has(skillId)),
    ]))]));
  }

  function standardLoadoutComplete() {
    return ["A", "B"].every((seat) => LOADOUT_CATEGORIES.every((category) => selectedLoadouts[seat][category].size === 2));
  }

  function renderLoadoutSeat(seat, projection) {
    const select = seat === "A" ? profileA : profileB;
    const container = seat === "A" ? loadoutA : loadoutB;
    const statusNode = seat === "A" ? loadoutAStatus : loadoutBStatus;
    const profile = projection.profiles.find((entry) => entry.profileId === select.value) || null;
    container.replaceChildren();
    for (const category of LOADOUT_CATEGORIES) {
      const selected = selectedLoadouts[seat][category];
      for (const skillId of [...selected]) if (!profile?.cards[skillId] || profile.cards[skillId].available < 1 || STANDARD_SKILLS[skillId].category !== category) selected.delete(skillId);
      const fieldset = document.createElement("fieldset");
      fieldset.className = "loadout-category";
      const legend = document.createElement("legend");
      legend.textContent = `${LOADOUT_CATEGORY_NAMES[category]}（${selected.size}/2）`;
      fieldset.appendChild(legend);
      for (const skillId of V49_SKILL_IDS.filter((id) => STANDARD_SKILLS[id].category === category)) {
        const count = profile?.cards[skillId] || { owned: 0, available: 0 };
        const checked = selected.has(skillId);
        const label = document.createElement("label");
        label.className = `loadout-card${count.available < 1 ? " unavailable" : ""}`;
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = checked;
        input.disabled = count.available < 1 || (!checked && selected.size >= 2);
        input.dataset.seat = seat;
        input.dataset.category = category;
        input.dataset.skill = skillId;
        input.onchange = () => {
          if (input.checked) selected.add(skillId);
          else selected.delete(skillId);
          pendingStart = null;
          renderLoadoutBuilder(projection);
        };
        label.append(input, document.createTextNode(`${STANDARD_SKILLS[skillId].displayName}（${count.available}/${count.owned}）`));
        fieldset.appendChild(label);
      }
      container.appendChild(fieldset);
    }
    const total = LOADOUT_CATEGORIES.reduce((sum, category) => sum + selectedLoadouts[seat][category].size, 0);
    statusNode.textContent = total === 6 ? "6枚の持込を選択済み" : `各カテゴリ2枚ずつ選んでください（現在${total}/6枚）`;
  }

  function renderLoadoutBuilder(projection) {
    const standard = ruleSet.value === RULE_SET_IDS.STANDARD;
    loadoutBuilder.hidden = !standard;
    if (standard) {
      renderLoadoutSeat("A", projection);
      renderLoadoutSeat("B", projection);
    }
    const profilesReady = projection.profiles.length >= 2 && profileA.value !== profileB.value;
    startMatch.disabled = !profilesReady || (standard && !standardLoadoutComplete());
  }

  function renderSetup() {
    terminalRevealController.clear();
    const projection = session.getSetupProjection(ruleSet.value);
    handover.hidden = true;
    terminalResultRenderer.hide();
    clearPrivate();
    renderPublic(null);
    profileA.replaceChildren();
    profileB.replaceChildren();
    for (const profile of projection.profiles) {
      for (const select of [profileA, profileB]) {
        const option = document.createElement("option");
        option.value = profile.profileId;
        option.textContent = profile.displayName;
        select.appendChild(option);
      }
    }
    if (projection.profiles.length > 1) profileB.selectedIndex = 1;
    renderQuizProfiles(projection);
    renderGachaProfiles(projection);
    renderCardSaleProfiles(projection);
    renderCosmeticProfiles(projection);
    const standard = ruleSet.value === RULE_SET_IDS.STANDARD;
    const details = projection.profiles.map((profile) => standard
      ? `${profile.displayName}: 使用可能 ${Object.values(profile.cards).filter((count) => count.available > 0).length}/19枚`
      : `${profile.displayName}: ${Object.entries(profile.cards).map(([id, count]) => `${id} ${count.available}/${count.owned}`).join("・")}`).join(" / ");
    setupDetails.textContent = projection.code === "NO_LOCAL_SAVE" ? "標準モードのローカルプロフィールがありません。テストでは起動前fixtureを使用します。" : `${projection.ruleLabel} / ${details}${standard ? "" : " / legalRecolorは実験貸与"}`;
    startMatch.textContent = standard ? "熟考モード対戦を開始" : "標準α対戦を開始";
    renderLoadoutBuilder(projection);
    pendingStart = null;
  }

  function renderStage(projection) {
    const matchId = projection?.publicState?.matchId || projection?.publicResult?.matchId || projection?.matchId || null;
    terminalRevealController.activateSession(matchId);
    terminalResultRenderer.hide();
    if (projection.stage === "SETUP") renderSetup();
    else if (projection.stage === "HANDOVER") showHandover(projection);
    else if (projection.stage === "SETTLEMENT_PENDING") { renderPublic(projection.publicState); renderResult(projection); settleAndRender(); }
    else if (projection.stage === "RESULT") renderResult(projection);
    renderQuiz();
    renderGacha();
    renderCardSale();
    renderCosmetics();
  }

  suppressRepeatedActivation(startMatch);
  suppressRepeatedActivation(startQuiz);
  suppressRepeatedActivation(quizHint);
  suppressRepeatedActivation(quizNext);
  suppressRepeatedActivation(quizSaveReward);
  function settleQuizAndRender() {
    if (!quizController || !pendingQuizSettlement) return;
    const facts = quizController.settlementFacts();
    if (!facts.ok) return;
    const result = session.settleQuizReward({ ...pendingQuizSettlement, profileId: quizActorId, result: facts });
    quizRewardSaved = result.ok;
    let message;
    if (result.ok) {
      renderQuizProfiles(result.setup);
      renderGachaProfiles(result.setup);
      renderCardSaleProfiles(result.setup);
      renderGacha();
      renderCardSale();
      pendingQuizSettlement = null;
      message = result.code === "ALREADY_SETTLED" ? "報酬はすでに保存済みです。" : "報酬を保存しました。";
    } else message = `報酬を保存できません（${result.code}）。同じ処理IDで再試行できます。`;
    renderQuiz();
    quizStatus.textContent = message;
  }
  startQuiz.onclick = () => runGesture("quiz-start", () => {
    if (quizIsBlockedByMatch()) { quizStatus.textContent = "対戦中は数字ラッシュを開始できません。"; return; }
    quizActorId = quizProfile.value;
    quizActorName = quizProfile.selectedOptions[0]?.textContent || quizActorId;
    activeQuizHint = null;
    quizRewardSaved = false;
    pendingQuizSettlement = { quizSessionId: makeId("quiz"), operationId: makeId("quiz-settle") };
    quizController = createStandardQuizController({ questions: createQuestions(), selectedLevel: Number(quizLevel.value) });
    renderQuiz(quizController.begin(quizNow()).projection);
  });
  quizHint.onclick = () => runGesture(`quiz-hint:${quizController?.projection(quizNow()).questionNumber || 0}`, () => {
    if (!quizController) return;
    const result = quizController.openHint(quizNow());
    if (result.ok) activeQuizHint = result.text;
    renderQuiz(result.projection);
  });
  quizNext.onclick = () => runGesture(`quiz-next:${quizController?.projection(quizNow()).questionNumber || 0}`, () => {
    if (!quizController) return;
    activeQuizHint = null;
    const advanced = quizController.advance(quizNow());
    renderQuiz(advanced.projection);
    if (advanced.finished) settleQuizAndRender();
  });
  quizSaveReward.onclick = () => runGesture("quiz-settlement-retry", settleQuizAndRender);
  suppressRepeatedActivation(gachaDrawOne);
  suppressRepeatedActivation(gachaDrawAll);
  suppressRepeatedActivation(gachaRetry);
  gachaProfile.onchange = () => { lastGachaResults = []; renderGacha(); };
  gachaLevel.onchange = () => { lastGachaResults = []; renderGacha(); };
  gachaDrawOne.onclick = () => runGesture("gacha-draw", () => runGachaDraw(1));
  gachaDrawAll.onclick = () => runGesture("gacha-draw", () => runGachaDraw(null));
  gachaRetry.onclick = () => runGesture("gacha-retry", () => runGachaDraw());
  for (const control of [cardSaleQuote, cardSaleCommit, cardSaleCancel, cardSaleRetry]) suppressRepeatedActivation(control);
  cardSaleProfile.onchange = () => { pendingCardSale = null; cardSaleStatus.textContent = ""; renderCardSale(); };
  cardSaleSkill.onchange = () => { pendingCardSale = null; cardSaleQuantity.value = "1"; cardSaleStatus.textContent = ""; renderCardSale(); };
  cardSaleQuantity.oninput = () => { pendingCardSale = null; cardSaleStatus.textContent = ""; renderCardSale(); };
  cardSaleQuote.onclick = () => runGesture("sale-quote", prepareCardSale);
  cardSaleCommit.onclick = () => runGesture("sale-commit", commitPreparedCardSale);
  cardSaleCancel.onclick = () => runGesture("sale-cancel", cancelCardSale);
  cardSaleRetry.onclick = () => runGesture("sale-retry", commitPreparedCardSale);
  for (const control of [cosmeticCommit, cosmeticCancel, cosmeticRetry]) suppressRepeatedActivation(control);
  cosmeticProfile.onchange = () => { pendingCosmeticAction = null; cosmeticStatus.textContent = ""; renderCosmetics(); };
  cosmeticCommit.onclick = () => runGesture("cosmetic-commit", commitPreparedCosmeticAction);
  cosmeticCancel.onclick = () => runGesture("cosmetic-cancel", cancelCosmeticAction);
  cosmeticRetry.onclick = () => runGesture("cosmetic-retry", commitPreparedCosmeticAction);
  setInterval(() => {
    if (quizController?.projection(quizNow()).stage !== "QUESTION") return;
    const before = quizController.projection(quizNow());
    const after = quizController.tick(quizNow()).projection;
    if (before.resolved !== after.resolved || before.hintActive !== after.hintActive) renderQuiz(after);
    else quizTimeBar.style.width = `${Math.max(0, Math.min(100, after.remainingMs / after.question.timeMs * 100))}%`;
  }, 100);
  ruleSet.onchange = () => {
    pendingStart = null;
    clearLoadoutSelection();
    renderSetup();
  };
  profileA.onchange = () => {
    pendingStart = null;
    clearLoadoutSelection("A");
    renderLoadoutBuilder(session.getSetupProjection(ruleSet.value));
  };
  profileB.onchange = () => {
    pendingStart = null;
    clearLoadoutSelection("B");
    renderLoadoutBuilder(session.getSetupProjection(ruleSet.value));
  };
  startMatch.onclick = () => runGesture("match-start", () => {
    clearContactReveal();
    terminalRevealController.clear();
    if (profileA.value === profileB.value) { say("Player AとPlayer Bには別のプロフィールを選んでください。"); return; }
    const standard = ruleSet.value === RULE_SET_IDS.STANDARD;
    if (standard && !standardLoadoutComplete()) { say("各Playerで、色操作・エリア操作・相手妨害を2枚ずつ選んでください。"); return; }
    pendingStart ||= { matchId: makeId("match"), operationId: makeId("start") };
    const args = { profileAId: profileA.value, profileBId: profileB.value, firstSeat: firstPlayer.value, ruleSetId: ruleSet.value, ...pendingStart };
    if (standard) args.loadouts = selectedStandardLoadouts();
    const quote = standard && pendingStart.quoteIds
      ? { ok: true, quoteIds: pendingStart.quoteIds }
      : session.quoteStart(args);
    if (!quote.ok) { say(`開始できません（${quote.code}）。`); return; }
    if (standard) {
      pendingStart.quoteIds = quote.quoteIds;
      args.quoteIds = quote.quoteIds;
    }
    const result = session.startMatch(args);
    if (!result.ok) {
      if (["QUOTE_EXPIRED", "STALE_INVENTORY_REVISION", "UNKNOWN_QUOTE"].includes(result.code)) delete pendingStart.quoteIds;
      say(`開始を保存できません（${result.code}）。`);
      return;
    }
    pendingStart = null;
    renderStage(result.projection);
  });
  const revealTurn = byId("revealTurn");
  suppressRepeatedActivation(revealTurn);
  revealTurn.onclick = () => {
    if (handover.hidden) return;
    runGesture(`handover-reveal:${interactionGeneration}`, () => {
      const projection = session.getStageProjection();
      const result = session.revealPrivate(projection.seat);
      if (!result.ok) return;
      handover.hidden = true;
      revealedSeat = result.seat;
      renderPublic(session.getPublicProjection());
      renderPrivate(result.privateState);
      const paletteRevealKey = `${session.getPublicProjection().matchId}:${result.seat}`;
      if (paletteRevealEnabled.checked && !initialPaletteShown.has(paletteRevealKey)) {
        initialPaletteShown.add(paletteRevealKey);
        savePresentationPreferences();
        showReveal({ kicker: `PLAYER ${result.seat} / SECRET`, icon: "🎨", title: "最初の持ち色", detail: "基本2色＋使用回数ランダムのおまけ色", tone: "epic" });
      } else if (sizeRevealEnabled.checked && ["CREATE_FIRST", "WORK"].includes(session.getPublicProjection().phase)) {
        const current = session.getPublicProjection();
        showReveal({ kicker: "NEXT AREA", icon: "🎲", title: `${current.requiredSize}マス！`, detail: `サイコロの出目 ${current.rolledSize}`, tone: "warn" });
      }
    });
  };
  commitRegion.onclick = () => {
    const publicState = session.getPublicProjection();
    dispatch("CREATE_REGION", { sourceMacros: publicState.preparedOutgoing?.sourceMacros || [...selected] });
  };
  surrender.onclick = () => dispatch("SURRENDER");
  suppressRepeatedActivation(commitRegion);
  suppressRepeatedActivation(surrender);
  byId("eventRevealSkip").onclick = () => { eventReveal.hidden = true; };
  sizeRevealEnabled.onchange = savePresentationPreferences;
  paletteRevealEnabled.onchange = savePresentationPreferences;
  firstPlayer.onchange = () => { pendingStart = null; };
  loadPresentationPreferences();
  renderStage(session.getStageProjection());
}

module.exports = { boot };

}};const cache={};function normalize(parts){const out=[];for(const part of parts){if(!part||part===".")continue;if(part==="..")out.pop();else out.push(part);}return out.join("/");}function load(id){if(cache[id])return cache[id].exports;if(!modules[id])throw new Error("Unknown module: "+id);const module={exports:{}};cache[id]=module;const base=id.split("/").slice(0,-1);const localRequire=(request)=>{const resolved=request.startsWith(".")?normalize([...base,...request.split("/")]):request;return load(resolved);};modules[id](localRequire,module,module.exports);return module.exports;}load("standard-v5/app.js").boot();})();
