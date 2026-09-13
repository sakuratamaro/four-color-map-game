"use strict";
const G=require("./live-standard-cutin-readability-guard.cjs");
const PAGE="https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";

// Passive instrumentation: forwards the original observer input, return value and callbacks.
// No synthetic game state, ACK, trace, hand, timer, claim or DOM presentation is supplied.
function installReadOnlyAudit(){
 const records=[],byKey=new Map();let api,previous=null,active=null,lastInput=null,sequence=0;
 const clock=()=>performance.now(),root=()=>document.getElementById("skillCutin");
 const reason=()=>document.visibilityState!=="visible"?"HIDDEN_TAB":location.hash!=="#battle"?"OTHER_TAB":
  document.querySelector("dialog[open]")?"DIALOG":["terminalOverlay","contactReveal","randomReveal"].find(id=>{
   const e=document.getElementById(id);return e&&!e.classList.contains("hidden");})||null;
 const end=cause=>{if(active){active.durationMs=clock()-active.started;active.endedBy=cause;active=null;}};
 const safeText=x=>String(x||"").slice(0,100).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,"[redacted]");
 function inspect(rec){
  const e=root();if(!e||e.classList.contains("hidden"))return;
  rec.title=safeText(document.getElementById("skillCutinTitle")?.textContent);
  rec.detail=safeText(document.getElementById("skillCutinDetail")?.textContent);
  rec.pointerTransparent=[e,...e.querySelectorAll("*")].every(n=>getComputedStyle(n).pointerEvents==="none");
  rec.focusOutside=!e.contains(document.activeElement);
  rec.cssDuration=getComputedStyle(e).getPropertyValue("--skill-cutin-duration").trim();
  const rect=e.querySelector(".skill-cutin-card")?.getBoundingClientRect();
  rec.withinViewport=Boolean(rect&&rect.width>0&&rect.height>0&&rect.left>=-1&&rect.right<=innerWidth+1);
 }
 function wrap(value){
  api=value;return {...value,createObserver(options){
   const original=value.createObserver({...options,
    show(...args){
     const event=args[0],key=event.scope+":"+event.eventId;
     end("NEW_SKILL");const rec=byKey.get(key);const result=Reflect.apply(options.show,this,args);
     if(rec){rec.shows++;rec.started=clock();active=rec;inspect(rec);setTimeout(()=>{if(active===rec)inspect(rec);},220);}
     return result;
    },
    clear(...args){
     end(reason()||(lastInput?.state?.status!=="ACTIVE"?"TERMINAL":"NEW_EVENT_OR_SCOPE_UPDATE"));
     return Reflect.apply(options.clear,this,args);
    }});
   return {...original,
    observe(input){
     lastInput=input;const cur=value.snapshot(input),trace=value.traceFor(input?.state);
     const same=previous&&cur&&cur.scope===previous.scope;
     if(!input?.visible||input?.blocked||!cur||cur.status!=="ACTIVE"||!same||cur.version>previous.version)sequence++;
     const serial=sequence;
     const expected=value.describe(previous,cur,input);
     let rec;
     if(trace&&cur){
      const key=cur.scope+":"+trace.eventId;rec=byKey.get(key);
      if(!rec){rec={index:records.length+1,actor:trace.actor===input.seat?"self":"opponent",eligible:Boolean(expected),shows:0,
       initialReason:expected?null:reason()||(!previous?"INITIAL_SNAPSHOT":previous.scope!==cur.scope?"SCOPE_CHANGE":
        cur.version!==previous.version+1?"VERSION_GAP_OR_DUPLICATE":input.blocked?"PRIORITY":"NOT_ELIGIBLE"),
       expected:expected?{title:expected.title,detail:expected.detail===expected.title?"":expected.detail}:null};records.push(rec);byKey.set(key,rec);}
     }
     if(!previous||!cur||cur.scope!==previous.scope||cur.version>=previous.version)previous=cur;
     const result=original.observe(input);
     Promise.resolve(result).then(shown=>{
      if(expected&&rec&&!shown&&!rec.shows)rec.missingReason=reason()||(sequence!==serial?"SUPERSEDED_BEFORE_CLAIM":"ELIGIBLE_NOT_SHOWN");
     }).catch(()=>{if(rec)rec.missingReason="OBSERVER_ERROR";});
     return result;
    },
    interrupt(...args){sequence++;return Reflect.apply(original.interrupt,this,args);}
   };
  }};
 }
 Object.defineProperty(globalThis,"FourColorSkillCutin",{configurable:true,get(){return api;},set(value){api=wrap(value);}});
 document.addEventListener("DOMContentLoaded",()=>{
  if(root())new MutationObserver(()=>{if(active&&root().classList.contains("hidden"))end(reason()||"TIMER");}).observe(root(),{attributes:true,attributeFilter:["class"]});
 });
 globalThis.__cutinReadabilityAudit={finish(){
  if(active)end("HARNESS_LIMIT");
  const events=records.map(r=>{
   const content=r.shows?Boolean(r.expected&&r.title===r.expected.title&&r.detail===r.expected.detail):null;
   const interrupted=r.endedBy&&r.endedBy!=="TIMER";
   const timing=!r.shows?"NOT_OBSERVED":interrupted?"INTERRUPTED_NOT_DURATION_VERIFIED":
    r.durationMs>=1750&&r.durationMs<=5000?"MEASURED_WITHIN_WINDOW":"FAIL";
   const suppressed=!r.eligible||r.missingReason&&r.missingReason!=="ELIGIBLE_NOT_SHOWN"&&r.missingReason!=="OBSERVER_ERROR";
   const display=r.shows?(r.shows===1&&content&&r.pointerTransparent&&r.focusOutside&&r.withinViewport?"PASS":"FAIL"):
    suppressed?"SUPPRESSED":"FAIL";
   return {index:r.index,actor:r.actor,eligible:r.eligible,display,contentMatchesObservedContract:content,
    title:r.title,detail:r.detail,shows:r.shows,pointerTransparent:r.pointerTransparent,focusOutside:r.focusOutside,
    withinViewport:r.withinViewport,cssDuration:r.cssDuration,durationMs:r.durationMs,timing,
    reason:r.missingReason||r.initialReason||r.endedBy};
  });
  const side=actor=>{const rows=events.filter(e=>e.actor===actor);return !rows.length?"NOT_OBSERVED":rows.some(e=>e.display==="FAIL"||e.timing==="FAIL")?"FAIL":rows.some(e=>e.display==="PASS")?"OBSERVED_SCOPED":"SUPPRESSED";};
  return {ok:!events.some(e=>e.display==="FAIL"||e.timing==="FAIL"),self:side("self"),opponent:side("opponent"),events,
   observer:"PASS_THROUGH_ONLY_NO_GAME_STATE_INJECTION",inputDuringVisibleCard:"NOT_RUN",physicalDevices:"NOT_RUN"};
 }};
}

