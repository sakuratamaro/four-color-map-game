"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),http=require("node:http");
const {chromium}=require("playwright");
const file=path.join(__dirname,"../scripts/live-standard-catalog-visual.cjs");
const {parseOptions,withDeadline,blockBackend,expectedBlockedConsole,saveResult}=require(file);
const {screenshotPath}=require("../scripts/live-standard-skill-catalog-canary.cjs");
const {closeOwnedBrowserServer}=require("./helpers/browser-server-cleanup.cjs");
test("visual supplement uses a new exact scoped report and a distinct zero-account opt-in",()=>{
 const report=path.join(__dirname,"../docs/VISUAL_NOT_EXECUTED.json");
 const args=["--confirm-public-visual","--candidate=2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152","--report="+report];
 assert.equal(parseOptions(args).report,report);
 for(const x of [args.slice(1),args.concat("--extra-profile"),args.map(a=>a==="--confirm-public-visual"?"--confirm-live":a)])assert.throws(()=>parseOptions(x));
});
test("visual deadline invokes abort and rejects without a polling loop",async()=>{
 let aborted=false;const start=Date.now();
 await assert.rejects(withDeadline(new Promise(()=>{}),25,()=>{aborted=true;}),/VISUAL_DEADLINE/);
 assert.equal(aborted,true);assert.ok(Date.now()-start<2000);
 assert.equal(await withDeadline(Promise.resolve("ok"),50),"ok");
});
test("intentional blocked authentication is separate from unrelated console and page defects",()=>{
 const backend="https://fixture.supabase.co",blocked=[{pathname:"/auth/v1/signup"}];
 const resource={type:"error",firstLine:"Failed to load resource: net::ERR_BLOCKED_BY_CLIENT",source:backend+"/auth/v1/signup"};
 assert.equal(expectedBlockedConsole(resource,blocked,backend),true);
 assert.equal(expectedBlockedConsole(resource,[],backend),false);
 assert.equal(expectedBlockedConsole({...resource,source:"https://cdn.example/missing.js"},blocked,backend),false);
 const app={type:"error",firstLine:"AuthRetryableFetchError: Failed to fetch",source:"https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/app.js"};
 assert.equal(expectedBlockedConsole(app,blocked,backend),true);
 assert.equal(expectedBlockedConsole({...app,firstLine:"TypeError: Failed to fetch"},blocked,backend),false);
 assert.equal(expectedBlockedConsole({...app,firstLine:"TypeError: null is not an object"},blocked,backend),false);
 assert.equal(expectedBlockedConsole({...app,type:"warning"},blocked,backend),false);
});
test("local Chrome proves backend HTTP and WS interception, actual PNG save, and failure evidence preservation",{timeout:60000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"catalog-visual-local-"));let incoming=0,browserServer,context;
 const server=http.createServer((_req,res)=>{incoming++;res.end("UNEXPECTED");});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const backend="http://127.0.0.1:"+server.address().port,audit={blocked:[],backendResponses:0};
 try{
   browserServer=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:15000});
   const browser=await chromium.connect(browserServer.wsEndpoint());context=await browser.newContext({serviceWorkers:"block"});
   await blockBackend(context,backend,audit);
   const page=await context.newPage();await page.setContent("<main><p>local PNG contract</p></main>");
   assert.equal(await page.evaluate(async url=>{try{await fetch(url+"/auth/v1/signup",{method:"POST"});return true;}catch{return false;}},backend),false);
   await page.evaluate(url=>new Promise(resolve=>{const ws=new WebSocket(url.replace("http:","ws:")+"/realtime");ws.onclose=()=>resolve();ws.onerror=()=>resolve();}),backend);
   assert.equal(incoming,0);assert.equal(audit.backendResponses,0);
   assert.ok(audit.blocked.some(x=>x.method==="POST"));assert.ok(audit.blocked.some(x=>x.method==="WEBSOCKET"));
   const report=path.join(dir,"result.json"),png=screenshotPath(report,390);
   await page.screenshot({path:png});
   assert.deepEqual([...fs.readFileSync(png).subarray(0,8)],[137,80,78,71,13,10,26,10]);
   saveResult(report,{ok:false,failureStage:"synthetic pre-layout failure",blockedCount:audit.blocked.length});
   assert.equal(JSON.parse(fs.readFileSync(report,"utf8")).ok,false);
   assert.throws(()=>saveResult(report,{ok:true}),/never overwrite/);
 }finally{
   if(context)await withDeadline(context.close(),10000);
   await closeOwnedBrowserServer({browserServer,bounded:(_s,p,ms)=>withDeadline(p,ms),stage:()=>{}});
   await new Promise(resolve=>server.close(resolve));
 }
});
test("visual production driver keeps byte gates, no auth setup, and independent finally results",()=>{
 const s=fs.readFileSync(file,"utf8");
 assert.ok(s.indexOf('bytes.equals(git("show"')<s.indexOf('chromium.launchServer'));
 assert.ok(s.indexOf('await blockBackend(context,backend,audit)')<s.indexOf('await page.goto(PUBLIC'));
 assert.match(s,/90_000,\(\)=>abort\.abort\(\)/);
 assert.match(s,/backendSentCount=0/);assert.match(s,/saveResult\(out,result\)/);
 assert.doesNotMatch(s,/signInAnonymously|setSession|access_token|refresh_token|publishableKey|route\.continue|connectToServer|route\.fulfill|addInitScript/);
 assert.doesNotMatch(s,/connectionBadge\.good|await profile|profileState:\{\}/);
});
