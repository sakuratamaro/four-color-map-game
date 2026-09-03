"use strict";

const { COLORS, adjacentRegionIds, legalRecolorCandidates } = require("./standard-engine.js");
const { V49_SKILL_IDS } = require("./standard-skill-registry.js");
const {
  cornerBloomPlan,
  microBloomCandidates,
  planHalfShift,
  planTripleShift,
} = require("./standard-skill-handlers.js");

const LEVELS = Object.freeze(["easy", "normal", "hard"]);
const POLICY_VERSIONS = Object.freeze({
  easy: "standard-easy-v1-random-safe",
  normal: "standard-normal-v1-contact-safe",
  hard: "standard-hard-v2-color-pressure-safe",
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

function makeObservation({ publicState, ownPrivateState, difficulty = "normal" }) {
  if (!LEVELS.includes(difficulty)) throw new TypeError("INVALID_CPU_DIFFICULTY");
  if (!publicState || !ownPrivateState || publicState.active !== ownPrivateState.seat) throw new TypeError("INVALID_CPU_OBSERVATION");
  return deepFreeze({
    difficulty,
    policyVersion: POLICY_VERSIONS[difficulty],
    publicState: clone(publicState),
    ownPrivateState: clone(ownPrivateState),
  });
}

function neighbors(macro, width) {
  const col = macro % width;
  const result = [macro - width, macro + width];
  if (col > 0) result.push(macro - 1);
  if (col < width - 1) result.push(macro + 1);
  return result;
}

function playableMacros(bounds) {
  const result = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) result.push(row * bounds.macroWidth + col);
  }
  return result;
}

function enumerateRegionActions(publicState, limit = 64, requiredSize = publicState.requiredSize, allowDetached = false) {
  const bounds = publicState.playableBounds;
  const width = bounds.macroWidth;
  const needed = requiredSize;
  if (!Number.isInteger(needed) || needed < 1) return [];
  if (publicState.preparedOutgoing) {
    const sourceMacros = [...publicState.preparedOutgoing.sourceMacros];
    return sourceMacros.length === needed
      ? [{ type: "CREATE_REGION", payload: { sourceMacros }, metrics: { contacts: 0, colorPressure: 0, prepared: true } }]
      : [];
  }
  const scale = bounds.microScale;
  const microWidth = bounds.macroWidth * scale;
  const macrosFromRegion = (region) => [...new Set([
    ...(region.sourceMacros || []),
    ...(region.micro || []).map((cell) => Math.floor(Math.floor(cell / microWidth) / scale) * bounds.macroWidth + Math.floor((cell % microWidth) / scale)),
  ])];
  const occupied = new Set(Object.values(publicState.regions || {}).flatMap(macrosFromRegion));
  const sourceOccupied = new Set(Object.values(publicState.regions || {}).flatMap((region) => region.sourceMacros || []));
  const macroOwner = new Map();
  for (const region of Object.values(publicState.regions || {})) {
    for (const macro of region.sourceMacros || []) macroOwner.set(macro, region.id);
  }
  const free = playableMacros(bounds).filter((macro) => !occupied.has(macro));
  const freeSet = new Set(free);
  const hasMap = occupied.size > 0;
  const starts = hasMap && !allowDetached ? free.filter((macro) => neighbors(macro, width).some((next) => sourceOccupied.has(next))) : free;
  const found = new Map();

  function visit(selected, frontier) {
    if (found.size >= limit) return;
    if (selected.size === needed) {
      const sourceMacros = [...selected].sort((a, b) => a - b);
      const contacts = sourceMacros.reduce((sum, macro) => sum + neighbors(macro, width).filter((next) => sourceOccupied.has(next)).length, 0);
      const colors = new Set();
      for (const macro of sourceMacros) {
        for (const next of neighbors(macro, width)) {
          const regionId = macroOwner.get(next);
          const color = regionId ? publicState.regions[regionId]?.color : null;
          if (color) colors.add(color);
        }
      }
      if (!hasMap || allowDetached || contacts > 0) found.set(sourceMacros.join(","), { type: "CREATE_REGION", payload: { sourceMacros }, metrics: { contacts, colorPressure: colors.size } });
      return;
    }
    for (const macro of [...frontier].sort((a, b) => a - b)) {
      const nextSelected = new Set(selected).add(macro);
      const nextFrontier = new Set(frontier);
      nextFrontier.delete(macro);
      for (const next of neighbors(macro, width)) if (freeSet.has(next) && !nextSelected.has(next)) nextFrontier.add(next);
      visit(nextSelected, nextFrontier);
      if (found.size >= limit) return;
    }
  }

  for (const start of starts) {
    visit(new Set([start]), new Set(neighbors(start, width).filter((macro) => freeSet.has(macro))));
    if (found.size >= limit) break;
  }
  return [...found.values()];
}

