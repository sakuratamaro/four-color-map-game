"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const modulePromise = import(pathToFileURL(path.join(__dirname,"../standard-online-v5/result-continuation.js")).href);
const room = {id:"own-room",version:20,status:"finished",opponent_kind:"cpu",public_state:{status:"FINISHED",matchId:"own-match",winner:"A"}};
const profile = {matchHistory:[{matchId:"own-match",result:"WIN",onlineOpponentKind:"cpu",matchReward:{awarded:true,ticketLevel:3,ticketCount:2}}],gachaTickets:{3:0}};

test("UDL060 saved rewards remain local-seat correct for human and CPU wins and losses",async()=>{
  const {savedResultReward}=await modulePromise;
  for(const kind of ["cpu","human"]) for(const seat of ["A","B"]) for(const winner of ["A","B"]) {
    const r={...room,opponent_kind:kind,public_state:{...room.public_state,winner}};
    const p=structuredClone(profile);p.matchHistory[0].onlineOpponentKind=kind;
    p.matchHistory[0].result=seat===winner?"WIN":"LOSS";
    assert.equal(savedResultReward(r,seat,p)?.ticketLevel,3);
    p.matchHistory[0].result=seat===winner?"LOSS":"WIN";
    assert.equal(savedResultReward(r,seat,p),null);
  }
});
test("UDL060 saved finished reward drives navigation even after its ticket balance reaches zero",async()=>{
  const {savedResultReward}=await modulePromise;
  const before=JSON.stringify({room,profile});
  assert.deepEqual(savedResultReward(room,"A",profile),{roomId:"own-room",roomVersion:20,matchId:"own-match",opponentKind:"cpu",ticketLevel:3,ticketCount:2,ticketTotal:0});
  assert.equal(JSON.stringify({room,profile}),before);
});
test("UDL060 no reward level is inferred from a stale, unsettled or unrelated result",async()=>{
  const {savedResultReward}=await modulePromise;
  for(const candidate of [null,{...room,status:"playing"},{...room,public_state:{...room.public_state,matchId:"other"}},{...room,public_state:{...room.public_state,winner:"B"}}]) assert.equal(savedResultReward(candidate,"A",profile),null);
  assert.equal(savedResultReward(room,"A",{}),null);
  assert.equal(savedResultReward(room,"spectator",profile),null);
});
test("UDL060 invalid levels, missing receipt and limited or experimental rewards have no destination",async()=>{
  const {savedResultReward}=await modulePromise;
  for(const ticketLevel of [0,6,1.5,"3",null,NaN]) {
    const p=structuredClone(profile);p.matchHistory[0].matchReward.ticketLevel=ticketLevel;
    assert.equal(savedResultReward(room,"A",p),null);
  }
  const limited=structuredClone(profile);limited.matchHistory[0].matchReward={awarded:false,reason:"PVP_REWARD_LIMIT"};
  assert.equal(savedResultReward(room,"A",limited),null);
  assert.equal(savedResultReward({...room,public_state:{...room.public_state,debugUnlimitedSkills:true}},"A",profile),null);
  assert.equal(savedResultReward({...room,public_state:{...room.public_state,labRuleSetId:"STANDARD_V5_LEGAL_RECOLOR_LAB_V1"}},"A",profile),null);
});

test("UDL060 v2 reward copy uses all five saved levels and counts even when tickets have been spent",async()=>{
  const {terminalRewardPresentation}=await modulePromise;
  for(const kind of ["cpu","human"])for(const seat of ["A","B"])for(const winner of ["A","B"])
    for(const level of [1,2,3,4,5])for(const count of [1,2,4]){
      const r={...room,opponent_kind:kind,public_state:{...room.public_state,winner}};
      const p=structuredClone(profile);p.matchHistory[0]={matchId:room.public_state.matchId,result:seat===winner?"WIN":"LOSS",onlineOpponentKind:kind,matchReward:{awarded:true,ticketLevel:level,ticketCount:count}};
      p.gachaTickets={};const before=JSON.stringify({r,p});
      assert.deepEqual(terminalRewardPresentation(r,seat,p),{kind:"reward",text:`完了報酬\nLv.${level}ガチャ券 ×${count}`});
      assert.equal(JSON.stringify({r,p}),before);
    }
});
test("UDL060 v2 missing, mismatched or malformed rewards cannot be inferred from stats or ticket balances",async()=>{
  const {terminalRewardPresentation}=await modulePromise;
  for(const edit of [p=>p.matchHistory=[],p=>p.matchHistory[0].matchId="other",p=>p.matchHistory[0].result="LOSS",
    p=>p.matchHistory[0].onlineOpponentKind="human",p=>delete p.matchHistory[0].matchReward,
    p=>p.matchHistory[0].matchReward.ticketLevel="3",p=>p.matchHistory[0].matchReward.ticketCount=0]){
    const p=structuredClone(profile);p.cpuStats={wins:99};p.gachaTickets={1:99,2:99,3:99};edit(p);
    assert.deepEqual(terminalRewardPresentation(room,"A",p),{kind:"pending",text:"報酬を確認中です。"});
  }
  for(const r of [null,{...room,status:"playing"}])assert.equal(terminalRewardPresentation(r,"A",profile).kind,"pending");
  assert.equal(terminalRewardPresentation(room,"spectator",profile).kind,"pending");
});
test("UDL060 v2 explicit no-reward and lab states stay truthful without routine save or balance copy",async()=>{
  const {terminalRewardPresentation}=await modulePromise;
  const p=structuredClone(profile);p.matchHistory[0].matchReward={awarded:false,reason:"PVP_REWARD_LIMIT"};
  assert.equal(terminalRewardPresentation({...room,opponent_kind:"human"},"A",p).text,"今回は報酬なし（受取上限）。");
  assert.equal(terminalRewardPresentation(room,"A",p).text,"この対戦の報酬はありません。");
  for(const flag of [{debugUnlimitedSkills:true},{labRuleSetId:"STANDARD_V5_LEGAL_RECOLOR_LAB_V1"}]){
    const r={...room,public_state:{...room.public_state,...flag}};
    assert.equal(terminalRewardPresentation(r,"A",profile).kind,"lab");
    assert.doesNotMatch(terminalRewardPresentation(r,"A",profile).text,/完了報酬|×|→|保存しました/);
  }
});
