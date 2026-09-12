"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {randomUUID,createHash}=require("node:crypto"),test=require("node:test");
const {createCpuSqlDatabase}=require("./helpers/cpu-sql-runtime.cjs");
const roster=require("../standard/standard-cpu-roster.js"),ids=Object.keys(roster.CPU_CHARACTERS);
const sandbox={console};sandbox.globalThis=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../supabase/functions/standard-game-action/standard-engine.bundle.js"),"utf8"),sandbox);
const api=sandbox.FourColorStandardServerEngine,plain=v=>JSON.parse(JSON.stringify(v));
const palette=id=>roster.PALETTE_EFFICIENCY_POLICY_VERSION+":"+id;
const generations=["legacy","current","palette"];
const names=["public.fcg_rooms","public.fcg_standard_profiles","public.fcg_room_members",
  "fcg_private.standard_cpu_profile_owners","fcg_private.standard_room_setups","fcg_private.standard_cpu_start_receipts"];
const startSql="select * from public.fcg_standard_server_start_cpu($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::jsonb,$8::jsonb,$9::text)";
const acceptSql="select * from public.fcg_standard_server_accept_cpu($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::jsonb,$8::jsonb,$9::text)";
const rematchSql="select * from public.fcg_standard_server_request_cpu_rematch($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::text,$6::text,$7::text,$8::jsonb,$9::jsonb,$10::text)";
let db,baseline,beforeRows,previousFunctions,oldSupported,oldRequests=[];
async function asRole(role,fn){
  assert.ok(["service_role","anon","authenticated"].includes(role));await db.exec("set role "+role);
  try{return await fn();}finally{await db.exec("reset role");}
}
async function rows(){
  const out={};
  for(const name of names)out[name]=(await db.query("select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from "+name+" t")).rows[0].rows;
  return out;
}
async function human(){
  const id=randomUUID(),profile=plain(api.createStarterProfile("SQL F1 fixture"));
  await db.query("insert into auth.users(id) values($1)",[id]);
  await db.query("insert into public.fcg_standard_profiles(user_id,revision,display_name,profile_state) values($1,1,$2,$3::jsonb)",[id,profile.displayName,JSON.stringify(profile)]);
  return id;
}
const selected=(id,generation)=>plain(api.createCpuProfile(id,{policyGeneration:generation}));
async function request(id,generation="palette"){
  const cpu=selected(id,generation);
  return [await human(),randomUUID(),randomUUID(),id,cpu.policyVersion,cpu.profile.displayName,JSON.stringify(cpu.profile),JSON.stringify(cpu.loadout),createHash("sha256").update(JSON.stringify(cpu.loadout)).digest("hex")];
}
const start=args=>asRole("service_role",async()=>(await db.query(startSql,args)).rows[0]);
async function functionDefinitions(){
  return (await db.query("select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('fcg_standard_server_accept_cpu','fcg_standard_server_request_cpu_rematch') order by proname")).rows;
}
test.before(async()=>{
  const state=await createCpuSqlDatabase({targetMigration:"202609130002_standard_cpu_palette_efficiency.sql"});
  db=state.db;baseline=state.baseline;
  for(const id of ids)for(const generation of ["legacy","current"]){
    const args=await request(id,generation),result=await start(args);oldRequests.push({args,result});
  }
  beforeRows=await rows();previousFunctions=await functionDefinitions();
  oldSupported=(await db.query("select fcg_private.fcg_standard_cpu_policy_is_supported('rei',$1) as supported",[palette("rei")])).rows[0].supported;
  await db.exec(state.migration);
});
test.after(async()=>{if(db)await db.close();});
test("F1 actual migration executes after F3, changing no saved old/split rows or accept/rematch definitions",async()=>{
  assert.ok(baseline.includes("202609130001_standard_cpu_split_rescue.sql"));assert.equal(oldSupported,false);
  assert.equal(oldRequests.length,20);assert.deepEqual(await rows(),beforeRows);
  assert.deepEqual(await functionDefinitions(),previousFunctions);
});
test("F1 exact read-only deployment SQL verifies all five source/ACL/policy/active-room checks",async()=>{
  const sql=fs.readFileSync(path.join(__dirname,"../supabase/verification/standard_cpu_palette_efficiency_verify.sql"),"utf8");
  assert.doesNotMatch(sql,/^\s*(?:insert|update|delete|drop|alter|create|grant|revoke|truncate|call|do)\b/im);
  const before=await rows(),checks=(await db.query(sql)).rows;
  assert.equal(checks.length,5);assert.deepEqual(checks.filter(row=>row.ok!==true),[]);
  assert.deepEqual(await rows(),before);
});
test("F1 real SQL exact identity matrix supports31/current30 while rejecting unknown/null/cross-character",async()=>{
  let supported=0,current=0;
  for(const id of ids){
    const valid=generations.map(generation=>selected(id,generation).policyVersion);
    if(id==="kurogane")valid.push(roster.KUROGANE_LEGACY_POLICY_VERSION);
    const invalid=[null,"","invented",palette(id==="rei"?"ren":"rei"),"standard-character-palette-efficiency-v2:"+id];
    for(const version of [...valid,...invalid]){
      const row=(await db.query("select fcg_private.fcg_standard_cpu_policy_is_supported($1,$2) as supported,fcg_private.fcg_standard_cpu_policy_is_current($1,$2) as current",[id,version])).rows[0];
      assert.equal(row.supported,valid.includes(version),id+"/"+version);
      assert.equal(row.current,valid.includes(version)&&version!==roster.KUROGANE_LEGACY_POLICY_VERSION,id+"/"+version);
      if(row.supported)supported++;if(row.current)current++;
    }
  }
  assert.equal(supported,31);assert.equal(current,30);
  for(const id of [null,"","invented"]){
    const row=(await db.query("select fcg_private.fcg_standard_cpu_policy_is_supported($1,$2) as supported,fcg_private.fcg_standard_cpu_policy_is_current($1,$2) as current",[id,palette("rei")])).rows[0];
    assert.deepEqual(row,{supported:false,current:false});
  }
});
test("twenty preexisting old/split receipts replay across F1 activation with no duplicate records or saved-policy rewrite",async()=>{
  for(const {args,result} of oldRequests){
    const before=await rows(),retry=[...args];retry[2]=randomUUID();retry[4]=palette(args[3]);
    const replay=await start(retry);assert.equal(replay.duplicate,true);assert.equal(replay.room_id,result.room_id);
    assert.deepEqual(await rows(),before);
    assert.equal((await db.query("select cpu_policy_version from public.fcg_rooms where id=$1",[result.room_id])).rows[0].cpu_policy_version,args[4]);
  }
});
test("ten F1 policies start once and replay in reverse through both saved old generations",async()=>{
  for(const id of ids){
    const args=await request(id),created=await start(args);assert.equal(created.duplicate,false);assert.equal(created.cpu_character_id,id);
    assert.equal((await db.query("select cpu_policy_version from public.fcg_rooms where id=$1",[created.room_id])).rows[0].cpu_policy_version,palette(id));
    for(const generation of ["legacy","current"]){
      const before=await rows(),retry=[...args];retry[2]=randomUUID();retry[4]=selected(id,generation).policyVersion;
      const replay=await start(retry);assert.equal(replay.duplicate,true);assert.equal(replay.room_id,created.room_id);
      assert.deepEqual(await rows(),before);
    }
  }
});
test("F1 fingerprint overlap still rejects changed identity/name/profile/loadout/hash with no game mutation",async()=>{
  const {args}=oldRequests.find(row=>row.args[3]==="rei");
  const changes=[
    {3:"ren",4:palette("ren")},{5:"Changed name"},{6:JSON.stringify({...JSON.parse(args[6]),coins:1})},
    {7:JSON.stringify({...JSON.parse(args[7]),color:[...JSON.parse(args[7]).color].reverse()})},{8:"d".repeat(64)}
  ];
  for(const delta of changes){
    const altered=[...args];altered[4]=palette("rei");
    for(const [index,value] of Object.entries(delta))altered[Number(index)]=value;
    const before=await rows();await assert.rejects(()=>start(altered),e=>e.code==="23505");assert.deepEqual(await rows(),before);
  }
  for(const version of [null,"invented",palette("ren")]){
    const altered=[...args];altered[4]=version;const before=await rows();
    await assert.rejects(()=>start(altered),e=>e.code==="22023");assert.deepEqual(await rows(),before);
  }
});
test("F1 preserves real rate gate and private permissions; retired Kurogane v1 cannot create",async()=>{
  const args=await request("kurogane");args[4]=roster.KUROGANE_LEGACY_POLICY_VERSION;
  const before=await rows();await assert.rejects(()=>start(args),e=>e.code==="22023");assert.deepEqual(await rows(),before);
  for(const role of ["anon","authenticated"]){
    await assert.rejects(()=>asRole(role,()=>db.query(startSql,args)),e=>e.code==="42501");
    await assert.rejects(()=>asRole(role,()=>db.query("select fcg_private.fcg_standard_cpu_policy_is_supported('rei',$1)",[palette("rei")])),e=>e.code==="42501");
  }
  const valid=await request("rei");
  await db.query("insert into fcg_private.standard_matchmaking_limits(user_id,request_count,blocked_until) values($1,60,now()+interval '1 minute')",[valid[0]]);
  const beforeRate=await rows();await assert.rejects(()=>start(valid),e=>e.code==="54000");assert.deepEqual(await rows(),beforeRate);
});
test("unchanged fallback accepts each generation and replays other generations through its original owned room",async()=>{
  for(const generation of generations){
    const args=await request("rei",generation);
    await db.query("insert into fcg_private.standard_matchmaking_tickets(ticket_id,user_id,display_name,profile_revision,state,created_at,expires_at) values($1,$2,'SQL F1 fixture',1,'searching',now()-interval '91 seconds',now()+interval '10 minutes')",[args[1],args[0]]);
    const created=(await asRole("service_role",()=>db.query(acceptSql,args))).rows[0];
    for(const retryGeneration of generations.filter(g=>g!==generation)){
      const before=await rows(),retry=[...args];retry[2]=randomUUID();retry[4]=selected("rei",retryGeneration).policyVersion;
      const repeated=(await asRole("service_role",()=>db.query(acceptSql,retry))).rows[0];
      assert.equal(repeated.room_id,created.room_id);assert.deepEqual(await rows(),before);
    }
  }
});
test("finished-room rematch selects each generation once; cross-generation replay preserves identity and result",async()=>{
  for(const generation of generations){
    const req=await request("rei","current"),created=await start(req);
    await db.query("update public.fcg_rooms set status='finished' where id=$1",[created.room_id]);
    const version=(await db.query("select version from public.fcg_rooms where id=$1",[created.room_id])).rows[0].version;
    const expected=selected("rei",generation).policyVersion;
    const args=[req[0],created.room_id,version,randomUUID(),req[3],expected,req[5],req[6],req[7],req[8]];
    const result=(await asRole("service_role",()=>db.query(rematchSql,args))).rows[0];assert.equal(result.duplicate,false);
    const saved=(await db.query("select cpu_policy_version,cpu_character_id,cpu_user_id from public.fcg_rooms where id=$1",[created.room_id])).rows[0];
    assert.deepEqual(saved,{cpu_policy_version:expected,cpu_character_id:"rei",cpu_user_id:req[2]});
    for(const retryGeneration of generations.filter(g=>g!==generation)){
      const before=await rows(),retry=[...args];retry[5]=selected("rei",retryGeneration).policyVersion;
      const duplicate=(await asRole("service_role",()=>db.query(rematchSql,retry))).rows[0];assert.equal(duplicate.duplicate,true);
      assert.deepEqual(await rows(),before);
    }
  }
});
