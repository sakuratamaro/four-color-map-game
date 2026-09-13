"use strict";
// Full TS handler + generated engine + actual isolated PostgreSQL/WASM functions.
// Supabase authentication, network and native multi-connection races are not simulated acceptance.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const { webcrypto, randomUUID, createHash } = require("node:crypto");
const test = require("node:test");
const { createCpuSqlDatabase } = require("./helpers/cpu-sql-runtime.cjs");
const { loadEngine, fixture, plain, root } = require("./helpers/public-skill-fixture.cjs");
const roster = require("../standard/standard-cpu-roster.js");
const source = fs.readFileSync(path.join(root, "supabase/functions/standard-game-action/index.ts"), "utf8");
const runnable = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ""));
const allowedRpc = new Set(["fcg_standard_server_load_room_v3", "fcg_standard_server_load_room_v2",
  "fcg_standard_server_replay_action", "fcg_standard_server_commit_action"]);
const api = loadEngine();
let db;
test.before(async () => { const setup = await createCpuSqlDatabase(); db = setup.db; await db.exec(setup.migration); });
test.after(async () => { if (db) await db.close(); });

async function seed(input, cpu = false) {
  const ids = { A: randomUUID(), B: randomUUID(), room: randomUUID() }, projection = api.project(input.state);
  for (const seat of ["A", "B"]) {
    const profile = plain(api.createStarterProfile("Fixture " + seat));
    profile.inventory = Object.fromEntries(Object.keys(input.state.hands[seat]).map(id => [id, 3]));
    api.validateProfile(profile);
    await db.query("insert into auth.users(id) values ($1)", [ids[seat]]);
    await db.query("insert into public.fcg_standard_profiles(user_id, revision, display_name, profile_state) values ($1,1,$2,$3::jsonb)",
      [ids[seat], profile.displayName, JSON.stringify(profile)]);
  }
  await db.query("insert into public.fcg_rooms(id,code_hash,host_user_id,status,game_mode,public_state,opponent_kind,cpu_user_id,cpu_character_id,cpu_policy_version) values ($1,$2,$3,'playing','standard_v5',$4::jsonb,$5,$6,$7,$8)",
    [ids.room, ids.room, ids.A, JSON.stringify(projection.publicState), cpu ? "cpu" : "human", cpu ? ids.B : null,
      cpu ? "rei" : null, cpu ? roster.CPU_CHARACTERS.rei.policyVersion : null]);
  for (const seat of ["A", "B"]) {
    await db.query("insert into public.fcg_room_members(room_id,user_id,seat,display_name) values ($1,$2,$3,$4)", [ids.room, ids[seat], seat, "Fixture " + seat]);
    const loadout = JSON.stringify(input.state.loadouts[seat]);
    await db.query("insert into fcg_private.standard_room_setups(room_id,user_id,seat,profile_revision,quote_id,quote_expires_at,loadout,loadout_fingerprint) values ($1,$2,$3,1,$4,now()+interval '1 hour',$5::jsonb,$6)",
      [ids.room, ids[seat], seat, randomUUID(), loadout, createHash("sha256").update(loadout).digest("hex")]);
    await db.query("insert into public.fcg_player_views(room_id,user_id,seat,private_state) values ($1,$2,$3,$4::jsonb)",
      [ids.room, ids[seat], seat, JSON.stringify(seat === "A" ? projection.privateA : projection.privateB)]);
  }
  await db.query("insert into fcg_private.authoritative_matches(room_id,version,state,game_mode) values ($1,0,$2::jsonb,'standard_v5')",
    [ids.room, JSON.stringify({ state: input.state, rngSnapshot: input.rngSnapshot })]);
  return ids;
}

