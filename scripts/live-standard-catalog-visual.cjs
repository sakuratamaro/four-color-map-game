"use strict";
// Genuine review030: zero-account public visual supplement, never an authenticated canary rerun.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process");
const {createHash}=require("node:crypto");
const {parseOptions:parseCatalogOptions,screenshotPath,isSameIds}=require("./live-standard-skill-catalog-canary.cjs");
const {closeOwnedBrowserServer}=require("../tests/helpers/browser-server-cleanup.cjs");
const PUBLIC="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
function parseOptions(args){
  if(!args.includes("--confirm-public-visual"))throw Error("Refusing visual test without explicit opt-in");
  return parseCatalogOptions(args.map(a=>a==="--confirm-public-visual"?"--confirm-live":a));
}
async function withDeadline(work,ms,onTimeout=()=>{}){
  let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout();reject(Error("VISUAL_DEADLINE"));},ms);})]);}
  finally{clearTimeout(timer);}
}
async function blockBackend(context,backend,audit){
  const origin=new URL(backend).origin,host=new URL(backend).host;
  await context.route(url=>url.origin===origin,async route=>{
    const req=route.request();let operation;try{operation=req.postDataJSON()?.operation;}catch{}
    audit.blocked.push({method:req.method(),pathname:new URL(req.url()).pathname,operation:operation||null});
    await route.abort("blockedbyclient");
  });
  await context.routeWebSocket(url=>url.host===host,ws=>{audit.blocked.push({method:"WEBSOCKET",pathname:new URL(ws.url()).pathname,operation:null});ws.close();});
  context.on("response",response=>{if(new URL(response.url()).origin===origin)audit.backendResponses++;});
}
function consoleRecord(message){
  let source="";try{const u=new URL(message.location().url);source=u.origin+u.pathname;}catch{}
  return {type:message.type(),firstLine:message.text().split("\n")[0].slice(0,240),source,
    supabaseStack:message.text().includes("/npm/@supabase/")};
}
function expectedBlockedConsole(event,blocked,backend){
  const origin=new URL(backend).origin;
  if(event.type!=="error"||blocked.length===0)return false;
  const blockedResource=blocked.some(request=>event.source===origin+request.pathname);
  if(blockedResource&&["Failed to load resource: net::ERR_BLOCKED_BY_CLIENT","Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector"].includes(event.firstLine))return true;
  const authBlocked=blocked.some(x=>x.pathname==="/auth/v1/signup");
  if(!authBlocked)return false;
  if(event.firstLine==="AuthRetryableFetchError: Failed to fetch"&&event.source.startsWith(PUBLIC))return true;
  return event.firstLine==="TypeError: Failed to fetch"&&(event.supabaseStack||event.source.startsWith("https://cdn.jsdelivr.net/npm/@supabase/"));
}
function saveResult(file,result){
  assert.ok(!fs.existsSync(file),"never overwrite prior result");
  fs.writeFileSync(file,JSON.stringify(result,null,2)+"\n",{flag:"wx"});
}
async function run({candidate,report:out}){
  const root=path.resolve(__dirname,"../../skill-catalog-20260912");
  const git=(...args)=>execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),...args],{cwd:root,windowsHide:true,maxBuffer:2_000_000});
  assert.equal(git("rev-parse","HEAD").toString().trim(),candidate);assert.equal(git("status","--porcelain").toString().trim(),"");
  const config=fs.readFileSync(path.join(root,"online/supabase-config.js"),"utf8"),backend=config.match(/url:\s*"([^"]+)"/)?.[1];assert.ok(backend);
  const {chromium}=require("playwright"),abort=new AbortController();
  const result={subject:"UDL-066-catalog-v1",candidate,review:"CHATGPT-REVIEW-20260913-030",profileAttempts:0,accountsCreated:0,profilesCreated:0,matchesCreated:0,economyActions:0,deletions:0,
    backend:"ALL_BLOCKED_BEFORE_NAVIGATION",authenticatedReload:"NOT_RUN",persistedProfileComparison:"NOT_APPLICABLE_USE_ORIGINAL_AUTHENTICATED_AUDIT",
    physicalDevices:"NOT_RUN",visualInspection:"PENDING_EXTERNAL_IMAGE_REVIEW",assetHashes:[],geometry:[],screenshots:[],checks:[]};
  const audit={blocked:[],backendResponses:0,console:[],pageErrors:0};let browserServer,context,failed=false,stage="public bytes";
  const check=(label,passed)=>{abort.signal.throwIfAborted();assert.ok(passed,label);result.checks.push(label);};
  try{
    await withDeadline((async()=>{
      for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260912-40"],["standard-skill-registry.generated.js","standard-skill-registry.generated.js?v=20260912-2"],["skill-catalog.css","skill-catalog.css?v=20260912-1"]]){
        const response=await fetch(PUBLIC+suffix,{cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
        check(file+": HTTP200",response.status===200);const bytes=Buffer.from(await response.arrayBuffer());
        check(file+": strict candidate bytes",bytes.equals(git("show",candidate+":standard-online-v5/"+file)));
        result.assetHashes.push({file,sha256:createHash("sha256").update(bytes).digest("hex")});
      }
      stage="empty Chrome and backend barrier";
      browserServer=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:15000});
      abort.signal.throwIfAborted();const browser=await chromium.connect(browserServer.wsEndpoint());
      context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce",serviceWorkers:"block"});
      await blockBackend(context,backend,audit);
      const page=await context.newPage();page.setDefaultTimeout(10000);
      page.on("pageerror",()=>audit.pageErrors++);
      page.on("console",message=>{if(["error","warning"].includes(message.type()))audit.console.push(consoleRecord(message));});
      stage="profile-free catalog rendering";
      await page.goto(PUBLIC+"#cards",{waitUntil:"domcontentloaded",timeout:20000});
      await page.locator("#cardLibraryPanel").waitFor({state:"visible"});
      await page.waitForFunction(()=>document.querySelectorAll("#cardInventory button[data-catalog-skill]").length===21);
      const expected=Object.values(require(path.join(root,"standard/standard-skill-registry.js")).STANDARD_SKILLS)
        .filter(d=>d.standardEngineImplemented&&(d.standardUiEnabled||d.alphaUiEnabled)).map(d=>d.id);
      check("exact21 profile-free",isSameIds(await page.locator("#cardInventory button").evaluateAll(els=>els.map(el=>el.dataset.catalogSkill)),expected));
      for(const width of [390,768,1280]){
        abort.signal.throwIfAborted();stage="layout and PNG "+width;await page.setViewportSize({width,height:width===390?844:900});
        const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
          columns:getComputedStyle(document.querySelector("#cardInventory .catalog-grid")).gridTemplateColumns.split(" ").length,
          cards:[...document.querySelectorAll("#cardInventory button")].map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,overflow:el.scrollWidth>el.clientWidth};})}));
        result.geometry.push({width,...geometry});check(width+": readable 44px targets columns no overflow",!geometry.overflow
          &&geometry.columns===(width===390?2:width===768?3:4)&&geometry.cards.length===21&&geometry.cards.every(c=>c.width>=44&&c.height>=44&&!c.overflow));
        const png=screenshotPath(out,width);assert.ok(!fs.existsSync(png));await page.locator("#cardLibraryPanel").screenshot({path:png});
        check(width+": PNG really saved",fs.readFileSync(png).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
        result.screenshots.push(path.basename(png));
      }
      stage="profile-free reload";
      await page.reload({waitUntil:"domcontentloaded",timeout:20000});
      await page.waitForFunction(()=>document.querySelectorAll("#cardInventory button[data-catalog-skill]").length===21);
      check("reload exact21",isSameIds(await page.locator("#cardInventory button").evaluateAll(els=>els.map(el=>el.dataset.catalogSkill)),expected));
      const card=page.locator('[data-catalog-skill="legalRecolor"]');await card.scrollIntoViewIfNeeded();await card.focus();await page.keyboard.press("Enter");
      await page.locator("#skillInfoDialog[open]").waitFor();
      check("reload unowned detail correct WORK timing",(await page.locator("#skillInfoTiming").textContent()).includes("渡す前")
        &&(await page.locator("#skillInfoAvailability").textContent()).includes("通常ガチャからは出ません"));
      await page.keyboard.press("Escape");check("reload Escape restores opener",await card.evaluate(el=>el===document.activeElement));
      check("no saved profile or auth introduced",await page.evaluate(()=>localStorage.getItem("fourColorMapGame.standard.online.v5.remote-profile")===null
        &&!Object.keys(localStorage).some(k=>k.startsWith("sb-")&&k.endsWith("-auth-token"))));
      stage="visual probe complete";
    })(),90_000,()=>abort.abort());
  }catch(error){failed=true;result.failureStage=stage;result.errorKind=error.name;if(error.code==="ERR_ASSERTION")result.failedCheck=error.message;}
  finally{
    abort.abort();
    try{if(context)await withDeadline(context.close(),10000);}catch{failed=true;result.contextCleanup="FAILED";}
    try{await closeOwnedBrowserServer({browserServer,bounded:(_label,work,ms)=>withDeadline(work,ms),stage:()=>{}});}catch{failed=true;result.browserCleanup="FAILED";}
    result.backendSendAttemptsBlocked=audit.blocked;result.blockedCount=audit.blocked.length;result.backendResponses=audit.backendResponses;
    // No route ever continues or connects to the server: all attempted backend traffic is locally intercepted.
    result.backendSentCount=0;result.pageErrors=audit.pageErrors;
    result.console=audit.console.map(event=>({...event,expectedBlockedConnection:expectedBlockedConsole(event,audit.blocked,backend)}));
    const unexpected=result.console.filter(event=>!event.expectedBlockedConnection);
    result.finalChecks=[{label:"no backend response or exception",passed:audit.backendResponses===0&&audit.pageErrors===0},
      {label:"no unexpected console errors or warnings",passed:unexpected.length===0}];
    result.ok=!failed&&result.finalChecks.every(c=>c.passed);result.completedAt=new Date().toISOString();
    saveResult(out,result);console.log(JSON.stringify({ok:result.ok,stage,checks:result.checks.length,blocked:result.blockedCount,unexpectedConsole:unexpected.length,report:path.basename(out)}));
  }
  return result.ok?0:1;
}
if(require.main===module){let options;try{options=parseOptions(process.argv.slice(2));}catch(error){console.error(error.message);process.exit(2);}
  run(options).then(code=>{process.exitCode=code;}).catch(()=>{console.error("Visual preparation failed (redacted)");process.exitCode=1;});}
module.exports={parseOptions,withDeadline,blockBackend,expectedBlockedConsole,saveResult};
