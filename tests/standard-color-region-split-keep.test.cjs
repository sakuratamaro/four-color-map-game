"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const registry = require("../standard/standard-skill-registry.js");
const save = require("../standard/standard-save.js");
const ID = "colorRegionSplitKeep";
const VERSION = "5.0.0-alpha.6";

function micro(macro) {
  return Array.from({ length: 16 }, (_, i) => (Math.floor(macro / 12) * 4 + Math.floor(i / 4)) * 48 + macro % 12 * 4 + i % 4);
}
function fixture(version = VERSION) {
  const rng = engine.createRngDomains(7011, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({ engineVersion: version, matchId: "split-keep", firstSeat: "A", hands: { A: { [ID]: 1, colorRegionSplit: 1, colorPrism: 1 }, B: {} } }, rng);
  Object.assign(state, { phase: "COLOR", pending: "R1", reserved: null, requiredSize: 3, rolledSize: 3, baseRequiredSize: 3,
    regions: { R1: { id: "R1", micro: [13, 14, 15].flatMap(micro), sourceMacros: [13, 14, 15], controllers: ["B"], color: null, isPending: true } } });
  state.basicPalettes.A = ["red", "blue"];
  state.bonusColors.A = "green";
  state.bonusUsesRemaining.A = 1;
  match.validateStandardState(state);
  return { state, rng };
}
function act(state, rng, type, payload, actor = "A", expectedVersion = state.version) {
  return match.applyStandardAction({ state, actor, rngStreams: rng, action: { type, payload }, expectedVersion });
}
function split(state, rng, sourceMacros = [13], skill = ID) {
  return act(state, rng, "USE_SKILL", { skill, regionId: "R1", sourceMacros });
}
function snapshots(rng) { return Object.fromEntries(Object.entries(rng).map(([id, stream]) => [id, stream.snapshot()])); }

test("UDL011 adds a normal consumable card without changing the frozen v4.9 catalogue", () => {
  assert.equal(registry.SPLIT_KEEP_ENGINE_VERSION, VERSION);
  assert.equal(registry.STANDARD_SKILLS[ID].rarity, 5);
  assert.equal(registry.STANDARD_SKILLS[ID].usageCategory, "color");
  assert.equal(registry.STANDARD_SKILLS[ID].experimental, false);
  assert.equal(registry.STANDARD_SKILLS[ID].v49Catalogued, false);
  assert.equal(registry.V49_SKILL_IDS.length, 19);
  assert.equal(registry.STANDARD_SKILL_IDS.includes(ID), true);
});

test("UDL011 acquisition and sale use the ordinary economy without changing its odds or keep-one rule", () => {
  const gacha = require("../standard/standard-gacha-transaction.js");
  const profileModel = require("../standard/standard-profile.js");
  const values = [0.99, 0, 0]; // ★5, COLOR, first member of its two-card pool.
  const draw = gacha.drawOne({ next: () => values.shift() }, 5);
  assert.equal(draw.skillId, ID);
  assert.equal(values.length, 0);
  const profile = save.createProfile({ name: "Buyer", inventory: { [ID]: 2 } });
  const quote = profileModel.quoteCardSale({ profile, skillId: ID, count: 1 });
  assert.equal(quote.rarity, 5);
  assert.equal(quote.earnedCoins, profileModel.SELL_PRICE_BY_RARITY[5]);
  assert.equal(quote.requiresConfirmation, true);
  const sold = profileModel.applyCardSale({ profile, skillId: ID, count: 1, confirmed: true });
  assert.equal(sold.profile.inventory[ID], 1);
  assert.throws(() => profileModel.quoteCardSale({ profile: sold.profile, skillId: ID, count: 1 }), /KEEP_ONE_REQUIRED/);
});

test("UDL011 both halves belong to the same COLOR window, then one normal WORK roll", () => {
  const { state, rng } = fixture();
  const before = snapshots(rng);
  const divided = split(state, rng);
  assert.equal(divided.ok, true);
  assert.equal(divided.state.hands.A[ID], 0);
  assert.equal(divided.state.hands.A.colorRegionSplit, 1);
  assert.equal(divided.state.skillsUsed.A, 1);
  assert.deepEqual(divided.state.retainedSplit, { actor: "A", firstRegionId: "R2", secondRegionId: "R3", stage: "FIRST" });
  assert.deepEqual(divided.publicState.retainedSplit, divided.state.retainedSplit);
  assert.deepEqual(snapshots(rng), before);
  assert.equal(act(divided.state, rng, "COLOR_REGION", { color: "red" }, "B").code, "NOT_YOUR_TURN");
  const first = act(divided.state, rng, "COLOR_REGION", { color: "red" });
  assert.equal(first.ok, true);
  assert.deepEqual([first.state.active, first.state.turn, first.state.phase, first.state.pending, first.state.reserved], ["A", state.turn, "COLOR", "R3", null]);
  assert.equal(first.state.retainedSplit.stage, "SECOND");
  assert.deepEqual(first.state.skillCategoryWindow, { actor: "A", categories: ["color"] });
  assert.deepEqual(snapshots(rng), before);
  assert.equal(act(first.state, rng, "USE_SKILL", { skill: "colorPrism" }).code, "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  const restored = match.decodeStandardMatch(match.encodeStandardMatch(first.state)).state;
  assert.deepEqual(restored, first.state);
  assert.equal(act(restored, rng, "COLOR_REGION", { color: "blue" }, "A", divided.state.version).code, "VERSION_CONFLICT");
  const second = act(restored, rng, "COLOR_REGION", { color: "blue" });
  assert.equal(second.ok, true);
  assert.deepEqual([second.state.active, second.state.turn, second.state.phase, second.state.pending], ["A", state.turn, "WORK", null]);
  assert.equal(Object.hasOwn(second.state, "retainedSplit"), false);
  assert.deepEqual(second.state.regions.R2.controllers, ["A"]);
  assert.deepEqual(second.state.regions.R3.controllers, ["A"]);
  assert.equal(rng.die.snapshot(), (before.die + 0x6d2b79f5) >>> 0);
  assert.deepEqual(second.state.skillCategoryWindow.categories, ["color"]);
});

test("UDL011 invalid partitions are atomic and old engines reject the new card", () => {
  for (const selection of [[], [13, 14, 15], [13, 13], [14], [13, 99]]) {
    const { state, rng } = fixture();
    const before = JSON.stringify(state), random = snapshots(rng);
    assert.equal(split(state, rng, selection).ok, false);
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(snapshots(rng), random);
  }
  for (const version of [1, 2, 3, 4, 5].map((n) => `5.0.0-alpha.${n}`)) {
    const { state, rng } = fixture(version);
    const before = JSON.stringify(state), random = snapshots(rng);
    assert.equal(split(state, rng).code, "SKILL_ENGINE_UNSUPPORTED");
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(snapshots(rng), random);
  }
});

test("UDL011 ordinary split still returns the remainder to the opponent on alpha.6", () => {
  const { state, rng } = fixture();
  const divided = split(state, rng, [13], "colorRegionSplit");
  assert.equal(Object.hasOwn(divided.state, "retainedSplit"), false);
  const first = act(divided.state, rng, "COLOR_REGION", { color: "red" });
  assert.deepEqual([first.state.active, first.state.turn, first.state.pending], ["B", state.turn + 1, "R3"]);
  assert.deepEqual(first.state.skillCategoryWindow, { actor: "B", categories: [] });
});

test("UDL011 per-paint seals, bonus and temporary colors retain their existing lifetimes", () => {
  const { state, rng } = fixture();
  state.publicEffects.A.seals = { yellow: 2 };
  const divided = split(state, rng).state;
  const first = act(divided, rng, "COLOR_REGION", { color: "green" }).state;
  assert.equal(first.bonusUsesRemaining.A, 0);
  assert.equal(first.publicEffects.A.seals.yellow, 1);
  const second = act(first, rng, "COLOR_REGION", { color: "blue" }).state;
  assert.equal(second.bonusUsesRemaining.A, 0);
  assert.equal(second.publicEffects.A.seals.yellow, 0);
  for (const effect of [{ prism: true }, { temporaryColors: ["yellow"] }]) {
    const source = fixture();
    Object.assign(source.state.privateEffects.A, effect);
    const part = split(source.state, source.rng).state;
    const painted = act(part, source.rng, "COLOR_REGION", { color: "yellow" }).state;
    assert.equal(painted.privateEffects.A.prism, undefined);
    assert.equal(painted.privateEffects.A.temporaryColors, undefined);
    assert.equal(act(painted, source.rng, "COLOR_REGION", { color: "yellow" }).code, "COLOR_UNAVAILABLE");
  }
});

test("UDL011 a blocked second half stays active; surrender and illegal painting clear the continuation", () => {
  const { state, rng } = fixture();
  const first = act(split(state, rng).state, rng, "COLOR_REGION", { color: "red" }).state;
  first.publicEffects.A.seals = Object.fromEntries(engine.COLORS.map((color) => [color, 1]));
  assert.equal(first.status, "ACTIVE");
  assert.equal(act(first, rng, "COLOR_REGION", { color: "blue" }).code, "COLOR_UNAVAILABLE");
  const surrendered = act(first, rng, "SURRENDER").state;
  assert.equal(surrendered.terminalReason, "SURRENDER");
  assert.equal(Object.hasOwn(surrendered, "retainedSplit"), false);
  first.publicEffects.A.seals = {};
  const illegal = act(first, rng, "COLOR_REGION", { color: "red" });
  assert.equal(illegal.code, "ILLEGAL_COLOR");
  assert.equal(illegal.state.winner, "B");
  assert.equal(Object.hasOwn(illegal.state, "retainedSplit"), false);
});

test("UDL011 malformed continuation snapshots fail closed", () => {
  const { state, rng } = fixture();
  const divided = split(state, rng).state;
  for (const mutation of [(s) => { s.retainedSplit.actor = "B"; }, (s) => { s.retainedSplit.stage = "SECOND"; },
    (s) => { s.retainedSplit.firstRegionId = "R99"; }, (s) => { s.retainedSplit.secret = "forged"; },
    (s) => { s.engineVersion = "5.0.0-alpha.5"; }, (s) => { s.skillCategoryWindow.categories = []; }]) {
    const invalid = structuredClone(divided);
    mutation(invalid);
    assert.throws(() => match.validateStandardState(invalid), /INVALID_RETAINED_SPLIT/);
  }
});

test("UDL011 save and retry consume exactly one inventory card", () => {
  const { state, rng } = fixture();
  const root = save.createStandardSave({ profiles: { p: save.createProfile({ name: "A", inventory: { [ID]: 2 } }) },
    activeMatch: { state, rngSnapshot: {}, participants: { A: { type: "PROFILE", profileId: "p", displayNameSnapshot: "A" }, B: { type: "CPU", difficulty: "normal", policyVersion: "fixture-v1" } }, startedAt: "2026-09-26T00:00:00.000Z", finishedAt: null, settlement: { settled: false } },
    reservations: { p: { [ID]: 1 } } });
  const result = split(state, rng);
  const committed = save.commitAcceptedCardAction({ root, beforeState: state, result, actor: "A", actionId: "new-card-1", rngSnapshot: snapshots(rng) });
  assert.equal(committed.profiles.p.inventory[ID], 1);
  const restored = save.decodeStandardSave(save.encodeStandardSave(committed));
  assert.deepEqual(restored, committed);
  assert.equal(save.commitAcceptedCardAction({ root: restored, beforeState: state, result, actor: "A", actionId: "new-card-1", rngSnapshot: {} }), restored);
  assert.equal(Object.keys(restored.receipts.matchConsumption).length, 1);
});
