"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, webcrypto } = require("node:crypto");
const { stripTypeScriptTypes } = require("node:module");
const vm = require("node:vm");
const test = require("node:test");
const { createCpuSqlDatabase } = require("./helpers/cpu-sql-runtime.cjs");
const save = require("../standard/standard-save.js");
const migrationPath = path.join(__dirname, "../supabase/migrations/202609140001_standard_learned_technique_profiles.sql");
const equipSql = "select * from public.fcg_standard_server_equip_technique($1::uuid,$2::bigint,$3::uuid,$4::text)";
const tables = ["standard_cpu_trial_clears", "standard_learned_techniques", "standard_technique_equipment", "standard_technique_equip_receipts"];
let db, oldUser, oldProfile;

async function asRole(role, fn) {
  assert.ok(["service_role", "authenticated", "anon"].includes(role));
  await db.exec("set role " + role);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
async function player(extra = {}) {
  const id = randomUUID();
  const profile = { ...save.createProfile({ name: "Technique SQL fixture" }), ...extra };
  await db.query("insert into auth.users(id) values ($1)", [id]);
  await db.query("insert into public.fcg_standard_profiles(user_id,revision,display_name,profile_state) values($1,1,'SQL fixture',$2::jsonb)", [id, JSON.stringify(profile)]);
  return id;
}
async function profile(id) {
  return (await db.query("select revision,profile_state,appearance from public.fcg_standard_profiles where user_id=$1", [id])).rows[0];
}
async function room(id, status = "finished", expires = "1 hour") {
  const result = await db.query("insert into public.fcg_rooms(code_hash,host_user_id,game_mode,status,expires_at) values($1,$2,'standard_v5',$3,now()+$4::interval) returning id,version", [randomUUID(), id, status, expires]);
  const value = result.rows[0];
  await db.query("insert into public.fcg_room_members(room_id,user_id,seat,display_name) values($1,$2,'A','SQL fixture')", [value.id, id]);
  return value;
}
// Privileged fixture inserts are NOT an implemented WIN settlement or grant RPC.
async function clearFixture(id, version = 1) {
  const value = await room(id);
  await db.query("insert into fcg_private.standard_cpu_trial_clears(user_id,trial_id,trial_version,winning_room_id) values($1,'ren-unseal',$2,$3)", [id, version, value.id]);
  return value;
}
async function learnedFixture(id, version = 1) {
  await clearFixture(id, version);
  await db.query("insert into fcg_private.standard_learned_techniques(user_id,technique_id,source_trial_id,source_trial_version) values($1,'techUnsealOne','ren-unseal',$2)", [id, version]);
  return id;
}
const equip = (id, revision, actionId = randomUUID(), techniqueId = "techUnsealOne") =>
  asRole("service_role", async () => (await db.query(equipSql, [id, revision, actionId, techniqueId])).rows[0]);
async function snapshot(id) {
  const result = { profile: await profile(id) };
  for (const name of tables) result[name] = (await db.query("select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) value from fcg_private." + name + " t where user_id=$1", [id])).rows[0].value;
  return result;
}
test.before(async () => {
  const state = await createCpuSqlDatabase();
  db = state.db;
  await db.exec(state.migration);
  oldUser = await player(); oldProfile = await profile(oldUser);
  await db.exec(fs.readFileSync(migrationPath, "utf8"));
});
test.after(async () => { if (db) await db.close(); });

test("migration preserves existing profile bytes and ordinary server writes without new empty fields", async () => {
  assert.deepEqual(await profile(oldUser), oldProfile);
  const incoming = { ...oldProfile.profile_state, coins: 19 };
  await db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1", [oldUser, JSON.stringify(incoming)]);
  assert.deepEqual((await profile(oldUser)).profile_state, incoming);
});

test("old initial/full profile JSON cannot invent ownership, equipment or trial clears", async () => {
  const forged = { learnedTechniques: ["techUnsealOne"], equippedTechniqueId: "techUnsealOne", cpuTrialProgress: { "ren-unseal": { clearedVersions: [1] } } };
  const id = await player(forged);
  const current = await profile(id);
  for (const key of Object.keys(forged)) assert.equal(Object.hasOwn(current.profile_state, key), false, key);
  const before = await snapshot(id);
  await assert.rejects(() => equip(id, current.revision), e => e.code === "42501" && /TECHNIQUE_NOT_LEARNED/.test(e.message));
  assert.deepEqual(await snapshot(id), before);
});

test("private stores and projection have no browser or generic service write/grant access", async () => {
  for (const name of tables) {
    const info = (await db.query("select c.relrowsecurity, pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fcg_private' and c.relname=$1", [name])).rows[0];
    assert.equal(info.relrowsecurity, true);
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        assert.equal((await db.query("select has_table_privilege($1,$2,$3) ok", [role, "fcg_private." + name, privilege])).rows[0].ok, false);
      }
    }
  }
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(() => asRole(role, () => db.query(equipSql, [oldUser, 1, randomUUID(), null])), e => e.code === "42501");
    await assert.rejects(() => asRole(role, () => db.query("select fcg_private.fcg_standard_technique_profile($1,'{}'::jsonb)", [oldUser])), e => e.code === "42501");
  }
});

