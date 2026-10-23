"use strict";
// Actual generated worker and isolated SQL; only fixture setup bypasses normal actions.
const assert=require("node:assert/strict"),test=require("node:test"),{randomUUID}=require("node:crypto");
const {createProgressionRuntime,api}=require("./helpers/cpu-progression-runtime.cjs");
const {plain}=require("./helpers/public-skill-fixture.cjs");
const {prepare,loadout}=require("./helpers/color-permutation-fixture.cjs");
let rt;test.before(async()=>{rt=await createProgressionRuntime();});test.after(async()=>{if(rt)await rt.close();});
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r));return r.body;};
async function persist(roomId,a) {
  const p=api.project(a.state);
  await rt.db.query("update fcg_private.authoritative_matches set version=$3,state=$2::jsonb where room_id=$1",[roomId,JSON.stringify(a),a.state.version]);
  await rt.db.query("update public.fcg_rooms set version=$3,public_state=$2::jsonb where id=$1",[roomId,JSON.stringify(p.publicState),a.state.version]);
  for(const [seat,value]of [["A",p.privateA],["B",p.privateB]])await rt.db.query("update public.fcg_player_views set version=$4,private_state=$3::jsonb where room_id=$1 and seat=$2",[roomId,seat,JSON.stringify(value),a.state.version]);
}
for(const skill of ["disruptColorSwap","disruptColorRotate"])test(`UDL011 permutation SQL ${skill}: ordinary inventory, atomic refusal, one-time consumption, resume and CPU`,async()=>{
  const owner=await rt.player(),w=rt.worker(owner),profile=(await rt.profile(owner)).profile_state;
  profile.inventory.disruptColorSwap=2;profile.inventory.disruptColorRotate=2;
  await rt.db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1",[owner,JSON.stringify(profile)]);
  const roomId=ok(await w.post({operation:"cpu-start",characterId:"ren",actionId:randomUUID(),confirmed:true})).roomId;
  ok(await w.post({operation:"setup",roomId,setupActionId:randomUUID(),expectedSetupRevision:0,loadout}));
  ok(await w.post({operation:"initialize",roomId}));
  const a=plain(await rt.authority(roomId)),s=prepare(a.state,skill);
  assert.equal(s.engineVersion,"5.0.0-alpha.6");assert.equal(s.hands.A[skill],1);
  await persist(roomId,a);
  const before=await rt.snapshot(owner,roomId),ids=skill==="disruptColorSwap"?["R1","R2"]:["R1","R2","R3"];
  const bad={operation:"action",roomId,action:{id:randomUUID(),expectedVersion:s.version,type:"USE_SKILL",payload:{skill,regionIds:ids.map(()=>"R1")}}};
  assert.notEqual((await w.post(bad)).status,200);assert.deepEqual(await rt.snapshot(owner,roomId),before);
  const request={operation:"action",roomId,action:{id:randomUUID(),expectedVersion:s.version,type:"USE_SKILL",payload:{skill,regionIds:ids}}};
  ok(await w.post(request));
  const after=await rt.snapshot(owner,roomId);
  assert.equal(after.profile.profile_state.inventory[skill],1);assert.equal(after.authority.state.hands.A[skill],0);
  assert.equal(after.authority.state.version,s.version+1);assert.equal(after.authority.state.active,"B");
  assert.equal(after.authority.state.interferenceLock,true);assert.deepEqual(after.authority.rngSnapshot,a.rngSnapshot);
  const expected=skill==="disruptColorSwap"?["blue","red","green"]:["green","red","blue"];
  assert.deepEqual(["R1","R2","R3"].map(id=>after.room.public_state.regions[id].color),expected);
  if(skill==="disruptColorRotate")assert.deepEqual(after.room.public_state.rotationUsedBy,["A"]);
  ok(await w.post(request));assert.deepEqual(await rt.snapshot(owner,roomId),after);
  const changed=structuredClone(request);changed.action.payload.regionIds.reverse();
  assert.notEqual((await w.post(changed)).status,200);assert.deepEqual(await rt.snapshot(owner,roomId),after);
  ok(await rt.worker(owner).post({operation:"cpu-action",roomId,expectedVersion:s.version+1}));
  const resumed=await rt.authority(roomId);
  assert.ok(resumed.state.version>s.version+1);assert.equal((await rt.profile(owner)).profile_state.inventory[skill],1);
  if(skill==="disruptColorRotate")assert.deepEqual(resumed.state.rotationUsedBy,["A"]);
});
