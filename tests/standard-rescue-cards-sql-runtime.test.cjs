"use strict";
// Actual worker and isolated SQL/WASM only. No production URL or profile is used.
const assert=require("node:assert/strict"), test=require("node:test"), fs=require("node:fs"), path=require("node:path");
const {randomUUID}=require("node:crypto");
const {createProgressionRuntime,api}=require("./helpers/cpu-progression-runtime.cjs");
const {plain,root}=require("./helpers/public-skill-fixture.cjs");
let rt;
test.before(async()=>{rt=await createProgressionRuntime();await rt.db.exec(fs.readFileSync(path.join(root,"supabase/migrations/202609260001_standard_split_keep_compat.sql"),"utf8"));});
test.after(async()=>{if(rt)await rt.close();});
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r));return r.body;};
for(const id of ["colorUnsealOne","colorBonusRefillUnseal"]) test(`UDL011 rescue SQL ${id}: ordinary start, one inventory consumption, replay, resumed paint`,async()=>{
  const owner=await rt.player(), w=rt.worker(owner), profile=(await rt.profile(owner)).profile_state;
  profile.inventory[id]=2;
  await rt.db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1",[owner,JSON.stringify(profile)]);
  const loadout={color:[id,"colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};
  const roomId=ok(await w.post({operation:"cpu-start",characterId:"ren",actionId:randomUUID(),confirmed:true})).roomId;
  ok(await w.post({operation:"setup",roomId,setupActionId:randomUUID(),expectedSetupRevision:0,loadout}));
  ok(await w.post({operation:"initialize",roomId}));
  const a=plain(await rt.authority(roomId)), s=a.state;
  assert.equal(s.engineVersion,"5.0.0-alpha.6"); assert.equal(s.hands.A[id],1); assert.equal(s.hands.B[id],undefined);
  assert.deepEqual(s.techniques,{A:null,B:null});
  // Deterministic local setup. The actual skill, profile commit, retry and paint use worker+SQL.
  Object.assign(s,{active:"A",phase:"COLOR",pending:"R1",reserved:null,skillCategoryWindow:{actor:"A",categories:[]},
    regions:{R1:{id:"R1",micro:Array.from({length:16},(_,i)=>(4+Math.floor(i/4))*48+4+i%4),sourceMacros:[13],controllers:["B"],color:null,isPending:true}}});
  s.basicPalettes.A=["red","blue"];s.bonusColors.A="green";s.bonusUsesRemaining.A=0;s.publicEffects.A.seals={red:2,green:2};
  const p=api.project(s);
  await rt.db.query("update fcg_private.authoritative_matches set state=$2::jsonb where room_id=$1",[roomId,JSON.stringify(a)]);
  await rt.db.query("update public.fcg_rooms set public_state=$2::jsonb where id=$1",[roomId,JSON.stringify(p.publicState)]);
  for(const [seat,value] of [["A",p.privateA],["B",p.privateB]]) await rt.db.query("update public.fcg_player_views set private_state=$3::jsonb where room_id=$1 and seat=$2",[roomId,seat,JSON.stringify(value)]);
  const payload=id==="colorUnsealOne"?{skill:id,color:"red"}:{skill:id};
  const request={operation:"action",roomId,action:{id:randomUUID(),expectedVersion:s.version,type:"USE_SKILL",payload}};
  ok(await w.post(request));
  const after=await rt.snapshot(owner,roomId);
  assert.equal(after.profile.profile_state.inventory[id],1);assert.equal(after.authority.state.hands.A[id],0);
  assert.deepEqual(after.authority.state.techniques,{A:null,B:null});
  assert.equal(after.authority.state.version,s.version+1);
  const color=id==="colorUnsealOne"?"red":"green";
  assert.equal(after.authority.state.publicEffects.A.seals[color],0);
  assert.equal(after.authority.state.bonusUsesRemaining.A,id==="colorUnsealOne"?0:1);
  ok(await w.post(request));assert.deepEqual(await rt.snapshot(owner,roomId),after);
  const changed=structuredClone(request);changed.action.payload={skill:"colorPrism"};
  assert.notEqual((await w.post(changed)).status,200);assert.deepEqual(await rt.snapshot(owner,roomId),after);
  ok(await rt.worker(owner).post({operation:"action",roomId,action:{id:randomUUID(),expectedVersion:s.version+1,type:"COLOR_REGION",payload:{color}}}));
  const end=await rt.authority(roomId);
  assert.equal(end.state.phase,"WORK");assert.equal(end.state.regions.R1.color,color);assert.equal(end.state.bonusUsesRemaining.A,0);
  assert.equal((await rt.profile(owner)).profile_state.inventory[id],1);
});
