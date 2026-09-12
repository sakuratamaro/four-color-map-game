"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createBudget,browserPolicy,terminal,settlement,finalAudits,parseOptions}=require("../scripts/live-standard-surrender-canary.cjs");
const action=()=>({operation:"action",roomId:"owned",action:{id:"11111111-1111-4111-8111-111111111111",expectedVersion:3,type:"SURRENDER",payload:{}}});
test("067 one attempt and both deadlines include cleanup without reset",()=>{
  let now=1000;const b=createBudget(()=>now);
  b.spend("profiles");b.spend("matches");
  assert.throws(()=>b.spend("profiles"),/OPERATION_BUDGET/);assert.throws(()=>b.spend("matches"),/OPERATION_BUDGET/);
  now+=155_000;assert.throws(()=>b.remaining(),/DEADLINE/);assert.equal(b.remaining(true),85_000);
  b.spend("cpu",null,true);now=241_000;assert.throws(()=>b.spend("cpu",null,true),/DEADLINE/);
  assert.equal(b.counts.cpu,1);
});
test("067 CPU budget is six total including cleanup; third surrender cannot be sent",()=>{
  const b=createBudget(()=>0);
  for(let i=0;i<6;i++)b.spend("cpu",null,i>2);
  assert.throws(()=>b.spend("cpu",null,true),/OPERATION_BUDGET/);
  const a=action();b.spend("surrender",a);b.spend("surrender",structuredClone(a),true);
  assert.throws(()=>b.spend("surrender",a,true),/OPERATION_BUDGET/);
});
test("067 unknown-result retry preserves complete envelope, not only action ID",()=>{
  for(const change of [a=>a.action.expectedVersion++,a=>a.roomId="different",a=>a.action.payload={other:true},a=>a.action.id="22222222-2222-4222-8222-222222222222"]){
    const b=createBudget(()=>0),a=action();b.spend("surrender",a);change(a);
    assert.throws(()=>b.spend("surrender",a,true));assert.equal(b.counts.surrender,1);
    const copy=b.getEnvelope();copy.action.expectedVersion=999;assert.equal(b.getEnvelope().action.expectedVersion,3);
  }
  assert.throws(()=>createBudget(()=>0).spend("surrender",{...action(),action:{...action().action,type:"USE_SKILL"}}));
});
test("067 browser allows only owned initialize/CPU/surrender and existing read-only operations",()=>{
  const endpoint="/functions/v1/standard-game-action";
  for(const [body,expected] of [[{operation:"initialize",roomId:"owned"},"read"],[{operation:"cpu-action",roomId:"owned"},"cpu"],[action(),"surrender"],
    [{operation:"cosmetic-catalog"},"read"],[{operation:"profile"},null],[{operation:"gacha"},null],[{operation:"cpu-start"},null],
    [{operation:"action",roomId:"owned",action:{type:"USE_SKILL"}},null],[{operation:"cpu-action",roomId:"other"},null]]){
    assert.equal(browserPolicy("POST",endpoint,body,"owned"),expected);
  }
  assert.equal(browserPolicy("POST","/auth/v1/signup",{},"owned"),null);
  assert.equal(browserPolicy("POST","/rest/v1/rpc/fcg_standard_room_snapshot_v2",{p_room_id:"owned"},"owned"),"read");
  assert.equal(browserPolicy("POST","/rest/v1/rpc/fcg_standard_room_snapshot_v2",{p_room_id:"other"},"owned"),null);
});
test("067 normal defeat may change profile but must settle once for the owned match",()=>{
  const before={revision:2,profileState:{cpuStats:{losses:0},matchHistory:[]}};
  const after={revision:3,profileState:{cpuStats:{losses:1},matchHistory:[{matchId:"match",result:"LOSS",terminalReason:"SURRENDER",cpuCharacterId:"rei"}]}};
  assert.equal(settlement(after,before,"match"),true);
  assert.equal(settlement(after,before,"other"),false);
  after.profileState.matchHistory.push({...after.profileState.matchHistory[0]});assert.equal(settlement(after,before,"match"),false);
});
test("067 independent audits survive UI failure and cleanup cannot convert failure into acceptance",()=>{
  const b=createBudget(()=>0);b.spend("profiles");b.spend("matches");b.spend("surrender",action(),true);
  const room={status:"finished",publicState:{status:"FINISHED",winner:"B",terminalReason:"SURRENDER"}};
  assert.equal(terminal(room),true);
  const checks=finalAudits({budget:b,room,affirmed:false,settled:true,withinDeadline:true,errors:1});
  assert.deepEqual(checks.map(x=>x.passed),[true,false,true,false,true]);
});
test("067 command guard refuses missing opt-in, duplicate flags and paths outside canonical docs",()=>{
  for(const args of [[],["--confirm-live"],["--confirm-live","--candidate="+"a".repeat(40),"--report=../outside.json"],
    ["--confirm-live","--candidate="+"a".repeat(40),"--report=docs/never-run.json","--confirm-live"]])assert.throws(()=>parseOptions(args));
});
test("067 harness does not clear its hard deadline before independent final checks",()=>{
  const source=fs.readFileSync(path.join(__dirname,"../scripts/live-standard-surrender-canary.cjs"),"utf8");
  assert.ok(source.indexOf("await refresh();",source.indexOf("// Read terminal status first"))<source.indexOf("if(!terminal(room))"));
  assert.ok(source.indexOf("report.finalChecks=finalAudits")<source.indexOf("clearTimeout(deadlineTimer)"));
  assert.match(source,/budget.getEnvelope\(\)\|\|/);
  assert.match(source,/flag:"wx"/);
  assert.equal(source.includes("cleaning?AbortSignal.timeout"),false);
});
test("034 missing width or unreadable dialog cannot satisfy the supplemented acceptance",()=>{
  const {layoutReadable}=require("../scripts/live-standard-surrender-canary.cjs");
  const layout={fit:true,noOverflow:true,safeFocus:true,text:["surrenderTitle","surrenderSpeaker","surrenderDescription"].map(id=>({
    id,inside:true,visible:true,font:16,noOverflow:true})),targets:[{inside:true,hit:true,width:100,height:44},{inside:true,hit:true,width:100,height:44}]};
  assert.equal(layoutReadable(layout),true);
  for(const change of [l=>l.fit=false,l=>l.noOverflow=false,l=>l.safeFocus=false,
    l=>l.text.pop(),l=>l.text[2].font=10,l=>l.text[1].noOverflow=false,l=>l.targets[0].hit=false,l=>l.targets[1].height=43]){
    const bad=structuredClone(layout);change(bad);assert.equal(layoutReadable(bad),false);
  }
});
test("034 reload compares the settled baseline, rejecting extra sends and double settlement",()=>{
  const {reloadUnchanged}=require("../scripts/live-standard-surrender-canary.cjs");
  const room={status:"finished",version:9,publicState:{status:"FINISHED",winner:"B",terminalReason:"SURRENDER"}};
  const profile={revision:3,profileState:{cpuStats:{losses:1},matchHistory:[{result:"LOSS"}]}};
  const evidence={room,beforeRoom:structuredClone(room),profile,beforeProfile:structuredClone(profile),sends:1,beforeSends:1};
  assert.equal(reloadUnchanged(evidence),true);
  for(const change of [v=>v.sends++,v=>v.room.version++,v=>v.room.publicState.winner="A",
    v=>v.profile.revision++,v=>v.profile.profileState.cpuStats.losses++,v=>v.profile.profileState.matchHistory.push({result:"LOSS"})]){
    const bad=structuredClone(evidence);change(bad);assert.equal(reloadUnchanged(bad),false);
  }
});
test("034 supplemented harness uses both widths, actual reload, settled baseline and fixed original work deadline",()=>{
  const s=fs.readFileSync(path.join(__dirname,"../scripts/live-standard-surrender-canary.cjs"),"utf8");
  assert.match(s,/const width=cancel==="Escape"\?1280:390/);
  assert.match(s,/await page\.reload\(\{waitUntil:"domcontentloaded",timeout:20_000\}\)/);
  assert.match(s,/await bounded\("terminal-reload",restoreFinishedPage\(page\),25_000\)/);
  assert.match(s,/settledProfile=structuredClone\(afterProfile\)/);
  assert.ok(s.indexOf('report.reload="PASS"')>s.indexOf('reloadUnchanged({'));
  assert.match(s,/workDeadline=started\+155_000/);
});
test("067 finished room is read through authenticated snapshot-v2, never initialize",async()=>{
  const {readOwnedRoom}=require("../scripts/live-standard-surrender-canary.cjs");
  for(const status of ["playing","finished"]) {
    const snapshot={snapshot_schema_version:2,snapshot_version:7,room:{id:"owned",version:7,status,
      public_state:{status:status==="finished"?"FINISHED":"ACTIVE"}},view:{seat:"A",version:7,private_state:{hand:{}}}};
    let calls=0;
    const room=await readOwnedRoom(async(endpoint,body)=>{
      calls++;assert.equal(endpoint,"/rest/v1/rpc/fcg_standard_room_snapshot_v2");
      assert.deepEqual(body,{p_room_id:"owned",p_known_profile_revision:0});return snapshot;
    },"owned");
    assert.equal(calls,1);assert.equal(room.status,status);assert.deepEqual(room.privateState,{hand:{}});
  }
});
test("067 snapshot projection rejects another room/seat, stale view, unknown schema or missing authority",async()=>{
  const {readOwnedRoom}=require("../scripts/live-standard-surrender-canary.cjs");
  const snapshot={snapshot_schema_version:2,snapshot_version:7,room:{id:"owned",version:7,status:"finished",
    public_state:{status:"FINISHED"}},view:{seat:"A",version:7,private_state:{hand:{}}}};
  for(const change of [s=>s.room.id="other",s=>s.view.seat="B",s=>s.view.version=6,s=>s.snapshot_schema_version=1,
    s=>s.room.public_state=null,s=>s.view.private_state=null,s=>s.room.version=6,s=>s.room.status="waiting"]) {
    const bad=structuredClone(snapshot);change(bad);await assert.rejects(readOwnedRoom(async()=>bad,"owned"),/OWNED_SNAPSHOT_REQUIRED/);
  }
});
test("067 terminal-read contract regression stays separated from the already-recorded failed live result",()=>{
  const product=fs.readFileSync(path.resolve(__dirname,"../../surrender-confirmation-20260913/supabase/functions/standard-game-action/index.ts"),"utf8");
  assert.match(product,/operation === "initialize"[\s\S]*?room\.room_status !== "ready" && room\.room_status !== "playing"[\s\S]*?ROOM_NOT_READY/);
  const harness=fs.readFileSync(path.join(__dirname,"../scripts/live-standard-surrender-canary.cjs"),"utf8");
  assert.match(harness,/const refresh=async\(\)=>room=await readOwnedRoom\(request,roomId\)/);
  assert.equal((harness.match(/await edge\(\{operation:"initialize",roomId\}\)/g)||[]).length,1);
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/SURRENDER_LIVE_20260913.json"),"utf8"));
  assert.equal(raw.ok,false);assert.equal(raw.reload,"NOT_RUN");assert.equal(raw.counts.profiles,1);
});