function availableColors(publicState, ownPrivateState) {
  const colors = [...ownPrivateState.basicPalette];
  if (ownPrivateState.bonusUsesRemaining > 0) colors.push(ownPrivateState.bonusColor);
  if (ownPrivateState.privateEffects?.prism) colors.push("red", "blue", "yellow", "green");
  const seals = publicState.publicEffects?.[ownPrivateState.seat]?.seals || {};
  return [...new Set(colors)].filter((color) => !(seals[color] > 0));
}

function enumerateColorActions(publicState, ownPrivateState) {
  const blocked = new Set(adjacentRegionIds(publicState, publicState.pending).map((id) => publicState.regions[id]?.color).filter(Boolean));
  const safe = availableColors(publicState, ownPrivateState).filter((color) => !blocked.has(color));
  return safe.length
    ? safe.map((color) => ({ type: "COLOR_REGION", payload: { color }, metrics: { blockedCount: blocked.size } }))
    : [{ type: "DECLARE_NO_COLOR", payload: {}, metrics: { blockedCount: blocked.size } }];
}

function skillAction(skill, payload = {}, metrics = {}) {
  return { type: "USE_SKILL", payload: { skill, ...payload }, metrics: { skillPriority: 1, ...metrics } };
}

function planningState(publicState) {
  return {
    ...publicState,
    microWidth: publicState.playableBounds.macroWidth * publicState.playableBounds.microScale,
  };
}

function connectedMacros(macros, width) {
  if (!macros.length) return false;
  const remaining = new Set(macros);
  const queue = [macros[0]];
  remaining.delete(macros[0]);
  while (queue.length) {
    const macro = queue.shift();
    for (const next of neighbors(macro, width)) if (remaining.delete(next)) queue.push(next);
  }
  return remaining.size === 0;
}

function splitSelections(region, width) {
  const macros = [...new Set(region.sourceMacros || [])].sort((a, b) => a - b);
  const results = [];
  const fullMask = (1 << macros.length) - 1;
  for (let mask = 1; mask < fullMask; mask += 1) {
    if (!(mask & 1)) continue;
    const selected = macros.filter((_, index) => mask & (1 << index));
    const returned = macros.filter((_, index) => !(mask & (1 << index)));
    if (connectedMacros(selected, width) && connectedMacros(returned, width)) results.push(selected);
  }
  return results;
}

function availableHand(ownPrivateState, skill) {
  return (ownPrivateState.hand?.[skill] || 0) > 0;
}

