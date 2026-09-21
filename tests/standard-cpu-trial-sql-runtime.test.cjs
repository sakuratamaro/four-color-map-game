"use strict";
// Actual TS worker + generated engine + isolated PostgreSQL/WASM. Platform JWT,
// transport and entropy are fixtures; no production or multi-session claim.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const { plain, root } = require("./helpers/public-skill-fixture.cjs");
const { createProgressionRuntime, api, winningEdgeScript } = require("./helpers/cpu-progression-runtime.cjs");
const trial = require("../standard/standard-cpu-progression.js");
const roster = require("../standard/standard-cpu-roster.js");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const { createStandardOnlineClient } = require("../standard-online-v5/standard-online-client.js");
let runtime, db, rpc, player, profile, authority, snapshot, worker;
test.before(async () => { runtime = await createProgressionRuntime(); ({ db, rpc, player, profile, authority, snapshot, worker } = runtime); });
test.after(async () => { if (runtime) await runtime.close(); });
const startBody = (actionId=randomUUID()) => ({operation:"cpu-trial-start",actionId,trialId:"ren-unseal",trialVersion:1,confirmed:true});
const ok = result => { assert.equal(result.status,200,JSON.stringify(result)); return result.body; };
async function start(id, actionId) { return ok(await worker(id).post(startBody(actionId))).roomId; }
async function send(id, roomId, action, w=worker(id)) {
  const a=await authority(roomId);
  const body={operation:"action",roomId,action:{...action,id:randomUUID(),expectedVersion:a.state.version}};
  return {body,result:await w.post(body)};
}
async function fullWinSql(id, roomId, { route="yellow", beforeFinal=null }={}) {
  let a=await authority(roomId), s=a.state, streams=engine.createRngDomainsFromSnapshot(a.rngSnapshot,match.REQUIRED_RNG_STREAMS);
  const members=(await db.query("select seat,user_id from public.fcg_room_members where room_id=$1",[roomId])).rows;
  const users=Object.fromEntries(members.map(m=>[m.seat,m.user_id]));
  let last;
  for(let n=0;n<160&&s.status!=="FINISHED";n++){
    const seat=s.active;
    let action;
    if(n===0&&route==="red") action={type:"USE_SKILL",payload:{skill:"techUnsealOne",color:"red"}};
    else if(n===(route==="red"?1:0)) action={type:"COLOR_REGION",payload:{color:route}};
    else {
      const observation={publicState:api.publicState(s),ownPrivateState:api.privateState(s,seat),random:()=>streams["cpu-"+seat].next(),tieBreakRandom:()=>streams["cpu-tie-break"].next()};
      action=seat==="B"?trial.chooseRenTrialAction({...observation,policyVersion:trial.TRIAL_POLICY_VERSION})
        :roster.chooseCharacterAction({...observation,characterId:"ren",policyVersion:roster.PRE_SPLIT_POLICY_VERSIONS.ren});
    }
    const applied=match.applyStandardAction({state:s,actor:seat,expectedVersion:s.version,rngStreams:streams,action});
    assert.equal(applied.ok,true,applied.code);
    const next=applied.state, projection=api.project(next);
    const input={p_room_id:roomId,p_actor_id:users[seat],p_action_id:randomUUID(),p_expected_version:s.version,p_action_type:action.type,p_action_fingerprint:"a".repeat(64),
      p_authoritative_state:{state:next,rngSnapshot:engine.snapshotRngDomains(streams,match.REQUIRED_RNG_STREAMS)},p_public_state:projection.publicState,p_private_a:projection.privateA,p_private_b:projection.privateB,
      p_result:{code:applied.code},p_finished:next.status==="FINISHED",p_winner_seat:next.winner};
    if(next.status==="FINISHED"&&beforeFinal)await beforeFinal(input);
    last={input,receipt:(await rpc("fcg_standard_server_commit_action",input))[0]}; s=next;
  }
  assert.equal(s.status,"FINISHED"); assert.equal(s.winner,"A");
  return last;
}

