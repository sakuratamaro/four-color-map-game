"use strict";

const { createStream } = require("./standard-engine.js");
const match = require("./standard-match.js");
const save = require("./standard-save.js");
const { SKILL_RESULT, dispatchStandardSkillAction } = require("./standard-skill-dispatcher.js");

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function actionFingerprint(actor, action) {
  return JSON.stringify(canonical({ actor, expectedVersion: action.expectedVersion, type: action.type, payload: action.payload }));
}

function snapshotRngStreams(rngStreams) {
  return Object.fromEntries(Object.entries(rngStreams).map(([name, stream]) => {
    if (!stream || typeof stream.snapshot !== "function") throw new Error(`TRANSACTIONAL_RNG_REQUIRED_${name.toUpperCase().replaceAll("-", "_")}`);
    return [name, stream.snapshot()];
  }));
}

function cloneRngStreams(rngStreams) {
  return Object.freeze(Object.fromEntries(Object.entries(snapshotRngStreams(rngStreams)).map(([name, snapshot]) => [name, createStream(snapshot)])));
}

function dispatchStandardSkillTransaction({ root, actor, action, rngStreams, storage }) {
  save.validateStandardSave(root);
  if (!action || typeof action.id !== "string" || !action.id.length) {
    return Object.freeze({ ok: false, status: SKILL_RESULT.REJECTED, code: "ACTION_ID_REQUIRED", root, rngStreams, saved: false });
  }
  const state = root.activeMatch?.state;
  if (!state) return Object.freeze({ ok: false, status: SKILL_RESULT.REJECTED, code: "NO_ACTIVE_MATCH", root, rngStreams, saved: false });
  const fingerprint = actionFingerprint(actor, action);
  const receipt = root.receipts.matchConsumption[`${state.matchId}:${action.id}`];
  if (receipt) {
    if (receipt.actionFingerprint !== fingerprint) return Object.freeze({ ok: false, status: SKILL_RESULT.REJECTED, code: "ACTION_ID_COLLISION", root, rngStreams, saved: false });
    return Object.freeze({
      ok: true,
      status: SKILL_RESULT.RESOLVED,
      code: "IDEMPOTENT_REPLAY",
      root,
      rngStreams,
      saved: false,
      publicState: match.projectStandardPublicState(root.activeMatch.state),
      privateState: match.projectStandardPrivateState(root.activeMatch.state, actor),
    });
  }

  const workingRng = cloneRngStreams(rngStreams);
  const result = dispatchStandardSkillAction({
    state,
    actor,
    action,
    expectedVersion: action.expectedVersion,
    rngStreams: workingRng,
    validateState: match.validateStandardState,
    projectPublic: match.projectStandardPublicState,
    projectPrivate: match.projectStandardPrivateState,
  });
  if (!result.ok) return Object.freeze({ ...result, root, rngStreams, saved: false });

  const rngSnapshot = snapshotRngStreams(workingRng);
  const nextRoot = save.commitAcceptedCardAction({
    root,
    beforeState: state,
    result,
    actor,
    actionId: action.id,
    actionFingerprint: fingerprint,
    rngSnapshot,
  });
  save.persistStandardSave(storage, nextRoot);
  return Object.freeze({ ...result, root: nextRoot, rngStreams: workingRng, saved: true });
}

module.exports = { actionFingerprint, dispatchStandardSkillTransaction, snapshotRngStreams };
