"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const cosmetics = require("../standard/standard-cosmetics.js");
const save = require("../standard/standard-save.js");
const tx = require("../standard/standard-root-transaction.js");

function fixture(coins = 1000) {
  const profile = JSON.parse(JSON.stringify(save.createProfile({ name: "Alice" })));
  profile.coins = coins;
  return save.createStandardSave({ profiles: { playerA: profile } });
}

test("cosmetic catalog retains v4.9 prices and adds only the trophy title category", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(cosmetics.COSMETIC_CATALOG).map(([id, item]) => [id, [item.type, item.price, item.trophyId || null]])), {
    boardDefault: ["board", 0, null],
    boardAurora: ["board", 600, null],
    boardGold: ["board", 900, null],
    boardCartographer: ["board", 0, "fullPaint"],
    effectDefault: ["effect", 0, null],
    effectSakura: ["effect", 500, null],
    effectPrism: ["effect", 850, null],
    effectMasterpiece: ["effect", 0, "fullPaint3"],
    nameplateDefault: ["nameplate", 0, null],
    nameplateGold: ["nameplate", 350, null],
    titleNone: ["title", 0, null],
    titleArtisan: ["title", 0, "noSkillFullPaint"],
  });
  for (const item of Object.values(cosmetics.COSMETIC_CATALOG)) {
    assert.deepEqual(Object.keys(item).filter((key) => /skill|card|ticket|power|stat|rng/i.test(key)), []);
  }
});

test("paid cosmetic purchase and equip commit coins, ownership, receipt, and revision once", () => {
  const root = fixture();
  const writes = [];
  const result = tx.commitCosmeticAction({ root, expectedRootRevision: 0, operationId: "cosmetic-1", profileId: "playerA", cosmeticId: "boardAurora", storage: { setItem(key, value) { writes.push([key, value]); } } });
  assert.equal(result.code, "COMMITTED");
  assert.equal(result.root.profiles.playerA.coins, 400);
  assert.equal(result.root.profiles.playerA.cosmeticsOwned.includes("boardAurora"), true);
  assert.equal(result.root.profiles.playerA.equipped.board, "boardAurora");
  assert.equal(result.root.rootRevision, 1);
  assert.equal(result.receipt.action, "PURCHASE_AND_EQUIP");
  assert.equal(result.receipt.price, 600);
  assert.equal(Object.keys(result.root.receipts.cosmeticAction).length, 1);
  assert.equal(writes.length, 1);
  assert.deepEqual(save.decodeStandardSave(writes[0][1]), result.root);
  assert.equal(root.profiles.playerA.coins, 1000);
});

test("owned equip and replay charge zero and never write twice", () => {
  const bought = tx.commitCosmeticAction({ root: fixture(), expectedRootRevision: 0, operationId: "buy-aurora", profileId: "playerA", cosmeticId: "boardAurora", storage: { setItem() {} } });
  const unequipped = JSON.parse(JSON.stringify(bought.root));
  unequipped.profiles.playerA.equipped.board = "boardDefault";
  const writes = [];
  const equipped = tx.commitCosmeticAction({ root: unequipped, expectedRootRevision: 1, operationId: "equip-aurora", profileId: "playerA", cosmeticId: "boardAurora", storage: { setItem() { writes.push(1); } } });
  assert.equal(equipped.receipt.action, "EQUIP");
  assert.equal(equipped.receipt.price, 0);
  assert.equal(equipped.root.profiles.playerA.coins, 400);
  const replay = tx.commitCosmeticAction({ root: equipped.root, expectedRootRevision: 2, operationId: "equip-aurora", profileId: "playerA", cosmeticId: "boardAurora", storage: { setItem() { throw new Error("must not write"); } } });
  assert.equal(replay.code, "IDEMPOTENT_REPLAY");
  assert.equal(replay.root, equipped.root);
  const collision = tx.commitCosmeticAction({ root: equipped.root, expectedRootRevision: 2, operationId: "equip-aurora", profileId: "playerA", cosmeticId: "boardGold", storage: { setItem() {} } });
  assert.equal(collision.code, "IDEMPOTENCY_KEY_REUSE");
  assert.equal(writes.length, 1);
});

test("insufficient coins, trophy locks, and persistence failure preserve the root", () => {
  const poor = fixture(349);
  assert.equal(tx.quoteCosmeticAction({ root: poor, profileId: "playerA", cosmeticId: "nameplateGold" }).code, "INSUFFICIENT_COINS");
  assert.equal(tx.quoteCosmeticAction({ root: poor, profileId: "playerA", cosmeticId: "boardCartographer" }).code, "TROPHY_REQUIRED");
  const root = fixture();
  const failed = tx.commitCosmeticAction({ root, expectedRootRevision: 0, operationId: "cosmetic-fail", profileId: "playerA", cosmeticId: "effectSakura", storage: { setItem() { throw new Error("quota"); } } });
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(failed.root, root);
  assert.equal(root.rootRevision, 0);
  assert.equal(root.profiles.playerA.coins, 1000);
  assert.equal(Object.keys(root.receipts.cosmeticAction).length, 0);
  assert.equal(tx.quoteCosmeticAction({ root, profileId: "playerA", cosmeticId: "boardDefault" }).code, "ALREADY_EQUIPPED");
});

test("trophies unlock the exclusive board, effect, and title without coin charges", () => {
  const root = JSON.parse(JSON.stringify(fixture(0)));
  root.profiles.playerA.trophies = { fullPaint: true, fullPaint3: true, noSkillFullPaint: true };
  root.profiles.playerA.trophyDates = { fullPaint: "2026-09-01T00:00:00.000Z", fullPaint3: "2026-09-01T00:00:00.000Z", noSkillFullPaint: "2026-09-01T00:00:00.000Z" };
  let current = root;
  for (const [index, cosmeticId] of ["boardCartographer", "effectMasterpiece", "titleArtisan"].entries()) {
    const result = tx.commitCosmeticAction({ root: current, expectedRootRevision: index, operationId: `trophy-${index}`, profileId: "playerA", cosmeticId, storage: { setItem() {} } });
    assert.equal(result.ok, true);
    assert.equal(result.receipt.price, 0);
    current = result.root;
  }
  assert.equal(current.profiles.playerA.equipped.board, "boardCartographer");
  assert.equal(current.profiles.playerA.equipped.effect, "effectMasterpiece");
  assert.equal(current.profiles.playerA.equipped.title, "titleArtisan");
  assert.equal(current.profiles.playerA.coins, 0);
});

test("legacy empty cosmetic fields project safe defaults and malformed receipts fail closed", () => {
  const root = fixture();
  const legacy = JSON.parse(JSON.stringify(root.profiles.playerA));
  legacy.cosmeticsOwned = [];
  legacy.equipped = {};
  const projection = cosmetics.projectCosmetics(legacy);
  assert.deepEqual(projection.equipped, cosmetics.DEFAULT_COSMETIC_BY_TYPE);
  assert.equal(projection.items.filter((item) => item.equipped).length, 4);
  const invalid = JSON.parse(JSON.stringify(root));
  invalid.receipts.cosmeticAction["playerA:oops"] = { scope: "cosmeticAction", price: -1 };
  assert.throws(() => save.validateStandardSave(invalid), /INVALID_COSMETIC_ACTION_RECEIPT/);
});
