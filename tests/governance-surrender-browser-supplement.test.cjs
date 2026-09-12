"use strict";
// Governance-only local browser supplement: reuse the exact candidate's existing
// mocked UI fixture without editing the approved product or registering its suite.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),test=require("node:test");
const Module=require("node:module");
const {confirmationLayout,layoutReadable,restoreFinishedPage}=require("../scripts/live-standard-surrender-canary.cjs");
const enabled=process.env.STANDARD_CANARY_BROWSER==="1";
function fixture() {
  const file=path.resolve(__dirname,"../../surrender-confirmation-20260913/tests/standard-online-browser.test.cjs");
  const source=fs.readFileSync(file,"utf8");
  const adapter=new Module(file,module);
  adapter.filename=file;adapter.paths=Module._nodeModulePaths(path.dirname(file));
  const originalRequire=adapter.require.bind(adapter);
  adapter.require=id=>id==="node:test"?()=>{}:originalRequire(id);
  adapter._compile(source+"\nmodule.exports={withPage};\n",file);
  return adapter.exports.withPage;
}
test("034 same fixed product has readable confirmation at390 and1280; opening/canceling sends nothing", {skip:!enabled,timeout:120000},async()=>{
  await fixture()("colorResponse",async page=>{
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(()=>{
      const r=globalThis.__standardOnlineRuntime;
      r.room={...r.room,opponent_kind:"cpu",cpu_character_id:"rei"};r.onInvalidate();
    });
    await page.waitForFunction(()=>document.querySelector("#cpuCommentaryName")?.textContent.includes("レイ"));
    for(const width of [390,1280]) {
      await page.setViewportSize({width,height:width===390?844:900});
      await page.locator("#colorSurrender:not([disabled])").click();
      await page.locator("#surrenderDialog[open]").waitFor();
      const layout=await confirmationLayout(page);
      assert.equal(layoutReadable(layout),true,JSON.stringify(layout));
      await page.locator("#cancelSurrender").click();
    }
    assert.equal(await page.evaluate(()=>globalThis.__standardOnlineRuntime.calls.filter(x=>x.body?.operation==="action").length),0);
  },{viewport:{width:390,height:844},bodyTimeout:40000});
});
test("034 actual reload helper restores the persistent finished result without extra write", {skip:!enabled,timeout:120000},async()=>{
  await fixture()("finishedCpu",async page=>{
    const before=await page.evaluate(()=>({room:globalThis.__standardOnlineRuntime.room,profile:globalThis.__standardOnlineRuntime.profile}));
    const writes=()=>page.evaluate(async()=> (await globalThis.__standardOnlineLifetimeInvocations()).filter(x=>["action","cpu-action","cpu-start","cpu-rematch","quiz-start","gacha"].includes(x.operation)));
    const beforeWrites=await writes();
    await restoreFinishedPage(page);
    const after=await page.evaluate(()=>({room:globalThis.__standardOnlineRuntime.room,profile:globalThis.__standardOnlineRuntime.profile}));
    assert.equal(await page.locator("#terminalSummary").isVisible(),true);
    assert.deepEqual(after,before);
    assert.deepEqual(await writes(),beforeWrites);
  },{viewport:{width:390,height:844},bodyTimeout:40000});
});
