"use strict";
// Reuses the existing play-surface canary transport. No product or server code is changed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { randomUUID, createHash } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { closeOwnedBrowserServer } = require("../tests/helpers/browser-server-cleanup.cjs");
const LOADOUT = { color:["colorRandomBorrow","colorChoiceBorrow"], area:["areaMicroBloom","areaDiePlus"], disrupt:["disruptRandomOne","disruptChoiceOne"] };
const ALLOWED = new Set(["profile","cpu-start","setup","initialize","action","cpu-action"]);
function chooseOwnAction(room, planner) {
  assert.equal(room?.privateState?.seat,"A");
  assert.equal(room?.publicState?.active,"A");
  const type=room.publicState.phase==="COLOR" ? "COLOR_REGION" : ["CREATE_FIRST","WORK"].includes(room.publicState.phase) ? "CREATE_REGION" : null;
  assert.ok(type,"ordinary human phase");
  const observation=planner.makeObservation({publicState:room.publicState,ownPrivateState:room.privateState,difficulty:"hard"});
  const selected=planner.enumerateCpuActions(observation).find(a=>a.type===type);
  assert.ok(selected,"ordinary legal human move");
  return {type:selected.type,payload:selected.payload};
}
function redactEvents(events) {
  return events.map(e=>({actor:e.actor,title:e.title,detail:e.detail,pointerTransparent:e.pointerTransparent,
    focusOutside:e.focusOutside,animation:e.animation,paletteReacted:e.paletteReacted,boardReacted:e.boardReacted}));
}
async function main(args) {
  const sha=args.find(a=>a.startsWith("--candidate="))?.slice(12);
  const out=args.find(a=>a.startsWith("--report="))?.slice(9);
  if(!args.includes("--confirm-live")||!/^[0-9a-f]{40}$/.test(sha||"")||!out
      ||args.some(a=>a!=="--confirm-live"&&!a.startsWith("--candidate=")&&!a.startsWith("--report="))) {
    console.error("Refusing production test without --confirm-live, exact candidate and new report path."); return 2;
  }
  const reportPath=path.resolve(out),reportRoot=path.resolve(__dirname,"../docs")+path.sep;
  assert.ok(reportPath.startsWith(reportRoot)&&reportPath.endsWith(".json")&&!fs.existsSync(reportPath),"new in-workspace report only");
  const candidateRoot=path.resolve(__dirname,"../../skill-cutin-20260912");
  const git=(...a)=>execFileSync("git",["-c","safe.directory="+candidateRoot.replaceAll("\\","/"),...a],{cwd:candidateRoot,windowsHide:true,maxBuffer:2_000_000});
  assert.equal(git("rev-parse","HEAD").toString().trim(),sha);
  assert.equal(git("status","--porcelain").toString().trim(),"");
  const {chromium}=require("playwright"),planner=require(path.join(candidateRoot,"standard/standard-cpu.js"));
  const publicPage="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
  const config=fs.readFileSync(path.join(__dirname,"../online/supabase-config.js"),"utf8");
  const url=config.match(/url:\s*"([^"]+)"/)?.[1],key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
  assert.ok(url&&key);
  const connectionKey="fourColorMapGame.standard.online.v5.connection";
  const report={subject:"UDL-065-cutin-v1.1",candidateSha:sha,profileAttempts:0,profilesCreated:0,matchAttempts:0,matchesCreated:0,
    cleanup:"NOT_NEEDED",physicalDevices:"NOT_RUN",opponentCutin:"NOT_RUN",assetHashes:[],checks:[],operations:{},events:[]};
  let token,roomId,room,browserServer,context,failed=false,stage="public assets",cleaning=false,cpuSteps=0,humanSteps=0;
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),240_000);
  const check=(label,value)=>{assert.ok(value,label);report.checks.push(label);};
  const bounded=async(label,promise,ms)=>{let id;try{return await Promise.race([promise,new Promise((_,reject)=>{id=setTimeout(()=>reject(new Error(label)),ms);})]);}finally{clearTimeout(id);}};
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const request=async(endpoint,body,useToken=token)=>{
    if(!cleaning)abort.signal.throwIfAborted();
    const response=await fetch(url+endpoint,{method:"POST",
      signal:cleaning?AbortSignal.timeout(20_000):AbortSignal.any([abort.signal,AbortSignal.timeout(20_000)]),
      headers:{apikey:key,authorization:"Bearer "+(useToken||key),"content-type":"application/json"},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok)throw new Error("HTTP_"+response.status);return data;
  };
  const edge=async body=>{
    assert.ok(ALLOWED.has(body.operation),"operation allowlist");
    if(body.roomId)assert.equal(body.roomId,roomId,"owned room only");
    report.operations[body.operation]=(report.operations[body.operation]||0)+1;
    return request("/functions/v1/standard-game-action",body);
  };
  const refresh=async()=>room=(await edge({operation:"initialize",roomId})).room;
  const action=async(type,payload={})=>{
    check("bounded owned ordinary action",["CREATE_REGION","COLOR_REGION","SURRENDER"].includes(type)&&++humanSteps<=9);
    room=(await edge({operation:"action",roomId,action:{id:randomUUID(),expectedVersion:room.version,type,payload}})).room;
  };
  const driveCpuWithoutBrowser=async()=>{
    for(let i=0;i<12&&room?.status==="playing"&&room.publicState?.active==="B";i++){
      check("bounded owned CPU action",++cpuSteps<=24);
      room=(await edge({operation:"cpu-action",roomId,expectedVersion:room.version})).room;
    }
  };
  try {
    for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260912-39"],["skill-cutin.js","skill-cutin.js?v=20260912-2"],["skill-cutin.css","skill-cutin.css?v=20260912-1"]]){
      const response=await fetch(publicPage+suffix,{cache:"no-store",signal:AbortSignal.timeout(20_000)});
      check(file+": public HTTP200",response.status===200);
      const bytes=Buffer.from(await response.arrayBuffer());
      check(file+": exact fixed Git bytes",bytes.equals(git("show",sha+":standard-online-v5/"+file)));
      report.assetHashes.push({file,sha256:createHash("sha256").update(bytes).digest("hex")});
    }
    stage="one isolated profile and CPU match";
    report.profileAttempts=1;
    const session=await request("/auth/v1/signup",{},null);token=session.access_token;
    check("anonymous test session",typeof token==="string");
    const profile=await edge({operation:"profile",expectedRevision:0,displayName:"SkillCutinCanary",profileState:{}});
    report.profilesCreated=1;check("new profile persisted",profile.revision===1);
    report.matchAttempts=1;
    const start=await edge({operation:"cpu-start",actionId:randomUUID(),characterId:"yuzu",confirmed:true});
    roomId=start.roomId;report.matchesCreated=1;report.cleanup="PENDING";
    check("one new CPU match",start.startStatus==="created"&&start.opponentKind==="cpu");
    await edge({operation:"setup",roomId,expectedSetupRevision:0,setupActionId:randomUUID(),loadout:LOADOUT});
    await refresh();await driveCpuWithoutBrowser();
    if(room?.publicState?.active==="A"&&room.publicState.phase==="CREATE_FIRST"){
      const move=chooseOwnAction(room,planner);await action(move.type,move.payload);await driveCpuWithoutBrowser();
    }
    check("actual own COLOR phase",room?.status==="playing"&&room.publicState.active==="A"&&room.publicState.phase==="COLOR");
    const before=structuredClone(room);
    stage="public Chrome cold restore";
    browserServer=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:20_000});
    const browser=await chromium.connect(browserServer.wsEndpoint());
    context=await browser.newContext({viewport:{width:390,height:844}});
    const bootstrap=await context.newPage();
    await bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/",{waitUntil:"domcontentloaded",timeout:30_000});
    await bootstrap.evaluate(async({url,key,token,refreshToken,roomId,connectionKey})=>{
      const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
      const {error}=await client.auth.setSession({access_token:token,refresh_token:refreshToken});
      if(error)throw new Error("TEST_SESSION_SETUP_FAILED");
      localStorage.setItem(connectionKey,JSON.stringify({roomId,roomCode:null,profileRevision:0,setupRevision:1}));
      client.auth.stopAutoRefresh();
    },{url,key,token,refreshToken:session.refresh_token,roomId,connectionKey});
    await bootstrap.close();
    let errors=0,warnings=0,unexpectedWrites=0,browserSkillActions=0;
    context.on("request",req=>{
      if(req.url()===url+"/functions/v1/standard-game-action"&&req.method()==="POST"){
        const body=req.postDataJSON();
        if(!ALLOWED.has(body?.operation)||body.roomId&&body.roomId!==roomId)unexpectedWrites++;
        if(body.operation==="action"){
          if(body.action?.type==="USE_SKILL"&&body.action?.payload?.skill==="colorRandomBorrow")browserSkillActions++;
          else unexpectedWrites++;
        }
        if(["cpu-start","setup"].includes(body.operation)||body.operation==="profile"&&body.profileState)unexpectedWrites++;
      }
    });
    await context.addInitScript(()=>{
      window.__skillCanary={events:[]};
      document.addEventListener("DOMContentLoaded",()=>{
        const root=document.getElementById("skillCutin");if(!root)return;
        const seen=new Set();
        const capture=()=>{
          if(root.classList.contains("hidden")||seen.has(root.dataset.eventId))return;
          seen.add(root.dataset.eventId);
          window.__skillCanary.events.push({eventId:root.dataset.eventId,actor:root.dataset.actor,
            title:document.getElementById("skillCutinTitle").textContent,detail:document.getElementById("skillCutinDetail").textContent,
            pointerTransparent:getComputedStyle(root).pointerEvents==="none",focusOutside:!root.contains(document.activeElement),
            animation:getComputedStyle(root.querySelector(".skill-cutin-card")).animationName,
            paletteReacted:document.getElementById("paletteControls").classList.contains("skill-cutin-palette"),
            boardReacted:document.getElementById("boardViewport").classList.contains("skill-cutin-board")});
        };
        new MutationObserver(capture).observe(root,{attributes:true,subtree:true,childList:true});
      });
    });
    const page=await context.newPage();page.on("pageerror",()=>errors++);
    page.on("console",msg=>{if(msg.type()==="error")errors++;if(msg.type()==="warning")warnings++;});
    await page.goto(publicPage+"#battle",{waitUntil:"domcontentloaded",timeout:30_000});
    await page.locator("#showColorSkills:not([disabled])").waitFor({timeout:30_000});
    await page.locator("#randomReveal").waitFor({state:"hidden",timeout:15_000});
    check("cold render has no cut-in replay",await page.evaluate(()=>window.__skillCanary.events.length===0));
    await refresh();check("cold restore leaves own room unchanged",isDeepStrictEqual(room,before));
    stage="real own skill and observed cut-in";
    const handBefore=room.privateState.hand.colorRandomBorrow;check("starter borrowed-color card",handBefore===1);
    await page.locator('#skillControls .skill[data-skill="colorRandomBorrow"]').click();
    await page.waitForFunction(()=>window.__skillCanary.events.some(e=>e.actor==="self"),null,{timeout:30_000});
    await page.locator('#skillControls .is-used .skill[data-skill="colorRandomBorrow"]').waitFor({timeout:30_000});
    await refresh();check("exact one own card consumed",room.privateState.hand.colorRandomBorrow===handBefore-1);
    check("one explicit browser skill write",browserSkillActions===1);
    stage="finite ordinary play for an opponent event";
    for(let i=0;i<6;i++){
      if(await page.evaluate(()=>window.__skillCanary.events.some(e=>e.actor==="opponent")))break;
      await refresh();
      // The live app owns CPU writes while open. Never race it with a second CPU driver.
      for(let poll=0;poll<12&&room.status==="playing"&&room.publicState.active==="B";poll++){await delay(800);await refresh();}
      if(room.status!=="playing"||room.publicState.active!=="A")break;
      const move=chooseOwnAction(room,planner);await action(move.type,move.payload);await delay(1200);
    }
    const events=await page.evaluate(()=>window.__skillCanary.events);
    report.events=redactEvents(events);
    const self=events.filter(e=>e.actor==="self"),opponent=events.filter(e=>e.actor==="opponent");
    check("one own cut-in, no repeated own event",self.length===1);
    check("cut-ins never capture focus or pointer",events.every(e=>e.pointerTransparent&&e.focusOutside));
    check("opponent text remains generic",opponent.every(e=>e.title==="スキルを使用"));
    report.opponentCutin=opponent.length?"OBSERVED":"NOT_RUN_NO_CPU_SKILL_OBSERVED_WITHIN_BOUND";
    check("all captured event identities unique",new Set(events.map(e=>e.eventId)).size===events.length);
    await page.locator("#skillCutin").waitFor({state:"hidden",timeout:5000});
    await page.setViewportSize({width:1280,height:900});
    check("desktop viewport no horizontal overflow",await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.reload({waitUntil:"domcontentloaded",timeout:30_000});
    await page.locator("#room:not(.hidden)").waitFor({timeout:30_000});
    check("reload does not replay prior cut-ins",await page.evaluate(()=>window.__skillCanary.events.length===0));
    check("no unapproved browser operation",unexpectedWrites===0);
    check("final console and page errors zero",errors===0&&warnings===0);
    report.browserWidths=[390,1280];report.browserSkillActions=browserSkillActions;
    report.liveGameplay="REAL_OWN_BORROW_AND_FINITE_ORDINARY_CPU_PLAY_NO_STATE_INJECTION";
  } catch(error) {
    failed=true;report.failureStage=stage;report.errorKind=error?.name||"Error";
    if(error?.code==="ERR_ASSERTION")report.failedCheck=error.message;
    console.error("FAIL "+stage);
  } finally {
    cleaning=true;clearTimeout(timer);
    try{if(context)await bounded("context-close",context.close(),10_000);}catch{failed=true;report.browserCleanup="CONTEXT_CLOSE_FAILED";}
    try{await closeOwnedBrowserServer({browserServer,bounded,stage:()=>{}});}catch{failed=true;report.browserCleanup="FAILED";}
    try{
      if(roomId){await refresh();await driveCpuWithoutBrowser();if(room.status==="playing"&&room.publicState.active==="A")await action("SURRENDER");
        report.cleanup=room.status==="finished"?"TERMINAL_CONFIRMED_NO_DELETION":"PENDING";}
    }catch{failed=true;report.cleanup="PENDING_REQUIRES_OWNED_TEST_ROOM_FOLLOWUP";}
    report.ok=!failed&&report.cleanup==="TERMINAL_CONFIRMED_NO_DELETION";
    report.completedAt=new Date().toISOString();
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify(report,null,2));
  }
  return report.ok?0:1;
}
module.exports={chooseOwnAction,redactEvents,LOADOUT};
if(require.main===module)main(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(()=>{console.error("FAIL canary setup (details redacted)");process.exitCode=1;});
