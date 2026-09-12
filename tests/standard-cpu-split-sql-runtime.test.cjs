"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {randomUUID,createHash}=require("node:crypto");
const test=require("node:test");
const {createCpuSqlDatabase}=require("./helpers/cpu-sql-runtime.cjs");
const roster=require("../standard/standard-cpu-roster.js");
const sandbox={console};sandbox.globalThis=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../supabase/functions/standard-game-action/standard-engine.bundle.js"),"utf8"),sandbox);
const api=sandbox.FourColorStandardServerEngine;
const ids=Object.keys(roster.CPU_CHARACTERS);
const plain=v=>JSON.parse(JSON.stringify(v));
const names=["public.fcg_rooms","public.fcg_standard_profiles","public.fcg_room_members",
  "fcg_private.standard_cpu_profile_owners","fcg_private.standard_room_setups","fcg_private.standard_cpu_start_receipts"];
let db,baseline,beforeRows,oldRequests=[],previousFunctions,oldSupported;
const startSql="select * from public.fcg_standard_server_start_cpu($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::jsonb,$8::jsonb,$9::text)";
const acceptSql="select * from public.fcg_standard_server_accept_cpu($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::jsonb,$8::jsonb,$9::text)";
const rematchSql="select * from public.fcg_standard_server_request_cpu_rematch($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::text,$6::text,$7::text,$8::jsonb,$9::jsonb,$10::text)";
async function asRole(role,fn){
  assert.ok(["service_role","anon","authenticated"].includes(role));
  await db.exec("set role "+role);
  try{return await fn();}finally{await db.exec("reset role");}
}
async function rows(){
  const out={};
  for(const name of names)out[name]=(await db.query("select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from "+name+" t")).rows[0].rows;
  return out;
}
async function human(){
  const id=randomUUID(),profile=plain(api.createStarterProfile("SQL fixture"));
  await db.query("insert into auth.users(id) values($1)",[id]);
  await db.query("insert into public.fcg_standard_profiles(user_id,revision,display_name,profile_state) values($1,1,$2,$3::jsonb)",[id,profile.displayName,JSON.stringify(profile)]);
  return id;
}
async function request(id,generation="current"){
  const cpu=plain(api.createCpuProfile(id,{policyGeneration:generation}));
  return [await human(),randomUUID(),randomUUID(),id,cpu.policyVersion,cpu.profile.displayName,JSON.stringify(cpu.profile),JSON.stringify(cpu.loadout),createHash("sha256").update(JSON.stringify(cpu.loadout)).digest("hex")];
}
const start=args=>asRole("service_role",async()=>(await db.query(startSql,args)).rows[0]);
async function functionDefinitions(){
  return (await db.query("select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('fcg_standard_server_accept_cpu','fcg_standard_server_request_cpu_rematch') order by proname")).rows;
}
test.before(async()=>{
  const state=await createCpuSqlDatabase();db=state.db;baseline=state.baseline;
  for(const id of ids){const args=await request(id,"legacy");const result=await start(args);oldRequests.push({args,result});}
  beforeRows=await rows();previousFunctions=await functionDefinitions();
  oldSupported=(await db.query("select fcg_private.fcg_standard_cpu_policy_is_supported('rei','standard-character-split-rescue-v1:rei') as supported")).rows[0].supported;
  await db.exec(state.migration);
});
test.after(async()=>{if(db)await db.close();});

test("actual CPU migration executes on complete baseline and changes no existing rows, accept or rematch body",async()=>{
  assert.ok(baseline.includes("202609050005_standard_kurogane_lookahead.sql"));
  assert.equal(oldSupported,false);
  assert.deepEqual(await rows(),beforeRows);
  assert.deepEqual(await functionDefinitions(),previousFunctions);
});

