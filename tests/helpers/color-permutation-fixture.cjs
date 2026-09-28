"use strict";
const assert=require("node:assert/strict");
const {loadEngine,plain}=require("./public-skill-fixture.cjs");
const match=require("../../standard/standard-match.js");
const micro=m=>Array.from({length:16},(_,i)=>(Math.floor(m/12)*4+Math.floor(i/4))*48+m%12*4+i%4);
const loadout={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptColorSwap","disruptColorRotate"]};
function prepare(state,skill,actor="A") {
  Object.assign(state,{active:actor,phase:"WORK",pending:null,reserved:null,preparedOutgoing:null,requiredSize:1,baseRequiredSize:1,rolledSize:1,skillCategoryWindow:{actor,categories:[]},lastPublicTrace:null});
  state.regions={};
  const macros=skill==="disruptColorSwap"?[13,15,17]:[13,14,15];
  for(const [index,m] of macros.entries()) {
    const id="R"+(index+1);
    state.regions[id]={id,micro:micro(m),sourceMacros:[m],controllers:["B"],color:["red","blue","green"][index],isPending:false};
  }
  match.validateStandardState(state);return state;
}
async function installPermutationUi(page,roomId,skill) {
  const api=loadEngine();
  let current=plain(api.create({matchId:roomId+":0",loadouts:{A:loadout,B:loadout},seed:928,firstSeat:"A"}));
  prepare(current.state,skill);
  const project=()=>plain(api.project(current.state)),calls=[];
  await page.exposeFunction("__permutationSnapshot",()=>project());
  await page.exposeFunction("__permutationApply",body=>{
    calls.push(plain(body));
    const result=plain(api.apply({...current,actor:"A",expectedVersion:current.state.version,action:body.action}));
    assert.equal(result.ok,true,JSON.stringify(result));
    current={state:result.state,rngSnapshot:result.rngSnapshot};return project();
  });
  function install(data) {
    const base=globalThis.__standardOnlineMockSupabase,r=globalThis.__standardOnlineRuntime;
    const reflect=p=>{r.room={...r.room,id:data.roomId,status:"playing",version:p.publicState.version,opponent_kind:"human",public_state:p.publicState};r.view={seat:"A",version:r.room.version,private_state:p.privateA};};
    reflect(data.initial);
    const rpc=base.rpc;base.rpc=async(...args)=>{reflect(await globalThis.__permutationSnapshot());return rpc(...args);};
    const invoke=base.functions.invoke;base.functions.invoke=async(name,request)=>{
      if(request.body.operation!=="action")return invoke(name,request);
      r.calls.push({kind:"invoke",name,body:request.body});await globalThis.__standardOnlineRecordInvoke(request.body);
      reflect(await globalThis.__permutationApply(request.body));return {data:{room:{version:r.room.version},result:{code:"OK"}}};
    };return base;
  }
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",route=>route.fulfill({status:200,contentType:"text/javascript",body:`export function createClient(){return (${install.toString()})(${JSON.stringify({roomId,initial:project()})})}`}));
  return {calls,state:()=>plain(current.state),rng:()=>plain(current.rngSnapshot)};
}
module.exports={prepare,loadout,installPermutationUi};
