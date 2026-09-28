"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const engine = require("../standard/standard-engine.js"), match = require("../standard/standard-match.js");
const registry = require("../standard/standard-skill-registry.js"), save = require("../standard/standard-save.js");
const intents = require("../standard-online-v5/standard-online-skill-intents.js");
const { loadEngine, plain } = require("./helpers/public-skill-fixture.cjs");
const ONE = "colorUnsealOne", BONUS = "colorBonusRefillUnseal", VERSION = "5.0.0-alpha.6";
const micro = macro => Array.from({length:16}, (_, i) => (Math.floor(macro/12)*4+Math.floor(i/4))*48+macro%12*4+i%4);
const randomState = rng => Object.fromEntries(Object.entries(rng).map(([id, stream]) => [id, stream.snapshot()]));
function fixture(version = VERSION) {
  const rng = engine.createRngDomains(710, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({matchId:"rescue-cards",engineVersion:version,firstSeat:"A",
    hands:{A:{[ONE]:1,[BONUS]:1,colorPrism:1,colorBonusRefill:1},B:{}}}, rng);
  Object.assign(state,{phase:"COLOR",pending:"R1",requiredSize:1,baseRequiredSize:1,rolledSize:1,
    regions:{R1:{id:"R1",micro:micro(13),sourceMacros:[13],controllers:["B"],color:null,isPending:true}}});
  state.basicPalettes.A=["red","blue"]; state.bonusColors.A="green"; state.bonusUsesRemaining.A=0;
  state.publicEffects.A.seals={red:2,green:3,yellow:1};
  match.validateStandardState(state);
  return {state,rng};
}
function action(state,rng,type,payload,extra={}) {
  return match.applyStandardAction({state,rngStreams:rng,actor:"A",expectedVersion:state.version,action:{type,payload},...extra});
}
function use(state,rng,id=ONE,color="red",extra={}) {
  return action(state,rng,"USE_SKILL",id===ONE?{skill:id,color}:{skill:id},extra);
}

test("UDL011 rescue cards are new ordinary ★1/★3 cards; legacy, technique and odds stay distinct",()=>{
  assert.equal(registry.V49_SKILL_IDS.length,19); assert.equal(registry.STANDARD_SKILL_IDS.length,24);
  for(const [id,rarity] of [[ONE,1],[BONUS,3]]) {
    const d=registry.STANDARD_SKILLS[id];
    assert.equal(d.rarity,rarity); assert.equal(d.standardCatalogued,true); assert.equal(d.standardUiEnabled,true);
    assert.equal(d.gachaEnabled,true); assert.equal(d.experimental,false); assert.equal(d.v49Catalogued,false);
    assert.equal(d.acquisitionType,undefined); assert.equal(d.expectedRngDraws,0);
    const gacha=require("../standard/standard-gacha-transaction.js"), pool=gacha.pool("color",rarity);
    const values=[rarity===1?0:0.95,0,(pool.indexOf(id)+0.5)/pool.length];
    assert.equal(gacha.drawOne({next:()=>values.shift()},1).skillId,id);
    const p=save.createProfile({name:"Rescue",inventory:{[id]:2}}), model=require("../standard/standard-profile.js");
    const sold=model.applyCardSale({profile:p,skillId:id,count:1,confirmed:true});
    assert.equal(sold.profile.inventory[id],1);
    assert.throws(()=>model.quoteCardSale({profile:sold.profile,skillId:id,count:1}),/KEEP_ONE_REQUIRED/);
  }
  assert.deepEqual(require("../standard/standard-gacha-transaction.js").GACHA_ODDS[2],{1:40,2:35,3:19,4:5.5,5:0.5});
  assert.equal(registry.STANDARD_SKILLS.techUnsealOne.acquisitionType,"LEARNED");
  assert.equal(registry.STANDARD_SKILLS.colorBonusRefill.experimental,true);
});

test("UDL011 each new-card loadout enters existing alpha.6 without changing old loadouts",()=>{
  const ordinary={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};
  assert.equal(registry.engineVersionForLoadouts({A:ordinary,B:ordinary},"5.0.0-alpha.4"),"5.0.0-alpha.4");
  const api=loadEngine();
  for(const id of [ONE,BONUS]) {
    const loadout={...ordinary,color:[id,"colorChoiceBorrow"]};
    assert.deepEqual(require("../standard/standard-loadout-quote.js").normalizeStandardLoadout(loadout),loadout);
    const created=api.create({matchId:"rescue-start",loadouts:{A:loadout,B:ordinary},seed:714,firstSeat:"A"});
    assert.equal(created.state.engineVersion,VERSION);
    assert.equal(created.state.hands.A[id],1); assert.equal(created.state.diePoolVersion,"small-v2");
    assert.deepEqual(plain(created.state.techniques),{A:null,B:null});
  }
});

test("UDL070 seal-removal card enables an ordinary paint, spends one card/category and no RNG",()=>{
  const {state,rng}=fixture(), before=JSON.stringify(state), random=randomState(rng);
  const unavailable=action(state,rng,"COLOR_REGION",{color:"red"}); assert.equal(unavailable.ok,false);
  const result=use(state,rng); assert.equal(result.ok,true); assert.equal(JSON.stringify(state),before);
  assert.deepEqual(randomState(rng),random); assert.equal(result.state.hands.A[ONE],0); assert.equal(result.cardConsumed,true);
  assert.equal(result.state.skillsUsed.A,1); assert.equal(result.state.version,state.version+1);
  assert.deepEqual(result.state.publicEffects.A.seals,{red:0,green:3,yellow:1});
  assert.equal(result.state.bonusUsesRemaining.A,0); assert.deepEqual(result.state.regions,state.regions);
  assert.deepEqual([result.state.turn,result.state.active,result.state.phase],[state.turn,"A","COLOR"]);
  assert.deepEqual(result.state.skillCategoryWindow,{actor:"A",categories:["color"]});
  assert.equal(use(result.state,rng,BONUS).code,"SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  assert.deepEqual(match.decodeStandardMatch(match.encodeStandardMatch(result.state)).state,result.state);
  const painted=action(result.state,rng,"COLOR_REGION",{color:"red"});
  assert.equal(painted.ok,true); assert.equal(painted.state.phase,"WORK");
});

test("UDL070 unseal does not refill an exhausted bonus or bypass adjacency",()=>{
  const exhausted=fixture();
  const unsealed=use(exhausted.state,exhausted.rng,ONE,"green"); assert.equal(unsealed.ok,true);
  assert.equal(unsealed.state.bonusUsesRemaining.A,0);
  assert.equal(action(unsealed.state,exhausted.rng,"COLOR_REGION",{color:"green"}).code,"COLOR_UNAVAILABLE");
  const adjacent=fixture();
  adjacent.state.regions.R2={id:"R2",micro:micro(14),sourceMacros:[14],controllers:["B"],color:"red",isPending:false};
  match.validateStandardState(adjacent.state);
  const rescued=use(adjacent.state,adjacent.rng).state;
  const illegal=action(rescued,adjacent.rng,"COLOR_REGION",{color:"red"});
  assert.equal(illegal.state.status,"FINISHED"); assert.equal(illegal.state.winner,"B");
  assert.equal(illegal.state.terminalReason,"ILLEGAL_COLOR");
});

for(const remaining of [0,1,3,4]) for(const sealed of [false,true]) {
  test(`UDL070 bonus refill-unseal remaining=${remaining} sealed=${sealed}`,()=>{
    const {state,rng}=fixture(); state.bonusUsesRemaining.A=remaining; state.publicEffects.A.seals.green=sealed?3:0;
    const before=JSON.stringify(state), random=randomState(rng), result=use(state,rng,BONUS);
    assert.equal(JSON.stringify(state),before); assert.deepEqual(randomState(rng),random);
    if(remaining===4&&!sealed) { assert.equal(result.code,"BONUS_FULL_AND_UNSEALED"); assert.equal(result.state,state); return; }
    assert.equal(result.ok,true); assert.equal(result.state.bonusUsesRemaining.A,Math.min(4,remaining+1));
    assert.equal(result.state.publicEffects.A.seals.green,0); assert.equal(result.state.publicEffects.A.seals.red,2);
    assert.equal(result.state.hands.A[BONUS],0); assert.equal(result.state.hands.A[ONE],1);
    const painted=action(result.state,rng,"COLOR_REGION",{color:"green"});
    assert.equal(painted.ok,true); assert.equal(painted.state.bonusUsesRemaining.A,Math.min(4,remaining+1)-1);
  });
}

test("UDL011 rescue rejects wrong ownership, unsealed and malformed targets atomically",()=>{
  for(const [payload,code] of [
    [{skill:ONE,color:"yellow"},"COLOR_NOT_OWNED"], [{skill:ONE,color:"blue"},"COLOR_NOT_SEALED"],
    [{skill:ONE,color:"purple"},"INVALID_TARGET_SCHEMA"], [{skill:ONE,color:"red",slot:1},"INVALID_TARGET_SCHEMA"],
    [{skill:BONUS,color:"red"},"INVALID_TARGET_SCHEMA"],
  ]) {
    const {state,rng}=fixture(), before=JSON.stringify(state), random=randomState(rng);
    const result=action(state,rng,"USE_SKILL",payload); assert.equal(result.code,code);
    assert.equal(result.state,state); assert.equal(JSON.stringify(state),before); assert.deepEqual(randomState(rng),random);
  }
  for(const extra of [{actor:"B"},{expectedVersion:999}]) {
    const {state,rng}=fixture(); assert.equal(use(state,rng,ONE,"red",extra).ok,false);
  }
  const {state,rng}=fixture(); state.hands.A[ONE]=0; assert.equal(use(state,rng).code,"SKILL_UNAVAILABLE");
  state.hands.A[ONE]=1; state.phase="WORK"; state.pending=null; state.regions={};
  assert.equal(use(state,rng).code,"WRONG_PHASE");
});

test("UDL011 rescue cards reject alpha.1-5 without changing their old states or RNG",()=>{
  for(const n of [1,2,3,4,5]) for(const id of [ONE,BONUS]) {
    const {state,rng}=fixture(`5.0.0-alpha.${n}`), before=JSON.stringify(state), random=randomState(rng);
    assert.equal(use(state,rng,id).code,"SKILL_ENGINE_UNSUPPORTED");
    assert.equal(JSON.stringify(state),before); assert.deepEqual(randomState(rng),random);
  }
});

test("UDL011 ordinary unseal and learned 解封 retain separate counters but share COLOR limit",()=>{
  for(const first of [ONE,"techUnsealOne"]) {
    const {state,rng}=fixture();
    state.techniqueRule={id:"CPU_LEARNED_V1",playerSeat:"A"};
    state.techniques.A={id:"techUnsealOne",definitionVersion:"unseal-v1",source:"LEARNED",usesRemaining:1};
    const result=action(state,rng,"USE_SKILL",{skill:first,color:"red"}); assert.equal(result.ok,true);
    assert.equal(result.state.techniques.A.usesRemaining,first===ONE?1:0);
    assert.equal(result.state.hands.A[ONE],first===ONE?0:1);
    assert.equal(action(result.state,rng,"USE_SKILL",{skill:first===ONE?"techUnsealOne":ONE,color:"green"}).code,"SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  }
});

test("UDL011 both rescue cards persist inventory consumption exactly once",()=>{
  for(const id of [ONE,BONUS]) {
    const {state,rng}=fixture();
    const root=save.createStandardSave({profiles:{p:save.createProfile({name:"Rescue",inventory:{[id]:2}})},
      activeMatch:{state,rngSnapshot:{},participants:{A:{type:"PROFILE",profileId:"p",displayNameSnapshot:"Rescue"},B:{type:"CPU",difficulty:"normal",policyVersion:"fixture-v1"}},startedAt:"2026-09-28T00:00:00Z",finishedAt:null,settlement:{settled:false}},reservations:{p:{[id]:1}}});
    const result=use(state,rng,id);
    const committed=save.commitAcceptedCardAction({root,beforeState:state,result,actor:"A",actionId:"rescue-once",rngSnapshot:randomState(rng)});
    assert.equal(committed.profiles.p.inventory[id],1);
    const restored=save.decodeStandardSave(save.encodeStandardSave(committed));
    assert.deepEqual(restored,committed);
    assert.equal(save.commitAcceptedCardAction({root:restored,beforeState:state,result,actor:"A",actionId:"rescue-once",rngSnapshot:{}}),restored);
    assert.equal(Object.keys(restored.receipts.matchConsumption).length,1);
  }
});

test("UDL070 picker includes exhausted owned bonus but excludes borrowed/prism/unowned colors",()=>{
  const own={basicPalette:["red","red"],bonusColor:"green",bonusUsesRemaining:0,privateEffects:{temporaryColors:["yellow"],prism:true}};
  const before=JSON.stringify(own), seals={red:1,green:2,yellow:1,blue:3};
  assert.deepEqual(intents.sealedOwnedColorChoices(own,seals),["red","green"]);
  assert.equal(JSON.stringify(own),before);
  assert.deepEqual(intents.buildSkillPayload(ONE,{color:"green"}),{skill:ONE,color:"green"});
  assert.deepEqual(intents.buildSkillPayload(BONUS),{skill:BONUS});
  assert.equal(intents.bonusRefillUnsealHasEffect(own,seals),true);
  assert.equal(intents.bonusRefillUnsealHasEffect({...own,bonusUsesRemaining:4},{green:0}),false);
  assert.equal(intents.bonusRefillUnsealHasEffect({...own,bonusUsesRemaining:4},{green:2}),true);
});
