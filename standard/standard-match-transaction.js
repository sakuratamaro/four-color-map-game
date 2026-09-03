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