test("server ownership is unique across trial versions and versioned clears remain separate", async () => {
  const id = await learnedFixture(await player());
  await clearFixture(id, 2);
  const before = await snapshot(id);
  await assert.rejects(() => db.query("insert into fcg_private.standard_learned_techniques(user_id,technique_id,source_trial_id,source_trial_version) values($1,'techUnsealOne','ren-unseal',2)", [id]), e => e.code === "23505");
  assert.deepEqual(await snapshot(id), before);
  assert.deepEqual(before.profile.profile_state.learnedTechniques, ["techUnsealOne"]);
  assert.deepEqual(before.profile.profile_state.cpuTrialProgress["ren-unseal"].clearedVersions, [1, 2]);
  assert.equal(before.profile.profile_state.equippedTechniqueId, null);
  assert.equal(before.standard_learned_techniques.length, 1);
  assert.equal(before.standard_cpu_trial_clears.length, 2);
});

test("ownership requires its persisted source clear and does not use bounded match history", async () => {
  const id = await player();
  await assert.rejects(() => db.query("insert into fcg_private.standard_learned_techniques(user_id,technique_id,source_trial_id,source_trial_version) values($1,'techUnsealOne','ren-unseal',1)", [id]), e => e.code === "23503");
  await learnedFixture(id);
  await db.query("update public.fcg_standard_profiles set profile_state=jsonb_set(profile_state,'{matchHistory}','[]') where user_id=$1", [id]);
  assert.deepEqual((await profile(id)).profile_state.learnedTechniques, ["techUnsealOne"]);
});

test("equip is server-derived, separate from inventory, and increments profile revision once", async () => {
  const id = await learnedFixture(await player());
  const before = await profile(id), actionId = randomUUID();
  const result = await equip(id, before.revision, actionId);
  assert.equal(result.duplicate, false);
  assert.equal(Number(result.revision), Number(before.revision) + 1);
  assert.equal(result.profile_state.equippedTechniqueId, "techUnsealOne");
  assert.deepEqual(result.profile_state.inventory, before.profile_state.inventory);
  assert.deepEqual(result.profile_state.learnedTechniques, ["techUnsealOne"]);
  assert.equal(result.receipt.actionId, actionId);
  assert.equal(Number(result.receipt.appliedRevision), Number(result.revision));
});

