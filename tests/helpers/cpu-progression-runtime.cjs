"use strict";
// Shared actual worker / PostgreSQL fixture. Platform JWT and entropy are test
// inputs; all game transitions, projections and application SQL stay real.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { randomUUID, webcrypto, createHash } = require("node:crypto");
const { stripTypeScriptTypes } = require("node:module");
const { createCpuSqlDatabase } = require("./cpu-sql-runtime.cjs");
const { loadEngine, plain, root } = require("./public-skill-fixture.cjs");
const trial = require("../../standard/standard-cpu-progression.js");
const roster = require("../../standard/standard-cpu-roster.js");
const engine = require("../../standard/standard-engine.js");
const match = require("../../standard/standard-match.js");
const api = loadEngine();
const runnable = stripTypeScriptTypes(fs.readFileSync(path.join(root,"supabase/functions/standard-game-action/index.ts"),"utf8").replace(/^import .*;\r?\n/gm,""));
const allowedRpc = new Set(["fcg_standard_server_start_cpu_trial", "fcg_standard_server_load_profile", "fcg_standard_server_load_room_v3", "fcg_standard_server_load_room_v2", "fcg_standard_server_commit_action", "fcg_standard_server_replay_action", "fcg_standard_server_initialize_room", "fcg_standard_server_equip_technique", "fcg_standard_server_start_cpu", "fcg_standard_server_submit_setup_v3", "fcg_standard_server_submit_setup_v2", "fcg_standard_server_submit_setup"]);
allowedRpc.add("fcg_standard_server_submit_loadout");
for (const name of ["fcg_standard_room_snapshot_v2", "fcg_standard_active_room", "fcg_standard_matchmaking_availability"])
  allowedRpc.add(name);
function postgrestRpcResult(name,rows) {
  return rows.length===1&&Object.keys(rows[0]).length===1&&Object.hasOwn(rows[0],name)?rows[0][name]:rows;
}

async function applyProgressionMigrations(db) {
  for (const file of fs.readdirSync(path.join(root,"supabase/migrations")).filter(f => /^20260914000[123]_/.test(f) || f === "202609260001_standard_split_keep_compat.sql").sort())
    await db.exec(fs.readFileSync(path.join(root,"supabase/migrations",file),"utf8"));
}

