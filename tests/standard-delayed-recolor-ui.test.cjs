"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const intents=require("../standard-online-v5/standard-online-skill-intents.js"),ID="disruptDelayedRecolor";
const app=fs.readFileSync(path.join(__dirname,"../standard-online-v5/app.js"),"utf8");
test("UDL011 delayed UI normal target payloads reject malformed IDs without revealing future colors",()=>{
 assert.equal(intents.targetKind(ID),"existing-region");assert.equal(intents.isImmediate(ID),false);
 assert.deepEqual(intents.buildSkillPayload(ID,{regionId:"R7",prediction:"ignored"}),{skill:ID,regionId:"R7"});
 for(const regionId of [null,"R0","R-1",3,{}])assert.throws(()=>intents.buildSkillPayload(ID,{regionId}),/INVALID_SKILL_TARGET/);
});
test("UDL011 delayed UI queue/commit notices use public fields, have no stale reannouncement or secret dependence",()=>{
 const state={version:8,delayedRecolors:[{actor:"A",regionId:"R2",invalidated:false}]};
 Object.defineProperty(state,"privateState",{get(){throw Error("private read");}});
 assert.match(intents.delayedRecolorNotice(state),/R2.*Player B.*次の彩色/);
 state.delayedRecolors[0].invalidated=true;assert.match(intents.delayedRecolorNotice(state),/不発予定/);
 delete state.delayedRecolors;state.lastDelayedRecolor={version:8,regionId:"R2",outcome:"APPLIED",color:"green"};
 assert.equal(intents.delayedRecolorNotice(state,id=>"対象"+id),"再彩色予約：対象R2が緑に変化");
 state.version=9;assert.equal(intents.delayedRecolorNotice(state),"");
 for(const outcome of ["TARGET_CHANGED","NO_LEGAL_COLOR"]){state.lastDelayedRecolor={version:9,regionId:"R2",outcome,color:null};assert.match(intents.delayedRecolorNotice(state),/不発/);}
});
test("UDL011 delayed UI filters only public duplicate reservations, not hidden legality or palettes",()=>{
 const source=app.slice(app.indexOf("function eligibleRecolorRegions("),app.indexOf("function cornerBloomCellTargetActive("));
 const context={targetDraft:{skill:ID}};
 vm.createContext(context);vm.runInContext(source+";this.select=eligibleExistingRegionTargets",context);
 const state={regions:{R1:{id:"R1",color:"red",micro:[1]},R2:{id:"R2",color:"blue",micro:[2]},R3:{id:"R3",color:null,micro:[3],isPending:true}},pending:"R3",delayedRecolors:[{regionId:"R1"}]};
 assert.deepEqual(Array.from(context.select(state),r=>r.id),["R2"]);
 context.targetDraft.skill="legalRecolor";assert.deepEqual(Array.from(context.select(state),r=>r.id),["R1","R2"],"recolor counterplay remains allowed");
 assert.doesNotMatch(source,/basicPalette|privateState|hands|legalRecolorCandidates|fetch|client\./);
});
