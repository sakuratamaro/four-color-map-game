"use strict";(()=>{const modules={"standard/standard-engine.js":function(require,module,exports){
"use strict";

const COLORS = Object.freeze(["red", "blue", "yellow", "green"]);
const MICRO_WIDTH = 48;

class StandardRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StandardRuleError";
    this.code = code;
  }
}

function assertRule(condition, code, message) {
  if (!condition) throw new StandardRuleError(code, message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function numericRegionId(id) {
  const match = String(id).match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function compareRegionIds(left, right) {
  const delta = numericRegionId(left) - numericRegionId(right);
  return Number.isFinite(delta) && delta !== 0 ? delta : String(left).localeCompare(String(right));
}

function microNeighbors(index, width = MICRO_WIDTH) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result = [];
  if (x > 0) result.push(index - 1);
  if (x < width - 1) result.push(index + 1);
  if (y > 0) result.push(index - width);
  result.push(index + width);
  return result;
}

function ownerMap(state) {
  const result = new Map();
  for (const region of Object.values(state.regions || {})) {
    for (const micro of region.micro || []) {
      assertRule(Number.isInteger(micro) && micro >= 0, "INVALID_STATE", "Region geometry contains an invalid cell");
      assertRule(!result.has(micro), "INVALID_STATE", "Regions overlap");
      result.set(micro, region.id);
    }
  }
  return result;
}

function adjacentRegionIds(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  const width = state.microWidth || MICRO_WIDTH;
  const owners = ownerMap(state);
  const adjacent = new Set();
  for (const micro of region.micro || []) {
    for (const neighbor of microNeighbors(micro, width)) {
      const owner = owners.get(neighbor);
      if (owner && owner !== regionId) adjacent.add(owner);
    }
  }
  return [...adjacent].sort(compareRegionIds);
}

function legalRecolorCandidates(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  const blocked = new Set([region.color]);
  for (const adjacentId of adjacentRegionIds(state, regionId)) {
    const color = state.regions[adjacentId]?.color;
    if (color) blocked.add(color);
  }
  return Object.freeze(COLORS.filter((color) => !blocked.has(color)));
}

function sameColorAdjacentCount(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  if (!region.color) return 0;
  return adjacentRegionIds(state, regionId).filter((adjacentId) => state.regions[adjacentId]?.color === region.color).length;
}

function mergeSameColorComponent(state, startRegionId) {
  const start = state.regions[startRegionId];
  if (!start?.color) return Object.freeze({ keptId: startRegionId, droppedIds: [] });
  const component = new Set([startRegionId]);
  const queue = [startRegionId];
  while (queue.length) {
    const current = queue.shift();
    for (const adjacentId of adjacentRegionIds(state, current)) {
      if (!component.has(adjacentId) && state.regions[adjacentId]?.color === start.color) {
        component.add(adjacentId);
        queue.push(adjacentId);
      }
    }
  }
  const ids = [...component].sort(compareRegionIds);
  const keptId = ids[0];
  const droppedIds = ids.slice(1);
  if (!droppedIds.length) return Object.freeze({ keptId, droppedIds: [] });
  const kept = state.regions[keptId];
  kept.micro = [...new Set(ids.flatMap((id) => state.regions[id].micro || []))].sort((a, b) => a - b);
  kept.sourceMacros = [...new Set(ids.flatMap((id) => state.regions[id].sourceMacros || []))].sort((a, b) => a - b);
  kept.controllers = [...new Set(ids.flatMap((id) => state.regions[id].controllers || []))].sort();
  kept.color = start.color;
  kept.isPending = false;
  for (const id of droppedIds) delete state.regions[id];
  if (droppedIds.includes(state.pending)) state.pending = keptId;
  return Object.freeze({ keptId, droppedIds: Object.freeze(droppedIds) });
}

function validateLegalRecolorTarget(state, actor, regionId) {
  assertRule(actor === "A" || actor === "B", "NOT_A_PLAYER", "Actor must occupy a seat");
  assertRule(state.mode === "standard", "WRONG_MODE", "Legal recolor is standard-mode only");
  assertRule(state.phase === "WORK", "WRONG_PHASE", "Legal recolor is a work-phase skill");
  assertRule(state.active === actor, "NOT_YOUR_TURN", "It is not this player's turn");
  assertRule(!state.winner, "MATCH_FINISHED", "Match is already finished");
  assertRule(!state.interferenceLock, "INTERFERENCE_CHAINED", "Existing-region interference is locked until COLOR");
  assertRule((state.hands?.[actor]?.legalRecolor || 0) > 0, "SKILL_UNAVAILABLE", "Legal recolor is unavailable");
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  assertRule(Boolean(region.color), "INVALID_TARGET", "Target must already be colored");
  assertRule(state.pending !== regionId && !region.isPending, "INVALID_TARGET", "Pending region cannot be recolored");
  assertRule(!region.deleted && !region.delayed && !region.delayState, "INVALID_TARGET", "Deleted or delayed region cannot be recolored");
  return region;
}

function applyLegalRecolor(currentState, actor, regionId, options = {}) {
  validateLegalRecolorTarget(currentState, actor, regionId);
  const sameColorBefore = sameColorAdjacentCount(currentState, regionId);
  const candidates = legalRecolorCandidates(currentState, regionId);
  if (!candidates.length) return Object.freeze({ ok: false, code: "NO_LEGAL_RECOLOR", state: currentState, candidates });
  const effectRandom = options.effectRandom;
  assertRule(typeof effectRandom === "function", "RNG_REQUIRED", "Effect RNG is required");
  const draw = Number(effectRandom());
  assertRule(Number.isFinite(draw) && draw >= 0 && draw < 1, "INVALID_RANDOM", "Effect RNG must return [0, 1)");
  const color = candidates[Math.floor(draw * candidates.length)];
  const state = clone(currentState);
  state.regions[regionId].color = color;
  const sameColorAfter = sameColorAdjacentCount(state, regionId);
  assertRule(sameColorAfter === 0 && sameColorAfter <= sameColorBefore, "RECOLOR_ADJACENCY_INVARIANT", "Legal recolor created same-color adjacency");
  state.hands[actor].legalRecolor -= 1;
  state.skillsUsed = state.skillsUsed || { A: 0, B: 0 };
  state.skillsUsed[actor] = (state.skillsUsed[actor] || 0) + 1;
  const merge = Object.freeze({ keptId: regionId, droppedIds: Object.freeze([]) });
  state.active = other(actor);
  state.phase = "WORK";
  state.interferenceLock = true;
  state.version += 1;
  const logKey = Array.isArray(state.publicLog) ? "publicLog" : "log";
  state[logKey] = Array.isArray(state[logKey]) ? state[logKey] : [];
  state[logKey].push(`T${state.turn}  Player ${actor} legally recolored ${regionId} ${color}; WORK passed to Player ${state.active}.`);
  return Object.freeze({ ok: true, code: "OK", state, color, candidates, merge });
}

function onEnterColor(currentState) {
  if (!currentState.interferenceLock) return currentState;
  const state = clone(currentState);
  state.interferenceLock = false;
  return state;
}

function hashSeed(seed, name) {
  let value = (Number(seed) >>> 0) ^ 0x811c9dc5;
  for (const char of String(name)) {
    value ^= char.codePointAt(0);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value || 0x6d2b79f5;
}

function createStream(seed) {
  let state = seed >>> 0;
  return Object.freeze({
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    snapshot() {
      return state >>> 0;
    },
  });
}

function createRngDomains(seed, names = ["setup", "roll", "effect", "quizContent", "quizPlacement", "cpuDecision"]) {
  const streams = {};
  for (const name of names) streams[name] = createStream(hashSeed(seed, name));
  return Object.freeze(streams);
}

function createRngDomainsFromSnapshot(snapshot, names) {
  assertRule(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot), "INVALID_RNG_SNAPSHOT", "RNG snapshot must be an object");
  const streams = {};
  for (const name of names) {
    assertRule(Number.isSafeInteger(snapshot[name]) && snapshot[name] >= 0 && snapshot[name] <= 0xffffffff, "INVALID_RNG_SNAPSHOT", `Missing RNG stream: ${name}`);
    streams[name] = createStream(snapshot[name]);
  }
  return Object.freeze(streams);
}

function snapshotRngDomains(streams, names) {
  const snapshot = {};
  for (const name of names) {
    const value = streams?.[name]?.snapshot?.();
    assertRule(Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff, "INVALID_RNG_STREAM", `RNG stream cannot be snapshotted: ${name}`);
    snapshot[name] = value;
  }
  return Object.freeze(snapshot);
}

module.exports = {
  COLORS,
  StandardRuleError,
  adjacentRegionIds,
  applyLegalRecolor,
  compareRegionIds,
  createRngDomains,
  createRngDomainsFromSnapshot,
  createStream,
  hashSeed,
  legalRecolorCandidates,
  mergeSameColorComponent,
  onEnterColor,
  sameColorAdjacentCount,
  snapshotRngDomains,
};

},
"standard/standard-cosmetics.js":function(require,module,exports){
"use strict";

const COSMETIC_TYPES = Object.freeze(["board", "effect", "nameplate", "title"]);
const COSMETIC_TYPE_LABELS = Object.freeze({ board: "盤面枠", effect: "発動演出", nameplate: "名札", title: "称号" });
const DEFAULT_COSMETIC_BY_TYPE = Object.freeze({ board: "boardDefault", effect: "effectDefault", nameplate: "nameplateDefault", title: "titleNone" });
const COSMETIC_CATALOG = Object.freeze({
  boardDefault: Object.freeze({ cosmeticId: "boardDefault", name: "標準盤面", type: "board", price: 0, cssClass: "", preview: "DEFAULT", previewClass: "" }),
  boardAurora: Object.freeze({ cosmeticId: "boardAurora", name: "オーロラ盤面", type: "board", price: 600, cssClass: "skin-board-aurora", preview: "AURORA", previewClass: "aurora" }),
  boardGold: Object.freeze({ cosmeticId: "boardGold", name: "黄金盤面", type: "board", price: 900, cssClass: "skin-board-gold", preview: "GOLD", previewClass: "gold" }),
  boardCartographer: Object.freeze({ cosmeticId: "boardCartographer", name: "地図職人の盤面", type: "board", price: 0, cssClass: "skin-board-cartographer", preview: "CARTOGRAPHER", previewClass: "cartographer", trophyId: "fullPaint" }),
  effectDefault: Object.freeze({ cosmeticId: "effectDefault", name: "標準エフェクト", type: "effect", price: 0, cssClass: "", preview: "STANDARD FX", previewClass: "" }),
  effectSakura: Object.freeze({ cosmeticId: "effectSakura", name: "桜吹雪", type: "effect", price: 500, cssClass: "skin-effect-sakura", preview: "SAKURA FX", previewClass: "sakura" }),
  effectPrism: Object.freeze({ cosmeticId: "effectPrism", name: "四色プリズム", type: "effect", price: 850, cssClass: "skin-effect-prism", preview: "PRISM FX", previewClass: "prism" }),
  effectMasterpiece: Object.freeze({ cosmeticId: "effectMasterpiece", name: "完成地図の輝き", type: "effect", price: 0, cssClass: "skin-effect-masterpiece", preview: "MASTERPIECE", previewClass: "cartographer", trophyId: "fullPaint3" }),
  nameplateDefault: Object.freeze({ cosmeticId: "nameplateDefault", name: "標準名札", type: "nameplate", price: 0, cssClass: "", preview: "PLAYER", previewClass: "" }),
  nameplateGold: Object.freeze({ cosmeticId: "nameplateGold", name: "黄金名札", type: "nameplate", price: 350, cssClass: "skin-nameplate-gold", preview: "PLAYER ★", previewClass: "gold" }),
  titleNone: Object.freeze({ cosmeticId: "titleNone", name: "称号なし", type: "title", price: 0, cssClass: "", preview: "PLAYER", previewClass: "" }),
  titleArtisan: Object.freeze({ cosmeticId: "titleArtisan", name: "四色の匠", type: "title", price: 0, cssClass: "", preview: "四色の匠", previewClass: "prism", trophyId: "noSkillFullPaint" }),
});
const DEFAULT_COSMETIC_IDS = Object.freeze(Object.values(DEFAULT_COSMETIC_BY_TYPE));
const ALL_COSMETIC_CLASSES = Object.freeze([...new Set(Object.values(COSMETIC_CATALOG).map((item) => item.cssClass).filter(Boolean))]);

class StandardCosmeticError extends Error {
  constructor(code) {
    super(code);
    this.name = "StandardCosmeticError";
    this.code = code;
  }
}

function assertCosmetic(condition, code) {
  if (!condition) throw new StandardCosmeticError(code);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function effectiveEquipped(profile) {
  const equipped = {};
  for (const type of COSMETIC_TYPES) {
    const candidate = profile.equipped?.[type];
    const item = COSMETIC_CATALOG[candidate];
    equipped[type] = item?.type === type ? candidate : DEFAULT_COSMETIC_BY_TYPE[type];
  }
  return Object.freeze(equipped);
}

function validateCosmeticFields(profile) {
  assertCosmetic(Array.isArray(profile.cosmeticsOwned), "INVALID_COSMETICS");
  assertCosmetic(new Set(profile.cosmeticsOwned).size === profile.cosmeticsOwned.length, "DUPLICATE_COSMETIC");
  for (const cosmeticId of profile.cosmeticsOwned) assertCosmetic(Boolean(COSMETIC_CATALOG[cosmeticId]), "UNKNOWN_COSMETIC");
  assertCosmetic(profile.equipped && typeof profile.equipped === "object" && !Array.isArray(profile.equipped), "INVALID_EQUIPPED_COSMETICS");
  for (const [type, cosmeticId] of Object.entries(profile.equipped)) {
    assertCosmetic(COSMETIC_TYPES.includes(type) && COSMETIC_CATALOG[cosmeticId]?.type === type, "INVALID_EQUIPPED_COSMETIC");
    const item = COSMETIC_CATALOG[cosmeticId];
    const available = DEFAULT_COSMETIC_IDS.includes(cosmeticId) || profile.cosmeticsOwned.includes(cosmeticId) || (item.trophyId && profile.trophies?.[item.trophyId] === true);
    assertCosmetic(available, "EQUIPPED_COSMETIC_NOT_OWNED");
  }
  return true;
}

function quoteCosmeticAction({ profile, cosmeticId }) {
  validateCosmeticFields(profile);
  const item = COSMETIC_CATALOG[cosmeticId];
  assertCosmetic(Boolean(item), "UNKNOWN_COSMETIC");
  assertCosmetic(effectiveEquipped(profile)[item.type] !== cosmeticId, "ALREADY_EQUIPPED");
  if (item.trophyId) assertCosmetic(profile.trophies?.[item.trophyId] === true, "TROPHY_REQUIRED");
  const owned = DEFAULT_COSMETIC_IDS.includes(cosmeticId) || profile.cosmeticsOwned.includes(cosmeticId) || Boolean(item.trophyId);
  const purchaseRequired = !owned;
  const price = purchaseRequired ? item.price : 0;
  assertCosmetic(Number.isSafeInteger(profile.coins) && profile.coins >= price, "INSUFFICIENT_COINS");
  return Object.freeze({
    cosmeticId,
    name: item.name,
    type: item.type,
    price,
    purchaseRequired,
    action: purchaseRequired ? "PURCHASE_AND_EQUIP" : "EQUIP",
    coinsBefore: profile.coins,
    coinsAfter: profile.coins - price,
    trophyId: item.trophyId || null,
  });
}

function applyCosmeticAction({ profile, cosmeticId }) {
  const quote = quoteCosmeticAction({ profile, cosmeticId });
  const next = clone(profile);
  if (quote.purchaseRequired) next.cosmeticsOwned.push(cosmeticId);
  next.coins = quote.coinsAfter;
  next.equipped = { ...effectiveEquipped(next), [quote.type]: cosmeticId };
  validateCosmeticFields(next);
  return Object.freeze({ profile: Object.freeze(next), quote });
}

function projectCosmetics(profile) {
  validateCosmeticFields(profile);
  const equipped = effectiveEquipped(profile);
  const items = Object.values(COSMETIC_CATALOG).map((item) => {
    const trophyUnlocked = !item.trophyId || profile.trophies?.[item.trophyId] === true;
    const owned = DEFAULT_COSMETIC_IDS.includes(item.cosmeticId) || profile.cosmeticsOwned.includes(item.cosmeticId) || Boolean(item.trophyId && trophyUnlocked);
    return Object.freeze({ ...item, trophyId: item.trophyId || null, trophyUnlocked, owned, equipped: equipped[item.type] === item.cosmeticId });
  });
  return Object.freeze({ coins: profile.coins, equipped, items: Object.freeze(items) });
}

module.exports = {
  ALL_COSMETIC_CLASSES,
  COSMETIC_CATALOG,
  COSMETIC_TYPES,
  COSMETIC_TYPE_LABELS,
  DEFAULT_COSMETIC_BY_TYPE,
  DEFAULT_COSMETIC_IDS,
  StandardCosmeticError,
  applyCosmeticAction,
  effectiveEquipped,
  projectCosmetics,
  quoteCosmeticAction,
  validateCosmeticFields,
};

},
"standard/standard-skill-registry.js":function(require,module,exports){
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
  legalRecolor: skill("legalRecolor", "サーバー抽選による合法リカラー", "experimental", 3, "WORK", {
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

},
"standard/standard-profile.js":function(require,module,exports){
"use strict";

const { STANDARD_SKILLS } = require("./standard-skill-registry.js");
const cosmetics = require("./standard-cosmetics.js");

const STARTER_SPOTLIGHT_SKILL = "areaHalfShift";
const ECONOMY_VERSION = "standard-alpha-economy-v1";
const SELL_PRICE_BY_RARITY = Object.freeze({ 1: 10, 2: 30, 3: 80, 4: 200, 5: 500 });
const CARD_COIN_VALUE = SELL_PRICE_BY_RARITY;
const TROPHY_IDS = Object.freeze(["fullPaint", "fullPaint3", "noSkillFullPaint"]);
const MAX_MATCH_HISTORY = 50;

class StandardProfileError extends Error {
  constructor(code) {
    super(code);
    this.name = "StandardProfileError";
    this.code = code;
  }
}

function assertProfile(condition, code) {
  if (!condition) throw new StandardProfileError(code);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonnegativeInteger(value, code) {
  assertProfile(Number.isSafeInteger(value) && value >= 0, code);
}

function createProgressionFields() {
  return {
    protectedSkills: { [STARTER_SPOTLIGHT_SKILL]: true },
    cosmeticsOwned: [...cosmetics.DEFAULT_COSMETIC_IDS],
    equipped: { ...cosmetics.DEFAULT_COSMETIC_BY_TYPE },
    trophies: Object.fromEntries(TROPHY_IDS.map((id) => [id, false])),
    trophyDates: {},
    stats: { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 },
    cpuStats: { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 },
    cpuCharacterStats: {},
    matchHistory: [],
  };
}

function validateProgressionFields(profile) {
  assertProfile(isRecord(profile.inventory), "INVALID_INVENTORY");
  for (const [skillId, count] of Object.entries(profile.inventory)) {
    assertProfile(Boolean(STANDARD_SKILLS[skillId]), "UNKNOWN_INVENTORY_SKILL");
    nonnegativeInteger(count, "INVALID_INVENTORY_COUNT");
  }
  nonnegativeInteger(profile.coins, "INVALID_COINS");
  assertProfile(isRecord(profile.protectedSkills), "INVALID_PROTECTED_SKILLS");
  for (const [skillId, protectedValue] of Object.entries(profile.protectedSkills)) {
    assertProfile(Boolean(STANDARD_SKILLS[skillId]), "UNKNOWN_PROTECTED_SKILL");
    assertProfile(typeof protectedValue === "boolean", "INVALID_PROTECTED_SKILL_VALUE");
  }
  cosmetics.validateCosmeticFields(profile);
  assertProfile(isRecord(profile.trophies), "INVALID_TROPHIES");
  for (const trophyId of TROPHY_IDS) assertProfile(typeof profile.trophies[trophyId] === "boolean", "INVALID_TROPHY_VALUE");
  assertProfile(isRecord(profile.trophyDates), "INVALID_TROPHY_DATES");
  for (const [trophyId, date] of Object.entries(profile.trophyDates)) {
    assertProfile(TROPHY_IDS.includes(trophyId) && typeof date === "string" && Number.isFinite(Date.parse(date)), "INVALID_TROPHY_DATE");
  }
  assertProfile(isRecord(profile.stats), "INVALID_MATCH_STATS");
  for (const key of ["wins", "losses", "currentWinStreak", "bestWinStreak", "fullPaints"]) nonnegativeInteger(profile.stats[key], "INVALID_MATCH_STAT");
  assertProfile(profile.stats.bestWinStreak >= profile.stats.currentWinStreak, "INVALID_WIN_STREAK");
  if (Object.hasOwn(profile, "cpuStats")) {
    assertProfile(isRecord(profile.cpuStats), "INVALID_CPU_MATCH_STATS");
    for (const key of ["wins", "losses", "currentWinStreak", "bestWinStreak", "fullPaints"]) nonnegativeInteger(profile.cpuStats[key], "INVALID_CPU_MATCH_STAT");
    assertProfile(profile.cpuStats.bestWinStreak >= profile.cpuStats.currentWinStreak, "INVALID_CPU_WIN_STREAK");
  }
  if (Object.hasOwn(profile, "cpuCharacterStats")) {
    assertProfile(isRecord(profile.cpuCharacterStats), "INVALID_CPU_CHARACTER_STATS");
    for (const [characterId, record] of Object.entries(profile.cpuCharacterStats)) {
      assertProfile(/^[a-z][a-z0-9-]{1,31}$/.test(characterId) && isRecord(record), "INVALID_CPU_CHARACTER_STAT");
      for (const key of ["matches", "wins", "losses"]) nonnegativeInteger(record[key], "INVALID_CPU_CHARACTER_STAT");
      assertProfile(record.matches === record.wins + record.losses, "INVALID_CPU_CHARACTER_STAT");
      assertProfile(record.firstWinAt === null || (typeof record.firstWinAt === "string" && Number.isFinite(Date.parse(record.firstWinAt))), "INVALID_CPU_CHARACTER_STAT");
    }
  }
  assertProfile(Array.isArray(profile.matchHistory) && profile.matchHistory.length <= MAX_MATCH_HISTORY, "INVALID_MATCH_HISTORY");
  for (const entry of profile.matchHistory) {
    assertProfile(isRecord(entry), "INVALID_MATCH_HISTORY_ENTRY");
    assertProfile(typeof entry.matchId === "string" && entry.matchId.length >= 1 && entry.matchId.length <= 64, "INVALID_HISTORY_MATCH_ID");
    assertProfile(entry.result === "WIN" || entry.result === "LOSS", "INVALID_HISTORY_RESULT");
    assertProfile(typeof entry.terminalReason === "string" && entry.terminalReason.length <= 80, "INVALID_HISTORY_REASON");
    assertProfile(typeof entry.endedAt === "string" && Number.isFinite(Date.parse(entry.endedAt)), "INVALID_HISTORY_DATE");
    assertProfile(typeof entry.fullPaint === "boolean", "INVALID_HISTORY_FULL_PAINT");
    nonnegativeInteger(entry.skillsUsed, "INVALID_HISTORY_SKILLS_USED");
    if (Object.hasOwn(entry, "onlineOpponentKind")) {
      assertProfile(entry.onlineOpponentKind === "cpu" && /^[a-z][a-z0-9-]{1,31}$/.test(entry.cpuCharacterId), "INVALID_ONLINE_CPU_HISTORY");
    }
    if (Object.hasOwn(entry, "mode")) {
      assertProfile(entry.mode === "standard", "INVALID_HISTORY_MODE");
      assertProfile(typeof entry.profileId === "string" && entry.profileId.length >= 1 && entry.profileId.length <= 64, "INVALID_HISTORY_PROFILE_ID");
      assertProfile(entry.opponentType === "PROFILE" || entry.opponentType === "CPU", "INVALID_HISTORY_OPPONENT_TYPE");
      assertProfile(typeof entry.displayNameSnapshot === "string" && entry.displayNameSnapshot.length >= 1 && entry.displayNameSnapshot.length <= 40, "INVALID_HISTORY_NAME");
      assertProfile(entry.opponentDisplayNameSnapshot === null || (typeof entry.opponentDisplayNameSnapshot === "string" && entry.opponentDisplayNameSnapshot.length >= 1 && entry.opponentDisplayNameSnapshot.length <= 40), "INVALID_HISTORY_OPPONENT_NAME");
      assertProfile(entry.opponentProfileId === null || (typeof entry.opponentProfileId === "string" && entry.opponentProfileId.length >= 1 && entry.opponentProfileId.length <= 64), "INVALID_HISTORY_OPPONENT_ID");
      assertProfile(entry.winnerSeat === "A" || entry.winnerSeat === "B", "INVALID_HISTORY_WINNER");
      assertProfile(typeof entry.startedAt === "string" && Number.isFinite(Date.parse(entry.startedAt)), "INVALID_HISTORY_STARTED_AT");
      assertProfile(typeof entry.finishedAt === "string" && Number.isFinite(Date.parse(entry.finishedAt)), "INVALID_HISTORY_FINISHED_AT");
      nonnegativeInteger(entry.turnCount, "INVALID_HISTORY_TURN_COUNT");
      nonnegativeInteger(entry.actionCount, "INVALID_HISTORY_ACTION_COUNT");
      assertProfile(typeof entry.mapComplete === "boolean", "INVALID_HISTORY_MAP_COMPLETE");
      if (entry.opponentType === "CPU") {
        assertProfile(["easy", "normal", "hard"].includes(entry.cpuDifficulty), "INVALID_HISTORY_CPU_DIFFICULTY");
        assertProfile(typeof entry.cpuPolicyVersion === "string" && entry.cpuPolicyVersion.length >= 1 && entry.cpuPolicyVersion.length <= 80, "INVALID_HISTORY_CPU_POLICY");
      } else {
        assertProfile(entry.opponentProfileId !== null && entry.opponentDisplayNameSnapshot !== null && entry.cpuDifficulty === null && entry.cpuPolicyVersion === null, "INVALID_HISTORY_PROFILE_OPPONENT");
      }
    }
  }
  return true;
}

function coinValueForSkill(skillId) {
  const skill = STANDARD_SKILLS[skillId];
  assertProfile(Boolean(skill) && skill.v49Catalogued, "UNKNOWN_SELLABLE_SKILL");
  return SELL_PRICE_BY_RARITY[skill.rarity];
}

function quoteCardSale({ profile, skillId, count, reservedCount = 0 }) {
  validateProgressionFields(profile);
  const value = coinValueForSkill(skillId);
  assertProfile(Number.isSafeInteger(count) && count >= 1, "INVALID_SALE_COUNT");
  nonnegativeInteger(reservedCount, "INVALID_RESERVED_COUNT");
  const owned = profile.inventory?.[skillId] || 0;
  nonnegativeInteger(owned, "INVALID_INVENTORY_COUNT");
  assertProfile(reservedCount <= owned, "INVALID_RESERVED_COUNT");
  assertProfile(profile.protectedSkills[skillId] !== true, "CARD_PROTECTED");
  const minimumRetainedCount = 1;
  const sellableCount = Math.max(0, owned - Math.max(reservedCount, minimumRetainedCount));
  assertProfile(count <= sellableCount, owned - count < minimumRetainedCount ? "KEEP_ONE_REQUIRED" : "CARD_RESERVED_OR_MISSING");
  const totalCoins = value * count;
  assertProfile(Number.isSafeInteger(totalCoins), "INVALID_ECONOMY_VALUE");
  assertProfile(Number.isSafeInteger(profile.coins + totalCoins), "COIN_OVERFLOW");
  const confirmationReasons = [];
  if (STANDARD_SKILLS[skillId].rarity >= 4) confirmationReasons.push("HIGH_RARITY");
  if (count === sellableCount) confirmationReasons.push("LAST_SELLABLE_COPY");
  return Object.freeze({
    status: confirmationReasons.length ? "CONFIRMATION_REQUIRED" : "READY",
    skillId,
    economyVersion: ECONOMY_VERSION,
    rarity: STANDARD_SKILLS[skillId].rarity,
    ownedCount: owned,
    reservedCount,
    sellableCount,
    count,
    valuePerCard: value,
    earnedCoins: totalCoins,
    remaining: owned - count,
    confirmationReasons: Object.freeze(confirmationReasons),
    requiresConfirmation: confirmationReasons.length > 0,
  });
}

function applyCardSale({ profile, skillId, count, reservedCount = 0, confirmed = false }) {
  const quote = quoteCardSale({ profile, skillId, count, reservedCount });
  assertProfile(!quote.requiresConfirmation || confirmed, "SALE_CONFIRMATION_REQUIRED");
  const next = clone(profile);
  next.inventory[skillId] = quote.remaining;
  next.coins += quote.earnedCoins;
  validateProgressionFields(next);
  return Object.freeze({ profile: Object.freeze(next), quote });
}

function applyKeepOneSale({ profile, skillId, reservedCount = 0, confirmed = false }) {
  const owned = profile.inventory?.[skillId] || 0;
  const count = owned - Math.max(1, reservedCount);
  assertProfile(count >= 1, "NO_EXCESS_CARDS");
  return applyCardSale({ profile, skillId, count, reservedCount, confirmed });
}

function setCardProtection(profile, skillId, protectedValue) {
  validateProgressionFields(profile);
  assertProfile(Boolean(STANDARD_SKILLS[skillId]), "UNKNOWN_SKILL");
  assertProfile(typeof protectedValue === "boolean", "INVALID_PROTECTION_VALUE");
  const next = clone(profile);
  next.protectedSkills[skillId] = protectedValue;
  validateProgressionFields(next);
  return Object.freeze(next);
}

function unlockTrophy(profile, trophyId, endedAt) {
  if (profile.trophies[trophyId]) return;
  profile.trophies[trophyId] = true;
  profile.trophyDates[trophyId] = endedAt;
}

function recordMatchOutcome({ profile, matchId, won, terminalReason, fullPaint = false, skillsUsed = 0, endedAt = new Date().toISOString() }) {
  validateProgressionFields(profile);
  assertProfile(typeof matchId === "string" && matchId.length >= 1 && matchId.length <= 64, "INVALID_HISTORY_MATCH_ID");
  assertProfile(typeof won === "boolean", "INVALID_MATCH_RESULT");
  assertProfile(typeof terminalReason === "string" && terminalReason.length <= 80, "INVALID_HISTORY_REASON");
  assertProfile(typeof fullPaint === "boolean", "INVALID_HISTORY_FULL_PAINT");
  nonnegativeInteger(skillsUsed, "INVALID_HISTORY_SKILLS_USED");
  assertProfile(typeof endedAt === "string" && Number.isFinite(Date.parse(endedAt)), "INVALID_HISTORY_DATE");
  assertProfile(!profile.matchHistory.some((entry) => entry.matchId === matchId), "MATCH_ALREADY_RECORDED");

  const next = clone(profile);
  if (won) {
    next.stats.wins += 1;
    next.stats.currentWinStreak += 1;
    next.stats.bestWinStreak = Math.max(next.stats.bestWinStreak, next.stats.currentWinStreak);
  } else {
    next.stats.losses += 1;
    next.stats.currentWinStreak = 0;
  }
  if (won && fullPaint) {
    next.stats.fullPaints += 1;
    unlockTrophy(next, "fullPaint", endedAt);
    if (next.stats.fullPaints >= 3) unlockTrophy(next, "fullPaint3", endedAt);
    if (skillsUsed === 0) unlockTrophy(next, "noSkillFullPaint", endedAt);
  }
  next.matchHistory.unshift({ matchId, result: won ? "WIN" : "LOSS", terminalReason, endedAt, fullPaint: won && fullPaint, skillsUsed });
  next.matchHistory = next.matchHistory.slice(0, MAX_MATCH_HISTORY);
  validateProgressionFields(next);
  return Object.freeze(next);
}

function recordCpuMatchOutcome({ profile, matchId, cpuCharacterId, won, terminalReason, fullPaint = false, skillsUsed = 0, endedAt = new Date().toISOString() }) {
  validateProgressionFields(profile);
  assertProfile(typeof matchId === "string" && matchId.length >= 1 && matchId.length <= 64, "INVALID_HISTORY_MATCH_ID");
  assertProfile(/^[a-z][a-z0-9-]{1,31}$/.test(cpuCharacterId), "INVALID_CPU_CHARACTER_ID");
  assertProfile(typeof won === "boolean", "INVALID_MATCH_RESULT");
  assertProfile(typeof terminalReason === "string" && terminalReason.length <= 80, "INVALID_HISTORY_REASON");
  assertProfile(typeof fullPaint === "boolean", "INVALID_HISTORY_FULL_PAINT");
  nonnegativeInteger(skillsUsed, "INVALID_HISTORY_SKILLS_USED");
  assertProfile(typeof endedAt === "string" && Number.isFinite(Date.parse(endedAt)), "INVALID_HISTORY_DATE");
  assertProfile(!profile.matchHistory.some((entry) => entry.matchId === matchId), "MATCH_ALREADY_RECORDED");
  const next = clone(profile);
  next.cpuStats ||= { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 };
  next.cpuCharacterStats ||= {};
  if (won) {
    next.cpuStats.wins += 1;
    next.cpuStats.currentWinStreak += 1;
    next.cpuStats.bestWinStreak = Math.max(next.cpuStats.bestWinStreak, next.cpuStats.currentWinStreak);
  } else {
    next.cpuStats.losses += 1;
    next.cpuStats.currentWinStreak = 0;
  }
  const character = next.cpuCharacterStats[cpuCharacterId] || { matches: 0, wins: 0, losses: 0, firstWinAt: null };
  character.matches += 1;
  character[won ? "wins" : "losses"] += 1;
  if (won && character.firstWinAt === null) character.firstWinAt = endedAt;
  next.cpuCharacterStats[cpuCharacterId] = character;
  if (won && fullPaint) {
    next.cpuStats.fullPaints += 1;
    next.stats.fullPaints += 1;
    unlockTrophy(next, "fullPaint", endedAt);
    if (next.stats.fullPaints >= 3) unlockTrophy(next, "fullPaint3", endedAt);
    if (skillsUsed === 0) unlockTrophy(next, "noSkillFullPaint", endedAt);
  }
  next.matchHistory.unshift({ matchId, result: won ? "WIN" : "LOSS", terminalReason, endedAt, fullPaint: won && fullPaint, skillsUsed, onlineOpponentKind: "cpu", cpuCharacterId });
  next.matchHistory = next.matchHistory.slice(0, MAX_MATCH_HISTORY);
  validateProgressionFields(next);
  return Object.freeze(next);
}

module.exports = {
  CARD_COIN_VALUE,
  ECONOMY_VERSION,
  MAX_MATCH_HISTORY,
  STARTER_SPOTLIGHT_SKILL,
  SELL_PRICE_BY_RARITY,
  StandardProfileError,
  TROPHY_IDS,
  applyCardSale,
  applyKeepOneSale,
  coinValueForSkill,
  createProgressionFields,
  quoteCardSale,
  recordCpuMatchOutcome,
  recordMatchOutcome,
  setCardProtection,
  validateProgressionFields,
};

},
"standard/standard-skill-handlers.js":function(require,module,exports){
"use strict";

const { COLORS, StandardRuleError, mergeSameColorComponent } = require("./standard-engine.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function consume(state, actor, skill) {
  state.hands[actor][skill] -= 1;
  state.skillsUsed[actor] = (state.skillsUsed[actor] || 0) + 1;
  state.version += 1;
}

function resolved(currentState, actor, skill, mutate, details = {}) {
  const state = clone(currentState);
  mutate(state);
  consume(state, actor, skill);
  return Object.freeze({ ok: true, code: "OK", state, ...details });
}

function applyColorPrism({ state, actor }) {
  return resolved(state, actor, "colorPrism", (next) => {
    next.privateEffects[actor] = next.privateEffects[actor] || {};
    next.privateEffects[actor].prism = true;
    next.publicLog.push(`T${next.turn} Player ${actor} enabled all four colors for this coloring.`);
  });
}

function usedBoardColors(state) {
  return [...new Set(Object.values(state.regions).map((region) => region.color).filter((color) => COLORS.includes(color)))];
}

function addTemporaryColor(state, actor, color) {
  state.privateEffects[actor] = state.privateEffects[actor] || {};
  const temporaryColors = new Set(state.privateEffects[actor].temporaryColors || []);
  temporaryColors.add(color);
  state.privateEffects[actor].temporaryColors = [...temporaryColors];
}

function applyColorRandomBorrow({ state, actor, random }) {
  const candidates = usedBoardColors(state);
  if (!candidates.length) return Object.freeze({ ok: false, code: "NO_BOARD_COLORS", state });
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const color = candidates[Math.floor(draw * candidates.length)];
  return resolved(state, actor, "colorRandomBorrow", (next) => {
    addTemporaryColor(next, actor, color);
    next.publicLog.push(`T${next.turn} Player ${actor} used random color borrow; the added color is private.`);
  });
}

function applyColorChoiceBorrow({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  if (!usedBoardColors(state).includes(payload.color)) return Object.freeze({ ok: false, code: "COLOR_NOT_USED_ON_BOARD", state });
  return resolved(state, actor, "colorChoiceBorrow", (next) => {
    addTemporaryColor(next, actor, payload.color);
    next.publicLog.push(`T${next.turn} Player ${actor} used chosen color borrow; the added color is private.`);
  });
}

function paletteColorAt(state, actor, slot) {
  return slot < 2 ? state.basicPalettes[actor][slot] : state.bonusColors[actor];
}

function setPaletteColorAt(state, actor, slot, color) {
  if (slot < 2) state.basicPalettes[actor][slot] = color;
  else state.bonusColors[actor] = color;
}

function clearPaletteDebuffAtSlot(state, actor, slot) {
  state.privateEffects[actor] = state.privateEffects[actor] || {};
  state.privateEffects[actor].paletteDebuffs = (state.privateEffects[actor].paletteDebuffs || []).filter((effect) => effect.slot !== slot);
  if (!state.privateEffects[actor].paletteDebuffs.length) delete state.privateEffects[actor].paletteDebuffs;
}

function applyColorPaletteChange({ state, actor, payload }) {
  if (!Number.isInteger(payload.slot) || payload.slot < 0 || payload.slot > 2 || !COLORS.includes(payload.color)) {
    return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  }
  if (paletteColorAt(state, actor, payload.slot) === payload.color) return Object.freeze({ ok: false, code: "PALETTE_COLOR_UNCHANGED", state });
  return resolved(state, actor, "colorPaletteChange", (next) => {
    clearPaletteDebuffAtSlot(next, actor, payload.slot);
    setPaletteColorAt(next, actor, payload.slot, payload.color);
    next.publicLog.push(`T${next.turn} Player ${actor} permanently changed one private palette slot.`);
  });
}

function microToMacro(cell, state) {
  const x = cell % state.microWidth;
  const y = Math.floor(cell / state.microWidth);
  const scale = state.playableBounds.microScale;
  return Math.floor(y / scale) * state.playableBounds.macroWidth + Math.floor(x / scale);
}

function nextRegionNumber(state) {
  return Math.max(0, ...Object.keys(state.regions).map((id) => Number(String(id).match(/\d+/)?.[0]) || 0)) + 1;
}

function applyColorRegionSplit({ state, actor, payload }) {
  const region = state.regions?.[payload.regionId];
  if (!region || payload.regionId !== state.pending || !region.isPending || region.color) {
    return Object.freeze({ ok: false, code: "INVALID_SPLIT_TARGET", state });
  }
  if ((region.controllers || []).includes(actor)) return Object.freeze({ ok: false, code: "SPLIT_REQUIRES_OPPONENT_REGION", state });
  if (state.reserved) return Object.freeze({ ok: false, code: "SPLIT_ALREADY_RESERVED", state });
  const original = [...new Set(region.sourceMacros || [])].sort((a, b) => a - b);
  const selected = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  const originalSet = new Set(original);
  if (selected.length !== payload.sourceMacros.length || !selected.every((macro) => originalSet.has(macro))) {
    return Object.freeze({ ok: false, code: "INVALID_SPLIT_SELECTION", state });
  }
  const selectedSet = new Set(selected);
  const returned = original.filter((macro) => !selectedSet.has(macro));
  if (!selected.length || !returned.length) return Object.freeze({ ok: false, code: "SPLIT_SIDE_EMPTY", state });
  if (!connected(selected, state.playableBounds.macroWidth) || !connected(returned, state.playableBounds.macroWidth)) {
    return Object.freeze({ ok: false, code: "SPLIT_SIDE_NOT_CONNECTED", state });
  }
  const selectedMicro = region.micro.filter((cell) => selectedSet.has(microToMacro(cell, state))).sort((a, b) => a - b);
  const returnedMicro = region.micro.filter((cell) => !selectedSet.has(microToMacro(cell, state))).sort((a, b) => a - b);
  if (!connected(selectedMicro, state.microWidth) || !connected(returnedMicro, state.microWidth)) {
    return Object.freeze({ ok: false, code: "SPLIT_GEOMETRY_NOT_CONNECTED", state });
  }
  return resolved(state, actor, "colorRegionSplit", (next) => {
    const firstNumber = nextRegionNumber(next);
    const selectedId = `R${firstNumber}`;
    const returnedId = `R${firstNumber + 1}`;
    delete next.regions[payload.regionId];
    next.regions[selectedId] = {
      id: selectedId,
      micro: selectedMicro,
      sourceMacros: selected,
      controllers: [],
      color: null,
      isPending: true,
      isReserved: false,
    };
    next.regions[returnedId] = {
      id: returnedId,
      micro: returnedMicro,
      sourceMacros: returned,
      controllers: [],
      color: null,
      isPending: false,
      isReserved: true,
    };
    next.pending = selectedId;
    next.reserved = returnedId;
    next.publicLog.push(`T${next.turn} Player ${actor} split ${payload.regionId} into ${selectedId} and reserved ${returnedId}.`);
  }, { selectedId: `R${nextRegionNumber(state)}`, returnedId: `R${nextRegionNumber(state) + 1}` });
}

function macroMicroCells(macro, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const col = macro % macroWidth;
  const row = Math.floor(macro / macroWidth);
  const cells = [];
  for (let dy = 0; dy < scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) cells.push((row * scale + dy) * state.microWidth + col * scale + dx);
  }
  return cells;
}

function validOutgoingMacros(state, sourceMacros) {
  const bounds = state.playableBounds;
  if (sourceMacros.length !== state.requiredSize || !connected(sourceMacros, bounds.macroWidth)) return false;
  const occupiedMacros = new Set(Object.values(state.regions).flatMap((region) => region.sourceMacros || []));
  return sourceMacros.every((macro) => {
    if (!Number.isInteger(macro) || macro < 0 || occupiedMacros.has(macro)) return false;
    const col = macro % bounds.macroWidth;
    const row = Math.floor(macro / bounds.macroWidth);
    return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
  });
}

function microCoordinateInPlayable(state, x, y) {
  const macroCol = Math.floor(x / state.playableBounds.microScale);
  const macroRow = Math.floor(y / state.playableBounds.microScale);
  const bounds = state.playableBounds;
  return x >= 0 && x < state.microWidth && y >= 0 && y < bounds.macroWidth * bounds.microScale
    && macroCol >= bounds.minCol && macroCol <= bounds.maxCol && macroRow >= bounds.minRow && macroRow <= bounds.maxRow;
}

function regionOwners(state) {
  return new Map(Object.values(state.regions).flatMap((region) => (region.micro || []).map((cell) => [cell, region.id])));
}

function shapeTouchesRegion(shape, regionId, owners, width) {
  for (const cell of shape) {
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    if (neighbors.some((neighbor) => !shape.has(neighbor) && owners.get(neighbor) === regionId)) return true;
  }
  return false;
}

function microBloomCandidates(state, sourceMacros) {
  if (!validOutgoingMacros(state, sourceMacros)) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", candidates: [] });
  const prepared = state.preparedOutgoing;
  if (prepared && (prepared.actor !== state.active || JSON.stringify(prepared.sourceMacros) !== JSON.stringify(sourceMacros))) {
    return Object.freeze({ ok: false, code: "PREPARED_SELECTION_MISMATCH", candidates: [] });
  }
  const base = new Set(prepared?.micro || sourceMacros.flatMap((macro) => macroMicroCells(macro, state)));
  const owners = regionOwners(state);
  const scale = state.playableBounds.microScale;
  const width = state.microWidth;
  const corners = [
    { name: "top-left", diagonal: [-1, -1], plan: [[-1, 0], [0, -1], [-1, -1]] },
    { name: "top-right", diagonal: [scale, -1], plan: [[scale, 0], [scale - 1, -1], [scale, -1]] },
    { name: "bottom-left", diagonal: [-1, scale], plan: [[-1, scale - 1], [0, scale], [-1, scale]] },
    { name: "bottom-right", diagonal: [scale, scale], plan: [[scale, scale - 1], [scale - 1, scale], [scale, scale]] },
  ];
  const candidates = [];
  for (const macro of sourceMacros) {
    const macroCol = macro % state.playableBounds.macroWidth;
    const macroRow = Math.floor(macro / state.playableBounds.macroWidth);
    const x0 = macroCol * scale;
    const y0 = macroRow * scale;
    for (const corner of corners) {
      const diagonalX = x0 + corner.diagonal[0];
      const diagonalY = y0 + corner.diagonal[1];
      if (!microCoordinateInPlayable(state, diagonalX, diagonalY)) continue;
      const diagonalCell = diagonalY * width + diagonalX;
      const diagonalRegion = owners.get(diagonalCell);
      if (!diagonalRegion || !state.regions[diagonalRegion]?.color || shapeTouchesRegion(base, diagonalRegion, owners, width)) continue;
      const plan = new Set();
      for (const [dx, dy] of corner.plan) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (!microCoordinateInPlayable(state, x, y)) continue;
        const cell = y * width + x;
        if (base.has(cell) || plan.has(cell)) continue;
        const owner = owners.get(cell);
        if (owner && !state.regions[owner]?.color) continue;
        const cellX = cell % width;
        const neighbors = [cell - width, cell + width];
        if (cellX > 0) neighbors.push(cell - 1);
        if (cellX < width - 1) neighbors.push(cell + 1);
        if (neighbors.some((neighbor) => base.has(neighbor) || plan.has(neighbor))) plan.add(cell);
      }
      if (!plan.size) continue;
      const expanded = new Set([...base, ...plan]);
      if (shapeTouchesRegion(expanded, diagonalRegion, owners, width)) {
        candidates.push(Object.freeze({ macro, corner: corner.name, diagonalRegion, plan: Object.freeze([...plan].sort((a, b) => a - b)), micro: Object.freeze([...expanded].sort((a, b) => a - b)) }));
      }
    }
  }
  return Object.freeze({ ok: true, candidates: Object.freeze(candidates) });
}

function cornerBloomPlan(state, sourceMacros, macro) {
  if (!validOutgoingMacros(state, sourceMacros)) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", plan: [], micro: [] });
  const prepared = state.preparedOutgoing;
  if (prepared && (prepared.actor !== state.active || JSON.stringify(prepared.sourceMacros) !== JSON.stringify(sourceMacros))) {
    return Object.freeze({ ok: false, code: "PREPARED_SELECTION_MISMATCH", plan: [], micro: [] });
  }
  if (!sourceMacros.includes(macro)) return Object.freeze({ ok: false, code: "INVALID_CORNER_BLOOM_TARGET", plan: [], micro: [] });
  const shape = new Set(prepared?.micro || sourceMacros.flatMap((sourceMacro) => macroMicroCells(sourceMacro, state)));
  const owners = regionOwners(state);
  const scale = state.playableBounds.microScale;
  const width = state.microWidth;
  const macroCol = macro % state.playableBounds.macroWidth;
  const macroRow = Math.floor(macro / state.playableBounds.macroWidth);
  const x0 = macroCol * scale;
  const y0 = macroRow * scale;
  const corners = [
    [[-1, 0], [0, -1], [-1, -1]],
    [[scale, 0], [scale - 1, -1], [scale, -1]],
    [[-1, scale - 1], [0, scale], [-1, scale]],
    [[scale, scale - 1], [scale - 1, scale], [scale, scale]],
  ];
  const planned = new Set();
  for (const corner of corners) {
    const cornerPlan = new Set();
    for (let pass = 0; pass < 3; pass += 1) {
      for (const [dx, dy] of corner) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (!microCoordinateInPlayable(state, x, y)) continue;
        const cell = y * width + x;
        if (shape.has(cell) || planned.has(cell) || cornerPlan.has(cell)) continue;
        const owner = owners.get(cell);
        if (owner && !state.regions[owner]?.color) continue;
        const cellX = cell % width;
        const neighbors = [cell - width, cell + width];
        if (cellX > 0) neighbors.push(cell - 1);
        if (cellX < width - 1) neighbors.push(cell + 1);
        if (neighbors.some((neighbor) => shape.has(neighbor) || planned.has(neighbor) || cornerPlan.has(neighbor))) cornerPlan.add(cell);
      }
    }
    for (const cell of cornerPlan) planned.add(cell);
  }
  return Object.freeze({
    ok: true,
    plan: Object.freeze([...planned].sort((a, b) => a - b)),
    micro: Object.freeze([...new Set([...shape, ...planned])].sort((a, b) => a - b)),
  });
}

function preparedOutgoingCandidates(state, sourceMacros, skills) {
  let shapes = [null];
  for (const skill of skills) {
    const nextShapes = [];
    for (const micro of shapes) {
      const candidateState = { ...state, preparedOutgoing: micro ? { actor: state.active, sourceMacros, micro, skills: [] } : null };
      if (skill === "areaMicroBloom") {
        const result = microBloomCandidates(candidateState, sourceMacros);
        if (result.ok) for (const candidate of result.candidates) nextShapes.push([...candidate.micro]);
      } else if (skill === "areaCornerBloom") {
        for (const macro of sourceMacros) {
          const result = cornerBloomPlan(candidateState, sourceMacros, macro);
          if (result.ok && result.plan.length) nextShapes.push([...result.micro]);
        }
      }
    }
    const unique = new Map(nextShapes.map((micro) => [JSON.stringify(micro), micro]));
    shapes = [...unique.values()];
  }
  return Object.freeze(shapes.map((micro) => Object.freeze(micro)));
}

function applyAreaMicroBloom({ state, actor, payload, random }) {
  const sourceMacros = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  if (sourceMacros.length !== payload.sourceMacros.length) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", state });
  const planned = microBloomCandidates(state, sourceMacros);
  if (!planned.ok) return Object.freeze({ ok: false, code: planned.code, state });
  if (!planned.candidates.length) return Object.freeze({ ok: false, code: "NO_MICRO_BLOOM_CANDIDATE", state });
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const picked = planned.candidates[Math.floor(draw * planned.candidates.length)];
  return resolved(state, actor, "areaMicroBloom", (next) => {
    next.preparedOutgoing = {
      actor,
      sourceMacros,
      micro: [...picked.micro],
      skills: [...new Set([...(next.preparedOutgoing?.skills || []), "areaMicroBloom"])],
    };
    next.publicLog.push(`T${next.turn} Player ${actor} used micro bloom at ${picked.macro} ${picked.corner}, creating edge contact with ${picked.diagonalRegion}.`);
  }, { macro: picked.macro, corner: picked.corner, diagonalRegion: picked.diagonalRegion, addedCount: picked.plan.length });
}

function applyAreaCornerBloom({ state, actor, payload }) {
  const sourceMacros = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  if (sourceMacros.length !== payload.sourceMacros.length) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", state });
  const planned = cornerBloomPlan(state, sourceMacros, payload.macro);
  if (!planned.ok) return Object.freeze({ ok: false, code: planned.code, state });
  if (!planned.plan.length) return Object.freeze({ ok: false, code: "NO_CORNER_BLOOM_CANDIDATE", state });
  return resolved(state, actor, "areaCornerBloom", (next) => {
    next.preparedOutgoing = {
      actor,
      sourceMacros,
      micro: [...planned.micro],
      skills: [...new Set([...(next.preparedOutgoing?.skills || []), "areaCornerBloom"])],
    };
    next.publicLog.push(`T${next.turn} Player ${actor} expanded all available corners of macro ${payload.macro}, adding ${planned.plan.length} microcells.`);
  }, { macro: payload.macro, addedCount: planned.plan.length });
}

function applyAreaDiePlus({ state, actor, hasLegalRegionOfSize }) {
  const desired = state.requiredSize + 1;
  if (desired > 5) return Object.freeze({ ok: false, code: "AREA_SIZE_MAX", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  if (typeof hasLegalRegionOfSize !== "function" || !hasLegalRegionOfSize(state, desired)) {
    return Object.freeze({ ok: false, code: "NO_LEGAL_REGION_SIZE", state });
  }
  return resolved(state, actor, "areaDiePlus", (next) => {
    next.requiredSize = desired;
    next.publicLog.push(`T${next.turn} Player ${actor} increased this turn's required area size to ${desired}.`);
  }, { requiredSize: desired });
}

function resizedBounds(state, mode, side) {
  if (!["expand", "shrink"].includes(mode) || !["top", "bottom", "left", "right"].includes(side)) return null;
  const bounds = state.playableBounds;
  const width = bounds.maxCol - bounds.minCol + 1;
  const height = bounds.maxRow - bounds.minRow + 1;
  const next = { ...bounds };
  if (mode === "expand") {
    if (side === "left" && bounds.minCol > 0) next.minCol -= 1;
    else if (side === "right" && bounds.maxCol < bounds.macroWidth - 1) next.maxCol += 1;
    else if (side === "top" && bounds.minRow > 0) next.minRow -= 1;
    else if (side === "bottom" && bounds.maxRow < bounds.macroWidth - 1) next.maxRow += 1;
    else return null;
  } else {
    if (["left", "right"].includes(side) && width <= 6) return null;
    if (["top", "bottom"].includes(side) && height <= 6) return null;
    if (side === "left") next.minCol += 1;
    else if (side === "right") next.maxCol -= 1;
    else if (side === "top") next.minRow += 1;
    else next.maxRow -= 1;
  }
  return next;
}

function playableMacros(bounds) {
  const result = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) result.push(row * bounds.macroWidth + col);
  }
  return result;
}

function applyAreaResize({ state, actor, payload, bestLegalSize }) {
  const nextBounds = resizedBounds(state, payload.mode, payload.side);
  if (!nextBounds) return Object.freeze({ ok: false, code: "BOARD_SIDE_UNAVAILABLE", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  if (typeof bestLegalSize !== "function") return Object.freeze({ ok: false, code: "LEGAL_SIZE_SERVICE_REQUIRED", state });
  const bonus = Math.max(0, state.requiredSize - state.baseRequiredSize);
  return resolved(state, actor, "areaResize", (next) => {
    const targets = new Set(next.trophyTargetMacros || playableMacros(state.playableBounds));
    next.playableBounds = nextBounds;
    if (payload.mode === "expand") {
      for (const macro of playableMacros(nextBounds)) targets.add(macro);
    }
    next.trophyTargetMacros = [...targets].sort((left, right) => left - right);
    const base = bestLegalSize(next, next.rolledSize);
    next.baseRequiredSize = base;
    if (base <= 0) {
      next.requiredSize = 0;
      next.status = "FINISHED";
      next.phase = "GAME_OVER";
      next.winner = actor;
      next.terminalReason = "BOARD_LOCK";
    } else {
      next.requiredSize = bestLegalSize(next, Math.min(5, base + bonus)) || base;
    }
    next.publicLog.push(`T${next.turn} Player ${actor} ${payload.mode === "expand" ? "expanded" : "shrunk"} the ${payload.side} writable board edge; colored geometry remains.`);
  }, { playableBounds: nextBounds });
}

function normalizeHalfShift(payload) {
  const axis = String(payload.axis || "").toUpperCase();
  const direction = String(payload.direction || "").toLowerCase();
  const index = Number(payload.index);
  if (!Number.isInteger(index) || !["ROW", "COLUMN"].includes(axis)) return null;
  const minus = ["minus", "left", "up", "-"].includes(direction);
  const plus = ["plus", "right", "down", "+"].includes(direction);
  if (!minus && !plus) return null;
  return { axis, index, delta: minus ? -2 : 2, direction: minus ? "minus" : "plus" };
}

function connected(cells, width) {
  if (!cells.length) return false;
  const remaining = new Set(cells);
  const queue = [cells[0]];
  remaining.delete(cells[0]);
  while (queue.length) {
    const cell = queue.shift();
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    for (const neighbor of neighbors) if (remaining.delete(neighbor)) queue.push(neighbor);
  }
  return remaining.size === 0;
}

function connectedComponents(cells, width) {
  const remaining = new Set(cells);
  const parts = [];
  while (remaining.size) {
    const start = Math.min(...remaining);
    const part = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const cell = queue.shift();
      part.push(cell);
      const x = cell % width;
      const neighbors = [cell - width, cell + width];
      if (x > 0) neighbors.push(cell - 1);
      if (x < width - 1) neighbors.push(cell + 1);
      for (const neighbor of neighbors) if (remaining.delete(neighbor)) queue.push(neighbor);
    }
    parts.push(part.sort((a, b) => a - b));
  }
  return parts.sort((a, b) => a[0] - b[0]);
}

function sourceMacrosFromMicro(cells, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  return [...new Set(cells.map((cell) => {
    const x = cell % state.microWidth;
    const y = Math.floor(cell / state.microWidth);
    return Math.floor(y / scale) * macroWidth + Math.floor(x / scale);
  }))].sort((a, b) => a - b);
}

function planHalfShift(state, payload) {
  const request = normalizeHalfShift(payload);
  if (!request) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const width = state.microWidth;
  const height = macroWidth * scale;
  if (request.index < 0 || request.index >= macroWidth) return Object.freeze({ ok: false, code: "INVALID_SHIFT_BAND", state });
  const sets = {};
  let movedCount = 0;
  for (const [id, region] of Object.entries(state.regions)) {
    sets[id] = region.micro.map((cell) => {
      const x = cell % width;
      const y = Math.floor(cell / width);
      const inBand = request.axis === "ROW"
        ? Math.floor(y / scale) === request.index
        : Math.floor(x / scale) === request.index;
      if (!inBand) return cell;
      movedCount += 1;
      return request.axis === "ROW" ? cell + request.delta : cell + request.delta * width;
    });
  }
  if (!movedCount) return Object.freeze({ ok: false, code: "EMPTY_SHIFT_BAND", state });
  const occupied = new Set();
  let splitCount = 0;
  for (const cells of Object.values(sets)) {
    splitCount += Math.max(0, connectedComponents(cells, width).length - 1);
    for (const cell of cells) {
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (!Number.isInteger(cell) || x < 0 || x >= width || y < 0 || y >= height) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
      if (occupied.has(cell)) return Object.freeze({ ok: false, code: "SHIFT_OVERLAP", state });
      occupied.add(cell);
    }
  }
  return Object.freeze({ ok: true, ...request, movedCount, splitCount, sets });
}

function applyAreaHalfShift({ state, actor, payload }) {
  const plan = planHalfShift(state, payload);
  if (!plan.ok) return plan;
  return resolved(state, actor, "areaHalfShift", (next) => {
    for (const [id, cells] of Object.entries(plan.sets)) {
      next.regions[id].micro = [...cells].sort((a, b) => a - b);
      next.regions[id].sourceMacros = sourceMacrosFromMicro(cells, next);
    }
    let nextNumber = Math.max(0, ...Object.keys(next.regions).map((id) => Number(String(id).match(/\d+/)?.[0]) || 0)) + 1;
    for (const id of Object.keys(plan.sets).sort()) {
      const region = next.regions[id];
      const parts = connectedComponents(region.micro, next.microWidth);
      region.micro = parts[0];
      region.sourceMacros = sourceMacrosFromMicro(parts[0], next);
      for (const part of parts.slice(1)) {
        const newId = `R${nextNumber}`;
        nextNumber += 1;
        next.regions[newId] = {
          ...region,
          id: newId,
          micro: part,
          sourceMacros: sourceMacrosFromMicro(part, next),
          controllers: [...(region.controllers || [])],
          isPending: false,
        };
      }
    }
    const ids = Object.keys(next.regions).sort();
    for (const id of ids) if (next.regions[id]) mergeSameColorComponent(next, id);
    next.publicLog.push(`T${next.turn} Player ${actor} shifted ${plan.axis} ${plan.index} ${plan.direction} by half a macro cell${plan.splitCount ? `; split into ${plan.splitCount + 1} components` : ""}.`);
  }, { movedCount: plan.movedCount, splitCount: plan.splitCount, axis: plan.axis, index: plan.index, direction: plan.direction });
}

function planTripleShift(state, payload) {
  const request = normalizeHalfShift(payload);
  if (!request) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const width = state.microWidth;
  const height = macroWidth * scale;
  if (request.index <= 0 || request.index >= macroWidth - 1) return Object.freeze({ ok: false, code: "INVALID_SHIFT_BAND", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  const deltaByBand = new Map([
    [request.index - 1, request.delta],
    [request.index, request.delta * 2],
    [request.index + 1, request.delta],
  ]);
  const sets = {};
  let movedCount = 0;
  let outsideWorld = false;
  for (const [id, region] of Object.entries(state.regions)) {
    const cells = region.micro.map((cell) => {
      const x = cell % width;
      const y = Math.floor(cell / width);
      const band = request.axis === "ROW" ? Math.floor(y / scale) : Math.floor(x / scale);
      const delta = deltaByBand.get(band) || 0;
      if (!delta) return cell;
      movedCount += 1;
      const nextX = request.axis === "ROW" ? x + delta : x;
      const nextY = request.axis === "COLUMN" ? y + delta : y;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) outsideWorld = true;
      return nextY * width + nextX;
    });
    if (outsideWorld) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
    if (!connected(cells, width)) return Object.freeze({ ok: false, code: "SHIFT_DISCONNECTS_REGION", state });
    sets[id] = cells;
  }
  if (!movedCount) return Object.freeze({ ok: false, code: "EMPTY_SHIFT_BAND", state });
  const occupied = new Set();
  for (const cells of Object.values(sets)) {
    for (const cell of cells) {
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (!Number.isInteger(cell) || x < 0 || x >= width || y < 0 || y >= height) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
      if (occupied.has(cell)) return Object.freeze({ ok: false, code: "SHIFT_OVERLAP", state });
      occupied.add(cell);
    }
  }
  return Object.freeze({ ok: true, ...request, movedCount, sets });
}

function applyAreaTripleShift({ state, actor, payload }) {
  const plan = planTripleShift(state, payload);
  if (!plan.ok) return plan;
  return resolved(state, actor, "areaTripleShift", (next) => {
    for (const [id, cells] of Object.entries(plan.sets)) {
      next.regions[id].micro = [...cells].sort((a, b) => a - b);
      next.regions[id].sourceMacros = sourceMacrosFromMicro(cells, next);
    }
    const ids = Object.keys(next.regions).sort();
    for (const id of ids) if (next.regions[id]) mergeSameColorComponent(next, id);
    next.publicLog.push(`T${next.turn} Player ${actor} shifted ${plan.axis} ${plan.index} ${plan.direction}; the center band moved one macro and both adjacent bands moved half a macro.`);
  }, { movedCount: plan.movedCount, axis: plan.axis, index: plan.index, direction: plan.direction });
}

function applyDisruptChoiceOne({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceOne", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 1);
    next.privateEffects[actor] = next.privateEffects[actor] || {};
    next.privateEffects[actor].curseBacklash = (next.privateEffects[actor].curseBacklash || 0) + 1;
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target}; curse backlash is pending.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptChoiceTwo({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceTwo", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 2);
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target} for the next two colorings.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptChoiceThree({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceThree", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 3);
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target} for the next three colorings.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptRandomOne({ state, actor, random }) {
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const color = COLORS[Math.floor(draw * COLORS.length)];
  return resolved(state, actor, "disruptRandomOne", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[color] = Math.max(next.publicEffects[target].seals[color] || 0, 1);
    next.publicLog.push(`T${next.turn} Player ${actor} randomly sealed ${color} for Player ${target} for the next coloring.`);
  }, { color, target: other(actor) });
}

function applyDisruptRandomTwo({ state, actor, random }) {
  const firstDraw = Number(random());
  const secondDraw = Number(random());
  if (![firstDraw, secondDraw].every((draw) => Number.isFinite(draw) && draw >= 0 && draw < 1)) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const remaining = [...COLORS];
  const colors = [remaining.splice(Math.floor(firstDraw * remaining.length), 1)[0]];
  colors.push(remaining[Math.floor(secondDraw * remaining.length)]);
  return resolved(state, actor, "disruptRandomTwo", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    for (const color of colors) next.publicEffects[target].seals[color] = Math.max(next.publicEffects[target].seals[color] || 0, 1);
    next.publicLog.push(`T${next.turn} Player ${actor} randomly sealed ${colors.join(",")} for Player ${target} for the next coloring.`);
  }, { colors, target: other(actor) });
}

function applyDisruptPaletteRandom({ state, actor, random }) {
  const colorDraw = Number(random());
  const slotDraw = Number(random());
  if (![colorDraw, slotDraw].every((draw) => Number.isFinite(draw) && draw >= 0 && draw < 1)) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = COLORS[Math.floor(colorDraw * COLORS.length)];
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptPaletteRandom", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    const previousColor = paletteColorAt(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.privateEffects[target].paletteDebuffs = [{ slot, previousColor, injectedColor: color, remaining: 1 }, ...(next.privateEffects[target].paletteDebuffs || [])];
    next.publicLog.push(`T${next.turn} Player ${actor} randomly injected ${color} into one private palette slot of Player ${target} for the next coloring.`);
  }, { color, target });
}

function applyDisruptPaletteChoice({ state, actor, payload, random }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const slotDraw = Number(random());
  if (!Number.isFinite(slotDraw) || slotDraw < 0 || slotDraw >= 1) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = payload.color;
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptPaletteChoice", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    const previousColor = paletteColorAt(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.privateEffects[target].paletteDebuffs = [{ slot, previousColor, injectedColor: color, remaining: 2 }, ...(next.privateEffects[target].paletteDebuffs || [])];
    next.publicLog.push(`T${next.turn} Player ${actor} injected chosen ${color} into one private palette slot of Player ${target} for the next two colorings.`);
  }, { color, target });
}

function applyDisruptForcedPalette({ state, actor, payload, random }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const slotDraw = Number(random());
  if (!Number.isFinite(slotDraw) || slotDraw < 0 || slotDraw >= 1) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = payload.color;
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptForcedPalette", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.publicLog.push(`T${next.turn} Player ${actor} permanently injected chosen ${color} into one private palette slot of Player ${target}.`);
  }, { color, target });
}

function paletteBeforeSeals(state, actor) {
  const colors = new Set(state.basicPalettes[actor]);
  if (state.bonusUsesRemaining[actor] > 0) colors.add(state.bonusColors[actor]);
  if (state.privateEffects[actor]?.prism) for (const color of COLORS) colors.add(color);
  return [...colors];
}

function applyCurseBacklashOnEnterColor(state, actor, random) {
  const count = Math.max(0, Number(state.privateEffects[actor]?.curseBacklash) || 0);
  if (!count) return state;
  state.publicEffects[actor] = state.publicEffects[actor] || { seals: {} };
  state.publicEffects[actor].seals = state.publicEffects[actor].seals || {};
  const sealed = [];
  for (let index = 0; index < count; index += 1) {
    const candidates = paletteBeforeSeals(state, actor).filter((color) => !(state.publicEffects[actor].seals[color] > 0));
    if (!candidates.length) break;
    const draw = Number(random());
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
    const color = candidates[Math.floor(draw * candidates.length)];
    state.publicEffects[actor].seals[color] = Math.max(state.publicEffects[actor].seals[color] || 0, 1);
    sealed.push(color);
  }
  delete state.privateEffects[actor].curseBacklash;
  state.publicLog.push(sealed.length
    ? `Curse backlash sealed ${sealed.join(",")} for Player ${actor} for this coloring.`
    : `Curse backlash resolved empty for Player ${actor}.`);
  return state;
}

function tickSealsAfterColor(state, actor) {
  const seals = state.publicEffects?.[actor]?.seals || {};
  for (const color of COLORS) if (seals[color] > 0) seals[color] -= 1;
  return state;
}

function tickPaletteDebuffsAfterColor(state, actor) {
  const effects = state.privateEffects?.[actor]?.paletteDebuffs || [];
  const remaining = [];
  for (const effect of effects) {
    const nextRemaining = effect.remaining - 1;
    if (nextRemaining > 0) remaining.push({ ...effect, remaining: nextRemaining });
    else if (paletteColorAt(state, actor, effect.slot) === effect.injectedColor) setPaletteColorAt(state, actor, effect.slot, effect.previousColor);
  }
  if (remaining.length) state.privateEffects[actor].paletteDebuffs = remaining;
  else if (state.privateEffects?.[actor]) delete state.privateEffects[actor].paletteDebuffs;
  return state;
}

module.exports = {
  applyAreaCornerBloom,
  applyAreaDiePlus,
  applyAreaHalfShift,
  applyAreaMicroBloom,
  applyAreaResize,
  applyAreaTripleShift,
  applyColorChoiceBorrow,
  applyColorPaletteChange,
  applyColorRandomBorrow,
  applyColorPrism,
  applyColorRegionSplit,
  applyCurseBacklashOnEnterColor,
  applyDisruptChoiceOne,
  applyDisruptChoiceThree,
  applyDisruptChoiceTwo,
  applyDisruptForcedPalette,
  applyDisruptPaletteChoice,
  applyDisruptRandomOne,
  applyDisruptRandomTwo,
  applyDisruptPaletteRandom,
  microBloomCandidates,
  cornerBloomPlan,
  preparedOutgoingCandidates,
  planHalfShift,
  planTripleShift,
  tickSealsAfterColor,
  tickPaletteDebuffsAfterColor,
};

},
"standard/standard-skill-dispatcher.js":function(require,module,exports){
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

},
"standard/standard-match.js":function(require,module,exports){
"use strict";

const {
  COLORS,
  StandardRuleError,
  adjacentRegionIds,
} = require("./standard-engine.js");
const { dispatchStandardSkillAction } = require("./standard-skill-dispatcher.js");
const { applyCurseBacklashOnEnterColor, preparedOutgoingCandidates, tickPaletteDebuffsAfterColor, tickSealsAfterColor } = require("./standard-skill-handlers.js");

const SCHEMA_VERSION = 1;
const ENGINE_VERSION = "5.0.0-alpha.1";
const SAVE_KEY = "fourColorMapGame.standard.v5.save";
const PHASES = Object.freeze(["CREATE_FIRST", "COLOR", "WORK", "GAME_OVER"]);
const ACTIONS = Object.freeze(["CREATE_REGION", "COLOR_REGION", "USE_SKILL", "DECLARE_NO_COLOR", "SURRENDER"]);
const REQUIRED_RNG_STREAMS = Object.freeze([
  "match-init", "palette", "bonus-color", "bonus-use-count", "die", "skill-effect",
  "cpu-A", "cpu-B", "cpu-tie-break", "quiz-structure", "quiz-content",
  "quiz-choice-order", "quiz-choice-rank", "quiz-cosmetic-motion", "gacha",
]);
const DIE_POOL = Object.freeze([1, 1, 2, 2, 3, 4]);
const BONUS_USE_POOL = Object.freeze([1, 1, 2, 2, 3, 4]);
const TERMINAL_REASONS = Object.freeze(["ILLEGAL_COLOR", "BOARD_LOCK", "SURRENDER", "SEALED_OUT", "NO_LEGAL_COLOR"]);
const ENGINE_TERMINAL_REASONS = TERMINAL_REASONS;
const FINISHED_STATE_TERMINAL_REASONS = TERMINAL_REASONS;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fail(code, state) {
  return Object.freeze({ ok: false, code, state });
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function assertState(condition, code) {
  if (!condition) throw new StandardRuleError(code, code);
}

function nextRandom(rngStreams, name) {
  const source = rngStreams?.[name];
  const value = typeof source === "function" ? source() : source?.next?.();
  assertState(Number.isFinite(value) && value >= 0 && value < 1, "RNG_REQUIRED_" + name.toUpperCase().replaceAll("-", "_"));
  return value;
}

function shuffledColors(rngStreams) {
  const values = [...COLORS];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(nextRandom(rngStreams, "palette") * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values.slice(0, 3);
}

function initialSeatSecrets(rngStreams) {
  const palette = shuffledColors(rngStreams);
  const bonus = palette[Math.floor(nextRandom(rngStreams, "bonus-color") * palette.length)];
  const basic = palette.filter((color) => color !== bonus);
  const uses = BONUS_USE_POOL[Math.floor(nextRandom(rngStreams, "bonus-use-count") * BONUS_USE_POOL.length)];
  return { basic, bonus, uses };
}

function paletteSignature(secrets) {
  return [...secrets.basic, secrets.bonus].sort().join("|");
}

function handFromLoadout(loadout = {}) {
  const hand = {};
  for (const entries of Object.values(loadout)) {
    for (const skill of Array.isArray(entries) ? entries : []) hand[skill] = 1;
  }
  return hand;
}

function playableMacroIndices(bounds) {
  const result = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) result.push(row * bounds.macroWidth + col);
  }
  return result;
}

function createStandardMatch(config = {}, rngStreams = {}) {
  assertState(typeof config.matchId === "string" && config.matchId.length > 0, "MATCH_ID_REQUIRED");
  const A = initialSeatSecrets(rngStreams);
  let B = initialSeatSecrets(rngStreams);
  for (let retries = 0; paletteSignature(B) === paletteSignature(A) && retries < 15; retries += 1) {
    B = initialSeatSecrets(rngStreams);
  }
  if (paletteSignature(B) === paletteSignature(A)) {
    const missing = COLORS.find((color) => ![...B.basic, B.bonus].includes(color));
    B = { ...B, basic: [B.basic[1], missing] };
  }
  const active = config.firstSeat || (nextRandom(rngStreams, "match-init") < 0.5 ? "A" : "B");
  const rolledSize = DIE_POOL[Math.floor(nextRandom(rngStreams, "die") * DIE_POOL.length)];
  const loadouts = clone(config.loadouts || { A: {}, B: {} });
  const playableBounds = clone(config.playableBounds || { minCol: 1, maxCol: 10, minRow: 1, maxRow: 10, macroWidth: 12, microScale: 4 });
  const state = {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    mode: "standard",
    matchId: config.matchId,
    status: "ACTIVE",
    version: 0,
    turn: 1,
    active,
    phase: "CREATE_FIRST",
    regions: {},
    pending: null,
    reserved: null,
    preparedOutgoing: null,
    playableBounds,
    trophyTargetMacros: playableMacroIndices(playableBounds),
    microWidth: Number(config.microWidth) || 48,
    requiredSize: rolledSize,
    rolledSize,
    baseRequiredSize: rolledSize,
    basicPalettes: { A: A.basic, B: B.basic },
    bonusColors: { A: A.bonus, B: B.bonus },
    bonusUsesRemaining: { A: A.uses, B: B.uses },
    hands: config.hands ? clone(config.hands) : { A: handFromLoadout(loadouts.A), B: handFromLoadout(loadouts.B) },
    loadouts,
    publicEffects: clone(config.publicEffects || { A: { seals: {} }, B: { seals: {} } }),
    privateEffects: clone(config.privateEffects || { A: {}, B: {} }),
    interferenceLock: false,
    skillsUsed: { A: 0, B: 0 },
    winner: null,
    terminalReason: null,
    publicLog: ["Standard match created."],
  };
  validateStandardState(state);
  return state;
}

function validateStandardState(state) {
  assertState(state && typeof state === "object", "INVALID_STATE");
  assertState(state.schemaVersion === SCHEMA_VERSION, "INVALID_SCHEMA_VERSION");
  assertState(state.engineVersion === ENGINE_VERSION, "INVALID_ENGINE_VERSION");
  assertState(state.mode === "standard", "WRONG_MODE");
  assertState(typeof state.matchId === "string" && state.matchId.length > 0, "INVALID_MATCH_ID");
  assertState(Number.isInteger(state.version) && state.version >= 0, "INVALID_VERSION");
  assertState(Number.isInteger(state.turn) && state.turn >= 1, "INVALID_TURN");
  assertState(state.active === "A" || state.active === "B", "INVALID_ACTIVE_SEAT");
  assertState(PHASES.includes(state.phase), "INVALID_PHASE");
  assertState(state.status === "ACTIVE" || state.status === "FINISHED", "INVALID_STATUS");
  assertState(Number.isInteger(state.rolledSize) && state.rolledSize >= 1 && state.rolledSize <= 4, "INVALID_ROLLED_SIZE");
  assertState(Number.isInteger(state.baseRequiredSize) && state.baseRequiredSize >= 0 && state.baseRequiredSize <= 4, "INVALID_BASE_REQUIRED_SIZE");
  assertState(Number.isInteger(state.requiredSize) && state.requiredSize >= 0 && state.requiredSize <= 5, "INVALID_REQUIRED_SIZE");
  if (state.status === "ACTIVE") assertState(state.baseRequiredSize >= 1 && state.requiredSize >= 1, "INVALID_REQUIRED_SIZE");
  const bounds = state.playableBounds;
  assertState(bounds && [bounds.minCol, bounds.maxCol, bounds.minRow, bounds.maxRow, bounds.macroWidth, bounds.microScale].every(Number.isInteger)
    && bounds.macroWidth >= 6 && bounds.microScale >= 1 && state.microWidth === bounds.macroWidth * bounds.microScale
    && bounds.minCol >= 0 && bounds.minCol <= bounds.maxCol && bounds.maxCol < bounds.macroWidth
    && bounds.minRow >= 0 && bounds.minRow <= bounds.maxRow && bounds.maxRow < bounds.macroWidth
    && bounds.maxCol - bounds.minCol + 1 >= 6 && bounds.maxRow - bounds.minRow + 1 >= 6, "INVALID_PLAYABLE_BOUNDS");
  assertState(state.trophyTargetMacros === undefined || (Array.isArray(state.trophyTargetMacros)
    && new Set(state.trophyTargetMacros).size === state.trophyTargetMacros.length
    && state.trophyTargetMacros.every((macro) => Number.isInteger(macro) && macro >= 0 && macro < bounds.macroWidth * bounds.macroWidth)), "INVALID_TROPHY_TARGETS");
  const trophyTargets = new Set(state.trophyTargetMacros || playableMacroIndices(bounds));
  assertState(playableMacroIndices(bounds).every((macro) => trophyTargets.has(macro)), "INVALID_TROPHY_TARGETS");
  const worldMicroCount = state.microWidth * bounds.macroWidth * bounds.microScale;
  assertState(Boolean(state.regions) && typeof state.regions === "object", "INVALID_REGIONS");
  assertState(Boolean(state.hands) && Boolean(state.loadouts), "INVALID_CARDS");
  assertState(typeof state.interferenceLock === "boolean", "INVALID_INTERFERENCE_LOCK");
  assertState(Array.isArray(state.publicLog), "INVALID_PUBLIC_LOG");
  if (state.preparedOutgoing !== null && state.preparedOutgoing !== undefined) {
    const prepared = state.preparedOutgoing;
    assertState((prepared.actor === "A" || prepared.actor === "B") && Array.isArray(prepared.sourceMacros)
      && prepared.sourceMacros.length > 0 && new Set(prepared.sourceMacros).size === prepared.sourceMacros.length
      && prepared.sourceMacros.every((macro) => Number.isInteger(macro) && macro >= 0)
      && Array.isArray(prepared.micro) && prepared.micro.length > 0 && new Set(prepared.micro).size === prepared.micro.length
      && prepared.micro.every((cell) => Number.isInteger(cell) && cell >= 0)
      && Array.isArray(prepared.skills) && prepared.skills.length > 0
      && new Set(prepared.skills).size === prepared.skills.length
      && prepared.skills.every((skill) => ["areaMicroBloom", "areaCornerBloom"].includes(skill)), "INVALID_PREPARED_OUTGOING");
    const microHeight = bounds.macroWidth * bounds.microScale;
    assertState(state.status === "ACTIVE" && ["CREATE_FIRST", "WORK"].includes(state.phase)
      && prepared.actor === state.active && state.pending === null
      && prepared.sourceMacros.length === state.requiredSize
      && isConnected(prepared.sourceMacros, bounds.macroWidth)
      && prepared.sourceMacros.every((macro) => {
        const col = macro % bounds.macroWidth;
        const row = Math.floor(macro / bounds.macroWidth);
        return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
      })
      && prepared.micro.every((cell) => cell < state.microWidth * microHeight), "INVALID_PREPARED_OUTGOING");
    const uncoloredOccupied = new Set(Object.values(state.regions).filter((region) => !region.color).flatMap((region) => region.micro || []));
    assertState(prepared.micro.every((cell) => !uncoloredOccupied.has(cell)) && isConnected(prepared.micro, state.microWidth), "INVALID_PREPARED_OUTGOING");
    const candidates = preparedOutgoingCandidates({ ...state, preparedOutgoing: null }, prepared.sourceMacros, prepared.skills);
    assertState(candidates.some((candidate) => JSON.stringify(candidate) === JSON.stringify(prepared.micro)), "INVALID_PREPARED_OUTGOING");
  }
  const occupied = new Set();
  const pendingRegionIds = [];
  const reservedRegionIds = [];
  for (const [id, region] of Object.entries(state.regions)) {
    assertState(region?.id === id && Array.isArray(region.micro), "INVALID_REGION");
    if (region.isPending) {
      pendingRegionIds.push(id);
      assertState(region.color === null || region.color === undefined, "INVALID_PENDING_STATE");
    }
    if (region.isReserved) {
      reservedRegionIds.push(id);
      assertState(!region.isPending && (region.color === null || region.color === undefined), "INVALID_RESERVED_STATE");
    }
    for (const cell of region.micro) {
      assertState(Number.isInteger(cell) && cell >= 0 && cell < worldMicroCount && !occupied.has(cell), "INVALID_REGION_GEOMETRY");
      occupied.add(cell);
    }
  }
  assertState(pendingRegionIds.length <= 1, "INVALID_PENDING_STATE");
  if (state.pending === null) assertState(pendingRegionIds.length === 0, "INVALID_PENDING_STATE");
  else assertState(pendingRegionIds.length === 1 && pendingRegionIds[0] === state.pending, "INVALID_PENDING_STATE");
  assertState(reservedRegionIds.length <= 1, "INVALID_RESERVED_STATE");
  if (state.reserved === null || state.reserved === undefined) assertState(reservedRegionIds.length === 0, "INVALID_RESERVED_STATE");
  else assertState(reservedRegionIds.length === 1 && reservedRegionIds[0] === state.reserved && state.reserved !== state.pending, "INVALID_RESERVED_STATE");
  for (const seat of ["A", "B"]) {
    const basic = state.basicPalettes?.[seat];
    const bonus = state.bonusColors?.[seat];
    assertState(Array.isArray(basic) && basic.length === 2, "INVALID_PALETTE");
    assertState([...basic, bonus].every((color) => COLORS.includes(color)), "INVALID_PALETTE");
    assertState(Number.isInteger(state.bonusUsesRemaining?.[seat]) && state.bonusUsesRemaining[seat] >= 0, "INVALID_BONUS_USES");
    const temporaryColors = state.privateEffects?.[seat]?.temporaryColors;
    assertState(temporaryColors === undefined || (Array.isArray(temporaryColors)
      && temporaryColors.every((color) => COLORS.includes(color))
      && new Set(temporaryColors).size === temporaryColors.length), "INVALID_TEMPORARY_COLORS");
    const paletteDebuffs = state.privateEffects?.[seat]?.paletteDebuffs;
    assertState(paletteDebuffs === undefined || (Array.isArray(paletteDebuffs)
      && new Set(paletteDebuffs.map((effect) => effect.slot)).size === paletteDebuffs.length
      && paletteDebuffs.every((effect) => effect && Number.isInteger(effect.slot) && effect.slot >= 0 && effect.slot <= 2
        && COLORS.includes(effect.previousColor) && COLORS.includes(effect.injectedColor)
        && Number.isInteger(effect.remaining) && effect.remaining >= 1 && effect.remaining <= 2
        && (effect.slot < 2 ? state.basicPalettes[seat][effect.slot] : state.bonusColors[seat]) === effect.injectedColor)), "INVALID_PALETTE_DEBUFFS");
  }
  if (state.status === "FINISHED") assertState(state.phase === "GAME_OVER" && ["A", "B"].includes(state.winner) && FINISHED_STATE_TERMINAL_REASONS.includes(state.terminalReason), "INVALID_TERMINAL_STATE");
  if (state.phase === "GAME_OVER") assertState(state.status === "FINISHED", "INVALID_TERMINAL_STATE");
  return true;
}

function projectStandardPublicState(state) {
  validateStandardState(state);
  const keys = ["schemaVersion", "engineVersion", "mode", "matchId", "status", "version", "turn", "active", "phase", "regions", "pending", "reserved", "preparedOutgoing", "playableBounds", "trophyTargetMacros", "requiredSize", "rolledSize", "baseRequiredSize", "publicEffects", "interferenceLock", "winner", "terminalReason", "publicLog"];
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, clone(key === "trophyTargetMacros"
    ? (state.trophyTargetMacros || playableMacroIndices(state.playableBounds))
    : state[key])] )));
}

