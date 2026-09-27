"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {chromium}=require("playwright");
const {SAVE_KEY}=require("../standard/standard-skill-workshop.js");
const root=path.resolve(__dirname,"..");
const name=process.env.STANDARD_BROWSER||"chrome";
assert.ok(["chrome","edge"].includes(name));
const executablePath=name==="edge"?"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe":"C:/Program Files/Google/Chrome/Application/chrome.exe";
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};
async function withPage(body,{width=390,height=844}={}) {
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,"http://localhost");
    const file=path.resolve(root,"."+decodeURIComponent(url.pathname)+(url.pathname.endsWith("/")?"index.html":""));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader("Content-Type",types[path.extname(file)]||"application/octet-stream");res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath,headless:true});
    const context=await browser.newContext({viewport:{width,height}}), page=await context.newPage(), errors=[],external=[];
    page.on("pageerror",error=>errors.push(error.message));
    await context.route("**/*",route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=="127.0.0.1"){external.push(url.origin);return route.abort();}
      return route.continue();
    });
    await context.addInitScript(()=>{
      localStorage.setItem("fourColorMapGame.standard.v5.save","sentinel-standard");
      localStorage.setItem("fourColorMapGame.standard.online.v5.connection","sentinel-connection");
      localStorage.setItem("fourColorMapGame.standard.online.v5.remote-profile","sentinel-profile");
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/skill-workshop/`);
    await page.locator("#board button").first().waitFor();
    await body(page);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    assert.deepEqual(await page.evaluate(()=>[localStorage.getItem("fourColorMapGame.standard.v5.save"),localStorage.getItem("fourColorMapGame.standard.online.v5.connection"),localStorage.getItem("fourColorMapGame.standard.online.v5.remote-profile")]),["sentinel-standard","sentinel-connection","sentinel-profile"]);
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
async function scene(page,id){await page.locator("#scenario").selectOption(id);await page.locator("#loadScenario").click();}
async function region(page,id){await page.locator(`[data-region="${id}"]`).first().click();}
async function stored(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);}

test(`${name}: all eleven skills resolve through real controls at 390px`,{timeout:120000},()=>withPage(async page=>{
  const examples=[
    ["labWeather",["R1"]],["labWhiteout",[]],["labSwap",["R1","R3"]],["labRotate",["R1","R2","R3"]],
    ["labRecolorNext",["R1"]],["labDemolish",["R1"]],["labCancelRegion",["R2"]],["labChecker",["R1"]],
    ["labSilence",[]],["labUnseal",[]],["labRefillUnseal",[]],
  ];
  for(const [id,targets] of examples){
    await scene(page,id);for(const target of targets)await region(page,target);
    await page.locator("#useSkill").click();
    const s=await stored(page);assert.equal(s.charges.A[id],0,id);assert.equal(s.state.version,1,id);
    assert.doesNotMatch(await page.locator("#message").textContent(),/使えません|変わっていません/);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
}));
test(`${name}: weather continues into ordinary coloring and reload retains exactly one charge`,{timeout:60000},()=>withPage(async page=>{
  await scene(page,"labWeather");await region(page,"R1");await page.locator("#useSkill").click();
  assert.match(await page.locator("#turnTitle").textContent(),/B/);
  await page.locator('#palette [data-color="red"]').click();
  const before=await stored(page);assert.equal(before.state.phase,"WORK");assert.equal(before.state.regions.R1.color,"red");
  await page.reload();await page.locator("#board button").first().waitFor();
  assert.deepEqual(await stored(page),before);
  assert.equal(before.charges.A.labWeather,0);
}));
test(`${name}: checker has real two-color drawing, keyboard targets and atomic illegal-color feedback`,{timeout:60000},()=>withPage(async page=>{
  await scene(page,"labChecker");
  const target=page.locator('[data-region="R1"]').first();await target.focus();await page.keyboard.press("Enter");
  await page.locator("#effectColor").selectOption("blue");await page.locator("#useSkill").click();
  assert.equal((await stored(page)).charges.A.labChecker,1);
  assert.match(await page.locator("#message").textContent(),/同じ色が接する/);
  await page.locator("#effectColor").selectOption("yellow");await page.locator("#useSkill").click();
  assert.equal(await page.locator('.cell.checker').count(),2);
  assert.match(await page.locator('[data-region="R1"]').first().getAttribute("aria-label"),/赤・黄/);
  if(process.env.WORKSHOP_SCREENSHOT){await page.screenshot({path:process.env.WORKSHOP_SCREENSHOT,fullPage:true});}
},{width:1100,height:900}));
test(`${name}: destroyed area is selectable again and new shape reaches COLOR`,{timeout:60000},()=>withPage(async page=>{
  await scene(page,"labDemolish");await region(page,"R1");await page.locator("#useSkill").click();
  await page.locator('[data-macro="26"]').click();await page.locator('[data-macro="27"]').click();
  await page.locator("#createRegion").click();assert.equal((await stored(page)).state.phase,"COLOR");
}));
test(`${name}: corrupt trial save is not overwritten and no ordinary data is changed`,{timeout:60000},()=>withPage(async page=>{
  await page.evaluate(key=>localStorage.setItem(key,"broken-save"),SAVE_KEY);await page.reload();await page.locator("#board button").first().waitFor();
  assert.match(await page.locator("#saveNotice").textContent(),/上書きせず/);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY),"broken-save");
  await page.locator("#freePlay").click();assert.equal((await stored(page)).state.phase,"CREATE_FIRST");
}));
