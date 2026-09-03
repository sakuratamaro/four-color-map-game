"use strict";

const save = require("./standard-save.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("./standard-skill-registry.js");
const { stableHash } = require("./standard-root-transaction.js");

const STANDARD_MODE = "STANDARD_V5";
const STANDARD_REGISTRY_REVISION = "standard-skill-registry-v1";
const DEFAULT_QUOTE_TTL_MS = 5 * 60 * 1000;
const LOADOUT_CATEGORIES = Object.freeze(["color", "area", "disrupt"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function rejected(code, extra = {}) {
  return deepFreeze({ ok: false, status: "REJECTED", code, ...extra });
}

function timestamp(value, code) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw Object.assign(new Error(code), { code });
  return value;
}

function normalizeStandardLoadout(loadout) {
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout)) throw Object.assign(new Error("INVALID_LOADOUT"), { code: "INVALID_LOADOUT" });
  if (Object.keys(loadout).length !== LOADOUT_CATEGORIES.length || Object.keys(loadout).some((category) => !LOADOUT_CATEGORIES.includes(category))) {
    throw Object.assign(new Error("INVALID_STANDARD_LOADOUT"), { code: "INVALID_STANDARD_LOADOUT" });
  }
  const normalized = {};
  const all = [];
  for (const category of LOADOUT_CATEGORIES) {
    const ids = loadout[category];
    if (!Array.isArray(ids) || ids.length !== 2 || ids.some((id) => typeof id !== "string")) {
      throw Object.assign(new Error("INVALID_STANDARD_LOADOUT"), { code: "INVALID_STANDARD_LOADOUT" });
    }
    normalized[category] = [...ids];
    all.push(...ids);
    for (const skillId of ids) {
      const definition = STANDARD_SKILLS[skillId];
      if (!definition || definition.category !== category || !definition.v49Catalogued || !definition.standardEngineImplemented || !definition.standardUiEnabled || definition.experimental) {
        throw Object.assign(new Error("SKILL_NOT_AVAILABLE"), { code: "SKILL_NOT_AVAILABLE" });
      }
    }
  }
  if (new Set(all).size !== all.length) throw Object.assign(new Error("DUPLICATE_LOADOUT_SKILL"), { code: "DUPLICATE_LOADOUT_SKILL" });
  return normalized;
}

function projectStandardInventory({ root, actorId }) {
  try {
    save.validateStandardSave(root);
    if (!ID_PATTERN.test(actorId || "") || !root.profiles[actorId]) return rejected("UNKNOWN_PROFILE");
    const profile = root.profiles[actorId];
    const items = V49_SKILL_IDS.filter((skillId) => STANDARD_SKILLS[skillId].standardUiEnabled && !STANDARD_SKILLS[skillId].experimental).map((skillId) => {
      const definition = STANDARD_SKILLS[skillId];
      const ownedCount = profile.inventory[skillId] || 0;
      const reservedCount = root.reservations[actorId]?.[skillId] || 0;
      const availableCount = ownedCount - reservedCount;
      if (![ownedCount, reservedCount, availableCount].every((count) => Number.isSafeInteger(count) && count >= 0)) {
        throw Object.assign(new Error("INVALID_INVENTORY_PROJECTION"), { code: "INVALID_INVENTORY_PROJECTION" });
      }
      return { skillId, category: definition.category, rarity: definition.rarity, ownedCount, reservedCount, availableCount, standardUiEnabled: true };
    });
    return deepFreeze({ ok: true, status: "READY", code: "READY", actorId, inventoryRevision: root.rootRevision, registryRevision: STANDARD_REGISTRY_REVISION, items });
  } catch (error) {
    return rejected(error.code || "INVENTORY_PROJECTION_REJECTED");
  }
}

function quoteDigest(quote) {
  return stableHash({
    quoteId: quote.quoteId,
    actorId: quote.actorId,
    seat: quote.seat,
    roomId: quote.roomId,
    mode: quote.mode,
    normalizedLoadout: quote.normalizedLoadout,
    inventoryRevision: quote.inventoryRevision,
    registryRevision: quote.registryRevision,
    createdAt: quote.createdAt,
    expiresAt: quote.expiresAt,
  });
}

