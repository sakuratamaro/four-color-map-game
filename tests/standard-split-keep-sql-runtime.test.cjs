"use strict";
// Real worker + generated engine + isolated PostgreSQL/WASM; no production URL.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs"), path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createProgressionRuntime, api } = require("./helpers/cpu-progression-runtime.cjs");
const { plain, root } = require("./helpers/public-skill-fixture.cjs");
const ID = "colorRegionSplitKeep";
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202609260001_standard_split_keep_compat.sql"), "utf8");
let rt;
test.before(async () => { rt = await createProgressionRuntime(); await rt.db.exec(migration); });
test.after(async () => { if (rt) await rt.close(); });
function ok(result) { assert.equal(result.status, 200, JSON.stringify(result)); return result.body; }
function micro(macro) { return Array.from({ length: 16 }, (_, i) => (Math.floor(macro / 12) * 4 + Math.floor(i / 4)) * 48 + macro % 12 * 4 + i % 4); }

async function start(withCard = true) {
  const id = await rt.player(), w = rt.worker(id);
  if (withCard) {
    const profile = (await rt.profile(id)).profile_state;
    profile.inventory[ID] = 2;
    await rt.db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1", [id, JSON.stringify(profile)]);
  }
  const loadout = { color: [withCard ? ID : "colorRandomBorrow", "colorChoiceBorrow"], area: ["areaMicroBloom", "areaDiePlus"], disrupt: ["disruptRandomOne", "disruptChoiceOne"] };
  const roomId = ok(await w.post({ operation: "cpu-start", characterId: "ren", actionId: randomUUID(), confirmed: true })).roomId;
  ok(await w.post({ operation: "setup", roomId, setupActionId: randomUUID(), expectedSetupRevision: 0, loadout }));
  ok(await w.post({ operation: "initialize", roomId }));
  return { id, w, roomId };
}

test("UDL011 SQL accepts only new-card matches as alpha.6; legacy default and trigger ACL remain", async () => {
  const ordinary = await start(false), added = await start();
  assert.equal((await rt.authority(ordinary.roomId)).state.engineVersion, "5.0.0-alpha.4");
  const s = (await rt.authority(added.roomId)).state;
  assert.equal(s.engineVersion, "5.0.0-alpha.6");
  assert.deepEqual(s.techniqueRule, { id: "PVP_TECHNIQUES_DISABLED_V1", playerSeat: null });
  assert.deepEqual(s.techniques, { A: null, B: null });
  assert.equal(s.hands.A[ID], 1);
  assert.equal(s.hands.B[ID], undefined, "no CPU grant or mirrored hand");
  for (const role of ["anon", "authenticated", "service_role"]) {
    const result = await rt.db.query("select has_function_privilege($1,'fcg_private.fcg_standard_guard_technique_snapshot()','EXECUTE') permitted", [role]);
    assert.equal(result.rows[0].permitted, false);
  }
});

test("UDL011 SQL/worker card replay consumes once and keeps the same actor through both paints", async () => {
  const { id, w, roomId } = await start();
  const a = plain(await rt.authority(roomId)), s = a.state;
  // Deterministic board fixture only; all tested transitions below use the real worker.
  Object.assign(s, { active: "A", phase: "COLOR", pending: "R1", reserved: null,
    regions: { R1: { id: "R1", micro: [13, 14, 15].flatMap(micro), sourceMacros: [13, 14, 15], controllers: ["B"], color: null, isPending: true } },
    skillCategoryWindow: { actor: "A", categories: [] } });
  s.basicPalettes.A = ["red", "blue"]; s.bonusColors.A = "green";
  const p = api.project(s);
  await rt.db.query("update fcg_private.authoritative_matches set state=$2::jsonb where room_id=$1", [roomId, JSON.stringify(a)]);
  await rt.db.query("update public.fcg_rooms set public_state=$2::jsonb where id=$1", [roomId, JSON.stringify(p.publicState)]);
  for (const [seat, value] of [["A", p.privateA], ["B", p.privateB]]) await rt.db.query("update public.fcg_player_views set private_state=$3::jsonb where room_id=$1 and seat=$2", [roomId, seat, JSON.stringify(value)]);
  const split = { operation: "action", roomId, action: { id: randomUUID(), expectedVersion: s.version, type: "USE_SKILL", payload: { skill: ID, regionId: "R1", sourceMacros: [13] } } };
  ok(await w.post(split));
  const after = await rt.snapshot(id, roomId);
  assert.equal(after.profile.profile_state.inventory[ID], 1);
  assert.equal(after.authority.state.retainedSplit.stage, "FIRST");
  ok(await w.post(split));
  assert.deepEqual(await rt.snapshot(id, roomId), after);
  const resumedWorker = rt.worker(id);
  for (const color of ["red", "blue"]) {
    const current = await rt.authority(roomId);
    ok(await resumedWorker.post({ operation: "action", roomId, action: { id: randomUUID(), expectedVersion: current.state.version, type: "COLOR_REGION", payload: { color } } }));
    const painted = await rt.authority(roomId);
    assert.equal(painted.state.active, "A");
    assert.equal(painted.state.turn, s.turn);
    assert.deepEqual(painted.state.skillCategoryWindow.categories, ["color"]);
    assert.equal(painted.state.phase, color === "red" ? "COLOR" : "WORK");
  }
  const finished = await rt.authority(roomId);
  assert.equal(finished.state.retainedSplit, undefined);
  assert.equal((await rt.profile(id)).profile_state.inventory[ID], 1);
});

test("UDL011 SQL rejects missing or forged alpha.6 technique ownership and later snapshot replacement", async () => {
  const { roomId } = await start();
  const a = plain(await rt.authority(roomId));
  for (const mode of ["missing", "forged"]) {
    const fake = structuredClone(a);
    if (mode === "missing") { delete fake.state.techniqueRule; delete fake.state.techniques; }
    else {
      fake.state.techniqueRule = { id: "CPU_LEARNED_V1", playerSeat: "A" };
      fake.state.techniques = { A: { id: "techUnsealOne", definitionVersion: "unseal-v1", source: "LEARNED", usesRemaining: 1 }, B: null };
    }
    await rt.db.exec("begin");
    await rt.db.query("delete from fcg_private.authoritative_matches where room_id=$1", [roomId]);
    await assert.rejects(() => rt.db.query("insert into fcg_private.authoritative_matches(room_id,version,state,game_mode) values($1,$2,$3::jsonb,'standard_v5')", [roomId, a.state.version, JSON.stringify(fake)]), /INVALID_TECHNIQUE_SNAPSHOT/);
    await rt.db.exec("rollback");
  }
  const fake = structuredClone(a); fake.state.engineVersion = "5.0.0-alpha.5";
  await assert.rejects(() => rt.db.query("update fcg_private.authoritative_matches set state=$2::jsonb where room_id=$1", [roomId, JSON.stringify(fake)]), /IMMUTABLE_TECHNIQUE_SNAPSHOT/);
  assert.deepEqual(await rt.authority(roomId), a);
});