test("private SQL template is generated from the actual engine and cannot be changed by a caller", async()=>{
  execFileSync(process.execPath,["scripts/build-standard-trial-template.cjs","--check"],{cwd:root});
  for(const table of ["standard_cpu_trial_templates","standard_cpu_trial_rooms","standard_cpu_trial_start_receipts"])
    for(const role of ["anon","authenticated","service_role"])
      assert.equal((await db.query("select has_table_privilege($1,$2,'INSERT,UPDATE,DELETE,SELECT') ok",[role,"fcg_private."+table])).rows[0].ok,false);
  const signature="fcg_private.fcg_standard_server_commit_action(uuid,uuid,uuid,bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,bigint,jsonb,bigint,jsonb,boolean,text)";
  assert.equal((await db.query("select has_function_privilege('service_role',$1,'EXECUTE') ok",[signature])).rows[0].ok,false);
});
test("trial info uses saved Ren records; explicit version/consent and worker activation are required",async()=>{
  const id=await player(0), w=worker(id), before=await snapshot(id);
  const info=ok(await w.post({operation:"cpu-trial-info"})); assert.equal(info.progression.trialUnlocked,false);
  assert.match(info.trial.conditions.join(" "),/所持カードは減りません/);
  for(const change of [{confirmed:false},{trialVersion:2},{source:"LEARNED"},{profileState:{cpuCharacterStats:{ren:{wins:10}}}},{rngSnapshot:{}}]){
    assert.equal((await w.post({...startBody(),...change})).status,400);
  }
  assert.equal((await w.post(startBody())).body.error.code,"CPU_TRIAL_LOCKED");
  assert.equal((await worker(id,{activation:null}).post(startBody())).body.error.code,"TECHNIQUE_PILOT_DISABLED");
  assert.deepEqual(await snapshot(id),before);
});

test("start RPC is service-only and malformed RNG/version cannot create a room or receipt",async()=>{
  const id=await player(),before=await snapshot(id),args={p_user_id:id,p_action_id:randomUUID(),p_cpu_user_id:randomUUID(),p_trial_id:"ren-unseal",p_trial_version:1,p_rng_snapshot:trial.createRenTrial({matchId:"x",seed:1}).rngSnapshot};
  for(const role of ["anon","authenticated"])await assert.rejects(()=>rpc("fcg_standard_server_start_cpu_trial",args,role),e=>e.code==="42501");
  for(const rng of [null,{},[],{...args.p_rng_snapshot,die:-1},{...args.p_rng_snapshot,die:"1"},{...args.p_rng_snapshot,die:0.5},{...args.p_rng_snapshot,die:4294967296},{...args.p_rng_snapshot,extra:1}])
    await assert.rejects(()=>rpc("fcg_standard_server_start_cpu_trial",{...args,p_rng_snapshot:rng}),e=>/INVALID_TRIAL_RNG/.test(e.message));
  await assert.rejects(()=>rpc("fcg_standard_server_start_cpu_trial",{...args,p_trial_version:2}),e=>/UNKNOWN_CPU_TRIAL_VERSION/.test(e.message));
  assert.deepEqual(await snapshot(id),before);
});

