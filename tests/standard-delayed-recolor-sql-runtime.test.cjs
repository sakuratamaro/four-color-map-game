"use strict";
// Actual candidate worker/SQL, isolated database only. Initial board and profile
// fixture is injected explicitly; none of this is production-canary evidence.
const test=require("node:test"),assert=require("node:assert/strict"),{randomUUID}=require("node:crypto");
const {createProgressionRuntime,api}=require("./helpers/cpu-progression-runtime.cjs");
const {plain}=require("./helpers/public-skill-fixture.cjs");
const ID="disruptDelayedRecolor",loadout={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:[ID,"disruptChoiceOne"]};
const micro=m=>Array.from({length:16},(_,i)=>(Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4);
let rt;test.before(async()=>{rt=await createProgressionRuntime();});test.after(async()=>{if(rt)await rt.close();});
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r));return r.body;};
async function authQuery(user,sql,args){
 await rt.db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await rt.db.exec("set role authenticated");
 try{return (await rt.db.query(sql,args)).rows;}finally{await rt.db.exec("reset role");await rt.db.query("select set_config('request.jwt.claim.sub','',false)");}
}
async function pair(){
 const users={A:await rt.player(),B:await rt.player()},workers={A:rt.worker(users.A),B:rt.worker(users.B)};
 for(const id of Object.values(users)){
  const p=(await rt.profile(id)).profile_state;p.inventory[ID]=2;
  await rt.db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1",[id,JSON.stringify(p)]);
 }
 const [room]=await authQuery(users.A,"select * from public.fcg_standard_create_room($1)",["Delay A"]);
 await authQuery(users.B,"select * from public.fcg_standard_join_room($1,$2)",[room.room_code,"Delay B"]);
 for(const seat of ["A","B"])ok(await workers[seat].post({operation:"setup",roomId:room.room_id,setupActionId:randomUUID(),expectedSetupRevision:0,loadout}));
 ok(await workers.A.post({operation:"initialize",roomId:room.room_id}));
 const a=plain(await rt.authority(room.room_id)),s=a.state;
 assert.equal(s.engineVersion,"5.0.0-alpha.6");
 Object.assign(s,{active:"A",phase:"WORK",pending:null,reserved:null,preparedOutgoing:null,requiredSize:1,rolledSize:1,baseRequiredSize:1,skillCategoryWindow:{actor:"A",categories:[]},lastPublicTrace:null,
  regions:{R1:{id:"R1",micro:micro(13),sourceMacros:[13],controllers:["B"],color:"red",isPending:false}}});
 s.basicPalettes.A=["blue","yellow"];s.basicPalettes.B=["blue","yellow"];
 const p=api.project(s);
 await rt.db.query("update fcg_private.authoritative_matches set version=$3,state=$2::jsonb where room_id=$1",[room.room_id,JSON.stringify(a),s.version]);
 await rt.db.query("update public.fcg_rooms set version=$3,public_state=$2::jsonb where id=$1",[room.room_id,JSON.stringify(p.publicState),s.version]);
 for(const [seat,value]of [["A",p.privateA],["B",p.privateB]])await rt.db.query("update public.fcg_player_views set version=$4,private_state=$3::jsonb where room_id=$1 and seat=$2",[room.room_id,seat,JSON.stringify(value),s.version]);
 async function action(seat,type,payload){const state=(await rt.authority(room.room_id)).state;
  const request={operation:"action",roomId:room.room_id,action:{id:randomUUID(),expectedVersion:state.version,type,payload}};
  ok(await workers[seat].post(request));return request;}
 return {users,workers,roomId:room.room_id,action};
}
test("UDL011 delayed SQL: normal inventory, one reservation/trigger, replay, altered replay and reload",async()=>{
 const f=await pair(),request=await f.action("A","USE_SKILL",{skill:ID,regionId:"R1"}),saved=await rt.snapshot(f.users.A,f.roomId);
 assert.equal(saved.profile.profile_state.inventory[ID],1);assert.equal(saved.authority.state.hands.A[ID],0);
 assert.deepEqual(saved.room.public_state.delayedRecolors,saved.authority.state.delayedRecolors);
 assert.equal(saved.room.public_state.hands,undefined);assert.equal(saved.room.public_state.basicPalettes,undefined);
 ok(await rt.worker(f.users.A).post(request));assert.deepEqual(await rt.snapshot(f.users.A,f.roomId),saved);
 const altered=structuredClone(request);altered.action.payload.regionId="R99";
 assert.notEqual((await f.workers.A.post(altered)).status,200);assert.deepEqual(await rt.snapshot(f.users.A,f.roomId),saved);
 await f.action("B","CREATE_REGION",{sourceMacros:[14]});await f.action("A","COLOR_REGION",{color:"blue"});
 let a=await rt.authority(f.roomId);assert.ok(a.state.delayedRecolors);assert.deepEqual(a.rngSnapshot["skill-effect"],saved.authority.rngSnapshot["skill-effect"]);
 await f.action("A","CREATE_REGION",{sourceMacros:Array.from({length:a.state.requiredSize},(_,i)=>25+i)});
 const trigger=await f.action("B","COLOR_REGION",{color:"yellow"}),after=await rt.snapshot(f.users.A,f.roomId);
 assert.equal(after.authority.state.regions.R1.color,"green");assert.equal(after.room.public_state.delayedRecolors,undefined);
 assert.equal(after.room.public_state.lastDelayedRecolor.outcome,"APPLIED");assert.equal(after.authority.state.phase,"WORK");
 assert.equal(after.profile.profile_state.inventory[ID],1);assert.equal((await rt.profile(f.users.B)).profile_state.inventory[ID],2);
 ok(await rt.worker(f.users.B).post(trigger));assert.deepEqual(await rt.snapshot(f.users.A,f.roomId),after);
 const bad=structuredClone(trigger);bad.action.payload.color="blue";assert.notEqual((await f.workers.B.post(bad)).status,200);
 assert.deepEqual(await rt.snapshot(f.users.A,f.roomId),after);
 const snapshots=await rt.rpc("fcg_standard_room_snapshot_v2",{p_room_id:f.roomId,p_known_profile_revision:0},"authenticated",f.users.A);
 assert.ok(JSON.stringify(snapshots).includes("lastDelayedRecolor"));
});
test("UDL011 delayed SQL: rejected target has no inventory/receipt change and surrender persists queue removal",async()=>{
 const f=await pair(),before=await rt.snapshot(f.users.A,f.roomId);
 const rejected={operation:"action",roomId:f.roomId,action:{id:randomUUID(),expectedVersion:before.authority.state.version,type:"USE_SKILL",payload:{skill:ID,regionId:"R99"}}};
 assert.notEqual((await f.workers.A.post(rejected)).status,200);assert.deepEqual(await rt.snapshot(f.users.A,f.roomId),before);
 await f.action("A","USE_SKILL",{skill:ID,regionId:"R1"});const saved=await rt.authority(f.roomId);
 const end=await f.action("B","SURRENDER",{}),after=await rt.snapshot(f.users.A,f.roomId);
 assert.equal(after.room.status,"finished");assert.equal(after.authority.state.delayedRecolors,undefined);assert.equal(after.room.public_state.delayedRecolors,undefined);
 assert.deepEqual(after.authority.rngSnapshot["skill-effect"],saved.rngSnapshot["skill-effect"]);
 ok(await rt.worker(f.users.B).post(end));assert.deepEqual(await rt.snapshot(f.users.A,f.roomId),after);
});