function enumerateColorSkillActions(publicState, ownPrivateState) {
  const actions = [];
  const boardColors = [...new Set(Object.values(publicState.regions || {}).map((region) => region.color).filter(Boolean))];
  if (availableHand(ownPrivateState, "colorRandomBorrow") && boardColors.length) actions.push(skillAction("colorRandomBorrow", {}, { skillPriority: 18 }));
  if (availableHand(ownPrivateState, "colorChoiceBorrow")) {
    for (const color of boardColors) actions.push(skillAction("colorChoiceBorrow", { color }, { skillPriority: 20 }));
  }
  if (availableHand(ownPrivateState, "colorPrism")) actions.push(skillAction("colorPrism", {}, { skillPriority: 24 }));
  if (availableHand(ownPrivateState, "colorPaletteChange")) {
    const palette = [...ownPrivateState.basicPalette, ownPrivateState.bonusColor];
    for (let slot = 0; slot < palette.length; slot += 1) {
      for (const color of COLORS) if (color !== palette[slot]) actions.push(skillAction("colorPaletteChange", { slot, color }, { skillPriority: 12 }));
    }
  }
  if (availableHand(ownPrivateState, "colorRegionSplit")) {
    const region = publicState.regions?.[publicState.pending];
    if (region && !(region.controllers || []).includes(ownPrivateState.seat)) {
      for (const sourceMacros of splitSelections(region, publicState.playableBounds.macroWidth)) {
        actions.push(skillAction("colorRegionSplit", { regionId: region.id, sourceMacros }, { skillPriority: 30, splitSize: sourceMacros.length }));
      }
    }
  }
  return actions;
}

function enumerateShiftActions(publicState, ownPrivateState, skill, planner) {
  if (!availableHand(ownPrivateState, skill) || publicState.preparedOutgoing) return [];
  const state = planningState(publicState);
  const actions = [];
  for (const axis of ["ROW", "COLUMN"]) {
    for (let index = 0; index < publicState.playableBounds.macroWidth; index += 1) {
      for (const direction of ["minus", "plus"]) {
        const payload = { axis, index, direction };
        const plan = planner(state, payload);
        if (plan.ok) actions.push(skillAction(skill, payload, { skillPriority: 14 + Math.min(6, plan.movedCount || 0), movedCount: plan.movedCount || 0 }));
      }
    }
  }
  return actions;
}

function enumerateWorkSkillActions(publicState, ownPrivateState) {
  const actions = [];
  const state = planningState(publicState);
  const outgoing = enumerateRegionActions(publicState, 96, publicState.requiredSize, true);
  if (availableHand(ownPrivateState, "areaMicroBloom")) {
    for (const action of outgoing) {
      const sourceMacros = action.payload.sourceMacros;
      if (microBloomCandidates(state, sourceMacros).candidates.length) actions.push(skillAction("areaMicroBloom", { sourceMacros }, { skillPriority: 22 }));
    }
  }
  if (availableHand(ownPrivateState, "areaCornerBloom")) {
    for (const action of outgoing) {
      const sourceMacros = action.payload.sourceMacros;
      for (const macro of sourceMacros) {
        const planned = cornerBloomPlan(state, sourceMacros, macro);
        if (planned.plan.length && preparedTouchesColoredRegion(state, planned.micro)) actions.push(skillAction("areaCornerBloom", { sourceMacros, macro }, { skillPriority: 20 }));
      }
    }
  }
  if (availableHand(ownPrivateState, "areaDiePlus") && !publicState.preparedOutgoing && publicState.requiredSize < 5
      && enumerateRegionActions(publicState, 1, publicState.requiredSize + 1).length) {
    actions.push(skillAction("areaDiePlus", {}, { skillPriority: 16 }));
  }
  if (availableHand(ownPrivateState, "areaResize") && !publicState.preparedOutgoing) {
    const bounds = publicState.playableBounds;
    const width = bounds.maxCol - bounds.minCol + 1;
    const height = bounds.maxRow - bounds.minRow + 1;
    for (const side of ["top", "bottom", "left", "right"]) {
      const canExpand = side === "left" ? bounds.minCol > 0 : side === "right" ? bounds.maxCol < bounds.macroWidth - 1 : side === "top" ? bounds.minRow > 0 : bounds.maxRow < bounds.macroWidth - 1;
      const canShrink = ["left", "right"].includes(side) ? width > 6 : height > 6;
      if (canExpand) actions.push(skillAction("areaResize", { mode: "expand", side }, { skillPriority: 10 }));
      if (canShrink) actions.push(skillAction("areaResize", { mode: "shrink", side }, { skillPriority: 8 }));
    }
  }
  actions.push(...enumerateShiftActions(publicState, ownPrivateState, "areaHalfShift", planHalfShift));
  actions.push(...enumerateShiftActions(publicState, ownPrivateState, "areaTripleShift", planTripleShift));

  for (const skill of ["disruptRandomOne", "disruptRandomTwo", "disruptPaletteRandom"]) {
    if (availableHand(ownPrivateState, skill)) actions.push(skillAction(skill, {}, { skillPriority: 17 }));
  }
  for (const skill of ["disruptChoiceOne", "disruptChoiceTwo", "disruptChoiceThree", "disruptPaletteChoice", "disruptForcedPalette"]) {
    if (availableHand(ownPrivateState, skill)) for (const color of COLORS) actions.push(skillAction(skill, { color }, { skillPriority: 19 }));
  }
  if (availableHand(ownPrivateState, "legalRecolor") && !publicState.interferenceLock) {
    for (const region of Object.values(publicState.regions || {}).filter((entry) => entry.color && !entry.isPending)) {
      const candidates = legalRecolorCandidates(publicState, region.id).length;
      if (candidates > 0) actions.push(skillAction("legalRecolor", { regionId: region.id }, { skillPriority: 15, candidates, degree: adjacentRegionIds(publicState, region.id).length }));
    }
  }
  return actions;
}