function projectStandardPrivateState(state, seat) {
  validateStandardState(state);
  assertState(seat === "A" || seat === "B", "NOT_A_PLAYER");
  return Object.freeze({
    seat,
    basicPalette: clone(state.basicPalettes[seat]),
    bonusColor: state.bonusColors[seat],
    bonusUsesRemaining: state.bonusUsesRemaining[seat],
    hand: clone(state.hands[seat]),
    loadout: clone(state.loadouts[seat]),
    privateEffects: clone(state.privateEffects[seat]),
  });
}

function isMapCompleteWin(state) {
  validateStandardState(state);
  if (state.status !== "FINISHED" || state.terminalReason !== "BOARD_LOCK" || !["A", "B"].includes(state.winner)) return false;
  const coloredOwners = new Set(Object.values(state.regions).filter((region) => region.color).flatMap((region) => region.micro || []));
  for (const macro of state.trophyTargetMacros || playableMacroIndices(state.playableBounds)) {
    if (macroMicroCells(macro, state.playableBounds, state.microWidth).some((cell) => !coloredOwners.has(cell))) return false;
  }
  return Object.values(state.regions).every((region) => Boolean(region.color) && !region.isPending);
}

function regionNumber(id) {
  const match = String(id).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function isConnected(cellsInput, width) {
  if (!cellsInput.length) return false;
  const cells = new Set(cellsInput);
  const seen = new Set([cellsInput[0]]);
  const queue = [cellsInput[0]];
  while (queue.length) {
    const cell = queue.shift();
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    for (const neighbor of neighbors) if (cells.has(neighbor) && !seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
  }
  return seen.size === cells.size;
}

function connectedComponents(cellsInput, width) {
  const remaining = new Set(cellsInput);
  const parts = [];
  while (remaining.size) {
    const start = Math.min(...remaining);
    const part = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const cell = queue.shift();
      part.push(cell);
      const x = cell % width;
      const neighbors = [cell - width, cell + width];
      if (x > 0) neighbors.push(cell - 1);
      if (x < width - 1) neighbors.push(cell + 1);
      for (const neighbor of neighbors) if (remaining.delete(neighbor)) queue.push(neighbor);
    }
    parts.push(part.sort((left, right) => left - right));
  }
  return parts.sort((left, right) => left[0] - right[0]);
}

function sourceMacrosFromMicro(cells, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  return [...new Set(cells.map((cell) => {
    const x = cell % state.microWidth;
    const y = Math.floor(cell / state.microWidth);
    return Math.floor(y / scale) * macroWidth + Math.floor(x / scale);
  }))].sort((left, right) => left - right);
}

function geometryTouchesExisting(micro, regions, microWidth) {
  const shape = new Set(micro);
  const occupied = new Set(Object.values(regions).flatMap((region) => region.micro || []));
  for (const cell of shape) {
    const x = cell % microWidth;
    const neighbors = [cell - microWidth, cell + microWidth];
    if (x > 0) neighbors.push(cell - 1);
    if (x < microWidth - 1) neighbors.push(cell + 1);
    if (neighbors.some((neighbor) => !shape.has(neighbor) && occupied.has(neighbor))) return true;
  }
  return false;
}

function transferPreparedIntrusions(state, micro, firstSplitNumber) {
  const owners = new Map(Object.values(state.regions).flatMap((region) => (region.micro || []).map((cell) => [cell, region.id])));
  const donors = new Set();
  for (const cell of micro) {
    const donorId = owners.get(cell);
    if (!donorId) continue;
    assertState(Boolean(state.regions[donorId]?.color), "PREPARED_OVERLAP_UNCOLORED");
    state.regions[donorId].micro = state.regions[donorId].micro.filter((candidate) => candidate !== cell);
    donors.add(donorId);
  }
  let nextNumber = firstSplitNumber;
  let splitCount = 0;
  let removedCount = 0;
  for (const donorId of [...donors].sort((left, right) => regionNumber(left) - regionNumber(right))) {
    const donor = state.regions[donorId];
    if (!donor.micro.length) {
      delete state.regions[donorId];
      removedCount += 1;
      continue;
    }
    const parts = connectedComponents(donor.micro, state.microWidth);
    donor.micro = parts[0];
    donor.sourceMacros = sourceMacrosFromMicro(parts[0], state);
    for (const part of parts.slice(1)) {
      const id = `R${nextNumber}`;
      nextNumber += 1;
      state.regions[id] = {
        ...donor,
        id,
        micro: part,
        sourceMacros: sourceMacrosFromMicro(part, state),
        controllers: [...(donor.controllers || [])],
        isPending: false,
        isReserved: false,
      };
      splitCount += 1;
    }
  }
  return Object.freeze({ donorCount: donors.size, splitCount, removedCount });
}

function macroMicroCells(macro, bounds, microWidth) {
  const macroWidth = bounds.macroWidth;
  const scale = bounds.microScale;
  const col = macro % macroWidth;
  const row = Math.floor(macro / macroWidth);
  const result = [];
  for (let dy = 0; dy < scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) result.push((row * scale + dy) * microWidth + col * scale + dx);
  }
  return result;
}

