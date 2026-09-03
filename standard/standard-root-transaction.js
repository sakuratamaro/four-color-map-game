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
