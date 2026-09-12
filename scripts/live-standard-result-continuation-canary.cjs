"use strict";

// One opted-in owned profile/CPU match. No fixture injection, draws or rematches.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const {randomUUID, createHash} = require("node:crypto");
const {chromium} = require("playwright");
const {closeOwnedBrowserServer} = require("../tests/helpers/browser-server-cleanup.cjs");
const candidateSha = process.argv.find(a=>a.startsWith("--candidate="))?.slice(12);
const reportPath = process.argv.find(a=>a.startsWith("--report="))?.slice(9);
if (!process.argv.includes("--confirm-live") || !/^[0-9a-f]{40}$/.test(candidateSha || "")) {
  console.error("Refusing production test without --confirm-live and exact candidate."); process.exit(2);
}
const candidateRoot = path.resolve(__dirname,"../../ui-result-20260912");
const git = (...args)=>execFileSync("git",["-c",`safe.directory=${candidateRoot.replaceAll("\\","/")}`,...args],{cwd:candidateRoot,windowsHide:true,maxBuffer:2_000_000});
assert.equal(git("rev-parse","HEAD").toString().trim(),candidateSha);
assert.equal(git("status","--porcelain").toString().trim(),"");
const publicPage="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
const config=fs.readFileSync(path.join(candidateRoot,"online/supabase-config.js"),"utf8");
const url=config.match(/url:\s*"([^"]+)"/)?.[1];
const key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
assert.ok(url&&key);
const connectionKey="fourColorMapGame.standard.online.v5.connection";
const checks=[];
const report={subject:"UDL-060-result-v1.1",candidateSha,profilesCreated:0,matchesCreated:0,
  cleanup:"NOT_NEEDED",physicalDevices:"NOT_RUN",liveHumanAndPendingGacha:"NOT_RUN_USE_FIXED_CANDIDATE_GATE",
  draws:0,rematches:0,deletions:0,assetHashes:[],geometry:[],browserRequests:[],requestErrors:[],checks};
