"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("../standard/standard-skill-registry.js");
const gacha = require("../standard/standard-gacha-transaction.js");

function fixture(seed = 8271) {
  const streams = engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
  return save.createStandardSave({
    profiles: { playerA: save.createProfile({ name: "Alice", gachaTickets: { 4: 3 } }), playerB: save.createProfile({ name: "Bob" }) },
    rngSnapshot: engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS),
  });
}

function args(root, overrides = {}) {
  return {
    root,
    expectedRootRevision: root.rootRevision,
    operationId: "gacha-op-1",
    profileId: "playerA",
    ticketLevel: 4,
    count: 3,
    clock: { now: () => "2026-09-01T11:00:00.000Z" },
    storageAdapter: { setItem() {} },
    ...overrides,
  };
}

test("ordinary gacha pool accounts for exactly the 19 canonical cards by category and rarity", () => {
  const pooled = [];
  for (const category of gacha.CATEGORIES) for (let rarity = 1; rarity <= 5; rarity += 1) pooled.push(...gacha.pool(category, rarity));
  assert.deepEqual([...pooled].sort(), [...V49_SKILL_IDS].sort());
  assert.equal(new Set(pooled).size, 19);
  assert.ok(pooled.every((id) => STANDARD_SKILLS[id].gachaEnabled && !STANDARD_SKILLS[id].experimental));
});

test("rarity boundaries exactly implement every v4.9 ticket-level distribution", () => {
  for (let level = 1; level <= 5; level += 1) {
    let cumulative = 0;
    for (let rarity = 1; rarity <= 5; rarity += 1) {
      const start = cumulative;
      cumulative += gacha.GACHA_ODDS[level][rarity] / 100;
      assert.equal(gacha.rarityFrom(start + Math.min(1e-9, (cumulative - start) / 2), level), rarity);
      assert.equal(gacha.rarityFrom(cumulative - 1e-12, level), rarity);
    }
    assert.ok(Math.abs(cumulative - 1) < 1e-12);
  }
});

test("multi-draw atomically consumes tickets, advances only gacha RNG, adds inventory, and writes one receipt", () => {
  const root = fixture();
  const writes = [];
  const result = gacha.drawGacha(args(root, { storageAdapter: { setItem(key, value) { writes.push([key, value]); } } }));
  assert.equal(result.code, "DRAWN");
  assert.equal(result.draws.length, 3);
  assert.equal(result.root.profiles.playerA.gachaTickets[4], 0);
  assert.equal(Object.values(result.root.profiles.playerA.inventory).reduce((sum, count) => sum + count, 0), 3);
  assert.equal(result.root.rootRevision, 1);
  assert.notEqual(result.root.rngSnapshot.gacha, root.rngSnapshot.gacha);
  for (const name of match.REQUIRED_RNG_STREAMS.filter((name) => name !== "gacha")) assert.equal(result.root.rngSnapshot[name], root.rngSnapshot[name], name);
  assert.equal(Object.keys(result.root.receipts.gachaDraw).length, 1);
  assert.equal(writes.length, 1);
  assert.deepEqual(save.decodeStandardSave(writes[0][1]), result.root);
  assert.equal(root.profiles.playerA.gachaTickets[4], 3);
});

test("same draw replays without clock, RNG, or storage and changed payload rejects", () => {
  const committed = gacha.drawGacha(args(fixture()));
  const replay = gacha.drawGacha(args(committed.root, {
    expectedRootRevision: 0,
    clock: { now() { throw new Error("clock must not run"); } },
    storageAdapter: { setItem() { throw new Error("storage must not run"); } },
  }));
  assert.equal(replay.code, "ALREADY_DRAWN");
  assert.deepEqual(replay.draws, committed.draws);
  assert.equal(replay.root, committed.root);
  assert.equal(gacha.drawGacha(args(committed.root, { count: 1 })).code, "IDEMPOTENCY_KEY_REUSE");
});

test("invalid, insufficient, stale, and persistence-failed draws preserve tickets, inventory, RNG, and receipt", () => {
  const root = fixture();
  assert.equal(gacha.drawGacha(args(root, { count: 4 })).code, "INSUFFICIENT_GACHA_TICKETS");
  assert.equal(gacha.drawGacha(args(root, { ticketLevel: 6 })).code, "INVALID_GACHA_INPUT");
  assert.equal(gacha.drawGacha(args(root, { expectedRootRevision: 9 })).code, "STALE_ROOT_REVISION");
  let attempts = 0;
  const storage = { setItem() { attempts += 1; if (attempts === 1) throw new Error("quota"); } };
  const failed = gacha.drawGacha(args(root, { storageAdapter: storage }));
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(failed.root, root);
  assert.equal(root.profiles.playerA.gachaTickets[4], 3);
  assert.deepEqual(root.profiles.playerA.inventory, {});
  assert.deepEqual(root.receipts.gachaDraw, {});
  const retried = gacha.drawGacha(args(root, { storageAdapter: storage }));
  assert.equal(retried.code, "DRAWN");
  assert.equal(attempts, 2);
});

test("same root seed and payload reproduce the complete ordered draw list", () => {
  assert.deepEqual(gacha.drawGacha(args(fixture(555))).draws, gacha.drawGacha(args(fixture(555))).draws);
});

test("save validation rejects a gacha receipt with mismatched canonical card metadata", () => {
  const committed = gacha.drawGacha(args(fixture()));
  const forged = JSON.parse(JSON.stringify(committed.root));
  forged.receipts.gachaDraw["gacha-op-1"].draws[0].rarity = forged.receipts.gachaDraw["gacha-op-1"].draws[0].rarity === 5 ? 4 : 5;
  assert.throws(() => save.validateStandardSave(forged), /INVALID_GACHA_DRAW_RECEIPT/);
});
