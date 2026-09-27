"use strict";

const { COLORS, StandardRuleError } = require("./standard-engine.js");
const { LEARNED_TECHNIQUE_ENGINE_VERSION, supportsSplitKeep } = require("./standard-skill-registry.js");

const TECHNIQUE_ID = "techUnsealOne";
const TECHNIQUE_VERSION = "unseal-v1";
const TECHNIQUE_RULES = Object.freeze({
  DISABLED: "PVP_TECHNIQUES_DISABLED_V1",
  CPU: "CPU_LEARNED_V1",
  REN_TRIAL: "REN_UNSEAL_TRIAL_V1",
});
const clone = (value) => JSON.parse(JSON.stringify(value));
function requireTechnique(condition, code = "INVALID_TECHNIQUE_SNAPSHOT") {
  if (!condition) throw new StandardRuleError(code, code);
}
function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}
function usesTechniques(engineVersion) {
  return engineVersion === LEARNED_TECHNIQUE_ENGINE_VERSION || supportsSplitKeep(engineVersion);
}

// Internal engine input only. A server start adapter must derive these fields
// from authoritative ownership or the fixed trial template, never action payload.
function initialTechniqueFields(config, engineVersion) {
  if (!usesTechniques(engineVersion)) {
    requireTechnique(config.techniques === undefined && config.techniqueRule === undefined, "TECHNIQUE_ENGINE_UNSUPPORTED");
    return {};
  }
  const fields = {
    techniqueRule: clone(config.techniqueRule === undefined
      ? { id: TECHNIQUE_RULES.DISABLED, playerSeat: null } : config.techniqueRule),
    techniques: clone(config.techniques === undefined ? { A: null, B: null } : config.techniques),
  };
  for (const slot of Object.values(fields.techniques || {})) {
    if (slot) requireTechnique(slot.usesRemaining === 1, "INVALID_INITIAL_TECHNIQUE_USES");
  }
  return fields;
}
function validateTechniqueState(state) {
  if (!usesTechniques(state.engineVersion)) {
    requireTechnique(!Object.hasOwn(state, "techniqueRule") && !Object.hasOwn(state, "techniques"), "TECHNIQUE_ENGINE_UNSUPPORTED");
  } else {
    const rule = state.techniqueRule;
    requireTechnique(exactKeys(rule, ["id", "playerSeat"]) && Object.values(TECHNIQUE_RULES).includes(rule.id));
    requireTechnique(rule.id === TECHNIQUE_RULES.DISABLED ? rule.playerSeat === null : ["A", "B"].includes(rule.playerSeat));
    requireTechnique(exactKeys(state.techniques, ["A", "B"]));
    for (const seat of ["A", "B"]) {
      const slot = state.techniques[seat];
      if (rule.id === TECHNIQUE_RULES.DISABLED || rule.id === TECHNIQUE_RULES.CPU && seat !== rule.playerSeat) {
        requireTechnique(slot === null);
        continue;
      }
      if (slot === null && rule.id === TECHNIQUE_RULES.CPU) continue;
      const trial = rule.id === TECHNIQUE_RULES.REN_TRIAL;
      requireTechnique(exactKeys(slot, ["id", "definitionVersion", "source", "usesRemaining", ...(trial ? ["trialId", "trialVersion"] : [])]));
      requireTechnique(slot.id === TECHNIQUE_ID && slot.definitionVersion === TECHNIQUE_VERSION
        && [0, 1].includes(slot.usesRemaining) && slot.source === (trial ? "TRIAL_LOAN" : "LEARNED"));
      if (trial) requireTechnique(slot.trialId === "ren-unseal" && slot.trialVersion === 1);
    }
  }
  for (const seat of ["A", "B"]) {
    requireTechnique(!Object.hasOwn(state.hands?.[seat] || {}, TECHNIQUE_ID)
      && !Object.values(state.loadouts?.[seat] || {}).some((ids) => Array.isArray(ids) && ids.includes(TECHNIQUE_ID)),
    "TECHNIQUE_IN_ORDINARY_HAND");
  }
  return true;
}
function projectTechniques(state) {
  return Object.fromEntries(["A", "B"].map((seat) => {
    const slot = state.techniques[seat];
    return [seat, slot === null ? null : { id: slot.id, definitionVersion: slot.definitionVersion, usesRemaining: slot.usesRemaining }];
  }));
}
function techniqueAvailable(state, actor, id) {
  return usesTechniques(state.engineVersion) && state.techniques?.[actor]?.id === id
    && state.techniques[actor].usesRemaining === 1;
}
function applyTechUnsealOne({ state, actor, payload }) {
  if (!techniqueAvailable(state, actor, TECHNIQUE_ID)) return { ok: false, code: "TECHNIQUE_UNAVAILABLE", state };
  const color = payload.color;
  if (!COLORS.includes(color)) return { ok: false, code: "INVALID_TARGET_SCHEMA", state };
  if (![...state.basicPalettes[actor], state.bonusColors[actor]].includes(color)) {
    return { ok: false, code: "TECHNIQUE_COLOR_NOT_OWNED", state };
  }
  const seal = state.publicEffects?.[actor]?.seals?.[color];
  if (!Number.isSafeInteger(seal) || seal <= 0) return { ok: false, code: "TECHNIQUE_COLOR_NOT_SEALED", state };
  const next = clone(state);
  next.publicEffects[actor].seals[color] = 0;
  next.techniques[actor].usesRemaining = 0;
  next.skillsUsed[actor] = (next.skillsUsed[actor] || 0) + 1;
  next.version += 1;
  next.publicLog.push("T" + next.turn + " Player " + actor + " used learned technique 解封.");
  return Object.freeze({ ok: true, code: "OK", state: next, cardConsumed: false, techniqueConsumed: true });
}
module.exports = {
  TECHNIQUE_ID, TECHNIQUE_VERSION, TECHNIQUE_RULES, usesTechniques,
  initialTechniqueFields, validateTechniqueState, projectTechniques, techniqueAvailable, applyTechUnsealOne,
};
