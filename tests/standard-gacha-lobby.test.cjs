"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const app=fs.readFileSync(path.join(__dirname,"../standard-online-v5/app.js"),"utf8");
const html=fs.readFileSync(path.join(__dirname,"../standard-online-v5/index.html"),"utf8");
function source(name,next){const start=app.indexOf("function "+name+"("),end=app.indexOf("function "+next+"(",start);assert.ok(start>=0&&end>start,name+" implementation is required");return app.slice(start,end);}
function run(edit=()=>{}){
  const calls=[],data={lastGachaDraws:[{skillId:"colorPrism"}],gachaBusy:false,pendingGacha:null,rematchBusy:false,synced:true,profileSyncBusy:false,
    lastGachaContinuation:{source:"cpu-completion-reward",ticketLevel:3,roomId:"own",roomVersion:9,matchId:"own-match"},
    roomModel:{room:{id:"own",version:9,status:"finished",opponent_kind:"cpu",public_state:{status:"FINISHED",matchId:"own-match"}}},
    hasMatchedRoomHandoff:()=>false,resultContinuationPending:()=>false,leaveFinishedResult:()=>calls.push("close-result"),
    activateAppTab:tab=>calls.push("tab:"+tab),render:()=>calls.push("render"),$:id=>({focus:()=>calls.push("focus:"+id)})};
  edit(data);const before=JSON.stringify(data);vm.runInNewContext(source("isCurrentCpuRewardGachaContinuation","catalogDefinitions")+source("leaveRewardGachaResult","dismissTerminalResult")+"\nleaveRewardGachaResult();",data);
  assert.equal(JSON.stringify(data),before,"navigation must not rewrite pending/source inputs");return calls;
}
test("UDL060 gacha lobby continuation closes only the valid finished result",()=>{assert.deepEqual(run(),["tab:battle","close-result"]);});
test("UDL060 pending rematch navigation focuses existing recovery without submitting or clearing it",()=>{
  assert.deepEqual(run(s=>s.resultContinuationPending=()=>true),["tab:battle","render","focus:requestRematch"]);
});
test("UDL060 gacha lobby handler rejects busy pending unsynced and handoff actions",()=>{
  for(const change of [s=>s.lastGachaDraws=[],s=>s.gachaBusy=true,s=>s.pendingGacha={actionId:"original",ticketLevel:5,count:2},
    s=>s.rematchBusy=true,s=>s.synced=false,s=>s.profileSyncBusy=true,s=>s.hasMatchedRoomHandoff=()=>true])assert.deepEqual(run(change),[]);
});
test("UDL060 stale unrelated active and laboratory reward results cannot clear a room",()=>{
  for(const change of [s=>s.lastGachaContinuation=null,s=>s.lastGachaContinuation.source="quiz",s=>s.lastGachaContinuation.ticketLevel=6,
    s=>s.lastGachaContinuation.roomId="other",s=>s.lastGachaContinuation.roomVersion=8,s=>s.lastGachaContinuation.matchId="other",
    s=>s.roomModel.room.status="playing",s=>s.roomModel.room.opponent_kind="human",s=>s.roomModel.room.public_state.status="PLAYING",
    s=>s.roomModel.room.public_state.debugUnlimitedSkills=true,s=>s.roomModel=null])assert.deepEqual(run(change),[]);
});
test("UDL060 gacha UI exposes lobby or saved-request recovery and no new-rematch shortcut",()=>{
  assert.match(html,/id="gachaGoLobby"[^>]*type="button"[^>]*>結果を閉じてロビーへ<\/button>/);
  assert.match(app,/前回の申請を確認する画面へ/);
  assert.doesNotMatch(app+html,/gachaCpuRematch|continueCpuRewardRematch/);
  const nav=source("leaveRewardGachaResult","dismissTerminalResult");
  assert.doesNotMatch(nav,/requestRematch\(|requestCpuRematch\(|runGacha\(|drawGacha\(|clearRoom\(|submitSetup\(|cpu-start/);
});
