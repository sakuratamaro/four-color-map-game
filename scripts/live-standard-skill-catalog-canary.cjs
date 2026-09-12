"use strict";
// UDL066 exact approved catalog acceptance; no matches, acquisitions or injected profile state.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {execFileSync}=require("node:child_process"),{createHash}=require("node:crypto");
const {readOnlyRequest}=require("./live-standard-player-copy-canary.cjs");
const {closeOwnedBrowserServer}=require("../tests/helpers/browser-server-cleanup.cjs");
const {parseOptions:parseBaseOptions,persistedComparison,finalResults}=require("./live-standard-flat-entry-canary.cjs");
const APPROVED_SHA="2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152";
function parseOptions(args) {
  const options=parseBaseOptions(args);
  if(options.candidate!==APPROVED_SHA)throw new Error("Refusing candidate outside genuine review029.");
  return options;
}
async function run({candidate,report:out}) {
  const root=path.resolve(__dirname,"../../skill-catalog-20260912");
  const git=(...args)=>execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),...args],{cwd:root,windowsHide:true,maxBuffer:2_000_000});
  assert.equal(git("rev-parse","HEAD").toString().trim(),candidate);
  assert.equal(git("status","--porcelain").toString().trim(),"");
  const {chromium}=require("playwright");
  const publicPage="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
  const config=fs.readFileSync(path.join(root,"online/supabase-config.js"),"utf8");
  const url=config.match(/url:\s*"([^"]+)"/)?.[1],key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];assert.ok(url&&key);
  const report={subject:"UDL-066-catalog-v1",review:"CHATGPT-REVIEW-20260913-029",candidate,profileAttempts:0,profilesCreated:0,matchesCreated:0,
    economyActions:0,deletions:0,physicalDevices:"NOT_RUN",faultInjection:"NONE",writeProtection:"DENY_UNEXPECTED_BROWSER_REQUESTS",
    initialAcceptance062:"CLOSED_NO_ADDITIONAL062_PROFILE",assetHashes:[],geometry:[],checks:[]};
  let token,browserServer,context,baseline,failed=false,stage="public bytes",errors=0,warnings=0;const calls=[];
  const abort=new AbortController();
  const bounded=async(label,promise,ms)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{
    timer=setTimeout(()=>{if(label==="whole-canary")abort.abort();reject(new Error(label));},ms);
  })]);}finally{clearTimeout(timer);}};
  const check=(label,value)=>{abort.signal.throwIfAborted();assert.ok(value,label);report.checks.push(label);};
  const request=async(endpoint,body,finalRead=false)=>{
    if(!finalRead)abort.signal.throwIfAborted();
    const res=await fetch(url+endpoint,{method:"POST",signal:finalRead?AbortSignal.timeout(15_000):AbortSignal.any([abort.signal,AbortSignal.timeout(15_000)]),
      headers:{apikey:key,authorization:"Bearer "+(token||key),"content-type":"application/json"},body:JSON.stringify(body)});
    if(!res.ok)throw new Error("HTTP_"+res.status);return res.json();
  };
  const profile=(finalRead=false)=>request("/functions/v1/standard-game-action",{operation:"profile",expectedRevision:0,displayName:"SkillCatalogCanary",profileState:{}},finalRead);
  try {
    await bounded("whole-canary",(async()=>{
      for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260912-40"],["standard-skill-registry.generated.js","standard-skill-registry.generated.js?v=20260912-2"],["skill-catalog.css","skill-catalog.css?v=20260912-1"]]){
        const res=await fetch(publicPage+suffix,{cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15_000)])});
        check(file+": HTTP200",res.status===200);const bytes=Buffer.from(await res.arrayBuffer());
        check(file+": exact candidate bytes",bytes.equals(git("show",candidate+":standard-online-v5/"+file)));
        report.assetHashes.push({file,sha256:createHash("sha256").update(bytes).digest("hex")});
      }
      stage="one dedicated profile";report.profileAttempts=1;
      const session=await request("/auth/v1/signup",{});token=session.access_token;check("fresh isolated session",typeof token==="string");
      baseline=await profile();report.profilesCreated=1;check("one initial profile revision",baseline.revision===1);
      browserServer=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:20_000});
      abort.signal.throwIfAborted();
      const browser=await chromium.connect(browserServer.wsEndpoint());context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
      const bootstrap=await context.newPage();
      await bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/",{waitUntil:"domcontentloaded",timeout:25_000});
      await bootstrap.evaluate(async({url,key,accessToken,refreshToken})=>{
        const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
        const auth=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
        const {error}=await auth.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
        if(error)throw new Error("TEST_SESSION_SETUP_FAILED");auth.auth.stopAutoRefresh();
      },{url,key,accessToken:token,refreshToken:session.refresh_token});await bootstrap.close();
      await context.route(url+"/**",async route=>{
        const req=route.request(),pathname=new URL(req.url()).pathname;let operation;try{operation=req.postDataJSON()?.operation;}catch{}
        const call={method:req.method(),pathname,operation};calls.push(call);
        if(abort.signal.aborted||!readOnlyRequest(call.method,pathname,operation))return route.abort("blockedbyclient");
        return route.continue();
      });
      const page=await context.newPage();page.setDefaultTimeout(12_000);
      page.on("pageerror",()=>errors++);page.on("console",m=>{if(m.type()==="error")errors++;if(m.type()==="warning")warnings++;});
      stage="public catalog";
      await page.goto(publicPage+"#cards",{waitUntil:"domcontentloaded",timeout:25_000});
      await page.locator("#connectionBadge.good").waitFor();
      await page.waitForFunction(()=>Boolean(JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.remote-profile")||"null")));
      await page.locator('[data-app-tab="cards"]').click();
      const cards=page.locator("#cardInventory button[data-catalog-skill]");
      const expected=Object.values(require(path.join(root,"standard/standard-skill-registry.js")).STANDARD_SKILLS)
        .filter(d=>d.standardEngineImplemented&&(d.standardUiEnabled||d.alphaUiEnabled));
      check("authoritative 21 exact unique entries",expected.length===21&&isSameIds(await cards.evaluateAll(els=>els.map(el=>el.dataset.catalogSkill)),expected.map(d=>d.id)));
      check("four groups and normal19 experimental2",await page.locator("#cardInventory section").count()===4
        &&await page.locator('#cardInventory section:not([data-catalog-group="lab"]) button').count()===19
        &&await page.locator('#cardInventory [data-catalog-group="lab"] button').count()===2);
      for(const [i,definition] of expected.entries()){
        abort.signal.throwIfAborted();
        const card=page.locator('[data-catalog-skill="'+definition.id+'"]');
        await card.scrollIntoViewIfNeeded();await card.focus();await page.keyboard.press(i%2?"Space":"Enter");
        await page.locator("#skillInfoDialog[open]").waitFor();
        const title=await page.locator("#skillInfoTitle").textContent(),body=await page.locator("#skillInfoBody").textContent();
        const timing=await page.locator("#skillInfoTiming").textContent(),availability=await page.locator("#skillInfoAvailability").textContent();
        check(definition.id+": readable correct detail and timing",title===definition.displayName&&body.length>8
          &&timing.includes(definition.timing==="COLOR"?"塗る前":"渡す前"));
        if(!definition.standardUiEnabled){
          check(definition.id+": unowned experiment readable, not normal gacha",
            await card.locator(".inventory-count").textContent()==="×0"&&await card.isEnabled()
            &&availability.includes("実験ルール専用。通常ガチャからは出ません"));
        }
        await page.keyboard.press("Escape");
        check(definition.id+": Escape restores opener",await card.evaluate(el=>el===document.activeElement));
      }
      report.screenshots=[];
      for(const width of [390,768,1280]){
        abort.signal.throwIfAborted();await page.setViewportSize({width,height:width===390?844:900});
        await page.locator("#cardLibraryPanel").scrollIntoViewIfNeeded();
        const geometry=await page.evaluate(()=>{
          const cards=[...document.querySelectorAll("#cardInventory button")];
          return {overflow:document.documentElement.scrollWidth>innerWidth,
            columns:getComputedStyle(document.querySelector("#cardInventory .catalog-grid")).gridTemplateColumns.split(" ").length,
            cards:cards.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,overflow:el.scrollWidth>el.clientWidth};})};
        });
        report.geometry.push({width,...geometry});check(width+": catalog readable targets and columns",!geometry.overflow
          &&geometry.columns===(width===390?2:width===768?3:4)&&geometry.cards.every(c=>c.width>=44&&c.height>=44&&!c.overflow));
        const screenshot=out.replace(/\\.json$/,"-"+width+".png");
        assert.ok(!fs.existsSync(screenshot),"new screenshot only");
        await page.locator("#cardLibraryPanel").screenshot({path:screenshot});report.screenshots.push(path.basename(screenshot));
      }
      await page.reload({waitUntil:"domcontentloaded"});await page.locator("#connectionBadge.good").waitFor();
      await page.locator('[data-app-tab="cards"]').click();
      check("reload retains all21 readable entries",await cards.count()===21);
      await page.locator('[data-catalog-skill="legalRecolor"]').click();await page.locator("#skillInfoDialog[open]").waitFor();
      check("reload retains legalRecolor WORK timing", (await page.locator("#skillInfoTiming").textContent()).includes("渡す前"));
      await page.keyboard.press("Escape");stage="catalog completed";
    })(),180_000);
  }catch(error){failed=true;report.failureStage=stage;report.errorKind=error?.name||"Error";if(error?.code==="ERR_ASSERTION")report.failedCheck=error.message;}
  finally{
    abort.abort();
    try{if(context)await bounded("context-close",context.close(),10_000);}catch{failed=true;report.browserCleanup="CONTEXT_CLOSE_FAILED";}
    try{await closeOwnedBrowserServer({browserServer,bounded,stage:()=>{}});}catch{failed=true;report.browserCleanup="FAILED";}
    // Always collect the three independent outcomes, including after a UI failure.
    let actual;
    if(baseline){try{actual=await profile(true);}catch(error){report.finalReadError=error?.name||"Error";}}
    const result=finalResults({actual,expected:baseline,calls,errors,warnings});
    report.comparison=result.comparison;report.finalChecks=result.checks;report.requestCount=calls.length;report.consoleCounts={errors,warnings};
    report.finalReadScope=baseline?"ONE_OWNED_PROFILE_READ_AFTER_BROWSER_CLOSED":"NOT_RUN_NO_PROFILE";
    fs.writeFileSync(out,JSON.stringify({...report,ok:false,status:"FINAL_CHECKS_CAPTURED_NOT_YET_ACCEPTED"},null,2)+"\n");
    failed=failed||!result.checks.every(x=>x.passed);
    report.ok=!failed;report.completedAt=new Date().toISOString();fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
  }
  return failed?1:0;
}
if(require.main===module){let o;try{o=parseOptions(process.argv.slice(2));}catch(e){console.error(e.message);process.exit(2);}
  run(o).then(code=>{process.exitCode=code;}).catch(()=>{console.error("FAIL candidate preparation (redacted)");process.exitCode=1;});}
function isSameIds(actual,expected){return actual.length===new Set(actual).size&&actual.length===expected.length&&actual.slice().sort().every((id,i)=>id===expected.slice().sort()[i]);}
module.exports={parseOptions,persistedComparison,finalResults,isSameIds};