test("pending search/rematch prevents trial start; trial rematch votes cannot strand equipment",async()=>{
  const id=await player();
  await db.query("insert into fcg_private.standard_matchmaking_tickets(ticket_id,user_id,display_name,profile_revision,state,expires_at) values($1,$2,'Trial tester',1,'searching',now()+interval '1 hour')",[randomUUID(),id]);
  assert.equal((await worker(id).post(startBody())).body.error.code,"CPU_TRIAL_MATCH_LOCKED");
  await db.query("update fcg_private.standard_matchmaking_tickets set expires_at=now()-interval '1 second' where user_id=$1",[id]);
  const roomId=await start(id);ok((await send(id,roomId,{type:"SURRENDER",payload:{}})).result);
  const version=(await snapshot(id,roomId)).room.version;
  await assert.rejects(()=>db.query("insert into fcg_private.standard_rematch_votes(room_id,user_id,room_version,action_id) values($1,$2,$3,$4)",[roomId,id,version,randomUUID()]),e=>/CPU_TRIAL_EXPLICIT_RESTART_REQUIRED/.test(e.message));
  const previous=(await db.query("insert into public.fcg_rooms(code_hash,host_user_id,game_mode,status,expires_at) values($1,$2,'standard_v5','finished',now()+interval '1 hour') returning id,version",[randomUUID(),id])).rows[0];
  await db.query("insert into public.fcg_room_members(room_id,user_id,seat,display_name) values($1,$2,'A','Trial tester')",[previous.id,id]);
  await db.query("insert into fcg_private.standard_rematch_votes(room_id,user_id,room_version,action_id) values($1,$2,$3,$4)",[previous.id,id,previous.version,randomUUID()]);
  assert.equal((await worker(id).post(startBody())).body.error.code,"CPU_TRIAL_MATCH_LOCKED");
});
test("only numeric integer saved Ren wins unlock; missing historic firstWinAt is accepted without invention",async()=>{
  for(const wins of [0,-1,"1",null,1.5]) {const id=await player(wins);assert.equal((await worker(id).post(startBody())).body.error.code,"CPU_TRIAL_LOCKED");}
  const id=await player(1),before=await profile(id),roomId=await start(id),a=await authority(roomId);
  assert.deepEqual(await profile(id),before);
  assert.equal(a.state.phase,"COLOR"); assert.equal(a.state.techniques.A.source,"TRIAL_LOAN");
  assert.deepEqual(a.state.loadouts.A,trial.TRIAL_LOADOUT); assert.equal(a.state.techniques.B.usesRemaining,1);
  assert.equal(Object.hasOwn(before.profile_state.cpuCharacterStats.ren,"firstWinAt"),false);
});
test("lost start ACK replays the same room, including after cleanup; a new start cannot overlap it",async()=>{
  const id=await player(),action=randomUUID(),roomId=await start(id,action),before=await snapshot(id,roomId);
  assert.equal(await start(id,action),roomId); assert.deepEqual(await snapshot(id,roomId),before);
  assert.equal((await worker(id).post(startBody())).body.error.code,"CPU_TRIAL_MATCH_LOCKED");
  await assert.rejects(()=>rpc("fcg_standard_server_start_cpu_trial",{p_user_id:id,p_action_id:action,p_cpu_user_id:randomUUID(),p_trial_id:"different",p_trial_version:1,p_rng_snapshot:{}}),e=>e.code==="23505");
  await db.query("delete from public.fcg_rooms where id=$1",[roomId]);
  assert.equal(await start(id,action),roomId);
  assert.equal((await db.query("select count(*)::int n from public.fcg_rooms where host_user_id=$1",[id])).rows[0].n,0);
});
test("actual Edge loan actions/replay consume only match resources; disabled-new-start workers continue existing rooms",async()=>{
  const id=await player(),roomId=await start(id),before=await profile(id),w=worker(id,{activation:null});
  const sent=await send(id,roomId,{type:"USE_SKILL",payload:{skill:"techUnsealOne",color:"red"}},w); ok(sent.result);
  assert.equal((await authority(roomId)).state.techniques.A.usesRemaining,0);
  assert.deepEqual(await profile(id),before);
  const again=ok(await w.post(sent.body));assert.equal(again.duplicate,true);
  const loaded=ok(await w.post({operation:"initialize",roomId}));assert.equal(loaded.room.privateState.technique.usesRemaining,0);
  ok((await send(id,roomId,{type:"COLOR_REGION",payload:{color:"red"}},w)).result);
  const card=await send(id,roomId,{type:"USE_SKILL",payload:{skill:"areaDiePlus"}},w);ok(card.result);
  assert.equal((await authority(roomId)).state.hands.A.areaDiePlus,0);
  assert.deepEqual(await profile(id),before);
});
test("actual player surrender finishes without a clear, learned technique, ordinary record or reward",async()=>{
  const id=await player(),roomId=await start(id),before=await profile(id);
  ok((await send(id,roomId,{type:"SURRENDER",payload:{}})).result);
  const after=await snapshot(id,roomId);assert.equal(after.room.winner_seat,"B");assert.deepEqual(after.profile,before);
  assert.equal(after.standard_cpu_trial_clears.length,0);assert.equal(after.standard_learned_techniques.length,0);
  assert.equal((await worker(id).post({operation:"cpu-rematch",roomId,expectedVersion:after.room.version,actionId:randomUUID()})).body.error.code,"CPU_TRIAL_EXPLICIT_RESTART_REQUIRED");
});
test("real engine WIN atomically grants once, with rollback, exact retry, stale competitor and repeat clear proofs",async()=>{
  const id=await player(),roomId=await start(id),before=await profile(id);
  const final=await fullWinSql(id,roomId,{beforeFinal:async input=>{
    const pending=await snapshot(id,roomId);
    await db.exec("begin");await rpc("fcg_standard_server_commit_action",input);
    assert.deepEqual((await profile(id)).profile_state.learnedTechniques,["techUnsealOne"]);
    await db.exec("rollback");assert.deepEqual(await snapshot(id,roomId),pending);
    await assert.rejects(()=>rpc("fcg_standard_server_commit_action",{...input,p_profile_a_state:before.profile_state,p_profile_a_expected_revision:before.revision}),e=>/TRIAL_NORMAL_REWARD_FORBIDDEN/.test(e.message));
    assert.deepEqual(await snapshot(id,roomId),pending);
  }});
  const won=await snapshot(id,roomId);assert.equal(won.standard_learned_techniques.length,1);assert.equal(won.standard_cpu_trial_clears.length,1);
  for(const key of ["inventory","coins","gachaTickets","cpuStats","cpuCharacterStats","matchHistory"])assert.deepEqual(won.profile.profile_state[key],before.profile_state[key],key);
  assert.equal(won.authority.state.techniques.A.usesRemaining,1,"unseal is not a forced clear objective");
  assert.equal((await rpc("fcg_standard_server_commit_action",final.input))[0].duplicate,true);
  await assert.rejects(()=>rpc("fcg_standard_server_commit_action",{...final.input,p_action_id:randomUUID()}),e=>e.code==="55000"||e.code==="PT409");
  assert.deepEqual(await snapshot(id,roomId),won);
  const second=await start(id);await fullWinSql(id,second,{route:"red"});
  const repeat=await snapshot(id,second);assert.equal(repeat.standard_cpu_trial_clears.length,1);assert.equal(repeat.standard_learned_techniques.length,1);
  assert.deepEqual(repeat.profile,won.profile);
  // One PGlite connection: actual atomic/revision semantics, not multi-session race acceptance.
});
test("snapshot guard rejects ownership spoofing and replenishing a consumed trial use",async()=>{
  const id=await player(),roomId=await start(id);
  ok((await send(id,roomId,{type:"USE_SKILL",payload:{skill:"techUnsealOne",color:"red"}})).result);
  const before=await snapshot(id,roomId),next=plain(before.authority);next.state.techniques.A.usesRemaining=1;
  await assert.rejects(()=>db.query("update fcg_private.authoritative_matches set state=$2::jsonb where room_id=$1",[roomId,JSON.stringify(next)]),e=>/IMMUTABLE_TECHNIQUE_SNAPSHOT/.test(e.message));
  assert.deepEqual(await snapshot(id,roomId),before);
  const other=plain(before.authority);other.state.techniques.A.source="LEARNED";
  await assert.rejects(()=>db.query("update fcg_private.authoritative_matches set state=$2::jsonb where room_id=$1",[roomId,JSON.stringify(other)]),e=>/IMMUTABLE_TECHNIQUE_SNAPSHOT/.test(e.message));
});