test("exact deployment verification SQL is read-only and passes real migrated functions and ACLs",async()=>{
  const sql=fs.readFileSync(path.join(__dirname,"../supabase/verification/standard_cpu_split_rescue_verify.sql"),"utf8");
  assert.doesNotMatch(sql,/^\s*(?:insert|update|delete|drop|alter|create|grant|revoke|truncate|call|do)\b/im);
  const before=await rows();
  const checks=(await db.query(sql)).rows;
  assert.equal(checks.length,5);
  assert.deepEqual(checks.filter(row=>row.ok!==true),[]);
  assert.deepEqual(await rows(),before);
});

test("actual SQL policy helpers accept only each exact old/new identity and reject null/unknown/cross-character",async()=>{
  for(const id of ids){
    const valid=[roster.PRE_SPLIT_POLICY_VERSIONS[id],roster.CPU_CHARACTERS[id].policyVersion];
    if(id==="kurogane")valid.push(roster.KUROGANE_LEGACY_POLICY_VERSION);
    for(const version of [...valid,null,"","invented",roster.CPU_CHARACTERS[id==="rei"?"ren":"rei"].policyVersion]){
      const row=(await db.query("select fcg_private.fcg_standard_cpu_policy_is_supported($1,$2) as supported, fcg_private.fcg_standard_cpu_policy_is_current($1,$2) as current",[id,version])).rows[0];
      assert.equal(row.supported,valid.includes(version),id+"/"+version);
      assert.equal(row.current,valid.includes(version)&&version!==roster.KUROGANE_LEGACY_POLICY_VERSION,id+"/"+version);
    }
  }
  for(const id of [null,"","invented"]){
    assert.equal((await db.query("select fcg_private.fcg_standard_cpu_policy_is_supported($1,$2) as supported",[id,roster.CPU_CHARACTERS.rei.policyVersion])).rows[0].supported,false);
  }
});

test("old receipts replay through new policy without duplicate room/profile/setup or changing saved policy",async()=>{
  for(const {args,result} of oldRequests){
    const before=await rows();
    const replay=await start(args.map((value,index)=>index===2?randomUUID():index===4?roster.CPU_CHARACTERS[args[3]].policyVersion:value));
    assert.equal(replay.duplicate,true);assert.equal(replay.room_id,result.room_id);
    assert.deepEqual(await rows(),before);
    assert.equal((await db.query("select cpu_policy_version from public.fcg_rooms where id=$1",[result.room_id])).rows[0].cpu_policy_version,args[4]);
  }
});

test("every new policy starts once and its receipt replays in reverse through pre-split activation",async()=>{
  for(const id of ids){
    const args=await request(id),created=await start(args);
    assert.equal(created.duplicate,false);assert.equal(created.cpu_character_id,id);
    assert.equal((await db.query("select cpu_policy_version from public.fcg_rooms where id=$1",[created.room_id])).rows[0].cpu_policy_version,args[4]);
    const before=await rows(),retry=[...args];retry[2]=randomUUID();retry[4]=roster.PRE_SPLIT_POLICY_VERSIONS[id];
    const replay=await start(retry);assert.equal(replay.duplicate,true);assert.equal(replay.room_id,created.room_id);
    assert.deepEqual(await rows(),before);
  }
});

test("SQL fingerprint compatibility rejects all changed input fields without mutating game records",async()=>{
  const {args}=oldRequests.find(r=>r.args[3]==="rei");
  const changes=[
    {3:"ren",4:roster.CPU_CHARACTERS.ren.policyVersion},
    {5:"Changed name"},
    {6:JSON.stringify({...JSON.parse(args[6]),coins:1})},
    {7:JSON.stringify({...JSON.parse(args[7]),color:[...JSON.parse(args[7]).color].reverse()})},
    {8:"d".repeat(64)},
  ];
  for(const changeset of changes){
    const altered=[...args];for(const [index,value] of Object.entries(changeset))altered[Number(index)]=value;
    const before=await rows();await assert.rejects(()=>start(altered),e=>e.code==="23505");assert.deepEqual(await rows(),before);
  }
  for(const policy of [null,"invented",roster.CPU_CHARACTERS.ren.policyVersion]){
    const altered=[...args];altered[4]=policy;
    await assert.rejects(()=>start(altered),e=>e.code==="22023");
  }
});

