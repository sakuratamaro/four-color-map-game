"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=read("standard-online-v5/app.js"),html=read("standard-online-v5/index.html"),css=read("standard-online-v5/style.css");
function fn(name,next){const start=app.indexOf("function "+name+"("),end=app.indexOf("\nfunction "+next+"(",start);assert.ok(start>=0&&end>start);return app.slice(start,end);}
test("UDL062 gacha has five real selections and two new-draw controls, not a hidden dropdown",()=>{
  const panel=html.slice(html.indexOf('<section id="gachaPanel"'),html.indexOf('<section id="cardLibraryPanel"'));
  assert.deepEqual([...panel.matchAll(/data-gacha-level="(\d)"/g)].map(m=>Number(m[1])),[1,2,3,4,5]);
  assert.equal((panel.match(/<button type="button" data-gacha-level=/g)||[]).length,5);
  assert.doesNotMatch(panel,/<select|id="gachaLevel"|id="gachaTickets"/);
  for(const id of ["gachaDrawOne","gachaDrawAll"])assert.equal((panel.match(new RegExp('id="'+id+'"',"g"))||[]).length,1);
  assert.match(panel,/<details id="gachaOdds" class="gacha-odds">/);
  assert.match(panel,/<details id="gachaHelp" class="gacha-help">/);
  assert.match(panel,/<tbody id="gachaOddsRows"><\/tbody>/);
  assert.match(panel,/id="gachaStatus"[^>]*><\/p>/);
  assert.doesNotMatch(panel,/以上確定|★4・★5も排出されます|現在、Lv/);
});
test("gacha odds are immutable and generated from the actual unchanged transaction definition",()=>{
  const actual=require("../standard/standard-gacha-transaction.js").GACHA_ODDS;
  const exposed=require("../standard-online-v5/standard-skill-registry.generated.js").gachaOdds;
  assert.deepEqual(exposed,actual);assert.equal(Object.isFrozen(exposed),true);
  for(const lv of [1,2,3,4,5]){assert.equal(Object.isFrozen(exposed[lv]),true);assert.equal(Object.values(exposed[lv]).reduce((a,b)=>a+b),100);}
  assert.match(app,/const GACHA_ODDS = globalThis.FourColorStandardSkillRegistry.gachaOdds;/);
  assert.doesNotMatch(app,/const GACHA_ODDS = Object.freeze/);
});
test("pending gacha owns the displayed level, and invalid pending data is not silently reassigned",()=>{
  const get=fn("currentGachaLevel","selectGachaLevel");
  const level=(selectedGachaLevel,pendingGacha)=>vm.runInNewContext("("+get+")()",{selectedGachaLevel,pendingGacha});
  for(const l of [1,2,3,4,5]){assert.equal(level(l,null),l);assert.equal(level(1,{ticketLevel:l}),l);}
  for(const l of [0,6,1.1,"2",NaN])assert.equal(level(5,{ticketLevel:l}),null);
});
test("gacha selection is local-only and cannot replace pending/busy/unsynced/handoff intents",()=>{
  const select=fn("selectGachaLevel","renderGacha");
  const invoke=overrides=>{const effects=[],c={selectedGachaLevel:1,choice:5,pendingGacha:null,gachaBusy:false,synced:true,profileSyncBusy:false,
    profile:()=>({}),hasMatchedRoomHandoff:()=>false,armedCpuRewardGachaOrigin:{},clearCpuRewardGachaResult:o=>effects.push(o),renderGacha:()=>effects.push("render"),...overrides};
    vm.runInNewContext("("+select+")(choice)",c);return {c,effects};};
  assert.equal(invoke({}).c.selectedGachaLevel,5);assert.equal(invoke({}).effects.length,2);
  for(const overrides of [{gachaBusy:true},{pendingGacha:{actionId:"fixed",ticketLevel:2,count:4}},{synced:false},{profileSyncBusy:true},{profile:()=>null},{hasMatchedRoomHandoff:()=>true},...["2",0,6,1.5,NaN].map(choice=>({choice}))]){
    const r=invoke(overrides);assert.equal(r.c.selectedGachaLevel,1);assert.equal(r.effects.length,0);
  }
  assert.doesNotMatch(select,/drawGacha|localStorage|actionId|runGacha/);
});
test("new gacha requests guard pending replacement and retain the exact existing all/retry contract",()=>{
  const run=app.slice(app.indexOf("async function runGacha("),app.indexOf("async function createStarterProfile("));
  assert.match(run,/!synced \|\| profileSyncBusy \|\| hasMatchedRoomHandoff\(\) \|\| \(!retry && pendingGacha\)/);
  assert.match(run,/requestedCount === null \? Math.min\(available, 100\) : requestedCount/);
  assert.ok(run.indexOf("localStorage.setItem(GACHA_PENDING_KEY")<run.indexOf("client.drawGacha(pendingGacha)"));
  assert.ok(run.indexOf("client.drawGacha(pendingGacha)")<run.indexOf("pendingGacha = null"));
  assert.match(run,/selectedGachaLevel = level/);
  assert.match(app,/show\("gachaLimitNote", available > 100\)/);
});
test("gacha responsive controls and optional odds remain focusable without fixed-nav clipping",()=>{
  assert.match(css,/\.gacha-panel\{min-width:0\}/);
  assert.match(css,/\.gacha-odds tbody tr\{scroll-margin-block-end:104px\}/);
  assert.match(css,/\.gacha-levels button\{[^}]*min-width:44px;min-height:76px/);
  assert.match(css,/@media\(max-width:420px\)\{\.gacha-levels\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.gacha-odds-table-wrap\{[^}]*overflow-x:auto/);
  assert.match(css,/\.gacha-levels button:focus-visible/);
  assert.match(html,/class="gacha-odds-table-wrap" tabindex="0" role="region"/);
});

// REG-UDL062-GACHA-PENDING-REWARD-COPY: execute both actual navigation functions.
for (const scenario of [
  { name: "pending recovery", pending: true, status: "前回の抽選結果を確認してください。" },
  { name: "pending error", pending: true, status: "抽選結果を確認できませんでした。前回の抽選結果をもう一度確認できます。" },
  { name: "pending empty status", pending: true, status: "", expected: "前回の抽選結果を確認してください。" },
  { name: "busy pending", pending: true, busy: true, status: "抽選中…" },
  { name: "busy without pending", pending: false, busy: true, status: "抽選中…" },
  { name: "ordinary saved reward", pending: false, status: "", expected: "対戦でもらったLv.1券を選びました。" },
]) {
  test(`B1 saved reward message respects ${scenario.name}`, () => {
    const pending = scenario.pending ? { actionId: "33333333-3333-4333-8333-333333333333", ticketLevel: 5, count: 2 } : null;
    const reward = { opponentKind: "cpu", ticketLevel: 1, ticketCount: 2, ticketTotal: 3,
      roomId: "saved-room", roomVersion: 9, matchId: "saved-match" };
    const status = { textContent: scenario.status }, effects = [];
    const context = { pendingGacha: pending, gachaBusy: Boolean(scenario.busy), selectedGachaLevel: 5,
      roomModel: { room: {}, view: { seat: "A" } }, profile: () => ({ gachaTickets: { 1: 3, 5: 2 } }),
      savedResultReward: () => reward, armedCpuRewardGachaOrigin: null,
      $: id => { assert.equal(id, "gachaStatus"); return status; },
      dismissTerminalResult: () => effects.push("dismiss"), activateAppTab: tab => effects.push(tab),
      clearCpuRewardGachaResult: () => effects.push("clear-result"), requestAnimationFrame: () => {},
      renderGacha: () => {
        if (!context.gachaBusy && !context.pendingGacha) status.textContent = "";
        else if (!context.gachaBusy && context.pendingGacha && !status.textContent) status.textContent = "前回の抽選結果を確認してください。";
      },
      runGacha: () => assert.fail("navigation must not draw"),
    };
    // Extract only the top-level function; adjacent profile handlers are not part of this unit.
    const go = app.match(/^function goToGacha\([^\n]*\) \{[\s\S]*?^\}/m)?.[0];
    assert.ok(go, "actual goToGacha declaration must be present");
    assert.doesNotMatch(go, /\.onclick|\.onchange/, "do not execute neighboring UI bindings");
    const pendingBefore = JSON.stringify(pending);
    vm.runInNewContext(go + "\n" + fn("openSavedResultGacha", "clearContactReveal") + "\nopenSavedResultGacha();", context);
    assert.equal(context.selectedGachaLevel, scenario.pending ? 5 : 1);
    assert.equal(JSON.stringify(context.pendingGacha), pendingBefore);
    assert.equal(status.textContent, scenario.expected ?? scenario.status);
    assert.equal(context.armedCpuRewardGachaOrigin.ticketLevel, 1, "valid origin exercises the formerly unconditional copy");
    assert.deepEqual(effects, scenario.pending ? ["dismiss", "quiz"] : ["dismiss", "clear-result", "quiz"]);
  });
}
