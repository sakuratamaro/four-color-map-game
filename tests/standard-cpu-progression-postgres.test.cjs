"use strict";
// Real local PostgreSQL 17, independent backend PIDs, observed lock overlap.
// Platform JWT/auth tables are fixtures; application SQL, locks and pgcrypto are real.
const assert = require("node:assert/strict"), test = require("node:test");
const { randomUUID } = require("node:crypto");
const { pgBin, createNativePostgres, waitForBlocked } = require("./helpers/native-postgres.cjs");
const { createCpuSqlDatabase } = require("./helpers/cpu-sql-runtime.cjs");
const { createProgressionRuntime, api, winningEdgeScript } = require("./helpers/cpu-progression-runtime.cjs");
const { plain } = require("./helpers/public-skill-fixture.cjs");
let r, db;
test.before(async () => {
  if (!pgBin) return;
  r = await createProgressionRuntime({ createDatabase: async () => createCpuSqlDatabase({ nativeDatabase: await createNativePostgres() }) });
  db = r.db;
}, { timeout: 60000 });
test.after(async () => { if (r) await r.close(); });
const check = (name, fn) => test("native PostgreSQL AC064 " + name,
  { skip: !pgBin && "NOT_RUN: set FCG_TEST_POSTGRES_BIN to owned PostgreSQL 17 binaries", timeout: 45000 }, fn);
const inFlight = new Set();
function result(promise) {
  const observed = promise.then(value => ({value}), error => ({error}));
  inFlight.add(observed); observed.then(() => inFlight.delete(observed)); return observed;
}
const ok = response => { assert.equal(response.status, 200, JSON.stringify(response)); return response.body; };
const commit = (input, connection = db) => r.rpc("fcg_standard_server_commit_action", input, "service_role", null, connection);
const equip = (id, revision, connection = db, technique = "techUnsealOne", action = randomUUID()) =>
  r.rpc("fcg_standard_server_equip_technique", { p_user_id:id, p_expected_revision:revision, p_action_id:action, p_technique_id:technique }, "service_role", null, connection);
