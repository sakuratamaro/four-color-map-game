"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const quoteModel = require("../standard/standard-loadout-quote.js");
const save = require("../standard/standard-save.js");

const LOADOUT = Object.freeze({
  color: Object.freeze(["colorPrism", "colorChoiceBorrow"]),
  area: Object.freeze(["areaHalfShift", "areaResize"]),
  disrupt: Object.freeze(["disruptChoiceOne", "disruptRandomOne"]),
});

function rootFixture() {
  const inventory = Object.fromEntries(Object.values(LOADOUT).flat().map((skillId) => [skillId, 1]));
  const streams = engine.createRngDomains(8842, match.REQUIRED_RNG_STREAMS);
  return save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "Alice", inventory }),
      playerB: save.createProfile({ name: "Bob", inventory }),
    },
    rngSnapshot: engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS),
  });
}

function quote(root = rootFixture(), overrides = {}) {
  return quoteModel.createStandardLoadoutQuote({
    root,
    expectedRootRevision: root.rootRevision,
    quoteId: "quote-A-1",
    actorId: "playerA",
    seat: "A",
    roomId: "match-1",
    loadout: LOADOUT,
    now: "2026-09-01T00:00:00.000Z",
    ...overrides,
  });
}

test("profile-private Standard inventory projection exposes exactly the 19 canonical cards", () => {
  const root = rootFixture();
  const projection = quoteModel.projectStandardInventory({ root, actorId: "playerA" });
  assert.equal(projection.ok, true);
  assert.equal(projection.items.length, 19);
  assert.deepEqual(Object.fromEntries(["color", "area", "disrupt"].map((category) => [category, projection.items.filter((item) => item.category === category).length])), { color: 5, area: 6, disrupt: 8 });
  assert.equal(projection.items.some((item) => item.skillId === "legalRecolor"), false);
  assert.equal(JSON.stringify(projection).includes("playerB"), false);
  const selected = projection.items.find((item) => item.skillId === "colorPrism");
  assert.deepEqual(selected, { skillId: "colorPrism", category: "color", rarity: 3, ownedCount: 1, reservedCount: 0, availableCount: 1, standardUiEnabled: true });
});

test("loadout quote is unique, immutable, five-minute bounded, and persistence-free", () => {
  const root = rootFixture();
  const before = JSON.stringify(root);
  const first = quote(root);
  const second = quote(root, { quoteId: "quote-A-2" });
  assert.equal(first.code, "QUOTED");
  assert.equal(first.quote.mode, "STANDARD_V5");
  assert.equal(first.quote.inventoryRevision, 0);
  assert.equal(first.quote.registryRevision, "standard-skill-registry-v1");
  assert.equal(first.quote.expiresAt, "2026-09-01T00:05:00.000Z");
  assert.notEqual(first.quote.loadoutDigest, second.quote.loadoutDigest);
  assert.equal(Object.isFrozen(first.quote.normalizedLoadout.color), true);
  assert.equal(JSON.stringify(root), before);
});

test("quote rejects malformed categories, duplicate, unknown, experimental, empty, stale, and forged actors", () => {
  const root = rootFixture();
  assert.equal(quote(root, { loadout: { ...LOADOUT, color: ["colorPrism"] } }).code, "INVALID_STANDARD_LOADOUT");
  assert.equal(quote(root, { loadout: { ...LOADOUT, color: ["colorPrism", "colorPrism"] } }).code, "DUPLICATE_LOADOUT_SKILL");
  assert.equal(quote(root, { loadout: { ...LOADOUT, color: ["colorPrism", "unknownSkill"] } }).code, "SKILL_NOT_AVAILABLE");
  assert.equal(quote(root, { loadout: { ...LOADOUT, color: ["colorPrism", "legalRecolor"] } }).code, "SKILL_NOT_AVAILABLE");
  const empty = JSON.parse(JSON.stringify(root));
  empty.profiles.playerA.inventory.colorPrism = 0;
  assert.equal(quote(empty).code, "INSUFFICIENT_INVENTORY");
  assert.equal(quote(root, { expectedRootRevision: 4 }).code, "STALE_INVENTORY_REVISION");
  assert.equal(quote(root, { actorId: "forged" }).code, "UNKNOWN_PROFILE");
});

test("verification rejects expiry, root drift, ownership, room, seat, mode, and digest alteration", () => {
  const root = rootFixture();
  const created = quote(root).quote;
  const verify = (overrides = {}) => quoteModel.verifyStandardLoadoutQuote({ root, quote: created, quoteId: "quote-A-1", actorId: "playerA", seat: "A", roomId: "match-1", now: "2026-09-01T00:04:59.000Z", ...overrides });
  assert.equal(verify().code, "VERIFIED");
  assert.equal(verify({ now: "2026-09-01T00:05:00.000Z" }).code, "QUOTE_EXPIRED");
  assert.equal(verify({ actorId: "playerB" }).code, "QUOTE_OWNER_MISMATCH");
  assert.equal(verify({ seat: "B" }).code, "QUOTE_SEAT_MISMATCH");
  assert.equal(verify({ roomId: "match-2" }).code, "QUOTE_ROOM_MISMATCH");
  assert.equal(verify({ quote: { ...created, mode: "STANDARD_V5_ALPHA_SLICE" } }).code, "QUOTE_MODE_MISMATCH");
  assert.equal(verify({ quote: { ...created, normalizedLoadout: { ...created.normalizedLoadout, color: [...created.normalizedLoadout.color].reverse() } } }).code, "QUOTE_DIGEST_MISMATCH");
  const changed = JSON.parse(JSON.stringify(root)); changed.rootRevision = 1;
  assert.equal(verify({ root: changed }).code, "STALE_INVENTORY_REVISION");
});
