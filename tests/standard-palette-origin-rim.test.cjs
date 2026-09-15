"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const model=import(pathToFileURL(path.join(__dirname,"../standard-online-v5/play-surface-model.js")).href);
const own=(extra={})=>({basicPalette:["green","red"],bonusColor:"yellow",bonusUsesRemaining:2,
  privateEffects:{paletteDebuffs:[{slot:0,previousColor:"blue",injectedColor:"green",remaining:2}]},...extra});
test("UDL052 active pollution preserves exact pre-effect rim and current fill without guessing from history",async()=>{
  const {paletteRoleSlots}=await model,s=paletteRoleSlots(own({initialBasicPalette:["yellow","green"]}));
  assert.equal(s[0].originColor,"blue");assert.equal(s[0].color,"green");assert.equal(s[0].pollutionRemaining,2);
  assert.equal(s[1].originColor,"red");assert.equal(s[3].color,"green");
  assert.equal(s[3].displayOptions.length,1);assert.equal(s[3].mark,"×");assert.equal(s[3].selectable,false);
});
test("UDL052 rim rejects stale malformed duplicate and unrelated effects and follows expiry",async()=>{
  const {paletteRoleSlots}=await model;
  for(const debuffs of [[],null,[{slot:0,previousColor:"blue",injectedColor:"red",remaining:2}],
    [{slot:0,previousColor:"blue",injectedColor:"green",remaining:0}],
    [{slot:0,previousColor:"blue",injectedColor:"green",remaining:3}],
    [{slot:0,previousColor:"violet",injectedColor:"green",remaining:1}],
    [0,1].map(()=>({slot:0,previousColor:"blue",injectedColor:"green",remaining:1}))]){
    const s=paletteRoleSlots(own({privateEffects:{paletteDebuffs:debuffs,paletteImpactEvent:{previousColor:"blue"}}}));
    assert.equal(s[0].originColor,"green");assert.equal(s[0].pollutionRemaining,0);
  }
  const s=paletteRoleSlots(own({basicPalette:["blue","red"],privateEffects:{paletteDebuffs:[]}}));
  assert.equal(s[0].originColor,"blue");assert.equal(s[0].color,"blue");
});
test("UDL052 real temporary alternatives stay direct within role four without unavailable clutter",async()=>{
  const {paletteRoleSlots}=await model;
  const s=paletteRoleSlots({basicPalette:["red","red"],bonusColor:"red",bonusUsesRemaining:0,
    privateEffects:{temporaryColors:["yellow","green"]}},{green:1});
  assert.deepEqual(s.map(x=>x.role),["basic1","basic2","bonus","remaining"]);
  assert.deepEqual(s[3].displayOptions.map(x=>[x.color,x.selectable]),[["yellow",true],["green",false]]);
  assert.equal(s[3].displayOptions[1].mark,"lock");
  assert.equal(paletteRoleSlots({basicPalette:["red","red"],bonusColor:"red",bonusUsesRemaining:0})[3].displayOptions.length,1);
});
test("UDL052 direct palette UI has no native dropdown or emoji and preserves the protected paint path",()=>{
  const app=fs.readFileSync(path.join(__dirname,"../standard-online-v5/app.js"),"utf8");
  const tail=app.slice(app.indexOf("function renderBasicActions("));
  const body=tail.slice(0,tail.search(/\n(?:async )?function /));
  assert.doesNotMatch(body,/remainingColorSelect|createElement\("select"\)|🔒|❌/);
  assert.match(body,/displayOptions/);assert.match(body,/palette-role-lock/);
  assert.match(body,/sendAction\("COLOR_REGION", \{ color \}\)/);
  assert.match(body,/button\.disabled = !canRespondToColor \|\| actionBusy \|\| !choice\.selectable;/);
  assert.match(body,/show\("retryAction", Boolean\(pendingAction\) && !actionBusy\)/);
  const send=app.slice(app.indexOf("async function sendAction("));
  assert.match(send,/if \(type === "COLOR_REGION" && isColorSealed\(state, roomModel\?\.view\?\.seat, payload\?\.color\)\)/);
  assert.match(send,/if \(retry && \(!pendingAction/);
});