function worker(ids, { caller = "A", cpuChoice = null, conflict = false, loseReply = false } = {}) {
  const calls = [], errors = []; let handler, didLose = false, choiceObservation = null;
  const token = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ sub: ids[caller], role: "authenticated" })).toString("base64url") + ".fixture";
  const env = { SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "isolated-test-not-a-credential",
    FCG_CPU_SPLIT_RESCUE: roster.SPLIT_RESCUE_POLICY_VERSION };
  const sandbox = { Request, Response, Headers, TextEncoder, TextDecoder, atob, crypto: webcrypto,
    console: { error: (...args) => errors.push(args) },
    Deno: { env: { get: name => env[name] }, serve: fn => { handler = fn; } },
    FourColorStandardServerEngine: { ...Object.fromEntries(Object.entries(api).map(([name, value]) => [name,
      typeof value === "function" ? (...args) => { try { return value(...args); } catch (error) {
        errors.push({ stage: name, message: error.message }); throw error;
      } } : value])), ...(cpuChoice ? { chooseCpuAction: observation => {
      choiceObservation = plain(observation); return plain(cpuChoice);
    } } : {}) },
    createClient: () => ({ rpc: async (name, rawArgs) => {
      assert.ok(allowedRpc.has(name), "unexpected RPC " + name);
      const args = plain(rawArgs); calls.push({ name, args: plain(args) });
      if (name === "fcg_standard_server_commit_action" && conflict) args.p_profile_a_expected_revision = 0;
      await db.exec("set role service_role");
      try {
        const keys = Object.keys(args), params = keys.map(key => args[key] !== null && typeof args[key] === "object" ? JSON.stringify(args[key]) : args[key]);
        const result = await db.query(`select * from public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(",")})`, params);
        if (name === "fcg_standard_server_commit_action" && loseReply && !didLose) { didLose = true; return { error: new Error("isolated lost commit response") }; }
        return { data: result.rows };
      } catch (error) { errors.push({ stage: name, code: error.code, message: error.message }); return { error }; }
      finally { await db.exec("reset role"); }
    } }),
  };
  vm.runInNewContext(runnable, sandbox, { filename: "standard-game-action.ts" });
  return { calls, errors, observation: () => choiceObservation, post: async body => {
    const response = await handler(new Request("https://fixture.invalid/functions/v1/standard-game-action", {
      method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json(), diagnostics: plain(errors) };
  } };
}
function body(ids, input, actionId = randomUUID()) {
  return { operation: "action", roomId: ids.room, action: { ...input.action, id: actionId, expectedVersion: input.expectedVersion },
    lastPublicSkill: { skillId: "forged-name" } };
}
async function snapshot(ids, seat) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[seat]]);
  await db.exec("set role authenticated");
  try { return (await db.query("select public.fcg_standard_room_snapshot_v2($1,null) as value", [ids.room])).rows[0].value; }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function stored(ids) {
  return (await db.query("select r.version,r.public_state,a.state,(select count(*)::int from fcg_private.standard_action_receipts x where x.room_id=r.id) as receipts from public.fcg_rooms r join fcg_private.authoritative_matches a on a.room_id=r.id where r.id=$1", [ids.room])).rows[0];
}

for (const [actor, scenario] of [["A", "work"], ["B", "palette"]]) test(`actual human handler commits one named public action and one receipt: ${actor}`, async () => {
  const input = fixture(api, { actor, scenario }), ids = await seed(input), w = worker(ids, { caller: actor }), request = body(ids, input);
  const result = await w.post(request);
  assert.equal(result.status, 200, JSON.stringify(result));
  const expected = { eventId: `${input.state.matchId}:1`, version: 1, actor, skillId: input.action.payload.skill };
  assert.deepEqual(result.body.room.publicState.lastPublicSkill, expected);
  const first = await stored(ids); assert.equal(first.receipts, 1); assert.equal(Number(first.version), 1);
  assert.equal(Object.hasOwn(first.state.state, "lastPublicSkill"), false);
  for (const seat of ["A", "B"]) {
    const read = await snapshot(ids, seat);
    assert.deepEqual(read.room.public_state.lastPublicSkill, expected);
    assert.equal(read.view.seat, seat);
    assert.deepEqual(read.view.private_state, plain(api.privateState(first.state.state, seat)));
  }
  const retry = await w.post(request);
  assert.equal(retry.status, 200); assert.equal(retry.body.duplicate, true);
  assert.deepEqual(retry.body.room.publicState.lastPublicSkill, expected);
  assert.deepEqual(await stored(ids), first);
  assert.equal(w.calls.filter(call => call.name === "fcg_standard_server_commit_action").length, 1);
});

