"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createBudget,classify,parseSnapshot,validateGate,execute,CANDIDATE,REVIEW,ORIGIN,EDGE,SNAPSHOT,POLICY,LOADOUT}=require("../scripts/live-standard-cpu-split-canary.cjs");
const ROOM="12345678-1234-4321-8123-123456789012",ID="12345678-1234-4321-8123-123456789013",MATCH="private-match-identifier";
function fixture({first="B",failCpu=false,unknownSurrender=false,failFinalSnapshot=false,failFinalProfile=false,wrongPolicy=false}={}){
  let version=2,active=first,finished=false,profileReads=0;const calls=[];
  const snapshot=()=>({snapshot_schema_version:2,snapshot_version:version,
    room:{id:ROOM,status:finished?"finished":"playing",version,cpu_policy_version:wrongPolicy?"old-policy":POLICY,cpu_character_id:"rei",opponent_kind:"cpu",
      public_state:{status:finished?"FINISHED":"PLAYING",active,matchId:MATCH,...(finished?{winner:"B",terminalReason:"SURRENDER"}:{})}},
    view:{seat:"A",version,private_state:{secretHand:"do-not-log"}}});
  const fetchImpl=async(url,options)=>{
    assert.ok(url.startsWith(ORIGIN));assert.equal(options.method,"POST");assert.equal(options.redirect,"error");
    const endpoint=url.slice(ORIGIN.length),body=JSON.parse(options.body);calls.push({endpoint,body});
    let value={};
    if(endpoint==="/auth/v1/signup")value={access_token:"private-token"};
    else if(endpoint===SNAPSHOT){if(finished&&failFinalSnapshot)return new Response("private server error",{status:500});value=snapshot();}
    else if(body.operation==="profile"){
      profileReads++;if(profileReads>1&&failFinalProfile)return new Response("private profile error",{status:503});
      value={revision:finished?2:1,profileState:{cpuStats:{losses:finished?1:0},matchHistory:finished?[{matchId:MATCH,result:"LOSS",terminalReason:"SURRENDER",cpuCharacterId:"rei"}]:[]}};
    }else if(body.operation==="cpu-roster")value={cpuPolicyGeneration:"current",cpuPolicyCapabilities:["standard-character-split-rescue-v1"],characters:[{id:"rei",policyVersion:POLICY}]};
    else if(body.operation==="cpu-start")value={roomId:ROOM,startStatus:"created",opponentKind:"cpu",characterId:"rei"};
    else if(body.operation==="cpu-action"){if(failCpu)return new Response("private failure",{status:500});version++;active="A";}
    else if(body.operation==="action"){finished=true;version++;if(unknownSurrender)throw new Error("private connection message");}
    return new Response(JSON.stringify(value),{status:200});
  };
  return {fetchImpl,calls,snapshot};
}
test("hard budgets count attempts and cannot reset; final reads have reserved time",()=>{
  let time=0;const b=createBudget(()=>time);
  for(let i=0;i<8;i++)b.spend("cpu");assert.throws(()=>b.spend("cpu"),/OPERATION_BUDGET/);assert.equal(b.counts.cpu,8);
  b.spend("surrender");assert.throws(()=>b.spend("surrender"),/OPERATION_BUDGET/);assert.equal(b.counts.surrender,1);
  for(const k of ["signup","match","setup","initialize"]){b.spend(k);assert.throws(()=>b.spend(k));}
  time=155000;assert.throws(()=>b.remaining(),/DEADLINE/);assert.equal(b.remaining(true),85000);
  time=240000;assert.throws(()=>b.remaining(true),/DEADLINE/);
});
test("only own snapshot and exact narrow action categories are admitted",()=>{
  assert.equal(classify(SNAPSHOT,{p_room_id:ROOM,p_known_profile_revision:0},ROOM),"read");
  assert.equal(classify(SNAPSHOT,{p_room_id:ID,p_known_profile_revision:0},ROOM),null);
  for(const operation of ["gacha","quiz-start","cpu-rematch","cpu-accept","cosmetic-action","card-sale"])
    assert.equal(classify(EDGE,{operation,roomId:ROOM},ROOM),null);
  assert.equal(classify("/rest/v1/fcg_rooms",{},ROOM),null);
  assert.equal(classify(EDGE,{operation:"action",roomId:ROOM,action:{id:ID,expectedVersion:2,type:"SURRENDER",payload:{}}},ROOM),"surrender");
  assert.equal(classify(EDGE,{operation:"action",roomId:ROOM,action:{id:ID,expectedVersion:2,type:"CREATE",payload:{}}},ROOM),null);
  assert.equal(classify(EDGE,{operation:"setup",roomId:ROOM,expectedSetupRevision:0,setupActionId:ID,loadout:LOADOUT},ROOM),"setup");
});
test("snapshot verifies own membership version while discarding private information",()=>{
  const raw=fixture().snapshot(),view=parseSnapshot(raw,ROOM);assert.equal(view.policyMatches,true);
  assert.doesNotMatch(JSON.stringify(view),/secretHand|do-not-log/);
  for(const mutate of [x=>x.view.seat="B",x=>x.room.id=ID,x=>x.snapshot_version++,x=>delete x.view.private_state]){
    const copy=structuredClone(raw);mutate(copy);assert.throws(()=>parseSnapshot(copy,ROOM),/OWNED_SNAPSHOT/);
  }
});
test("one normal API smoke observes policy/CPU/terminal/profile independently and never exposes private data",async()=>{
  const f=fixture(),r=await execute({key:"public-fixture-key",fetchImpl:f.fetchImpl,uuid:()=>ID});
  assert.equal(r.ok,true);assert.equal(r.newPolicyOwnedRoom,"VERIFIED");assert.equal(r.cpuAction,"OBSERVED");
  assert.deepEqual(r.attemptCounts,{signup:1,match:1,setup:1,initialize:1,cpu:1,surrender:1});
  assert.equal(r.terminalRead,"FINISHED_VERIFIED");assert.equal(r.settlement,"ONCE_LOSS_SURRENDER_VERIFIED");
  assert.equal(r.console.state,"NOT_RUN");assert.equal(r.network.state,"ALLOWLIST_ONLY");
  assert.doesNotMatch(JSON.stringify(r),/private-token|secretHand|do-not-log|private-match-identifier|12345678-1234/);
  const surrender=f.calls.findIndex(x=>x.body.operation==="action");
  assert.ok(f.calls.slice(surrender+1).every(x=>x.endpoint===SNAPSHOT||x.body.operation==="profile"));
});
test("human first remains CPU NOT_OBSERVED without another room or artificial human move",async()=>{
  const f=fixture({first:"A"}),r=await execute({key:"key",fetchImpl:f.fetchImpl,uuid:()=>ID});
  assert.equal(r.ok,true);assert.equal(r.cpuAction,"NOT_OBSERVED");assert.equal(r.attemptCounts.cpu,0);
  assert.equal(r.attemptCounts.match,1);assert.equal(r.attemptCounts.signup,1);
});
test("failed CPU send consumes its attempt; final channels still run without retry",async()=>{
  const f=fixture({failCpu:true}),r=await execute({key:"key",fetchImpl:f.fetchImpl,uuid:()=>ID});
  assert.equal(r.ok,false);assert.equal(r.attemptCounts.cpu,1);assert.equal(r.cpuAction,"NOT_OBSERVED");
  assert.equal(r.terminalRead,"FINISHED_VERIFIED");assert.equal(r.profileRead,"READ_VERIFIED");
  assert.equal(r.settlement,"ONCE_LOSS_SURRENDER_VERIFIED");assert.equal(r.failures[0].code,"HTTP_500");
});
test("unknown surrender is never resent, even when final read confirms successful settlement",async()=>{
  const f=fixture({unknownSurrender:true}),r=await execute({key:"key",fetchImpl:f.fetchImpl,uuid:()=>ID});
  assert.equal(r.ok,false);assert.equal(r.surrenderAcknowledged,false);assert.equal(r.attemptCounts.surrender,1);
  assert.equal(r.terminalRead,"FINISHED_VERIFIED");assert.equal(r.settlement,"ONCE_LOSS_SURRENDER_VERIFIED");
  assert.doesNotMatch(JSON.stringify(r),/private connection/);
});
test("terminal failure never suppresses own profile and is UNKNOWN not budget or unfinished",async()=>{
  const f=fixture({failFinalSnapshot:true}),r=await execute({key:"key",fetchImpl:f.fetchImpl,uuid:()=>ID});
  assert.equal(r.ok,false);assert.equal(r.terminalRead,"FAILED_UNKNOWN");assert.equal(r.profileRead,"READ_VERIFIED");
  assert.equal(r.settlement,"ONCE_LOSS_SURRENDER_VERIFIED");assert.equal(r.withinDeadline,true);
  assert.equal(r.attemptCounts.surrender,1);assert.doesNotMatch(JSON.stringify(r),/private server error/);
});
test("profile failure never erases terminal result",async()=>{
  const f=fixture({failFinalProfile:true}),r=await execute({key:"key",fetchImpl:f.fetchImpl,uuid:()=>ID});
  assert.equal(r.ok,false);assert.equal(r.terminalRead,"FINISHED_VERIFIED");assert.equal(r.profileRead,"FAILED_UNKNOWN");
  assert.equal(r.settlement,"NOT_VERIFIED");
});
test("wrong saved room policy cannot masquerade as roster verification or CPU success",async()=>{
  const f=fixture({wrongPolicy:true}),r=await execute({key:"key",fetchImpl:f.fetchImpl,uuid:()=>ID});
  assert.equal(r.ok,false);assert.equal(r.newPolicyRoster,"VERIFIED");assert.equal(r.newPolicyOwnedRoom,"NOT_RUN");
  assert.equal(r.attemptCounts.cpu,0);assert.equal(r.terminalRead,"FINISHED_VERIFIED");
});
test("exact review source, fixed mutation sets and completed gates required before live",()=>{
  const d=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8"));
  d.coordination.preparing_next_slice=structuredClone(d.coordination.successor_goal.completed_independent_slices.find(s=>s.candidate_sha===CANDIDATE));
  const s=d.coordination.preparing_next_slice;s.live_canary_attempts=1;s.live_canary_state="RESERVED_BEFORE_EXECUTION";
  Object.assign(s.production_gates,{sql:"APPLIED_5_OF5_VERIFIED",compatible_edge:"DEPLOYED_BYTE_EXACT_LEGACY_VERIFIED",managed_activation:"CURRENT_VERIFIED_AFTER_460_SECONDS",main:"EXACT_SHA_PUBLISHED",pages:"SUCCESS_PREFLIGHT_BYTE_EXACT"});
  validateGate(d);
  for(const mutate of [x=>x.coordination.preparing_next_slice.candidate_sha="bad",x=>x.coordination.preparing_next_slice.live_canary_attempts=0,
    x=>x.coordination.preparing_next_slice.production_gates.pages="NOT_RUN",x=>x.decisions.find(r=>r.review_id===REVIEW).decision="APPROVE_DOCS",
    x=>x.decisions.find(r=>r.review_id===REVIEW).managed_setting_change_set=[],x=>x.coordination.preparing_next_slice.db_change_set=[]]){
    const c=structuredClone(d);mutate(c);assert.throws(()=>validateGate(c));
  }
  assert.equal(s.candidate_sha,CANDIDATE);
});