test("actual lost action ACK can be recovered and retried without restoring a technique use",async()=>{
  const id=await player(),roomId=await start(id),w=worker(id,{loseCommit:true});
  const sent=await send(id,roomId,{type:"USE_SKILL",payload:{skill:"techUnsealOne",color:"red"}},w);
  assert.equal(sent.result.status,500);
  const committed=await snapshot(id,roomId);assert.equal(committed.authority.state.techniques.A.usesRemaining,0);assert.equal(committed.receipts,1);
  const retry=ok(await w.post(sent.body));assert.equal(retry.duplicate,true);assert.deepEqual(await snapshot(id,roomId),committed);
});

function trialClient(id, w=worker(id)) {
  const values=new Map(),requests=[];let dropOperation=null;
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const supabase={auth:{getSession:async()=>({data:{session:{user:{id}}}})},rpc:async()=>{throw new Error("unexpected browser RPC");},functions:{invoke:async(name,{body})=>{
    requests.push(plain(body));const result=await w.post(body);
    if(dropOperation===body.operation){dropOperation=null;return {error:new Error("committed response lost")};}
    return result.status===200?{data:result.body}:{error:{context:new Response(JSON.stringify(result.body),{status:result.status})}};
  }}};
  const fresh=()=>createStandardOnlineClient({supabase,storage,idFactory:randomUUID});
  return {fresh,client:fresh(),requests,drop:operation=>{dropOperation=operation;}};
}
test("AC064 real browser client -> Edge -> SQL survives lost start/use/equip replies through WIN and ordinary start",async()=>{
  const id=await player(),f=trialClient(id),input={actionId:randomUUID(),trialId:"ren-unseal",trialVersion:1,confirmed:true};
  assert.equal((await f.client.readRenTrial()).progression.trialUnlocked,true);
  f.drop("cpu-trial-start");await assert.rejects(f.client.startCpuTrial(input));
  const restored=f.fresh(),started=await restored.startCpuTrial();assert.equal(started.duplicate,true);const roomId=started.roomId;
  assert.equal((await snapshot(id,roomId)).standard_cpu_trial_start_receipts.length,1);
  const action={id:randomUUID(),expectedVersion:0,type:"USE_SKILL",payload:{skill:"techUnsealOne",color:"red"}};
  f.drop("action");await assert.rejects(restored.submitAction(action));assert.equal((await restored.submitAction(action)).duplicate,true);
  assert.equal((await f.fresh().initialize()).room.privateState.technique.usesRemaining,0);
  for(const turn of winningEdgeScript(await authority(roomId),roomId)){
    if(turn.seat==="B")await restored.takeCpuTurn({expectedVersion:turn.version});
    else await restored.submitAction({type:turn.action.type,payload:turn.action.payload,expectedVersion:turn.version});
  }
  const after=await profile(id);assert.deepEqual(after.profile_state.learnedTechniques,["techUnsealOne"]);
  restored.clearRoom();const equip={actionId:randomUUID(),expectedRevision:after.revision,techniqueId:"techUnsealOne"};
  f.drop("technique-equip");await assert.rejects(restored.equipTechnique(equip));
  const equipped=f.fresh();const result=await equipped.equipTechnique();assert.equal(result.duplicate,true);assert.equal(result.profileState.equippedTechniqueId,"techUnsealOne");
  const ordinaryStart=await equipped.startCpuOpponent({characterId:"ren"});
  await equipped.submitSetup({loadout:{color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]}});
  assert.equal(equipped.snapshot().setupRevision,1,"actual PostgREST scalar revision unlocks automatic UI initialization");
  const initialized=await equipped.initialize();
  assert.equal(initialized.room.privateState.technique.usesRemaining,1);assert.notEqual(ordinaryStart.roomId,roomId);
  for(const operation of ["cpu-trial-start","technique-equip"]){const calls=f.requests.filter(body=>body.operation===operation);assert.deepEqual(calls[0],calls[1]);}
});
test("AC064 server roster advertises pilot UI only for the exact managed version",async()=>{
  const id=await player();for(const activation of [null,"true","ren-unseal-v1"]){
    const roster=ok(await worker(id,{activation}).post({operation:"cpu-roster"}));assert.equal(roster.cpuProgressionVersion,activation==="ren-unseal-v1"?"ren-unseal-v1":null);
  }
});
test("actual TS trial start, real CPU decisions, all action commits and WIN award work end to end",async()=>{
  const id=await player(),roomId=await start(id),before=await profile(id),w=worker(id,{activation:null});
  const trace=winningEdgeScript(await authority(roomId),roomId);
  for(const turn of trace){
    const request=turn.seat==="B"?{operation:"cpu-action",roomId,expectedVersion:turn.version}
      :{operation:"action",roomId,action:{type:turn.action.type,payload:turn.action.payload,id:randomUUID(),expectedVersion:turn.version}};
    ok(await w.post(request));
  }
  const result=await snapshot(id,roomId);assert.equal(result.room.winner_seat,"A");
  assert.deepEqual(result.profile.profile_state.learnedTechniques,["techUnsealOne"]);
  assert.equal(result.standard_cpu_trial_clears.length,1);
  assert.deepEqual(result.profile.profile_state.cpuCharacterStats,before.profile_state.cpuCharacterStats);
  assert.deepEqual(result.profile.profile_state.inventory,before.profile_state.inventory);
  assert.ok(w.calls.some(call=>call.name==="fcg_standard_server_load_room_v2"));
});

