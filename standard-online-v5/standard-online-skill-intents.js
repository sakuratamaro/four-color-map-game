(function initStandardOnlineSkillIntents(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardOnlineSkillIntents = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function standardOnlineSkillIntentFactory() {
  "use strict";

  const COLORS = Object.freeze(["red", "blue", "yellow", "green"]);
  const TARGET_KIND = Object.freeze({
    colorRandomBorrow: "none",
    colorChoiceBorrow: "color",
    colorPrism: "none",
    colorRegionSplit: "region-split",
    colorPaletteChange: "slot-color",
    areaMicroBloom: "source-macros",
    areaDiePlus: "none",
    areaResize: "resize",
    areaCornerBloom: "corner-bloom",
    areaHalfShift: "band-shift",
    areaTripleShift: "band-shift",
    disruptRandomOne: "none",
    disruptChoiceOne: "color",
    disruptRandomTwo: "none",
    disruptPaletteRandom: "none",
    disruptChoiceTwo: "color",
    disruptPaletteChoice: "color",
    disruptChoiceThree: "color",
    disruptForcedPalette: "color",
  });

  function invalid() { throw Object.assign(new Error("INVALID_SKILL_TARGET"), { code: "INVALID_SKILL_TARGET" }); }
  function color(value) { if (!COLORS.includes(value)) invalid(); return value; }
  function integer(value) { if (!Number.isSafeInteger(value) || value < 0) invalid(); return value; }
  function macros(value) {
    if (!Array.isArray(value) || !value.length || value.some((entry) => !Number.isSafeInteger(entry) || entry < 0) || new Set(value).size !== value.length) invalid();
    return [...value].sort((a, b) => a - b);
  }
  function regionId(value) { if (typeof value !== "string" || !/^R[1-9][0-9]*$/.test(value)) invalid(); return value; }

  function availableColorChoices(privateState = {}) {
    const choices = new Set(Array.isArray(privateState.basicPalette) ? privateState.basicPalette : []);
    if (privateState.bonusUsesRemaining > 0) choices.add(privateState.bonusColor);
    for (const color of privateState.privateEffects?.temporaryColors || []) choices.add(color);
    if (privateState.privateEffects?.prism) for (const color of COLORS) choices.add(color);
    return Object.freeze(COLORS.filter((color) => choices.has(color)));
  }

  function buildSkillPayload(skill, input = {}) {
    const kind = TARGET_KIND[skill];
    if (!kind) throw Object.assign(new Error("UNKNOWN_STANDARD_SKILL"), { code: "UNKNOWN_STANDARD_SKILL" });
    if (kind === "none") return Object.freeze({ skill });
    if (kind === "color") return Object.freeze({ skill, color: color(input.color) });
    if (kind === "slot-color") {
      if (![0, 1, 2].includes(input.slot)) invalid();
      return Object.freeze({ skill, slot: input.slot, color: color(input.color) });
    }
    if (kind === "source-macros") return Object.freeze({ skill, sourceMacros: macros(input.sourceMacros) });
    if (kind === "region-split") return Object.freeze({ skill, regionId: regionId(input.regionId), sourceMacros: macros(input.sourceMacros) });
    if (kind === "corner-bloom") return Object.freeze({ skill, sourceMacros: macros(input.sourceMacros), macro: integer(input.macro) });
    if (kind === "resize") {
      if (!["expand", "shrink"].includes(input.mode) || !["top", "right", "bottom", "left"].includes(input.side)) invalid();
      return Object.freeze({ skill, mode: input.mode, side: input.side });
    }
    if (kind === "band-shift") {
      if (!["ROW", "COLUMN"].includes(input.axis) || !["minus", "plus"].includes(input.direction)) invalid();
      return Object.freeze({ skill, axis: input.axis, index: integer(input.index), direction: input.direction });
    }
    invalid();
  }

  return Object.freeze({ COLORS, TARGET_KIND, availableColorChoices, buildSkillPayload, isImmediate: (skill) => TARGET_KIND[skill] === "none" });
});
