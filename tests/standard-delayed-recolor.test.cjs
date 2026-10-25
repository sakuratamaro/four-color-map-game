"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const engine=require("../standard/standard-engine.js"),match=require("../standard/standard-match.js"),registry=require("../standard/standard-skill-registry.js");
const delayed=require("../standard/standard-delayed-recolor.js"),ID=delayed.ID;
const clone=x=>structuredClone(x),micro=m=>Array.from({length:16},(_,i)=>(Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4);
const region=(id,macros,color)=>({id,micro:macros.flatMap(micro).sort((a,b)=>a-b),sourceMacros:macros,controllers:["A"],color,isPending:color===null});
const random=f=>engine.snapshotRngDomains(f.rng,match.REQUIRED_RNG_STREAMS);
function fixture(version="5.0.0-alpha.6") {
 const rng=engine.createRngDomains(280928,match.REQUIRED_RNG_STREAMS);
 const state=match.createStandardMatch({matchId:"delayed",engineVersion:version,firstSeat:"A",hands:{A:{[ID]:2},B:{[ID]:2,disruptDemolish:1,colorRegionSplit:1,colorRegionSplitKeep:1,colorPrism:1}}},rng);
 Object.assign(state,{phase:"WORK",turn:4,rolledSize:1,requiredSize:1,baseRequiredSize:1,regions:{R1:region("R1",[13],"red")}});
 state.basicPalettes.A=["blue","yellow"];state.basicPalettes.B=["blue","yellow"];
 match.validateStandardState(state);return {state,rng};
}
function act(f,type,payload,actor=f.state.active) {return match.applyStandardAction({state:f.state,actor,expectedVersion:f.state.version,rngStreams:f.rng,action:{type,payload}});}
function use(f,skill=ID,payload={regionId:"R1"}) {return act(f,"USE_SKILL",{skill,...payload});}
function step(f,type,payload) {const out=act(f,type,payload);assert.equal(out.ok,true,out.code);f.state=out.state;return out;}
function scheduled() {const f=fixture();const out=use(f);assert.equal(out.ok,true);f.state=out.state;return f;}
function dueColor(f,macros=[25],color="blue") {
 f.state.pending="R2";f.state.regions.R2=region("R2",macros,null);f.state.phase="COLOR";f.state.active="B";
 f.state.interferenceLock=false;f.state.skillCategoryWindow={actor:"B",categories:[]};
 match.validateStandardState(f.state);return act(f,"COLOR_REGION",{color});
}
function roundTrip(state) {const next=match.decodeStandardMatch(match.encodeStandardMatch(state)).state;assert.deepEqual(next,state);return next;}

test("UDL011 delayed recolor is one new ordinary rarity4 card; old loadouts and frozen19 stay unchanged",()=>{
 const d=registry.STANDARD_SKILLS[ID];assert.equal(d.rarity,4);assert.equal(d.category,"disrupt");assert.equal(d.expectedRngDraws,0);
 for(const key of ["implemented","gachaEnabled","standardCatalogued","standardUiEnabled"])assert.equal(d[key],true);
 assert.equal(d.experimental,false);assert.equal(d.v49Catalogued,false);assert.equal(registry.STANDARD_SKILL_IDS.length,27);assert.equal(registry.V49_SKILL_IDS.length,19);
 assert.equal(registry.engineVersionForLoadouts({A:{disrupt:[ID]}},"5.0.0-alpha.4"),"5.0.0-alpha.6");
 assert.equal(registry.engineVersionForLoadouts({A:{color:["colorPrism"]}},"5.0.0-alpha.4"),"5.0.0-alpha.4");
});
test("UDL011 scheduling consumes once, publishes only the used reservation, passes WORK and draws no RNG",()=>{
 const f=fixture(),before=clone(f.state),rng=random(f),out=use(f);assert.equal(out.ok,true);assert.deepEqual(f.state,before);assert.deepEqual(random(f),rng);
 const s=roundTrip(out.state);assert.equal(s.version,before.version+1);assert.equal(s.hands.A[ID],1);assert.equal(s.skillsUsed.A,1);
 assert.equal(s.active,"B");assert.equal(s.phase,"WORK");assert.equal(s.interferenceLock,true);assert.deepEqual(s.skillCategoryWindow,{actor:"B",categories:[]});
 for(const key of ["turn","rolledSize","requiredSize","baseRequiredSize","regions","publicEffects","privateEffects"])assert.deepEqual(s[key],before[key]);
 assert.deepEqual(s.delayedRecolors,[{actor:"A",regionId:"R1",version:1,color:"red",micro:micro(13),invalidated:false}]);
 const pub=match.projectStandardPublicState(s);assert.deepEqual(pub.delayedRecolors,s.delayedRecolors);assert.equal(pub.hands,undefined);assert.equal(pub.basicPalettes,undefined);
 assert.equal(Object.hasOwn(match.projectStandardPublicState(before),"delayedRecolors"),false);assert.equal(Object.hasOwn(before,"lastDelayedRecolor"),false);
});
test("UDL011 normal designation and own paint preserve reservation; opponent paint resolves legal recolor once",()=>{
 const f=scheduled(),shape=clone(f.state.regions.R1),rng=random(f);
 step(f,"CREATE_REGION",{sourceMacros:[14]});step(f,"COLOR_REGION",{color:"blue"});
 assert.equal(f.state.delayedRecolors.length,1);assert.deepEqual(random(f)["skill-effect"],rng["skill-effect"]);
 const size=f.state.requiredSize;step(f,"CREATE_REGION",{sourceMacros:Array.from({length:size},(_,i)=>25+i)});
 f.state=roundTrip(f.state);const before=clone(f.state);step(f,"COLOR_REGION",{color:"yellow"});
 assert.equal(f.state.regions.R1.color,"green");assert.deepEqual({...f.state.regions.R1,color:"red"},shape);
 assert.equal(f.state.delayedRecolors,undefined);assert.equal(f.state.version,before.version+1);assert.equal(f.state.phase,"WORK");assert.equal(f.state.active,"B");
 assert.equal(f.state.hands.A[ID],1);assert.deepEqual(f.state.lastDelayedRecolor,{version:f.state.version,actor:"A",regionId:"R1",outcome:"APPLIED",color:"green"});
 assert.notDeepEqual(random(f)["skill-effect"],rng["skill-effect"]);roundTrip(f.state);
});
test("UDL011 eligibility/target schema failures leave state, card, version and RNG intact",()=>{
 for(const change of [f=>f.state.phase="CREATE_FIRST",f=>f.state.interferenceLock=true,f=>delete f.state.regions.R1,
  f=>{f.state.pending="R1";f.state.phase="COLOR";f.state.regions.R1.color=null;f.state.regions.R1.isPending=true;},
  f=>f.state.regions.R1.delayed=true,f=>f.state.skillCategoryWindow.categories=["disrupt"]]){
  const f=fixture();change(f);const before=clone(f.state),rng=random(f),out=use(f);assert.equal(out.ok,false);assert.deepEqual(f.state,before);assert.deepEqual(random(f),rng);
 }
 for(const payload of [{regionId:"R1",color:"blue"},{regionId:1},{regionId:"missing"},{}]){
  const f=fixture(),before=clone(f.state);assert.equal(use(f,ID,payload).code,"INVALID_TARGET_SCHEMA");assert.deepEqual(f.state,before);
 }
});
test("UDL011 one pending reservation per actor and unique target reject even extra debug charges",()=>{
 const f=scheduled();f.state.interferenceLock=false;
 assert.equal(use(f).code,"RECOLOR_ALREADY_SCHEDULED");
 f.state.active="A";f.state.skillCategoryWindow={actor:"A",categories:[]};
 f.state.regions.R2=region("R2",[15],"blue");const before=clone(f.state),rng=random(f);
 assert.equal(use(f,ID,{regionId:"R2"}).code,"RECOLOR_ALREADY_SCHEDULED");assert.deepEqual(f.state,before);assert.deepEqual(random(f),rng);
});
test("UDL011 target changes invalidate permanently, including delete and recreate with same ID/shape/color",()=>{
 const f=scheduled(),demolished=use(f,"disruptDemolish",{regionId:"R1"});assert.equal(demolished.ok,true);f.state=roundTrip(demolished.state);
 assert.equal(f.state.delayedRecolors[0].invalidated,true);assert.equal(demolished.publicState.delayedRecolors[0].invalidated,true);
 f.state.basicPalettes.A=["red","blue"];step(f,"CREATE_REGION",{sourceMacros:[13]});step(f,"COLOR_REGION",{color:"red"});
 assert.equal(f.state.regions.R1.color,"red");assert.equal(f.state.delayedRecolors[0].invalidated,true);
 const size=f.state.requiredSize;step(f,"CREATE_REGION",{sourceMacros:Array.from({length:size},(_,i)=>25+i)});
 const rng=random(f);step(f,"COLOR_REGION",{color:"blue"});assert.equal(f.state.regions.R1.color,"red");
 assert.equal(f.state.lastDelayedRecolor.outcome,"TARGET_CHANGED");assert.deepEqual(random(f)["skill-effect"],rng["skill-effect"]);assert.equal(f.state.delayedRecolors,undefined);
});
test("UDL011 target shape/color mismatch at resolution is public fizzle with no RNG or refund",()=>{
 for(const change of [s=>delete s.regions.R1,s=>s.regions.R1.micro=s.regions.R1.micro.slice(0,-1),s=>s.regions.R1.color="yellow"]){
  const f=scheduled();change(f.state);const rng=random(f),out=dueColor(f);assert.equal(out.ok,true,out.code);
  assert.equal(out.state.lastDelayedRecolor.outcome,"TARGET_CHANGED");assert.equal(out.state.hands.A[ID],1);assert.equal(out.state.delayedRecolors,undefined);
  assert.deepEqual(random(f)["skill-effect"],rng["skill-effect"]);roundTrip(out.state);
 }
});
test("UDL011 no legal alternative at trigger fizzles without reading RNG",()=>{
 const f=fixture();f.state.regions={R1:region("R1",[26],"red"),R3:region("R3",[14],"blue"),R4:region("R4",[25],"green"),R5:region("R5",[27],"yellow")};
 f.state=use(f).state;const rng=random(f),out=dueColor(f,[38]);assert.equal(out.ok,true,out.code);assert.equal(out.state.regions.R1.color,"red");
 assert.equal(out.state.lastDelayedRecolor.outcome,"NO_LEGAL_COLOR");assert.deepEqual(random(f)["skill-effect"],rng["skill-effect"]);roundTrip(out.state);
});
test("UDL011 only public geometry drives resolution; each legal alternative occupies an equal RNG interval",()=>{
 const f=scheduled(),publicState=match.projectStandardPublicState(f.state),candidates=engine.legalRecolorCandidates(publicState,"R1");
 assert.equal(candidates.length,3);
 for(let i=0;i<candidates.length;i++){
  const s=clone(publicState);let draws=0;delayed.resolveDelayedRecolors(s,"B",()=>{draws++;return (i+0.5)/candidates.length;});
  assert.equal(s.regions.R1.color,candidates[i]);assert.equal(draws,1);assert.equal(s.delayedRecolors,undefined);
 }
});
test("UDL011 refused color and non-color skills do not trigger reservations",()=>{
 const f=scheduled();f.state.pending="R2";f.state.regions.R2=region("R2",[25],null);f.state.phase="COLOR";f.state.interferenceLock=false;
 const rng=random(f),before=clone(f.state);assert.equal(act(f,"COLOR_REGION",{color:"black"}).ok,false);assert.deepEqual(f.state,before);
 const prism=use(f,"colorPrism",{});assert.equal(prism.ok,true);assert.deepEqual(prism.state.delayedRecolors,f.state.delayedRecolors);
 assert.deepEqual(random(f)["skill-effect"],rng["skill-effect"]);assert.equal(prism.state.lastDelayedRecolor,undefined);
});
test("UDL011 surrender and illegal coloring discard pending events without delayed RNG",()=>{
 for(const illegal of [false,true]){
  const f=scheduled(),rng=random(f);let out;
  if(illegal){f.state.basicPalettes.B=["red","blue"];out=dueColor(f,[25],"red");}else out=act(f,"SURRENDER",{});
  assert.equal(out.ok,true);assert.equal(out.state.status,"FINISHED");assert.equal(out.state.delayedRecolors,undefined);assert.equal(out.state.lastDelayedRecolor,undefined);
  assert.deepEqual(random(f)["skill-effect"],rng["skill-effect"]);roundTrip(out.state);
 }
});
test("UDL011 ordinary and retained split trigger on the first opponent paint without escaping the second half",()=>{
 for(const skill of ["colorRegionSplit","colorRegionSplitKeep"]){
  const f=scheduled();f.state.pending="R2";f.state.regions.R2=region("R2",[25,26],null);f.state.phase="COLOR";f.state.interferenceLock=false;
  f.state.requiredSize=f.state.baseRequiredSize=f.state.rolledSize=2;
  const split=use(f,skill,{regionId:"R2",sourceMacros:[25]});assert.equal(split.ok,true);f.state=roundTrip(split.state);
  step(f,"COLOR_REGION",{color:"blue"});assert.equal(f.state.phase,"COLOR");assert.ok(f.state.pending);assert.equal(f.state.delayedRecolors,undefined);
  assert.equal(f.state.lastDelayedRecolor.outcome,"APPLIED");assert.equal(f.state.active,skill==="colorRegionSplitKeep"?"B":"A");
  if(skill==="colorRegionSplitKeep")assert.deepEqual(f.state.skillCategoryWindow.categories,["color"]);
  const rng=random(f);step(f,"COLOR_REGION",{color:"yellow"});assert.equal(f.state.phase,"WORK");assert.deepEqual(random(f)["skill-effect"],rng["skill-effect"]);roundTrip(f.state);
 }
});
test("UDL011 a final valid paint resolves first, then preserves board-completion winner and clears pending events",()=>{
 const f=fixture(),occupied=[];for(let r=1;r<=10;r++)for(let c=1;c<=10;c++)if(r*12+c!==25)occupied.push(r*12+c);
 f.state.regions={R1:region("R1",occupied,"red")};f.state=use(f).state;
 const out=dueColor(f,[25],"yellow");assert.equal(out.ok,true,out.code);assert.equal(out.state.terminalReason,"BOARD_LOCK");assert.equal(out.state.winner,"B");
 assert.equal(out.state.lastDelayedRecolor.outcome,"APPLIED");assert.equal(out.state.delayedRecolors,undefined);roundTrip(out.state);
});
test("UDL011 optional saved fields reject malformed, hidden and wrong-version payloads",()=>{
 const f=scheduled();
 for(const change of [s=>s.engineVersion="5.0.0-alpha.5",s=>s.delayedRecolors=[],s=>s.delayedRecolors[0].secretHand=[],
  s=>s.delayedRecolors[0].micro=[1,1],s=>s.delayedRecolors[0].regionId=["R1"],s=>s.delayedRecolors[0].invalidated="false",s=>s.delayedRecolors[0].version=99,
  s=>s.delayedRecolors.push(clone(s.delayedRecolors[0]))]){
  const s=clone(f.state);change(s);assert.throws(()=>match.validateStandardState(s),e=>e.code==="INVALID_DELAYED_RECOLOR");
 }
 const out=dueColor(f);assert.equal(out.ok,true);
 for(const change of [s=>s.lastDelayedRecolor.color="black",s=>s.lastDelayedRecolor.regionId=["R1"],s=>s.lastDelayedRecolor.outcome="SECRET",s=>s.lastDelayedRecolor.extra=true]){
  const s=clone(out.state);change(s);assert.throws(()=>match.validateStandardState(s),e=>e.code==="INVALID_DELAYED_RECOLOR");
 }
});
test("UDL011 alpha1-5 reject the new card without state or random changes; old field-free saves remain field-free",()=>{
 for(let n=1;n<=5;n++){
  const f=fixture(`5.0.0-alpha.${n}`),before=clone(f.state),rng=random(f);assert.equal(use(f).code,"SKILL_ENGINE_UNSUPPORTED");
  assert.deepEqual(f.state,before);assert.deepEqual(random(f),rng);assert.deepEqual(roundTrip(f.state),before);
  assert.equal(Object.hasOwn(match.projectStandardPublicState(f.state),"delayedRecolors"),false);
 }
});

test("UDL011 ordinary persisted gacha acquires delayed recolor once and replays the saved receipt",()=>{
 const gacha=require("../standard/standard-gacha-transaction.js"),save=require("../standard/standard-save.js");
 const streams=engine.createRngDomains(6,match.REQUIRED_RNG_STREAMS);
 const root=save.createStandardSave({profiles:{playerA:save.createProfile({name:"Buyer",gachaTickets:{4:1}})},
   rngSnapshot:engine.snapshotRngDomains(streams,match.REQUIRED_RNG_STREAMS)});
 let writes=0;const args={expectedRootRevision:root.rootRevision,operationId:"draw-delayed",profileId:"playerA",ticketLevel:4,count:1,
   clock:{now:()=>"2026-09-28T00:00:00Z"},storageAdapter:{setItem(){writes++;}}};
 const drawn=gacha.drawGacha({root,...args});assert.equal(drawn.ok,true);assert.equal(drawn.draws[0].skillId,ID);
 assert.equal(drawn.root.profiles.playerA.inventory[ID],1);assert.equal(drawn.root.profiles.playerA.gachaTickets["4"],0);
 const retry=gacha.drawGacha({root:drawn.root,...args});assert.equal(retry.code,"ALREADY_DRAWN");
 assert.deepEqual(retry.root,drawn.root);assert.equal(writes,1);save.validateStandardSave(drawn.root);
 for(const name of match.REQUIRED_RNG_STREAMS.filter(name=>name!=="gacha"))assert.equal(drawn.root.rngSnapshot[name],root.rngSnapshot[name]);
});

test("UDL011 bounded two-record saved fixture resolves only the opponent reservation",()=>{
 const f=scheduled();f.state.regions.R3=region("R3",[15],"yellow");f.state.version+=1;
 f.state.delayedRecolors.push({actor:"B",regionId:"R3",version:f.state.version,color:"yellow",micro:micro(15),invalidated:false});
 match.validateStandardState(f.state);roundTrip(f.state);
 const publicState=clone(match.projectStandardPublicState(f.state));let draws=0;
 delayed.resolveDelayedRecolors(publicState,"B",()=>{draws++;return 0;});
 assert.equal(draws,1);assert.deepEqual(publicState.delayedRecolors.map(e=>e.actor),["B"]);
 assert.equal(publicState.lastDelayedRecolor.actor,"A");assert.equal(publicState.regions.R3.color,"yellow");
});


test("UDL011 combined board-shrink terminal discards a real queued recolor before validation and keeps history",()=>{
 const f=fixture(),occupied=[];for(let r=1;r<=10;r++)for(let c=1;c<=10;c++)if(r*12+c!==13)occupied.push(r*12+c);
 f.state.regions={R1:region("R1",occupied,"red")};f.state.hands.B.areaResize=1;f.state.rotationUsedBy=["A"];
 const queued=use(f);assert.equal(queued.ok,true,queued.code);f.state=roundTrip(queued.state);
 const before=clone(f.state),rng=random(f),out=use(f,"areaResize",{mode:"shrink",side:"left"});
 assert.equal(out.ok,true,out.code);const s=roundTrip(out.state);
 assert.deepEqual([s.status,s.phase,s.winner,s.terminalReason],["FINISHED","GAME_OVER","B","BOARD_LOCK"]);
 assert.equal(s.delayedRecolors,undefined);assert.equal(s.lastDelayedRecolor,undefined);assert.deepEqual(s.rotationUsedBy,["A"]);
 assert.equal(s.hands.B.areaResize,0);assert.equal(s.version,before.version+1);assert.equal(out.publicState.delayedRecolors,undefined);
 assert.deepEqual(f.state,before);assert.deepEqual(random(f),rng);assert.equal(match.isMapCompleteWin(s),false);
});
