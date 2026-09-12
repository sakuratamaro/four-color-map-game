"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const {chooseOwnAction,redactEvents,LOADOUT}=require("../scripts/live-standard-skill-cutin-canary.cjs");
const source=fs.readFileSync(path.join(__dirname,"../scripts/live-standard-skill-cutin-canary.cjs"),"utf8");
test("cut-in live driver refuses without explicit scope before browser or network",()=>{
  for(const args of [[],["--confirm-live"],["--candidate="+"a".repeat(40)]]){
    const r=spawnSync(process.execPath,["scripts/live-standard-skill-cutin-canary.cjs",...args],{cwd:path.join(__dirname,".."),encoding:"utf8",windowsHide:true});
    assert.equal(r.status,2);assert.match(r.stderr,/Refusing production test/);assert.equal(r.stdout,"");
  }
});
test("cut-in human planner passes public and only own private projection, never opponent state",()=>{
  for(const phase of ["COLOR","CREATE_FIRST","WORK"]){
    const room={publicState:{active:"A",phase},privateState:{seat:"A",hand:{own:1}},otherPrivateState:{secret:true}};
    let observed;
    const planner={makeObservation:o=>(observed=o,o),enumerateCpuActions:()=>[{type:"USE_SKILL",payload:{skill:"unused"}},{type:phase==="COLOR"?"COLOR_REGION":"CREATE_REGION",payload:{chosen:true}}]};
    const actual=chooseOwnAction(room,planner);
    assert.equal(observed.publicState,room.publicState);assert.equal(observed.ownPrivateState,room.privateState);
    assert.deepEqual(Object.keys(observed).sort(),["difficulty","ownPrivateState","publicState"]);
    assert.deepEqual(actual,{type:phase==="COLOR"?"COLOR_REGION":"CREATE_REGION",payload:{chosen:true}});
  }
});
test("cut-in live driver rejects wrong viewer, opponent turn and missing legal candidate",()=>{
  const planner={makeObservation:o=>o,enumerateCpuActions:()=>[]};
  for(const room of [{privateState:{seat:"B"}},{privateState:{seat:"A"},publicState:{active:"B"}},{privateState:{seat:"A"},publicState:{active:"A",phase:"FINISHED"}},{privateState:{seat:"A"},publicState:{active:"A",phase:"COLOR"}}])
    assert.throws(()=>chooseOwnAction(room,planner));
});
test("cut-in report redacts event identity and unrelated transient/session data",()=>{
  const r=redactEvents([{eventId:"private-match:4",token:"sensitive",actor:"self",title:"known",detail:"observed",pointerTransparent:true,focusOutside:true,animation:"skill-from-hand",paletteReacted:true,boardReacted:false}]);
  assert.deepEqual(r,[{actor:"self",title:"known",detail:"observed",pointerTransparent:true,focusOutside:true,animation:"skill-from-hand",paletteReacted:true,boardReacted:false}]);
});
test("cut-in live scope is one fresh profile/match, exact bytes first, finite moves and cleanup after abort",()=>{
  assert.equal(Object.values(LOADOUT).flat().length,6);
  assert.equal((source.match(/await request\("\/auth\/v1\/signup"/g)||[]).length,1);
  assert.equal((source.match(/operation:"cpu-start"/g)||[]).length,1);
  assert.ok(source.indexOf("exact fixed Git bytes")<source.indexOf('stage="one isolated'));
  assert.match(source,/!fs\.existsSync\(reportPath\)/);
  assert.match(source,/if\(!cleaning\)abort\.signal\.throwIfAborted\(\)/);
  assert.match(source,/for\(let i=0;i<6;i\+\+\)/);
  assert.match(source,/poll<12/);
  assert.match(source,/\+\+humanSteps<=9/);
  assert.match(source,/\+\+cpuSteps<=24/);
  assert.match(source,/cleaning=true;clearTimeout\(timer\)/);
  assert.match(source,/await action\("SURRENDER"\)/);
  assert.match(source,/NOT_RUN_NO_CPU_SKILL_OBSERVED_WITHIN_BOUND/);
  assert.doesNotMatch(source,/operation:"(?:gacha|quiz|cosmetic|admin|delete)|service_role|auth\.admin|mock|route\.fulfill/);
});
