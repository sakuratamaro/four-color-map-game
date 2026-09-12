"use strict";
// One already-reviewed live acceptance attempt. No production use without exact gates.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {execFileSync}=require("node:child_process"),{randomUUID,createHash}=require("node:crypto");
const {isDeepStrictEqual}=require("node:util");
const {parseOptions}=require("./live-standard-flat-entry-canary.cjs");
const {readOnlyRequest}=require("./live-standard-player-copy-canary.cjs");
const {closeOwnedBrowserServer}=require("../tests/helpers/browser-server-cleanup.cjs");
const LOADOUT={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};

function createBudget(now=Date.now) {
  const started=now(),deadline=started+240_000,workDeadline=started+155_000;
  const counts={profiles:0,matches:0,cpu:0,surrender:0};let envelope=null;
  function remaining(cleaning=false) {
    const ms=(cleaning?deadline:workDeadline)-now();
    if(ms<=0)throw new Error("CANARY_DEADLINE");return ms;
  }
  function spend(kind,body,cleaning=false) {
    remaining(cleaning);
    const max={profiles:1,matches:1,cpu:6,surrender:2}[kind];
    assert.ok(max&&counts[kind]<max,"CANARY_OPERATION_BUDGET");
    if(kind==="surrender"){
      assert.ok(body?.operation==="action"&&typeof body.roomId==="string"&&body.roomId
        &&body.action?.type==="SURRENDER"&&/^[0-9a-f-]{36}$/i.test(body.action.id)
        &&Number.isSafeInteger(body.action.expectedVersion)&&body.action.expectedVersion>=0
        &&isDeepStrictEqual(body.action.payload,{}),"SURRENDER_ENVELOPE_REQUIRED");
      if(envelope)assert.ok(isDeepStrictEqual(body,envelope),"SAME_ENVELOPE_REQUIRED");
      else envelope=structuredClone(body);
    }
    counts[kind]++;
  }
  return {remaining,spend,counts,deadline,started,getEnvelope:()=>envelope&&structuredClone(envelope)};
}
function browserPolicy(method,pathname,body,owned) {
  if(readOnlyRequest(method,pathname,body?.operation))return "read";
  if(method==="POST"&&pathname==="/rest/v1/rpc/fcg_standard_room_snapshot_v2"&&body?.p_room_id===owned)return "read";
  if(method!=="POST"||pathname!=="/functions/v1/standard-game-action"||!owned||body?.roomId!==owned)return null;
  if(body.operation==="initialize")return "read";
  if(body.operation==="cpu-action")return "cpu";
  if(body.operation==="action"&&body.action?.type==="SURRENDER")return "surrender";
  return null;
}
function terminal(room) {return room?.status==="finished"&&room.publicState?.status==="FINISHED";}
function settlement(actual,before,matchId) {
  const entries=actual?.profileState?.matchHistory?.filter(x=>x.matchId===matchId)||[];
  const previous=before?.profileState?.matchHistory?.filter(x=>x.matchId===matchId)||[];
  return entries.length===1&&previous.length===0&&entries[0].result==="LOSS"
    &&entries[0].terminalReason==="SURRENDER"&&entries[0].cpuCharacterId==="rei"
    &&actual.profileState.cpuStats.losses===before.profileState.cpuStats.losses+1
    &&actual.revision>before.revision;
}
function finalAudits({unexpected=0,errors=0,warnings=0,budget,room,affirmed,settled,withinDeadline}) {
  return [
    {label:"only permitted owned requests",passed:unexpected===0},
    {label:"console and page errors zero",passed:errors===0&&warnings===0},
    {label:"one bounded profile and match",passed:budget.counts.profiles===1&&budget.counts.matches===1&&budget.counts.cpu<=6&&budget.counts.surrender<=2},
    {label:"explicit confirmation reached one normal surrender settlement",passed:affirmed===true&&settled===true&&terminal(room)&&room.publicState.winner==="B"&&room.publicState.terminalReason==="SURRENDER"},
    {label:"cleanup inside original 240 second deadline",passed:withinDeadline===true&&terminal(room)},
  ];
}
async function confirmationLayout(page) {
  return page.locator("#surrenderDialog").evaluate(dialog=>{
    const box=dialog.getBoundingClientRect(),inside=r=>r.left>=box.left&&r.right<=box.right
      &&r.top>=box.top&&r.bottom<=box.bottom;
    const text=[...dialog.querySelectorAll("#surrenderTitle,#surrenderSpeaker,#surrenderDescription")].map(el=>{
      const r=el.getBoundingClientRect(),style=getComputedStyle(el);
      return {id:el.id,inside:inside(r),font:Number.parseFloat(style.fontSize),visible:r.width>0&&r.height>0
        &&style.visibility==="visible"&&style.display!=="none",noOverflow:el.scrollWidth<=el.clientWidth+1};
    });
    const targets=[...dialog.querySelectorAll("button")].map(el=>{
      const r=el.getBoundingClientRect();
      return {id:el.id,width:r.width,height:r.height,inside:inside(r),
        hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
    });
    return {width:innerWidth,fit:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,
      noOverflow:dialog.scrollWidth<=dialog.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1,
      safeFocus:document.activeElement?.id==="cancelSurrender",text,targets};
  });
}
function layoutReadable(layout) {
  return layout.fit&&layout.noOverflow&&layout.safeFocus&&layout.text.length===3
    &&layout.text.every(t=>t.inside&&t.visible&&t.noOverflow&&t.font>=(t.id==="surrenderSpeaker"?12:14))
    &&layout.targets.length===2&&layout.targets.every(t=>t.inside&&t.hit&&t.width>=44&&t.height>=44);
}
function reloadUnchanged({room,beforeRoom,profile,beforeProfile,sends,beforeSends}) {
  return terminal(room)&&terminal(beforeRoom)&&room.version===beforeRoom.version
    &&isDeepStrictEqual(room.publicState,beforeRoom.publicState)
    &&profile?.revision===beforeProfile?.revision
    &&isDeepStrictEqual(profile?.profileState,beforeProfile?.profileState)
    &&sends===beforeSends;
}
async function restoreFinishedPage(page) {
  await page.reload({waitUntil:"domcontentloaded",timeout:20_000});
  await page.locator("#connectionBadge.good").waitFor();
  await page.locator('[data-app-tab="battle"]').click();
  await page.locator("#terminalSummary:not(.hidden)").waitFor();
  await page.locator("#surrenderDialog").waitFor({state:"hidden"});
}
async function readOwnedRoom(request,roomId) {
  const raw=await request("/rest/v1/rpc/fcg_standard_room_snapshot_v2",{p_room_id:roomId,p_known_profile_revision:0});
  const snapshot=Array.isArray(raw)?raw[0]:raw,r=snapshot?.room,v=snapshot?.view;
  assert.ok(snapshot?.snapshot_schema_version===2&&r?.id===roomId
    &&Number.isSafeInteger(Number(r.version))&&Number(r.version)===Number(snapshot.snapshot_version)
    &&v?.seat==="A"&&Number(v.version)===Number(r.version)&&v.private_state
    &&r.public_state&&["playing","finished"].includes(r.status),"OWNED_SNAPSHOT_REQUIRED");
  return {status:r.status,version:Number(r.version),seat:v.seat,publicState:r.public_state,privateState:v.private_state};
}
async function run({candidate,report:out}) {
  const root=path.resolve(__dirname,"../../surrender-confirmation-20260913");
  const git=(...args)=>execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),...args],
    {cwd:root,windowsHide:true,maxBuffer:2_000_000});
  assert.equal(git("rev-parse","HEAD").toString().trim(),candidate);
  assert.equal(git("status","--porcelain").toString().trim(),"");
  const {chromium}=require("playwright"),budget=createBudget();
  const config=fs.readFileSync(path.join(root,"online/supabase-config.js"),"utf8");
  const url=config.match(/url:\s*"([^"]+)"/)?.[1],key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
  assert.ok(url&&key);
  const publicPage="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
  const report={candidate,subject:"UDL-067-surrender-v1.1",physicalDevices:"NOT_RUN",faultInjection:"NONE",
    checks:[],assetHashes:[],geometry:[],screenshots:[],operations:{},profileCreated:false,matchCreated:false,cleanup:"NOT_NEEDED",reload:"NOT_RUN"};
  let token,roomId,room,matchId,beforeProfile,afterProfile,browserServer,context,failed=false,cleaning=false;
  let stage="four exact public assets",unexpected=0,errors=0,warnings=0,affirmed=false,settled=false;
  const abort=new AbortController(),deadlineTimer=setTimeout(()=>abort.abort(),budget.remaining(true));
  const recordError=(label,error)=>{failed=true;report.failures??=[];report.failures.push({stage:label,kind:error?.code==="ERR_ASSERTION"?"ASSERTION":error?.name||"Error",
    details:"REDACTED",safeCode:/^HTTP_\d{3}$/.test(error?.message||"")?error.message:undefined});};
  const bounded=async(label,promise,ms)=>{
    let timer;const limit=Math.min(ms,budget.remaining(cleaning));
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("BROWSER_STAGE_TIMEOUT "+label)),limit);})]);}
    finally{clearTimeout(timer);}
  };
  const check=(label,value)=>{if(!value){report.failedChecks??=[];report.failedChecks.push(label);}assert.ok(value,label);report.checks.push(label);};
  const capture=async(page,name)=>{
    budget.remaining();const directory=out.slice(0,-5)+"-screens";fs.mkdirSync(directory,{recursive:true});
    const file=path.join(directory,name+".png");assert.equal(fs.existsSync(file),false);
    await bounded("screenshot",page.screenshot({path:file,timeout:10_000}),10_000);
    report.screenshots.push({file:path.relative(path.dirname(out),file).replaceAll("\\","/"),
      sha256:createHash("sha256").update(fs.readFileSync(file)).digest("hex")});
  };
  const request=async(endpoint,body)=>{
    const ms=Math.min(15_000,budget.remaining(cleaning));abort.signal.throwIfAborted();
    const response=await fetch(url+endpoint,{method:"POST",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(ms)]),
      headers:{apikey:key,authorization:"Bearer "+(token||key),"content-type":"application/json"},body:JSON.stringify(body)});
    if(!response.ok)throw new Error("HTTP_"+response.status);return response.json();
  };
  const edge=async body=>{
    assert.ok(["profile","cpu-start","setup","initialize","cpu-action","action"].includes(body.operation));
    if(body.roomId)assert.equal(body.roomId,roomId,"owned room only");
    if(body.operation==="cpu-action")budget.spend("cpu",body,cleaning);
    if(body.operation==="action")budget.spend("surrender",body,cleaning);
    report.operations[body.operation]=(report.operations[body.operation]||0)+1;
    return request("/functions/v1/standard-game-action",body);
  };
  const profile=()=>edge({operation:"profile",expectedRevision:0,displayName:"SurrenderCanary",profileState:{}});
  // initialize creates a ready match but rejects finished rooms. Every later
  // state/cleanup read uses the existing authenticated, own-seat snapshot RPC.
  const refresh=async()=>room=await readOwnedRoom(request,roomId);
  const driveCpu=async()=>{
    while(room?.status==="playing"&&room.publicState?.active==="B"){
      budget.remaining(cleaning);
      room=(await edge({operation:"cpu-action",roomId,expectedVersion:room.version})).room;
    }
  };
  try {
    for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260913-42"],
      ["surrender-confirmation.js","surrender-confirmation.js?v=20260913-1"],["surrender-confirmation.css","surrender-confirmation.css?v=20260913-1"]]){
      const res=await fetch(publicPage+suffix,{cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(Math.min(15_000,budget.remaining()))])});
      check(file+": HTTP200",res.status===200);const bytes=Buffer.from(await res.arrayBuffer());
      check(file+": exact fixed bytes",bytes.equals(git("show",candidate+":standard-online-v5/"+file)));
      report.assetHashes.push({file,sha256:createHash("sha256").update(bytes).digest("hex")});
    }
    stage="one isolated profile and Rei match";
    budget.spend("profiles");const session=await request("/auth/v1/signup",{});token=session.access_token;assert.ok(token);
    const initial=await profile();report.profileCreated=true;check("fresh profile revision",initial.revision===1);
    budget.spend("matches");const start=await edge({operation:"cpu-start",actionId:randomUUID(),characterId:"rei",confirmed:true});
    roomId=start.roomId;report.matchCreated=true;report.cleanup="PENDING";
    check("one new Rei CPU room",start.startStatus==="created"&&start.opponentKind==="cpu"&&Boolean(roomId));
    await edge({operation:"setup",roomId,expectedSetupRevision:0,setupActionId:randomUUID(),loadout:LOADOUT});
    await edge({operation:"initialize",roomId});await refresh();await driveCpu();check("ordinary own turn",room?.status==="playing"&&room.publicState?.active==="A");
    matchId=room.publicState.matchId;beforeProfile=await profile();const before=structuredClone(room);
    stage="public Chrome restore and cancel controls";
    browserServer=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:20_000});
    const browser=await bounded("browser-connect",chromium.connect(browserServer.wsEndpoint()),10_000);
    context=await browser.newContext({viewport:{width:390,height:844}});
    await context.route(url+"/**",async route=>{
      const req=route.request();let body;try{body=req.postDataJSON();}catch{}
      const kind=browserPolicy(req.method(),new URL(req.url()).pathname,body,roomId);
      if(!kind){unexpected++;return route.abort("blockedbyclient");}
      try{budget.remaining();if(kind!=="read")budget.spend(kind,body);}catch{unexpected++;return route.abort("blockedbyclient");}
      if(kind!=="read")report.operations["browser:"+body.operation]=(report.operations["browser:"+body.operation]||0)+1;
      return route.continue();
    });
    const bootstrap=await context.newPage();
    await bounded("bootstrap",bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/",{waitUntil:"domcontentloaded",timeout:20_000}),20_000);
    await bounded("test-session",bootstrap.evaluate(async({url,key,token,refreshToken,roomId})=>{
      const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
      const {error}=await client.auth.setSession({access_token:token,refresh_token:refreshToken});
      if(error)throw new Error("TEST_SESSION_SETUP_FAILED");
      localStorage.setItem("fourColorMapGame.standard.online.v5.connection",JSON.stringify({roomId,roomCode:null,profileRevision:0,setupRevision:1}));
      client.auth.stopAutoRefresh();
    },{url,key,token,refreshToken:session.refresh_token,roomId}),20_000);
    await bootstrap.close();
    const page=await context.newPage();page.setDefaultTimeout(10_000);
    page.on("pageerror",()=>errors++);page.on("console",m=>{if(m.type()==="error")errors++;if(m.type()==="warning")warnings++;});
    await bounded("public-page",page.goto(publicPage+"#battle",{waitUntil:"domcontentloaded",timeout:20_000}),20_000);
    await page.locator("#connectionBadge.good").waitFor();await page.locator("#boardViewport canvas").waitFor({state:"visible"});
    await page.locator("#randomReveal").waitFor({state:"hidden"});
    const trigger=page.locator("#surrender:visible:not([disabled]), #colorSurrender:visible:not([disabled])");
    check("one visible short surrender entry",await trigger.count()===1&&await trigger.textContent()==="投了");
    for(const cancel of ["Enter","Escape","button"]){
      budget.remaining();const width=cancel==="Escape"?1280:390;
      await page.setViewportSize({width,height:width===390?844:900});
      await trigger.click();await page.locator("#surrenderDialog[open]").waitFor();
      check(cancel+": safe initial focus",await page.evaluate(()=>document.activeElement.id)==="cancelSurrender");
      check(cancel+": public Rei dialogue",/レイ/.test(await page.locator("#surrenderSpeaker").textContent())
        &&await page.locator("#surrenderDescription").textContent()==="ここまでにしますか？ もう少し、あなたの選択を観察したかったです。");
      const layout=await confirmationLayout(page);report.geometry.push({phase:cancel,...layout});
      check(cancel+": dialog text and controls readable",layoutReadable(layout));
      if(cancel!=="button")await capture(page,"confirmation-"+width);
      if(cancel==="button")await page.locator("#cancelSurrender").click();else await page.keyboard.press(cancel);
      await page.locator("#surrenderDialog").waitFor({state:"hidden"});await refresh();
      const p=await profile();
      check(cancel+": room and own cards unchanged",isDeepStrictEqual(room,before));
      check(cancel+": profile unchanged",p.revision===beforeProfile.revision&&isDeepStrictEqual(p.profileState,beforeProfile.profileState));
      check(cancel+": zero surrender sends",budget.counts.surrender===0);
    }
    stage="explicit affirmative surrender";
    await trigger.click();await page.locator("#confirmSurrender").click();affirmed=true;
    await page.locator("#terminalOverlay").waitFor({state:"visible"});await refresh();
    check("one affirmative browser send",budget.counts.surrender===1);
    check("normal defeat terminal",terminal(room)&&room.publicState.winner==="B"&&room.publicState.terminalReason==="SURRENDER");
    afterProfile=await profile();settled=settlement(afterProfile,beforeProfile,matchId);check("one normal defeat settlement",settled);
    stage="terminal reload without extra surrender or settlement";
    budget.remaining();const settledRoom=structuredClone(room),settledProfile=structuredClone(afterProfile),sent=budget.counts.surrender;
    await bounded("terminal-reload",restoreFinishedPage(page),25_000);
    await refresh();afterProfile=await profile();
    check("reload preserves confirmed terminal and settled profile without extra surrender",reloadUnchanged({
      room,beforeRoom:settledRoom,profile:afterProfile,beforeProfile:settledProfile,sends:budget.counts.surrender,beforeSends:sent}));
    check("reload shows persistent defeat",/敗北/.test(await page.locator("#terminalOutcomeTitle").textContent()));
    report.reload="PASS";await capture(page,"terminal-reloaded-390");
  } catch(error){recordError(stage,error);}
  finally {
    cleaning=true;
    try{if(context)await bounded("context-close",context.close(),10_000);}catch(e){recordError("browser context cleanup",e);}
    try{await closeOwnedBrowserServer({browserServer,bounded,stage:()=>{}});}catch(e){recordError("owned browser cleanup",e);}
    if(roomId){
      try{
        // Read terminal status first; never spend a cleanup surrender on a finished match.
        await refresh();
        if(!terminal(room)){
          await driveCpu();
          if(room?.status==="playing"&&room.publicState?.active==="A"){
            const exact=budget.getEnvelope()||{operation:"action",roomId,action:{id:randomUUID(),expectedVersion:room.version,type:"SURRENDER",payload:{}}};
            try{room=(await edge(exact)).room;}catch(e){recordError("bounded cleanup surrender",e);}
            await refresh();
          }
        }
        report.cleanup=terminal(room)?"TERMINAL_CONFIRMED_NO_DELETION":"TERMINAL_UNCONFIRMED_NO_EXTRA_BUDGET";
      }catch(e){recordError("bounded terminal read or cleanup",e);report.cleanup="TERMINAL_READ_UNCONFIRMED";}
      // Independent profile/console/request/budget results survive earlier UI or cleanup failures.
      try{afterProfile=await profile();if(beforeProfile&&matchId)settled=settlement(afterProfile,beforeProfile,matchId);}
      catch(e){recordError("final owned profile read",e);}
    }
    report.finalChecks=finalAudits({unexpected,errors,warnings,budget,room,affirmed,settled,withinDeadline:Date.now()<=budget.deadline});
    report.counts={...budget.counts};report.consoleCounts={errors,warnings};report.unexpectedRequests=unexpected;
    report.affirmativeReached=affirmed;report.settlementVerified=settled;report.elapsedMs=Date.now()-budget.started;
    report.ok=!failed&&report.finalChecks.every(x=>x.passed);report.completedAt=new Date().toISOString();
    clearTimeout(deadlineTimer);abort.abort();
    fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify(report,null,2));
  }
  return report.ok?0:1;
}
module.exports={createBudget,browserPolicy,terminal,settlement,finalAudits,parseOptions,confirmationLayout,layoutReadable,reloadUnchanged,restoreFinishedPage,readOwnedRoom};
if(require.main===module){let options;try{options=parseOptions(process.argv.slice(2));}catch(e){console.error(e.message);process.exit(2);}
  run(options).then(code=>{process.exitCode=code;}).catch(()=>{console.error("FAIL candidate preparation (redacted)");process.exitCode=1;});}