function touchesExistingRegion(sourceMacros, regions, macroWidth) {
  const occupied = new Set(Object.values(regions).flatMap((region) => region.sourceMacros || []));
  return sourceMacros.some((macro) => {
    const col = macro % macroWidth;
    const neighbors = [macro - macroWidth, macro + macroWidth];
    if (col > 0) neighbors.push(macro - 1);
    if (col < macroWidth - 1) neighbors.push(macro + 1);
    return neighbors.some((neighbor) => occupied.has(neighbor));
  });
}

function hasLegalRegionOfSize(state, size) {
  if (!Number.isInteger(size) || size < 1) return false;
  const bounds = state.playableBounds;
  const width = bounds.macroWidth;
  const occupied = new Set(Object.values(state.regions).flatMap((region) => region.sourceMacros || []));
  const free = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      const macro = row * width + col;
      if (!occupied.has(macro)) free.push(macro);
    }
  }
  if (free.length < size) return false;
  const freeSet = new Set(free);
  const seen = new Set();
  function search(selected, frontier) {
    const signature = [...selected].sort((a, b) => a - b).join(",");
    if (seen.has(signature)) return false;
    seen.add(signature);
    if (selected.size === size) return !occupied.size || touchesExistingRegion([...selected], state.regions, width);
    for (const macro of frontier) {
      const nextSelected = new Set(selected).add(macro);
      const nextFrontier = new Set(frontier);
      nextFrontier.delete(macro);
      const col = macro % width;
      const around = [macro - width, macro + width];
      if (col > 0) around.push(macro - 1);
      if (col < width - 1) around.push(macro + 1);
      for (const next of around) if (freeSet.has(next) && !nextSelected.has(next)) nextFrontier.add(next);
      if (search(nextSelected, nextFrontier)) return true;
    }
    return false;
  }
  for (const start of free) {
    const col = start % width;
    const around = [start - width, start + width];
    if (col > 0) around.push(start - 1);
    if (col < width - 1) around.push(start + 1);
    if (search(new Set([start]), new Set(around.filter((macro) => freeSet.has(macro))))) return true;
  }
  return false;
}

