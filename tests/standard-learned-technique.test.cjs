"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createHash } = require("node:crypto");
const legacyTrace = require("./helpers/learned-technique-legacy-trace.cjs");
const legacyGolden = require("./fixtures/learned-technique-legacy-traces.json");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const start = require("../standard/standard-match-start.js");
const transaction = require("../standard/standard-match-transaction.js");
const registry = require("../standard/standard-skill-registry.js");
const gacha = require("../standard/standard-gacha-transaction.js");
const profile = require("../standard/standard-profile.js");
const loadoutQuote = require("../standard/standard-loadout-quote.js");

const PILOT = "5.0.0-alpha.5";
const TECH = "techUnsealOne";
const clone = (value) => JSON.parse(JSON.stringify(value));
const loadout = () => ({
  color: ["colorPrism", "colorRandomBorrow"],
  area: ["areaDiePlus", "areaResize"],
  disrupt: ["disruptChoiceOne", "disruptRandomTwo"],
});
const learned = () => ({ id: TECH, definitionVersion: "unseal-v1", source: "LEARNED", usesRemaining: 1 });
const loan = () => ({ ...learned(), source: "TRIAL_LOAN", trialId: "ren-unseal", trialVersion: 1 });
function fixture(overrides = {}) {
  const rng = engine.createRngDomains(91214, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({
    matchId: "unseal-pilot-local", firstSeat: "A", engineVersion: PILOT,
    loadouts: { A: loadout(), B: loadout() },
    techniqueRule: { id: "CPU_LEARNED_V1", playerSeat: "A" },
    techniques: { A: learned(), B: null }, ...overrides,
  }, rng);
  state.basicPalettes.A = ["red", "blue"];
  state.bonusColors.A = "yellow";
  state.bonusUsesRemaining.A = 1;
  state.publicEffects.A.seals = { red: 2, blue: 1 };
  state.phase = "COLOR";
  state.regions = {
    R1: { id: "R1", micro: [52, 53], sourceMacros: [], controllers: ["B"], color: null, isPending: true },
  };
  state.pending = "R1";
  match.validateStandardState(state);
  return { state, rng };
}
function use(state, rng, payload = { skill: TECH, color: "red" }, actor = "A", expectedVersion = state.version) {
  return match.applyStandardAction({ state, actor, expectedVersion, rngStreams: rng, action: { type: "USE_SKILL", payload } });
}
function rejectsUnchanged(state, rng, code, payload, actor, expectedVersion) {
  const before = clone(state);
  const rngBefore = engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS);
  const result = use(state, rng, payload, actor, expectedVersion);
  assert.equal(result.ok, false);
  assert.equal(result.code, code);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
  assert.deepEqual(engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS), rngBefore);
  assert.equal(result.cardConsumed, undefined);
  assert.equal(result.techniqueConsumed, undefined);
}
test("AC-011-01: learned metadata is separate, opt-in, and excluded from ordinary card channels", () => {
  const definition = registry.STANDARD_SKILLS[TECH];
  assert.ok(definition);
  assert.equal(definition.displayName, "解封");
  assert.equal(definition.acquisitionType, "LEARNED");
  assert.equal(definition.displayRarity, false);
  assert.equal(definition.gachaEnabled, false);
  assert.equal(definition.v49Catalogued, false);
  assert.equal(definition.standardUiEnabled, false);
  assert.equal(definition.experimental, false);
  assert.equal(definition.usageCategory, "color");
  assert.equal(definition.timing, "COLOR");
  assert.equal(definition.expectedRngDraws, 0);
  assert.equal(registry.V49_SKILL_IDS.includes(TECH), false);
  assert.equal(match.ENGINE_VERSION, "5.0.0-alpha.4", "default creation remains unchanged");
  assert.equal(registry.LEARNED_TECHNIQUE_ENGINE_VERSION, PILOT);
});
test("AC-064-06: real sale, gacha pools and six-card quote paths reject the learned technique", () => {
  assert.throws(() => profile.coinValueForSkill(TECH), { code: "UNKNOWN_SELLABLE_SKILL" });
  for (const category of ["color", "area", "disrupt"]) for (const rarity of [1, 2, 3, 4, 5]) {
    assert.equal(gacha.pool(category, rarity).includes(TECH), false);
  }
  const invalid = loadout();
  invalid.color[0] = TECH;
  assert.throws(() => loadoutQuote.normalizeStandardLoadout(invalid), { code: "SKILL_NOT_AVAILABLE" });
});
for (const count of [1, 2, 3]) {
  test("AC-011-01: unseal current color with seal " + count + " and consume only the separate use", () => {
    const { state, rng } = fixture();
    state.publicEffects.A.seals.red = count;
    state.privateEffects.A.curseBacklash = 2;
    const before = clone(state);
    const rngBefore = engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS);
    const result = use(state, rng);
    assert.equal(result.ok, true);
    assert.equal(result.cardConsumed, false);
    assert.equal(result.techniqueConsumed, true);
    assert.equal(result.rngDraws, 0);
    assert.equal(result.state.techniques.A.usesRemaining, 0);
    assert.equal(result.state.publicEffects.A.seals.red, 0);
    assert.equal(result.state.publicEffects.A.seals.blue, 1);
    assert.deepEqual(result.state.hands, before.hands);
    assert.deepEqual(result.state.loadouts, before.loadouts);
    assert.deepEqual(result.state.basicPalettes, before.basicPalettes);
    assert.deepEqual(result.state.bonusColors, before.bonusColors);
    assert.deepEqual(result.state.bonusUsesRemaining, before.bonusUsesRemaining);
    assert.deepEqual(result.state.privateEffects, before.privateEffects);
    assert.deepEqual(result.state.regions, before.regions);
    assert.equal(result.state.active, before.active);
    assert.equal(result.state.turn, before.turn);
    assert.equal(result.state.version, before.version + 1);
    assert.equal(result.state.skillsUsed.A, before.skillsUsed.A + 1);
    assert.deepEqual(result.state.skillCategoryWindow, { actor: "A", categories: ["color"] });
    assert.deepEqual(engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS), rngBefore);
    assert.deepEqual(state, before, "caller state is immutable");
  });
}
test("AC-011-01: duplicate basic and zero-stock bonus share the same color seal", () => {
  const { state, rng } = fixture();
  state.basicPalettes.A = ["red", "red"];
  state.bonusColors.A = "red";
  state.bonusUsesRemaining.A = 0;
  const result = use(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.state.publicEffects.A.seals.red, 0);
  assert.deepEqual(result.state.basicPalettes.A, ["red", "red"]);
  assert.equal(result.state.bonusUsesRemaining.A, 0);
});
test("AC-011-01: bonus-only color at stock zero is a real successful effect, not a refill", () => {
  const { state, rng } = fixture();
  state.bonusUsesRemaining.A = 0;
  state.publicEffects.A.seals.yellow = 3;
  const result = use(state, rng, { skill: TECH, color: "yellow" });
  assert.equal(result.ok, true);
  assert.equal(result.state.publicEffects.A.seals.yellow, 0);
  assert.equal(result.state.bonusUsesRemaining.A, 0);
  assert.equal(result.state.techniques.A.usesRemaining, 0);
  assert.deepEqual(result.state.skillCategoryWindow.categories, ["color"]);
});
test("AC-011-01: pollution selects the injected current color; old rim color is not owned", () => {
  const { state, rng } = fixture();
  state.basicPalettes.A[0] = "green";
  state.privateEffects.A.paletteDebuffs = [{ slot: 0, previousColor: "red", injectedColor: "green", remaining: 2 }];
  state.publicEffects.A.seals.green = 2;
  rejectsUnchanged(state, rng, "TECHNIQUE_COLOR_NOT_OWNED", { skill: TECH, color: "red" });
  const result = use(state, rng, { skill: TECH, color: "green" });
  assert.equal(result.ok, true);
  assert.equal(result.state.publicEffects.A.seals.red, 2);
  assert.equal(result.state.publicEffects.A.seals.green, 0);
  assert.deepEqual(result.state.privateEffects, state.privateEffects);
  assert.deepEqual(result.state.basicPalettes, state.basicPalettes);
});
for (const effect of [{ temporaryColors: ["green"] }, { prism: true }, {}]) {
  test("AC-011-01: non-owned color rejected even with temporary access " + JSON.stringify(effect), () => {
    const { state, rng } = fixture();
    state.privateEffects.A = effect;
    state.publicEffects.A.seals.green = 2;
    rejectsUnchanged(state, rng, "TECHNIQUE_COLOR_NOT_OWNED", { skill: TECH, color: "green" });
  });
}
for (const count of [0, undefined]) {
  test("AC-011-01: unsealed target " + count + " does not consume anything", () => {
    const { state, rng } = fixture();
    if (count === undefined) delete state.publicEffects.A.seals.red;
    else state.publicEffects.A.seals.red = count;
    rejectsUnchanged(state, rng, "TECHNIQUE_COLOR_NOT_SEALED");
  });
}
test("AC-011-01: same-category restriction blocks technique and technique blocks ordinary color skill", () => {
  const { state, rng } = fixture();
  state.skillCategoryWindow.categories = ["color"];
  rejectsUnchanged(state, rng, "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  state.skillCategoryWindow.categories = [];
  const result = use(state, rng);
  rejectsUnchanged(result.state, rng, "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW", { skill: "colorPrism" });
});
test("AC-011-01: wrong phase, actor, version and malformed/forged payloads reject without effects", () => {
  const { state, rng } = fixture();
  rejectsUnchanged(state, rng, "NOT_YOUR_TURN", undefined, "B");
  rejectsUnchanged(state, rng, "VERSION_CONFLICT", undefined, "A", 9);
  for (const payload of [{ skill: TECH }, { skill: TECH, color: "purple" }, { skill: TECH, color: "red", source: "LEARNED" }]) {
    rejectsUnchanged(state, rng, "INVALID_TARGET_SCHEMA", payload);
  }
  state.phase = "WORK";
  state.pending = null;
  state.regions = {};
  rejectsUnchanged(state, rng, "WRONG_PHASE");
});
test("AC-011-01: unseal does not waive ordinary adjacency loss", () => {
  const { state, rng } = fixture();
  state.regions.R2 = { id: "R2", micro: [51], sourceMacros: [], controllers: ["B"], color: "red", isPending: false };
  const result = use(state, rng);
  assert.equal(result.ok, true);
  const colored = match.applyStandardAction({ state: result.state, actor: "A", expectedVersion: result.state.version, rngStreams: rng,
    action: { type: "COLOR_REGION", payload: { color: "red" } } });
  assert.equal(colored.ok, true);
  assert.equal(colored.code, "ILLEGAL_COLOR");
  assert.equal(colored.state.winner, "B");
});
test("AC-011-02: match save roundtrip preserves used status; only a fresh configured match has one use", () => {
  const { state, rng } = fixture();
  const result = use(state, rng);
  const restored = match.decodeStandardMatch(match.encodeStandardMatch(result.state, engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS))).state;
  restored.skillCategoryWindow.categories = [];
  rejectsUnchanged(restored, rng, "TECHNIQUE_UNAVAILABLE");
  const fresh = fixture({ matchId: "unseal-new-match" });
  assert.equal(fresh.state.techniques.A.usesRemaining, 1);
  assert.equal(use(fresh.state, fresh.rng).ok, true);
});
test("AC-064-05: trial loans are fixed on both seats; ordinary CPU does not mirror equipment", () => {
  const ordinary = fixture();
  assert.equal(ordinary.state.techniques.B, null);
  const trial = fixture({ techniqueRule: { id: "REN_UNSEAL_TRIAL_V1", playerSeat: "A" }, techniques: { A: loan(), B: loan() } });
  assert.deepEqual(trial.state.techniques.A, trial.state.techniques.B);
  assert.equal(use(trial.state, trial.rng).ok, true);
  assert.equal(trial.state.techniques.B.usesRemaining, 1);
  assert.throws(() => fixture({ techniques: { A: learned(), B: learned() } }), { code: "INVALID_TECHNIQUE_SNAPSHOT" });
  assert.throws(() => fixture({ techniqueRule: { id: "REN_UNSEAL_TRIAL_V1", playerSeat: "A" }, techniques: { A: loan(), B: null } }),
    { code: "INVALID_TECHNIQUE_SNAPSHOT" });
});
test("AC-064-05: pilot PvP/default pilot rules disable techniques, payload cannot grant one", () => {
  const { state, rng } = fixture({ techniqueRule: { id: "PVP_TECHNIQUES_DISABLED_V1", playerSeat: null }, techniques: { A: null, B: null } });
  rejectsUnchanged(state, rng, "TECHNIQUE_UNAVAILABLE");
  assert.throws(() => fixture({ techniqueRule: { id: "PVP_TECHNIQUES_DISABLED_V1", playerSeat: null } }),
    { code: "INVALID_TECHNIQUE_SNAPSHOT" });
});
test("AC-064-07: old engine state cannot opt into a technique or place it in the ordinary hand", () => {
  for (const version of ["5.0.0-alpha.1", "5.0.0-alpha.2", "5.0.0-alpha.3", "5.0.0-alpha.4"]) {
    const rng = engine.createRngDomains(771, match.REQUIRED_RNG_STREAMS);
    const state = match.createStandardMatch({ matchId: "old-match", firstSeat: "A", engineVersion: version }, rng);
    assert.equal(Object.hasOwn(state, "techniques"), false);
    assert.equal(Object.hasOwn(match.projectStandardPublicState(state), "techniques"), false);
    assert.equal(use(state, rng).code, "TECHNIQUE_ENGINE_UNSUPPORTED");
    assert.throws(() => match.validateStandardState({ ...state, techniques: { A: learned(), B: null } }),
      { code: "TECHNIQUE_ENGINE_UNSUPPORTED" });
  }
  assert.throws(() => fixture({ hands: { A: { [TECH]: 1 }, B: {} } }), { code: "TECHNIQUE_IN_ORDINARY_HAND" });
  assert.throws(() => fixture({ techniques: { A: { ...learned(), usesRemaining: 0 }, B: null } }), { code: "INVALID_INITIAL_TECHNIQUE_USES" });
});
for (const expected of legacyGolden.cases) {
  test("AC-064-07: pre-pilot state/projection/RNG/save bytes preserved " + expected.engineVersion + " seed " + expected.seed, () => {
    const actual = legacyTrace(engine, match, expected.engineVersion, expected.seed);
    assert.equal(actual.length, expected.snapshots);
    assert.equal(createHash("sha256").update(JSON.stringify(actual)).digest("hex"), expected.sha256);
  });
}
test("AC-064-05: both fixed trial seats can spend their own loan independently", () => {
  const { state, rng } = fixture({ techniqueRule: { id: "REN_UNSEAL_TRIAL_V1", playerSeat: "A" }, techniques: { A: loan(), B: loan() } });
  const a = use(state, rng);
  assert.equal(a.ok, true);
  const bState = clone(a.state);
  bState.active = "B";
  bState.skillCategoryWindow = { actor: "B", categories: [] };
  bState.publicEffects.B.seals[bState.basicPalettes.B[0]] = 2;
  const b = use(bState, rng, { skill: TECH, color: bState.basicPalettes.B[0] }, "B");
  assert.equal(b.ok, true);
  assert.equal(b.state.techniques.A.usesRemaining, 0);
  assert.equal(b.state.techniques.B.usesRemaining, 0);
});
test("AC-064-06: public technique projection contains no normal hand, palette or private provenance", () => {
  const { state } = fixture();
  const publicState = match.projectStandardPublicState(state);
  assert.deepEqual(publicState.techniques, { A: { id: TECH, definitionVersion: "unseal-v1", usesRemaining: 1 }, B: null });
  for (const key of ["hands", "loadouts", "basicPalettes", "bonusColors", "privateEffects"]) assert.equal(Object.hasOwn(publicState, key), false);
  assert.equal(JSON.stringify(publicState.techniques).includes("LEARNED"), false);
  assert.equal(Object.keys(state.hands.A).length, 6);
  assert.equal(Object.values(state.loadouts.A).flat().length, 6);
});
test("AC-011-02: local save transaction persists once and retry cannot charge inventory or consume twice", () => {
  const { state, rng } = fixture();
  const inventory = Object.fromEntries(Object.values(loadout()).flat().map((id) => [id, 3]));
  const root = save.createStandardSave({ profiles: { playerA: save.createProfile({ name: "Alice", inventory }),
    playerB: save.createProfile({ name: "Bob", inventory }) }, rngSnapshot: engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS) });
  const started = start.startStandardMatch({ root, expectedRootRevision: root.rootRevision, operationId: "local-start", matchId: state.matchId,
    ruleSetId: start.RULE_SET_IDS.STANDARD, participants: { A: { type: "PROFILE", profileId: "playerA" }, B: { type: "CPU", difficulty: "normal", policyVersion: "local-core-fixture" } },
    loadouts: { A: loadout(), B: loadout() }, firstSeat: "A", clock: { now: () => "2026-09-14T07:20:00.000Z" }, storageAdapter: { setItem() {} } });
  assert.equal(started.ok, true);
  // Trusted local state fixture only; this is NOT online ownership/start/SQL proof.
  const current = clone(started.root);
  current.activeMatch.state = state;
  current.activeMatch.rngSnapshot = engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS);
  const beforeProfiles = clone(current.profiles);
  const beforeReservations = clone(current.reservations);
  let persisted;
  const action = { id: "unseal-once", type: "USE_SKILL", payload: { skill: TECH, color: "red" } };
  const dispatch = (subject, nextAction = action) => transaction.dispatchStandardMatchAction({ root: subject, expectedRootRevision: subject.rootRevision,
    expectedMatchVersion: subject.activeMatch.state.version, matchId: state.matchId, actorSeat: "A", action: nextAction,
    storageAdapter: { setItem(key, value) { persisted = value; } } });
  const resolved = dispatch(current);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.cardConsumed, false);
  assert.deepEqual(resolved.root.profiles, beforeProfiles);
  assert.deepEqual(resolved.root.reservations, beforeReservations);
  assert.deepEqual(resolved.root.receipts.matchConsumption, current.receipts.matchConsumption);
  assert.ok(resolved.root.receipts.matchAction[state.matchId + ":unseal-once"]);
  const reloaded = save.decodeStandardSave(persisted);
  assert.equal(reloaded.activeMatch.state.techniques.A.usesRemaining, 0);
  const replay = dispatch(reloaded);
  assert.equal(replay.code, "IDEMPOTENT_REPLAY");
  assert.deepEqual(replay.root, reloaded);
  assert.equal(dispatch(reloaded, { ...action, payload: { skill: TECH, color: "blue" } }).code, "IDEMPOTENCY_KEY_REUSE");
  const used = dispatch(reloaded, { ...action, id: "unseal-twice" });
  assert.equal(used.ok, false);
  assert.equal(used.code, "TECHNIQUE_UNAVAILABLE");
  assert.deepEqual(used.root, reloaded);
});