async function ordinary(id,w=worker(id)) {
  const roomId=ok(await w.post({operation:"cpu-start",characterId:"ren",actionId:randomUUID(),confirmed:true})).roomId;
  const loadout={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};
  ok(await w.post({operation:"setup",roomId,setupActionId:randomUUID(),expectedSetupRevision:0,loadout}));
  ok(await w.post({operation:"initialize",roomId}));
  return roomId;
}
test("ordinary start remains alpha4 without equipment; privileged snapshot insert cannot bypass the shared initializer guard",async()=>{
  const id=await player(),w=worker(id),roomId=await ordinary(id,w),before=await snapshot(id,roomId);
  assert.equal(before.authority.state.engineVersion,"5.0.0-alpha.4");assert.equal(before.authority.state.techniques,undefined);
  const fake=plain(before.authority);fake.state.engineVersion="5.0.0-alpha.5";fake.state.techniqueRule={id:"CPU_LEARNED_V1",playerSeat:"A"};fake.state.techniques={A:{id:"techUnsealOne",definitionVersion:"unseal-v1",source:"LEARNED",usesRemaining:1},B:null};
  await db.exec("begin");await db.query("delete from fcg_private.authoritative_matches where room_id=$1",[roomId]);
  await assert.rejects(()=>db.query("insert into fcg_private.authoritative_matches(room_id,version,state,game_mode) values($1,$2,$3::jsonb,'standard_v5')",[roomId,before.room.version,JSON.stringify(fake)]),e=>/INVALID_TECHNIQUE_SNAPSHOT/.test(e.message));
  await db.exec("rollback");assert.deepEqual(await snapshot(id,roomId),before);
});
test("actual unlock/equip/ordinary initialize validates ownership; CPU is not mirrored and later new matches renew use",async()=>{
  const id=await player(),trialRoom=await start(id);await fullWinSql(id,trialRoom);
  const w=worker(id),saved=await profile(id);
  ok(await w.post({operation:"technique-equip",actionId:randomUUID(),expectedRevision:saved.revision,techniqueId:"techUnsealOne"}));
  const roomId=await ordinary(id,w),a=await authority(roomId);
  assert.equal(a.state.engineVersion,"5.0.0-alpha.5");assert.equal(a.state.techniques.A.source,"LEARNED");assert.equal(a.state.techniques.B,null);
  assert.equal(a.state.techniques.A.usesRemaining,1);assert.equal(Object.keys(a.state.hands.A).length,6);
  assert.equal((await w.post({operation:"technique-equip",actionId:randomUUID(),expectedRevision:(await profile(id)).revision,techniqueId:null})).body.error.code,"TECHNIQUE_EQUIP_MATCH_LOCKED");
  // Fixture chooses legal B actions explicitly to create a seal opportunity.
  // This is not an ordinary CPU decision-quality claim; every action is still
  // executed by the real engine and same service-only SQL commit boundary.
  const members=(await db.query("select seat,user_id from public.fcg_room_members where room_id=$1",[roomId])).rows;
  const users=Object.fromEntries(members.map(m=>[m.seat,m.user_id]));let unsealed=false;
  for(let n=0;n<30&&!unsealed;n++){
    const current=await authority(roomId),s=current.state,seat=s.active,own=api.privateState(s,seat),pub=api.publicState(s);
    assert.notEqual(s.status,"FINISHED");
    if(seat==="A"&&s.phase==="COLOR"){
      const color=own.basicPalette.find(color=>pub.publicEffects.A?.seals?.[color]>0);
      if(color){const before=await profile(id),sent=await send(id,roomId,{type:"USE_SKILL",payload:{skill:"techUnsealOne",color}},w);ok(sent.result);
        assert.deepEqual(await profile(id),before);assert.equal(ok(await w.post(sent.body)).duplicate,true);unsealed=true;break;}
    }
    let action;
    if(seat==="B"&&s.phase==="WORK"&&own.hand.disruptChoiceOne===1&&!pub.skillCategoryWindow.categories.includes("disrupt"))
      action={type:"USE_SKILL",payload:{skill:"disruptChoiceOne",color:api.privateState(s,"A").basicPalette[0]}};
    else action=roster.chooseCharacterAction({publicState:pub,ownPrivateState:own,characterId:"ren",policyVersion:roster.PRE_SPLIT_POLICY_VERSIONS.ren,random:()=>0.2,tieBreakRandom:()=>0.2});
    const applied=plain(api.apply({...current,actor:seat,action,expectedVersion:s.version}));assert.equal(applied.ok,true,applied.code);
    const ps={A:(await profile(users.A)).profile_state,B:(await profile(users.B)).profile_state};
    const changed=plain(api.applyCpuProfiles({profiles:ps,beforeState:s,nextState:applied.state,actor:seat,action,finishedAt:new Date().toISOString(),characterId:"ren",cardConsumed:applied.cardConsumed}));
    await rpc("fcg_standard_server_commit_action",{p_room_id:roomId,p_actor_id:users[seat],p_action_id:randomUUID(),p_expected_version:s.version,p_action_type:action.type,p_action_fingerprint:"c".repeat(64),p_authoritative_state:{state:applied.state,rngSnapshot:applied.rngSnapshot},p_public_state:applied.publicState,p_private_a:applied.privateA,p_private_b:applied.privateB,p_result:{code:applied.code},p_finished:applied.finished,p_winner_seat:applied.winnerSeat,
      p_profile_a_state:changed.changed.A?changed.profiles.A:null,p_profile_a_expected_revision:changed.changed.A?(await profile(id)).revision:null});
  }
  assert.equal(unsealed,true);
  assert.equal(ok(await worker(id,{activation:null}).post({operation:"initialize",roomId})).room.privateState.technique.usesRemaining,0);
  ok((await send(id,roomId,{type:"SURRENDER",payload:{}},w)).result);
  const next=await ordinary(id,w);assert.equal((await authority(next)).state.techniques.A.usesRemaining,1);
  assert.equal((await authority(roomId)).state.techniques.A.usesRemaining,0);
});
