"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const registry = require("../standard/standard-skill-registry.js");
const cpu = require("../standard/standard-cpu.js");
const CANCEL = "colorCancelRegion", DEMOLISH = "disruptDemolish";
const micro = m => Array.from({length:16}, (_,i) => (Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4);
const rngState = rng => Object.fromEntries(Object.entries(rng).map(([k,v]) => [k,v.snapshot()]));
function fixture(version = "5.0.0-alpha.6") {
  const rng = engine.createRngDomains(923, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({matchId:"destruction",engineVersion:version,firstSeat:"A",
    hands:{A:{[DEMOLISH]:2,areaDiePlus:1,disruptChoiceOne:1},B:{[CANCEL]:2,colorPrism:1,colorRegionSplit:1}}},rng);
  Object.assign(state,{requiredSize:2,baseRequiredSize:2,rolledSize:2});
  state.basicPalettes.A=["red","blue"];state.basicPalettes.B=["green","yellow"];
  match.validateStandardState(state);
  return {state,rng};
}
function act(state,rng,type,payload,actor=state.active) {
  return match.applyStandardAction({state,rngStreams:rng,actor,expectedVersion:state.version,action:{type,payload}});
}
function receive(f = fixture()) {
  const result = act(f.state,f.rng,"CREATE_REGION",{sourceMacros:[13,14]});
  assert.equal(result.ok,true);return {...f,state:result.state};
}
function use(state,rng,skill,payload={}) { return act(state,rng,"USE_SKILL",{skill,...payload}); }
function restored(state) { const copy=match.decodeStandardMatch(match.encodeStandardMatch(state)).state;assert.deepEqual(copy,state);return copy; }

test("UDL011 destruction cards are separate ordinary cards and opt in only new loadouts",()=>{
  assert.equal(registry.V49_SKILL_IDS.length,19);assert.equal(registry.STANDARD_SKILL_IDS.length,24);
  for(const id of [CANCEL,DEMOLISH]) {
    const d=registry.STANDARD_SKILLS[id];assert.equal(d.rarity,4);assert.equal(d.gachaEnabled,true);
    assert.equal(d.experimental,false);assert.equal(d.standardUiEnabled,true);assert.equal(d.v49Catalogued,false);
    assert.equal(registry.engineVersionForLoadouts({A:{[d.category]:[id]}},"5.0.0-alpha.4"),"5.0.0-alpha.6");
  }
  assert.equal(registry.engineVersionForLoadouts({A:{color:["colorPrism"]}},"5.0.0-alpha.4"),"5.0.0-alpha.4");
});

test("UDL070 cancellation -> different designation -> paint preserves RNG, turn and used COLOR category",()=>{
  let {state,rng}=receive();state.publicEffects.B.seals={red:2};
  state.privateEffects.B.paletteDebuffs=[{slot:0,previousColor:"blue",injectedColor:"green",remaining:2}];
  const before=structuredClone(state), random=rngState(rng);
  const result=use(state,rng,CANCEL);assert.equal(result.ok,true);assert.deepEqual(state,before);
  state=restored(result.state);assert.equal(state.version,before.version+1);
  assert.equal(state.active,"A");assert.equal(state.phase,"WORK");assert.equal(state.pending,null);
  assert.deepEqual(state.regions,{});assert.equal(state.hands.B[CANCEL],1);assert.equal(state.turn,before.turn);
  assert.deepEqual(rngState(rng),random);assert.deepEqual(state.publicEffects,before.publicEffects);
  assert.deepEqual(state.privateEffects,before.privateEffects);
  assert.equal(use(state,rng,"areaDiePlus").code,"REDESIGNATION_ONLY");
  assert.equal(act(state,rng,"CREATE_REGION",{sourceMacros:[14,13]}).code,"SAME_CANCELLED_DESIGNATION");
  const resent=act(state,rng,"CREATE_REGION",{sourceMacros:[25,26]});assert.equal(resent.ok,true);
  state=restored(resent.state);assert.equal(state.redesignation.stage,"COLOR");assert.equal(state.active,"B");
  assert.deepEqual(state.skillCategoryWindow,{actor:"B",categories:["color"]});
  assert.equal(state.turn,before.turn);assert.deepEqual(rngState(rng),random);
  assert.equal(use(state,rng,CANCEL).code,"SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  assert.equal(use(state,rng,"colorPrism").code,"SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  const painted=act(state,rng,"COLOR_REGION",{color:"yellow"});assert.equal(painted.ok,true);
  assert.equal(painted.state.phase,"WORK");assert.equal(painted.state.redesignation,undefined);
  assert.equal(painted.state.publicEffects.B.seals.red,1);
  assert.equal(painted.state.privateEffects.B.paletteDebuffs[0].remaining,1);
  assert.deepEqual(painted.state.skillCategoryWindow.categories,["color"]);
  assert.equal(painted.state.hands.B[CANCEL],1);restored(painted.state);
});

test("UDL070 CPU redesignates legally without new skills or repeating the cancelled cells",()=>{
  const {state,rng}=receive(), next=use(state,rng,CANCEL).state;
  const observation=cpu.makeObservation({publicState:match.projectStandardPublicState(next),ownPrivateState:match.projectStandardPrivateState(next,"A"),difficulty:"hard"});
  const candidates=cpu.enumerateCpuActions(observation);assert.ok(candidates.length);
  assert.ok(candidates.every(a=>a.type==="CREATE_REGION"));
  for(const action of candidates) { assert.notDeepEqual(action.payload.sourceMacros,[13,14]);assert.equal(act(next,rng,action.type,action.payload).ok,true); }
});

test("UDL070 no alternative rejects without consuming the card, state or RNG",()=>{
  const {state,rng}=fixture();state.requiredSize=state.baseRequiredSize=state.rolledSize=1;
  const occupied=[];
  for(let r=state.playableBounds.minRow;r<=state.playableBounds.maxRow;r++)
    for(let c=state.playableBounds.minCol;c<=state.playableBounds.maxCol;c++) if(r*12+c!==13) occupied.push(r*12+c);
  state.regions.R1={id:"R1",micro:occupied.flatMap(micro),sourceMacros:occupied,controllers:["A"],color:"red",isPending:false};
  const received=act(state,rng,"CREATE_REGION",{sourceMacros:[13]}).state;
  const before=JSON.stringify(received), random=rngState(rng), result=use(received,rng,CANCEL);
  assert.equal(result.code,"NO_ALTERNATIVE_DESIGNATION");assert.equal(result.state,received);
  assert.equal(JSON.stringify(received),before);assert.deepEqual(rngState(rng),random);
});

test("UDL070 split halves and malformed cancellation payload cannot bypass coloring obligations",()=>{
  const {state,rng}=receive();
  assert.equal(use(state,rng,CANCEL,{regionId:state.pending}).code,"INVALID_TARGET_SCHEMA");
  const split=use(state,rng,"colorRegionSplit",{regionId:state.pending,sourceMacros:[13]});assert.equal(split.ok,true);
  const forced=structuredClone(split.state);forced.skillCategoryWindow.categories=[];
  assert.equal(use(forced,rng,CANCEL).code,"RECEIVED_REGION_REQUIRED");
  const colored=act(split.state,rng,"COLOR_REGION",{color:"yellow"}).state;
  colored.hands.A[CANCEL]=1;
  assert.equal(use(colored,rng,CANCEL).code,"RECEIVED_REGION_REQUIRED");
});

test("UDL011 demolition removes geometry rather than leaving a blank occupied area",()=>{
  const {state,rng}=fixture();state.phase="WORK";
  state.regions.R1={id:"R1",micro:[13,14,25,26].flatMap(micro),sourceMacros:[13,14,25,26],controllers:["B"],color:"red",isPending:false};
  const before=structuredClone(state), random=rngState(rng), result=use(state,rng,DEMOLISH,{regionId:"R1"});
  assert.equal(result.ok,true);assert.deepEqual(state,before);assert.deepEqual(result.state.regions,{});
  assert.deepEqual(rngState(rng),random);assert.equal(result.state.active,"A");assert.equal(result.state.turn,state.turn);
  assert.equal(result.state.hands.A[DEMOLISH],1);assert.deepEqual(result.state.skillCategoryWindow.categories,["disrupt"]);
  assert.equal(use(result.state,rng,"disruptChoiceOne",{color:"red"}).code,"SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  assert.equal(act(restored(result.state),rng,"CREATE_REGION",{sourceMacros:[13,14]}).ok,true);
});

test("UDL011 demolition measures micro area and rejects oversized, absent and malformed targets atomically",()=>{
  const {state,rng}=fixture();state.phase="WORK";
  state.regions.R1={id:"R1",micro:[13,14,15,25,26].flatMap(micro),sourceMacros:[13,14,15,25,26],controllers:["A"],color:"red",isPending:false};
  const before=JSON.stringify(state), random=rngState(rng);
  assert.equal(use(state,rng,DEMOLISH,{regionId:"R1"}).code,"DESTRUCTION_AREA_LIMIT");
  assert.equal(use(state,rng,DEMOLISH,{regionId:"R99"}).code,"INVALID_DESTRUCTION_TARGET");
  assert.equal(use(state,rng,DEMOLISH,{regionId:"R1",color:"red"}).code,"INVALID_TARGET_SCHEMA");
  assert.equal(JSON.stringify(state),before);assert.deepEqual(rngState(rng),random);
  state.regions.R1.micro=state.regions.R1.micro.slice(0,64);
  assert.equal(use(state,rng,DEMOLISH,{regionId:"R1"}).ok,true);
});

test("UDL011 both new cards reject alpha.1-5 and do not rewrite their states",()=>{
  for(let n=1;n<=5;n++) for(const id of [CANCEL,DEMOLISH]) {
    const {state,rng}=fixture(`5.0.0-alpha.${n}`), before=JSON.stringify(state), random=rngState(rng);
    assert.equal(use(state,rng,id,id===DEMOLISH?{regionId:"R1"}:{}).code,"SKILL_ENGINE_UNSUPPORTED");
    assert.equal(JSON.stringify(state),before);assert.deepEqual(rngState(rng),random);
  }
});

test("UDL070 malformed saved redesignation is rejected; both active stages allow surrender",()=>{
  const {state,rng}=receive(), cancelled=use(state,rng,CANCEL).state;
  for(const mutate of [s=>s.redesignation.receiver="A",s=>s.redesignation.sourceMacros=[13,13],s=>s.redesignation.sourceMacros=[13,26],
    s=>s.redesignation.receiverCategories=[],s=>s.redesignation.privatePalette=["red"],s=>s.engineVersion="5.0.0-alpha.5"]) {
    const broken=structuredClone(cancelled);mutate(broken);assert.throws(()=>match.validateStandardState(broken),e=>e.code==="INVALID_REDESIGNATION");
  }
  const resent=act(cancelled,rng,"CREATE_REGION",{sourceMacros:[25,26]}).state;
  for(const s of [cancelled,resent]) {const end=act(s,rng,"SURRENDER",{});assert.equal(end.ok,true);assert.equal(end.state.redesignation,undefined);restored(end.state);}
});

test("UDL070 cancellation retains a previous +1 requirement of five without a reroll",()=>{
  const {state,rng}=fixture();state.rolledSize=state.baseRequiredSize=4;state.requiredSize=5;
  const received=act(state,rng,"CREATE_REGION",{sourceMacros:[13,14,15,16,17]}).state;
  const random=rngState(rng),cancelled=use(received,rng,CANCEL).state;
  assert.equal(cancelled.requiredSize,5);assert.equal(cancelled.baseRequiredSize,4);assert.equal(cancelled.rolledSize,4);
  const result=act(cancelled,rng,"CREATE_REGION",{sourceMacros:[25,26,27,28,29]});assert.equal(result.ok,true);
  assert.equal(result.state.requiredSize,5);assert.deepEqual(rngState(rng),random);
});

test("UDL070 cancellation never guarantees legal color; illegal paint clears the obligation",()=>{
  const {state,rng}=receive();state.basicPalettes.B=["red","blue"];
  state.regions.R9={id:"R9",micro:micro(24),sourceMacros:[24],controllers:["A"],color:"red",isPending:false};
  const cancelled=use(state,rng,CANCEL);assert.equal(cancelled.ok,true);
  const resent=act(cancelled.state,rng,"CREATE_REGION",{sourceMacros:[25,26]});assert.equal(resent.ok,true);
  const lost=act(resent.state,rng,"COLOR_REGION",{color:"red"});assert.equal(lost.code,"ILLEGAL_COLOR");
  assert.equal(lost.state.status,"FINISHED");assert.equal(lost.state.redesignation,undefined);restored(lost.state);
});

test("UDL011 both cards are acquired by an ordinary persisted draw exactly once",()=>{
  const gacha=require("../standard/standard-gacha-transaction.js"),save=require("../standard/standard-save.js");
  for(const [id,seed] of [[CANCEL,21],[DEMOLISH,30]]) {
    const streams=engine.createRngDomains(seed,match.REQUIRED_RNG_STREAMS);
    const root=save.createStandardSave({profiles:{playerA:save.createProfile({name:"Buyer",gachaTickets:{4:1}})},
      rngSnapshot:engine.snapshotRngDomains(streams,match.REQUIRED_RNG_STREAMS)});
    let writes=0;const args={expectedRootRevision:root.rootRevision,operationId:"draw-"+id,profileId:"playerA",ticketLevel:4,count:1,
      clock:{now:()=>"2026-09-28T00:00:00Z"},storageAdapter:{setItem(){writes++;}}};
    const drawn=gacha.drawGacha({root,...args});assert.equal(drawn.ok,true);assert.equal(drawn.draws[0].skillId,id);
    assert.equal(drawn.root.profiles.playerA.inventory[id],1);assert.equal(drawn.root.profiles.playerA.gachaTickets["4"],0);
    const retry=gacha.drawGacha({root:drawn.root,...args});assert.equal(retry.code,"ALREADY_DRAWN");
    assert.deepEqual(retry.root,drawn.root);assert.equal(writes,1);save.validateStandardSave(drawn.root);
  }
});

test("UDL011 shifted micro geometry is removable but prepared outgoing geometry is protected",()=>{
  const {state,rng}=fixture();state.phase="WORK";state.requiredSize=state.rolledSize=state.baseRequiredSize=1;
  state.regions.R1={id:"R1",micro:[13,14,25,26].flatMap(micro).map(m=>m+1),sourceMacros:[13,14,25,26],controllers:["B"],color:"red",isPending:false};
  match.validateStandardState(state);assert.equal(use(state,rng,DEMOLISH,{regionId:"R1"}).ok,true);
  state.regions.R1.micro=micro(13);state.regions.R1.sourceMacros=[13];state.hands.A.areaMicroBloom=1;
  const prepared=use(state,rng,"areaMicroBloom",{sourceMacros:[26]});assert.equal(prepared.ok,true);
  const before=structuredClone(prepared.state),random=rngState(rng);
  assert.equal(use(prepared.state,rng,DEMOLISH,{regionId:"R1"}).code,"INVALID_DESTRUCTION_TARGET");
  assert.deepEqual(prepared.state,before);assert.deepEqual(rngState(rng),random);
});

test("UDL070 retained split cannot be cancelled before either of its required paints",()=>{
  const {state,rng}=receive();state.hands.B.colorRegionSplitKeep=1;
  const split=use(state,rng,"colorRegionSplitKeep",{regionId:state.pending,sourceMacros:[13]});
  assert.equal(split.ok,true);
  const first=act(split.state,rng,"COLOR_REGION",{color:"yellow"});assert.equal(first.ok,true);
  for(const s of [split.state,first.state]) {
    const before=structuredClone(s),random=rngState(rng);
    assert.equal(use(s,rng,CANCEL).code,"SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
    assert.deepEqual(s,before);assert.deepEqual(rngState(rng),random);
  }
});