function bestLegalSize(state, maximum) {
  for (let size = maximum; size >= 1; size -= 1) if (hasLegalRegionOfSize(state, size)) return size;
  return 0;
}

function createRegion(state, actor, payload = {}, rngStreams = {}) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "CREATE_FIRST" || state.phase === "WORK", "WRONG_PHASE");
  assertState(!state.pending, "PENDING_EXISTS");
  const rawSourceMacros = Array.isArray(payload.sourceMacros) ? payload.sourceMacros : [];
  const sourceMacros = [...new Set(rawSourceMacros)].sort((a, b) => a - b);
  assertState(rawSourceMacros.length === sourceMacros.length, "DUPLICATE_REGION_CELL");
  const prepared = state.preparedOutgoing;
  if (prepared) {
    assertState(prepared.actor === actor, "PREPARED_WRONG_ACTOR");
    assertState(JSON.stringify(sourceMacros) === JSON.stringify(prepared.sourceMacros), "PREPARED_SELECTION_MISMATCH");
  }
  assertState(sourceMacros.length === state.requiredSize, "WRONG_REGION_SIZE");
  const bounds = state.playableBounds;
  assertState(sourceMacros.every((macro) => {
    if (!Number.isInteger(macro) || macro < 0) return false;
    const col = macro % bounds.macroWidth;
    const row = Math.floor(macro / bounds.macroWidth);
    return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
  }), "OUTSIDE_PLAYABLE_BOUNDS");
  assertState(isConnected(sourceMacros, bounds.macroWidth), "REGION_NOT_CONNECTED");
  const micro = prepared ? [...prepared.micro] : sourceMacros.flatMap((macro) => macroMicroCells(macro, bounds, state.microWidth));
  assertState(isConnected(micro, state.microWidth), "REGION_NOT_CONNECTED");
  if (Object.keys(state.regions).length) {
    assertState(prepared ? geometryTouchesExisting(micro, state.regions, state.microWidth) : touchesExistingRegion(sourceMacros, state.regions, bounds.macroWidth), "REGION_NOT_ADJACENT");
  }
  const occupied = new Set(Object.values(state.regions).flatMap((region) => region.micro || []));
  if (!prepared) assertState(micro.every((cell) => !occupied.has(cell)), "REGION_OVERLAP");
  const idNumber = Math.max(0, ...Object.keys(state.regions).map(regionNumber)) + 1;
  const id = `R${idNumber}`;
  const next = clone(state);
  const intrusion = prepared ? transferPreparedIntrusions(next, micro, idNumber + 1) : { donorCount: 0, splitCount: 0, removedCount: 0 };
  next.regions[id] = { id, micro, sourceMacros, controllers: [actor], color: null, isPending: true };
  next.pending = id;
  next.preparedOutgoing = null;
  next.active = other(actor);
  next.phase = "COLOR";
  next.turn += 1;
  next.interferenceLock = false;
  next.version += 1;
  next.publicLog.push(`T${next.turn - 1} Player ${actor} created ${id}${intrusion.donorCount ? ` with ${intrusion.donorCount} colored-region intrusion${intrusion.splitCount ? ` and ${intrusion.splitCount} donor split` : ""}${intrusion.removedCount ? ` and ${intrusion.removedCount} donor removal` : ""}` : ""}; Player ${next.active} must color it.`);
  applyCurseBacklashOnEnterColor(next, next.active, () => nextRandom(rngStreams, "skill-effect"));
  const contactColorCount = new Set(adjacentRegionIds(next, id)
    .map((regionId) => next.regions[regionId])
    .filter((region) => region && !region.isPending && region.color)
    .map((region) => region.color)).size;
  return { ok: true, code: "OK", state: next, regionId: id, contactColorCount };
}

