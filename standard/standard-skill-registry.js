"use strict";

function skill(id, displayName, category, rarity, timing, options = {}) {
  const implemented = Boolean(options.implemented);
  const v49Catalogued = options.v49Catalogued !== false;
  return Object.freeze({
    id,
    displayName,
    category,
    rarity,
    timing,
    targetSchema: options.targetSchema ?? null,
    implemented,
    standardEngineImplemented: implemented,
    alphaUiEnabled: Boolean(options.alphaUiEnabled),
    standardUiEnabled: options.standardUiEnabled === undefined ? implemented && v49Catalogued : Boolean(options.standardUiEnabled),
    gachaEnabled: options.gachaEnabled !== false,
    experimental: Boolean(options.experimental),
    privateInformationEffect: Boolean(options.privateInformationEffect),
    rngStream: options.rngStream ?? null,
    expectedRngDraws: options.expectedRngDraws ?? 0,
    consumptionPolicy: options.consumptionPolicy || "RESOLVED_V49",
    handlerVersion: options.handlerVersion ?? null,
    v49Catalogued,
  });
}

const STANDARD_SKILLS = Object.freeze({
  colorRandomBorrow: skill("colorRandomBorrow", "色拾い・乱", "color", 1, "COLOR", {
    implemented: true,
    privateInformationEffect: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    consumptionPolicy: "RESOLVED_ONLY_NO_CANDIDATE_REJECTED",
    handlerVersion: "color-random-borrow-v1",
  }),
  colorChoiceBorrow: skill("colorChoiceBorrow", "色借り", "color", 2, "COLOR", {
    targetSchema: { color: "color-id" },
    implemented: true,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_ONLY_VALID_BOARD_COLOR",
    handlerVersion: "color-choice-borrow-v1",
  }),
  colorPrism: skill("colorPrism", "四色解放", "color", 3, "COLOR", { implemented: true, handlerVersion: "color-prism-v1" }),
  colorRegionSplit: skill("colorRegionSplit", "エリア二分", "color", 4, "COLOR", {
    targetSchema: { regionId: "region-id", sourceMacros: "macro-index-array" },
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_CONNECTED_BIPARTITION",
    handlerVersion: "color-region-split-v1",
  }),
  colorPaletteChange: skill("colorPaletteChange", "持ち色変更", "color", 5, "COLOR", {
    targetSchema: { slot: "palette-slot", color: "color-id" },
    implemented: true,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_ONLY_CHANGED_SLOT",
    handlerVersion: "color-palette-change-v1",
  }),
  areaMicroBloom: skill("areaMicroBloom", "ひとふくらみ", "area", 1, "WORK", {
    targetSchema: { sourceMacros: "macro-index-array" },
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    consumptionPolicy: "RESOLVED_ONLY_POINT_CONTACT_CANDIDATE",
    handlerVersion: "area-micro-bloom-v1",
  }),
  areaDiePlus: skill("areaDiePlus", "エリア拡張", "area", 2, "WORK", {
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_LEGAL_SIZE_PLUS_ONE",
    handlerVersion: "area-die-plus-v1",
  }),
  areaResize: skill("areaResize", "拡大縮小", "area", 3, "WORK", {
    targetSchema: { mode: "expand-or-shrink", side: "board-side" },
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_AVAILABLE_BOARD_SIDE",
    handlerVersion: "area-resize-v1",
  }),
  areaCornerBloom: skill("areaCornerBloom", "角膨張", "area", 4, "WORK", {
    targetSchema: { sourceMacros: "macro-index-array", macro: "macro-index" },
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_AVAILABLE_CORNER_EXPANSION",
    handlerVersion: "area-corner-bloom-v1",
  }),
  areaHalfShift: skill("areaHalfShift", "半マスシフト", "area", 4, "WORK", { targetSchema: { axis: "row-or-column", index: "integer", direction: "minus-or-plus" }, implemented: true, handlerVersion: "area-half-shift-v1" }),
  areaTripleShift: skill("areaTripleShift", "三層断層", "area", 5, "WORK", {
    targetSchema: { axis: "row-or-column", index: "integer", direction: "minus-or-plus" },
    implemented: true,
    consumptionPolicy: "RESOLVED_ONLY_CONNECTED_THREE_BAND_SHIFT",
    handlerVersion: "area-triple-shift-v1",
  }),
  disruptRandomOne: skill("disruptRandomOne", "色封じ・乱", "disrupt", 1, "WORK", {
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    consumptionPolicy: "RESOLVED_RANDOM_COLOR_INCLUDING_MISS",
    handlerVersion: "disrupt-random-one-v1",
  }),
  disruptChoiceOne: skill("disruptChoiceOne", "色封じ", "disrupt", 2, "WORK", { targetSchema: { color: "color-id" }, privateInformationEffect: true, implemented: true, handlerVersion: "disrupt-choice-one-v1" }),
  disruptRandomTwo: skill("disruptRandomTwo", "二重封じ・乱", "disrupt", 3, "WORK", {
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 2,
    consumptionPolicy: "RESOLVED_TWO_DISTINCT_RANDOM_COLORS_INCLUDING_MISS",
    handlerVersion: "disrupt-random-two-v1",
  }),
  disruptPaletteRandom: skill("disruptPaletteRandom", "持ち色汚染・乱", "disrupt", 3, "WORK", {
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 2,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_RANDOM_COLOR_AND_PRIVATE_SLOT",
    handlerVersion: "disrupt-palette-random-v1",
  }),
  disruptChoiceTwo: skill("disruptChoiceTwo", "追封", "disrupt", 4, "WORK", {
    targetSchema: { color: "color-id" },
    privateInformationEffect: true,
    implemented: true,
    consumptionPolicy: "RESOLVED_CHOSEN_COLOR_TWO_COLORINGS",
    handlerVersion: "disrupt-choice-two-v1",
  }),
  disruptPaletteChoice: skill("disruptPaletteChoice", "持ち色汚染", "disrupt", 4, "WORK", {
    targetSchema: { color: "color-id" },
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_CHOSEN_COLOR_AND_PRIVATE_RANDOM_SLOT",
    handlerVersion: "disrupt-palette-choice-v1",
  }),
  disruptChoiceThree: skill("disruptChoiceThree", "長封", "disrupt", 5, "WORK", {
    targetSchema: { color: "color-id" },
    privateInformationEffect: true,
    implemented: true,
    consumptionPolicy: "RESOLVED_CHOSEN_COLOR_THREE_COLORINGS",
    handlerVersion: "disrupt-choice-three-v1",
  }),
  disruptForcedPalette: skill("disruptForcedPalette", "強制持ち替え", "disrupt", 5, "WORK", {
    targetSchema: { color: "color-id" },
    implemented: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    privateInformationEffect: true,
    consumptionPolicy: "RESOLVED_CHOSEN_COLOR_AND_PRIVATE_RANDOM_SLOT_PERMANENT",
    handlerVersion: "disrupt-forced-palette-v1",
  }),
  legalRecolor: skill("legalRecolor", "塗り直し・乱", "experimental", 3, "WORK", {
    targetSchema: { regionId: "region-id" },
    implemented: true,
    alphaUiEnabled: true,
    gachaEnabled: false,
    experimental: true,
    rngStream: "skill-effect",
    expectedRngDraws: 1,
    consumptionPolicy: "RESOLVED_ONLY_NO_CANDIDATE_REJECTED",
    handlerVersion: "legal-recolor-v1",
    v49Catalogued: false,
  }),
});

const V49_SKILL_IDS = Object.freeze(Object.values(STANDARD_SKILLS).filter((entry) => entry.v49Catalogued).map((entry) => entry.id));
const IMPLEMENTED_SKILL_IDS = Object.freeze(Object.values(STANDARD_SKILLS).filter((entry) => entry.implemented).map((entry) => entry.id));

module.exports = { IMPLEMENTED_SKILL_IDS, STANDARD_SKILLS, V49_SKILL_IDS };