async function createProgressionRuntime({ createDatabase = createCpuSqlDatabase, applyPilotMigrations = true } = {}) {
  const setup = await createDatabase(), db = setup.db;
  try {
    await db.exec(setup.migration);
    if (applyPilotMigrations) await applyProgressionMigrations(db);
    // Room identity seeds the real worker's CPU tie breaks. Fix only platform
    // UUID entropy in these isolated databases; random room IDs otherwise turn
    // a representative WIN acceptance into an unbounded/flaky strategy search.
    // Application SQL and the CPU policy remain unchanged; UUIDs remain unique.
    await db.exec(`create sequence extensions.fcg_test_uuid_sequence;
      create or replace function extensions.gen_random_uuid() returns uuid language sql volatile as
      $$ select ('10000000-0000-4000-8000-' || lpad(nextval('extensions.fcg_test_uuid_sequence')::text,12,'0'))::uuid $$;`);
  } catch (error) { await db.close(); throw error; }

async function rpc(name, args, role = "service_role", actorId = null, connection = db) {
  assert.ok(allowedRpc.has(name));
  const keys = Object.keys(args || {}); keys.forEach(key => assert.match(key, /^[a-z_]+$/));
  assert.ok(["service_role", "authenticated", "anon"].includes(role));
  await connection.query("select set_config(\'request.jwt.claim.sub\',$1,false)", [actorId || ""]);
  await connection.exec("set role " + role);
  try { return (await connection.query(`select * from public.${name}(${keys.map((k,i) => k + " => $" + (i+1)).join(",")})`, keys.map(k => args[k] !== null && typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k]))).rows; }
  finally { await connection.exec("reset role"); await connection.query("select set_config(\'request.jwt.claim.sub\',\'\',false)"); }
}
async function player(wins = 1) {
  const id = randomUUID(), profile = plain(api.createStarterProfile("Trial tester"));
  profile.cpuCharacterStats.ren = { matches: Math.max(1, Number(wins) || 0), wins, losses: wins === 0 ? 1 : 0 };
  await db.query("insert into auth.users(id) values($1)", [id]);
  await db.query("insert into public.fcg_standard_profiles(user_id,revision,display_name,profile_state) values($1,1,'Trial tester',$2::jsonb)", [id,JSON.stringify(profile)]);
  return id;
}
const profile = async id => (await db.query("select revision,profile_state from public.fcg_standard_profiles where user_id=$1", [id])).rows[0];
const authority = async roomId => (await db.query("select state from fcg_private.authoritative_matches where room_id=$1", [roomId])).rows[0].state;
async function snapshot(id, roomId) {
  const value = { profile: await profile(id) };
  for (const table of ["standard_cpu_trial_clears","standard_learned_techniques","standard_cpu_trial_start_receipts"]) {
    value[table] = (await db.query("select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') data from fcg_private."+table+" t where user_id=$1", [id])).rows[0].data;
  }
  if (roomId) {
    value.room = (await db.query("select status,version,public_state,winner_seat from public.fcg_rooms where id=$1", [roomId])).rows[0];
    value.authority = await authority(roomId);
    value.receipts = (await db.query("select count(*)::int n from fcg_private.standard_action_receipts where room_id=$1", [roomId])).rows[0].n;
    value.views = (await db.query("select seat,version,private_state from public.fcg_player_views where room_id=$1 order by seat", [roomId])).rows;
  }
  return value;
}
function worker(id, { activation = "ren-unseal-v1", cpuPolicyGeneration = "current", loseCommit = false,
  connection = db, runnableSource = runnable, engineApi = api } = {}) {
  assert.ok(["current", "legacy"].includes(cpuPolicyGeneration));
  let handler, lost = false; const calls = [], errors = [];
  const sandbox = { Request,Response,Headers,TextEncoder,TextDecoder,atob,
    crypto: { subtle:webcrypto.subtle, randomUUID, getRandomValues:array => { array.fill(1); return array; } },
    console:{error:(...args)=>errors.push(args)}, FourColorStandardServerEngine: Object.fromEntries(Object.entries(engineApi).map(([key,value])=>[key,typeof value==="function"?(...args)=>{try{return value(...args);}catch(error){errors.push({engine:key,message:error.message});throw error;}}:value])),
    Deno:{env:{get:name=>({SUPABASE_URL:"https://fixture.invalid",SUPABASE_SERVICE_ROLE_KEY:"isolated-not-a-credential",FCG_CPU_PROGRESSION_PILOT:activation,
      FCG_CPU_SPLIT_RESCUE:cpuPolicyGeneration==="current"?"standard-character-split-rescue-v1":null})[name]},serve:fn=>{handler=fn;}},
    createClient:()=>({rpc:async(name,args)=>{calls.push({name,args:plain(args)});try {
      const data=await rpc(name,plain(args),"service_role",null,connection);
      if(loseCommit&&!lost&&name==="fcg_standard_server_commit_action"){lost=true;return {error:new Error("lost reply fixture")};}
      return {data:postgrestRpcResult(name,data)};
    }catch(error){errors.push({name,code:error.code,message:error.message});return {error};}}}),
  };
  vm.runInNewContext(runnableSource,sandbox,{filename:"standard-game-action.ts"});
  const token="fixture."+Buffer.from(JSON.stringify({sub:id,role:"authenticated"})).toString("base64url")+".fixture";
  return {calls,errors,post:async body=>{const r=await handler(new Request("https://fixture.invalid/standard-game-action",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)}));return {status:r.status,body:await r.json(),diagnostics:plain(errors)};}};
}

  return { db, rpc, player, profile, authority, snapshot, worker, close: () => db.close() };
}
function canonical(value) { if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value; }
function cpuSeed(roomId,version,characterId="ren",policyVersion=trial.TRIAL_POLICY_VERSION) { return parseInt(createHash("sha256").update(JSON.stringify(canonical({roomId,version,characterId,policyVersion}))).digest("hex").slice(0,8),16)>>>0; }
function winningEdgeScript(initial,roomId) {
  // B is never overridden. Search bounded legal player choices in a throwaway
  // engine to pick a replayable winning acceptance fixture for this fixed room.
  // The human-seat strategy must know the disclosed loan. Ordinary pre-pilot
  // Ren ranking alone can never select 解封 and loses avoidably under some IDs.
  for(let decisionSeed=1;decisionSeed<=32;decisionSeed++){
    let a=plain(initial);const choices=engine.createRngDomains(decisionSeed,match.REQUIRED_RNG_STREAMS),trace=[];
    for(let n=0;n<160&&a.state.status!=="FINISHED";n++){
      const seat=a.state.active;let action;
      if(n===0)action={type:"COLOR_REGION",payload:{color:"yellow"}};
      else if(seat==="B")action=api.chooseCpuAction({publicState:api.publicState(a.state),ownPrivateState:api.privateState(a.state,"B"),characterId:"ren",policyVersion:trial.TRIAL_POLICY_VERSION,seed:cpuSeed(roomId,a.state.version)});
      else {
        const publicState=api.publicState(a.state),ownPrivateState=api.privateState(a.state,"A");
        action=trial.usefulUnsealActions(publicState,ownPrivateState)[0]
          || roster.chooseCharacterAction({publicState,ownPrivateState,characterId:"ren",policyVersion:roster.PRE_SPLIT_POLICY_VERSIONS.ren,random:()=>choices["cpu-A"].next(),tieBreakRandom:()=>choices["cpu-tie-break"].next()});
        // Candidate ranking metadata is not part of the public action payload.
        action={type:action.type,payload:action.payload};
      }
      const result=plain(api.apply({...a,actor:seat,expectedVersion:a.state.version,action}));assert.equal(result.ok,true,result.code);
      trace.push({seat,version:a.state.version,action:plain(action)});a={state:result.state,rngSnapshot:result.rngSnapshot};
    }
    if(a.state.winner==="A")return trace;
  }
  throw new Error("No legal WIN acceptance fixture within the fixed 32-seed search budget; room=" + roomId + "; version=" + initial.state.version);
}
function ordinarySealScript(initial,roomId,policyVersion) {
  for(let decisionSeed=1;decisionSeed<=32;decisionSeed++) {
    let a=plain(initial);const choices=engine.createRngDomains(decisionSeed,match.REQUIRED_RNG_STREAMS),trace=[];
    for(let n=0;n<80&&a.state.status!=="FINISHED";n++) {
      const seat=a.state.active,own=api.privateState(a.state,seat),pub=api.publicState(a.state);
      if(seat==="A"&&a.state.phase==="COLOR") {
        const color=[...own.basicPalette,own.bonusColor].find(color=>pub.publicEffects.A?.seals?.[color]>0);
        if(color) return {trace,color};
      }
      const action=seat==="B"
        ? api.chooseCpuAction({publicState:pub,ownPrivateState:own,characterId:"ren",policyVersion,seed:cpuSeed(roomId,a.state.version,"ren",policyVersion)})
        : roster.chooseCharacterAction({publicState:pub,ownPrivateState:own,characterId:"ren",policyVersion:roster.PRE_SPLIT_POLICY_VERSIONS.ren,random:()=>choices["cpu-A"].next(),tieBreakRandom:()=>choices["cpu-tie-break"].next()});
      const result=plain(api.apply({...a,actor:seat,expectedVersion:a.state.version,action}));assert.equal(result.ok,true,result.code);
      trace.push({seat,version:a.state.version,action:plain(action)});a={state:result.state,rngSnapshot:result.rngSnapshot};
    }
  }
  throw new Error("No ordinary CPU seal opportunity within the fixed 32-seed/80-action fixture budget");
}
module.exports = { createProgressionRuntime, applyProgressionMigrations, api, winningEdgeScript, ordinarySealScript, postgrestRpcResult };