function availableColors(state, actor) {
  const colors = new Set(state.basicPalettes[actor]);
  if (state.bonusUsesRemaining[actor] > 0) colors.add(state.bonusColors[actor]);
  for (const color of state.privateEffects[actor]?.temporaryColors || []) colors.add(color);
  if (state.privateEffects[actor]?.prism) for (const color of COLORS) colors.add(color);
  const seals = state.publicEffects?.[actor]?.seals || {};
  return [...colors].filter((color) => !(seals[color] > 0));
}

function colorRegion(state, actor, payload = {}, rngStreams = {}) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "COLOR" && state.pending, "WRONG_PHASE");
  const color = payload.color;
  assertState(COLORS.includes(color) && availableColors(state, actor).includes(color), "COLOR_UNAVAILABLE");
  const next = clone(state);
  if (adjacentRegionIds(state, state.pending).some((id) => state.regions[id].color === color)) {
    if (next.privateEffects[actor]?.prism) delete next.privateEffects[actor].prism;
    if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
    next.status = "FINISHED";
    next.phase = "GAME_OVER";
    next.winner = other(actor);
    next.terminalReason = "ILLEGAL_COLOR";
    next.version += 1;
    next.publicLog.push(`T${next.turn} Player ${actor} lost by illegal coloring.`);
    return { ok: true, code: "ILLEGAL_COLOR", state: next };
  }
  const target = next.regions[next.pending];
  target.color = color;
  target.isPending = false;
  if (!target.controllers.includes(actor)) target.controllers.push(actor);
  const prism = Boolean(next.privateEffects[actor]?.prism);
  const temporary = (next.privateEffects[actor]?.temporaryColors || []).includes(color);
  const hasUnlimitedBasicSlot = next.basicPalettes[actor].includes(color);
  if (!prism && !temporary && !hasUnlimitedBasicSlot && color === next.bonusColors[actor]) next.bonusUsesRemaining[actor] -= 1;
  if (prism) delete next.privateEffects[actor].prism;
  if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
  tickSealsAfterColor(next, actor);
  tickPaletteDebuffsAfterColor(next, actor);
  if (next.reserved) {
    const returnedId = next.reserved;
    const returned = next.regions[returnedId];
    next.reserved = null;
    returned.isReserved = false;
    returned.isPending = true;
    next.pending = returnedId;
    next.active = other(actor);
    next.phase = "COLOR";
    next.turn += 1;
    next.interferenceLock = false;
    applyCurseBacklashOnEnterColor(next, next.active, () => nextRandom(rngStreams, "skill-effect"));
    next.version += 1;
    next.publicLog.push(`Player ${actor} colored ${target.id}; split region ${returnedId} returned to Player ${next.active}.`);
    return { ok: true, code: "OK", state: next, returnedRegionId: returnedId };
  }
  next.pending = null;
  next.phase = "WORK";
  next.rolledSize = DIE_POOL[Math.floor(nextRandom(rngStreams, "die") * DIE_POOL.length)];
  next.baseRequiredSize = bestLegalSize(next, next.rolledSize);
  next.requiredSize = next.baseRequiredSize;
  if (next.requiredSize <= 0) {
    next.status = "FINISHED";
    next.phase = "GAME_OVER";
    next.winner = actor;
    next.terminalReason = "BOARD_LOCK";
  }
  next.version += 1;
  next.publicLog.push(`Player ${actor} colored ${target.id}.`);
  return { ok: true, code: "OK", state: next };
}

