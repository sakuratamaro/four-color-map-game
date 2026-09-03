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
