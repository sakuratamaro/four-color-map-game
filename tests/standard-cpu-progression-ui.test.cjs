"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,".."),model=import(pathToFileURL(path.join(root,"standard-online-v5/cpu-progression-model.js")).href);
const resultModel=import(pathToFileURL(path.join(root,"standard-online-v5/result-continuation.js")).href);
const trial=require("../standard/standard-cpu-progression.js"),cutin=require("../standard-online-v5/skill-cutin.js");
const {loadEngine,plain}=require("./helpers/public-skill-fixture.cjs"),api=loadEngine();
function fixture(){const s=plain(trial.createRenTrial({matchId:"trial-ui-fixture",seed:1}));return {s,state:s.publicState,own:s.privateA};}
test("AC011/064 actual trial has six cards and one separate technique with current sealed colors",async()=>{
  const {techniquePresentation}=await model,{state,own}=fixture(),before=JSON.stringify({state,own});
  const m=techniquePresentation(state,own,"A");assert.equal(m.visible,true);assert.equal(m.usable,true);assert.equal(m.uses,1);
  assert.deepEqual(m.colors.map(c=>[c.color,c.sealed]),[["red",true],["blue",false],["yellow",false]]);
  assert.equal(Object.keys(own.hand).length,6);assert.equal(own.hand.techUnsealOne,undefined);assert.equal(JSON.stringify({state,own}),before);
});
test("AC011 duplicate roles share targets; current pollution color/bonus zero retained, temporary colors excluded",async()=>{
  const {techniquePresentation}=await model,{state,own}=fixture();own.initialBasicPalette=["red","red"];own.basicPalette=["blue","blue"];
  own.bonusColor="yellow";own.bonusUsesRemaining=0;own.privateEffects={temporaryColors:["red","green"]};state.publicEffects.A.seals={red:2,blue:1,yellow:3,green:1};
  assert.deepEqual(techniquePresentation(state,own,"A").colors,[{color:"blue",sealed:true,bonusEmpty:false},{color:"yellow",sealed:true,bonusEmpty:true}]);
});
test("AC064 used, phase, actor, category and pending guards disable; old/PvP/spoofed slots stay hidden",async()=>{
  const {techniquePresentation}=await model;
  for(const change of [(s,o)=>{o.technique.usesRemaining=0;},s=>{s.phase="WORK";},s=>{s.active="B";},s=>{s.status="FINISHED";},s=>{s.skillCategoryWindow.categories=["color"];},s=>{s.publicEffects.A.seals={};}]){
    const {state,own}=fixture();change(state,own);assert.equal(techniquePresentation(state,own,"A").usable,false);
  }
  const {state,own}=fixture();assert.equal(techniquePresentation(state,own,"A",true).usable,false);
  for(const engineVersion of ["5.0.0-alpha.4",null])assert.equal(techniquePresentation({...state,engineVersion},own,"A").visible,false);
  assert.equal(techniquePresentation(state,own,"B").visible,false);
  assert.equal(techniquePresentation({...state,techniqueRule:{id:"PVP_TECHNIQUES_DISABLED_V1"}},own,"A").visible,false);
});
test("AC064 server trial descriptor is versioned; totals and malformed disclosures cannot unlock",async()=>{
  const {validRenTrialInfo}=await model,info=api.getRenTrial({cpuCharacterStats:{ren:{matches:1,wins:1}}});assert.equal(validRenTrialInfo(info),true);
  assert.equal(api.getRenTrial({stats:{cpuWins:20}}).progression.trialUnlocked,false);
  for(const changed of [{...info,trial:{...info.trial,trialVersion:2}},{...info,trial:{...info.trial,conditions:[]}},
    {...info,trial:{...info.trial,loanLoadout:{...info.trial.loanLoadout,color:["techUnsealOne","colorPrism"]}}}])assert.equal(validRenTrialInfo(changed),false);
});
test("AC064 trial result distinguishes saved learning, pending and surrender; never ordinary rewards",async()=>{
  const {terminalRewardPresentation,savedResultReward}=await resultModel,{state}=fixture();state.status="FINISHED";state.winner="A";
  const room={id:"trial",status:"finished",opponent_kind:"cpu",public_state:state};
  const p={learnedTechniques:["techUnsealOne"],cpuTrialProgress:{"ren-unseal":{clearedVersions:[1]}},matchHistory:[{matchId:state.matchId,result:"WIN",onlineOpponentKind:"cpu",matchReward:{awarded:true,ticketLevel:5,ticketCount:99}}]};
  assert.equal(savedResultReward(room,"A",p),null);assert.equal(terminalRewardPresentation(room,"A",p).kind,"trial_learned");
  assert.equal(terminalRewardPresentation(room,"A",{}).kind,"trial_pending");assert.equal(terminalRewardPresentation({...room,status:"playing"},"A",p).kind,"pending");
  state.winner="B";state.terminalReason="SURRENDER";assert.equal(terminalRewardPresentation(room,"A",p).kind,"trial_loss");
});
test("AC064 actual committed unseal cutin names only the public skill; template and reload invent no action",()=>{
  const {s,state,own}=fixture(),registry={skills:require("../standard/standard-skill-registry.js").STANDARD_SKILLS};assert.equal(cutin.publicSkillName(state,registry),null);
  const next=plain(api.apply({state:s.state,rngSnapshot:s.rngSnapshot,actor:"A",expectedVersion:0,action:{type:"USE_SKILL",payload:{skill:"techUnsealOne",color:"red"}}}));
  assert.equal(next.ok,true);assert.equal(next.privateA.technique.usesRemaining,0);assert.equal(cutin.publicSkillName(next.publicState,registry),"解封");
  const before={state,roomId:"trial-ui-room",seat:"A",ownColors:own.basicPalette,visible:true,skillRegistry:registry},after={...before,state:next.publicState};
  const described=cutin.describe(cutin.snapshot(before),cutin.snapshot(after),after);assert.equal(described.title,"解封");
  assert.doesNotMatch(JSON.stringify(described),/TRIAL_LOAN|initialBasicPalette|inventory/);assert.equal(cutin.describe(null,cutin.snapshot(after),after),null);
});
test("AC064 source wiring separates six cards and version-scoped two-click technique; not native-browser proof",()=>{
  const app=fs.readFileSync(path.join(root,"standard-online-v5/app.js"),"utf8"),html=fs.readFileSync(path.join(root,"standard-online-v5/index.html"),"utf8"),css=fs.readFileSync(path.join(root,"standard-online-v5/style.css"),"utf8");
  assert.match(html,/<div id="skillControls" class="skills"><\/div>[\s\S]*?<section id="techniqueControls"/);
  assert.match(app,/sendAction\("USE_SKILL", \{ skill: TECHNIQUE_ID, color: choice.color \}\)/);assert.match(app,/latest.scope[\s\S]*?!== scope/);
  assert.match(app,/if \(isRenTrial\(publicState\)\) return clearRandomSetupReveal\(\)/);assert.match(css,/technique-controls button[\s\S]*?min-height: 44px/);assert.match(html,/おまけ色の回数は増えません/);
  assert.doesNotMatch(app.slice(app.indexOf("function renderTechnique("),app.indexOf("function displayDate(")),/confirm\(|showModal|rarity|★/);
});