function preparedTouchesColoredRegion(state, micro) {
  const shape = new Set(micro);
  const colored = new Set(Object.values(state.regions || {}).filter((region) => region.color).flatMap((region) => region.micro || []));
  for (const cell of shape) {
    const x = cell % state.microWidth;
    const adjacent = [cell - state.microWidth, cell + state.microWidth];
    if (x > 0) adjacent.push(cell - 1);
    if (x < state.microWidth - 1) adjacent.push(cell + 1);
    if (adjacent.some((neighbor) => !shape.has(neighbor) && colored.has(neighbor))) return true;
  }
  return false;
}

function enumerateCpuActions(observation) {
  const { publicState, ownPrivateState } = observation;
  if (publicState.status === "FINISHED" || publicState.active !== ownPrivateState.seat) return Object.freeze([]);
  let actions = [];
  if (publicState.phase === "COLOR") actions = [...enumerateColorActions(publicState, ownPrivateState), ...enumerateColorSkillActions(publicState, ownPrivateState)];
  else if (publicState.phase === "CREATE_FIRST" || publicState.phase === "WORK") actions = [...enumerateRegionActions(publicState), ...enumerateWorkSkillActions(publicState, ownPrivateState)];
  if (!actions.length) actions = [{ type: "SURRENDER", payload: {}, metrics: { fallback: true } }];
  return deepFreeze(actions);
}

function chooseIndex(length, random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError("INVALID_CPU_RANDOM");
  return Math.min(length - 1, Math.floor(value * length));
}

function chooseCpuAction({ observation, random, tieBreakRandom = random }) {
  const actions = enumerateCpuActions(observation);
  if (!actions.length) return null;
  if (observation.difficulty === "easy" || observation.publicState.phase === "COLOR") return actions[chooseIndex(actions.length, random)];
  const scored = actions.map((action) => ({
    action,
    score: action.type === "USE_SKILL"
      ? (observation.difficulty === "hard"
        ? (action.metrics.skillPriority || 0) * 10 + (action.metrics.degree || 0) * 2 + (action.metrics.candidates || 0)
        : (action.metrics.skillPriority || 0))
      : action.type === "CREATE_REGION"
        ? (observation.difficulty === "hard" ? action.metrics.colorPressure * 100 + action.metrics.contacts : action.metrics.contacts * 2)
        : -1000,
  }));
  const best = Math.max(...scored.map((entry) => entry.score));
  const finalists = scored.filter((entry) => entry.score === best).map((entry) => entry.action);
  return finalists[chooseIndex(finalists.length, tieBreakRandom)];
}

module.exports = {
  LEVELS,
  POLICY_VERSIONS,
  chooseCpuAction,
  enumerateCpuActions,
  makeObservation,
  V49_SKILL_IDS,
};
