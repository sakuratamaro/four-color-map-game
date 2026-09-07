"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const save = require("../standard/standard-save.js");

const root = path.join(__dirname, "..");
const builder = fs.readFileSync(path.join(root, "scripts", "build-standard-online-engine.mjs"), "utf8");
const bundle = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "standard-engine.bundle.js"), "utf8");

function loadApi() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(bundle, sandbox, { filename: "standard-engine.bundle.js" });
  return sandbox.FourColorStandardServerEngine;
}

const loadouts = {
  A: {
    color: ["colorPrism", "colorChoiceBorrow"],
    area: ["areaHalfShift", "areaDiePlus"],
    disrupt: ["disruptChoiceOne", "disruptRandomOne"],
  },
  B: {
    color: ["colorPaletteChange", "colorRandomBorrow"],
    area: ["areaResize", "areaTripleShift"],
    disrupt: ["disruptChoiceTwo", "disruptPaletteRandom"],
  },
};

function profiles() {
  return Object.fromEntries(["A", "B"].map((seat) => [seat, save.createProfile({
    name: `Player ${seat}`,
    inventory: Object.fromEntries(Object.values(loadouts[seat]).flat().map((id) => [id, 2])),
  })]));
}

test("server bundle contains only authoritative Standard rule and profile modules", () => {
  for (const id of [
    "standard-engine.js",
    "standard-region-geometry.js",
    "standard-skill-registry.js",
    "standard-skill-handlers.js",
    "standard-skill-dispatcher.js",
    "standard-match.js",
    "standard-cosmetics.js",
  ]) assert.match(builder, new RegExp(id.replaceAll(".", "\\.")));
  assert.doesNotMatch(builder, /standard-local-session|standard-save|standard-v5\/app/i);
  assert.doesNotMatch(bundle, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|postgres(?:ql)?:\/\//i);
});

test("bundle exposes a deterministic server-only Standard engine", () => {
  const api = loadApi();
  assert.equal(api.ENGINE_VERSION, "5.0.0-alpha.4");
  assert.equal(typeof api.create, "function");
  assert.equal(typeof api.apply, "function");
  assert.equal(typeof api.applyProfiles, "function");
  assert.equal(typeof api.applyCpuProfiles, "function");
  assert.equal(typeof api.drawGacha, "function");
  assert.equal(JSON.stringify(api.GACHA_ODDS), JSON.stringify(require("../standard/standard-gacha-transaction.js").GACHA_ODDS));
  assert.equal(typeof api.quoteCardSale, "function");
  assert.equal(typeof api.sellCards, "function");
  assert.equal(typeof api.getCosmetics, "function");
  assert.equal(typeof api.quoteCosmetic, "function");
  assert.equal(typeof api.applyCosmetic, "function");
  assert.equal(typeof api.getCpuRoster, "function");
  assert.equal(typeof api.createCpuProfile, "function");
  assert.equal(typeof api.chooseCpuAction, "function");
  assert.equal(typeof api.validateProfile, "function");
  assert.equal(typeof api.validateSeatLoadout, "function");
  const first = api.create({ matchId: "online-match-1", loadouts, seed: 0x12345678, firstSeat: "A" });
  const second = api.create({ matchId: "online-match-1", loadouts, seed: 0x12345678, firstSeat: "A" });
  assert.deepEqual(first, second);
  assert.equal(first.state.version, 0);
  assert.equal(first.state.active, "A");
  assert.equal(Object.keys(first.rngSnapshot).length, api.REQUIRED_RNG_STREAMS.length);
});

test("server engine defaults to alpha.4 while preserving alpha.1, alpha.2, and alpha.3 states", () => {
  const api = loadApi();
  for (const [index, engineVersion] of ["5.0.0-alpha.1", "5.0.0-alpha.2"].entries()) {
    const legacy = api.create({ matchId: `online-legacy-${index}`, loadouts, seed: 0x12345679 + index, firstSeat: "A", engineVersion });
    assert.equal(legacy.state.engineVersion, engineVersion);
    assert.equal(Object.hasOwn(legacy.state, "skillCategoryWindow"), false, engineVersion);
  }

  const alpha3 = api.create({ matchId: "online-alpha3-load", loadouts, seed: 0x12345681, firstSeat: "A", engineVersion: "5.0.0-alpha.3" });
  assert.equal(alpha3.state.engineVersion, "5.0.0-alpha.3");
  assert.equal(JSON.stringify(alpha3.state.skillCategoryWindow), JSON.stringify({ actor: "A", categories: [] }));
  const continued = api.apply({
    state: alpha3.state,
    rngSnapshot: alpha3.rngSnapshot,
    actor: "A",
    action: { id: "alpha3-continue", type: "SURRENDER", payload: {} },
    expectedVersion: 0,
  });
  assert.equal(continued.ok, true);
  assert.equal(continued.state.engineVersion, "5.0.0-alpha.3");

  assert.throws(
    () => api.create({ matchId: "online-bad-version", loadouts, seed: 0x12345679, firstSeat: "A", engineVersion: "5.0.0-alpha.999" }),
    /INVALID_ENGINE_VERSION/,
  );
  const current = api.create({ matchId: "online-alpha4-default", loadouts, seed: 0x12345680, firstSeat: "A" });
  assert.equal(current.state.engineVersion, "5.0.0-alpha.4");
  assert.equal(JSON.stringify(current.state.skillCategoryWindow), JSON.stringify({ actor: "A", categories: [] }));
  assert.equal(api.project(current.state).publicState.engineVersion, "5.0.0-alpha.4");
});

test("generated server bundle executes the alpha.4 colored corner-bloom payload", () => {
  const api = loadApi();
  const cornerLoadouts = JSON.parse(JSON.stringify(loadouts));
  cornerLoadouts.A.area = ["areaCornerBloom", "areaDiePlus"];
  const created = api.create({ matchId: "online-alpha4-colored-corner", loadouts: cornerLoadouts, seed: 0x12345682, firstSeat: "A" });
  const state = created.state;
  const macro = 26;
  const macroRow = Math.floor(macro / 12);
  const macroCol = macro % 12;
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: {
      id: "R1",
      micro: Array.from({ length: 16 }, (_, index) => (macroRow * 4 + Math.floor(index / 4)) * 48 + macroCol * 4 + (index % 4)),
      sourceMacros: [macro],
      controllers: ["B"],
      color: "red",
      isPending: false,
    },
  };
  const applied = api.apply({
    state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { id: "alpha4-colored-corner", type: "USE_SKILL", payload: { skill: "areaCornerBloom", regionId: "R1", macro } },
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.state.engineVersion, "5.0.0-alpha.4");
  assert.equal(applied.state.regions.R1.micro.length, 28);
  assert.equal(applied.state.hands.A.areaCornerBloom, 0);
  assert.equal(applied.rngSnapshot["skill-effect"], created.rngSnapshot["skill-effect"]);
  assert.equal(JSON.stringify(applied.state.skillCategoryWindow), JSON.stringify({ actor: "A", categories: ["area"] }));
});

test("generated server bundle executes Micro Bloom and commits its prepared outgoing region", () => {
  const api = loadApi();
  const microLoadouts = JSON.parse(JSON.stringify(loadouts));
  microLoadouts.A.area = ["areaMicroBloom", "areaDiePlus"];
  const created = api.create({ matchId: "online-micro-bloom", loadouts: microLoadouts, seed: 0x12345683, firstSeat: "A" });
  const state = created.state;
  const macro = 13;
  const macroRow = Math.floor(macro / 12);
  const macroCol = macro % 12;
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: {
      id: "R1",
      micro: Array.from({ length: 16 }, (_, index) => (macroRow * 4 + Math.floor(index / 4)) * 48 + macroCol * 4 + (index % 4)),
      sourceMacros: [macro],
      controllers: ["B"],
      color: "red",
      isPending: false,
    },
  };
  const bloomed = api.apply({
    state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { id: "online-micro-bloom-use", type: "USE_SKILL", payload: { skill: "areaMicroBloom", sourceMacros: [26] } },
  });
  assert.equal(bloomed.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(bloomed.state.preparedOutgoing.sourceMacros)), [26]);
  assert.equal(bloomed.state.preparedOutgoing.skills.includes("areaMicroBloom"), true);
  assert.equal(bloomed.state.hands.A.areaMicroBloom, 0);
  const committed = api.apply({
    state: bloomed.state,
    rngSnapshot: bloomed.rngSnapshot,
    actor: "A",
    expectedVersion: 1,
    action: { id: "online-micro-bloom-create", type: "CREATE_REGION", payload: { sourceMacros: [26] } },
  });
  assert.equal(committed.ok, true);
  assert.equal(committed.state.preparedOutgoing, null);
  assert.deepEqual([committed.state.active, committed.state.phase, committed.state.pending], ["B", "COLOR", "R2"]);
  assert.equal(committed.contactColorCount, 1);
});

