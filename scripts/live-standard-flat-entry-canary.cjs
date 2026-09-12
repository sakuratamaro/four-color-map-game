"use strict";
// Successor UI navigation only. Reuse existing request policy, not old062 acceptance criteria.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {execFileSync}=require("node:child_process"),{createHash}=require("node:crypto"),{isDeepStrictEqual}=require("node:util");
const {readOnlyRequest}=require("./live-standard-player-copy-canary.cjs");
const {closeOwnedBrowserServer}=require("../tests/helpers/browser-server-cleanup.cjs");
function parseOptions(args) {
  const candidate=args.find(x=>x.startsWith("--candidate="))?.slice(12),out=args.find(x=>x.startsWith("--report="))?.slice(9);
  if(!args.includes("--confirm-live")||!/^[0-9a-f]{40}$/.test(candidate||"")||!out
      ||args.length!==3||args.some(x=>x!=="--confirm-live"&&!x.startsWith("--candidate=")&&!x.startsWith("--report=")))
    throw new Error("Refusing production test without exact candidate, --confirm-live and a new in-workspace report.");
  const report=path.resolve(out),root=path.resolve(__dirname,"../docs")+path.sep;
  if(!report.startsWith(root)||!report.endsWith(".json")||fs.existsSync(report))throw new Error("Report must be new and inside governance docs.");
  return {candidate,report};
}
function persistedComparison(actual,expected) {
  const valid=p=>Boolean(p&&Number.isSafeInteger(p.revision)&&p.revision>0&&p.profileState&&typeof p.profileState==="object"&&!Array.isArray(p.profileState));
  return {validSnapshots:valid(actual)&&valid(expected),
    sameRevision:valid(actual)&&valid(expected)&&actual.revision===expected.revision,
    sameProfileState:valid(actual)&&valid(expected)&&isDeepStrictEqual(actual.profileState,expected.profileState),
    responseName:{beforePresent:typeof expected?.displayName==="string",afterPresent:typeof actual?.displayName==="string",
      same:actual?.displayName===expected?.displayName},
    responseNameDisposition:"INFORMATIONAL_UNRESOLVED_REG-20260912-PROFILE-RESPONSE-CONTRACT-01"};
}
function finalResults({actual,expected,calls,errors,warnings}) {
  const comparison=persistedComparison(actual,expected);
  return {comparison,checks:[
    {label:"persisted profileState and revision unchanged",passed:comparison.validSnapshots&&comparison.sameRevision&&comparison.sameProfileState},
    {label:"only permitted browser reads",passed:calls.every(c=>readOnlyRequest(c.method,c.pathname,c.operation))},
    {label:"console and page errors zero",passed:errors===0&&warnings===0}
  ]};
}
async function run({candidate,report:out}) {
  const root=path.resolve(__dirname,"../../ui-flat-entry-20260912");
  const git=(...args)=>execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),...args],{cwd:root,windowsHide:true,maxBuffer:2_000_000});
  assert.equal(git("rev-parse","HEAD").toString().trim(),candidate);
  assert.equal(git("status","--porcelain").toString().trim(),"");
  const {chromium}=require("playwright");
  const publicPage="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
  const config=fs.readFileSync(path.join(root,"online/supabase-config.js"),"utf8");
  const url=config.match(/url:\s*"([^"]+)"/)?.[1],key=config.match(/publishableKey:\s*"([^"]+)"/)?.[1];assert.ok(url&&key);
  const report={subject:"UDL-023-entrance-v2",candidate,profileAttempts:0,profilesCreated:0,matchesCreated:0,
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
  const profile=(finalRead=false)=>request("/functions/v1/standard-game-action",{operation:"profile",expectedRevision:0,displayName:"FlatEntryCanary",profileState:{}},finalRead);
  try {
    await bounded("whole-canary",(async()=>{
      for(const [file,suffix] of [["index.html",""],["app.js","app.js?v=20260912-39"],["ui-diet.css","ui-diet.css?v=20260912-3"]]){
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
      stage="public flat controls";
      await page.goto(publicPage+"#battle",{waitUntil:"domcontentloaded",timeout:25_000});
      await page.locator("#connectionBadge.good").waitFor();
      await page.waitForFunction(()=>Boolean(JSON.parse(localStorage.getItem("fourColorMapGame.standard.online.v5.remote-profile")||"null")));
      for(const width of [390,768,1280]){
        abort.signal.throwIfAborted();await page.setViewportSize({width,height:width===390?844:900});
        await page.locator('[data-app-tab="battle"]').click();
        const g=await page.evaluate(()=>{
          const ids=["startStandardCpuLobby","chooseFriendBattle","choosePublicBattle"],grid=document.querySelector("#lobby .lobby-choice-grid");
          const boxes=ids.map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return {width:r.width,height:r.height,top:r.top,hit:hit===el||el.contains(hit),peer:el.parentElement===grid};});
          return {overflow:document.documentElement.scrollWidth>innerWidth,children:grid.children.length,boxes,removed:!document.querySelector("#humanBattleTitle, #standardCpuChoice, #lobby .section-kicker")};
        });
        report.geometry.push({width,...g});check(width+": peer choices fit",!g.overflow&&g.children===3&&g.removed
          &&g.boxes.every(b=>b.width>=44&&b.height>=44&&b.hit&&b.peer)&&Math.max(...g.boxes.map(b=>b.top))-Math.min(...g.boxes.map(b=>b.top))<1);
        await page.locator("#chooseFriendBattle").focus();await page.keyboard.press("Enter");
        check(width+": friend route",await page.locator("#friendBattlePanel").isVisible()&&await page.locator("#chooseFriendBattle").getAttribute("aria-expanded")==="true");
        await page.locator("#choosePublicBattle").click();
        check(width+": public route",!await page.locator("#friendBattlePanel").isVisible()&&await page.locator("#matchmakingPanel").isVisible());
        check(width+": no automatic waiting",!await page.locator("#matchmakingWait").isVisible());
        await page.locator("#startStandardCpuLobby").click();await page.locator("#cpuRosterDialog[open]").waitFor();
        await page.waitForFunction(()=>document.querySelectorAll("#cpuRosterGrid .cpu-character-card").length===10,null,{timeout:12_000});
        check(width+": ten CPU choices",await page.locator("#cpuRosterGrid .cpu-character-card").count()===10);
        await page.keyboard.press("Escape");check(width+": CPU cancel restores focus",await page.evaluate(()=>document.activeElement?.id)==="startStandardCpuLobby");
        await page.locator("#lobbyTitle").focus();check(width+": heading has no frame",await page.locator("#lobbyTitle").evaluate(el=>getComputedStyle(el).outlineStyle)==="none");
      }
      await page.reload({waitUntil:"domcontentloaded"});await page.locator("#connectionBadge.good").waitFor();
      await page.locator('[data-app-tab="battle"]').click();check("reload still has three peer choices",await page.locator("#lobby .lobby-choice-grid > button").count()===3);
      stage="navigation completed";
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
module.exports={parseOptions,persistedComparison,finalResults};
