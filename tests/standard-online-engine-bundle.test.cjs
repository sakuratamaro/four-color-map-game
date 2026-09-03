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
    "standard-skill-registry.js",
    "standard-skill-handlers.js",
    "standard-skill-dispatcher.js",
    "standard-match.js",
  ]) assert.match(builder, new RegExp(id.replaceAll(".", "\\.")));
  assert.doesNotMatch(builder, /standard-local-session|standard-save|standard-v5\/app/i);
  assert.doesNotMatch(bundle, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|postgres(?:ql)?:\/\//i);
});

test("bundle exposes a deterministic server-only Standard engine", () => {
  const api = loadApi();
  assert.equal(api.ENGINE_VERSION, "5.0.0-alpha.1");
  assert.equal(typeof api.create, "function");
  assert.equal(typeof api.apply, "function");
  assert.equal(typeof api.applyProfiles, "function");
  assert.equal(typeof api.drawGacha, "function");
  assert.equal(typeof api.quoteCardSale, "function");
  assert.equal(typeof api.sellCards, "function");
  assert.equal(typeof api.validateProfile, "function");
  assert.equal(typeof api.validateSeatLoadout, "function");
  const first = api.create({ matchId: "online-match-1", loadouts, seed: 0x12345678, firstSeat: "A" });
  const second = api.create({ matchId: "online-match-1", loadouts, seed: 0x12345678, firstSeat: "A" });
  assert.deepEqual(first, second);
  assert.equal(first.state.version, 0);
  assert.equal(first.state.active, "A");
  assert.equal(Object.keys(first.rngSnapshot).length, api.REQUIRED_RNG_STREAMS.length);
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

test("one gacha draw deterministically consumes one ticket and adds exactly one card", () => {
  const api = loadApi();
  const before = save.createProfile({ name: "Gacha", inventory: {}, gachaTickets: { "1": 2 } });
  const first = api.drawGacha({ profile: before, ticketLevel: 1, count: 1, seed: 0x12345678 });
  const second = api.drawGacha({ profile: before, ticketLevel: 1, count: 1, seed: 0x12345678 });
  assert.deepEqual(first, second);
  assert.equal(before.gachaTickets["1"], 2);
  assert.equal(first.profile.gachaTickets["1"], 1);
  assert.equal(first.draws.length, 1);
  const gained = Object.entries(first.profile.inventory).filter(([id, count]) => count - (before.inventory[id] || 0) === 1);
  assert.equal(gained.length, 1);
  assert.equal(gained[0][0], first.draws[0].skillId);
  assert.equal(Object.values(first.profile.inventory).reduce((sum, count) => sum + count, 0), 1);
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
