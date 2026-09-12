"use strict";
const engine=require("../../standard/standard-engine.js"),match=require("../../standard/standard-match.js"),roster=require("../../standard/standard-cpu-roster.js");
const streams=seed=>engine.createRngDomains(seed,match.REQUIRED_RNG_STREAMS);
const other=seat=>seat==="A"?"B":"A";
function macroMicro(macro,bounds){const w=bounds.macroWidth,s=bounds.microScale;
  return Array.from({length:s*s},(_,i)=>(Math.floor(macro/w)*s+Math.floor(i/s))*w*s+(macro%w)*s+i%s);}
function fixture(kind="opening",seat="A",mirrored=false){
  const character=roster.CPU_CHARACTERS.kurogane;
  let state=match.createStandardMatch({matchId:"cpu-palette-fixture",firstSeat:kind==="opening"?other(seat):seat,
    loadouts:{A:character.loadout,B:character.loadout}},streams(42051));
  if(kind==="opening"){
    const cpu=require("../../standard/standard-cpu.js");
    const o=cpu.makeObservation({publicState:match.projectStandardPublicState(state),ownPrivateState:match.projectStandardPrivateState(state,other(seat)),difficulty:"hard"});
    const action=cpu.enumerateCpuActions(o).find(a=>a.type==="CREATE_REGION");
    const r=match.applyStandardAction({state,actor:other(seat),action,expectedVersion:state.version,rngStreams:streams(42051)});
    if(!r.ok)throw Error("OPENING_NOT_ACCEPTED");state=r.state;
    state.hands[seat]={colorPaletteChange:3};
    state.basicPalettes[seat]=["red","blue"];state.bonusColors[seat]="yellow";state.bonusUsesRemaining[seat]=2;
  }else{
    Object.assign(state,{active:seat,phase:"COLOR",turn:1,pending:"R3",reserved:null});
    const w=state.playableBounds.macroWidth,left=w+1,right=w+2;
    const region=(id,macro,color)=>({id,micro:macroMicro(macro,state.playableBounds),sourceMacros:[macro],controllers:[other(seat)],color,isPending:false});
    state.regions={R1:region("R1",mirrored?2:1,"red"),R2:region("R2",mirrored?w+3:w,"blue"),
      R3:{id:"R3",micro:kind==="split"?[...macroMicro(left,state.playableBounds),...macroMicro(right,state.playableBounds)]:macroMicro(mirrored?right:left,state.playableBounds),
        sourceMacros:kind==="split"?[left,right]:[mirrored?right:left],controllers:[other(seat)],color:null,isPending:true}};
    state.basicPalettes[seat]=["red","blue"];state.bonusColors[seat]="yellow";state.bonusUsesRemaining[seat]=0;
    state.hands[seat]={colorPaletteChange:3};
    if(kind==="bonusOnly"){state.bonusColors[seat]="green";state.bonusUsesRemaining[seat]=1;}
    if(kind==="diversity"||kind==="prism"){
      delete state.regions.R1;delete state.regions.R2;state.basicPalettes[seat]=["red","red"];
      if(kind==="prism")state.privateEffects[seat].prism=true;
    }
    if(kind==="split")state.hands[seat]={colorRegionSplit:1};
    if(kind==="impossible")state.publicEffects[seat].seals={yellow:1,green:1};
  }
  match.validateStandardState(state);return state;
}
function observation(state,seat){return {publicState:match.projectStandardPublicState(state),ownPrivateState:match.projectStandardPrivateState(state,seat)};}
function choose(state,seat,id,policyVersion,seed=0,api=roster){const rng=streams(seed);
  return api.chooseCharacterAction({...observation(state,seat),characterId:id,policyVersion,
    random:()=>rng["cpu-B"].next(),tieBreakRandom:()=>rng["cpu-tie-break"].next()});}
function trace(policy,id,api=roster){return ["opening","blocked","bonusOnly","diversity","prism","split","impossible"].flatMap(kind=>
  ["A","B"].flatMap(seat=>[false,true].flatMap(mirror=>[0,42051,0xffffffff].map(seed=>{
    const state=fixture(kind,seat,mirror);return choose(state,seat,id,policy,seed,api);
  }))));}
module.exports={fixture,observation,choose,trace,streams,other};
