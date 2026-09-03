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