test("actual CPU handler publishes only its executed ID through the same SQL boundary", async () => {
  const input = fixture(api, { actor: "B" }), ids = await seed(input, true);
  // The choice is an authored fixture; the actual handler, engine, SQL and projections run unchanged.
  const w = worker(ids, { cpuChoice: input.action });
  const result = await w.post({ operation: "cpu-action", roomId: ids.room, expectedVersion: 0 });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.body.room.publicState.lastPublicSkill.skillId, "areaDiePlus");
  assert.equal(result.body.room.publicState.lastPublicSkill.actor, "B");
  assert.deepEqual(w.observation().ownPrivateState, plain(api.privateState(input.state, "B")));
  assert.equal(Object.hasOwn(w.observation(), "opponentPrivateState"), false);
  assert.equal((await snapshot(ids, "A")).room.public_state.lastPublicSkill.skillId, "areaDiePlus");
  assert.equal((await stored(ids)).receipts, 1);
});

test("accepted no-op names its attempted skill without exposing the private miss or consuming inventory", async () => {
  const input = fixture(api, { scenario: "miss" }), ids = await seed(input), w = worker(ids);
  const before = (await snapshot(ids, "A")).profile;
  const result = await w.post(body(ids, input));
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.body.result.noOp, true); assert.equal(result.body.result.cardConsumed, false);
  assert.deepEqual(Object.keys(result.body.room.publicState.lastPublicSkill).sort(), ["actor", "eventId", "skillId", "version"]);
  assert.deepEqual((await snapshot(ids, "A")).profile, before);
});

test("rule rejection leaves SQL and public metadata unchanged and preserves the true HTTP400 code", async () => {
  const input = fixture(api, { scenario: "borrow-reject" }), ids = await seed(input), w = worker(ids), before = await stored(ids);
  const result = await w.post(body(ids, input));
  assert.equal(result.status, 400); assert.equal(result.body.error.code, "NO_BOARD_COLORS");
  assert.equal(w.calls.some(call => call.name === "fcg_standard_server_commit_action"), false);
  assert.deepEqual(await stored(ids), before);
});

test("actual failed SQL profile revision rolls back authority, event, private views and receipt together", async () => {
  const input = fixture(api), ids = await seed(input), w = worker(ids, { conflict: true }), before = await stored(ids);
  const beforeView = await snapshot(ids, "B"), result = await w.post(body(ids, input));
  assert.notEqual(result.status, 200);
  assert.equal(w.calls.filter(call => call.name === "fcg_standard_server_commit_action").length, 1);
  assert.deepEqual(await stored(ids), before);
  const afterView = await snapshot(ids, "B");
  // Fresh server wall time is not persisted game/profile/view state.
  delete beforeView.server_time; delete afterView.server_time;
  assert.deepEqual(afterView, beforeView);
  assert.equal(Object.hasOwn(result.body, "room"), false);
});

test("lost commit response is observable once through snapshot and a duplicate receipt, never a second event", async () => {
  const input = fixture(api), ids = await seed(input), w = worker(ids, { loseReply: true }), request = body(ids, input);
  const lost = await w.post(request); assert.notEqual(lost.status, 200);
  const committed = await stored(ids), read = await snapshot(ids, "B");
  assert.equal(committed.receipts, 1); assert.equal(Number(committed.version), 1);
  assert.equal(read.room.public_state.lastPublicSkill.skillId, "areaDiePlus");
  const retry = await w.post(request);
  assert.equal(retry.status, 200); assert.equal(retry.body.duplicate, true);
  assert.deepEqual(retry.body.room.publicState.lastPublicSkill, read.room.public_state.lastPublicSkill);
  assert.deepEqual(await stored(ids), committed);
  assert.equal(w.calls.filter(call => call.name === "fcg_standard_server_commit_action").length, 1);
});