let token,roomId,room,browserServer,context,page,failed=false,stage="public assets";
const hardTimeout=setTimeout(()=>{console.error("FAIL safety timeout; owned cleanup may need follow-up");process.exit(1);},240_000);
function check(label,value){assert.ok(value,label);checks.push(label);}
async function bounded(label,promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]);}finally{clearTimeout(timer);}}
async function request(endpoint,body,useToken=token){
  const response=await fetch(`${url}${endpoint}`,{method:"POST",signal:AbortSignal.timeout(20_000),
    headers:{apikey:key,authorization:`Bearer ${useToken||key}`,"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok){report.requestErrors.push({endpoint,status:response.status,code:String(data?.error?.code||"UNKNOWN").slice(0,80)});throw new Error(`HTTP_${response.status}`);}return data;
}
const edge=body=>request("/functions/v1/standard-game-action",body);
function isGameWrite(pathname,operation){
  if(pathname==="/functions/v1/standard-game-action")return !["initialize","cpu-roster","cosmetic-catalog"].includes(operation);
  if(pathname==="/rest/v1/rpc/fcg_standard_matchmaking_availability")return false;
  return /\/rest\/v1\/rpc\/fcg_standard_(request_rematch|create_room|join_room|matchmaking|abandon)/.test(pathname);
}
async function advanceCpu(){for(let n=0;n<12&&room?.status==="playing"&&room.publicState?.active==="B";n++)room=(await edge({operation:"cpu-action",roomId,expectedVersion:room.version})).room;}
async function finishOwnedMatch(){
  if(!roomId)return;
  const observed=await snapshot();
  if(observed.room?.status==="finished"){report.cleanup="TERMINAL_CONFIRMED_NO_DELETION";return;}
  room=(await edge({operation:"initialize",roomId})).room;await advanceCpu();
  if(room?.status==="playing"&&room.publicState?.active==="A")room=(await edge({operation:"action",roomId,
    action:{id:randomUUID(),expectedVersion:room.version,type:"SURRENDER",payload:{}}})).room;
  report.cleanup=room?.status==="finished"?"TERMINAL_CONFIRMED_NO_DELETION":"PENDING";
}
async function snapshot(){const data=await request("/rest/v1/rpc/fcg_standard_room_snapshot_v2",{p_room_id:roomId,p_known_profile_revision:0});return Array.isArray(data)?data[0]:data;}
async function image(label){if(reportPath)await page.screenshot({path:reportPath+"."+label+".png"});}
async function inspect(label,overlay){
  const selector=overlay?".terminal-actions button":"#rematchControls button";
  await page.waitForFunction(selector=>[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length).every(e=>{
    const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
  }),selector,{timeout:15_000});
  const geometry=await page.evaluate(({selector,overlay})=>{
    const el=document.querySelector(overlay?".terminal-celebration":"#terminalSummary"),r=el.getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
      result:{top:r.top,bottom:r.bottom,contentFits:el.scrollHeight<=el.clientHeight+1},
      targets:[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return{id:e.id,width:b.width,height:b.height,hit:e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};})};
  },{selector,overlay});
  report.geometry.push({label,...geometry});
  check(`${label}: no horizontal overflow`,!geometry.overflow);
  check(`${label}: all next-action targets visible and44px`,geometry.targets.length===(overlay?5:4)&&geometry.targets.every(t=>t.width>=44&&t.height>=44&&t.hit));
  check(`${label}: complete result fits`,geometry.result.top>=0&&geometry.result.bottom<=geometry.height&&geometry.result.contentFits);
  await image(label);
}

(async()=>{try{
  for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260912-33"],["result-continuation.js","result-continuation.js?v=20260912-1"],["result-continuation.css","result-continuation.css?v=20260912-1"]]){
    const response=await fetch(publicPage+suffix,{cache:"no-store",signal:AbortSignal.timeout(20_000)});
    check(`${file}: public200`,response.status===200);
    const bytes=Buffer.from(await response.arrayBuffer());
    check(`${file}: exact Git blob bytes`,bytes.equals(git("show",`${candidateSha}:standard-online-v5/${file}`)));
    report.assetHashes.push({file,sha256:createHash("sha256").update(bytes).digest("hex")});
  }
  stage="owned CPU completion and saved reward";
  const session=await request("/auth/v1/signup",{},null);token=session.access_token;
  check("isolated anonymous session",typeof token==="string");
  const profile=await edge({operation:"profile",expectedRevision:0,displayName:"ResultCanary",profileState:{}});
  report.profilesCreated++;check("profile persisted",Number(profile.revision)===1);
  const start=await edge({operation:"cpu-start",actionId:randomUUID(),characterId:"yuzu",confirmed:true});
  roomId=start.roomId;report.ownedRoomId=roomId;report.matchesCreated++;report.cleanup="PENDING";
  check("one ordinary owned CPU match",start.startStatus==="created"&&start.opponentKind==="cpu");
  await edge({operation:"setup",roomId,expectedSetupRevision:0,setupActionId:randomUUID(),loadout:{
    color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]}});
  await finishOwnedMatch();check("explicit ordinary surrender completed own match",report.cleanup==="TERMINAL_CONFIRMED_NO_DELETION"&&room.publicState.winner==="B");
  const settled=await snapshot(),settledProfile=settled.profile?.profile_state;
  const history=settledProfile?.matchHistory?.find(h=>h.matchId===room.publicState.matchId),reward=history?.matchReward;
  check("saved exact match loss reward",history?.result==="LOSS"&&history.onlineOpponentKind==="cpu"&&reward?.awarded===true&&Number.isSafeInteger(reward.ticketLevel)&&reward.ticketLevel>=1&&reward.ticketLevel<=5&&reward.ticketCount>0);
  report.reward={ticketLevel:reward.ticketLevel,ticketCount:reward.ticketCount,total:settledProfile.gachaTickets[String(reward.ticketLevel)]};
  const before=JSON.stringify({room:settled.room,profile:settledProfile,revision:settled.profile_revision});
  stage="real Chrome result cold restore";
  browserServer=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:20_000});
  const browser=await chromium.connect(browserServer.wsEndpoint());context=await browser.newContext({viewport:{width:390,height:844}});
  const bootstrap=await context.newPage();await bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/",{waitUntil:"domcontentloaded",timeout:30_000});
  await bootstrap.evaluate(async({url,key,accessToken,refreshToken,roomId,connectionKey})=>{
    const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    const client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    const {error}=await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(error)throw new Error("TEST_SESSION_SETUP_FAILED");
    localStorage.setItem(connectionKey,JSON.stringify({roomId,roomCode:null,profileRevision:0,setupRevision:1}));client.auth.stopAutoRefresh();
  },{url,key,accessToken:token,refreshToken:session.refresh_token,roomId,connectionKey});await bootstrap.close();
  let errors=0,warnings=0,gameWrites=0;
  context.on("request",req=>{
    if(req.method()!=="POST")return;
    const pathname=new URL(req.url()).pathname,operation=req.url()===`${url}/functions/v1/standard-game-action`?req.postDataJSON()?.operation:null;
    const write=isGameWrite(pathname,operation);
    if(pathname.startsWith("/rest/v1/rpc/")||operation)report.browserRequests.push({pathname,operation:operation||null,write});
    if(write)gameWrites++;
  });
  page=await context.newPage();page.on("pageerror",()=>errors++);page.on("console",m=>{if(m.type()==="warning")warnings++;if(m.type()==="error")errors++;});
  await page.goto(publicPage+"#battle",{waitUntil:"domcontentloaded",timeout:30_000});
  await page.locator("#terminalOverlay:not(.hidden)").waitFor({timeout:30_000});
  await page.locator("#terminalGoGacha:not(.hidden)").waitFor({timeout:30_000});
  await page.locator(".terminal-celebration").evaluate(async e=>{await Promise.all(e.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished));});
  await inspect("390-overlay",true);await page.setViewportSize({width:1280,height:900});await inspect("1280-overlay",true);
  await page.locator("#terminalClose").click();await inspect("1280-persistent",false);
  const reason=await page.locator("#terminalOutcomeReason").textContent();check("saved loss reason visible",reason.length>0&&await page.locator("#terminalOutcomeTitle").textContent()==="敗北：敗因");
  check("saved reward route level",await page.locator("#resultGoGacha").textContent()===`Lv.${reward.ticketLevel}券のガチャを開く`);
  stage="explicit gacha navigation without a draw";
  await page.locator("#resultGoGacha").click();await page.locator("#gachaLevel").waitFor();
  check("gacha selected saved ticket level",await page.locator("#gachaLevel").inputValue()===String(reward.ticketLevel));
  check("normal navigation keeps room",await page.evaluate(({connectionKey,roomId})=>JSON.parse(localStorage.getItem(connectionKey)).roomId===roomId,{connectionKey,roomId}));
  await page.reload({waitUntil:"domcontentloaded",timeout:30_000});await page.locator('[data-app-tab="battle"]').click();
  await page.locator("#terminalSummary:not(.hidden)").waitFor({timeout:30_000});
  check("reload retains result without replay overlay",!await page.locator("#terminalOverlay").isVisible()&&await page.locator("#terminalOutcomeReason").textContent()===reason);
  check("reload retains saved reward route",await page.locator("#resultGoGacha").textContent()===`Lv.${reward.ticketLevel}券のガチャを開く`);
  await page.setViewportSize({width:390,height:844});
  await page.locator("#terminalSummary").evaluate(e=>e.scrollIntoView({block:"center",behavior:"instant"}));await inspect("390-reloaded-persistent",false);
  stage="cancel opponent picker and explicit client-only result exit";
  await page.locator("#chooseDifferentCpu").click();await page.locator("#cpuRosterDialog[open]").waitFor({timeout:30_000});
  await page.keyboard.press("Escape");await page.waitForFunction(()=>document.activeElement?.id==="chooseDifferentCpu");
  check("canceled CPU choice keeps own room",await page.evaluate(({connectionKey,roomId})=>JSON.parse(localStorage.getItem(connectionKey)).roomId===roomId,{connectionKey,roomId}));
  report.browserGameWrites=gameWrites;
  check("view reload navigation and picker create no game writes",gameWrites===0);
  await page.locator("#resultGoLobby").click();
  check("explicit result close clears client room only",await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).roomId===null,connectionKey));
  check("explicit close sends no game write",gameWrites===0);
  const after=await snapshot();
  check("server room saved history tickets and revision unchanged",JSON.stringify({room:after.room,profile:after.profile?.profile_state,revision:after.profile_revision})===before);
  check("console warning error and pageerror zero",errors===0&&warnings===0);
  report.browserGameWrites=gameWrites;report.liveGameplay="REAL_CPU_LOSS_SAVED_REWARD_NAVIGATION_RELOAD_PICKER_CANCEL_CLIENT_EXIT";
}catch(error){failed=true;report.failureStage=stage;report.errorKind=error?.name||"Error";if(error?.code==="ERR_ASSERTION")report.failedCheck=error.message;console.error(`FAIL ${stage}`);}
finally{
  try{if(context)await bounded("context-close",context.close(),10_000);}catch{report.browserCleanup="CONTEXT_CLOSE_FAILED";failed=true;}
  try{await closeOwnedBrowserServer({browserServer,bounded,stage:()=>{}});}catch{report.browserCleanup="FAILED";failed=true;}
  try{if(roomId)await finishOwnedMatch();}catch{report.cleanup="PENDING_REQUIRES_OWNED_FOLLOWUP";failed=true;}
  clearTimeout(hardTimeout);report.ok=!failed&&report.cleanup==="TERMINAL_CONFIRMED_NO_DELETION";report.completedAt=new Date().toISOString();
  if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));process.exitCode=report.ok?0:1;
}})().catch(()=>{clearTimeout(hardTimeout);console.error("FAIL unhandled canary error (redacted)");process.exitCode=1;});
