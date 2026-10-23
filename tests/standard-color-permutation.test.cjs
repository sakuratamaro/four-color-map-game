"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const engine=require("../standard/standard-engine.js"),match=require("../standard/standard-match.js"),registry=require("../standard/standard-skill-registry.js");
const SWAP="disruptColorSwap",ROTATE="disruptColorRotate";
const micro=m=>Array.from({length:16},(_,i)=>(Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4);
const snapshots=rng=>Object.fromEntries(Object.entries(rng).map(([key,s])=>[key,s.snapshot()]));
function region(id,macro,color){return {id,micro:micro(macro),sourceMacros:[macro],controllers:["A","B"],color,isPending:false};}
function fixture(chain=false,version="5.0.0-alpha.6"){
 const rng=engine.createRngDomains(190928,match.REQUIRED_RNG_STREAMS);
 const state=match.createStandardMatch({matchId:"permutation",engineVersion:version,firstSeat:"A",hands:{A:{[SWAP]:2,[ROTATE]:2,legalRecolor:1,disruptChoiceOne:1},B:{[SWAP]:2,[ROTATE]:2,legalRecolor:1}}},rng);
 Object.assign(state,{phase:"WORK",turn:4,requiredSize:2,baseRequiredSize:2,rolledSize:2,regions:{R1:region("R1",13,"red"),R2:region("R2",chain?14:15,"blue"),R3:region("R3",chain?15:17,"green")}});
 state.basicPalettes.A=["red","yellow"];state.basicPalettes.B=["blue","yellow"];
 match.validateStandardState(state);return {state,rng};
}
function use(f,skill,ids,extra={}){return match.applyStandardAction({state:f.state,actor:f.state.active,expectedVersion:f.state.version,rngStreams:f.rng,action:{type:"USE_SKILL",payload:{skill,regionIds:ids,...extra}}});}
function act(f,type,payload){return match.applyStandardAction({state:f.state,actor:f.state.active,expectedVersion:f.state.version,rngStreams:f.rng,action:{type,payload}});}
function rejected(f,skill,ids,code,extra={}){
 const before=JSON.stringify(f.state),random=snapshots(f.rng),out=use(f,skill,ids,extra);
 assert.equal(out.code,code);assert.equal(out.ok,false);assert.equal(out.state,f.state);
 assert.equal(JSON.stringify(f.state),before);assert.deepEqual(snapshots(f.rng),random);return out;
}
function roundTrip(state){const after=match.decodeStandardMatch(match.encodeStandardMatch(state)).state;assert.deepEqual(after,state);return after;}

test("UDL011 two ordinary permutation cards opt in only new alpha6 loadouts and preserve frozen catalog",()=>{
 assert.equal(registry.V49_SKILL_IDS.length,19);assert.equal(registry.STANDARD_SKILL_IDS.length,26);
 for(const [id,rarity]of [[SWAP,4],[ROTATE,5]]){
  const card=registry.STANDARD_SKILLS[id];assert.equal(card.rarity,rarity);assert.equal(card.category,"disrupt");
  assert.equal(card.experimental,false);assert.equal(card.gachaEnabled,true);assert.equal(card.standardUiEnabled,true);assert.equal(card.expectedRngDraws,0);
  assert.equal(registry.engineVersionForLoadouts({A:{disrupt:[id]}},"5.0.0-alpha.4"),"5.0.0-alpha.6");
 }
 assert.equal(registry.engineVersionForLoadouts({A:{disrupt:["disruptChoiceOne"]}},"5.0.0-alpha.4"),"5.0.0-alpha.4");
});

test("UDL011 swap commits simultaneous legal colors, not shapes or a reroll, and passes WORK",()=>{
 const f=fixture(),before=structuredClone(f.state),random=snapshots(f.rng),out=use(f,SWAP,["R1","R2"]);
 assert.equal(out.ok,true);assert.deepEqual(f.state,before);const s=roundTrip(out.state);
 assert.equal(s.regions.R1.color,"blue");assert.equal(s.regions.R2.color,"red");assert.deepEqual(s.regions.R3,before.regions.R3);
 for(const id of ["R1","R2"]){assert.deepEqual({...s.regions[id],color:before.regions[id].color},before.regions[id]);}
 assert.equal(s.active,"B");assert.equal(s.phase,"WORK");assert.equal(s.turn,before.turn);assert.equal(s.version,before.version+1);
 for(const k of ["requiredSize","baseRequiredSize","rolledSize","publicEffects","privateEffects"])assert.deepEqual(s[k],before[k]);
 assert.equal(s.hands.A[SWAP],1);assert.equal(s.skillsUsed.A,1);assert.equal(s.interferenceLock,true);
 assert.deepEqual(s.skillCategoryWindow,{actor:"B",categories:[]});assert.deepEqual(snapshots(f.rng),random);assert.equal(s.rotationUsedBy,undefined);
});

test("UDL011 rotation follows selection order and saves a public once-per-actor use only after success",()=>{
 for(const [ids,expected] of [[["R1","R2","R3"],["green","red","blue"]],[["R3","R2","R1"],["blue","green","red"]]]){
  const f=fixture(true),random=snapshots(f.rng);assert.equal(f.state.rotationUsedBy,undefined);
  const out=use(f,ROTATE,ids);assert.equal(out.ok,true);const s=roundTrip(out.state);
  assert.deepEqual(["R1","R2","R3"].map(id=>s.regions[id].color),expected);assert.deepEqual(s.rotationUsedBy,["A"]);
  assert.deepEqual(match.projectStandardPublicState(s).rotationUsedBy,["A"]);assert.equal(s.hands.A[ROTATE],1);
  assert.equal(s.version,f.state.version+1);assert.equal(s.turn,f.state.turn);assert.deepEqual(snapshots(f.rng),random);
 }
});

test("UDL011 invalid and duplicate target schemas reject without partial changes",()=>{
 for(const [skill,ids] of [[SWAP,[]],[SWAP,["R1"]],[SWAP,["R1","R1"]],[SWAP,["R1",13]],[ROTATE,["R1","R2"]],[ROTATE,["R1","R2","R2"]]]){
  rejected(fixture(true),skill,ids,"INVALID_TARGET_SCHEMA");
 }
 rejected(fixture(),SWAP,["R1","R2"],"INVALID_TARGET_SCHEMA",{color:"yellow"});
 rejected(fixture(),SWAP,["R1","R99"],"INELIGIBLE_PERMUTATION_REGION");
});

test("UDL011 nonadjacent swap and ordered chain are actual edge geometry conditions",()=>{
 rejected(fixture(true),SWAP,["R1","R2"],"SWAP_REQUIRES_NONADJACENT");
 rejected(fixture(),ROTATE,["R1","R2","R3"],"ROTATION_REQUIRES_CHAIN");
 rejected(fixture(true),ROTATE,["R1","R3","R2"],"ROTATION_REQUIRES_CHAIN");
 const f=fixture();f.state.regions.R2=region("R2",26,"blue");
 assert.equal(use(f,SWAP,["R1","R2"]).ok,true,"corner-only contact is not an edge");
});

test("UDL011 changed-target and untouched-neighbor edges are checked before either color changes",()=>{
 const f=fixture();f.state.regions.R4=region("R4",25,"blue");
 rejected(f,SWAP,["R1","R2"],"RECOLOR_ADJACENCY_CONFLICT");
 const chain=fixture(true);chain.state.regions.R4=region("R4",25,"green");
 rejected(chain,ROTATE,["R1","R2","R3"],"RECOLOR_ADJACENCY_CONFLICT");
 const same=fixture();same.state.regions.R2.color="red";rejected(same,SWAP,["R1","R2"],"NO_EFFECT");
});

test("UDL011 all 384 three-color chain/neighborhood configurations match independent simultaneous legality",()=>{
 for(const a of engine.COLORS)for(const b of engine.COLORS)for(const c of engine.COLORS){
  if(new Set([a,b,c]).size!==3)continue;
  for(const left of engine.COLORS)for(const right of engine.COLORS){
   const f=fixture(true);[f.state.regions.R1.color,f.state.regions.R2.color,f.state.regions.R3.color]=[a,b,c];
   f.state.regions.R4=region("R4",25,left);f.state.regions.R5=region("R5",27,right);
   const before=JSON.stringify(f.state),random=snapshots(f.rng),ok=c!==left&&b!==right,out=use(f,ROTATE,["R1","R2","R3"]);
   assert.equal(out.ok,ok);assert.equal(JSON.stringify(f.state),before);assert.deepEqual(snapshots(f.rng),random);
   if(ok){assert.deepEqual(["R1","R2","R3"].map(id=>out.state.regions[id].color),[c,a,b]);}
   else assert.equal(out.code,"RECOLOR_ADJACENCY_CONFLICT");
  }
 }
});

test("UDL011 eligibility and outcomes do not inspect either seat's private colors/effects/hand",()=>{
 const f=fixture(),changed=fixture();changed.state.basicPalettes.B=["red","green"];changed.state.bonusColors.B="yellow";
 changed.state.hands.B={colorPrism:99};changed.state.privateEffects.B={prism:true,temporaryColors:["blue"]};
 assert.deepEqual(use(f,SWAP,["R1","R2"]).publicState,use(changed,SWAP,["R1","R2"]).publicState);
});

test("UDL011 interference cannot chain through either permutation or the existing recolor lab",()=>{
 const f=fixture();f.state=use(f,SWAP,["R1","R2"]).state;
 rejected(f,SWAP,["R1","R2"],"INTERFERENCE_CHAINED");
 const old=act(f,"USE_SKILL",{skill:"legalRecolor",regionId:"R1"});assert.equal(old.code,"INTERFERENCE_CHAINED");
 const designated=act(f,"CREATE_REGION",{sourceMacros:[25,26]});assert.equal(designated.ok,true);
 f.state=designated.state;assert.equal(f.state.interferenceLock,false);assert.equal(f.state.phase,"COLOR");
 const painted=act(f,"COLOR_REGION",{color:"red"});assert.equal(painted.ok,true);f.state=painted.state;
 assert.equal(f.state.active,"A");assert.equal(f.state.phase,"WORK");assert.equal(f.state.rotationUsedBy,undefined);
});

test("UDL011 rotation is once per actor even with extra fixture charges, remains saved after terminal",()=>{
 const f=fixture(true);f.state=use(f,ROTATE,["R1","R2","R3"]).state;
 f.state.interferenceLock=false;f.state.active="A";f.state.skillCategoryWindow={actor:"A",categories:[]};
 rejected(f,ROTATE,["R1","R2","R3"],"ROTATION_ALREADY_USED");
 f.state.active="B";f.state.skillCategoryWindow.actor="B";
 const second=use(f,ROTATE,["R1","R2","R3"]);assert.equal(second.ok,true);assert.deepEqual(second.state.rotationUsedBy,["A","B"]);
 f.state=second.state;const terminal=act(f,"SURRENDER",{});assert.equal(terminal.ok,true);
 assert.deepEqual(roundTrip(terminal.state).rotationUsedBy,["A","B"]);
});

test("UDL011 pending/reserved/prepared/delayed regions and consumed categories cannot be bypassed",()=>{
 const pending=fixture();pending.state.phase="COLOR";pending.state.pending="R1";pending.state.regions.R1.color=null;pending.state.regions.R1.isPending=true;
 rejected(pending,SWAP,["R2","R3"],"WRONG_PHASE");
 const delayed=fixture();delayed.state.regions.R1.delayed=true;rejected(delayed,SWAP,["R1","R2"],"INELIGIBLE_PERMUTATION_REGION");
 for(const flag of ["delayState","deleted"]){const f=fixture();f.state.regions.R1[flag]=true;rejected(f,SWAP,["R1","R2"],"INELIGIBLE_PERMUTATION_REGION");}
 const prepared=fixture();prepared.state.hands.A.areaMicroBloom=1;
 const preparation=act(prepared,"USE_SKILL",{skill:"areaMicroBloom",sourceMacros:[25,26]});
 assert.equal(preparation.ok,true);prepared.state=preparation.state;
 rejected(prepared,SWAP,["R1","R2"],"ACTIVE_FLOW_CONFLICT");
 const reserved=fixture();reserved.state.reserved="R3";reserved.state.regions.R3.color=null;reserved.state.regions.R3.isReserved=true;
 rejected(reserved,SWAP,["R1","R2"],"ACTIVE_FLOW_CONFLICT");
 const used=fixture();used.state.skillCategoryWindow.categories=["disrupt"];rejected(used,SWAP,["R1","R2"],"SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
});

test("UDL011 existing alpha1-5 states and field-free alpha6 saves retain their exact shape",()=>{
 for(let n=1;n<=5;n++)for(const [skill,ids]of [[SWAP,["R1","R2"]],[ROTATE,["R1","R2","R3"]]]){
  rejected(fixture(true,"5.0.0-alpha."+n),skill,ids,"SKILL_ENGINE_UNSUPPORTED");
 }
 const {state}=fixture();roundTrip(state);assert.equal(Object.hasOwn(match.projectStandardPublicState(state),"rotationUsedBy"),false);
});

test("UDL011 malformed optional public rotation history fails saved-state validation",()=>{
 for(const value of [null,{},[],["A","A"],["C"],["A","B","A"],[{"palette":["red"]}]]){
  const {state}=fixture();state.rotationUsedBy=value;assert.throws(()=>match.validateStandardState(state),e=>e.code==="INVALID_ROTATION_HISTORY");
 }
 const {state}=fixture(true,"5.0.0-alpha.5");state.rotationUsedBy=["A"];
 assert.throws(()=>match.validateStandardState(state),e=>e.code==="INVALID_ROTATION_HISTORY");
});

test("UDL011 a shifted micro shape is kept byte-identical during color permutation",()=>{
 const f=fixture();f.state.regions.R1.micro=f.state.regions.R1.micro.map(cell=>cell+1);
 const shape=structuredClone(f.state.regions.R1),out=use(f,SWAP,["R1","R2"]);assert.equal(out.ok,true);
 assert.deepEqual({...out.state.regions.R1,color:shape.color},shape);
});
