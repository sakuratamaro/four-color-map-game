"use strict";

const { StandardRuleError } = require("./standard-engine.js");
const { supportsSplitKeep, SKILL_USAGE_CATEGORIES } = require("./standard-skill-registry.js");

function connectedMacros(macros, width) {
  const remaining = new Set(macros), queue = [macros[0]];
  remaining.delete(macros[0]);
  while (queue.length) {
    const m = queue.pop(), col = m % width;
    for (const n of [m-width,m+width,...(col>0?[m-1]:[]),...(col<width-1?[m+1]:[])]) {
      if (remaining.delete(n)) queue.push(n);
    }
  }
  return remaining.size === 0;
}

function sameDesignation(state, macros) {
  const retry = state.redesignation;
  return retry?.stage === "RESELECT"
    && [...macros].sort((a, b) => a - b).join(",") === retry.sourceMacros.join(",");
}

// Entirely public obligation state. No palette, hand, history snapshot or RNG.
function validateRedesignation(state) {
  if (!Object.hasOwn(state, "redesignation")) return;
  const r = state.redesignation, b = state.playableBounds;
  const valid = supportsSplitKeep(state.engineVersion) && r && typeof r === "object" && !Array.isArray(r)
    && Object.keys(r).sort().join("|") === "designator|receiver|receiverCategories|sourceMacros|stage"
    && ["A", "B"].includes(r.designator) && ["A", "B"].includes(r.receiver) && r.designator !== r.receiver
    && ["RESELECT", "COLOR"].includes(r.stage) && state.status === "ACTIVE"
    && !state.reserved && !state.retainedSplit && !state.preparedOutgoing
    && Array.isArray(r.sourceMacros) && r.sourceMacros.length === state.requiredSize
    && r.sourceMacros.every((m, i) => Number.isSafeInteger(m) && m >= 0
      && (i === 0 || r.sourceMacros[i - 1] < m)
      && m % b.macroWidth >= b.minCol && m % b.macroWidth <= b.maxCol
      && Math.floor(m / b.macroWidth) >= b.minRow && Math.floor(m / b.macroWidth) <= b.maxRow)
    && connectedMacros(r.sourceMacros, b.macroWidth)
    && Array.isArray(r.receiverCategories) && r.receiverCategories.includes("color")
    && new Set(r.receiverCategories).size === r.receiverCategories.length
    && r.receiverCategories.every(c => SKILL_USAGE_CATEGORIES.includes(c))
    && (r.stage === "RESELECT"
      ? state.active === r.designator && state.phase === "WORK" && state.pending === null
      : state.active === r.receiver && state.phase === "COLOR" && Boolean(state.pending)
        && state.regions[state.pending]?.sourceMacros?.length === state.requiredSize
        && state.regions[state.pending]?.controllers?.length === 1 && state.regions[state.pending].controllers[0] === r.designator
        && [...state.regions[state.pending].sourceMacros].sort((a,b)=>a-b).join(",") !== r.sourceMacros.join(",")
        && JSON.stringify(state.skillCategoryWindow?.categories) === JSON.stringify(r.receiverCategories));
  if (!valid) throw new StandardRuleError("INVALID_REDESIGNATION", "Invalid region redesignation obligation");
}

module.exports = { sameDesignation, validateRedesignation };
