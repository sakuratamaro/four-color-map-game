"use strict";
const assert = require("node:assert/strict");
const {loadEngine, plain} = require("./public-skill-fixture.cjs");

// Native UI + actual generated engine. Auth, transport and persistence are fixtures,
// not a claim of production SQL/live inventory coverage.
async function installRescueUi(page, roomId) {
  const api=loadEngine(), loadout={color:["colorUnsealOne","colorBonusRefillUnseal"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};
  let current=plain(api.create({matchId:`${roomId}:0`,loadouts:{A:loadout,B:loadout},seed:711,firstSeat:"A"}));
  const state=current.state;
  Object.assign(state,{phase:"COLOR",pending:"R1",requiredSize:1,baseRequiredSize:1,rolledSize:1,
    regions:{R1:{id:"R1",micro:Array.from({length:16},(_,i)=>(4+Math.floor(i/4))*48+4+i%4),sourceMacros:[13],controllers:["B"],color:null,isPending:true}}});
  state.basicPalettes.A=["red","blue"];state.bonusColors.A="green";state.bonusUsesRemaining.A=0;
  state.publicEffects.A.seals={red:2,green:2,yellow:1};api.validateState(state);
  const match=require("../../standard/standard-match.js");
  const projection=()=>({publicState:plain(match.projectStandardPublicState(current.state)),privateA:plain(match.projectStandardPrivateState(current.state,"A"))});
  const calls=[];
  await page.exposeFunction("__rescueSnapshot",()=>projection());
  await page.exposeFunction("__rescueApply",body=>{
    calls.push(plain(body));
    const result=plain(api.apply({state:current.state,rngSnapshot:current.rngSnapshot,actor:"A",expectedVersion:body.action.expectedVersion,action:body.action}));
    assert.equal(result.ok,true,JSON.stringify(result));current=result;
    return projection();
  });
  function install(data) {
    const base=globalThis.__standardOnlineMockSupabase,r=globalThis.__standardOnlineRuntime;
    const reflect=p=>{
      r.room={...r.room,id:data.roomId,status:"playing",version:p.publicState.version,opponent_kind:"human",public_state:p.publicState};
      r.view={seat:"A",version:r.room.version,private_state:p.privateA};
    };
    reflect(data.initial);
    const rpc=base.rpc; base.rpc=async(...args)=>{reflect(await globalThis.__rescueSnapshot());return rpc(...args);};
    const invoke=base.functions.invoke;
    base.functions.invoke=async(name,request)=>{
      if(request.body.operation!=="action")return invoke(name,request);
      r.calls.push({kind:"invoke",name,body:request.body});
      await globalThis.__standardOnlineRecordInvoke(request.body);
      reflect(await globalThis.__rescueApply(request.body));
      return {data:{room:{version:r.room.version},result:{code:"OK"}}};
    };
    return base;
  }
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",route=>route.fulfill({status:200,contentType:"text/javascript",body:`export function createClient(){return (${install.toString()})(${JSON.stringify({roomId,initial:projection()})})}`}));
  return {calls,state:()=>plain(current.state)};
}
module.exports={installRescueUi};
