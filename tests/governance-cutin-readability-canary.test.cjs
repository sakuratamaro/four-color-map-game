"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const G=require("../scripts/live-standard-cutin-readability-guard.cjs");
const {execute,createTransport,reserveOnce,chooseOrdinary}=require("../scripts/live-standard-cutin-readability-canary.cjs");
const ROOM="12345678-1234-4321-8123-123456789012",USER="12345678-1234-4321-8123-123456789013",CPU="12345678-1234-4321-8123-123456789014",MATCH="private-match-never-log";
function fixture({failCpu=false,unknownSurrender=false,finishedBeforeFinal=false,failPreFinal=false,failFinal=false,failProfile=false,mismatch=false,deadline=false}={}){
 let now=0,version=2,finished=false,active="A",final=false,id=20,reads=0,shared;
 const calls=[];
 const snap=()=>({snapshot_schema_version:2,snapshot_version:version,profile_revision:finished?3:2,
  room:{id:ROOM,game_mode:"standard_v5",status:finished?"finished":"playing",version,cpu_character_id:"yuzu",opponent_kind:"cpu",
   public_state:{matchId:MATCH,status:finished?"FINISHED":"ACTIVE",active,phase:"COLOR",version,...(finished?{winner:"B",terminalReason:"SURRENDER"}:{})}},
  members:[{user_id:mismatch?CPU:USER,seat:"A",is_cpu:false},{user_id:CPU,seat:"B",is_cpu:true}],view:{seat:"A",version,private_state:{hand:{colorRandomBorrow:1},privateMarker:"own-hand-not-report"}}});
 const profile=()=>({revision:finished?3:1,profile_state:{cpuStats:{losses:finished?1:0},matchHistory:finished?[{matchId:MATCH,result:"LOSS",terminalReason:"SURRENDER",cpuCharacterId:"yuzu"}]:[]}});
 const fetchImpl=async(url,opt)=>{
  const u=new URL(url),b=opt.body?JSON.parse(opt.body):{};calls.push({method:opt.method,path:u.pathname,body:b});
  assert.equal(opt.redirect,"error");let result={};
  if(u.pathname==="/auth/v1/signup")result={access_token:"private-token-never-log",refresh_token:"private-refresh",user:{id:USER}};
  else if(u.pathname.startsWith("/rest/v1/fcg_standard_profiles")){if(failProfile)return new Response("private error",{status:500});result=profile();}
  else if(u.pathname===G.SNAPSHOT){
   if(final){reads++;if(finishedBeforeFinal)finished=true;
    if(failPreFinal&&reads===1||failFinal&&reads===2)return new Response("secret",{status:503});}
   result=snap();
  }else if(b.operation==="profile")result=profile();
  else if(b.operation==="cpu-start")result={roomId:ROOM,startStatus:"created",opponentKind:"cpu",characterId:"yuzu"};
  else if(b.operation==="action"){
   version++;if(b.action.type==="SURRENDER"){finished=true;if(unknownSurrender)throw new Error("secret unknown surrender");}
   else active="B";
  }else if(b.operation==="cpu-action"){
   if(failCpu)throw new Error("secret CPU timeout");version++;active="A";
  }
  return new Response(JSON.stringify(result),{status:200});
 };
 const adapter={async open({transport,budget}){shared=transport;if(deadline)now=150000;},
  async tryOwnSkill(){await shared.request("POST",G.EDGE,{operation:"action",roomId:ROOM,action:{id:uuid(),expectedVersion:version,type:"USE_SKILL",payload:{skill:"colorRandomBorrow"}}},"browser");return true;},
  async collect(){return {ok:true,self:"NOT_OBSERVED",opponent:"NOT_OBSERVED",events:[]};},
  async stop(){final=true;}};
 const uuid=()=>"12345678-1234-4321-8123-"+String(id++).padStart(12,"0");
 const sleep=async ms=>{now+=ms;if(active==="B"&&!shared.unknown&&!shared.pending){try{await shared.request("POST",G.EDGE,{operation:"cpu-action",roomId:ROOM,expectedVersion:version},"browser");}catch{}}};
 const planner={makeObservation:x=>x,enumerateCpuActions:()=>[{type:"COLOR_REGION",payload:{color:"red"}}]};
 return {fetchImpl,adapter,planner,uuid,now:()=>now,sleep,calls,snap};
}
test("one UI trial shares browser/API sends and independently verifies owned settlement",async()=>{
 const f=fixture(),r=await execute({key:"public-key",...f});assert.equal(r.ok,true);assert.equal(r.attemptCounts.own,6);assert.equal(r.attemptCounts.cpu,6);
 assert.equal(r.attemptCounts.profileSeed,1);assert.equal(r.attemptCounts.signup,1);assert.equal(r.attemptCounts.match,1);assert.equal(r.attemptCounts.surrender,1);
 assert.equal(r.profileRead,"READ_VERIFIED");assert.equal(r.settlement,"ONCE_LOSS_VERIFIED");assert.equal(r.terminalRead,"FINISHED_VERIFIED");
 assert.doesNotMatch(JSON.stringify(r),/private-token|private-refresh|own-hand|private-match|12345678-1234/);
 const surrender=f.calls.findIndex(x=>x.body.action?.type==="SURRENDER");assert.equal(f.calls[surrender-1].path,G.SNAPSHOT);
 assert.ok(f.calls.slice(surrender+1).every(x=>x.path===G.SNAPSHOT||x.path==="/rest/v1/fcg_standard_profiles"));
});
test("unknown CPU send cannot be followed by a different mutation; independent reads remain",async()=>{
 const f=fixture({failCpu:true}),r=await execute({key:"k",...f});assert.equal(r.attemptCounts.cpu,1);assert.equal(r.attemptCounts.surrender,0);
 assert.equal(r.surrenderSkipped,"UNRESOLVED_PRIOR_SEND");assert.equal(r.terminalRead,"PLAYING_OBSERVED");assert.equal(r.profileRead,"READ_VERIFIED");
 assert.equal(r.ok,false);assert.doesNotMatch(JSON.stringify(r),/secret CPU/);
});
test("unknown surrender is not resent even when independent terminal and settlement succeed",async()=>{
 const f=fixture({unknownSurrender:true}),r=await execute({key:"k",...f});assert.equal(r.attemptCounts.surrender,1);assert.equal(r.surrenderAck,false);
 assert.equal(r.terminalRead,"FINISHED_VERIFIED");assert.equal(r.settlement,"ONCE_LOSS_VERIFIED");assert.equal(r.ok,false);
});
test("already finished read avoids SURRENDER and never uses initialize for final reads",async()=>{
 const f=fixture({finishedBeforeFinal:true}),r=await execute({key:"k",...f});assert.equal(r.attemptCounts.surrender,0);assert.equal(r.terminalRead,"FINISHED_VERIFIED");
 assert.equal(f.calls.filter(x=>x.body.operation==="initialize").length,1);
});
test("pre-final snapshot failure never authorizes a surrender from stale room data",async()=>{
 const f=fixture({failPreFinal:true}),r=await execute({key:"k",...f});assert.equal(r.attemptCounts.surrender,0);assert.equal(r.profileRead,"READ_VERIFIED");assert.equal(r.ok,false);
});
test("terminal and own profile failures are independent, not misreported as timeout or no observation",async()=>{
 const a=await execute({key:"k",...fixture({failFinal:true})});assert.equal(a.terminalRead,"FAILED_UNKNOWN");assert.equal(a.profileRead,"READ_VERIFIED");
 const b=await execute({key:"k",...fixture({failProfile:true})});assert.equal(b.terminalRead,"FINISHED_VERIFIED");assert.equal(b.profileRead,"FAILED_UNKNOWN");assert.equal(b.ok,false);
});
test("snapshot membership mismatch fails closed before ordinary play",async()=>{
 const r=await execute({key:"k",...fixture({mismatch:true})});assert.equal(r.ok,false);assert.equal(r.attemptCounts.own,0);assert.equal(r.attemptCounts.cpu,0);assert.equal(r.attemptCounts.surrender,0);
 assert.equal(r.profileRead,"READ_VERIFIED");assert.ok(r.failures.some(x=>x.code==="OWNED_SNAPSHOT_REQUIRED"));
});
test("150 second play cutoff reserves final reads;240 second deadline blocks every transport",async()=>{
 const r=await execute({key:"k",...fixture({deadline:true})});assert.equal(r.attemptCounts.own,0);assert.equal(r.attemptCounts.surrender,1);assert.equal(r.profileRead,"READ_VERIFIED");
 let now=0;const budget=G.createBudget(()=>now),t=createTransport({key:"k",budget,fetchImpl:()=>assert.fail("network forbidden")});
 budget.beginFinal();now=240000;await assert.rejects(t.request("POST","/auth/v1/signup",{}),/DEADLINE/);assert.equal(budget.counts.signup,0);
});
test("an exclusive durable reservation survives restart and cannot be reset",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cutin-guard-")),file=path.join(dir,"attempt.json");
 reserveOnce(file,()=>0);const original=fs.readFileSync(file,"utf8");assert.throws(()=>reserveOnce(file,()=>100),/NO_SECOND_ATTEMPT/);assert.equal(fs.readFileSync(file,"utf8"),original);
 // Only this fixture's explicit files are removed; never a live reservation.
 fs.unlinkSync(file);fs.rmdirSync(dir);
});
test("own profile allowlist cannot read another user or broaden columns",()=>{
 const url="/rest/v1/fcg_standard_profiles?"+new URLSearchParams({select:"revision,display_name,profile_state",user_id:"eq."+USER});
 assert.equal(G.classify("GET",url,undefined,ROOM,USER),"read");
 assert.equal(G.classify("GET",url,undefined,ROOM,CPU),null);assert.equal(G.classify("GET",url+"&select=*",undefined,ROOM,USER),null);
 assert.equal(G.classify("POST",G.EDGE,{operation:"profile",expectedRevision:0,displayName:"CutinReadCanary",profileState:{}},ROOM,USER),"profileSeed");
 assert.equal(G.classify("GET","https://example.com/auth/v1/user",undefined,ROOM,USER),null);
});
test("shared pre-send gate rejects concurrent browser/API mutations without spending another send",async()=>{
 let resolve;const budget=G.createBudget(()=>0),transport=createTransport({key:"k",budget,fetchImpl:()=>new Promise(r=>{resolve=r;})});
 const first=transport.request("POST","/auth/v1/signup",{},"api");
 await assert.rejects(transport.request("POST","/auth/v1/signup",{},"browser"),/MUTATION_PENDING/);assert.equal(budget.counts.signup,1);
 resolve(new Response(JSON.stringify({access_token:"token",user:{id:USER}})));await first;await transport.waitForPending();assert.equal(transport.pending,null);
});
test("actual genuine040 binds one reserved trial; changed public main is rejected",()=>{
 const doc=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8")),s=doc.coordination.remaining_brain_work.cutin_readability_preparation;
 s.live_canary_attempts=1;s.live_canary_state="RESERVED_BEFORE_EXECUTION";assert.equal(G.validateGate(doc).review_id,"CHATGPT-REVIEW-20260913-040");
 s.main_sha="a".repeat(40);assert.throws(()=>G.validateGate(doc));
});
test("real failed UI040 trial is preserved, bounded and cannot prove cut-in or settlement acceptance",()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/SKILL_CUTIN_READABILITY_LIVE_20260913.json"),"utf8"));
 assert.equal(raw.candidate,G.CANDIDATE);assert.equal(raw.ok,false);assert.equal(raw.elapsedMs,11061);
 assert.deepEqual(raw.attemptCounts,{signup:1,profileSeed:1,match:1,setup:1,initialize:1,cpu:1,own:1,surrender:0});
 assert.equal(raw.network.requests.find(x=>x.kind==="own").result,"HTTP_400");assert.equal(raw.terminalRead,"PLAYING_OBSERVED");
 assert.equal(raw.profileRead,"READ_VERIFIED");assert.equal(raw.settlement,"NOT_VERIFIED");assert.equal(raw.ui.self,"NOT_OBSERVED");assert.equal(raw.ui.opponent,"NOT_OBSERVED");
 assert.equal(raw.ui.console.errors,1);assert.equal(raw.ui.routeFailures,1);assert.equal(raw.preMutationAssets.filter(x=>x.byteExact).length,4);
 assert.doesNotMatch(JSON.stringify(raw),/access_token|refresh_token|private_state|p_room_id|user_id/);
});
test("no-board-color rejection is reproducible locally but the live semantic code remains unknown",()=>{
 const {applyColorRandomBorrow}=require(path.resolve(__dirname,"../../skill-cutin-readability-20260913/standard/standard-skill-handlers.js"));
 const state={regions:{first:{color:null}}},result=applyColorRandomBorrow({state,actor:"A",random:()=>assert.fail("rejection must not draw RNG")});
 assert.equal(result.ok,false);assert.equal(result.code,"NO_BOARD_COLORS");assert.equal(result.state,state);
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/SKILL_CUTIN_READABILITY_LIVE_20260913.json"),"utf8"));
 assert.equal(raw.network.requests.find(x=>x.kind==="own").serverCode,undefined);
});
