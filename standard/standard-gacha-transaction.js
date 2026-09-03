"use strict";

const engine = require("./standard-engine.js");
const match = require("./standard-match.js");
const save = require("./standard-save.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("./standard-skill-registry.js");
const { stableHash } = require("./standard-root-transaction.js");

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const GACHA_DRAW_LIMIT = 100;
const CATEGORIES = Object.freeze(["color", "area", "disrupt"]);
const GACHA_ODDS = Object.freeze({
  1: Object.freeze({ 1: 55, 2: 30, 3: 12, 4: 2.8, 5: 0.2 }),
  2: Object.freeze({ 1: 40, 2: 35, 3: 19, 4: 5.5, 5: 0.5 }),
  3: Object.freeze({ 1: 25, 2: 35, 3: 28, 4: 10, 5: 2 }),
  4: Object.freeze({ 1: 10, 2: 25, 3: 35, 4: 24, 5: 6 }),
  5: Object.freeze({ 1: 2, 2: 8, 3: 30, 4: 40, 5: 20 }),
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function rejected(code, root, extra = {}) { return Object.freeze({ ok: false, status: "REJECTED", code, root, saved: false, ...extra }); }

function pool(category, rarity) {
  return V49_SKILL_IDS.filter((skillId) => {
    const skill = STANDARD_SKILLS[skillId];
    return skill.gachaEnabled && !skill.experimental && skill.category === category && skill.rarity === rarity;
  });
}

function rarityFrom(randomValue, ticketLevel) {
  const odds = GACHA_ODDS[ticketLevel];
  if (!odds || typeof randomValue !== "number" || randomValue < 0 || randomValue >= 1) throw Object.assign(new Error("INVALID_GACHA_INPUT"), { code: "INVALID_GACHA_INPUT" });
  let cumulative = 0;
  for (let rarity = 1; rarity <= 5; rarity += 1) {
    cumulative += odds[rarity] / 100;
    if (randomValue < cumulative || rarity === 5) return rarity;
  }
  return 5;
}

function drawOne(stream, ticketLevel) {
  const rarity = rarityFrom(stream.next(), ticketLevel);
  const category = CATEGORIES[Math.floor(stream.next() * CATEGORIES.length)];
  const candidates = pool(category, rarity);
  if (!candidates.length) throw Object.assign(new Error("EMPTY_GACHA_POOL"), { code: "EMPTY_GACHA_POOL" });
  const skillId = candidates[Math.floor(stream.next() * candidates.length)];
  return Object.freeze({ ticketLevel, rarity, category, skillId });
}

function drawGacha({ root, expectedRootRevision, operationId, profileId, ticketLevel, count, clock, storageAdapter }) {
  try { save.validateStandardSave(root); } catch (error) { return rejected(error.code || "INVALID_SAVE", root); }
  if (![operationId, profileId].every((value) => typeof value === "string" && ID_PATTERN.test(value))) return rejected("INVALID_OPERATION_ID", root);
  if (!root.profiles[profileId]) return rejected("UNKNOWN_PROFILE", root);
  if (!Number.isSafeInteger(ticketLevel) || ticketLevel < 1 || ticketLevel > 5 || !Number.isSafeInteger(count) || count < 1 || count > GACHA_DRAW_LIMIT) return rejected("INVALID_GACHA_INPUT", root);
  const actionFingerprint = stableHash({ profileId, ticketLevel, count });
  const existing = root.receipts.gachaDraw[operationId];
  if (existing) {
    if (existing.actionFingerprint !== actionFingerprint) return rejected("IDEMPOTENCY_KEY_REUSE", root);
    return Object.freeze({ ok: true, status: "ALREADY_DRAWN", code: "ALREADY_DRAWN", root, receipt: Object.freeze(clone(existing)), draws: Object.freeze(clone(existing.draws)), saved: false });
  }
  if (root.rootRevision !== expectedRootRevision) return rejected("STALE_ROOT_REVISION", root);
  const ticketKey = String(ticketLevel);
  const available = root.profiles[profileId].gachaTickets[ticketKey] || 0;
  if (available < count) return rejected("INSUFFICIENT_GACHA_TICKETS", root, { available });

  let drawnAt;
  try {
    drawnAt = clock.now();
    if (typeof drawnAt !== "string" || !Number.isFinite(Date.parse(drawnAt))) throw Object.assign(new Error("INVALID_CLOCK"), { code: "INVALID_CLOCK" });
  } catch (error) { return rejected(error.code || "INVALID_CLOCK", root); }

  const stream = engine.createRngDomainsFromSnapshot(root.rngSnapshot, match.REQUIRED_RNG_STREAMS).gacha;
  const rngBefore = root.rngSnapshot.gacha;
  let draws;
  try { draws = Array.from({ length: count }, () => drawOne(stream, ticketLevel)); } catch (error) { return rejected(error.code || "GACHA_DRAW_REJECTED", root); }
  const rngAfter = stream.snapshot();
  const next = clone(root);
  next.profiles[profileId].gachaTickets[ticketKey] = available - count;
  for (const draw of draws) next.profiles[profileId].inventory[draw.skillId] = (next.profiles[profileId].inventory[draw.skillId] || 0) + 1;
  next.rngSnapshot.gacha = rngAfter;
  next.rootRevision += 1;
  const receipt = {
    scope: "gachaDraw",
    operationId,
    profileId,
    ticketLevel,
    ticketCount: count,
    actionFingerprint,
    rngBefore,
    rngAfter,
    draws: clone(draws),
    drawnAt,
    rootRevision: next.rootRevision,
  };
  next.receipts.gachaDraw[operationId] = receipt;
  try {
    save.validateStandardSave(next);
    save.persistStandardSave(storageAdapter, next);
  } catch (error) { return rejected(error instanceof save.StandardSaveError ? error.code : "PERSISTENCE_FAILED", root); }
  return Object.freeze({ ok: true, status: "DRAWN", code: "DRAWN", root: Object.freeze(next), receipt: Object.freeze(clone(receipt)), draws: Object.freeze(clone(draws)), saved: true });
}

module.exports = { CATEGORIES, GACHA_DRAW_LIMIT, GACHA_ODDS, drawGacha, drawOne, pool, rarityFrom };