function surrender(state, actor) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  const next = clone(state);
  if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
  next.preparedOutgoing = null;
  next.status = "FINISHED";
  next.phase = "GAME_OVER";
  next.winner = other(actor);
  next.terminalReason = "SURRENDER";
  next.version += 1;
  next.publicLog.push(`Player ${actor} surrendered.`);
  return { ok: true, code: "OK", state: next };
}

function declareNoColor(state, actor) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "COLOR", "WRONG_PHASE");
  const usable = availableColors(state, actor);
  const blocked = new Set(adjacentRegionIds(state, state.pending).map((id) => state.regions[id]?.color).filter(Boolean));
  assertState(usable.every((color) => blocked.has(color)), "COLOR_AVAILABLE");
  const next = clone(state);
  if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
  next.status = "FINISHED";
  next.phase = "GAME_OVER";
  next.winner = other(actor);
  next.terminalReason = usable.length === 0 ? "SEALED_OUT" : "NO_LEGAL_COLOR";
  next.version += 1;
  next.publicLog.push(`Player ${actor} declared no usable color.`);
  return { ok: true, code: "OK", state: next };
}

function applyStandardAction({ state, actor, action, expectedVersion, rngStreams = {} }) {
  validateStandardState(state);
  if (expectedVersion !== state.version) return fail("VERSION_CONFLICT", state);
  if (!action || !ACTIONS.includes(action.type)) return fail("UNKNOWN_ACTION", state);
  if (state.status === "FINISHED") return fail("MATCH_FINISHED", state);
  try {
    let result;
    if (action.type === "CREATE_REGION") result = createRegion(state, actor, action.payload, rngStreams);
    else if (action.type === "COLOR_REGION") result = colorRegion(state, actor, action.payload, rngStreams);
    else if (action.type === "DECLARE_NO_COLOR") result = declareNoColor(state, actor);
    else if (action.type === "SURRENDER") result = surrender(state, actor);
    else {
      return dispatchStandardSkillAction({
        state,
        actor,
        action,
        expectedVersion,
        rngStreams,
        validateState: validateStandardState,
        projectPublic: projectStandardPublicState,
        projectPrivate: projectStandardPrivateState,
        hasLegalRegionOfSize,
        bestLegalSize,
      });
    }
    if (result.ok) {
      assertState(result.state.version === state.version + 1, "VERSION_INCREMENT_INVARIANT");
      validateStandardState(result.state);
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof StandardRuleError) return fail(error.code, state);
    throw error;
  }
}

