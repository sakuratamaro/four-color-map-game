"use strict";
// Genuine040: one new UI-only trial. Imports are inert; no old canary is executed.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {randomUUID,createHash}=require("node:crypto"),{execFileSync}=require("node:child_process");
const G=require("./live-standard-cutin-readability-guard.cjs");
const REVIEW="CHATGPT-REVIEW-20260913-040",REPORT="SKILL_CUTIN_READABILITY_LIVE_20260913";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
function safeError(e){return /^(HTTP_\d{3}|DEADLINE|OPERATION_BUDGET|ORDINARY_PLAY_CLOSED|FINAL_PHASE_REQUIRED|NO_SEND_RETRY|OWNED_SNAPSHOT_REQUIRED|UNPERMITTED_OPERATION|MUTATION_PENDING|UNKNOWN_MUTATION|NO_OWN_SESSION|FRESH_PROFILE_REQUIRED|NEW_YUZU_REQUIRED|BODY_TOO_LARGE|UI_STAGE_TIMEOUT|NO_SECOND_ATTEMPT)$/.test(e?.message||"")?e.message:e?.name==="TimeoutError"||e?.name==="AbortError"?"TIMEOUT":"CONTRACT_OR_NETWORK";}
function reserveOnce(file,now=Date.now){
 let fd;try{fd=fs.openSync(file,"wx");}catch(e){if(e.code==="EEXIST")fail("NO_SECOND_ATTEMPT");throw e;}
 try{fs.writeFileSync(fd,JSON.stringify({candidate:G.CANDIDATE,review:REVIEW,reservedAt:new Date(now()).toISOString(),attempt:1,processId:process.pid})+"\n");fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function createTransport({key,budget,fetchImpl=globalThis.fetch}){
 const admit=G.createAdmission(budget),records=[],blocked=[];
 let token,viewer,owned,pending=null,unknown=null,resolvePending,completion=Promise.resolve();
 async function request(method,endpoint,body,source="api"){
  const kind=G.classify(method,endpoint,body,owned,viewer);
  try{
   if(!kind)fail("UNPERMITTED_OPERATION");
   if(kind!=="read"&&pending)fail("MUTATION_PENDING");
   if(kind!=="read"&&unknown)fail("UNKNOWN_MUTATION");
   admit(method,endpoint,body,owned,viewer);
  }catch(e){blocked.push({source,code:safeError(e)});throw e;}
  const version=body?.expectedVersion??body?.action?.expectedVersion;
  const operation=endpoint.startsWith("/rest/v1/fcg_standard_profiles")?"own-profile":endpoint===G.SNAPSHOT?"owned-snapshot-v2":endpoint==="/auth/v1/signup"?"signup":endpoint==="/auth/v1/user"?"own-auth-user":body?.operation||"own-read-rpc";
  const record={source,operation,kind};records.push(record);
  if(kind!=="read"){pending={kind,version};completion=new Promise(resolve=>{resolvePending=resolve;});}
  try{
   const res=await fetchImpl(new URL(endpoint,G.ORIGIN).href,{method,redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(Math.max(1,Math.min(12000,budget.remaining()))),
    headers:{apikey:key,authorization:"Bearer "+(token||key),"content-type":"application/json"},
    ...(method==="POST"?{body:JSON.stringify(body)}:{})});
   record.status=res.status;
   const raw=await res.text();if(raw.length>2000000)fail("BODY_TOO_LARGE");
   if(!res.ok)fail("HTTP_"+res.status);
   const data=raw?JSON.parse(raw):null;record.result="RECEIVED";
   if(kind==="signup"){
    if(!(typeof data?.access_token==="string"&&UUID.test(data?.user?.id||"")))fail("NO_OWN_SESSION");
    token=data.access_token;viewer=data.user.id;
   }
   if(kind==="match"&&UUID.test(data?.roomId||""))owned=data.roomId;
   // Only a coherent owned snapshot with a later version resolves an unknown game send.
   if(endpoint===G.SNAPSHOT){const s=G.parseSnapshot(data,owned,viewer);
    if(unknown&&Number.isSafeInteger(unknown.version)&&s.version>unknown.version)unknown=null;}
   return {data,raw,status:res.status};
  }catch(e){record.result=safeError(e);if(kind!=="read")unknown={kind,version};throw e;}
  finally{if(kind!=="read"){pending=null;resolvePending();}}
 }
 return {request,records,blocked,waitForPending:()=>completion,get owned(){return owned;},get viewer(){return viewer;},get pending(){return pending;},get unknown(){return unknown;}};
}
function chooseOrdinary(room,planner){
 assert.equal(room.privateState.seat,"A");assert.equal(room.publicState.active,"A");
 const type=room.publicState.phase==="COLOR"?"COLOR_REGION":["CREATE_FIRST","WORK"].includes(room.publicState.phase)?"CREATE_REGION":null;
 const observation=planner.makeObservation({publicState:room.publicState,ownPrivateState:room.privateState,difficulty:"hard"});
 const action=planner.enumerateCpuActions(observation).find(x=>x.type===type);assert.ok(action,"ordinary legal own move");
 return {type:action.type,payload:action.payload};
}
function normalizeProfile(raw){const p=Array.isArray(raw)?raw[0]:raw;assert.ok(p&&Number.isSafeInteger(Number(p.revision))&&Number(p.revision)>0);
 return {revision:Number(p.revision),profileState:p.profile_state??p.profileState};}
function checkSettlement(after,before,room){
 const id=room?.publicState?.matchId,entries=after?.profileState?.matchHistory?.filter(x=>x.matchId===id)||[];
 const old=before?.profileState?.matchHistory?.filter(x=>x.matchId===id)||[];
 if(!id||room.status!=="finished"||entries.length!==1||old.length||after.revision<=before.revision)return "NOT_VERIFIED";
 const entry=entries[0],result=room.publicState.winner==="A"?"WIN":room.publicState.winner==="B"?"LOSS":"DRAW";
 if(entry.result!==result||entry.terminalReason!==room.publicState.terminalReason||entry.cpuCharacterId!=="yuzu")return "NOT_VERIFIED";
 const counter={WIN:"wins",LOSS:"losses",DRAW:"draws"}[result];
 return after.profileState.cpuStats?.[counter]===Number(before.profileState.cpuStats?.[counter]||0)+1?"ONCE_"+result+"_VERIFIED":"NOT_VERIFIED";
}
async function execute({key,adapter,planner,fetchImpl,now=Date.now,uuid=randomUUID,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 // Browser launch and immutable public preflight happen before this first-mutation clock.
 const budget=G.createBudget(now),transport=createTransport({key,budget,fetchImpl}),failures=[];
 const report={candidate:G.CANDIDATE,review:REVIEW,mode:"REAL_PUBLIC_CHROME_AND_OWN_API",startedAt:new Date(budget.started).toISOString(),
  profileCreated:false,matchCreated:false,ui:"NOT_RUN",terminalRead:"NOT_RUN",profileRead:"NOT_RUN",settlement:"NOT_VERIFIED",physicalDevices:"NOT_RUN",failures};
 let room,before,session,stage="signup",skillTried=false;
 const json=async(m,e,b)=>(await transport.request(m,e,b)).data;
 const edge=b=>json("POST",G.EDGE,b);
 const refresh=async()=>room=G.parseSnapshot(await json("POST",G.SNAPSHOT,{p_room_id:transport.owned,p_known_profile_revision:0}),transport.owned,transport.viewer);
 const ownProfile=()=>json("GET","/rest/v1/fcg_standard_profiles?"+new URLSearchParams({select:"revision,display_name,profile_state",user_id:"eq."+transport.viewer}));
 const pause=async ms=>{await sleep(Math.min(ms,budget.remaining()));};
 const failed=(s,e)=>failures.push({stage:s,code:safeError(e)});
 try{
  session=await json("POST","/auth/v1/signup",{});
  stage="seed one profile";before=normalizeProfile(await edge({operation:"profile",expectedRevision:0,displayName:"CutinReadCanary",profileState:{}}));
  if(before.revision!==1)fail("FRESH_PROFILE_REQUIRED");report.profileCreated=true;
  stage="one Yuzu room";const created=await edge({operation:"cpu-start",actionId:uuid(),characterId:"yuzu",confirmed:true});
  if(!(transport.owned&&created.startStatus==="created"&&created.opponentKind==="cpu"&&created.characterId==="yuzu"))fail("NEW_YUZU_REQUIRED");report.matchCreated=true;
  stage="setup";await edge({operation:"setup",roomId:transport.owned,expectedSetupRevision:0,setupActionId:uuid(),loadout:G.LOADOUT});
  stage="initialize once";await edge({operation:"initialize",roomId:transport.owned});await refresh();
  stage="public browser restore";await adapter.open({session,roomId:transport.owned,transport,budget});report.ui="STARTED";
  stage="bounded natural play";
  while(room.status==="playing"&&budget.counts.cpu<8&&budget.counts.own<6&&budget.playDeadline-now()>5000){
   if(transport.unknown){await refresh();if(transport.unknown)break;}
   if(transport.pending){await pause(400);continue;}
   await refresh();if(room.status!=="playing")break;
   if(transport.pending){await pause(200);continue;}
   if(room.publicState.active==="A"){
    if(!skillTried&&room.publicState.phase==="COLOR"&&room.privateState.hand?.colorRandomBorrow>0){
     skillTried=true;await adapter.tryOwnSkill();
    }else{const move=chooseOrdinary(room,planner);await edge({operation:"action",roomId:transport.owned,action:{id:uuid(),expectedVersion:room.version,...move}});}
    await pause(2200);
   }else await pause(500); // The live application is the only CPU driver.
  }
 }catch(e){if(e?.message==="DEADLINE"&&now()>=budget.playDeadline&&now()<budget.deadline)report.playStop="ORDINARY_TIME_LIMIT";else failed(stage,e);}
 report.playStop??=room?.status==="finished"?"TERMINAL":budget.counts.own>=6?"OWN_ACTION_LIMIT":budget.counts.cpu>=8?"CPU_ACTION_LIMIT":transport.unknown?"UNKNOWN_SEND":budget.playDeadline-now()<=5000?"ORDINARY_TIME_LIMIT":"PLAY_STOPPED";
 budget.beginFinal();
 // At most the already admitted send remains. No second mutation races its unknown result.
 try{let timer;try{await Promise.race([transport.waitForPending(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("UI_STAGE_TIMEOUT")),Math.min(13000,budget.remaining()));})]);}finally{clearTimeout(timer);}}
 catch(e){failed("in-flight send at final boundary",e);}
 try{report.ui=await adapter.collect();}catch(e){failed("UI collection",e);}
 // Close this owned context before final mutations; a route guard already rejects new CPU/own sends.
 try{await adapter.stop(budget);}catch(e){failed("browser teardown",e);}
 let preFinalValid=false;
 if(transport.owned){
  try{await refresh();preFinalValid=true;}catch(e){failed("pre-final owned snapshot",e);}
  if(preFinalValid&&room.status==="playing"&&!transport.unknown&&!transport.pending){
   try{await edge({operation:"action",roomId:transport.owned,action:{id:uuid(),expectedVersion:room.version,type:"SURRENDER",payload:{}}});report.surrenderAck=true;}
   catch(e){report.surrenderAck=false;failed("one surrender",e);}
  }else if(transport.unknown||transport.pending)report.surrenderSkipped="UNRESOLVED_PRIOR_SEND";
  try{await refresh();report.terminalRead=room.status==="finished"?"FINISHED_VERIFIED":"PLAYING_OBSERVED";}
  catch(e){report.terminalRead="FAILED_UNKNOWN";failed("final owned snapshot",e);}
 }else report.terminalRead=budget.counts.match?"ROOM_ID_UNKNOWN_NO_RECOVERY":"NO_ROOM_CREATED";
 if(transport.viewer){
  try{const after=normalizeProfile(await ownProfile());report.profileRead="READ_VERIFIED";report.settlement=checkSettlement(after,before,room);}
  catch(e){report.profileRead="FAILED_UNKNOWN";failed("independent own profile",e);}
 }else report.profileRead="NO_OWN_SESSION";
 report.finishedAt=new Date(now()).toISOString();report.elapsedMs=now()-budget.started;report.withinDeadline=now()<=budget.deadline;
 report.attemptCounts=budget.counts;report.network={requests:transport.records,blocked:transport.blocked};
 report.gameplayOk=report.terminalRead==="FINISHED_VERIFIED"&&/VERIFIED$/.test(report.settlement)&&report.settlement!=="NOT_VERIFIED";
 report.networkClean=transport.records.every(r=>r.result==="RECEIVED");
 report.ok=failures.length===0&&report.networkClean&&report.withinDeadline&&report.gameplayOk&&report.ui?.ok===true;
 return report;
}
async function run(args){
 assert.deepEqual(args,["--candidate="+G.CANDIDATE,"--execute-reviewed-once"]);
 const gov=path.resolve(__dirname,".."),root=path.resolve(gov,"../skill-cutin-readability-20260913");
 G.validateGate(JSON.parse(fs.readFileSync(path.join(gov,"docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8")));
 const out=path.join(gov,"docs",REPORT+".json"),receipt=path.join(gov,"docs",REPORT+".attempt.json");
 assert.ok(!fs.existsSync(out)&&!fs.existsSync(receipt),"NO_SECOND_ATTEMPT");
 const gitBytes=(...a)=>execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),...a],{cwd:root,windowsHide:true,timeout:20000,maxBuffer:2000000});
 const git=(...a)=>gitBytes(...a).toString().trim();
 assert.equal(git("rev-parse","HEAD"),G.CANDIDATE);assert.equal(git("status","--porcelain"),"");
 assert.equal(git("ls-remote","origin","refs/heads/main").split(/\s+/)[0],G.CANDIDATE);
 const assets=[];
 for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260913-43"],["skill-cutin.js","skill-cutin.js?v=20260913-1"],["skill-cutin.css","skill-cutin.css?v=20260913-1"]]){
  const response=await fetch("https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/"+suffix,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.equals(gitBytes("show",G.CANDIDATE+":standard-online-v5/"+file)));
  assets.push({file,sha256:createHash("sha256").update(bytes).digest("hex"),byteExact:true});
 }
 const config=fs.readFileSync(path.join(root,"online/supabase-config.js"),"utf8");assert.equal(config.match(/url:\s*"([^"]+)"/)?.[1],G.ORIGIN);
 const key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];assert.ok(key);
 const {createBrowserAdapter}=require("./live-standard-cutin-readability-browser.cjs");
 const adapter=await createBrowserAdapter({key}); // Empty browser/context only: no account/network mutation.
 try{
  reserveOnce(receipt);
  const report=await execute({key,adapter,planner:require(path.join(root,"standard/standard-cpu.js"))});
  try{await adapter.emergencyStop();}catch(e){report.failures.push({stage:"final owned browser cleanup",code:safeError(e)});report.ok=false;}
  report.finishedAt=new Date().toISOString();report.elapsedMs=Date.now()-Date.parse(report.startedAt);report.withinDeadline=report.elapsedMs<=G.BOUNDS.wall_ms;report.ok&&=report.withinDeadline;
  report.preMutationAssets=assets;
  report.harnessFiles=["live-standard-cutin-readability-guard.cjs","live-standard-cutin-readability-canary.cjs","live-standard-cutin-readability-browser.cjs"].map(file=>({file,sha256:createHash("sha256").update(fs.readFileSync(path.join(__dirname,file))).digest("hex")}));
  const fd=fs.openSync(out,"wx");try{fs.writeFileSync(fd,JSON.stringify(report,null,2)+"\n");fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  return report;
 }finally{await adapter.emergencyStop();}
}
if(require.main===module)run(process.argv.slice(2)).then(r=>{console.log(JSON.stringify(r,null,2));if(!r.ok)process.exitCode=1;})
 .catch(e=>{console.log(JSON.stringify({ok:false,code:safeError(e),note:"Inspect durable receipt; never rerun a reserved trial."}));process.exitCode=1;});
module.exports={createTransport,chooseOrdinary,normalizeProfile,checkSettlement,execute,reserveOnce,safeError,run,REPORT};
