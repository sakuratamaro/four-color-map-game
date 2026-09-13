"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createBudget,createAdmission,classify,parseSnapshot,validateGate,EDGE,SNAPSHOT,LOADOUT}=require("../scripts/live-standard-cutin-readability-guard.cjs");
const ROOM="12345678-1234-4321-8123-123456789012",ID="12345678-1234-4321-8123-123456789013";
test("new cut-in browser and API share attempted sends and immutable 150/240 second bounds",()=>{
 let now=0;const b=createBudget(()=>now);
 for(let i=0;i<8;i++)b.spend("cpu");assert.throws(()=>b.spend("cpu"),/OPERATION_BUDGET/);
 for(let i=0;i<6;i++)b.spend("own");assert.throws(()=>b.spend("own"),/OPERATION_BUDGET/);
 assert.throws(()=>{b.counts.cpu=0;},TypeError);assert.equal(b.counts.cpu,8);
 assert.throws(()=>b.spend("surrender"),/FINAL_PHASE_REQUIRED/);
 now=150000;assert.throws(()=>b.remaining(),/DEADLINE/);b.beginFinal();assert.equal(b.remaining(),90000);
 assert.throws(()=>b.spend("own"),/ORDINARY_PLAY_CLOSED/);
 assert.throws(()=>b.spend("cpu"),/ORDINARY_PLAY_CLOSED/);
 b.spend("surrender");assert.throws(()=>b.spend("surrender"),/OPERATION_BUDGET/);
 b.beginFinal();assert.equal(b.counts.surrender,1);now=240000;assert.throws(()=>b.remaining(),/DEADLINE/);
});
test("unknown outcomes still consume each one-shot admission",()=>{
 const b=createBudget(()=>0);
 for(const k of ["signup","profileSeed","match","setup","initialize"]){b.spend(k);assert.equal(b.counts[k],1);assert.throws(()=>b.spend(k),/OPERATION_BUDGET/);}
});
test("shared transport rejects a browser or API retry after an unknown outcome",()=>{
 const budget=createBudget(()=>0),admit=createAdmission(budget);
 const cpu={operation:"cpu-action",roomId:ROOM,expectedVersion:5};
 assert.equal(admit("POST",EDGE,cpu,ROOM),"cpu");
 assert.throws(()=>admit("POST",EDGE,cpu,ROOM),/NO_SEND_RETRY/);assert.equal(budget.counts.cpu,1);
 assert.equal(admit("POST",EDGE,{...cpu,expectedVersion:6},ROOM),"cpu");
 const own={operation:"action",roomId:ROOM,action:{id:ID,expectedVersion:7,type:"COLOR_REGION",payload:{}}};
 admit("POST",EDGE,own,ROOM);assert.throws(()=>admit("POST",EDGE,own,ROOM),/NO_SEND_RETRY/);
 assert.equal(budget.counts.own,1);
});
test("cut-in transport permits only current owned snapshot and narrow ordinary actions",()=>{
 assert.equal(classify("POST",SNAPSHOT,{p_room_id:ROOM,p_known_profile_revision:2},ROOM),"read");
 assert.equal(classify("POST",SNAPSHOT,{p_room_id:ID,p_known_profile_revision:0},ROOM),null);
 assert.equal(classify("POST",SNAPSHOT,{p_room_id:ROOM,p_known_profile_revision:0,seat:"B"},ROOM),null);
 for(const operation of ["cpu-rematch","cpu-accept","quiz-start","gacha","cosmetic-action","card-sale"])
  assert.equal(classify("POST",EDGE,{operation,roomId:ROOM},ROOM),null);
 assert.equal(classify("POST","/rest/v1/fcg_rooms",{},ROOM),null);
 const action=type=>({operation:"action",roomId:ROOM,action:{id:ID,expectedVersion:1,type,payload:{}}});
 assert.equal(classify("POST",EDGE,action("SURRENDER"),ROOM),"surrender");
 assert.equal(classify("POST",EDGE,action("COLOR_REGION"),ROOM),"own");
 assert.equal(classify("POST",EDGE,action("DEBUG"),ROOM),null);
 assert.equal(classify("POST",EDGE,{operation:"setup",roomId:ROOM,setupActionId:ID,expectedSetupRevision:0,loadout:LOADOUT},ROOM),"setup");
 assert.equal(classify("POST",EDGE,{operation:"setup",roomId:ROOM,setupActionId:ID,expectedSetupRevision:0,loadout:LOADOUT,debugMode:true},ROOM),null);
});
test("current snapshot-v2 is required; only own private state is passed to the ordinary planner",()=>{
 const raw={snapshot_schema_version:2,snapshot_version:3,profile_revision:1,members:[{user_id:ID,seat:"A",is_cpu:false},{user_id:ROOM,seat:"B",is_cpu:true}],
  room:{id:ROOM,status:"playing",game_mode:"standard_v5",version:3,cpu_character_id:"yuzu",opponent_kind:"cpu",public_state:{active:"A",status:"ACTIVE",version:3}},
  view:{seat:"A",version:3,private_state:{hand:{colorRandomBorrow:1}}},opponent_private_state:{secret:"never read"}};
 const r=parseSnapshot(raw,ROOM,ID);assert.equal(r.privateState.seat,"A");assert.equal(r.version,3);
 assert.doesNotMatch(JSON.stringify(r),/never read|opponent_private/);
 for(const mutate of [x=>x.view.seat="B",x=>x.room.id=ID,x=>x.snapshot_version++,x=>x.room.cpu_character_id="kurogane",x=>x.members=[],x=>x.members={},x=>x.members[0].is_cpu=true,x=>x.members[0].user_id=ROOM,x=>x.room.public_state.version++]){
  const x=structuredClone(raw);mutate(x);assert.throws(()=>parseSnapshot(x,ROOM,ID),/OWNED_SNAPSHOT_REQUIRED/);
 }
});
test("the current sent request and successful Windows gate are not live authorization",()=>{
 const doc=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8"));
 delete doc.coordination.remaining_brain_work.cutin_readability_preparation.live_canary_authorization;
 assert.throws(()=>validateGate(doc)); // a request/green CI never supplies missing explicit live authority
});