test("saved real smoke remains one-shot scoped evidence and cannot complete CPU overall or067",()=>{
  const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,"../docs",file),"utf8"));
  const raw=read("CPU_SPLIT_LIVE_20260913.json"),attempt=read("CPU_SPLIT_LIVE_20260913.attempt.json");
  assert.equal(raw.ok,true);assert.equal(raw.candidate,CANDIDATE);assert.equal(attempt.candidate,CANDIDATE);
  assert.equal(attempt.attempt,1);assert.equal(raw.elapsedMs,4040);assert.equal(raw.cpuAction,"OBSERVED");
  assert.deepEqual(raw.attemptCounts,{signup:1,match:1,setup:1,initialize:1,cpu:1,surrender:1});
  assert.equal(raw.network.requests.length,13);assert.ok(raw.network.requests.every(r=>r.allowed&&r.status===200));
  assert.equal(raw.terminalRead,"FINISHED_VERIFIED");assert.equal(raw.settlement,"ONCE_LOSS_SURRENDER_VERIFIED");
  assert.equal(raw.console.state,"NOT_RUN");assert.equal(raw.physicalDevices,"NOT_RUN");
  const c=read("CHATGPT_REVIEW_DECISIONS.json").coordination;
  assert.equal(c.successor_goal.completed_independent_slices.find(s=>s.candidate_sha===CANDIDATE).publication,"PUBLIC_VERIFIED_SCOPED");
  assert.notEqual(c.preparing_next_slice.candidate_sha,CANDIDATE,"consumed F3 trial is no longer the active candidate");
  assert.equal(c.successor_goal.publication,"F3_ONLY_PUBLIC_VERIFIED_OVERALL_INCOMPLETE");
  assert.equal(c.active_slice.state,"PAGES_PUBLISHED_LIVE_ACCEPTANCE_PARTIAL");
  assert.equal(read("SURRENDER_LIVE_20260913.json").ok,false);
  assert.match(fs.readFileSync(path.join(__dirname,"../scripts/live-standard-cpu-split-canary.cjs"),"utf8"),/fs\.openSync\(receipt,"wx"\)/);
});
