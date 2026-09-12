"use strict";

// A single opted-in owned profile. No privileged writes, artificial funds or cleanup.
const candidateSha=process.argv.find(x=>x.startsWith("--candidate="))?.slice(12);
const reportPath=process.argv.find(x=>x.startsWith("--report="))?.slice(9);
if(!process.argv.includes("--confirm-live")||!/^[0-9a-f]{40}$/.test(candidateSha||"")||!reportPath){
  console.error("Refusing production test without --confirm-live, exact candidate and report.");process.exit(2);
}
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {execFileSync}=require("node:child_process"),{randomUUID,createHash}=require("node:crypto");
const {chromium}=require("playwright");
const {closeOwnedBrowserServer}=require("../tests/helpers/browser-server-cleanup.cjs");
const {cosmeticItemLayoutPass}=require("../tests/helpers/cosmetic-canary-layout.cjs");
const candidateRoot=path.resolve(__dirname,"../../ui-cosmetics-20260912");
const git=(...args)=>execFileSync("git",["-c","safe.directory="+candidateRoot.replaceAll("\\","/"),...args],{cwd:candidateRoot,windowsHide:true,maxBuffer:2_000_000});
assert.equal(git("rev-parse","HEAD").toString().trim(),candidateSha);
assert.equal(git("status","--porcelain").toString().trim(),"");
const publicPage="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
const config=fs.readFileSync(path.join(candidateRoot,"online/supabase-config.js"),"utf8");
const url=config.match(/url:\s*"([^"]+)"/)?.[1],key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
assert.ok(url&&key);
const remoteKey="fourColorMapGame.standard.online.v5.remote-profile";
const pendingKey="fourColorMapGame.standard.online.v5.pending-cosmetic";
const checks=[],report={subject:"UDL-061-cosmetics-v1.1",candidateSha,profilesCreated:0,quizzesCompleted:0,answersSubmitted:0,draws:0,cardsSold:0,saleActions:0,cosmeticActions:0,matchesCreated:0,deletions:0,faultInjection:"NONE",physicalDevices:"NOT_RUN",unknownAckAndConflict:"FIXED_CANDIDATE_BROWSER_GATE_ONLY",assetHashes:[],geometry:[],requestErrors:[],checks};
let token,session,current,context,browserServer,page,failed=false,stage="published bytes";
const check=(label,value)=>{assert.ok(value,label);checks.push(label);};
const hardTimeout=setTimeout(()=>{console.error("FAIL bounded cosmetic canary timeout; no deletion");process.exit(1);},300_000);
async function bounded(label,promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]);}finally{clearTimeout(timer);}}
async function request(endpoint,body,useToken=token){
  const res=await fetch(url+endpoint,{method:"POST",signal:AbortSignal.timeout(20_000),headers:{apikey:key,authorization:"Bearer "+(useToken||key),"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok){report.requestErrors.push({endpoint,status:res.status,code:String(data?.error?.code||"UNKNOWN").slice(0,64)});throw new Error("HTTP_"+res.status);}return data;
}
const edge=body=>request("/functions/v1/standard-game-action",body);
const refresh=()=>edge({operation:"profile",expectedRevision:0,displayName:"CosmeticCanary",profileState:{}});
async function drawAvailable(){
  for(const level of [5,4,3,2,1]){
    const count=Math.min(Number(current.profileState.gachaTickets?.[level]||0),30-report.draws);
    if(count<=0)continue;
    const before=current.revision;
    const result=await edge({operation:"gacha",expectedRevision:before,actionId:randomUUID(),ticketLevel:level,count});
    check("bounded owned ticket draw persists once",result.revision===before+1&&result.draws.length===count&&!result.duplicate);
    report.draws+=count;current=result;
  }
}
async function sellNeeded(){
  // Quote one spare at a time: stop immediately at the required350, keep every last copy.
  for(let n=0;n<30&&report.saleActions<30&&current.profileState.coins<350;n++){
    const spare=Object.entries(current.profileState.inventory).find(([id,count])=>count>1&&current.profileState.protectedSkills?.[id]!==true);
    if(!spare)break;
    const [skillId]=spare,prior=current;
    const quoted=await edge({operation:"card-sale-quote",expectedRevision:prior.revision,skillId,count:1});
    check("sale quote retains a last copy and changes no revision",quoted.revision===prior.revision&&quoted.quote.remaining>=1&&quoted.quote.earnedCoins>0);
    const result=await edge({operation:"card-sale",expectedRevision:prior.revision,actionId:randomUUID(),skillId,count:1,confirmed:quoted.quote.requiresConfirmation===true});
    check("necessary spare sale applies once",result.revision===prior.revision+1&&result.profileState.coins===prior.profileState.coins+quoted.quote.earnedCoins&&result.profileState.inventory[skillId]===prior.profileState.inventory[skillId]-1);
    report.cardsSold++;report.saleActions++;current=result;
  }
}
async function quizRound(){
  const started=await edge({operation:"quiz-start",actionId:randomUUID(),selectedLevel:5});
  check("funding quiz has ten questions and opaque timeout answer",started.questions?.length===10&&typeof started.timeoutAnswerId==="string");
  const answers=[];
  for(let index=0;index<10;index++){
    await new Promise(resolve=>setTimeout(resolve,700));
    const answer=await edge({operation:"quiz-answer",sessionId:started.sessionId,actionId:randomUUID(),questionIndex:index,answerId:started.timeoutAnswerId});
    check("funding timeout answer acknowledged in order",answer.questionIndex===index&&answer.answeredCount===index+1&&!answer.duplicate);
    answers.push(started.timeoutAnswerId);report.answersSubmitted++;
  }
  const result=await edge({operation:"quiz-finish",sessionId:started.sessionId,actionId:randomUUID(),answers});
  check("funding quiz finished through ordinary reward",result.revision===current.revision+1&&Number.isSafeInteger(result.reward?.ticketLevel)&&result.reward.draws>0&&!result.duplicate);
  current=result;report.quizzesCompleted++;
}
function gameInvariant(p){return JSON.stringify({inventory:p.inventory,tickets:p.gachaTickets,stats:p.stats,history:p.matchHistory,quiz:p.quizRecords,protected:p.protectedSkills,trophies:p.trophies});}
async function inspect(label,{requireFeedback=true}={}){
  const item=page.locator('[data-cosmetic-id="nameplateGold"]');await item.scrollIntoViewIfNeeded();
  const geometry=await item.evaluate(e=>{const r=e.getBoundingClientRect(),b=e.querySelector("button").getBoundingClientRect();return {viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,cardWidth:r.width,buttonWidth:b.width,buttonHeight:b.height,feedbackInside:Boolean(e.querySelector(".cosmetic-item-status"))};});
  report.geometry.push({label,requireFeedback,...geometry});
  await page.screenshot({path:reportPath+"."+label+".png"});
  check(label+": item state and44px controls fit",cosmeticItemLayoutPass(geometry,{requireFeedback}));
}
(async()=>{try{
  for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260912-36"],["cosmetic-item-action.js","cosmetic-item-action.js?v=20260912-2"]]){
    const res=await fetch(publicPage+suffix,{cache:"no-store",signal:AbortSignal.timeout(20_000)});
    check(file+": public200",res.status===200);const bytes=Buffer.from(await res.arrayBuffer());
    check(file+": exact candidate bytes",bytes.equals(git("show",candidateSha+":standard-online-v5/"+file)));
    report.assetHashes.push({file,sha256:createHash("sha256").update(bytes).digest("hex")});
  }
  stage="one owned profile and bounded ordinary funding";
  session=await request("/auth/v1/signup",{},null);token=session.access_token;check("new isolated session",typeof token==="string");
  current=await refresh();report.profilesCreated=1;check("new profile revision1",current.revision===1);
  await drawAvailable();await sellNeeded();
  for(let round=0;round<3&&current.profileState.coins<350;round++){await quizRound();await drawAvailable();await sellNeeded();}
  report.funding={coins:current.profileState.coins,quizzes:report.quizzesCompleted,answers:report.answersSubmitted,draws:report.draws,cardsSold:report.cardsSold};
  check("funding stays bounded",report.quizzesCompleted<=3&&report.answersSubmitted<=30&&report.draws<=30);
  if(current.profileState.coins<350){report.fundingState="INSUFFICIENT_STOP_NO_EXTRA_PROFILE_OR_CREDIT";throw new Error("BOUNDED_FUNDING_INSUFFICIENT");}
  const baseline=await refresh(),invariant=gameInvariant(baseline.profileState),coins=baseline.profileState.coins;
  stage="real Chrome item purchase";
  browserServer=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:20_000});
  const browser=await chromium.connect(browserServer.wsEndpoint());context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  const bootstrap=await context.newPage();await bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/",{waitUntil:"domcontentloaded",timeout:30_000});
  await bootstrap.evaluate(async({url,key,accessToken,refreshToken})=>{
    const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    const auth=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    const {error}=await auth.auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(error)throw new Error("TEST_SESSION_SETUP_FAILED");auth.auth.stopAutoRefresh();
  },{url,key,accessToken:token,refreshToken:session.refresh_token});await bootstrap.close();
  const actions=[],reads=[];let errors=0,warnings=0;
  context.on("request",req=>{if(req.method()==="POST"&&req.url()===url+"/functions/v1/standard-game-action"){const operation=req.postDataJSON()?.operation;actions.push(operation);if(operation==="cosmetic-action")report.cosmeticActions++;}});
  context.on("response",res=>{if(res.url()===url+"/functions/v1/standard-game-action"&&res.request().postDataJSON()?.operation==="cosmetic-action")reads.push(res.json().then(data=>({status:res.status(),data})));});
  page=await context.newPage();page.setDefaultTimeout(20_000);page.on("pageerror",()=>errors++);page.on("console",m=>{if(m.type()==="error")errors++;if(m.type()==="warning")warnings++;});
  await page.goto(publicPage+"#profile",{waitUntil:"domcontentloaded",timeout:30_000});await page.locator("#connectionBadge.good").waitFor();
  await page.waitForFunction(key=>Boolean(JSON.parse(localStorage.getItem(key)||"null")),remoteKey);
  const gold=page.locator('[data-cosmetic-id="nameplateGold"]');
  await gold.getByRole("button",{name:"購入して装備",exact:true}).click();
  await gold.locator(".cosmetic-item-status").getByText("黄金名札を装備しました。",{exact:true}).waitFor();
  const paid=await refresh();check("one item click purchases and equips with exact350 debit",paid.revision===baseline.revision+1&&paid.profileState.coins===coins-350&&paid.profileState.equipped.nameplate==="nameplateGold");
  check("item purchase ACK not a pending guess",report.cosmeticActions===1&&await page.evaluate(key=>localStorage.getItem(key),pendingKey)===null);
  await inspect("390-purchased");await page.setViewportSize({width:1280,height:900});await inspect("1280-purchased");
  stage="free and owned equip with no second debit";
  const normal=page.locator('[data-cosmetic-id="nameplateDefault"]');await normal.getByRole("button",{name:"装備する",exact:true}).click();
  await normal.locator(".cosmetic-item-status").getByText("標準名札を装備しました。",{exact:true}).waitFor();
  await gold.getByRole("button",{name:"装備する",exact:true}).click();await gold.locator(".cosmetic-item-status").getByText("黄金名札を装備しました。",{exact:true}).waitFor();
  const after=await refresh();check("free then owned equip preserves debit and ownership",after.revision===baseline.revision+3&&after.profileState.coins===coins-350&&after.profileState.cosmeticsOwned.filter(id=>id==="nameplateGold").length===1);
  check("cosmetics leave game inventory tickets records and trophies unchanged",gameInvariant(after.profileState)===invariant);
  stage="reload restores equipped state without another purchase";
  await page.reload({waitUntil:"domcontentloaded",timeout:30_000});await gold.getByRole("button",{name:"装備中",exact:true}).waitFor();
  report.reloadEquippedButtonObserved=true;
  await page.setViewportSize({width:390,height:844});await inspect("390-reloaded",{requireFeedback:false});
  const final=await refresh();check("reload is a read-only exact profile restore",JSON.stringify(final)===JSON.stringify(after)&&await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).equipped.nameplate,remoteKey)==="nameplateGold");
  const acknowledged=await Promise.all(reads);check("exactly three acknowledged cosmetic actions",report.cosmeticActions===3&&acknowledged.length===3&&acknowledged.every(r=>r.status===200&&!r.data.duplicate));
  check("browser makes no match quiz draw or sale writes",actions.every(op=>["cosmetic-catalog","cosmetic-quote","cosmetic-action"].includes(op)));
  check("console warning error and pageerror zero",errors===0&&warnings===0);
  report.liveGameplay="REAL_ITEM_PURCHASE_FREE_OWNED_EQUIP_RELOAD";report.coins={before:coins,after:final.profileState.coins};
}catch(error){failed=true;report.failureStage=stage;report.errorKind=error?.name||"Error";if(error?.code==="ERR_ASSERTION")report.failedCheck=error.message;console.error("FAIL "+stage);}
finally{
  try{if(context)await bounded("context-close",context.close(),10_000);}catch{failed=true;report.browserCleanup="CONTEXT_CLOSE_FAILED";}
  try{await closeOwnedBrowserServer({browserServer,bounded,stage:()=>{}});}catch{failed=true;report.browserCleanup="FAILED";}
  clearTimeout(hardTimeout);report.ok=!failed;report.completedAt=new Date().toISOString();
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));process.exitCode=failed?1:0;
}})().catch(()=>{clearTimeout(hardTimeout);console.error("FAIL unhandled cosmetic canary (redacted)");process.exitCode=1;});
