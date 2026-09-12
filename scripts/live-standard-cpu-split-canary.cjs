"use strict";
// Review036: API-only, one new anonymous profile / Rei room / execution.
// Never imports the older067 harness budgets or retries. No browser is operated.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {execFileSync}=require("node:child_process"),{randomUUID}=require("node:crypto");
const {isDeepStrictEqual}=require("node:util");
const CANDIDATE="d9ce111d7d97019d55b3e90842602001e045ea04",REVIEW="CHATGPT-REVIEW-20260913-036";
const ORIGIN="https://qkcuhludisairpgzhryl.supabase.co",EDGE="/functions/v1/standard-game-action";
const SNAPSHOT="/rest/v1/rpc/fcg_standard_room_snapshot_v2",POLICY="standard-character-split-rescue-v1:rei";
const LOADOUT={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
function createBudget(now=Date.now){
  const started=now(),deadline=started+240000,workDeadline=started+155000;
  const counts={signup:0,match:0,setup:0,initialize:0,cpu:0,surrender:0};
  function remaining(final=false){const ms=(final?deadline:workDeadline)-now();if(ms<=0)fail("DEADLINE");return ms;}
  function spend(kind,final=false){remaining(final);const limit={signup:1,match:1,setup:1,initialize:1,cpu:8,surrender:1}[kind];
    if(!limit||counts[kind]>=limit)fail("OPERATION_BUDGET");counts[kind]++;}
  return {started,deadline,counts,remaining,spend};
}
function classify(endpoint,body,owned){
  if(endpoint==="/auth/v1/signup"&&isDeepStrictEqual(body,{}))return "signup";
  if(endpoint===SNAPSHOT&&owned&&body?.p_room_id===owned&&body.p_known_profile_revision===0)return "read";
  if(endpoint!==EDGE)return null;
  if(body?.operation==="profile"&&body.expectedRevision===0&&body.displayName==="CpuSplitCanary"&&isDeepStrictEqual(body.profileState,{}))return "read";
  if(body?.operation==="cpu-roster"&&Object.keys(body).length===1)return "read";
  if(body?.operation==="cpu-start"&&!owned&&body.characterId==="rei"&&body.confirmed===true&&UUID.test(body.actionId))return "match";
  if(!owned||body?.roomId!==owned)return null;
  if(body.operation==="setup"&&body.expectedSetupRevision===0&&UUID.test(body.setupActionId)&&isDeepStrictEqual(body.loadout,LOADOUT))return "setup";
  if(body.operation==="initialize")return "initialize";
  if(body.operation==="cpu-action"&&Number.isSafeInteger(body.expectedVersion)&&body.expectedVersion>=0)return "cpu";
  if(body.operation==="action"&&body.action?.type==="SURRENDER"&&UUID.test(body.action.id)
    &&Number.isSafeInteger(body.action.expectedVersion)&&body.action.expectedVersion>=0&&isDeepStrictEqual(body.action.payload,{}))return "surrender";
  return null;
}
function parseSnapshot(raw,owned){
  const s=Array.isArray(raw)?raw[0]:raw,r=s?.room,v=s?.view;
  if(!(s?.snapshot_schema_version===2&&r?.id===owned&&Number.isSafeInteger(Number(r.version))
    &&Number(r.version)===Number(s.snapshot_version)&&v?.seat==="A"&&Number(v.version)===Number(r.version)
    &&v.private_state&&r.public_state&&["playing","finished"].includes(r.status)))fail("OWNED_SNAPSHOT_REQUIRED");
  return {status:r.status,version:Number(r.version),publicState:r.public_state,
    policyMatches:r.cpu_policy_version===POLICY,characterMatches:r.cpu_character_id==="rei",opponentMatches:r.opponent_kind==="cpu"};
}
function terminal(r){return r?.status==="finished"&&r.publicState?.status==="FINISHED";}
function settlement(actual,before,matchId){
  const previous=before?.profileState?.matchHistory?.filter(x=>x.matchId===matchId)||[];
  const entries=actual?.profileState?.matchHistory?.filter(x=>x.matchId===matchId)||[];
  return Boolean(matchId&&entries.length===1&&previous.length===0&&entries[0].result==="LOSS"
    &&entries[0].terminalReason==="SURRENDER"&&entries[0].cpuCharacterId==="rei"
    &&actual?.profileState?.cpuStats?.losses===before?.profileState?.cpuStats?.losses+1&&actual.revision>before.revision);
}
function errorCode(e){return /^(HTTP_\d{3}|DEADLINE|OPERATION_BUDGET|OWNED_SNAPSHOT_REQUIRED|UNPERMITTED_REQUEST|NO_TOKEN|FRESH_PROFILE_REQUIRED|NEW_REI_REQUIRED|CURRENT_ROSTER_REQUIRED|ROOM_POLICY_REQUIRED|CPU_NO_PROGRESS|BODY_TOO_LARGE)$/.test(e?.message||"")?e.message:e?.name==="TimeoutError"?"TIMEOUT":"CONTRACT_OR_NETWORK";}
function validateGate(doc){
  const s=doc.coordination?.preparing_next_slice,r=doc.decisions?.find(x=>x.review_id===REVIEW);
  assert.ok(s?.candidate_sha===CANDIDATE&&s.review_id===REVIEW&&s.live_canary_attempts===1
    &&s.live_canary_state==="RESERVED_BEFORE_EXECUTION"&&r?.decision==="APPROVE_RELEASE"
    &&r.subject_sha===CANDIDATE&&r.review_kind==="game_production_release_approval"
    &&r.source?.message_id==="7f806672-5501-4673-8bc9-6f7626e08552"&&r.source.response_complete===true,"EXACT_REVIEW_REQUIRED");
  assert.deepEqual(s.live_canary_bounds,{profiles:1,matches:1,character_id:"rei",attempts:1,max_seconds:240,cpu_send_attempts:8,surrender_send_attempts:1,additional_matches:0,additional_profiles:0,economy_actions:0,deletions:0,privileged_room_recovery:false});
  assert.deepEqual(s.managed_setting_change_set,r.managed_setting_change_set);
  for(const field of ["base_sha","scope","spec_snapshot_sha"])assert.equal(s[field],r[field]);
  for(const field of ["db_change_set","edge_change_set"])assert.deepEqual(s[field],r[field]);
  const g=s.production_gates;
  assert.ok(g.sql==="APPLIED_5_OF5_VERIFIED"&&g.compatible_edge==="DEPLOYED_BYTE_EXACT_LEGACY_VERIFIED"
    &&g.managed_activation==="CURRENT_VERIFIED_AFTER_460_SECONDS"&&g.main==="EXACT_SHA_PUBLISHED"
    &&g.pages==="SUCCESS_PREFLIGHT_BYTE_EXACT","PRODUCTION_GATES_REQUIRED");
}
async function execute({key,fetchImpl=globalThis.fetch,now=Date.now,uuid=randomUUID}){
  const budget=createBudget(now),network=[],failures=[];
  const report={candidate:CANDIDATE,review:REVIEW,mode:"API_ONLY",startedAt:new Date(budget.started).toISOString(),
    console:{state:"NOT_RUN",reason:"API-only smoke; no browser or console collection. Not zero browser errors."},
    browserUi:"NOT_RUN",physicalDevices:"NOT_RUN",f3SpecificPosition:"NOT_RUN",allTenStockHands:"NOT_RUN",oldWorkerRace:"NOT_RUN",
    profileCreated:false,matchCreated:false,newPolicyRoster:"NOT_RUN",newPolicyOwnedRoom:"NOT_RUN",cpuAction:"NOT_OBSERVED",cpuObserved:[],
    surrenderAcknowledged:false,terminalRead:"NOT_RUN",profileRead:"NOT_RUN",settlement:"NOT_VERIFIED"};
  let token,owned,room,matchId,beforeProfile,afterProfile,final=false,stage="signup",unexpected=0;
  const request=async(endpoint,body)=>{
    const kind=classify(endpoint,body,owned);if(!kind){unexpected++;fail("UNPERMITTED_REQUEST");}
    const timeout=Math.min(15000,budget.remaining(final));
    if(kind!=="read")budget.spend(kind,final); // Count send attempts before fetch, including unknown outcomes.
    const record={operation:endpoint===SNAPSHOT?"owned-snapshot-v2":endpoint==="/auth/v1/signup"?"signup":body.operation,allowed:true};
    network.push(record);
    try{
      const response=await fetchImpl(ORIGIN+endpoint,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(timeout),
        headers:{apikey:key,authorization:"Bearer "+(token||key),"content-type":"application/json"},body:JSON.stringify(body)});
      record.status=response.status;const raw=await response.text();if(raw.length>2000000)fail("BODY_TOO_LARGE");
      if(!response.ok)fail("HTTP_"+response.status);const data=JSON.parse(raw);record.result="RECEIVED";return data;
    }catch(e){record.result=errorCode(e);throw e;}
  };
  const edge=body=>request(EDGE,body),profile=()=>edge({operation:"profile",expectedRevision:0,displayName:"CpuSplitCanary",profileState:{}});
  const refresh=async()=>room=parseSnapshot(await request(SNAPSHOT,{p_room_id:owned,p_known_profile_revision:0}),owned);
  const saveFailure=(label,e)=>failures.push({stage:label,code:errorCode(e)});
  try{
    const session=await request("/auth/v1/signup",{});token=session.access_token;if(!token)fail("NO_TOKEN");
    stage="fresh profile";beforeProfile=await profile();report.profileCreated=true;if(beforeProfile.revision!==1)fail("FRESH_PROFILE_REQUIRED");
    stage="current roster";const roster=await edge({operation:"cpu-roster"});
    if(!(roster.cpuPolicyGeneration==="current"&&roster.cpuPolicyCapabilities?.includes("standard-character-split-rescue-v1")
      &&roster.characters?.find(x=>x.id==="rei")?.policyVersion===POLICY))fail("CURRENT_ROSTER_REQUIRED");
    report.newPolicyRoster="VERIFIED";
    stage="one Rei room";const start=await edge({operation:"cpu-start",actionId:uuid(),characterId:"rei",confirmed:true});
    if(UUID.test(start.roomId))owned=start.roomId;
    if(!(owned&&start.startStatus==="created"&&start.opponentKind==="cpu"&&start.characterId==="rei"))fail("NEW_REI_REQUIRED");
    report.matchCreated=true;
    stage="setup";await edge({operation:"setup",roomId:owned,expectedSetupRevision:0,setupActionId:uuid(),loadout:LOADOUT});
    stage="initialize once";await edge({operation:"initialize",roomId:owned});
    stage="owned policy";await refresh();matchId=room.publicState.matchId;
    if(!(room.policyMatches&&room.characterMatches&&room.opponentMatches))fail("ROOM_POLICY_REQUIRED");
    report.newPolicyOwnedRoom="VERIFIED";
    stage="bounded CPU actions";
    while(room.status==="playing"&&room.publicState.active==="B"&&budget.counts.cpu<8&&budget.remaining()>30000){
      const previous=room.version;await edge({operation:"cpu-action",roomId:owned,expectedVersion:previous});await refresh();
      if(room.version<=previous)fail("CPU_NO_PROGRESS");
      report.cpuAction="OBSERVED";report.cpuObserved.push({beforeVersion:previous,afterVersion:room.version,policyMatches:room.policyMatches});
    }
  }catch(e){saveFailure(stage,e);}
  // All final channels run independently, even after an unknown mutation outcome.
  final=true;
  if(owned){
    try{await refresh();matchId??=room.publicState.matchId;}catch(e){saveFailure("pre-final owned snapshot",e);}
    if(room?.status==="playing"&&budget.counts.surrender===0){
      try{
        await edge({operation:"action",roomId:owned,action:{id:uuid(),expectedVersion:room.version,type:"SURRENDER",payload:{}}});
        report.surrenderAcknowledged=true;
      }catch(e){saveFailure("single surrender",e);} // Absolutely no resend.
    }
    try{await refresh();report.terminalRead=terminal(room)?"FINISHED_VERIFIED":room.status==="playing"?"PLAYING_OBSERVED":"NOT_VERIFIED";}
    catch(e){report.terminalRead="FAILED_UNKNOWN";saveFailure("final owned snapshot",e);}
  }else report.terminalRead=budget.counts.match?"ROOM_ID_UNKNOWN_NO_RECOVERY":"NO_ROOM_CREATED";
  if(token){
    try{afterProfile=await profile();report.profileRead="READ_VERIFIED";report.settlement=settlement(afterProfile,beforeProfile,matchId)?"ONCE_LOSS_SURRENDER_VERIFIED":"NOT_VERIFIED";}
    catch(e){report.profileRead="FAILED_UNKNOWN";saveFailure("final own profile",e);}
  }else report.profileRead="NO_OWN_TOKEN";
  const finished=now();report.finishedAt=new Date(finished).toISOString();report.elapsedMs=finished-budget.started;
  report.attemptCounts={...budget.counts};report.network={state:unexpected===0?"ALLOWLIST_ONLY":"FAILED",blocked:unexpected,requests:network};
  report.failures=failures;report.withinDeadline=finished<=budget.deadline;
  report.terminalSurrender=report.terminalRead==="FINISHED_VERIFIED"&&room?.publicState.winner==="B"&&room?.publicState.terminalReason==="SURRENDER";
  report.ok=failures.length===0&&report.withinDeadline&&report.newPolicyOwnedRoom==="VERIFIED"&&report.terminalSurrender
    &&report.settlement==="ONCE_LOSS_SURRENDER_VERIFIED"&&unexpected===0&&budget.counts.signup===1&&budget.counts.match===1&&budget.counts.surrender===1;
  return report;
}
async function run(args){
  assert.deepEqual(args,["--candidate="+CANDIDATE,"--execute-reviewed-once"],"EXACT_ARGUMENTS_REQUIRED");
  const gov=path.resolve(__dirname,".."),root=path.resolve(gov,"../cpu-split-rescue-20260913");
  const doc=JSON.parse(fs.readFileSync(path.join(gov,"docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8"));validateGate(doc);
  assert.equal(fs.existsSync(path.join(gov,"docs/CPU_SPLIT_LIVE_20260913.json")),false,"NO_SECOND_ATTEMPT");
  const git=(...a)=>execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),...a],{cwd:root,windowsHide:true}).toString().trim();
  assert.equal(git("rev-parse","HEAD"),CANDIDATE);assert.equal(git("status","--porcelain"),"");
  const config=fs.readFileSync(path.join(root,"online/supabase-config.js"),"utf8");
  assert.equal(config.match(/url:\s*"([^"]+)"/)?.[1],ORIGIN);const key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];assert.ok(key);
  // Durable exclusive admission survives a crashed process/report capture. Never remove to retry.
  const receipt=path.join(gov,"docs/CPU_SPLIT_LIVE_20260913.attempt.json"),fd=fs.openSync(receipt,"wx");
  try{fs.writeFileSync(fd,JSON.stringify({candidate:CANDIDATE,review:REVIEW,reservedAt:new Date().toISOString(),attempt:1})+"\n");fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  return execute({key});
}
if(require.main===module)run(process.argv.slice(2)).then(report=>{console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;})
  .catch(e=>{console.log(JSON.stringify({ok:false,preflight:"FAILED_BEFORE_LIVE_ATTEMPT",code:errorCode(e)}));process.exitCode=1;});
module.exports={createBudget,classify,parseSnapshot,settlement,validateGate,execute,CANDIDATE,REVIEW,ORIGIN,EDGE,SNAPSHOT,POLICY,LOADOUT};
