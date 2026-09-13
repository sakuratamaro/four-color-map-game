"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {installReadOnlyAudit}=require("../scripts/live-standard-cutin-readability-browser.cjs");
const PRODUCT=path.resolve(__dirname,"../../skill-cutin-readability-20260913");
test("passive cut-in audit measures actual DOM lifetime and distinguishes missing/priority events",{timeout:25000},async()=>{
 const {chromium}=require("playwright"),browser=await chromium.launch({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true,timeout:10000});
 async function pageFor(mode){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:"block"});
  // Local DOM fixtures only. No URL for a backend and no authenticated session exists.
  await page.goto("about:blank#battle");
  await page.setContent('<style>.hidden{display:none}.skill-cutin{pointer-events:none;position:fixed;inset:0}.skill-cutin-card{width:300px;height:100px;margin:20px}</style><div id="skillCutin" class="skill-cutin hidden"><div class="skill-cutin-card"><b id="skillCutinTitle"></b><span id="skillCutinDetail"></span></div></div><dialog id="fixtureDialog"></dialog>');
  await page.evaluate(installReadOnlyAudit);await page.addScriptTag({path:path.join(PRODUCT,"standard-online-v5/skill-cutin.js")});
  await page.evaluate(mode=>{
   document.dispatchEvent(new Event("DOMContentLoaded"));
   const api=globalThis.FourColorSkillCutin;
   if(mode==="silent")globalThis.FourColorSkillCutin={...api,createObserver(){return {observe(){return Promise.resolve(false);},interrupt(){}};}};
   let timer;const root=document.getElementById("skillCutin");
   const clear=()=>{clearTimeout(timer);root.classList.add("hidden");};
   const storage=new Map();globalThis.originalShowCalls=0;
   globalThis.observer=globalThis.FourColorSkillCutin.createObserver({storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},locks:{request:(_k,_o,f)=>f()},
    show(event){originalShowCalls++;root.style.setProperty("--skill-cutin-duration","1800ms");document.getElementById("skillCutinTitle").textContent=event.title;
     document.getElementById("skillCutinDetail").textContent=event.detail===event.title?"":event.detail;root.classList.remove("hidden");timer=setTimeout(clear,1800);},clear});
   globalThis.input=version=>({roomId:"local-room",seat:"A",visible:true,blocked:false,ownColors:version===1?["red"]:["red","blue"],
    state:{matchId:"private-fixture-match",version,status:"ACTIVE",regions:{},...(version===2?{lastPublicTrace:{type:"USE_SKILL",actor:"A",version,eventId:"private-fixture-match:2"}}:{})},
    ...(version===2?{ack:{scope:"local-room:private-fixture-match:A",eventId:"private-fixture-match:2",name:"借用"}}:{})});
  },mode);return page;
 }
 try{
  const normal=await pageFor("normal");
  assert.equal(await normal.evaluate(async()=>{await observer.observe(input(1));return observer.observe(input(2));}),true);
  await normal.evaluate(()=>observer.observe(input(3)));await normal.waitForTimeout(2000);
  const r=await normal.evaluate(()=>__cutinReadabilityAudit.finish());assert.equal(r.ok,true);assert.equal(r.self,"OBSERVED_SCOPED");assert.equal(r.opponent,"NOT_OBSERVED");
  assert.equal(r.events[0].display,"PASS");assert.equal(r.events[0].timing,"MEASURED_WITHIN_WINDOW");assert.ok(r.events[0].durationMs>=1750);assert.equal(r.events[0].title,"借用");
  assert.equal(await normal.evaluate(()=>originalShowCalls),1);assert.doesNotMatch(JSON.stringify(r),/private-fixture|local-room/);await normal.close();
  const missing=await pageFor("silent");await missing.evaluate(async()=>{await observer.observe(input(1));await observer.observe(input(2));});
  const m=await missing.evaluate(()=>__cutinReadabilityAudit.finish());assert.equal(m.ok,false);assert.equal(m.self,"FAIL");assert.equal(m.events[0].reason,"ELIGIBLE_NOT_SHOWN");await missing.close();
  const priority=await pageFor("normal");await priority.evaluate(async()=>{await observer.observe(input(1));await observer.observe(input(2));document.getElementById("fixtureDialog").showModal();await observer.observe({...input(2),blocked:true});});
  const p=await priority.evaluate(()=>__cutinReadabilityAudit.finish());assert.equal(p.events[0].timing,"INTERRUPTED_NOT_DURATION_VERIFIED");assert.equal(p.events[0].reason,"DIALOG");await priority.close();
 }finally{await browser.close();}
});
