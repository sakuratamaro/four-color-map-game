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