function createStandardLoadoutQuote({ root, expectedRootRevision, quoteId, actorId, seat, roomId, loadout, now, ttlMs = DEFAULT_QUOTE_TTL_MS }) {
  try {
    save.validateStandardSave(root);
    if (![quoteId, actorId, roomId].every((id) => ID_PATTERN.test(id || ""))) return rejected("INVALID_QUOTE_ID");
    if (!["A", "B"].includes(seat)) return rejected("INVALID_SEAT");
    if (!root.profiles[actorId]) return rejected("UNKNOWN_PROFILE");
    if (root.rootRevision !== expectedRootRevision) return rejected("STALE_INVENTORY_REVISION");
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 60 * 60 * 1000) return rejected("INVALID_QUOTE_TTL");
    const createdAt = timestamp(now, "INVALID_CLOCK");
    const expiresAt = new Date(Date.parse(createdAt) + ttlMs).toISOString();
    const normalizedLoadout = normalizeStandardLoadout(loadout);
    const inventory = projectStandardInventory({ root, actorId });
    if (!inventory.ok) return inventory;
    const byId = Object.fromEntries(inventory.items.map((item) => [item.skillId, item]));
    for (const skillId of Object.values(normalizedLoadout).flat()) if (byId[skillId]?.availableCount < 1) return rejected("INSUFFICIENT_INVENTORY");
    const quote = {
      quoteId,
      actorId,
      seat,
      roomId,
      mode: STANDARD_MODE,
      normalizedLoadout,
      inventoryRevision: root.rootRevision,
      registryRevision: STANDARD_REGISTRY_REVISION,
      createdAt,
      expiresAt,
    };
    quote.loadoutDigest = quoteDigest(quote);
    return deepFreeze({ ok: true, status: "QUOTED", code: "QUOTED", quote });
  } catch (error) {
    return rejected(error.code || "LOADOUT_QUOTE_REJECTED");
  }
}

function verifyStandardLoadoutQuote({ root, quote, quoteId, actorId, seat, roomId, now }) {
  try {
    save.validateStandardSave(root);
    if (!quote || typeof quote !== "object" || Array.isArray(quote)) return rejected("UNKNOWN_QUOTE");
    if (quote.quoteId !== quoteId || quote.actorId !== actorId) return rejected("QUOTE_OWNER_MISMATCH");
    if (quote.seat !== seat) return rejected("QUOTE_SEAT_MISMATCH");
    if (quote.roomId !== roomId) return rejected("QUOTE_ROOM_MISMATCH");
    if (quote.mode !== STANDARD_MODE) return rejected("QUOTE_MODE_MISMATCH");
    if (quote.registryRevision !== STANDARD_REGISTRY_REVISION) return rejected("STALE_REGISTRY_REVISION");
    if (quote.inventoryRevision !== root.rootRevision) return rejected("STALE_INVENTORY_REVISION");
    timestamp(quote.createdAt, "INVALID_QUOTE");
    if (Date.parse(timestamp(now, "INVALID_CLOCK")) >= Date.parse(timestamp(quote.expiresAt, "INVALID_QUOTE"))) return rejected("QUOTE_EXPIRED");
    const normalizedLoadout = normalizeStandardLoadout(quote.normalizedLoadout);
    if (quoteDigest({ ...quote, normalizedLoadout }) !== quote.loadoutDigest) return rejected("QUOTE_DIGEST_MISMATCH");
    const inventory = projectStandardInventory({ root, actorId });
    if (!inventory.ok) return inventory;
    const byId = Object.fromEntries(inventory.items.map((item) => [item.skillId, item]));
    for (const skillId of Object.values(normalizedLoadout).flat()) if (byId[skillId]?.availableCount < 1) return rejected("INSUFFICIENT_INVENTORY");
    return deepFreeze({ ok: true, status: "VERIFIED", code: "VERIFIED", quote: { ...clone(quote), normalizedLoadout } });
  } catch (error) {
    return rejected(error.code || "LOADOUT_QUOTE_REJECTED");
  }
}

module.exports = {
  DEFAULT_QUOTE_TTL_MS,
  LOADOUT_CATEGORIES,
  STANDARD_MODE,
  STANDARD_REGISTRY_REVISION,
  createStandardLoadoutQuote,
  normalizeStandardLoadout,
  projectStandardInventory,
  quoteDigest,
  verifyStandardLoadoutQuote,
};
