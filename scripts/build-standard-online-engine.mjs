import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "supabase", "functions", "standard-game-action", "standard-engine.bundle.js");
const ids = [
  "standard/standard-engine.js",
  "standard/standard-region-geometry.js",
  "standard/standard-cosmetics.js",
  "standard/standard-skill-registry.js",
  "standard/standard-profile.js",
  "standard/standard-skill-handlers.js",
  "standard/standard-skill-dispatcher.js",
  "standard/standard-match.js",
  "standard/standard-cpu.js",
  "standard/standard-cpu-roster.js",
];

const modules = ids.map((id) => `${JSON.stringify(id)}:function(require,module,exports){\n${fs.readFileSync(path.join(root, id), "utf8")}\n}`).join(",\n");
const entry = String.raw`
const engine = load("standard/standard-engine.js");
const match = load("standard/standard-match.js");
const profileModel = load("standard/standard-profile.js");
const cosmetics = load("standard/standard-cosmetics.js");
const cpuRoster = load("standard/standard-cpu-roster.js");
const registry = load("standard/standard-skill-registry.js").STANDARD_SKILLS;
const categories = ["color", "area", "disrupt"];
const starterInventory = {
  colorRandomBorrow:3,colorChoiceBorrow:3,
  areaMicroBloom:3,areaDiePlus:3,
  disruptRandomOne:3,disruptChoiceOne:3,
};
const gachaOdds = {
  1:{1:55,2:30,3:12,4:2.8,5:0.2},
  2:{1:40,2:35,3:19,4:5.5,5:0.5},
  3:{1:25,2:35,3:28,4:10,5:2},
  4:{1:10,2:25,3:35,4:24,5:6},
  5:{1:2,2:8,3:30,4:40,5:20},
};
function clone(value){return JSON.parse(JSON.stringify(value));}
function validateGachaTickets(profile){
  if(!profile.gachaTickets||typeof profile.gachaTickets!=="object"||Array.isArray(profile.gachaTickets))throw new Error("INVALID_GACHA_TICKETS");
  for(const [level,count] of Object.entries(profile.gachaTickets)){
    if(!["1","2","3","4","5"].includes(level)||!Number.isSafeInteger(count)||count<0)throw new Error("INVALID_GACHA_TICKETS");
  }
  return true;
}
function validateProfile(profile){profileModel.validateProgressionFields(profile);validateGachaTickets(profile);return true;}
function createStarterProfile(displayName){
  if(typeof displayName!=="string"||displayName.trim().length<1||displayName.trim().length>20)throw new Error("INVALID_DISPLAY_NAME");
  const profile={
    displayName:displayName.trim(),quizRecords:{},gachaTickets:{"1":3},inventory:clone(starterInventory),coins:0,achievements:[],
    ...profileModel.createProgressionFields(),
  };
  validateProfile(profile);
  return profile;
}
function getCpuRoster(){return clone(cpuRoster.publicRoster());}
function createCpuProfile(characterId){
  const character=cpuRoster.CPU_CHARACTERS[characterId];
  if(!character)throw new Error("UNKNOWN_CPU_CHARACTER");
  const inventory=Object.fromEntries(Object.values(character.loadout).flat().map((id)=>[id,1]));
  const profile={displayName:character.name,quizRecords:{},gachaTickets:{},inventory,coins:0,achievements:[],...profileModel.createProgressionFields()};
  validateProfile(profile);
  return {profile,loadout:clone(character.loadout),policyVersion:character.policyVersion};
}
function chooseCpuAction({publicState,ownPrivateState,characterId,policyVersion,seed}){
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error("INVALID_SEED");
  if(typeof policyVersion!=="string"||!policyVersion)throw new Error("INVALID_CPU_POLICY_VERSION");
  const streams=engine.createRngDomains(seed,match.REQUIRED_RNG_STREAMS);
  return clone(cpuRoster.chooseCharacterAction({
    publicState,ownPrivateState,characterId,policyVersion,
    random:()=>streams["cpu-B"].next(),tieBreakRandom:()=>streams["cpu-tie-break"].next(),
  }));
}
function validateSeatLoadout({loadout,profile=null}){
  if(!loadout||typeof loadout!=="object"||Array.isArray(loadout)||Object.keys(loadout).some((key)=>!categories.includes(key)))throw new Error("INVALID_STANDARD_LOADOUT");
  const ids=[];
  for(const category of categories){
    const entries=loadout[category];
    if(!Array.isArray(entries)||entries.length!==2)throw new Error("INVALID_STANDARD_LOADOUT");
    for(const id of entries){
      const definition=registry[id];
      if(typeof id!=="string"||!definition||definition.category!==category||!definition.v49Catalogued||!definition.standardEngineImplemented||!definition.standardUiEnabled)throw new Error("SKILL_NOT_AVAILABLE");
      ids.push(id);
    }
  }
  if(new Set(ids).size!==6)throw new Error("DUPLICATE_LOADOUT_SKILL");
  if(profile!==null){
    validateProfile(profile);
    for(const id of ids)if((profile.inventory[id]||0)<1)throw new Error("INSUFFICIENT_INVENTORY");
  }
  return true;
}
function validateLoadouts(loadouts){
  if(!loadouts||typeof loadouts!=="object"||Array.isArray(loadouts))throw new Error("INVALID_LOADOUTS");
  for(const seat of ["A","B"]){
    validateSeatLoadout({loadout:loadouts[seat]});
  }
}
function projections(state,debugMode=false){
  const publicState=clone(match.projectStandardPublicState(state));
  if(debugMode)publicState.debugUnlimitedSkills=true;
  return {publicState,privateA:match.projectStandardPrivateState(state,"A"),privateB:match.projectStandardPrivateState(state,"B")};
}
function create({matchId,loadouts,profiles=null,seed,firstSeat=null,debugMode=false}){
  if(typeof debugMode!=="boolean")throw new Error("INVALID_DEBUG_MODE");
  validateLoadouts(loadouts);
  if(profiles!==null&&!debugMode){
    for(const seat of ["A","B"]){
      validateSeatLoadout({loadout:loadouts[seat],profile:profiles?.[seat]});
    }
  }
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error("INVALID_SEED");
  const streams=engine.createRngDomains(seed,match.REQUIRED_RNG_STREAMS);
  const state=match.createStandardMatch({matchId,loadouts,firstSeat},streams);
  const rngSnapshot=engine.snapshotRngDomains(streams,match.REQUIRED_RNG_STREAMS);
  return {...projections(state,debugMode),state,rngSnapshot};
}
function gachaRarity(value,ticketLevel){
  let cumulative=0;
  for(let rarity=1;rarity<=5;rarity+=1){cumulative+=gachaOdds[ticketLevel][rarity]/100;if(value<cumulative||rarity===5)return rarity;}
  return 5;
}
function drawGacha({profile,ticketLevel,count,seed}){
  validateProfile(profile);
  if(!Number.isSafeInteger(ticketLevel)||ticketLevel<1||ticketLevel>5||!Number.isSafeInteger(count)||count<1||count>100||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error("INVALID_GACHA_INPUT");
  const key=String(ticketLevel);
  const available=profile.gachaTickets[key]||0;
  if(available<count)throw new Error("INSUFFICIENT_GACHA_TICKETS");
  const stream=engine.createRngDomains(seed,match.REQUIRED_RNG_STREAMS).gacha;
  const draws=[];
  for(let index=0;index<count;index+=1){
    const rarity=gachaRarity(stream.next(),ticketLevel);
    const category=categories[Math.floor(stream.next()*categories.length)];
    const pool=Object.values(registry).filter((skill)=>skill.gachaEnabled&&!skill.experimental&&skill.v49Catalogued&&skill.category===category&&skill.rarity===rarity);
    if(!pool.length)throw new Error("EMPTY_GACHA_POOL");
    const skill=pool[Math.floor(stream.next()*pool.length)];
    draws.push({ticketLevel,rarity,category,skillId:skill.id,displayName:skill.displayName});
  }
  const next=clone(profile);
  next.gachaTickets[key]=available-count;
  for(const draw of draws)next.inventory[draw.skillId]=(next.inventory[draw.skillId]||0)+1;
  validateProfile(next);
  return {profile:next,draws};
}
function quoteCardSale({profile,skillId,count}){
  validateProfile(profile);
  return clone(profileModel.quoteCardSale({profile,skillId,count,reservedCount:0}));
}
function sellCards({profile,skillId,count,confirmed=false}){
  validateProfile(profile);
  const result=profileModel.applyCardSale({profile,skillId,count,reservedCount:0,confirmed});
  validateProfile(result.profile);
  return {profile:clone(result.profile),quote:clone(result.quote)};
}
function getCosmetics({profile}){
  validateProfile(profile);
  return clone(cosmetics.projectCosmetics(profile));
}
function quoteCosmetic({profile,cosmeticId}){
  validateProfile(profile);
  return clone(cosmetics.quoteCosmeticAction({profile,cosmeticId}));
}
function applyCosmetic({profile,cosmeticId}){
  validateProfile(profile);
  const result=cosmetics.applyCosmeticAction({profile,cosmeticId});
  validateProfile(result.profile);
  return {profile:clone(result.profile),quote:clone(result.quote)};
}
function applyProfiles({profiles,beforeState,nextState,actor,action,finishedAt,debugMode=false}){
  const next={A:clone(profiles?.A),B:clone(profiles?.B)};
  for(const seat of ["A","B"])validateProfile(next[seat]);
  const changed={A:false,B:false};
  if(debugMode)return {profiles:next,changed};
  if(action.type==="USE_SKILL"){
    const consumed=[];
    for(const id of new Set([...Object.keys(beforeState.hands[actor]),...Object.keys(nextState.hands[actor])])){
      const difference=(beforeState.hands[actor][id]||0)-(nextState.hands[actor][id]||0);
      if(difference!==0)consumed.push({id,difference});
    }
    if(consumed.length!==1||consumed[0].difference!==1)throw new Error("CARD_NOT_CONSUMED_ONCE");
    const id=consumed[0].id;
    if(!Number.isSafeInteger(next[actor].inventory[id])||next[actor].inventory[id]<1)throw new Error("INVENTORY_EMPTY");
    next[actor].inventory[id]-=1;
    validateProfile(next[actor]);
    changed[actor]=true;
  }
  if(nextState.status==="FINISHED"){
    if(typeof finishedAt!=="string"||!Number.isFinite(Date.parse(finishedAt)))throw new Error("INVALID_FINISHED_AT");
    const fullPaint=match.isMapCompleteWin(nextState);
    for(const seat of ["A","B"]){
      next[seat]=clone(profileModel.recordMatchOutcome({
        profile:next[seat],matchId:nextState.matchId,won:nextState.winner===seat,
        terminalReason:nextState.terminalReason,fullPaint,skillsUsed:nextState.skillsUsed[seat],endedAt:finishedAt,
      }));
      validateGachaTickets(next[seat]);
      next[seat].gachaTickets["1"]=(next[seat].gachaTickets["1"]||0)+1;
      changed[seat]=true;
    }
  }
  return {profiles:next,changed};
}
function applyCpuProfiles({profiles,beforeState,nextState,actor,action,finishedAt,characterId}){
  const next={A:clone(profiles?.A),B:clone(profiles?.B)};
  for(const seat of ["A","B"])validateProfile(next[seat]);
  if(!cpuRoster.CPU_CHARACTERS[characterId])throw new Error("UNKNOWN_CPU_CHARACTER");
  const changed={A:false,B:false};
  if(action.type==="USE_SKILL"){
    const consumed=[];
    for(const id of new Set([...Object.keys(beforeState.hands[actor]),...Object.keys(nextState.hands[actor])])){
      const difference=(beforeState.hands[actor][id]||0)-(nextState.hands[actor][id]||0);
      if(difference!==0)consumed.push({id,difference});
    }
    if(consumed.length!==1||consumed[0].difference!==1)throw new Error("CARD_NOT_CONSUMED_ONCE");
    const id=consumed[0].id;
    if(!Number.isSafeInteger(next[actor].inventory[id])||next[actor].inventory[id]<1)throw new Error("INVENTORY_EMPTY");
    next[actor].inventory[id]-=1;
    validateProfile(next[actor]);
    changed[actor]=true;
  }
  if(nextState.status==="FINISHED"){
    if(typeof finishedAt!=="string"||!Number.isFinite(Date.parse(finishedAt)))throw new Error("INVALID_FINISHED_AT");
    const fullPaint=match.isMapCompleteWin(nextState);
    next.A=clone(profileModel.recordCpuMatchOutcome({
      profile:next.A,matchId:nextState.matchId,cpuCharacterId:characterId,won:nextState.winner==="A",
      terminalReason:nextState.terminalReason,fullPaint,skillsUsed:nextState.skillsUsed.A,endedAt:finishedAt,
    }));
    validateGachaTickets(next.A);
    next.A.gachaTickets["1"]=(next.A.gachaTickets["1"]||0)+1;
    changed.A=true;
  }
  return {profiles:next,changed};
}
function apply({state,rngSnapshot,actor,action,expectedVersion,debugMode=false}){
  if(typeof debugMode!=="boolean")throw new Error("INVALID_DEBUG_MODE");
  match.validateStandardState(state);
  const streams=engine.createRngDomainsFromSnapshot(rngSnapshot,match.REQUIRED_RNG_STREAMS);
  const applied=match.applyStandardAction({state,actor,action,expectedVersion,rngStreams:streams});
  if(!applied.ok)return {ok:false,code:applied.code};
  let next=applied.state;
  if(debugMode&&action.type==="USE_SKILL"){
    const skill=action.payload?.skill;
    if(typeof skill!=="string")throw new Error("INVALID_DEBUG_SKILL");
    next=clone(next);
    next.hands[actor][skill]=(next.hands[actor][skill]||0)+1;
    match.validateStandardState(next);
  }
  return {
    ok:true,
    code:applied.code,
    contactColorCount:action.type==="CREATE_REGION"?applied.contactColorCount:null,
    state:next,
    rngSnapshot:engine.snapshotRngDomains(streams,match.REQUIRED_RNG_STREAMS),
    ...projections(next,debugMode),
    finished:next.status==="FINISHED",
    winnerSeat:next.winner||null,
    terminalReason:next.terminalReason||null,
  };
}
globalThis.FourColorStandardServerEngine=Object.freeze({
  ENGINE_VERSION:match.ENGINE_VERSION,
  REQUIRED_RNG_STREAMS:match.REQUIRED_RNG_STREAMS,
  StandardRuleError:engine.StandardRuleError,
  apply,
  applyCosmetic,
  applyCpuProfiles,
  applyProfiles,
  chooseCpuAction,
  create,
  createCpuProfile,
  createStarterProfile,
  drawGacha,
  getCpuRoster,
  getCosmetics,
  quoteCardSale,
  quoteCosmetic,
  sellCards,
  privateState:match.projectStandardPrivateState,
  project:projections,
  publicState:match.projectStandardPublicState,
  validateProfile,
  validateSeatLoadout,
  validateState:match.validateStandardState,
});`;

const runtime = `"use strict";(()=>{const modules={${modules}};const cache={};function normalize(parts){const out=[];for(const part of parts){if(!part||part===".")continue;if(part==="..")out.pop();else out.push(part);}return out.join("/");}function load(id){if(cache[id])return cache[id].exports;if(!modules[id])throw new Error("Unknown module: "+id);const module={exports:{}};cache[id]=module;const base=id.split("/").slice(0,-1);const localRequire=(request)=>load(request.startsWith(".")?normalize([...base,...request.split("/")]):request);modules[id](localRequire,module,module.exports);return module.exports;}\n${entry}\n})();\n`;

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, runtime, "utf8");