test("lost ACK replays original receipt with latest profile and never restores an old equip", async () => {
  const id = await learnedFixture(await player()), actionId = randomUUID();
  const first = await equip(id, (await profile(id)).revision, actionId);
  const cleared = await equip(id, first.revision, randomUUID(), null);
  await room(id, "playing");
  const before = await snapshot(id);
  const replay = await equip(id, 0, actionId);
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.receipt, first.receipt);
  assert.equal(replay.profile_state.equippedTechniqueId, null);
  assert.equal(replay.revision, cleared.revision);
  assert.deepEqual(await snapshot(id), before);
  await assert.rejects(() => equip(id, 0, actionId, null), e => e.code === "23505");
  assert.deepEqual(await snapshot(id), before);
});

test("stale revisions and invalid identities reject without equipment or success receipt", async () => {
  const id = await learnedFixture(await player()), before = await snapshot(id);
  for (const revision of [null, -1]) await assert.rejects(() => equip(id, revision), e => e.code === "22023");
  await assert.rejects(() => equip(id, 0), e => e.code === "PT409");
  await assert.rejects(() => equip(id, before.profile.revision, null), e => e.code === "22023");
  await assert.rejects(() => equip(id, before.profile.revision, randomUUID(), "colorPrism"), e => e.code === "22023");
  await assert.rejects(() => equip(null, 0), e => e.code === "22023");
  await assert.rejects(() => equip(randomUUID(), 0), e => e.code === "P0002" && /STANDARD_PROFILE_REQUIRED/.test(e.message));
  assert.deepEqual(await snapshot(id), before);
});

test("serial competing edits cannot both commit from the same revision", async () => {
  const id = await learnedFixture(await player()), before = await profile(id);
  await equip(id, before.revision);
  const winner = await snapshot(id);
  await assert.rejects(() => equip(id, before.revision, randomUUID(), null), e => e.code === "PT409");
  assert.deepEqual(await snapshot(id), winner);
  // PGlite uses one connection: this is real revision enforcement, not a claim of multi-session lock proof.
});

for (const status of ["waiting", "ready", "playing"]) {
  test("equip and unequip reject while a " + status + " room is active", async () => {
    const id = await learnedFixture(await player());
    await equip(id, (await profile(id)).revision);
    await room(id, status);
    const before = await snapshot(id);
    for (const target of ["techUnsealOne", null]) await assert.rejects(() => equip(id, before.profile.revision, randomUUID(), target), e => e.code === "55000" && /TECHNIQUE_EQUIP_MATCH_LOCKED/.test(e.message));
    assert.deepEqual(await snapshot(id), before);
  });
}

test("pending public search and rematch vote lock equipment; expired or stale intents do not", async () => {
  const id = await learnedFixture(await player());
  await db.query("insert into fcg_private.standard_matchmaking_tickets(ticket_id,user_id,display_name,profile_revision,state,expires_at) values($1,$2,'SQL fixture',1,'searching',now()+interval '1 hour')", [randomUUID(), id]);
  const before = await snapshot(id);
  await assert.rejects(() => equip(id, before.profile.revision), e => /TECHNIQUE_EQUIP_MATCH_LOCKED/.test(e.message));
  assert.deepEqual(await snapshot(id), before);
  await db.query("update fcg_private.standard_matchmaking_tickets set expires_at=now()-interval '1 second' where user_id=$1", [id]);
  const pending = await room(id);
  await db.query("insert into fcg_private.standard_rematch_votes(room_id,user_id,room_version,action_id) values($1,$2,$3,$4)", [pending.id, id, pending.version, randomUUID()]);
  await assert.rejects(() => equip(id, before.profile.revision), e => /TECHNIQUE_EQUIP_MATCH_LOCKED/.test(e.message));
  await db.query("update fcg_private.standard_rematch_votes set room_version=room_version+1 where user_id=$1", [id]);
  assert.equal((await equip(id, before.profile.revision)).duplicate, false);
});

