"use strict";
const assert=require("node:assert/strict"),{loadEngine,plain}=require("./public-skill-fixture.cjs");
const api=loadEngine(),ID="disruptDelayedRecolor";
const micro=m=>Array.from({length:16},(_,i)=>(Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4);
async function installDelayedUi(page,roomId) {
 const loadout={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:[ID,"disruptChoiceOne"]};
 let current=plain(api.create({matchId:`${roomId}:0`,loadouts:{A:loadout,B:loadout},seed:923,firstSeat:"A"}));
 Object.assign(current.state,{phase:"WORK",requiredSize:1,rolledSize:1,baseRequiredSize:1,regions:{R1:{id:"R1",micro:micro(13),sourceMacros:[13],controllers:["B"],color:"red",isPending:false}}});
 current.state.basicPalettes.A=["blue","yellow"];current.state.basicPalettes.B=["blue","yellow"];
 api.validateState(current.state);
 const projection=()=>plain(api.project(current.state)),calls=[];
 function apply(actor,action){const result=plain(api.apply({...current,actor,expectedVersion:current.state.version,action}));assert.equal(result.ok,true,JSON.stringify(result));current={state:result.state,rngSnapshot:result.rngSnapshot};}
 await page.exposeFunction("__delayedSnapshot",projection);
 await page.exposeFunction("__delayedApply",body=>{calls.push(plain(body));apply("A",body.action);return projection();});
 function install(data){
  const base=globalThis.__standardOnlineMockSupabase,r=globalThis.__standardOnlineRuntime;
  const reflect=p=>{r.room={...r.room,id:data.roomId,status:"playing",version:p.publicState.version,opponent_kind:"human",public_state:p.publicState};r.view={seat:"A",version:r.room.version,private_state:p.privateA};};
  reflect(data.initial);const rpc=base.rpc;base.rpc=async(...args)=>{reflect(await globalThis.__delayedSnapshot());return rpc(...args);};
  const invoke=base.functions.invoke;base.functions.invoke=async(name,request)=>{
   if(request.body.operation!=="action")return invoke(name,request);
   r.calls.push({kind:"invoke",name,body:request.body});await globalThis.__standardOnlineRecordInvoke(request.body);
   reflect(await globalThis.__delayedApply(request.body));return {data:{room:{version:r.room.version},result:{code:"OK"}}};
  };return base;
 }
 await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",route=>route.fulfill({status:200,contentType:"text/javascript",body:`export function createClient(){return (${install.toString()})(${JSON.stringify({roomId,initial:projection()})})}`}));
 return {calls,state:()=>plain(current.state),opponentDesignates:()=>apply("B",{type:"CREATE_REGION",payload:{sourceMacros:[14]}}),opponentPaint:()=>apply("B",{type:"COLOR_REGION",payload:{color:"yellow"}})};
}
function localDelayedFixture() {
 const engine=require("../../standard/standard-engine.js"),match=require("../../standard/standard-match.js");
 const save=require("../../standard/standard-save.js"),start=require("../../standard/standard-match-start.js");
 const {createStandardLocalSession}=require("../../standard/standard-local-session.js");
 const loadout={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:[ID,"disruptChoiceOne"]};
 const inventory=Object.fromEntries(Object.values(loadout).flat().map(id=>[id,1]));
 const rng=engine.createRngDomains(923,match.REQUIRED_RNG_STREAMS);
 const root=save.createStandardSave({profiles:{playerA:save.createProfile({name:"Fixture A",inventory}),playerB:save.createProfile({name:"Fixture B",inventory})},rngSnapshot:engine.snapshotRngDomains(rng,match.REQUIRED_RNG_STREAMS)});
 let payload=save.encodeStandardSave(root),serial=0;
 const session=createStandardLocalSession({storageAdapter:{getItem:()=>payload,setItem:(_key,value)=>{payload=value;}},clock:{now:()=>"2026-09-28T05:00:00.000Z"},idFactory:scope=>`local-delayed-${scope}-${++serial}`});
 const args={profileAId:"playerA",profileBId:"playerB",matchId:"local-delayed-native",operationId:"local-delayed-start",firstSeat:"A",ruleSetId:start.RULE_SET_IDS.STANDARD,loadouts:{A:loadout,B:loadout}};
 const quoted=session.quoteStart(args);assert.equal(quoted.code,"READY");
 assert.equal(session.startMatch({...args,quoteIds:quoted.quoteIds}).code,"STARTED");
 const saved=save.decodeStandardSave(payload),state=saved.activeMatch.state;
 // Explicit midgame fixture only. Inventory reservations and start receipts are
 // created by the real local session; every action after loading uses native UI.
 Object.assign(state,{phase:"WORK",requiredSize:1,rolledSize:1,baseRequiredSize:1,regions:{R1:{id:"R1",micro:micro(13),sourceMacros:[13],controllers:["B"],color:"red",isPending:false}}});
 state.basicPalettes.A=["blue","yellow"];state.basicPalettes.B=["blue","yellow"];
 return {key:match.SAVE_KEY,payload:save.encodeStandardSave(saved)};
}
module.exports={installDelayedUi,localDelayedFixture};