async function createBrowserAdapter({key,chromiumImpl}){
 const chromium=chromiumImpl||require("playwright").chromium;
 const server=await chromium.launchServer({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:20000});
 const browser=await chromium.connect(server.wsEndpoint());
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 let page,budget,transport,stopped=false,errors=0,warnings=0,routeFailures=0;
 async function bounded(promise,max=15000){
  let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("UI_STAGE_TIMEOUT")),Math.max(1,Math.min(max,budget?budget.remaining():max)));})]);}finally{clearTimeout(timer);}
 }
 return {
  async open(input){
   ({budget,transport}=input);
   await context.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===G.ORIGIN){
     if(req.method()==="OPTIONS")return route.continue();
     try{
      const r=await transport.request(req.method(),url.pathname+url.search,req.method()==="POST"?req.postDataJSON():undefined,"browser");
      // This is the actual server response, never a synthetic game fixture.
      return await route.fulfill({status:r.status,contentType:"application/json",headers:{"access-control-allow-origin":"*","cache-control":"no-store"},body:r.raw});
     }catch{
      routeFailures++;await route.abort("blockedbyclient").catch(()=>{});return;
     }
    }
    if(["GET","HEAD"].includes(req.method())&&(url.href.startsWith("https://sakuratamaro.github.io/four-color-map-game/")
     ||url.href.startsWith("https://cdn.jsdelivr.net/")))return route.continue();
    routeFailures++;return route.abort("blockedbyclient");
   });
   const bootstrapUrl=PAGE+".canary-session-bootstrap";
   await context.route(bootstrapUrl,r=>r.fulfill({contentType:"text/html",body:"<!doctype html><title>Own session bootstrap</title>"}));
   const bootstrap=await context.newPage();await bounded(bootstrap.goto(bootstrapUrl,{waitUntil:"domcontentloaded",timeout:15000}));
   await bounded(bootstrap.evaluate(async({url,key,session,roomId})=>{
    const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    const client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    const {error}=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
    if(error)throw new Error("NO_OWN_SESSION");
    localStorage.setItem("fourColorMapGame.standard.online.v5.connection",JSON.stringify({roomId,roomCode:null,profileRevision:0,setupRevision:1}));
    client.auth.stopAutoRefresh();
   },{url:G.ORIGIN,key,session:input.session,roomId:input.roomId}));
   await bounded(bootstrap.close(),5000);
   await context.addInitScript(installReadOnlyAudit);
   page=await context.newPage();page.on("pageerror",()=>errors++);page.on("console",m=>{if(m.type()==="error")errors++;if(m.type()==="warning")warnings++;});
   await bounded(page.goto(PAGE+"#battle",{waitUntil:"domcontentloaded",timeout:20000}),20000);
   await bounded(page.locator("#connectionBadge.good").waitFor({state:"visible",timeout:15000}));
   await bounded(page.locator("#matchCard:not(.hidden)").waitFor({state:"visible",timeout:15000}));
   await bounded(page.locator("#boardViewport canvas").waitFor({state:"visible",timeout:15000}));
  },
  async tryOwnSkill(){
   if(!page)return false;
   const button=page.locator('#skillControls .skill[data-skill="colorRandomBorrow"]');
   if(!await button.isVisible()){
    const toggle=page.locator("#showColorSkills");
    if(await toggle.isVisible()&&await toggle.isEnabled())await bounded(toggle.click({timeout:3000}),3500);
   }
   if(!await button.isVisible()||!await button.isEnabled())return false;
   await bounded(button.click({timeout:3000}),3500);return true;
  },
  async collect(){
   const result=page?await bounded(page.evaluate(()=>globalThis.__cutinReadabilityAudit?.finish()),4000):null;
   return {...(result||{ok:false,self:"NOT_RUN",opponent:"NOT_RUN",events:[]}),console:{errors,warnings},routeFailures};
  },
  async stop(){
   if(stopped)return;let error;
   try{await bounded(context.close(),7000);}catch(e){error=e;}
   try{await bounded(server.close(),8000);stopped=true;}catch(e){error=e;await bounded(server.kill(),5000);stopped=true;}
   if(error)throw error;
  },
  async emergencyStop(){if(!stopped){await bounded(server.kill(),5000);stopped=true;}}
 };
}
module.exports={installReadOnlyAudit,createBrowserAdapter,PAGE};