const startBody = () => ({ operation:"cpu-trial-start", actionId:randomUUID(), trialId:"ren-unseal", trialVersion:1, confirmed:true });
async function withSessions(run, count = 3) {
  const sessions = [];
  try {
    for (let i=0;i<count;i++) sessions.push(await db.openSession());
    assert.equal(new Set([db.pid, ...sessions.map(s=>s.pid)]).size, count+1);
    await run(...sessions);
  } finally {
    // A is this fixture's lock holder. Release it before draining competitors;
    // never queue cleanup SQL on a backend whose RPC is still executing.
    if (sessions[0]) await sessions[0].exec("rollback");
    await Promise.allSettled([...inFlight]);
    await Promise.allSettled(sessions.map(async s => { try { await s.exec("rollback"); } finally { await s.close(); } }));
  }
}
async function winningCandidate(id) {
  const roomId = ok(await r.worker(id).post(startBody())).roomId;
  let a = await r.authority(roomId);
  const members = (await db.query("select seat,user_id from public.fcg_room_members where room_id=$1", [roomId])).rows;
  const users = Object.fromEntries(members.map(m=>[m.seat,m.user_id]));
  for (const turn of winningEdgeScript(a, roomId)) {
    const next = plain(api.apply({ ...a, actor:turn.seat, expectedVersion:turn.version, action:turn.action }));
    assert.equal(next.ok,true,next.code);
    const projection = plain(api.project(next.state));
    const input = { p_room_id:roomId, p_actor_id:users[turn.seat], p_action_id:randomUUID(),
      p_expected_version:turn.version, p_action_type:turn.action.type, p_action_fingerprint:"a".repeat(64),
      p_authoritative_state:{state:next.state,rngSnapshot:next.rngSnapshot},
      p_public_state:projection.publicState, p_private_a:projection.privateA, p_private_b:projection.privateB,
      p_result:{code:next.code}, p_finished:next.state.status==="FINISHED", p_winner_seat:next.state.winner };
    if (input.p_finished) {
      assert.equal(input.p_winner_seat,"A");
      return {roomId,input};
    }
    await commit(input); a = input.p_authoritative_state;
  }
  throw new Error("Actual legal engine path did not produce a pending WIN");
}
async function learnedPlayer() {
  const id = await r.player(), candidate = await winningCandidate(id);
  await commit(candidate.input);
  assert.deepEqual((await r.profile(id)).profile_state.learnedTechniques,["techUnsealOne"]);
  return id;
}
async function finishedOrdinary(id) {
  // Context-only finished room fixture; learned ownership came from a real trial WIN.
  const room = (await db.query("insert into public.fcg_rooms(code_hash,host_user_id,game_mode,status,expires_at) values($1,$2,'standard_v5','finished',now()+interval '1 hour') returning id,version", [randomUUID(),id])).rows[0];
  await db.query("insert into public.fcg_room_members(room_id,user_id,seat,display_name) values($1,$2,'A','Race fixture')", [room.id,id]);
  return room;
}
async function rematch(connection, id, room) {
  await connection.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await connection.exec("set role authenticated");
  try { return await connection.query("select * from public.fcg_standard_request_rematch($1,$2,$3)", [room.id,room.version,randomUUID()]); }
  finally { await connection.exec("reset role"); }
}
check("runs actual pgcrypto and isolated independent backend connections", async () => {
  assert.match(db.version,/PostgreSQL 17\./);
  assert.equal((await db.query("select extversion from pg_extension where extname='pgcrypto'")).rowCount,1);
  await withSessions(async (a,b) => assert.notEqual(a.pid,b.pid),2);
});
check("simultaneous duplicate WIN and competing completion settle once, atomically", async () => {
  const id = await r.player(), {roomId,input} = await winningCandidate(id), before = await r.snapshot(id,roomId);
  await withSessions(async (a,b,c) => {
    await a.exec("begin"); assert.equal((await commit(input,a))[0].duplicate,false);
    assert.deepEqual(await r.snapshot(id,roomId),before,"observer sees no half-committed WIN or ownership");
    const duplicate = result(commit(input,b)); await waitForBlocked(db,b,a);
    const competitor = result(commit({...input,p_action_id:randomUUID()},c)); await waitForBlocked(db,c,a);
    await a.exec("commit");
    const replay = await duplicate; assert.ifError(replay.error); assert.equal(replay.value[0].duplicate,true);
    assert.ok(["55000","PT409"].includes((await competitor).error?.code));
  });
  const after = await r.snapshot(id,roomId);
  assert.equal(after.room.winner_seat,"A");
  assert.equal(after.standard_cpu_trial_clears.length,1); assert.equal(after.standard_learned_techniques.length,1);
  assert.equal(after.receipts,before.receipts+1);
  for (const key of ["coins","inventory","gachaTickets","cpuStats","cpuCharacterStats"])
    assert.deepEqual(after.profile.profile_state[key],before.profile.profile_state[key],key);
});
check("a blocked completion succeeds once after the first transaction rolls back", async () => {
  const id = await r.player(), {roomId,input} = await winningCandidate(id), before = await r.snapshot(id,roomId);
  await withSessions(async (a,b) => {
    await a.exec("begin"); await commit(input,a);
    const waiting = result(commit(input,b)); await waitForBlocked(db,b,a);
    assert.deepEqual(await r.snapshot(id,roomId),before);
    await a.exec("rollback");
    const second = await waiting; assert.ifError(second.error); assert.equal(second.value[0].duplicate,false);
  },2);
  const after = await r.snapshot(id,roomId);
  assert.equal(after.standard_learned_techniques.length,1); assert.equal(after.receipts,before.receipts+1);
});
check("old whole-profile writer waiting behind WIN retains newly committed progress", async () => {
  const id = await r.player(), legacy = await r.profile(id), {roomId,input} = await winningCandidate(id);
  await withSessions(async (a,b) => {
    await a.exec("begin"); await commit(input,a);
    // Simulates a legacy privileged full-JSON writer entering before the award
    // commits. It tests the real BEFORE trigger's READ COMMITTED refresh, not ACL.
    const writer = result(b.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1",
      [id,JSON.stringify({...legacy.profile_state,learnedTechniques:[],cpuTrialProgress:{},equippedTechniqueId:null})]));
    await waitForBlocked(db,b,a); await a.exec("commit");
    assert.ifError((await writer).error);
  },2);
  const after = await r.snapshot(id,roomId);
  assert.deepEqual(after.profile.profile_state.learnedTechniques,["techUnsealOne"]);
  assert.deepEqual(after.profile.profile_state.cpuTrialProgress["ren-unseal"].clearedVersions,[1]);
  assert.equal(after.standard_learned_techniques.length,1);
});
check("actual stale gacha commit waiting behind WIN rejects without deleting progress", async () => {
  const id = await r.player(), legacy = await r.profile(id), {input} = await winningCandidate(id);
  await withSessions(async (a,b) => {
    await a.exec("begin"); await commit(input,a); await b.exec("set role service_role");
    const writer = result(b.query("select * from public.fcg_standard_server_commit_gacha($1,$2,$3,$4,$5::jsonb,$6::jsonb)",
      [id,legacy.revision,randomUUID(),"a".repeat(64),JSON.stringify(legacy.profile_state),'{"draws":[]}']));
    await waitForBlocked(db,b,a); await a.exec("commit");
    assert.equal((await writer).error?.code,"PT409");
  },2);
  assert.deepEqual((await r.profile(id)).profile_state.learnedTechniques,["techUnsealOne"]);
  assert.equal((await db.query("select count(*)::int n from fcg_private.standard_gacha_receipts where user_id=$1",[id])).rows[0].n,0);
});
check("competing equip choices from one revision cannot both apply", async () => {
  const id = await learnedPlayer(), before = await r.profile(id);
  await withSessions(async (a,b) => {
    await a.exec("begin"); await equip(id,before.revision,a);
    const other = result(equip(id,before.revision,b,null)); await waitForBlocked(db,b,a);
    await a.exec("commit"); assert.equal((await other).error?.code,"PT409");
  },2);
  assert.equal((await r.profile(id)).profile_state.equippedTechniqueId,"techUnsealOne");
  assert.equal((await db.query("select count(*)::int n from fcg_private.standard_technique_equip_receipts where user_id=$1",[id])).rows[0].n,1);
});
check("ordinary start waits for equip and then snapshots the committed learned selection", async () => {
  const id = await learnedPlayer(), before = await r.profile(id);
  let roomId;
  await withSessions(async (a,b) => {
    await a.exec("begin"); await equip(id,before.revision,a);
    const starting = result(r.worker(id,{connection:b}).post({operation:"cpu-start",characterId:"ren",actionId:randomUUID(),confirmed:true}));
    await waitForBlocked(db,b,a); await a.exec("commit");
    const started = await starting; assert.ifError(started.error); roomId = ok(started.value).roomId;
  },2);
  const w = r.worker(id);
  ok(await w.post({operation:"setup",roomId,setupActionId:randomUUID(),expectedSetupRevision:0,loadout:{color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]}}));
  ok(await w.post({operation:"initialize",roomId}));
  const state = (await r.authority(roomId)).state;
  assert.equal(state.techniques.A.source,"LEARNED"); assert.equal(state.techniques.A.usesRemaining,1); assert.equal(state.techniques.B,null);
});
check("equip waiting behind ordinary start rejects after the new room becomes visible", async () => {
  const id = await learnedPlayer(), before = await r.profile(id);
  await withSessions(async (a,b) => {
    await a.exec("begin");
    ok(await r.worker(id,{connection:a}).post({operation:"cpu-start",characterId:"ren",actionId:randomUUID(),confirmed:true}));
    const waiting = result(equip(id,before.revision,b)); await waitForBlocked(db,b,a);
    await a.exec("commit");
    const denied = await waiting; assert.equal(denied.error?.code,"55000"); assert.match(denied.error.message,/TECHNIQUE_EQUIP_MATCH_LOCKED/);
  },2);
  assert.equal((await db.query("select count(*)::int n from fcg_private.standard_technique_equip_receipts where user_id=$1",[id])).rows[0].n,0);
});
check("simultaneous trial-start retries share one room while a new intent is rejected", async () => {
  const id = await r.player(), body = startBody();
  await withSessions(async (a,b,c) => {
    await a.exec("begin"); const first = ok(await r.worker(id,{connection:a}).post(body));
    const duplicate = result(r.worker(id,{connection:b}).post(body)); await waitForBlocked(db,b,a);
    const other = result(r.worker(id,{connection:c}).post(startBody())); await waitForBlocked(db,c,a);
    await a.exec("commit");
    const replay = ok((await duplicate).value); assert.equal(replay.roomId,first.roomId); assert.equal(replay.duplicate,true);
    assert.equal((await other).value.body.error.code,"CPU_TRIAL_MATCH_LOCKED");
  });
  assert.equal((await r.snapshot(id)).standard_cpu_trial_start_receipts.length,1);
});
check("rematch try-lock rejects an inverse lock order instead of deadlocking", async () => {
  const id = await learnedPlayer(), room = await finishedOrdinary(id), before = await r.profile(id);
  await withSessions(async (a,b) => {
    await a.exec("begin"); await equip(id,before.revision,a);
    const denied = await result(rematch(b,id,room));
    assert.equal(denied.error?.code,"40001"); assert.match(denied.error.message,/STANDARD_ACTOR_BUSY/);
    await a.exec("commit");
  },2);
  assert.equal((await db.query("select count(*)::int n from fcg_private.standard_rematch_votes where user_id=$1",[id])).rows[0].n,0);
});
check("equip blocked behind an uncommitted rematch vote sees the committed pending intent", async () => {
  const id = await learnedPlayer(), room = await finishedOrdinary(id), before = await r.profile(id);
  await withSessions(async (a,b) => {
    await a.exec("begin"); await rematch(a,id,room);
    const waiting = result(equip(id,before.revision,b)); await waitForBlocked(db,b,a);
    await a.exec("commit");
    assert.match((await waiting).error?.message || "",/TECHNIQUE_EQUIP_MATCH_LOCKED/);
  },2);
});
