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
