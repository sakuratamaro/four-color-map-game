"use strict";
// F1 policy-only checkpoint; fixtures are authored/accepted, not historical games.
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const cpu=require("../standard/standard-cpu.js"),roster=require("../standard/standard-cpu-roster.js"),match=require("../standard/standard-match.js");
const {fixture,observation,choose,trace,streams,other}=require("./helpers/cpu-palette-fixtures.cjs");
const policy=id=>roster.PALETTE_EFFICIENCY_POLICY_VERSION+":"+id;
const actions=(state,seat)=>{const o=cpu.makeObservation({...observation(state,seat),difficulty:"hard"});return cpu.filterPaletteEfficiencyActions(o,cpu.enumerateCpuActions(o,{orderedSplits:true}));};
const apply=(state,seat,action)=>{const r=match.applyStandardAction({state,actor:seat,action,expectedVersion:state.version,rngStreams:streams(42051)});assert.equal(r.ok,true,action.type+"/"+r.code);return r.state;};

test("paired F1: other nine new policies paint normally without a useless palette change",()=>{
  for(const seat of ["A","B"])for(const id of Object.keys(roster.CPU_CHARACTERS).filter(id=>id!=="kurogane"))for(const seed of [0,42051,0xffffffff]){
    const state=fixture("opening",seat),before=structuredClone(state),a=choose(state,seat,id,policy(id),seed);
    assert.equal(a.type,"COLOR_REGION",id);const next=apply(state,seat,a);
    assert.equal(next.hands[seat].colorPaletteChange,3);assert.deepEqual(next.basicPalettes[seat],state.basicPalettes[seat]);
    assert.deepEqual(state,before);assert.equal(next.active,seat);assert.equal(next.phase,"WORK");
  }
  assert.equal(choose(fixture(),"A","kurogane",roster.CPU_CHARACTERS.kurogane.policyVersion).payload.skill,"colorPaletteChange","saved split policy retains its original choice");
});
test("paired rescue: blocked basics/empty bonus still select and execute necessary palette change",()=>{
  for(const seat of ["A","B"])for(const mirror of [false,true])for(const id of Object.keys(roster.CPU_CHARACTERS))for(const seed of [0,42051,0xffffffff]){
    const state=fixture("blocked",seat,mirror),a=choose(state,seat,id,policy(id),seed);
    assert.equal(a.payload.skill,"colorPaletteChange",id);assert.ok(a.payload.slot<2);
    const changed=apply(state,seat,a);assert.equal(changed.hands[seat].colorPaletteChange,2);
    const paint=choose(changed,seat,id,policy(id),seed);assert.equal(paint.type,"COLOR_REGION");
    const painted=apply(changed,seat,paint);assert.equal(painted.active,seat);assert.equal(painted.phase,"WORK");
  }
});
test("useful diversity and basic-color rescue are preserved rather than blanket skill suppression",()=>{
  for(const kind of ["diversity","prism","bonusOnly"])for(const seat of ["A","B"]){
    const state=fixture(kind,seat),a=choose(state,seat,"minato",policy("minato"));
    assert.equal(a.payload.skill,"colorPaletteChange",kind);assert.ok(a.payload.slot<2);
    const next=apply(state,seat,a);
    if(kind!=="bonusOnly")assert.ok(new Set(next.basicPalettes[seat]).size>new Set(state.basicPalettes[seat]).size);
    const paint=choose(next,seat,"minato",policy("minato"));assert.equal(paint.type,"COLOR_REGION");
    assert.equal(apply(next,seat,paint).bonusUsesRemaining[seat],state.bonusUsesRemaining[seat],"basic choice does not consume bonus");
  }
});
test("expired bonus edits, sealed dead changes and loss of the only legal color are rejected",()=>{
  const state=fixture("blocked"),candidates=actions(state,"A");
  assert.ok(candidates.length>0);assert.ok(candidates.every(a=>a.payload.slot<2));
  assert.equal(choose(fixture("impossible"),"A","kurogane",policy("kurogane")).type,"SURRENDER");
  const o=observation(fixture("diversity"),"A");o.publicState.publicEffects.A.seals={blue:1};
  const make=color=>({type:"USE_SKILL",payload:{skill:"colorPaletteChange",slot:0,color},metrics:{}});
  assert.deepEqual(cpu.filterPaletteEfficiencyActions(o,[make("blue")]),[]);
  const blocked=observation(fixture("bonusOnly"),"A");
  assert.deepEqual(cpu.filterPaletteEfficiencyActions(blocked,[{type:"USE_SKILL",payload:{skill:"colorPaletteChange",slot:2,color:"red"},metrics:{}}]),[]);
});
test("zero charge and used category remain enforced by authoritative enumeration",()=>{
  for(const exhausted of ["charge","category"]){const state=fixture("blocked");
    if(exhausted==="charge")state.hands.A.colorPaletteChange=0;
    else state.skillCategoryWindow.categories=["color"];
    const a=choose(state,"A","kurogane",policy("kurogane"));assert.equal(a.type,"SURRENDER",exhausted);
  }
});
test("new F1 policy retains both F3 split roles through real split/color/return",()=>{
  for(const seat of ["A","B"])for(const mirror of [false,true])for(const id of Object.keys(roster.CPU_CHARACTERS)){
    const state=fixture("split",seat,mirror),a=choose(state,seat,id,policy(id));assert.equal(a.payload.skill,"colorRegionSplit");
    assert.deepEqual(a.payload.sourceMacros,[state.playableBounds.macroWidth+(mirror?1:2)]);
    const split=apply(state,seat,a),reserved=split.reserved,paint=choose(split,seat,id,policy(id));
    assert.equal(paint.type,"COLOR_REGION");const after=apply(split,seat,paint);assert.equal(after.pending,reserved);assert.equal(after.active,other(seat));
  }
});
test("selection is immutable, deterministic and blind to opponent private state",()=>{
  for(const seat of ["A","B"])for(const id of Object.keys(roster.CPU_CHARACTERS))for(const kind of ["opening","blocked","diversity","split"]){
    const state=fixture(kind,seat),before=structuredClone(state),poison=structuredClone(state);
    poison.hands[other(seat)]={colorPrism:999};poison.basicPalettes[other(seat)]=["green","green"];poison.privateEffects[other(seat)]={hidden:"not available"};
    assert.deepEqual(choose(state,seat,id,policy(id),73),choose(poison,seat,id,policy(id),73));assert.deepEqual(state,before);
  }
});
test("alpha.1 and default selection remain unchanged; new versions cannot cross character IDs",()=>{
  for(const id of Object.keys(roster.CPU_CHARACTERS)){
    const state=fixture();state.engineVersion="5.0.0-alpha.1";delete state.skillCategoryWindow;
    assert.deepEqual(choose(state,"A",id,policy(id)),choose(state,"A",id,roster.CPU_CHARACTERS[id].policyVersion));
    assert.equal(roster.CPU_CHARACTERS[id].policyVersion,roster.SPLIT_RESCUE_POLICY_VERSION+":"+id,"default not activated until rollout integration");
    for(const invalid of [policy(id=== "rei"?"yuzu":"rei"),policy(id)+":extra","standard-character-palette-efficiency-v2:"+id])
      assert.throws(()=>choose(fixture(),"A",id,invalid),/UNKNOWN_CPU_POLICY_VERSION/);
  }
});
test("all21 saved policies match baseline golden choices across84 authored observations each",()=>{
  const golden=require("./fixtures/cpu-palette-legacy-traces.json");assert.equal(golden.baseSha,"d9ce111d7d97019d55b3e90842602001e045ea04");
  assert.equal(golden.policies.length,21);
  for(const entry of golden.policies){const rows=trace(entry.policy,entry.character);assert.equal(rows.length,84);
    assert.equal(crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex"),entry.sha256,entry.policy);}
});

test("F1 leaves WORK and F2 scoring unchanged for every character",()=>{
  for(const id of Object.keys(roster.CPU_CHARACTERS))for(const seed of [0,42051,0xffffffff]){
    const state=fixture(),paint=actions(state,"A").find(a=>a.type==="COLOR_REGION"),work=apply(state,"A",paint);
    assert.deepEqual(choose(work,"A",id,policy(id),seed),choose(work,"A",id,roster.CPU_CHARACTERS[id].policyVersion,seed));
  }
});
