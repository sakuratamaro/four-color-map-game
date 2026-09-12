"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const { webcrypto } = require("node:crypto");
const test = require("node:test");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "supabase/functions/standard-game-action/index.ts"), "utf8");
const bundle = fs.readFileSync(path.join(root, "supabase/functions/standard-game-action/standard-engine.bundle.js"), "utf8");
const runnable = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ""));
const roster = require("../standard/standard-cpu-roster.js");
const actor = "11111111-1111-4111-8111-111111111111";
const roomId = "22222222-2222-4222-8222-222222222222";
const actionId = "33333333-3333-4333-8333-333333333333";
const token = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ sub:actor, role:"authenticated" })).toString("base64url") + ".fixture";
const plain = value => JSON.parse(JSON.stringify(value));

function worker(activation, {room = {}, choose, paletteActivation} = {}) {
  const calls = [];
  let handler;
  const env = {SUPABASE_URL:"https://fixture.invalid",SUPABASE_SERVICE_ROLE_KEY:"isolated-test-not-a-credential"};
  if (activation !== undefined) env.FCG_CPU_SPLIT_RESCUE = activation;
  if (paletteActivation !== undefined) env.FCG_CPU_PALETTE_EFFICIENCY = paletteActivation;
  const sandbox = {console,Request,Response,Headers,TextEncoder,TextDecoder,atob,crypto:webcrypto,
    Deno:{env:{get:name=>env[name]},serve:fn=>{handler=fn;}},
    createClient:()=>({rpc:async(name,args)=>{
      calls.push({name,args:plain(args)});
      if (name === "fcg_standard_server_load_room_v3") return {data:[{
        actor_seat:"A",opponent_kind:"cpu",room_status:"finished",cpu_character_id:"kurogane",room_version:7,...room,
      }]};
      if (name === "fcg_standard_server_load_room_v2") return {data:[{
        actor_seat:"B",room_status:"playing",room_version:7,authoritative_state:{state:{active:"B",status:"PLAYING"}},
        action_public_state:{fixture:"public"},actor_private_state:{fixture:"own-only"},
      }]};
      if (name === "fcg_standard_server_replay_action") return {data:[{found:true,action_result:{ok:true}}]};
      if (["fcg_standard_server_start_cpu","fcg_standard_server_accept_cpu","fcg_standard_server_request_cpu_rematch"].includes(name))
        return {data:[{room_id:roomId,seat:"A",opponent_kind:"cpu",cpu_character_id:args.p_character_id,duplicate:false}]};
      throw new Error("Unexpected isolated RPC: " + name);
    }}),
  };
  sandbox.globalThis=sandbox;
  vm.runInNewContext(bundle,sandbox);
  if (choose) sandbox.FourColorStandardServerEngine={...sandbox.FourColorStandardServerEngine,chooseCpuAction:choose};
  vm.runInNewContext(runnable,sandbox,{filename:"standard-game-action.js"});
  return {api:sandbox.FourColorStandardServerEngine,calls,options:()=>handler(new Request("https://fixture.invalid/functions/v1/standard-game-action",{method:"OPTIONS"})),post:async body=>{
    const response=await handler(new Request("https://fixture.invalid/functions/v1/standard-game-action",{
      method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body),
    }));
    return {status:response.status,body:await response.json()};
  }};
}

test("Edge compatibility-first defaults reject typo/client activation while public roster matches actual selection", async()=>{
  for (const activation of [undefined,"","true","standard-character-split-rescue-v2"]) {
    const w=worker(activation);
    const result=await w.post({operation:"cpu-roster",policyGeneration:"current",FCG_CPU_SPLIT_RESCUE:roster.SPLIT_RESCUE_POLICY_VERSION});
    assert.equal(result.status,200);
    assert.equal(result.body.cpuPolicyGeneration,"legacy");
    assert.deepEqual(result.body.cpuPolicyCapabilities,[roster.SPLIT_RESCUE_POLICY_VERSION,roster.PALETTE_EFFICIENCY_POLICY_VERSION]);
    for (const character of result.body.characters) assert.equal(character.policyVersion,roster.PRE_SPLIT_POLICY_VERSIONS[character.id]);
    assert.equal(w.calls.length,0,"roster is read-only and does not invoke SQL");
  }
});

