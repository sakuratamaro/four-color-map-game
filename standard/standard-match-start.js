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
