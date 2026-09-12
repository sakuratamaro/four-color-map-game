"use strict";
// Bounded post-publication navigation only. Credentials stay in memory.
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const {isDeepStrictEqual}=require("node:util");

function parseOptions(args) {
  const candidate = args.find(x => x.startsWith("--candidate="))?.slice(12);
  const report = args.find(x => x.startsWith("--report="))?.slice(9);
  if (!args.includes("--confirm-live") || !/^[0-9a-f]{40}$/.test(candidate || "") || !report)
    throw new Error("Refusing production test without --confirm-live, exact candidate and report.");
  return {candidate, report:path.resolve(report)};
}
function readOnlyRequest(method, pathname, operation) {
  if (["GET","HEAD","OPTIONS"].includes(method)) return true;
  if (method !== "POST") return false;
  if (pathname === "/functions/v1/standard-game-action")
    return ["cosmetic-catalog","cosmetic-quote","cpu-roster"].includes(operation);
  return ["/rest/v1/rpc/fcg_standard_active_room","/rest/v1/rpc/fcg_standard_matchmaking_availability"].includes(pathname);
}
function profileReadbackComparison(actual, expected) {
  const valid=p=>p && Number.isSafeInteger(p.revision) && p.revision>0 && typeof p.displayName==="string"
    && p.profileState && typeof p.profileState==="object" && !Array.isArray(p.profileState);
  return {
    equal:Boolean(valid(actual)&&valid(expected)&&isDeepStrictEqual(actual,expected)),
    sameRevision:actual?.revision===expected?.revision,
    sameDisplayName:actual?.displayName===expected?.displayName,
    sameProfileState:isDeepStrictEqual(actual?.profileState,expected?.profileState)
  };
}
function recordFinalChecks(report,{serverComparison,calls,errors,warnings}) {
  report.serverComparison=serverComparison;
  report.requestCount=calls.length;
  report.consoleCounts={errors,warnings};
  report.finalChecks=[
    {label:"same server profile after all navigation",passed:serverComparison.equal},
    {label:"browser only performs allowed reads",passed:calls.every(c=>readOnlyRequest(c.method,c.pathname,c.operation))},
    {label:"console warning error and pageerror zero",passed:errors===0&&warnings===0}
  ];
  return report.finalChecks.every(result=>result.passed);
}
async function collectFinalChecks(report,{readProfile,baseline,calls,errors,warnings}) {
  let final;
  try { final=await readProfile(); }
  catch(error) { report.finalProfileReadError={kind:error?.name||"Error"}; }
  return recordFinalChecks(report,{serverComparison:profileReadbackComparison(final,baseline),calls,errors,warnings});
}
async function run({candidate,report:reportPath}) {
  // Verify opt-in and a clean exact worktree before loading a browser or contacting production.
  const {execFileSync}=require("node:child_process"),{createHash}=require("node:crypto");
  const root=path.resolve(__dirname,"../../ui-player-copy-20260912");
  const git=(...args)=>execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),...args],
    {cwd:root,windowsHide:true,maxBuffer:2_000_000});
  assert.equal(git("rev-parse","HEAD").toString().trim(),candidate);
  assert.equal(git("status","--porcelain").toString().trim(),"");
  assert.equal(fs.existsSync(reportPath),false,"preserve previous evidence; do not overwrite");
  const {chromium}=require("playwright");
  const {closeOwnedBrowserServer}=require("../tests/helpers/browser-server-cleanup.cjs");
  const publicPage="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
  const config=fs.readFileSync(path.join(root,"online/supabase-config.js"),"utf8");
  const url=config.match(/url:\s*"([^"]+)"/)?.[1],key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
  assert.ok(url&&key);
  const report={subject:"UDL-062-copy-v1.1",candidate,accountsCreated:0,profilesCreated:0,matchesCreated:0,
    gameEconomyActions:0,browserNonReadRequests:0,deletions:0,physicalDevices:"NOT_RUN",faultInjection:"NONE",
    diagnosticsLive:"NOT_RUN_NO_MATCH",assetHashes:[],geometry:[],checks:[]};
  let token,session,browserServer,context,failed=false,stage="published bytes";
  const check=(label,value)=>{assert.ok(value,label);report.checks.push(label);};
  async function bounded(label,promise,ms) {let timer;try{return await Promise.race([promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("BROWSER_STAGE_TIMEOUT "+label)),ms);})]);}finally{clearTimeout(timer);}}
  async function request(endpoint,body) {
    const res=await fetch(url+endpoint,{method:"POST",signal:AbortSignal.timeout(15_000),
      headers:{apikey:key,authorization:"Bearer "+(token||key),"content-type":"application/json"},body:JSON.stringify(body)});
    if(!res.ok)throw new Error("HTTP_"+res.status);return res.json();
  }
  const profile=()=>request("/functions/v1/standard-game-action",
    {operation:"profile",expectedRevision:0,displayName:"CopyCanary",profileState:{}});
  let errors=0,warnings=0;const calls=[];
  try {
    await bounded("whole-canary",(async()=>{
      for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260912-37"]]) {
        const res=await fetch(publicPage+suffix,{cache:"no-store",signal:AbortSignal.timeout(15_000)});
        check(file+": public200",res.status===200);const bytes=Buffer.from(await res.arrayBuffer());
        check(file+": exact candidate bytes",bytes.equals(git("show",candidate+":standard-online-v5/"+file)));
        report.assetHashes.push({file,sha256:createHash("sha256").update(bytes).digest("hex")});
      }
      stage="one isolated profile";
      session=await request("/auth/v1/signup",{});report.accountsCreated=1;token=session.access_token;
      check("new isolated session",typeof token==="string");
      const baseline=await profile();report.profilesCreated=1;check("one initial profile revision",baseline.revision===1);
      browserServer=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:20_000});
      const browser=await chromium.connect(browserServer.wsEndpoint());
      context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
      const bootstrap=await context.newPage();
      await bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/",{waitUntil:"domcontentloaded",timeout:25_000});
      await bootstrap.evaluate(async({url,key,accessToken,refreshToken})=>{
        const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
        const auth=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
        const {error}=await auth.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
        if(error)throw new Error("TEST_SESSION_SETUP_FAILED");auth.auth.stopAutoRefresh();
      },{url,key,accessToken:token,refreshToken:session.refresh_token});await bootstrap.close();
      context.on("request",req=>{
        if(!req.url().startsWith(url+"/"))return;
        const pathname=new URL(req.url()).pathname;
        let operation;try{operation=req.postDataJSON()?.operation;}catch{}
        calls.push({method:req.method(),pathname,operation});
        if(!readOnlyRequest(req.method(),pathname,operation))report.browserNonReadRequests++;
        if(req.method()==="POST"&&["gacha","card-sale","cosmetic-action","quiz-start","quiz-answer","quiz-finish","action","setup"].includes(operation))report.gameEconomyActions++;
        if(req.method()==="POST"&&(operation==="cpu-start"||pathname==="/rest/v1/rpc/fcg_standard_create_room"))report.matchesCreated++;
      });
      const page=await context.newPage();page.setDefaultTimeout(15_000);
      page.on("pageerror",()=>errors++);page.on("console",m=>{if(m.type()==="error")errors++;if(m.type()==="warning")warnings++;});
      stage="ordinary tabs and connection";
      await page.goto(publicPage+"#home",{waitUntil:"domcontentloaded",timeout:25_000});
      await page.locator("#connectionBadge.good").waitFor();
      const remoteKey="fourColorMapGame.standard.online.v5.remote-profile";
      await page.waitForFunction(key=>Boolean(JSON.parse(localStorage.getItem(key)||"null")),remoteKey);
      for(const width of [390,1280]) {
        await page.setViewportSize({width,height:width===390?844:900});
        for(const tab of ["home","battle","quiz","cards","profile"]) {
          await page.locator('[data-app-tab="'+tab+'"]').click();
          check(width+" "+tab+": one plain connected badge",await page.locator("#connectionBadge").count()===1
            &&await page.locator("#connectionBadge").textContent()==="接続済み"
            &&await page.locator("#connectionBadge").isVisible());
          check(width+" "+tab+": selected tab",await page.locator("body").getAttribute("data-active-tab")===tab);
          check(width+" "+tab+": home-only explanatory message",await page.locator("#connectionMessage").isVisible()===(tab==="home"));
          check(width+" "+tab+": no horizontal overflow",await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        }
        await page.locator('[data-app-tab="home"]').click();
        check(width+": plain connection message",await page.locator("#connectionMessage").textContent()==="ゲームに接続できました。");
        report.geometry.push({width,overflow:false,tabs:5});
        await page.screenshot({path:reportPath+"."+width+"-home.png"});
      }
      // In a fresh roomless profile, match diagnostics are deliberately unavailable.
      const details=page.locator("details.sync-details");
      check("diagnostics closed by default",await details.getAttribute("open")===null);
      check("diagnostics retain explicit label",await details.locator("summary").textContent()==="接続の詳細（調査用）");
      check("no match invented to expose diagnostics",!await details.isVisible());
      stage="read-only reload";
      await page.reload({waitUntil:"domcontentloaded",timeout:25_000});await page.locator("#connectionBadge.good").waitFor();
      await page.waitForFunction(key=>Boolean(JSON.parse(localStorage.getItem(key)||"null")),remoteKey);
      check("reload retains plain connected state",await page.locator("#connectionMessage").textContent()==="ゲームに接続できました。");
      const finalPass=await collectFinalChecks(report,{readProfile:profile,baseline,calls,errors,warnings});
      // Persist every independent outcome before the aggregate assertion can throw.
      fs.writeFileSync(reportPath,JSON.stringify({...report,ok:false,status:"FINAL_CHECKS_CAPTURED_NOT_YET_ACCEPTED"},null,2)+"\n");
      for(const result of report.finalChecks)if(result.passed)report.checks.push(result.label);
      assert.ok(finalPass,"final server, operation allowlist and console checks");
    })(),180_000);
  } catch(error) {
    failed=true;report.failureStage=stage;report.errorKind=error?.name||"Error";
    if(error?.code==="ERR_ASSERTION")report.failedCheck=error.message;
    console.error("FAIL "+stage);
  } finally {
    try{if(context)await bounded("context-close",context.close(),10_000);}catch{failed=true;report.browserCleanup="CONTEXT_CLOSE_FAILED";}
    try{await closeOwnedBrowserServer({browserServer,bounded,stage:()=>{}});}catch{failed=true;report.browserCleanup="FAILED";}
    report.ok=!failed;report.completedAt=new Date().toISOString();
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
  }
  return failed?1:0;
}
if(require.main===module) {
  let options;try{options=parseOptions(process.argv.slice(2));}catch(error){console.error(error.message);process.exit(2);}
  run(options).then(code=>{process.exitCode=code;}).catch(()=>{console.error("FAIL candidate preparation (redacted)");process.exitCode=1;});
}
module.exports={parseOptions,readOnlyRequest,profileReadbackComparison,recordFinalChecks,collectFinalChecks};