test("generated server bundle defers zero-candidate curse backlash until rescued legal coloring", () => {
  const api = loadApi();
  const curseLoadouts = JSON.parse(JSON.stringify(loadouts));
  curseLoadouts.B.color = ["colorPrism", "colorRandomBorrow"];
  const created = api.create({ matchId: "online-deferred-curse", loadouts: curseLoadouts, seed: 0x12345684, firstSeat: "A" });
  const state = created.state;
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.privateEffects.B.curseBacklash = 1;
  const palette = [...new Set([...state.basicPalettes.B, state.bonusColors.B])];
  state.publicEffects.B.seals = Object.fromEntries(palette.map((color) => [color, 1]));
  const skillEffectBefore = created.rngSnapshot["skill-effect"];

  const entered = api.apply({
    state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { id: "online-deferred-curse-create", type: "CREATE_REGION", payload: { sourceMacros: [13] } },
  });
  assert.equal(entered.ok, true);
  assert.equal(entered.privateB.privateEffects.curseBacklash, 1);
  assert.equal(entered.rngSnapshot["skill-effect"], skillEffectBefore);

  const rescued = api.apply({
    state: entered.state,
    rngSnapshot: entered.rngSnapshot,
    actor: "B",
    expectedVersion: 1,
    action: { id: "online-deferred-curse-rescue", type: "USE_SKILL", payload: { skill: "colorPrism" } },
  });
  assert.equal(rescued.ok, true);
  assert.equal(rescued.privateB.privateEffects.curseBacklash, 1);
  const rescueColor = ["red", "blue", "yellow", "green"].find((color) => !palette.includes(color));
  assert.ok(rescueColor);

  const colored = api.apply({
    state: rescued.state,
    rngSnapshot: rescued.rngSnapshot,
    actor: "B",
    expectedVersion: 2,
    action: { id: "online-deferred-curse-color", type: "COLOR_REGION", payload: { color: rescueColor } },
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.regions.R1.color, rescueColor);
  assert.equal(colored.privateB.privateEffects.curseBacklash, undefined);
  assert.equal(colored.rngSnapshot["skill-effect"], skillEffectBefore);
});

test("server bundle exposes ten safe CPU identities and deterministic legal decisions", () => {
  const api = loadApi();
  const roster = api.getCpuRoster();
  assert.equal(roster.length, 10);
  assert.equal(roster.some((entry) => Object.hasOwn(entry, "parameters")), false);
  const cpuProfile = api.createCpuProfile("yuzu");
  assert.equal(Object.values(cpuProfile.loadout).flat().length, 6);
  assert.equal(cpuProfile.profile.displayName, "うっかりユズ");
  assert.equal(cpuProfile.policyVersion, "standard-character-roster-v1:yuzu", "engine upgrade does not change persisted CPU identity");
  const created = api.create({ matchId: "cpu-server", loadouts: { A: loadouts.A, B: cpuProfile.loadout }, profiles: { A: profiles().A, B: cpuProfile.profile }, seed: 123, firstSeat: "B" });
  const first = api.chooseCpuAction({ publicState: created.publicState, ownPrivateState: created.privateB, characterId: "yuzu", policyVersion: cpuProfile.policyVersion, seed: 999 });
  const second = api.chooseCpuAction({ publicState: created.publicState, ownPrivateState: created.privateB, characterId: "yuzu", policyVersion: cpuProfile.policyVersion, seed: 999 });
  assert.deepEqual(first, second);
  const applied = api.apply({ state: created.state, rngSnapshot: created.rngSnapshot, actor: "B", action: { ...first, id: "cpu-action" }, expectedVersion: 0 });
  assert.equal(applied.ok, true);
});

test("server card sale preserves one copy and applies confirmation rules", () => {
  const api = loadApi();
  const before = save.createProfile({ name: "Seller", inventory: { colorRandomBorrow: 3, colorPrism: 2 } });
  const quote = api.quoteCardSale({ profile: before, skillId: "colorRandomBorrow", count: 2 });
  assert.equal(quote.remaining, 1);
  assert.equal(quote.earnedCoins, 20);
  assert.equal(quote.requiresConfirmation, true);
  assert.throws(() => api.sellCards({ profile: before, skillId: "colorRandomBorrow", count: 2, confirmed: false }), /SALE_CONFIRMATION_REQUIRED/);
  const sold = api.sellCards({ profile: before, skillId: "colorRandomBorrow", count: 2, confirmed: true });
  assert.equal(sold.profile.inventory.colorRandomBorrow, 1);
  assert.equal(sold.profile.coins, 20);
  assert.equal(before.inventory.colorRandomBorrow, 3);
  assert.throws(() => api.quoteCardSale({ profile: before, skillId: "colorPrism", count: 2 }), /KEEP_ONE_REQUIRED/);
});

test("server cosmetics derive price and equip state without changing gameplay capability", () => {
  const api = loadApi();
  const before = { ...JSON.parse(JSON.stringify(save.createProfile({ name: "Collector", inventory: { colorPrism: 2 } }))), coins: 1000 };
  const catalog = api.getCosmetics({ profile: before });
  assert.equal(catalog.items.length, 12);
  const quote = api.quoteCosmetic({ profile: before, cosmeticId: "boardAurora" });
  assert.equal(quote.price, 600);
  assert.equal(quote.coinsAfter, 400);
  const applied = api.applyCosmetic({ profile: before, cosmeticId: "boardAurora" });
  assert.equal(applied.profile.coins, 400);
  assert.equal(applied.profile.equipped.board, "boardAurora");
  assert.equal(JSON.stringify(applied.profile.inventory), JSON.stringify(before.inventory));
  assert.equal(JSON.stringify(applied.profile.protectedSkills), JSON.stringify(before.protectedSkills));
  assert.equal(before.coins, 1000);
});

test("one gacha draw deterministically consumes one ticket, preserves inventory, and adds exactly one card", () => {
  const api = loadApi();
  const before = save.createProfile({
    name: "Gacha",
    inventory: { colorPrism: 2, areaMicroBloom: 3 },
    gachaTickets: { "1": 2 },
  });
  const beforeSnapshot = JSON.parse(JSON.stringify(before));
  const first = api.drawGacha({ profile: before, ticketLevel: 1, count: 1, seed: 0x12345678 });
  const second = api.drawGacha({ profile: before, ticketLevel: 1, count: 1, seed: 0x12345678 });
  assert.deepEqual(first, second);
  assert.deepEqual(before, beforeSnapshot);
  assert.equal(first.profile.gachaTickets["1"], 1);
  assert.equal(first.draws.length, 1);
  const gained = Object.entries(first.profile.inventory).filter(([id, count]) => count - (before.inventory[id] || 0) === 1);
  assert.equal(gained.length, 1);
  assert.equal(gained[0][0], first.draws[0].skillId);
  assert.equal(first.profile.inventory.colorPrism >= 2, true);
  assert.equal(first.profile.inventory.areaMicroBloom >= 3, true);
  assert.equal(Object.values(first.profile.inventory).reduce((sum, count) => sum + count, 0), 6);
});

test("server creation verifies both inventories against the submitted loadouts", () => {
  const api = loadApi();
  assert.doesNotThrow(() => api.create({ matchId: "owned", loadouts, profiles: profiles(), seed: 3 }));
  const missing = profiles();
  missing.A.inventory.colorPrism = 0;
  assert.throws(() => api.create({ matchId: "missing", loadouts, profiles: missing, seed: 3 }), /INSUFFICIENT_INVENTORY/);
});

test("public and per-seat projections preserve the private boundary", () => {
  const created = loadApi().create({ matchId: "online-match-2", loadouts, seed: 7, firstSeat: "A" });
  assert.equal(Object.hasOwn(created.publicState, "hands"), false);
  assert.equal(Object.hasOwn(created.publicState, "basicPalettes"), false);
  assert.equal(created.privateA.seat, "A");
  assert.equal(created.privateB.seat, "B");
  assert.notDeepEqual(created.privateA, created.privateB);
  assert.equal(JSON.stringify(created.privateA).includes(JSON.stringify(created.state.basicPalettes.B)), false);
  assert.equal(JSON.stringify(created.privateB).includes(JSON.stringify(created.state.basicPalettes.A)), false);
});

test("the bundle validates, applies, snapshots, and projects one authoritative action", () => {
  const api = loadApi();
  const created = api.create({ matchId: "online-match-3", loadouts, seed: 99, firstSeat: "A" });
  const applied = api.apply({
    state: created.state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { id: "action-1", type: "SURRENDER", payload: {} },
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.state.version, 1);
  assert.equal(applied.finished, true);
  assert.equal(applied.winnerSeat, "B");
  assert.equal(applied.terminalReason, "SURRENDER");
  assert.deepEqual(applied.rngSnapshot, created.rngSnapshot);
  assert.equal(Object.hasOwn(applied, "candidates"), false);
});

test("alpha.4 accepted palette miss advances authority but online progression consumes no card", () => {
  const api = loadApi();
  const missLoadout = JSON.parse(JSON.stringify(loadouts));
  missLoadout.A.disrupt = ["disruptPaletteChoice", "disruptChoiceOne"];
  const missProfiles = Object.fromEntries(["A", "B"].map((seat) => [seat, save.createProfile({
    name: `Player ${seat}`,
    inventory: Object.fromEntries(Object.values(missLoadout[seat]).flat().map((id) => [id, 2])),
  })]));
  const created = api.create({ matchId: "online-accepted-miss", loadouts: missLoadout, profiles: missProfiles, seed: 100, firstSeat: "A" });
  const state = created.state;
  state.phase = "WORK";
  state.basicPalettes.B = ["red", "red"];
  state.bonusColors.B = "red";
  const applied = api.apply({
    state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color: "red" } },
  });
  assert.deepEqual([applied.ok, applied.noOp, applied.cardConsumed, applied.state.version], [true, true, false, 1]);
  assert.equal(applied.state.hands.A.disruptPaletteChoice, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(applied.state.skillCategoryWindow)), { actor: "A", categories: ["disrupt"] });
  const progression = api.applyProfiles({
    profiles: missProfiles,
    beforeState: state,
    nextState: applied.state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color: "red" } },
    finishedAt: "2026-09-07T00:00:00.000Z",
    cardConsumed: applied.cardConsumed,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(progression.changed)), { A: false, B: false });
  assert.deepEqual(JSON.parse(JSON.stringify(progression.profiles.A)), missProfiles.A);
});

