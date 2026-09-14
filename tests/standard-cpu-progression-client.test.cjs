"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createStandardOnlineClient, STORAGE_KEY } = require("../standard-online-v5/standard-online-client.js");
const ROOM = randomUUID(), USER = randomUUID();
const trialInput = () => ({ actionId: randomUUID(), confirmed: true, trialId: "ren-unseal", trialVersion: 1 });
const equipInput = () => ({ actionId: randomUUID(), expectedRevision: 3, techniqueId: "techUnsealOne" });
const trialResult = { roomId: ROOM, seat: "A", opponentKind: "cpu", characterId: "ren", trialId: "ren-unseal", trialVersion: 1 };
function fixture(initial = {}) {
  const saved = new Map([[STORAGE_KEY, JSON.stringify(initial)]]), calls = [];
  const storage = { getItem: k => saved.get(k) || null, setItem: (k,v) => saved.set(k,v), removeItem: k => saved.delete(k) };
  const auth = { getSession: async () => ({ data: { session: { user: { id: USER } } } }) };
  let respond = body => body.operation === "cpu-trial-start" ? trialResult : body.operation === "technique-equip"
    ? { revision: 4, profileState: { learnedTechniques: ["techUnsealOne"], equippedTechniqueId: body.techniqueId }, receipt: { actionId: body.actionId, techniqueId: body.techniqueId } }
    : { characters: [], cpuProgressionVersion: "ren-unseal-v1" };
  const supabase = { auth, rpc: async(name,args) => { calls.push({name,args}); return {data:[{room_id:ROOM}]}; },
    functions: { invoke: async(name,{body}) => { calls.push(body); return respond(body); } } };
  const normalResponse = respond; respond = body => ({data:normalResponse(body)});
  const fresh = () => createStandardOnlineClient({supabase,storage,idFactory:randomUUID});
  return { fresh, client:fresh(), storage, auth, calls, setResponse:fn=>{respond=fn;} };
}
test("AC064 trial start preserves exact confirmed version and clears only after a validated room ACK", async()=>{
  const f=fixture(),input=trialInput(); const result=await f.client.startCpuTrial(input);
  assert.equal(result.roomId,ROOM); assert.deepEqual(f.calls,[{operation:"cpu-trial-start",...input}]);
  assert.equal(f.client.snapshot().roomId,ROOM); assert.equal(f.client.snapshot().pendingCpuTrial,null);
  assert.equal(f.client.snapshot().setupRevision,0); // Already playing; no owned-card setup submission.
});
test("lost trial ACK survives reload and explicit retry sends the same operation ID only", async()=>{
  const f=fixture(),input=trialInput(); f.setResponse(()=>({error:new Error("offline")}));
  await assert.rejects(f.client.startCpuTrial(input));
  const restored=f.fresh(); assert.equal(restored.snapshot().pendingCpuTrial.actionId,input.actionId); assert.equal(f.calls.length,1);
  f.setResponse(()=>({data:{...trialResult,duplicate:true}}));
  assert.equal((await restored.startCpuTrial()).duplicate,true);
  assert.deepEqual(f.calls[0],f.calls[1]); assert.equal(restored.snapshot().pendingCpuTrial,null);
});
test("changed pending trial/extra trusted fields cannot replace an uncertain request", async()=>{
  const input=trialInput(),f=fixture({pendingCpuTrial:input});
  for(const candidate of [{...input,actionId:randomUUID()},{...input,trialVersion:2},{...input,confirmed:false},{...input,source:"LEARNED"}])
    await assert.rejects(f.client.startCpuTrial(candidate));
  assert.equal(f.calls.length,0); assert.equal(f.client.snapshot().pendingCpuTrial.actionId,input.actionId);
});
test("equipment lost ACK retains original profile revision and nullable target across reload", async()=>{
  const input={...equipInput(),techniqueId:null},f=fixture(); f.setResponse(()=>({error:new Error("lost response")}));
  await assert.rejects(f.client.equipTechnique(input)); const restored=f.fresh();
  await assert.rejects(restored.equipTechnique({...input,techniqueId:"techUnsealOne"}));
  f.setResponse(body=>({data:{revision:12,profileState:{learnedTechniques:["techUnsealOne"],equippedTechniqueId:null},receipt:{actionId:body.actionId,techniqueId:null}}}));
  await restored.equipTechnique(); assert.deepEqual(f.calls[0],f.calls[1]);
  assert.equal(restored.snapshot().profileRevision,12); assert.equal(restored.snapshot().pendingTechniqueEquip,null);
});
test("a malformed or unrelated ACK retains the persisted identity", async()=>{
  for(const kind of ["trial","equip"]) {
    const f=fixture(), input=kind==="trial"?trialInput():equipInput();
    f.setResponse(()=>({data:kind==="trial"?{...trialResult,trialVersion:2}:{revision:4,profileState:{},receipt:{actionId:randomUUID(),techniqueId:input.techniqueId}}}));
    await assert.rejects(kind==="trial"?f.client.startCpuTrial(input):f.client.equipTechnique(input));
    assert.equal(f.client.snapshot()[kind==="trial"?"pendingCpuTrial":"pendingTechniqueEquip"].actionId,input.actionId);
  }
});
test("terminal rejection clears new intent but transport/5xx ambiguity retains it", async()=>{
  for(const status of [403,409,500]) {
    const f=fixture(); f.setResponse(()=>({error:{context:new Response(JSON.stringify({error:{code:status===403?"CPU_TRIAL_LOCKED":status===409?"CPU_TRIAL_MATCH_LOCKED":"SERVER_ERROR",message:"private SQL detail"}}),{status})}}));
    await assert.rejects(f.client.startCpuTrial(trialInput()),e=>!e.message.includes("private SQL detail"));
    assert.equal(Boolean(f.client.snapshot().pendingCpuTrial),status===500);
  }
});
test("active, starting, searching and rematch identities all block new equip/trial mutations", async()=>{
  for(const lock of [{roomId:ROOM},{cpuStartActionId:randomUUID()},{rematchActionId:randomUUID()},
    {matchmakingTicketId:randomUUID()},{matchmakingFindActionId:randomUUID()},{abandonActionId:randomUUID()}]) {
    const f=fixture(lock);
    await assert.rejects(f.client.equipTechnique(equipInput())); await assert.rejects(f.client.startCpuTrial(trialInput()));
    assert.equal(f.calls.length,0);
  }
});
test("pending progression blocks every normal match-entry route without issuing requests", async()=>{
  for(const field of ["pendingCpuTrial","pendingTechniqueEquip"]) {
    const f=fixture({[field]:field==="pendingCpuTrial"?trialInput():equipInput()});
    for(const name of ["createRoom","joinRoom","startCpuOpponent","acceptCpuOpponent","recruitOpponent","findOpponent","requestRematch","requestCpuRematch"])
      await assert.rejects(f.client[name]({}),{code:"PROGRESSION_ALREADY_PENDING"});
    assert.equal(f.calls.length,0); assert.throws(()=>f.client.resetConnection(),{code:"PROGRESSION_ALREADY_PENDING"});
    f.client.clearRoom(); assert.ok(f.client.snapshot()[field]);
  }
});
test("a synchronous start reservation prevents equip from overtaking the first auth await", async()=>{
  const f=fixture(); let release;
  f.auth.getSession=()=>new Promise(resolve=>{release=()=>resolve({data:{session:{user:{id:USER}}}});});
  f.setResponse(()=>({data:{matchmakingStatus:"matched",roomId:ROOM}}));
  const pending=f.client.startCpuOpponent({characterId:"ren"});
  await assert.rejects(f.client.equipTechnique(equipInput()),{code:"PROGRESSION_ALREADY_PENDING"});
  release(); await pending; assert.equal(f.calls.length,1);
});
test("equip reserves before auth await and blocks a competing trial/start and double click", async()=>{
  const f=fixture(); let release;
  f.auth.getSession=()=>new Promise(resolve=>{release=()=>resolve({data:{session:{user:{id:USER}}}});});
  const input=equipInput(),pending=f.client.equipTechnique(input);
  await assert.rejects(f.client.startCpuTrial(trialInput())); await assert.rejects(f.client.startCpuOpponent({characterId:"ren"}));
  await assert.rejects(f.client.equipTechnique(input)); release(); await pending; assert.equal(f.calls.length,1);
});
test("storage failure cannot send an unrecorded trial/equip mutation", async()=>{
  for(const kind of ["trial","equip"]) {
    const f=fixture(); f.storage.setItem=()=>{throw new Error("quota");};
    await assert.rejects(kind==="trial"?f.client.startCpuTrial(trialInput()):f.client.equipTechnique(equipInput()),/quota/);
    assert.equal(f.calls.length,0);
  }
});
test("restoring malformed inputs does not create requests or trust local ownership",()=>{
  const f=fixture({pendingCpuTrial:{...trialInput(),confirmed:false},pendingTechniqueEquip:{...equipInput(),source:"LEARNED"}});
  assert.equal(f.client.snapshot().pendingCpuTrial,null); assert.equal(f.client.snapshot().pendingTechniqueEquip,null);
  assert.equal(f.calls.length,0);
});
test("trial info does not send a local profile, and roster capability alone grants no ownership",async()=>{
  const f=fixture(); f.setResponse(()=>({data:{progression:{stage:"first_meeting",trialUnlocked:false}}}));
  const info=await f.client.readRenTrial(); assert.equal(info.progression.trialUnlocked,false);
  assert.deepEqual(f.calls,[{operation:"cpu-trial-info"}]); assert.equal(f.client.snapshot().profileRevision,0);
});
