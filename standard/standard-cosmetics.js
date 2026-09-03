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
