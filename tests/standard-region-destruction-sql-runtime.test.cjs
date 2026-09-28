"use strict";
// Isolated actual worker + SQL. No production URLs, users or mutations.
const assert=require("node:assert/strict"),test=require("node:test");
const {randomUUID}=require("node:crypto");
const {createProgressionRuntime,api}=require("./helpers/cpu-progression-runtime.cjs");
const {plain}=require("./helpers/public-skill-fixture.cjs");
const micro=m=>Array.from({length:16},(_,i)=>(Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4);
let rt;test.before(async()=>{rt=await createProgressionRuntime();});test.after(async()=>{if(rt)await rt.close();});
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r));return r.body;};
async function persist(roomId,a) {
  const p=api.project(a.state);
  await rt.db.query("update fcg_private.authoritative_matches set version=$3,state=$2::jsonb where room_id=$1",[roomId,JSON.stringify(a),a.state.version]);
  await rt.db.query("update public.fcg_rooms set version=$3,public_state=$2::jsonb where id=$1",[roomId,JSON.stringify(p.publicState),a.state.version]);
  for(const [seat,value] of [["A",p.privateA],["B",p.privateB]]) await rt.db.query("update public.fcg_player_views set version=$4,private_state=$3::jsonb where room_id=$1 and seat=$2",[roomId,seat,JSON.stringify(value),a.state.version]);
}
for(const id of ["colorCancelRegion","disruptDemolish"]) test(`UDL011 destruction SQL ${id}: ordinary inventory/start, consume once, replay and resume`,async()=>{
  const owner=await rt.player(), w=rt.worker(owner), profile=(await rt.profile(owner)).profile_state;
  profile.inventory[id]=2;
  await rt.db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1",[owner,JSON.stringify(profile)]);
  const loadout={color:[id==="colorCancelRegion"?id:"colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:[id==="disruptDemolish"?id:"disruptRandomOne","disruptChoiceOne"]};
  const roomId=ok(await w.post({operation:"cpu-start",characterId:"ren",actionId:randomUUID(),confirmed:true})).roomId;
  ok(await w.post({operation:"setup",roomId,setupActionId:randomUUID(),expectedSetupRevision:0,loadout}));
  ok(await w.post({operation:"initialize",roomId}));
  let a=plain(await rt.authority(roomId)), s=a.state;
  assert.equal(s.engineVersion,"5.0.0-alpha.6");assert.equal(s.hands.A[id],1);
  Object.assign(s,{active:"A",phase:"WORK",pending:null,reserved:null,preparedOutgoing:null,requiredSize:1,baseRequiredSize:1,rolledSize:1,skillCategoryWindow:{actor:"A",categories:[]},regions:{},lastPublicTrace:null});
  s.basicPalettes.A=["red","blue"];
  if(id==="disruptDemolish") s.regions.R1={id:"R1",micro:micro(13),sourceMacros:[13],controllers:["B"],color:"green",isPending:false};
  else {
    s.active="B";s.skillCategoryWindow.actor="B";
    const created=plain(api.apply({...a,actor:"B",expectedVersion:s.version,action:{type:"CREATE_REGION",payload:{sourceMacros:[13]}}}));
    assert.equal(created.ok,true);a={state:created.state,rngSnapshot:created.rngSnapshot};s=a.state;
  }
  await persist(roomId,a);
  const payload=id==="disruptDemolish"?{skill:id,regionId:"R1"}:{skill:id};
  const request={operation:"action",roomId,action:{id:randomUUID(),expectedVersion:s.version,type:"USE_SKILL",payload}};
  ok(await w.post(request));
  const after=await rt.snapshot(owner,roomId);assert.equal(after.profile.profile_state.inventory[id],1);
  assert.equal(after.authority.state.hands.A[id],0);assert.equal(after.authority.state.version,s.version+1);
  ok(await w.post(request));assert.deepEqual(await rt.snapshot(owner,roomId),after);
  const changed=structuredClone(request);changed.action.payload={skill:"colorPrism"};
  assert.notEqual((await w.post(changed)).status,200);assert.deepEqual(await rt.snapshot(owner,roomId),after);
  if(id==="colorCancelRegion") {
    assert.equal(after.authority.state.redesignation.stage,"RESELECT");
    assert.deepEqual(after.room.public_state.redesignation,after.authority.state.redesignation);
    ok(await rt.worker(owner).post({operation:"cpu-action",roomId,expectedVersion:s.version+1}));
    const resent=await rt.authority(roomId);assert.equal(resent.state.redesignation.stage,"COLOR");
    assert.deepEqual(resent.state.skillCategoryWindow,{actor:"A",categories:["color"]});
    assert.notDeepEqual(resent.state.regions[resent.state.pending].sourceMacros,[13]);
    assert.equal(resent.state.turn,s.turn);assert.deepEqual(resent.rngSnapshot,a.rngSnapshot);
    ok(await rt.worker(owner).post({operation:"action",roomId,action:{id:randomUUID(),expectedVersion:resent.state.version,type:"COLOR_REGION",payload:{color:"red"}}}));
    const painted=await rt.authority(roomId);assert.equal(painted.state.phase,"WORK");assert.equal(painted.state.redesignation,undefined);
  } else {
    assert.deepEqual(after.authority.state.regions,{});
    ok(await rt.worker(owner).post({operation:"action",roomId,action:{id:randomUUID(),expectedVersion:s.version+1,type:"CREATE_REGION",payload:{sourceMacros:[13]}}}));
  }
  assert.equal((await rt.profile(owner)).profile_state.inventory[id],1);
});
