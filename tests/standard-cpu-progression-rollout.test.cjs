"use strict";
// Local version/SQL rehearsal. This does not prove cloud propagation, auth or time.
const assert=require("node:assert/strict"),test=require("node:test");
const {execFileSync}=require("node:child_process"),{randomUUID}=require("node:crypto");
const {stripTypeScriptTypes}=require("node:module");
const {loadEngine,root,plain}=require("./helpers/public-skill-fixture.cjs");
const {createProgressionRuntime,applyProgressionMigrations,api,winningEdgeScript}=require("./helpers/cpu-progression-runtime.cjs");
const roster=require("../standard/standard-cpu-roster.js");
const BASE_SHA="70e691b6f8f1d808476e80990d20df7862bfb782";
const gitFile=file=>execFileSync("git",["-c","safe.directory="+root,"show",BASE_SHA+":"+file],{cwd:root,encoding:"utf8",maxBuffer:8*1024*1024});
const oldSource=stripTypeScriptTypes(gitFile("supabase/functions/standard-game-action/index.ts").replace(/^import .*;\r?\n/gm,""));
const oldApi=loadEngine(gitFile("supabase/functions/standard-game-action/standard-engine.bundle.js"));
const loadout={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r));return r.body;};
const startTrial=()=>({operation:"cpu-trial-start",actionId:randomUUID(),trialId:"ren-unseal",trialVersion:1,confirmed:true});

