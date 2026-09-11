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