test("old full-profile gacha writes preserve canonical ownership, equipment and trial dates", async () => {
  const id = await player(), legacy = (await profile(id)).profile_state;
  await learnedFixture(id);
  await equip(id, (await profile(id)).revision);
  const before = await profile(id), incoming = { ...legacy, coins: 7 };
  const result = await asRole("service_role", () => db.query("select * from public.fcg_standard_server_commit_gacha($1,$2,$3,$4,$5::jsonb,$6::jsonb)", [id, before.revision, randomUUID(), "a".repeat(64), JSON.stringify(incoming), JSON.stringify({ draws: [] })]));
  assert.equal(result.rows[0].duplicate, false);
  const after = await profile(id);
  assert.equal(after.profile_state.coins, 7);
  for (const key of ["learnedTechniques", "equippedTechniqueId", "cpuTrialProgress"]) assert.deepEqual(after.profile_state[key], before.profile_state[key], key);
  assert.deepEqual(after.profile_state.inventory, legacy.inventory);
  assert.deepEqual(after.appearance, before.appearance);
  // A stale service payload explicitly deleting or forging the reserved fields is also canonicalized.
  await db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1", [id, JSON.stringify({ ...incoming, learnedTechniques: [], equippedTechniqueId: null, cpuTrialProgress: {} })]);
  assert.deepEqual((await profile(id)).profile_state, after.profile_state);
});

test("legacy rename, service load and owner RLS all observe the same canonical projection", async () => {
  const id = await learnedFixture(await player());
  const before = await profile(id);
  await asRole("service_role", () => db.query("select * from public.fcg_standard_server_commit_profile($1,$2,'Ren player','{}'::jsonb)", [id, before.revision]));
  const loaded = await asRole("service_role", async () => (await db.query("select * from public.fcg_standard_server_load_profile($1)", [id])).rows[0]);
  assert.deepEqual(loaded.profile_state, before.profile_state);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  const own = await asRole("authenticated", () => db.query("select profile_state from public.fcg_standard_profiles where user_id=$1", [id]));
  assert.deepEqual(own.rows[0].profile_state, loaded.profile_state);
  const other = await asRole("authenticated", () => db.query("select profile_state from public.fcg_standard_profiles where user_id=$1", [oldUser]));
  assert.equal(other.rows.length, 0);
});

test("rollback rolls back both equipment and receipt and does not leave learned projection half-written", async () => {
  const id = await learnedFixture(await player()), before = await snapshot(id);
  await db.exec("begin");
  await equip(id, before.profile.revision);
  await db.exec("rollback");
  assert.deepEqual(await snapshot(id), before);
});

test("a rolled-back privileged award fixture leaves no clear, ownership, profile revision or reward change", async () => {
  const id = await player(), before = await snapshot(id);
  await db.exec("begin");
  await learnedFixture(id);
  assert.deepEqual((await profile(id)).profile_state.learnedTechniques, ["techUnsealOne"]);
  await db.exec("rollback");
  assert.deepEqual(await snapshot(id), before);
  // This demonstrates table/trigger transaction rollback, NOT an implemented winning settlement.
});

test("expired room does not lock equipment and owner snapshot sees its revisioned projection", async () => {
  const id = await learnedFixture(await player()), before = await profile(id);
  const expired = await room(id, "playing", "-1 second");
  const result = await equip(id, before.revision);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  const first = await asRole("authenticated", async () => (await db.query("select public.fcg_standard_room_snapshot_v2($1,$2) value", [expired.id, before.revision])).rows[0].value);
  assert.deepEqual(first.profile.profile_state, result.profile_state);
  const unchanged = await asRole("authenticated", async () => (await db.query("select public.fcg_standard_room_snapshot_v2($1,$2) value", [expired.id, result.revision])).rows[0].value);
  assert.equal(unchanged.profile, null);
});

