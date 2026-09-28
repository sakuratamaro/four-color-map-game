"use strict";
const assert=require("node:assert/strict");
const {loadEngine,plain}=require("./public-skill-fixture.cjs");
const match=require("../../standard/standard-match.js");
const micro=m=>Array.from({length:16},(_,i)=>(Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4);
// Actual generated engine and native controls; auth/transport are local fixtures.
async function installDestructionUi(page,roomId,skill,{reselect=false}={}) {
  const api=loadEngine(),loadout={color:["colorCancelRegion","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptDemolish","disruptChoiceOne"]};
  const sender=reselect?"A":"B";
  let current=plain(api.create({matchId:`${roomId}:0`,loadouts:{A:loadout,B:loadout},seed:923,firstSeat:skill==="colorCancelRegion"?sender:"A"}));
  Object.assign(current.state,{requiredSize:2,baseRequiredSize:2,rolledSize:2});
  current.state.basicPalettes.A=["red","blue"];
  function apply(actor,action) {
    const result=plain(api.apply({...current,actor,expectedVersion:current.state.version,action}));
    assert.equal(result.ok,true,JSON.stringify(result));current={state:result.state,rngSnapshot:result.rngSnapshot};
  }
  if(skill==="colorCancelRegion") {
    apply(sender,{type:"CREATE_REGION",payload:{sourceMacros:[13,14]}});
    if(reselect)apply("B",{type:"USE_SKILL",payload:{skill}});
  }
  else {
    current.state.phase="WORK";
    current.state.regions.R1={id:"R1",micro:micro(13),sourceMacros:[13],controllers:["B"],color:"green",isPending:false};
  }
  api.validateState(current.state);
  const projection=()=>({publicState:plain(match.projectStandardPublicState(current.state)),privateA:plain(match.projectStandardPrivateState(current.state,"A"))});
  const calls=[];
  await page.exposeFunction("__destructionSnapshot",()=>projection());
  await page.exposeFunction("__destructionApply",body=>{calls.push(plain(body));apply("A",body.action);return projection();});
  function install(data) {
    const base=globalThis.__standardOnlineMockSupabase,r=globalThis.__standardOnlineRuntime;
    const reflect=p=>{r.room={...r.room,id:data.roomId,status:"playing",version:p.publicState.version,opponent_kind:"human",public_state:p.publicState};r.view={seat:"A",version:r.room.version,private_state:p.privateA};};
    reflect(data.initial);
    const rpc=base.rpc;base.rpc=async(...args)=>{reflect(await globalThis.__destructionSnapshot());return rpc(...args);};
    const invoke=base.functions.invoke;base.functions.invoke=async(name,request)=>{
      if(request.body.operation!=="action")return invoke(name,request);
      r.calls.push({kind:"invoke",name,body:request.body});await globalThis.__standardOnlineRecordInvoke(request.body);
      reflect(await globalThis.__destructionApply(request.body));return {data:{room:{version:r.room.version},result:{code:"OK"}}};
    };return base;
  }
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",route=>route.fulfill({status:200,contentType:"text/javascript",body:`export function createClient(){return (${install.toString()})(${JSON.stringify({roomId,initial:projection()})})}`}));
  return {calls,state:()=>plain(current.state),rng:()=>plain(current.rngSnapshot),redesignate:()=>apply(sender,{type:"CREATE_REGION",payload:{sourceMacros:[25,26]}})};
}
module.exports={installDestructionUi};