test("F1 stays off on old split activation or typo and cannot be activated by a request body",async()=>{
  for(const paletteActivation of [undefined,"","true","standard-character-palette-efficiency-v2"]){
    const w=worker(roster.SPLIT_RESCUE_POLICY_VERSION,{paletteActivation});
    const r=await w.post({operation:"cpu-roster",policyGeneration:"palette",FCG_CPU_PALETTE_EFFICIENCY:roster.PALETTE_EFFICIENCY_POLICY_VERSION});
    assert.equal(r.body.cpuPolicyGeneration,"current");
    assert.ok(r.body.characters.every(c=>c.policyVersion===roster.SPLIT_RESCUE_POLICY_VERSION+":"+c.id));
    const options=await w.options();assert.equal(options.headers.get("X-FCG-CPU-Palette-Capability"),roster.PALETTE_EFFICIENCY_POLICY_VERSION);
    assert.equal(options.headers.get("X-FCG-CPU-Policy-Generation"),"current");assert.equal(w.calls.length,0);
  }
});
test("exact F1 activation controls all three new-room paths, without profile/economy changes",async()=>{
  const w=worker(roster.SPLIT_RESCUE_POLICY_VERSION,{paletteActivation:roster.PALETTE_EFFICIENCY_POLICY_VERSION});
  assert.equal((await w.options()).headers.get("X-FCG-CPU-Policy-Generation"),"palette");
  for(const body of [{operation:"cpu-start",actionId,confirmed:true,characterId:"kurogane"},
    {operation:"cpu-accept",ticketId:actionId,characterId:"kurogane"},{operation:"cpu-rematch",roomId,actionId,expectedVersion:7}]){
    const r=await w.post({...body,policyGeneration:"legacy"});assert.equal(r.status,200);
    assert.equal(w.calls.at(-1).args.p_policy_version,roster.PALETTE_EFFICIENCY_POLICY_VERSION+":kurogane");
  }
  const rosterResult=await w.post({operation:"cpu-roster"});assert.equal(rosterResult.body.cpuPolicyGeneration,"palette");
  for(const id of Object.keys(roster.CPU_CHARACTERS)){
    const old=plain(w.api.createCpuProfile(id,{policyGeneration:"current"})),next=plain(w.api.createCpuProfile(id,{policyGeneration:"palette"}));
    assert.deepEqual(next.profile,old.profile);assert.deepEqual(next.loadout,old.loadout);
    assert.equal(next.policyVersion,roster.PALETTE_EFFICIENCY_POLICY_VERSION+":"+id);
    assert.equal(rosterResult.body.characters.find(c=>c.id===id).policyVersion,next.policyVersion);
  }
});
test("F1 activation rollback still executes all saved versions using their own policy",async()=>{
  for(const paletteActivation of [undefined,roster.PALETTE_EFFICIENCY_POLICY_VERSION])for(const saved of
    [roster.PRE_SPLIT_POLICY_VERSIONS.kurogane,roster.KUROGANE_LEGACY_POLICY_VERSION,roster.CPU_CHARACTERS.kurogane.policyVersion,roster.PALETTE_EFFICIENCY_POLICY_VERSION+":kurogane"]){
    let seen;const w=worker(roster.SPLIT_RESCUE_POLICY_VERSION,{paletteActivation,
      room:{room_status:"playing",cpu_policy_version:saved,cpu_user_id:actionId},choose:input=>{seen=plain(input);return {type:"SURRENDER",payload:{}};}});
    const r=await w.post({operation:"cpu-action",roomId,expectedVersion:7,policyVersion:"invented"});assert.equal(r.status,200);
    assert.equal(seen.policyVersion,saved);assert.deepEqual(seen.ownPrivateState,{fixture:"own-only"});
  }
});

test("compatibility readiness is observable by write-free unauthenticated OPTIONS before any test profile",async()=>{
  for(const [activation,generation] of [[undefined,"legacy"],[roster.SPLIT_RESCUE_POLICY_VERSION,"current"]]){
    const w=worker(activation),response=await w.options();
    assert.equal(response.status,200);
    assert.equal(response.headers.get("X-FCG-CPU-Policy-Capability"),roster.SPLIT_RESCUE_POLICY_VERSION);
    assert.equal(response.headers.get("X-FCG-CPU-Policy-Generation"),generation);
    assert.equal(w.calls.length,0);
    assert.equal(await response.text(),"ok");
  }
});