function encodeStandardMatch(state, rngSnapshot) {
  validateStandardState(state);
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, state, rngSnapshot: clone(rngSnapshot || {}) });
}

function decodeStandardMatch(payload) {
  const decoded = typeof payload === "string" ? JSON.parse(payload) : clone(payload);
  assertState(decoded?.schemaVersion === SCHEMA_VERSION, "INVALID_SAVE_SCHEMA");
  validateStandardState(decoded.state);
  return Object.freeze({ state: decoded.state, rngSnapshot: decoded.rngSnapshot || {} });
}

module.exports = {
  ACTIONS,
  BONUS_USE_POOL,
  DIE_POOL,
  ENGINE_VERSION,
  ENGINE_TERMINAL_REASONS,
  FINISHED_STATE_TERMINAL_REASONS,
  PHASES,
  REQUIRED_RNG_STREAMS,
  SAVE_KEY,
  SCHEMA_VERSION,
  TERMINAL_REASONS,
  applyStandardAction,
  createStandardMatch,
  decodeStandardMatch,
  encodeStandardMatch,
  isMapCompleteWin,
  projectStandardPrivateState,
  projectStandardPublicState,
  validateStandardState,
};

},
"standard/standard-cpu.js":function(require,module,exports){
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

},
"standard/standard-cpu-roster.js":function(require,module,exports){
"use strict";

const cpu = require("./standard-cpu.js");
const { STANDARD_SKILLS } = require("./standard-skill-registry.js");

const ROSTER_VERSION = "standard-character-roster-v1";
const RANDOM_SKILLS = new Set(["colorRandomBorrow", "areaMicroBloom", "disruptRandomOne", "disruptRandomTwo", "disruptPaletteRandom", "disruptPaletteChoice", "disruptForcedPalette"]);

const definitions = [
  ["yuzu", "うっかりユズ", "あっ、こっちも塗れそう！", "小さなエリアをテンポよく作る", "終盤の色不足とスキル機会を見落としがち", ["colorRandomBorrow", "areaMicroBloom"], ["colorRandomBorrow", "colorChoiceBorrow", "areaMicroBloom", "areaDiePlus", "disruptRandomOne", "disruptChoiceOne"], [1, .92, .28, .34, .10, .68, .18, .12, .90]],
  ["ren", "せっかちレン", "先に広げた者勝ちだ！", "序盤の面積争い", "広げすぎて後から塗りづらくする", ["areaDiePlus", "colorPrism"], ["colorPrism", "colorRandomBorrow", "areaDiePlus", "areaResize", "disruptRandomTwo", "disruptChoiceOne"], [2, .48, .58, .55, .28, .90, .38, .35, .82]],
  ["minato", "見習いミナト", "この技、試してみます！", "意外性のある仕掛け", "対象選択や使う順番がまだ甘い", ["colorRegionSplit", "colorPaletteChange"], ["colorRegionSplit", "colorPaletteChange", "areaHalfShift", "areaCornerBloom", "disruptPaletteChoice", "disruptChoiceTwo"], [2, .62, .82, .42, .30, .62, .40, .48, .88]],
  ["koharu", "読み違いコハル", "次の色は……たぶん、これ！", "妨害をためらわない", "公開情報からの色予測を外しやすい", ["disruptRandomOne", "disruptPaletteRandom"], ["colorRandomBorrow", "colorChoiceBorrow", "areaMicroBloom", "areaResize", "disruptRandomOne", "disruptPaletteRandom"], [2, .52, .78, .50, .12, .60, .42, .30, .86]],
  ["aoi", "慎重派アオイ", "一手ずつ、確かめましょう。", "自滅しにくい盤面作り", "好機でも攻めず面積で遅れやすい", ["colorChoiceBorrow", "areaMicroBloom"], ["colorChoiceBorrow", "colorPaletteChange", "areaMicroBloom", "areaCornerBloom", "disruptChoiceOne", "disruptChoiceTwo"], [2, .18, .68, .78, .48, .18, .82, .52, .68]],
  ["kai", "勝負師カイ", "ここは一発、賭けるぜ！", "劣勢からのランダム逆転", "有利でも賭けて流れを失う", ["colorPrism", "disruptRandomTwo"], ["colorPrism", "colorRandomBorrow", "areaDiePlus", "areaTripleShift", "disruptRandomTwo", "disruptPaletteRandom"], [2, .55, .76, .62, .34, .98, .45, .42, .92]],
  ["tsubasa", "仕掛け屋ツバサ", "地図は動かしてこそ面白い！", "エリア形状の操作", "形に夢中で色と残り手数を軽視する", ["areaHalfShift", "areaTripleShift"], ["colorRegionSplit", "colorPaletteChange", "areaHalfShift", "areaTripleShift", "disruptChoiceOne", "disruptPaletteChoice"], [3, .34, .90, .86, .38, .76, .36, .50, .96]],
  ["shion", "観察役シオン", "その手、覚えておきます。", "公開行動からの色の確率予測", "読みを重ねて素直な面積勝負が遅い", ["disruptChoiceOne", "disruptPaletteChoice"], ["colorChoiceBorrow", "colorPaletteChange", "areaMicroBloom", "areaResize", "disruptChoiceOne", "disruptPaletteChoice"], [3, .16, .82, .88, .92, .32, .76, .88, .80]],
  ["rei", "カード博士レイ", "組み合わせには理由があるんだ。", "スキルの使用順と組み合わせ", "カードを封じられると通常手が単調", ["colorRegionSplit", "disruptChoiceTwo"], ["colorRegionSplit", "colorPrism", "areaCornerBloom", "areaHalfShift", "disruptChoiceTwo", "disruptChoiceThree"], [3, .12, .96, .94, .74, .48, .86, .76, .94]],
  ["kurogane", "四色のクロガネ", "盤面も色も、すべて読んでみせよう。", "終盤管理と公開情報への適応", "大胆な奇策への反応が少し遅い", ["colorPaletteChange", "disruptChoiceThree"], ["colorPaletteChange", "colorChoiceBorrow", "areaResize", "areaTripleShift", "disruptChoiceThree", "disruptForcedPalette"], [4, .05, .94, .98, .90, .26, .98, .94, .84]],
];

const PARAMETER_NAMES = ["lookaheadDepth", "legalChoiceNoise", "skillWindowRecall", "skillTargetAccuracy", "hiddenInference", "riskTolerance", "endgameDiscipline", "adaptationRate", "favoriteSkillBias"];

function splitLoadout(ids) {
  return Object.fromEntries(["color", "area", "disrupt"].map((category) => [category, Object.freeze(ids.filter((id) => STANDARD_SKILLS[id]?.category === category))]));
}

const CPU_CHARACTERS = Object.freeze(Object.fromEntries(definitions.map(([id, name, line, strength, weakness, favorites, ids, values]) => [id, Object.freeze({
  id, name, line, strength, weakness, favorites: Object.freeze([...favorites]), loadout: Object.freeze(splitLoadout(ids)),
  parameters: Object.freeze(Object.fromEntries(PARAMETER_NAMES.map((key, index) => [key, values[index]]))),
  policyVersion: `${ROSTER_VERSION}:${id}`,
})])));

function validateRoster() {
  if (Object.keys(CPU_CHARACTERS).length !== 10) throw new TypeError("INVALID_CPU_ROSTER_SIZE");
  for (const character of Object.values(CPU_CHARACTERS)) {
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(character.id) || !character.name || !character.line) throw new TypeError("INVALID_CPU_CHARACTER");
    for (const category of ["color", "area", "disrupt"]) {
      if (character.loadout[category].length !== 2) throw new TypeError("INVALID_CPU_LOADOUT");
      for (const skillId of character.loadout[category]) if (!STANDARD_SKILLS[skillId]?.v49Catalogued || STANDARD_SKILLS[skillId].category !== category) throw new TypeError("INVALID_CPU_LOADOUT");
    }
    for (const [key, value] of Object.entries(character.parameters)) {
      if (key === "lookaheadDepth" ? !Number.isSafeInteger(value) || value < 1 || value > 4 : !Number.isFinite(value) || value < 0 || value > 1) throw new TypeError("INVALID_CPU_PARAMETER");
    }
  }
  return true;
}

function publicRoster() {
  return Object.values(CPU_CHARACTERS).map(({ id, name, line, strength, weakness, favorites, policyVersion }) => ({ id, name, line, strength, weakness, favorites: [...favorites], policyVersion }));
}