test("actual rematch RPC records and replays its vote while the new equipment guard preserves that intent", async () => {
  const id = await learnedFixture(await player()), opponent = await player(), finished = await room(id), actionId = randomUUID();
  await db.query("insert into public.fcg_room_members(room_id,user_id,seat,display_name) values($1,$2,'B','Other fixture')", [finished.id, opponent]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  const request = () => asRole("authenticated", async () => (await db.query("select * from public.fcg_standard_request_rematch($1,$2,$3)", [finished.id, finished.version, actionId])).rows[0]);
  const vote = await request();
  assert.equal(vote.ready_to_setup, false); assert.equal(vote.duplicate, false);
  const before = await snapshot(id);
  assert.equal((await request()).duplicate, true);
  await assert.rejects(() => equip(id, before.profile.revision), e => /TECHNIQUE_EQUIP_MATCH_LOCKED/.test(e.message));
  assert.deepEqual(await snapshot(id), before);
});

test("equipment references only its own learned identity and durable progress survives room cleanup", async () => {
  const owner = await learnedFixture(await player()), other = await player();
  await assert.rejects(() => db.query("insert into fcg_private.standard_technique_equipment(user_id,technique_id) values($1,'techUnsealOne')", [other]), e => e.code === "23503");
  const before = await snapshot(owner);
  await db.query("delete from public.fcg_rooms where host_user_id=$1", [owner]);
  assert.deepEqual(await snapshot(owner), before);
});

test("repeat selection is a receipt-only no-op; unequipped legacy profiles keep their exact shape", async () => {
  const id = await player(), before = await profile(id);
  const result = await equip(id, before.revision, randomUUID(), null);
  assert.equal(result.revision, before.revision);
  assert.deepEqual(result.profile_state, before.profile_state);
  await learnedFixture(id);
  const first = await equip(id, (await profile(id)).revision);
  const again = await equip(id, first.revision);
  assert.equal(again.revision, first.revision);
  assert.deepEqual(again.profile_state, first.profile_state);
});

// Execute the actual TypeScript handler against the same real local SQL RPC.
// Only Supabase transport/environment/JWT gateway are fixtures, not verified here.
const edgeSource = fs.readFileSync(path.join(__dirname, "../supabase/functions/standard-game-action/index.ts"), "utf8");
const edgeRunnable = stripTypeScriptTypes(edgeSource.replace(/^import .*;\r?\n/gm, ""));
function worker(activation = "ren-unseal-v1") {
  let handler;
  const calls = [], errors = [];
  const sandbox = {
    console: { error: (...args) => errors.push(args) }, Request, Response, Headers, TextEncoder, TextDecoder, atob, crypto: webcrypto,
    Deno: { env: { get: name => ({ SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "isolated-not-a-credential", FCG_CPU_PROGRESSION_PILOT: activation })[name] }, serve: fn => { handler = fn; } },
    createClient: () => ({ rpc: async (name, args) => {
      calls.push({ name, args: JSON.parse(JSON.stringify(args)) });
      assert.equal(name, "fcg_standard_server_equip_technique");
      try {
        return { data: (await asRole("service_role", () => db.query(equipSql, [args.p_user_id, args.p_expected_revision, args.p_action_id, args.p_technique_id]))).rows };
      } catch (error) { return { error: { code: error.code, message: error.message } }; }
    } }),
  };
  vm.runInNewContext(edgeRunnable, sandbox, { filename: "standard-game-action.ts" });
  return { calls, errors, post: async (id, body, authorization) => {
    const token = "fixture." + Buffer.from(JSON.stringify({ sub: id, role: "authenticated" })).toString("base64url") + ".fixture";
    const response = await handler(new Request("https://fixture.invalid/functions/v1/standard-game-action", {
      method: "POST", headers: { Authorization: authorization === undefined ? "Bearer " + token : authorization, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  } };
}
const body = revision => ({ operation: "technique-equip", actionId: randomUUID(), expectedRevision: revision, techniqueId: "techUnsealOne" });

test("actual Edge equipment route is off unless the exact managed pilot version is enabled", async () => {
  const id = await player();
  for (const activation of [null, "", "true", "ren-unseal-v2"]) {
    const w = worker(activation), result = await w.post(id, { ...body(1), FCG_CPU_PROGRESSION_PILOT: "ren-unseal-v1" });
    assert.equal(result.status, 409);
    assert.equal(result.body.error.code, "TECHNIQUE_PILOT_DISABLED");
    assert.equal(w.calls.length, 0);
  }
});

test("actual Edge rejects invalid equipment and caller authority fields before any RPC", async () => {
  const id = await learnedFixture(await player()), before = await snapshot(id), w = worker();
  const invalid = [
    { techniqueId: undefined }, { techniqueId: {} }, { techniqueId: "colorPrism" }, { expectedRevision: -1 },
    { expectedRevision: 1.5 }, { expectedRevision: null }, { actionId: "invalid" }, { actionId: undefined },
    ...["userId", "actorId", "profileState", "learnedTechniques", "source", "usesRemaining", "roomId"].map(key => ({ [key]: "forged" })),
  ];
  for (const change of invalid) {
    const result = await w.post(id, { ...body(before.profile.revision), ...change });
    assert.equal(result.status, 400, JSON.stringify(change));
    assert.equal(result.body.error.code, "INVALID_TECHNIQUE_EQUIP");
  }
  assert.equal(w.calls.length, 0);
  assert.deepEqual(await snapshot(id), before);
});

test("actual Edge and SQL equip/replay use gateway actor, permanent ownership and canonical profile", async () => {
  const id = await learnedFixture(await player()), before = await profile(id), w = worker();
  const request = body(before.revision), result = await w.post(id, request);
  assert.equal(result.status, 200);
  assert.equal(result.body.profileState.equippedTechniqueId, "techUnsealOne");
  assert.equal(w.calls.length, 1);
  assert.deepEqual(w.calls[0].args, { p_user_id: id, p_expected_revision: before.revision, p_action_id: request.actionId, p_technique_id: "techUnsealOne" });
  const unequipped = await w.post(id, { ...body(result.body.revision), techniqueId: null });
  assert.equal(unequipped.status, 200);
  const replay = await w.post(id, request);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  assert.deepEqual(replay.body.receipt, result.body.receipt);
  assert.equal(replay.body.profileState.equippedTechniqueId, null);
  assert.equal(replay.body.revision, unequipped.body.revision);
});

test("actual Edge maps nonownership, missing profile, pending lock and stale revision safely", async () => {
  const id = await player(), w = worker();
  assert.equal((await w.post(id, body(1))).body.error.code, "TECHNIQUE_NOT_LEARNED");
  assert.equal((await w.post(randomUUID(), body(0))).body.error.code, "STANDARD_PROFILE_REQUIRED");
  await learnedFixture(id);
  assert.equal((await w.post(id, body(0))).body.error.code, "STALE_VERSION");
  const ready = await room(id, "ready"), before = await snapshot(id);
  const locked = await w.post(id, body(before.profile.revision));
  assert.equal(locked.status, 409); assert.equal(locked.body.error.code, "TECHNIQUE_EQUIP_MATCH_LOCKED");
  assert.equal(JSON.stringify(locked).includes(ready.id), false);
  assert.deepEqual(await snapshot(id), before);
});

test("actual Edge does not accept equipment requests without a valid gateway identity shape", async () => {
  const id = await player(), w = worker();
  for (const auth of ["", "Bearer broken", "Basic fixture"]) {
    assert.equal((await w.post(id, { ...body(1), techniqueId: null }, auth)).status, 401);
  }
  assert.equal(w.calls.length, 0);
});

test("actual Edge uses the existing bounded economy rate group for equipment", async () => {
  const id = await player(), w = worker();
  for (let i = 0; i < 60; i++) assert.equal((await w.post(id, { ...body(1), techniqueId: null })).status, 200);
  const limit = await w.post(id, { ...body(1), techniqueId: null });
  assert.equal(limit.status, 429); assert.equal(limit.body.error.code, "RATE_LIMITED");
  assert.equal(w.calls.length, 60);
  assert.equal((await snapshot(id)).standard_technique_equip_receipts.length, 60);
});