test("retired Kurogane v1 cannot create new rooms but the migration preserves private permissions and real rate gate",async()=>{
  const args=await request("kurogane","legacy");args[4]=roster.KUROGANE_LEGACY_POLICY_VERSION;
  const before=await rows();await assert.rejects(()=>start(args),e=>e.code==="22023");assert.deepEqual(await rows(),before);
  for(const role of ["anon","authenticated"]){
    await assert.rejects(()=>asRole(role,()=>db.query(startSql,args)),e=>e.code==="42501");
    await assert.rejects(()=>asRole(role,()=>db.query("select fcg_private.fcg_standard_cpu_policy_is_supported('rei','standard-character-split-rescue-v1:rei')")),e=>e.code==="42501");
  }
  const valid=await request("rei");
  await db.query("insert into fcg_private.standard_matchmaking_limits(user_id,request_count,blocked_until) values($1,60,now()+interval '1 minute')",[valid[0]]);
  const beforeRate=await rows();await assert.rejects(()=>start(valid),e=>e.code==="54000");assert.deepEqual(await rows(),beforeRate);
});

test("unchanged 90-second fallback handles old/new claimed retries with the same owned room",async()=>{
  for(const generation of ["legacy","current"]){
    const args=await request("rei",generation);
    await db.query("insert into fcg_private.standard_matchmaking_tickets(ticket_id,user_id,display_name,profile_revision,state,created_at,expires_at) values($1,$2,'SQL fixture',1,'searching',now()-interval '91 seconds',now()+interval '10 minutes')",[args[1],args[0]]);
    const created=(await asRole("service_role",()=>db.query(acceptSql,args))).rows[0];
    const before=await rows(),retry=[...args];retry[2]=randomUUID();retry[4]=generation==="legacy"?roster.CPU_CHARACTERS.rei.policyVersion:roster.PRE_SPLIT_POLICY_VERSIONS.rei;
    const repeated=(await asRole("service_role",()=>db.query(acceptSql,retry))).rows[0];
    assert.equal(repeated.room_id,created.room_id);assert.deepEqual(await rows(),before);
  }
});

test("finished room rematch adopts the selected generation once; cross-rollout retry preserves result and identity",async()=>{
  for(const generation of ["legacy","current"]){
    const req=await request("rei","legacy"),created=await start(req);
    await db.query("update public.fcg_rooms set status='finished' where id=$1",[created.room_id]);
    const version=(await db.query("select version from public.fcg_rooms where id=$1",[created.room_id])).rows[0].version;
    const expected=generation==="current"?roster.CPU_CHARACTERS.rei.policyVersion:roster.PRE_SPLIT_POLICY_VERSIONS.rei;
    const args=[req[0],created.room_id,version,randomUUID(),req[3],expected,req[5],req[6],req[7],req[8]];
    const result=(await asRole("service_role",()=>db.query(rematchSql,args))).rows[0];assert.equal(result.duplicate,false);
    const saved=(await db.query("select cpu_policy_version,cpu_character_id,cpu_user_id from public.fcg_rooms where id=$1",[created.room_id])).rows[0];
    assert.equal(saved.cpu_policy_version,expected);assert.equal(saved.cpu_character_id,"rei");assert.equal(saved.cpu_user_id,req[2]);
    const before=await rows(),retry=[...args];retry[5]=generation==="current"?roster.PRE_SPLIT_POLICY_VERSIONS.rei:roster.CPU_CHARACTERS.rei.policyVersion;
    const duplicate=(await asRole("service_role",()=>db.query(rematchSql,retry))).rows[0];assert.equal(duplicate.duplicate,true);
    assert.deepEqual(await rows(),before);
  }
});