function actionScore(action, character) {
  const p = character.parameters;
  if (action.type === "DECLARE_NO_COLOR") return 10000;
  if (action.type === "SURRENDER") return -10000;
  if (action.type === "COLOR_REGION") return 40 + p.endgameDiscipline * 30;
  if (action.type === "CREATE_REGION") return 20
    + (action.metrics.contacts || 0) * (5 + p.endgameDiscipline * 10)
    + (action.metrics.colorPressure || 0) * (4 + p.hiddenInference * 16)
    + p.riskTolerance * 5;
  const skillId = action.payload?.skill;
  const favorite = character.favorites.includes(skillId) ? 1 : 0;
  const random = RANDOM_SKILLS.has(skillId) ? 1 : 0;
  return (action.metrics.skillPriority || 0) * (2 + p.skillWindowRecall * 4)
    + favorite * p.favoriteSkillBias * 90
    + random * p.riskTolerance * 24
    + (action.metrics.candidates || action.metrics.movedCount || action.metrics.splitSize || 0) * p.skillTargetAccuracy;
}

function chooseCharacterAction({ publicState, ownPrivateState, characterId, random, tieBreakRandom = random }) {
  validateRoster();
  const character = CPU_CHARACTERS[characterId];
  if (!character) throw new TypeError("UNKNOWN_CPU_CHARACTER");
  const observation = cpu.makeObservation({ publicState, ownPrivateState, difficulty: "hard" });
  const actions = cpu.enumerateCpuActions(observation);
  if (!actions.length) return null;
  const ranked = actions.map((action, index) => ({ action, index, score: actionScore(action, character) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const noiseWindow = Math.min(ranked.length, 1 + Math.floor(character.parameters.legalChoiceNoise * Math.min(9, ranked.length - 1)));
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError("INVALID_CPU_RANDOM");
  const noisy = ranked[Math.min(noiseWindow - 1, Math.floor(value * noiseWindow))];
  const tied = ranked.filter((entry) => entry.score === noisy.score);
  if (tied.length === 1) return noisy.action;
  const tie = tieBreakRandom();
  if (!Number.isFinite(tie) || tie < 0 || tie >= 1) throw new TypeError("INVALID_CPU_RANDOM");
  return tied[Math.min(tied.length - 1, Math.floor(tie * tied.length))].action;
}

validateRoster();

module.exports = { CPU_CHARACTERS, ROSTER_VERSION, chooseCharacterAction, publicRoster, validateRoster };

}};const cache={};function normalize(parts){const out=[];for(const part of parts){if(!part||part===".")continue;if(part==="..")out.pop();else out.push(part);}return out.join("/");}function load(id){if(cache[id])return cache[id].exports;if(!modules[id])throw new Error("Unknown module: "+id);const module={exports:{}};cache[id]=module;const base=id.split("/").slice(0,-1);const localRequire=(request)=>load(request.startsWith(".")?normalize([...base,...request.split("/")]):request);modules[id](localRequire,module,module.exports);return module.exports;}

const engine = load("standard/standard-engine.js");
const match = load("standard/standard-match.js");
const profileModel = load("standard/standard-profile.js");
const cosmetics = load("standard/standard-cosmetics.js");
const cpuRoster = load("standard/standard-cpu-roster.js");
const registry = load("standard/standard-skill-registry.js").STANDARD_SKILLS;
const categories = ["color", "area", "disrupt"];
const starterInventory = {
  colorRandomBorrow:3,colorChoiceBorrow:3,
  areaMicroBloom:3,areaDiePlus:3,
  disruptRandomOne:3,disruptChoiceOne:3,
};
const gachaOdds = {
  1:{1:55,2:30,3:12,4:2.8,5:0.2},
  2:{1:40,2:35,3:19,4:5.5,5:0.5},
  3:{1:25,2:35,3:28,4:10,5:2},
  4:{1:10,2:25,3:35,4:24,5:6},
  5:{1:2,2:8,3:30,4:40,5:20},
};
function clone(value){return JSON.parse(JSON.stringify(value));}
function validateGachaTickets(profile){
  if(!profile.gachaTickets||typeof profile.gachaTickets!=="object"||Array.isArray(profile.gachaTickets))throw new Error("INVALID_GACHA_TICKETS");
  for(const [level,count] of Object.entries(profile.gachaTickets)){
    if(!["1","2","3","4","5"].includes(level)||!Number.isSafeInteger(count)||count<0)throw new Error("INVALID_GACHA_TICKETS");
  }
  return true;
}
function validateProfile(profile){profileModel.validateProgressionFields(profile);validateGachaTickets(profile);return true;}
function createStarterProfile(displayName){
  if(typeof displayName!=="string"||displayName.trim().length<1||displayName.trim().length>20)throw new Error("INVALID_DISPLAY_NAME");
  const profile={
    displayName:displayName.trim(),quizRecords:{},gachaTickets:{"1":3},inventory:clone(starterInventory),coins:0,achievements:[],
    ...profileModel.createProgressionFields(),
  };
  validateProfile(profile);
  return profile;
}
function getCpuRoster(){return clone(cpuRoster.publicRoster());}
function createCpuProfile(characterId){
  const character=cpuRoster.CPU_CHARACTERS[characterId];
  if(!character)throw new Error("UNKNOWN_CPU_CHARACTER");
  const inventory=Object.fromEntries(Object.values(character.loadout).flat().map((id)=>[id,1]));
  const profile={displayName:character.name,quizRecords:{},gachaTickets:{},inventory,coins:0,achievements:[],...profileModel.createProgressionFields()};
  validateProfile(profile);
  return {profile,loadout:clone(character.loadout),policyVersion:character.policyVersion};
}
function chooseCpuAction({publicState,ownPrivateState,characterId,seed}){
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error("INVALID_SEED");
  const streams=engine.createRngDomains(seed,match.REQUIRED_RNG_STREAMS);
  return clone(cpuRoster.chooseCharacterAction({
    publicState,ownPrivateState,characterId,
    random:()=>streams["cpu-B"].next(),tieBreakRandom:()=>streams["cpu-tie-break"].next(),
  }));
}
function validateSeatLoadout({loadout,profile=null}){
  if(!loadout||typeof loadout!=="object"||Array.isArray(loadout)||Object.keys(loadout).some((key)=>!categories.includes(key)))throw new Error("INVALID_STANDARD_LOADOUT");
  const ids=[];
  for(const category of categories){
    const entries=loadout[category];
    if(!Array.isArray(entries)||entries.length!==2)throw new Error("INVALID_STANDARD_LOADOUT");
    for(const id of entries){
      const definition=registry[id];
      if(typeof id!=="string"||!definition||definition.category!==category||!definition.v49Catalogued||!definition.standardEngineImplemented||!definition.standardUiEnabled)throw new Error("SKILL_NOT_AVAILABLE");
      ids.push(id);
    }
  }
  if(new Set(ids).size!==6)throw new Error("DUPLICATE_LOADOUT_SKILL");
  if(profile!==null){
    validateProfile(profile);
    for(const id of ids)if((profile.inventory[id]||0)<1)throw new Error("INSUFFICIENT_INVENTORY");
  }
  return true;
}
function validateLoadouts(loadouts){
  if(!loadouts||typeof loadouts!=="object"||Array.isArray(loadouts))throw new Error("INVALID_LOADOUTS");
  for(const seat of ["A","B"]){
    validateSeatLoadout({loadout:loadouts[seat]});
  }
}
function projections(state){
  return {publicState:match.projectStandardPublicState(state),privateA:match.projectStandardPrivateState(state,"A"),privateB:match.projectStandardPrivateState(state,"B")};
}
function create({matchId,loadouts,profiles=null,seed,firstSeat=null}){
  validateLoadouts(loadouts);
  if(profiles!==null){
    for(const seat of ["A","B"]){
      validateSeatLoadout({loadout:loadouts[seat],profile:profiles?.[seat]});
    }
  }
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error("INVALID_SEED");
  const streams=engine.createRngDomains(seed,match.REQUIRED_RNG_STREAMS);
  const state=match.createStandardMatch({matchId,loadouts,firstSeat},streams);
  const rngSnapshot=engine.snapshotRngDomains(streams,match.REQUIRED_RNG_STREAMS);
  return {...projections(state),state,rngSnapshot};
}
function gachaRarity(value,ticketLevel){
  let cumulative=0;
  for(let rarity=1;rarity<=5;rarity+=1){cumulative+=gachaOdds[ticketLevel][rarity]/100;if(value<cumulative||rarity===5)return rarity;}
  return 5;
}
function drawGacha({profile,ticketLevel,count,seed}){
  validateProfile(profile);
  if(!Number.isSafeInteger(ticketLevel)||ticketLevel<1||ticketLevel>5||!Number.isSafeInteger(count)||count<1||count>100||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error("INVALID_GACHA_INPUT");
  const key=String(ticketLevel);
  const available=profile.gachaTickets[key]||0;
  if(available<count)throw new Error("INSUFFICIENT_GACHA_TICKETS");
  const stream=engine.createRngDomains(seed,match.REQUIRED_RNG_STREAMS).gacha;
  const draws=[];
  for(let index=0;index<count;index+=1){
    const rarity=gachaRarity(stream.next(),ticketLevel);
    const category=categories[Math.floor(stream.next()*categories.length)];
    const pool=Object.values(registry).filter((skill)=>skill.gachaEnabled&&!skill.experimental&&skill.v49Catalogued&&skill.category===category&&skill.rarity===rarity);
    if(!pool.length)throw new Error("EMPTY_GACHA_POOL");
    const skill=pool[Math.floor(stream.next()*pool.length)];
    draws.push({ticketLevel,rarity,category,skillId:skill.id,displayName:skill.displayName});
  }
  const next=clone(profile);
  next.gachaTickets[key]=available-count;
  for(const draw of draws)next.inventory[draw.skillId]=(next.inventory[draw.skillId]||0)+1;
  validateProfile(next);
  return {profile:next,draws};
}
function quoteCardSale({profile,skillId,count}){
  validateProfile(profile);
  return clone(profileModel.quoteCardSale({profile,skillId,count,reservedCount:0}));
}
function sellCards({profile,skillId,count,confirmed=false}){
  validateProfile(profile);
  const result=profileModel.applyCardSale({profile,skillId,count,reservedCount:0,confirmed});
  validateProfile(result.profile);
  return {profile:clone(result.profile),quote:clone(result.quote)};
}
function getCosmetics({profile}){
  validateProfile(profile);
  return clone(cosmetics.projectCosmetics(profile));
}
function quoteCosmetic({profile,cosmeticId}){
  validateProfile(profile);
  return clone(cosmetics.quoteCosmeticAction({profile,cosmeticId}));
}
function applyCosmetic({profile,cosmeticId}){
  validateProfile(profile);
  const result=cosmetics.applyCosmeticAction({profile,cosmeticId});
  validateProfile(result.profile);
  return {profile:clone(result.profile),quote:clone(result.quote)};
}
function applyProfiles({profiles,beforeState,nextState,actor,action,finishedAt}){
  const next={A:clone(profiles?.A),B:clone(profiles?.B)};
  for(const seat of ["A","B"])validateProfile(next[seat]);
  const changed={A:false,B:false};
  if(action.type==="USE_SKILL"){
    const consumed=[];
    for(const id of new Set([...Object.keys(beforeState.hands[actor]),...Object.keys(nextState.hands[actor])])){
      const difference=(beforeState.hands[actor][id]||0)-(nextState.hands[actor][id]||0);
      if(difference!==0)consumed.push({id,difference});
    }
    if(consumed.length!==1||consumed[0].difference!==1)throw new Error("CARD_NOT_CONSUMED_ONCE");
    const id=consumed[0].id;
    if(!Number.isSafeInteger(next[actor].inventory[id])||next[actor].inventory[id]<1)throw new Error("INVENTORY_EMPTY");
    next[actor].inventory[id]-=1;
    validateProfile(next[actor]);
    changed[actor]=true;
  }
  if(nextState.status==="FINISHED"){
    if(typeof finishedAt!=="string"||!Number.isFinite(Date.parse(finishedAt)))throw new Error("INVALID_FINISHED_AT");
    const fullPaint=match.isMapCompleteWin(nextState);
    for(const seat of ["A","B"]){
      next[seat]=clone(profileModel.recordMatchOutcome({
        profile:next[seat],matchId:nextState.matchId,won:nextState.winner===seat,
        terminalReason:nextState.terminalReason,fullPaint,skillsUsed:nextState.skillsUsed[seat],endedAt:finishedAt,
      }));
      validateGachaTickets(next[seat]);
      next[seat].gachaTickets["1"]=(next[seat].gachaTickets["1"]||0)+1;
      changed[seat]=true;
    }
  }
  return {profiles:next,changed};
}
function applyCpuProfiles({profiles,beforeState,nextState,actor,action,finishedAt,characterId}){
  const next={A:clone(profiles?.A),B:clone(profiles?.B)};
  for(const seat of ["A","B"])validateProfile(next[seat]);
  if(!cpuRoster.CPU_CHARACTERS[characterId])throw new Error("UNKNOWN_CPU_CHARACTER");
  const changed={A:false,B:false};
  if(action.type==="USE_SKILL"){
    const consumed=[];
    for(const id of new Set([...Object.keys(beforeState.hands[actor]),...Object.keys(nextState.hands[actor])])){
      const difference=(beforeState.hands[actor][id]||0)-(nextState.hands[actor][id]||0);
      if(difference!==0)consumed.push({id,difference});
    }
    if(consumed.length!==1||consumed[0].difference!==1)throw new Error("CARD_NOT_CONSUMED_ONCE");
    const id=consumed[0].id;
    if(!Number.isSafeInteger(next[actor].inventory[id])||next[actor].inventory[id]<1)throw new Error("INVENTORY_EMPTY");
    next[actor].inventory[id]-=1;
    validateProfile(next[actor]);
    changed[actor]=true;
  }
  if(nextState.status==="FINISHED"){
    if(typeof finishedAt!=="string"||!Number.isFinite(Date.parse(finishedAt)))throw new Error("INVALID_FINISHED_AT");
    const fullPaint=match.isMapCompleteWin(nextState);
    next.A=clone(profileModel.recordCpuMatchOutcome({
      profile:next.A,matchId:nextState.matchId,cpuCharacterId:characterId,won:nextState.winner==="A",
      terminalReason:nextState.terminalReason,fullPaint,skillsUsed:nextState.skillsUsed.A,endedAt:finishedAt,
    }));
    validateGachaTickets(next.A);
    next.A.gachaTickets["1"]=(next.A.gachaTickets["1"]||0)+1;
    changed.A=true;
  }
  return {profiles:next,changed};
}
function apply({state,rngSnapshot,actor,action,expectedVersion}){
  match.validateStandardState(state);
  const streams=engine.createRngDomainsFromSnapshot(rngSnapshot,match.REQUIRED_RNG_STREAMS);
  const applied=match.applyStandardAction({state,actor,action,expectedVersion,rngStreams:streams});
  if(!applied.ok)return {ok:false,code:applied.code};
  const next=applied.state;
  return {
    ok:true,
    code:applied.code,
    contactColorCount:action.type==="CREATE_REGION"?applied.contactColorCount:null,
    state:next,
    rngSnapshot:engine.snapshotRngDomains(streams,match.REQUIRED_RNG_STREAMS),
    ...projections(next),
    finished:next.status==="FINISHED",
    winnerSeat:next.winner||null,
    terminalReason:next.terminalReason||null,
  };
}
globalThis.FourColorStandardServerEngine=Object.freeze({
  ENGINE_VERSION:match.ENGINE_VERSION,
  REQUIRED_RNG_STREAMS:match.REQUIRED_RNG_STREAMS,
  StandardRuleError:engine.StandardRuleError,
  apply,
  applyCosmetic,
  applyCpuProfiles,
  applyProfiles,
  chooseCpuAction,
  create,
  createCpuProfile,
  createStarterProfile,
  drawGacha,
  getCpuRoster,
  getCosmetics,
  quoteCardSale,
  quoteCosmetic,
  sellCards,
  privateState:match.projectStandardPrivateState,
  publicState:match.projectStandardPublicState,
  validateProfile,
  validateSeatLoadout,
  validateState:match.validateStandardState,
});
})();
