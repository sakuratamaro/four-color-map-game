"use strict";
// UDL035/038/052: current-seat notice, not a mutation of historical engine events.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const engine=require("../standard/standard-engine.js"),match=require("../standard/standard-match.js");
const app=fs.readFileSync(path.join(__dirname,"../standard-online-v5/app.js"),"utf8");
const source=app.slice(app.indexOf("const PALETTE_IMPACT_SKILL_BY_KIND ="),app.indexOf("function pendingSetupForCurrentRoom("));
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture({seat="A",seen=[]}={}){
 const nodes=new Map(),writes=[];
 const node=id=>{if(!nodes.has(id)){let text="";nodes.set(id,{visible:false,get textContent(){return text;},set textContent(v){text=v;writes.push({id,text:v});}});}return nodes.get(id);};
 const sandbox={roomModel:{room:{id:"local-notice"},view:{seat}},document:{visibilityState:"visible"},activeAppTab:"battle",
  presentedPaletteImpactEventId:null,presentedPaletteImpactEvents:[...seen],observedPaletteImpactScope:null,
  PALETTE_IMPACT_PRESENTATION_LIMIT:64,PALETTE_IMPACT_PRESENTATION_KEY:"test-only",COLOR_JA:{red:"赤",blue:"青",yellow:"黄",green:"緑"},
  SKILL_META:{colorPaletteChange:{name:"持ち色変更"},disruptPaletteRandom:{name:"持ち色汚染・乱"},disruptPaletteChoice:{name:"持ち色汚染"},disruptForcedPalette:{name:"強制持ち替え"}},
  playerName:s=>s,$:node,show:(id,v)=>{node(id).visible=v;},localStorage:{setItem(){}}};
 vm.createContext(sandbox);vm.runInContext(source,sandbox,{timeout:1000});
 const state={status:"ACTIVE",matchId:"notice-unit",version:10};
 const event={eventId:"notice-unit:9:palette-impact:"+seat,version:9,actor:seat==="A"?"B":"A",skill:"disruptPaletteChoice",kind:"chosen",slot:0,previousColor:"red",injectedColor:"green",remaining:2};
 const own={seat,basicPalette:["green","blue"],bonusColor:"yellow",privateEffects:{paletteImpactEvent:event,paletteImpactHistory:[clone(event)],
  paletteDebuffs:[{slot:0,previousColor:"red",injectedColor:"green",remaining:2}]}};
 return {sandbox,node,writes,state,own,event,observe(s=state,p=own){sandbox.observePaletteImpact(s,p);},visible:()=>node("paletteImpactNotice").visible,detail:()=>node("paletteImpactDetail").textContent};
}
test("REG-PALETTE-NOTICE-LIFECYCLE-01 actual engine2-to1-to0 updates notice and expires without changing history",()=>{
 const f=fixture({seat:"B"}),rng=engine.createRngDomains(8901,match.REQUIRED_RNG_STREAMS);
 let state=match.createStandardMatch({matchId:"palette-choice",firstSeat:"A",hands:{A:{disruptPaletteChoice:1},B:{}}},rng);state.phase="WORK";
 const applied=match.applyStandardAction({state,actor:"A",action:{type:"USE_SKILL",payload:{skill:"disruptPaletteChoice",color:"yellow"}},expectedVersion:state.version,rngStreams:rng});
 assert.equal(applied.ok,true);state=applied.state;const effect=clone(state.privateEffects.B.paletteDebuffs[0]),history=JSON.stringify(state.privateEffects.B.paletteImpactHistory);
 const observe=()=>f.observe(match.projectStandardPublicState(state),match.projectStandardPrivateState(state,"B"));
 observe();assert.equal(f.visible(),true);assert.match(f.detail(),/あと2回の彩色/);
 const playable=[...state.basicPalettes.B,state.bonusColors.B].find(c=>!state.publicEffects.B.seals[c]);
 for(const [i,micro]of [196,400].entries()){
  const id="R"+(i+1),scale=state.playableBounds.microScale,x=micro%state.microWidth,y=Math.floor(micro/state.microWidth);
  state.active="B";state.skillCategoryWindow={actor:"B",categories:[]};state.phase="COLOR";state.pending=id;
  state.regions[id]={id,micro:[micro],sourceMacros:[Math.floor(y/scale)*state.playableBounds.macroWidth+Math.floor(x/scale)],controllers:["A"],color:null,isPending:true};
  const result=match.applyStandardAction({state,actor:"B",action:{type:"COLOR_REGION",payload:{color:playable}},expectedVersion:state.version,rngStreams:rng});assert.equal(result.ok,true);state=result.state;observe();
  if(i===0){assert.equal(f.visible(),true);assert.match(f.detail(),/あと1回の彩色/);}else assert.equal(f.visible(),false);
 }
 assert.equal(effect.slot<2?state.basicPalettes.B[effect.slot]:state.bonusColors.B,effect.previousColor);
 assert.equal(JSON.stringify(state.privateEffects.B.paletteImpactHistory),history);assert.equal(state.privateEffects.B.paletteImpactEvent.remaining,2);
});
test("seen event does not freeze current remaining count or repeat identical text updates",()=>{
 const f=fixture();f.observe();const writes=f.writes.length;f.observe();assert.equal(f.writes.length,writes);
 f.own.privateEffects.paletteDebuffs[0].remaining=1;f.state.version++;f.observe();assert.match(f.detail(),/あと1回/);
 assert.equal(f.sandbox.presentedPaletteImpactEvents.length,1);assert.equal(f.event.remaining,2);
});
test("reload restores active status even when the historical event has already been presented",()=>{
 const f=fixture({seen:["notice-unit:9:palette-impact:A"]});f.own.privateEffects.paletteDebuffs[0].remaining=1;f.observe();
 assert.equal(f.visible(),true);assert.match(f.detail(),/あと1回/);assert.equal(f.sandbox.presentedPaletteImpactEvents.length,1);
 delete f.own.privateEffects.paletteDebuffs;f.observe();assert.equal(f.visible(),false);assert.equal(f.detail(),"");
});
test("current color alone cannot revive an expired temporary historical event",()=>{
 const f=fixture();delete f.own.privateEffects.paletteDebuffs;f.observe();assert.equal(f.visible(),false);
});
test("permanent self and forced changes remain current until replaced or the match ends",()=>{
 for(const kind of ["self","forced"]){const f=fixture();Object.assign(f.event,{kind,remaining:0,actor:kind==="self"?"A":"B",skill:kind==="self"?"colorPaletteChange":"disruptForcedPalette"});
  delete f.own.privateEffects.paletteDebuffs;f.observe();assert.equal(f.visible(),true);assert.match(f.detail(),/対戦終了まで/);
  f.state.version++;f.observe();assert.equal(f.visible(),true);f.own.basicPalette[0]="red";f.observe();assert.equal(f.visible(),false);
  f.own.basicPalette[0]="green";f.state.status="FINISHED";f.observe();assert.equal(f.visible(),false);
 }
});
test("hidden and non-battle views reconcile expiry without exposing a stale private notice",()=>{
 const f=fixture();f.observe();f.sandbox.document.visibilityState="hidden";f.own.privateEffects.paletteDebuffs[0].remaining=1;f.observe();assert.equal(f.visible(),false);
 f.sandbox.document.visibilityState="visible";f.observe();assert.match(f.detail(),/あと1回/);
 f.sandbox.activeAppTab="cards";delete f.own.privateEffects.paletteDebuffs;f.observe();assert.equal(f.visible(),false);
 f.sandbox.activeAppTab="battle";f.observe();assert.equal(f.visible(),false);
});
test("foreign seat, invalid event, mismatched current slot and incoherent effects clear the notice",()=>{
 for(const mutate of [f=>f.own.seat="B",f=>delete f.own.seat,f=>f.event.version=99,f=>f.own.basicPalette[0]="red",f=>f.own.privateEffects.paletteDebuffs[0].remaining=0,
  f=>f.own.privateEffects.paletteDebuffs[0].remaining=3,f=>f.own.privateEffects.paletteDebuffs.push(clone(f.own.privateEffects.paletteDebuffs[0])),
  f=>f.own.privateEffects.paletteDebuffs={},f=>f.sandbox.roomModel=null]){const f=fixture();f.observe();mutate(f);f.observe();assert.equal(f.visible(),false);}
});
test("latest slot uses its own active effect, not another slot or the historical duration",()=>{
 const f=fixture();f.own.privateEffects.paletteDebuffs[0].remaining=1;f.own.privateEffects.paletteDebuffs.push({slot:2,previousColor:"red",injectedColor:"yellow",remaining:2});
 f.observe();assert.match(f.detail(),/あと1回/);f.own.privateEffects.paletteDebuffs.shift();f.observe();assert.equal(f.visible(),false);
});
test("legacy permanent event without actor skill or history remains supported without acknowledgment",()=>{
 const f=fixture();Object.assign(f.event,{kind:"forced",remaining:0});delete f.event.actor;delete f.event.skill;delete f.own.privateEffects.paletteImpactHistory;delete f.own.privateEffects.paletteDebuffs;
 f.observe();assert.equal(f.visible(),true);assert.match(f.detail(),/Bの「強制持ち替え」/);
 const html=fs.readFileSync(path.join(__dirname,"../standard-online-v5/index.html"),"utf8");assert.doesNotMatch(html,/id="dismissPaletteImpact"/);assert.doesNotMatch(app,/dismissPaletteImpact/);
});
