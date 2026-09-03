"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const profileModel = require("../standard/standard-profile.js");
const save = require("../standard/standard-save.js");

function profile(inventory = {}) {
  return save.createProfile({ name: "Player", inventory });
}

test("v4.9 sale values are exact and a sale is immutable", () => {
  const cases = [
    ["colorRandomBorrow", 10],
    ["colorChoiceBorrow", 30],
    ["colorPrism", 80],
    ["areaHalfShift", 200],
    ["areaTripleShift", 500],
  ];
  for (const [skillId, value] of cases) assert.equal(profileModel.coinValueForSkill(skillId), value);
  const before = profile({ colorRandomBorrow: 4 });
  const result = profileModel.applyCardSale({ profile: before, skillId: "colorRandomBorrow", count: 1 });
  assert.equal(result.profile.inventory.colorRandomBorrow, 3);
  assert.equal(result.profile.coins, 10);
  assert.equal(before.inventory.colorRandomBorrow, 4);
  assert.equal(before.coins, 0);
});

test("keep-one sale preserves one copy and respects active-match reservation", () => {
  const before = profile({ colorChoiceBorrow: 5 });
  const sold = profileModel.applyKeepOneSale({ profile: before, skillId: "colorChoiceBorrow", confirmed: true });
  assert.equal(sold.profile.inventory.colorChoiceBorrow, 1);
  assert.equal(sold.profile.coins, 120);
  const reserved = profileModel.applyCardSale({ profile: before, skillId: "colorChoiceBorrow", count: 2, reservedCount: 2 });
  assert.equal(reserved.profile.inventory.colorChoiceBorrow, 3);
  assert.throws(() => profileModel.applyCardSale({ profile: before, skillId: "colorChoiceBorrow", count: 4, reservedCount: 2 }), /CARD_RESERVED_OR_MISSING/);
});

test("manual sale always retains one owned copy", () => {
  const last = profile({ colorRandomBorrow: 1 });
  assert.throws(() => profileModel.applyCardSale({ profile: last, skillId: "colorRandomBorrow", count: 1, confirmed: true }), /KEEP_ONE_REQUIRED/);
  const pair = profile({ colorRandomBorrow: 2 });
  const quote = profileModel.quoteCardSale({ profile: pair, skillId: "colorRandomBorrow", count: 1 });
  assert.deepEqual(quote.confirmationReasons, ["LAST_SELLABLE_COPY"]);
  assert.equal(profileModel.applyCardSale({ profile: pair, skillId: "colorRandomBorrow", count: 1, confirmed: true }).profile.inventory.colorRandomBorrow, 1);
});

test("protected, high-rarity, and last-copy safeguards fail closed", () => {
  const starter = profile({ areaHalfShift: 3 });
  assert.equal(starter.protectedSkills.areaHalfShift, true);
  assert.throws(() => profileModel.applyCardSale({ profile: starter, skillId: "areaHalfShift", count: 1, confirmed: true }), /CARD_PROTECTED/);
  const unprotected = profileModel.setCardProtection(starter, "areaHalfShift", false);
  assert.throws(() => profileModel.applyCardSale({ profile: unprotected, skillId: "areaHalfShift", count: 1 }), /SALE_CONFIRMATION_REQUIRED/);
  assert.equal(profileModel.applyCardSale({ profile: unprotected, skillId: "areaHalfShift", count: 1, confirmed: true }).profile.coins, 200);
});

test("wins, losses, streaks, history, and full-paint trophies are recorded once", () => {
  const endedAt = "2026-08-30T00:00:00.000Z";
  let current = profile();
  current = profileModel.recordMatchOutcome({ profile: current, matchId: "m1", won: true, terminalReason: "FULL_PAINT", fullPaint: true, skillsUsed: 0, endedAt });
  assert.deepEqual(current.stats, { wins: 1, losses: 0, currentWinStreak: 1, bestWinStreak: 1, fullPaints: 1 });
  assert.equal(current.trophies.fullPaint, true);
  assert.equal(current.trophies.noSkillFullPaint, true);
  assert.equal(current.trophies.fullPaint3, false);
  current = profileModel.recordMatchOutcome({ profile: current, matchId: "m2", won: true, terminalReason: "FULL_PAINT", fullPaint: true, skillsUsed: 1, endedAt });
  current = profileModel.recordMatchOutcome({ profile: current, matchId: "m3", won: true, terminalReason: "FULL_PAINT", fullPaint: true, skillsUsed: 2, endedAt });
  assert.equal(current.trophies.fullPaint3, true);
  assert.equal(current.stats.bestWinStreak, 3);
  current = profileModel.recordMatchOutcome({ profile: current, matchId: "m4", won: false, terminalReason: "SURRENDER", endedAt });
  assert.equal(current.stats.losses, 1);
  assert.equal(current.stats.currentWinStreak, 0);
  assert.equal(current.matchHistory[0].result, "LOSS");
  assert.throws(() => profileModel.recordMatchOutcome({ profile: current, matchId: "m4", won: false, terminalReason: "SURRENDER", endedAt }), /MATCH_ALREADY_RECORDED/);
});

test("progression fields survive standard save round-trip and reject malformed data", () => {
  const root = save.createStandardSave({ profiles: { player: profile({ colorPrism: 2 }) } });
  assert.deepEqual(save.decodeStandardSave(save.encodeStandardSave(root)), root);
  const invalid = JSON.parse(JSON.stringify(root));
  invalid.profiles.player.stats.bestWinStreak = -1;
  assert.throws(() => save.validateStandardSave(invalid), /INVALID_MATCH_STAT/);
  const invalidCoins = JSON.parse(JSON.stringify(root));
  invalidCoins.profiles.player.coins = "100";
  assert.throws(() => profileModel.applyCardSale({ profile: invalidCoins.profiles.player, skillId: "colorPrism", count: 1 }), /INVALID_COINS/);
});