test("generated server bundle keeps a blocked response active until explicit surrender", () => {
  const api = loadApi();
  const created = api.create({ matchId: "online-no-color", loadouts, seed: 101, firstSeat: "A" });
  const state = created.state;
  const microFor = (macro) => {
    const col = macro % 12;
    const row = Math.floor(macro / 12);
    return Array.from({ length: 16 }, (_, index) => (row * 4 + Math.floor(index / 4)) * 48 + col * 4 + (index % 4));
  };
  const usable = [...state.basicPalettes.B, state.bonusColors.B];
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: { id: "R1", micro: microFor(13), sourceMacros: [13], controllers: ["A"], color: usable[0], isPending: false },
    R2: { id: "R2", micro: microFor(15), sourceMacros: [15], controllers: ["B"], color: usable[1], isPending: false },
    R3: { id: "R3", micro: [3 * 48 + 8], sourceMacros: [], controllers: ["A"], color: usable[2], isPending: false },
  };
  const applied = api.apply({
    state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } },
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.finished, false);
  assert.deepEqual([applied.state.status, applied.state.active, applied.state.phase, applied.winnerSeat, applied.terminalReason, applied.state.version], ["ACTIVE", "B", "COLOR", null, null, 1]);
  const retired = api.apply({
    state: applied.state,
    rngSnapshot: applied.rngSnapshot,
    actor: "B",
    expectedVersion: 1,
    action: { type: "DECLARE_NO_COLOR", payload: {} },
  });
  assert.deepEqual([retired.ok, retired.code], [false, "NO_COLOR_DECLARATION_RETIRED"]);
  const surrendered = api.apply({
    state: applied.state,
    rngSnapshot: applied.rngSnapshot,
    actor: "B",
    expectedVersion: 1,
    action: { type: "SURRENDER", payload: {} },
  });
  assert.equal(surrendered.ok, true);
  assert.equal(surrendered.finished, true);
  assert.deepEqual([surrendered.winnerSeat, surrendered.terminalReason, surrendered.state.version], ["A", "SURRENDER", 2]);

  const legacyState = JSON.parse(JSON.stringify(state));
  legacyState.engineVersion = "5.0.0-alpha.1";
  delete legacyState.skillCategoryWindow;
  const legacy = api.apply({
    state: legacyState,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } },
  });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.finished, true);
  assert.deepEqual([legacy.winnerSeat, legacy.terminalReason, legacy.state.version], ["A", "NO_LEGAL_COLOR", 1]);
});

