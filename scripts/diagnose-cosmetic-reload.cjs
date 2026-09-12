"use strict";

// Offline diagnosis only. Reuse the unchanged candidate's browser fixture without
// registering or claiming to rerun its complete suite. No production credentials.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {compileFunction}=require("node:vm"),{createRequire}=require("node:module");
const {execFileSync}=require("node:child_process");
const {cosmeticItemLayoutPass}=require("../tests/helpers/cosmetic-canary-layout.cjs");
const candidateRoot=path.resolve(__dirname,"../../ui-cosmetics-20260912");
const candidate="a757c126e1325532bb11a719cf92d0d13401d3ae";
const git=(...args)=>execFileSync("git",["-c","safe.directory="+candidateRoot.replaceAll("\\","/"),...args],{cwd:candidateRoot,windowsHide:true});
assert.equal(git("rev-parse","HEAD").toString().trim(),candidate);
assert.equal(git("status","--porcelain").toString().trim(),"");
const filename=path.join(candidateRoot,"tests/standard-online-browser.test.cjs");
const source=fs.readFileSync(filename,"utf8"),candidateRequire=createRequire(filename);
const withPage=compileFunction(source+"\nreturn withPage;",["require","__dirname"],{filename})(
  id=>id==="node:test"?()=>{}:candidateRequire(id),path.dirname(filename));
const reportPath=path.resolve(__dirname,"../docs/UI_COSMETICS_RELOAD_DIAGNOSIS_20260912.json");
const report={candidate,kind:"OFFLINE_FIXTURE_NOT_LIVE",productionRequests:0,geometry:[],checks:[]};
const check=(label,value)=>{assert.ok(value,label);report.checks.push(label);};
(async()=>{try{
  await withPage("cosmetic",async page=>{
    const item=page.locator('[data-cosmetic-id="boardAurora"]');
    await item.getByRole("button",{name:"購入して装備",exact:true}).click();
    await item.locator(".cosmetic-item-status").getByText("オーロラ盤面を装備しました。",{exact:true}).waitFor();
    const before=await page.evaluate(()=>JSON.stringify(globalThis.__standardOnlineRuntime.profile));
    const callsBefore=await page.evaluate(()=>globalThis.__standardOnlineLifetimeInvocations());
    await page.reload();await item.getByRole("button",{name:"装備中",exact:true}).waitFor();
    const after=await page.evaluate(()=>JSON.stringify(globalThis.__standardOnlineRuntime.profile));
    check("fixture profile coins ownership and revision unchanged by reload",before===after);
    const callsAfter=await page.evaluate(()=>globalThis.__standardOnlineLifetimeInvocations());
    check("fixture reload sends no cosmetic action",callsAfter.filter(c=>c.operation==="cosmetic-action").length===callsBefore.filter(c=>c.operation==="cosmetic-action").length);
    for(const width of [390,1280]){
      await page.setViewportSize({width,height:900});await item.scrollIntoViewIfNeeded();
      const geometry=await item.evaluate(e=>{const r=e.getBoundingClientRect(),b=e.querySelector("button").getBoundingClientRect();return {viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,cardWidth:r.width,buttonWidth:b.width,buttonHeight:b.height,feedbackInside:Boolean(e.querySelector(".cosmetic-item-status"))};});
      report.geometry.push(geometry);await page.screenshot({path:reportPath+"."+width+".png"});
      check(width+": transient success message is cleared after reload",geometry.feedbackInside===false);
      check(width+": original combined live assertion rejects only missing transient feedback",!cosmeticItemLayoutPass(geometry)&&cosmeticItemLayoutPass(geometry,{requireFeedback:false}));
    }
  },{viewport:{width:390,height:844},beforeNavigate:async page=>{
    await page.context().route("**/*",route=>{
      const url=route.request().url();
      if(url.startsWith("http://127.0.0.1:")||url==="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")return route.fallback();
      report.productionRequests++;return route.abort();
    });
  }});
  check("no production request was attempted",report.productionRequests===0);report.ok=true;
}catch(error){report.ok=false;report.failure=error.message;process.exitCode=1;}
finally{report.completedAt=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));}})();