test("AC064 staged public-baseline -> compatible pilot -> disable/re-enable rehearsal",{timeout:120000},async t=>{
  const r=await createProgressionRuntime({applyPilotMigrations:false});
  const old=id=>r.worker(id,{activation:null,runnableSource:oldSource,engineApi:oldApi});
  const off=id=>r.worker(id,{activation:null});
  const on=id=>r.worker(id);
  const policy=async roomId=>(await r.db.query("select cpu_policy_version from public.fcg_rooms where id=$1",[roomId])).rows[0].cpu_policy_version;
  const submit=async(w,roomId,action)=>{
    const state=(await r.authority(roomId)).state;
    return ok(await w.post({operation:"action",roomId,action:{...action,id:randomUUID(),expectedVersion:state.version}}));
  };
  async function ordinary(w) {
    const roomId=ok(await w.post({operation:"cpu-start",characterId:"ren",actionId:randomUUID(),confirmed:true})).roomId;
    ok(await w.post({operation:"setup",roomId,setupActionId:randomUUID(),expectedSetupRevision:0,loadout}));
    ok(await w.post({operation:"initialize",roomId}));
    assert.equal(await policy(roomId),"standard-character-split-rescue-v1:ren","retain the already-published CPU activation");
    return roomId;
  }
  async function cpuAndSurrender(w,roomId) {
    let sawCpu=false;
    for(let i=0;i<20;i++) {
      const a=await r.authority(roomId),s=a.state;
      assert.notEqual(s.status,"FINISHED","representative ordinary game must reach the requested surrender");
      if(s.active==="A"&&sawCpu) {await submit(w,roomId,{type:"SURRENDER",payload:{}});return;}
      if(s.active==="B") {ok(await w.post({operation:"cpu-action",roomId,expectedVersion:s.version}));sawCpu=true;}
      else {
        const action=roster.chooseCharacterAction({publicState:api.publicState(s),ownPrivateState:api.privateState(s,"A"),characterId:"ren",policyVersion:roster.PRE_SPLIT_POLICY_VERSIONS.ren,random:()=>0.2,tieBreakRandom:()=>0.2});
        await submit(w,roomId,{type:action.type,payload:action.payload});
      }
    }
    throw new Error("No ordinary CPU turn/surrender within the 20-operation fixture budget");
  }
  let oldId,oldRoom,newId,newRoom,learner,trialRoom,learnedSnapshot,equippedRoom;
  try {
    await t.test("exact old worker/bundle and published SQL create an ordinary alpha4 room",async()=>{
      assert.equal(oldApi.createRenTrial,undefined);
      assert.equal((await r.db.query("select to_regclass('fcg_private.standard_learned_techniques') as t")).rows[0].t,null);
      oldId=await r.player();
      // The old release requires the firstWinAt key (null is allowed). Use
      // its actual fresh profile, not the newer missing-date compatibility fixture.
      await r.db.query("update public.fcg_standard_profiles set profile_state=$2::jsonb where user_id=$1",[oldId,JSON.stringify(plain(oldApi.createStarterProfile("Trial tester")))]);
      oldRoom=await ordinary(old(oldId));
      assert.equal((await r.authority(oldRoom)).state.engineVersion,"5.0.0-alpha.4");
    });
    await t.test("compatible worker OFF runs against pre-pilot SQL without new feature RPCs",async()=>{
      newId=await r.player();const w=off(newId),before=await r.profile(newId);
      const info=ok(await w.post({operation:"cpu-roster"}));assert.equal(info.cpuProgressionVersion,null);assert.equal(info.cpuPolicyGeneration,"current");
      for(const body of [startTrial(),{operation:"cpu-trial-info"},{operation:"technique-equip",actionId:randomUUID(),expectedRevision:1,techniqueId:null}])
        assert.equal((await w.post(body)).body.error.code,"TECHNIQUE_PILOT_DISABLED");
      assert.equal(w.calls.length,0,"OFF feature requests never touch missing pilot SQL");
      assert.deepEqual(await r.profile(newId),before);
      newRoom=await ordinary(w);assert.equal((await r.authority(newRoom)).state.engineVersion,"5.0.0-alpha.4");
    });
    await t.test("additive migrations preserve both active room snapshots and existing profiles",async()=>{
      const before=[await r.authority(oldRoom),await r.authority(newRoom),await r.profile(oldId),await r.profile(newId)];
      await applyProgressionMigrations(r.db);
      assert.deepEqual([await r.authority(oldRoom),await r.authority(newRoom),await r.profile(oldId),await r.profile(newId)],before);
      assert.ok((await r.db.query("select to_regclass('fcg_private.standard_learned_techniques') as t")).rows[0].t);
    });
    await t.test("old and compatible workers both continue real ordinary CPU games on upgraded SQL",async()=>{
      const before=await r.authority(oldRoom);ok(await off(oldId).post({operation:"initialize",roomId:oldRoom}));assert.deepEqual(await r.authority(oldRoom),before);
      await cpuAndSurrender(old(oldId),oldRoom);await cpuAndSurrender(off(newId),newRoom);
      assert.equal((await r.authority(oldRoom)).state.winner,"B");assert.equal((await r.authority(newRoom)).state.winner,"B");
    });
    await t.test("stopping new starts retains an existing trial and its real WIN settlement",async()=>{
      learner=await r.player();trialRoom=ok(await on(learner).post(startTrial())).roomId;
      const before=await r.snapshot(learner,trialRoom);
      // A true old worker is intentionally incompatible; do not use it as rollback.
      assert.ok((await old(learner).post({operation:"action",roomId:trialRoom,action:{type:"COLOR_REGION",payload:{color:"yellow"},id:randomUUID(),expectedVersion:0}})).status>=400);
      assert.deepEqual(await r.snapshot(learner,trialRoom),before);
      const w=off(learner);assert.equal((await w.post(startTrial())).body.error.code,"TECHNIQUE_PILOT_DISABLED");
      assert.deepEqual(await r.snapshot(learner,trialRoom),before);
      for(const turn of winningEdgeScript(await r.authority(trialRoom),trialRoom)) {
        if(turn.seat==="B")ok(await w.post({operation:"cpu-action",roomId:trialRoom,expectedVersion:turn.version}));
        else await submit(w,trialRoom,turn.action);
      }
      learnedSnapshot=await r.snapshot(learner,trialRoom);
      assert.equal(learnedSnapshot.room.winner_seat,"A");assert.equal(learnedSnapshot.standard_learned_techniques.length,1);
      assert.equal(learnedSnapshot.standard_cpu_trial_clears.length,1);
      for(const key of ["coins","inventory","gachaTickets","cpuStats","cpuCharacterStats"])assert.deepEqual(learnedSnapshot.profile.profile_state[key],before.profile.profile_state[key]);
    });
    await t.test("enabled equipment snapshots alpha5; disabling retains that room and ownership",async()=>{
      const w=on(learner),profile=await r.profile(learner);
      ok(await w.post({operation:"technique-equip",actionId:randomUUID(),expectedRevision:profile.revision,techniqueId:"techUnsealOne"}));
      equippedRoom=await ordinary(w);const before=await r.authority(equippedRoom);
      assert.equal(before.state.engineVersion,"5.0.0-alpha.5");assert.equal(before.state.techniques.A.usesRemaining,1);assert.equal(before.state.techniques.B,null);
      ok(await off(learner).post({operation:"initialize",roomId:equippedRoom}));assert.deepEqual(await r.authority(equippedRoom),before);
      await cpuAndSurrender(off(learner),equippedRoom);
      const saved=await r.snapshot(learner,trialRoom);assert.deepEqual(saved.standard_learned_techniques,learnedSnapshot.standard_learned_techniques);assert.deepEqual(saved.standard_cpu_trial_clears,learnedSnapshot.standard_cpu_trial_clears);
      assert.equal(saved.profile.profile_state.equippedTechniqueId,"techUnsealOne");
    });
    await t.test("OFF new games stay alpha4; re-enable renews only the next eligible match",async()=>{
      const disabledRoom=await ordinary(off(learner));assert.equal((await r.authority(disabledRoom)).state.engineVersion,"5.0.0-alpha.4");
      await cpuAndSurrender(off(learner),disabledRoom);
      const enabledRoom=await ordinary(on(learner)),a=await r.authority(enabledRoom);
      assert.equal(a.state.engineVersion,"5.0.0-alpha.5");assert.equal(a.state.techniques.A.usesRemaining,1);assert.equal(a.state.techniques.B,null);
      assert.equal((await r.snapshot(learner,trialRoom)).standard_learned_techniques.length,1);
      assert.equal((await r.authority(equippedRoom)).state.status,"FINISHED");
      await cpuAndSurrender(off(learner),enabledRoom);
    });
  } finally {await r.close();}
});