for (const generation of ["legacy","current"]) test("all three CPU creation paths use reviewed managed " + generation + " generation", async()=>{
  const activation=generation==="current"?roster.SPLIT_RESCUE_POLICY_VERSION:undefined;
  const w=worker(activation),expected=generation==="current"?roster.CPU_CHARACTERS.kurogane.policyVersion:roster.PRE_SPLIT_POLICY_VERSIONS.kurogane;
  for (const body of [
    {operation:"cpu-start",actionId,confirmed:true,characterId:"kurogane"},
    {operation:"cpu-accept",ticketId:actionId,characterId:"kurogane"},
    {operation:"cpu-rematch",roomId,actionId,expectedVersion:7},
  ]) {
    const result=await w.post({...body,policyVersion:"invented",policyGeneration:generation==="current"?"legacy":"current"});
    assert.equal(result.status,200,JSON.stringify(result));
    const created=w.calls.filter(c=>["fcg_standard_server_start_cpu","fcg_standard_server_accept_cpu","fcg_standard_server_request_cpu_rematch"].includes(c.name)).at(-1);
    assert.equal(created.args.p_policy_version,expected);
    assert.equal(created.args.p_character_id,"kurogane");
    assert.equal(created.args.p_user_id,actor);
  }
  const selected=await w.post({operation:"cpu-roster"});
  assert.equal(selected.body.cpuPolicyGeneration,generation);
  assert.equal(selected.body.characters.find(c=>c.id==="kurogane").policyVersion,expected);
});

test("activation changes policy only, not identity inventory loadout progression or supported saved dispatch", async()=>{
  const w=worker(undefined);
  for (const id of Object.keys(roster.CPU_CHARACTERS)) {
    const legacy=plain(w.api.createCpuProfile(id,{policyGeneration:"legacy"}));
    const current=plain(w.api.createCpuProfile(id,{policyGeneration:"current"}));
    assert.equal(legacy.policyVersion,roster.PRE_SPLIT_POLICY_VERSIONS[id]);
    assert.equal(current.policyVersion,roster.CPU_CHARACTERS[id].policyVersion);
    assert.deepEqual(legacy.profile,current.profile);
    assert.deepEqual(legacy.loadout,current.loadout);
    assert.deepEqual(plain(w.api.createCpuProfile(id)),current,"local/default new games retain the new policy");
  }
  for (const policyGeneration of ["invented",null,1]) {
    assert.throws(()=>w.api.getCpuRoster({policyGeneration}),/INVALID_CPU_POLICY_GENERATION/);
    assert.throws(()=>w.api.createCpuProfile("rei",{policyGeneration}),/INVALID_CPU_POLICY_GENERATION/);
  }
});

test("both activation settings dispatch an existing CPU turn using only its saved exact version and own view", async()=>{
  for (const activation of [undefined,roster.SPLIT_RESCUE_POLICY_VERSION]) {
    for (const saved of [roster.PRE_SPLIT_POLICY_VERSIONS.kurogane,roster.KUROGANE_LEGACY_POLICY_VERSION,roster.CPU_CHARACTERS.kurogane.policyVersion]) {
      let observation;
      const w=worker(activation,{room:{room_status:"playing",cpu_policy_version:saved,cpu_user_id:actionId},choose:input=>{
        observation=plain(input);return {type:"SURRENDER",payload:{}};
      }});
      const result=await w.post({operation:"cpu-action",roomId,expectedVersion:7,policyVersion:"invented"});
      assert.equal(result.status,200,JSON.stringify(result));
      assert.equal(observation.policyVersion,saved);
      assert.deepEqual(observation.publicState,{fixture:"public"});
      assert.deepEqual(observation.ownPrivateState,{fixture:"own-only"});
      assert.equal(observation.characterId,"kurogane");
      assert.equal(w.calls.at(-1).name,"fcg_standard_server_replay_action","receipt completes without executing a second action");
    }
  }
});
