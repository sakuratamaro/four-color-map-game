"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const save = require("../standard/standard-save.js");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "202609050003_standard_debug_room_access.sql"), "utf8");
const edgeSource = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");
const bundle = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "standard-engine.bundle.js"), "utf8");

const unownedLoadouts = {
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

function loadEngine() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(bundle, sandbox, { filename: "standard-engine.bundle.js" });
  return sandbox.FourColorStandardServerEngine;
}

function edgeDebugAllowed() {
  const setup = edgeSource.slice(edgeSource.indexOf('if (operation === "setup")'), edgeSource.indexOf('stage = "load-room"'));
  const match = setup.match(/if \((setupRoom\.access_mode !== "private_code" \|\| setupRoom\.opponent_kind === "cpu")\)/);
  assert.ok(match, "the test must execute the current Edge debug room-policy expression");
  return Function("setupRoom", `"use strict"; return !(${match[1]});`);
}

function edgeDebugAgreement() {
  const start = edgeSource.indexOf("function debugModeForRoom");
  const end = edgeSource.indexOf("async function deterministicCpuIdentity", start);
  assert.ok(start >= 0 && end > start, "debug agreement helper must remain present");
  const runnable = edgeSource.slice(start, end)
    .replace("function debugModeForRoom(room: JsonObject): boolean | null", "function debugModeForRoom(room)")
    .replaceAll(" as JsonObject | null", "");
  const sandbox = { DEBUG_SETUP_KEY: "__debugUnlimitedSkills" };
  vm.runInNewContext(`${runnable}; this.result = debugModeForRoom;`, sandbox);
  return sandbox.result;
}

test("load_room_v2 appends access_mode without weakening its service-only membership boundary", () => {
  assert.match(migration, /^\s*--[^]*?\bbegin;\s/im);
  assert.match(migration, /\bcommit;\s*$/i);
  assert.match(migration, /drop function public\.fcg_standard_server_load_room_v2\(uuid, uuid\);/i);
  assert.doesNotMatch(migration, /\bcascade\b/i);
  assert.match(migration, /create function public\.fcg_standard_server_load_room_v2\(p_room_id uuid, p_actor_id uuid\)/i);

  const returns = migration.slice(migration.indexOf("returns table"), migration.indexOf(")\nlanguage sql"));
  assert.match(returns, /cpu_user_id uuid,\s*access_mode text\s*$/i);
  assert.match(migration, /room\.cpu_user_id,\s*room\.access_mode\s+from public\.fcg_rooms room/i);
  assert.match(migration, /join public\.fcg_room_members actor on actor\.room_id = room\.id and actor\.user_id = p_actor_id/i);
  assert.match(migration, /where room\.id = p_room_id and room\.game_mode = 'standard_v5'/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.fcg_standard_server_load_room_v2\(uuid, uuid\)\s+from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.fcg_standard_server_load_room_v2\(uuid, uuid\)\s+to service_role/i);
});

test("the Edge room policy allows only private human debug setup", () => {
  const allowed = edgeDebugAllowed();
  assert.equal(allowed({ access_mode: "private_code", opponent_kind: "human" }), true);
  assert.equal(allowed({ access_mode: "public_queue", opponent_kind: "human" }), false);
  assert.equal(allowed({ access_mode: "cpu", opponent_kind: "cpu" }), false);
  assert.equal(allowed({ access_mode: "private_code", opponent_kind: "cpu" }), false);

  const setup = edgeSource.slice(edgeSource.indexOf('if (operation === "setup")'), edgeSource.indexOf('stage = "load-room"'));
  assert.match(setup, /const setupRoom = await load\(\)/);
  assert.match(edgeSource, /service\.rpc\("fcg_standard_server_load_room_v2", \{ p_room_id: roomId, p_actor_id: actorId \}\)/);
  assert.doesNotMatch(setup, /body\.(?:accessMode|access_mode|opponentKind|opponent_kind)/);
});

test("both debug markers agree while one-sided debug setup is rejected at initialization", () => {
  const agreement = edgeDebugAgreement();
  assert.equal(agreement({ setup_a: { __debugUnlimitedSkills: true }, setup_b: { __debugUnlimitedSkills: true } }), true);
  assert.equal(agreement({ setup_a: {}, setup_b: {} }), false);
  assert.equal(agreement({ setup_a: { __debugUnlimitedSkills: true }, setup_b: {} }), null);
  assert.match(edgeSource, /if \(debugMode === null\) return json\(409, \{ error: \{ code: "DEBUG_MODE_MISMATCH"/);
});

test("private debug accepts both unowned six-card loadouts but normal setup still rejects them", () => {
  const api = loadEngine();
  const profiles = Object.fromEntries(["A", "B"].map((seat) => [seat, save.createProfile({ name: `${seat} profile`, inventory: {} })]));
  assert.equal(edgeDebugAllowed()({ access_mode: "private_code", opponent_kind: "human" }), true);

  const created = api.create({
    matchId: "private-debug-access-contract",
    loadouts: unownedLoadouts,
    profiles,
    seed: 77,
    firstSeat: "A",
    debugMode: true,
  });
  assert.equal(created.publicState.debugUnlimitedSkills, true);
  assert.throws(() => api.create({
    matchId: "normal-access-contract",
    loadouts: unownedLoadouts,
    profiles,
    seed: 77,
    firstSeat: "A",
  }), /INSUFFICIENT_INVENTORY/);
});

test("debug actions replenish skills and leave both profiles byte-for-byte unchanged", () => {
  const api = loadEngine();
  const profiles = Object.fromEntries(["A", "B"].map((seat) => [seat, save.createProfile({ name: `${seat} profile`, inventory: {} })]));
  const beforeProfiles = JSON.stringify(profiles);
  const created = api.create({ matchId: "debug-no-progression", loadouts: unownedLoadouts, profiles, seed: 77, firstSeat: "A", debugMode: true });
  const applied = api.apply({
    state: created.state,
    rngSnapshot: created.rngSnapshot,
    actor: "A",
    expectedVersion: 0,
    action: { id: "debug-access-skill", type: "USE_SKILL", payload: { skill: "areaDiePlus" } },
    debugMode: true,
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.privateA.hand.areaDiePlus, 1);

  const progression = api.applyProfiles({
    profiles,
    beforeState: created.state,
    nextState: applied.state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaDiePlus" } },
    finishedAt: "2026-09-05T00:00:00.000Z",
    debugMode: true,
  });
  assert.equal(progression.changed.A, false);
  assert.equal(progression.changed.B, false);
  assert.equal(JSON.stringify(progression.profiles), beforeProfiles);
});