test("invalid or duplicated six-card loadouts fail before match creation", () => {
  const api = loadApi();
  const duplicate = JSON.parse(JSON.stringify(loadouts));
  duplicate.A.color[1] = duplicate.A.color[0];
  assert.throws(() => api.create({ matchId: "bad", loadouts: duplicate, seed: 1 }), /DUPLICATE_LOADOUT_SKILL/);
  const unavailable = JSON.parse(JSON.stringify(loadouts));
  unavailable.B.area[0] = "legalRecolor";
  assert.throws(() => api.create({ matchId: "bad", loadouts: unavailable, seed: 1 }), /SKILL_NOT_AVAILABLE/);
});

test("terminal profile settlement is derived from the accepted authoritative state", () => {
  const api = loadApi();
  const created = api.create({ matchId: "settled-online", loadouts, profiles: profiles(), seed: 101, firstSeat: "A" });
  const applied = api.apply({
    state: created.state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { id: "surrender-online", type: "SURRENDER", payload: {} },
  });
  const settled = api.applyProfiles({
    profiles: profiles(),
    beforeState: created.state,
    nextState: applied.state,
    actor: "A",
    action: { type: "SURRENDER" },
    finishedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(settled.changed.A, true);
  assert.equal(settled.changed.B, true);
  assert.equal(settled.profiles.A.stats.losses, 1);
  assert.equal(settled.profiles.B.stats.wins, 1);
  assert.equal(settled.profiles.A.matchHistory[0].matchId, "settled-online");
  assert.equal(settled.profiles.B.matchHistory[0].terminalReason, "SURRENDER");
  assert.equal(settled.profiles.A.gachaTickets["1"], 1);
  assert.equal(settled.profiles.B.gachaTickets["1"], 1);
});

test("CPU settlement records only the human CPU history and never rewards the synthetic profile", () => {
  const api = loadApi();
  const cpu = api.createCpuProfile("yuzu");
  const human = profiles().A;
  const created = api.create({ matchId: "cpu-settled-online", loadouts: { A: loadouts.A, B: cpu.loadout }, profiles: { A: human, B: cpu.profile }, seed: 2026, firstSeat: "A" });
  const applied = api.apply({ state: created.state, rngSnapshot: created.rngSnapshot, actor: "A", action: { id: "cpu-surrender", type: "SURRENDER", payload: {} }, expectedVersion: 0 });
  const settled = api.applyCpuProfiles({
    profiles: { A: human, B: cpu.profile }, beforeState: created.state, nextState: applied.state,
    actor: "A", action: { type: "SURRENDER" }, finishedAt: "2026-09-03T00:00:00.000Z", characterId: "yuzu",
  });
  assert.equal(settled.changed.A, true);
  assert.equal(settled.changed.B, false);
  assert.equal(settled.profiles.A.stats.losses, 0);
  assert.equal(settled.profiles.A.cpuStats.losses, 1);
  assert.equal(settled.profiles.A.cpuCharacterStats.yuzu.matches, 1);
  assert.equal(settled.profiles.A.gachaTickets["1"], 1);
  assert.deepEqual(settled.profiles.B, cpu.profile);
});

test("CPU settlement records a human win exactly once in aggregate and character stats", () => {
  const api = loadApi();
  const cpu = api.createCpuProfile("yuzu");
  const human = profiles().A;
  const created = api.create({ matchId: "cpu-human-win", loadouts: { A: loadouts.A, B: cpu.loadout }, profiles: { A: human, B: cpu.profile }, seed: 2027, firstSeat: "B" });
  const applied = api.apply({ state: created.state, rngSnapshot: created.rngSnapshot, actor: "B", action: { id: "cpu-terminal", type: "SURRENDER", payload: {} }, expectedVersion: 0 });
  const input = {
    profiles: { A: human, B: cpu.profile }, beforeState: created.state, nextState: applied.state,
    actor: "B", action: { type: "SURRENDER" }, finishedAt: "2026-09-05T00:00:00.000Z", characterId: "yuzu",
  };
  const settled = api.applyCpuProfiles(input);
  assert.equal(applied.winnerSeat, "A");
  assert.equal(settled.profiles.A.stats.wins, 0);
  assert.equal(settled.profiles.A.cpuStats.wins, 1);
  assert.equal(settled.profiles.A.cpuStats.losses, 0);
  assert.equal(JSON.stringify(settled.profiles.A.cpuCharacterStats.yuzu), JSON.stringify({ matches: 1, wins: 1, losses: 0, firstWinAt: input.finishedAt }));
  assert.equal(settled.profiles.A.matchHistory.filter((entry) => entry.matchId === "cpu-human-win").length, 1);
  assert.equal(settled.profiles.A.gachaTickets["1"], 1);
  assert.throws(() => api.applyCpuProfiles({ ...input, profiles: settled.profiles }), /MATCH_ALREADY_RECORDED/);
});
