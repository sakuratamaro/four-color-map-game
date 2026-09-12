"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const script=path.join(root,"scripts/live-standard-result-continuation-canary.cjs");
test("UDL060 exact push permission resolves prior rejected attempts without erasing them",()=>{
  const log=JSON.parse(fs.readFileSync(path.join(root,"docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8"));
  const current=[log.coordination.active_slice,...log.coordination.completed_slices];
  const item=current.flatMap(s=>[s,...(s.superseded_candidates||[])]).find(s=>s.candidate_sha==="ccc9e91e0d1fecb74ce693b15d324c375671f8a1");
  assert.equal(item.transport_blocker.attempts,2);
  assert.equal(item.transport_blocker.resolution.status,"RESOLVED_BY_EXACT_USER_AUTHORIZATION");
  assert.match(item.transport_blocker.resolution.user_text,/16ファイル、画像なし/);
  assert.equal(item.transport_blocker.resolution.remote_sha,item.candidate_sha);
  assert.equal(item.branch,"codex/ui-result-20260912");
});
test("result public canary requires explicit opt-in before network or profile writes",()=>{
  const result=spawnSync(process.execPath,[script,"--candidate=ccc9e91e0d1fecb74ce693b15d324c375671f8a1"],{cwd:root,encoding:"utf8",windowsHide:true,timeout:10_000});
  assert.equal(result.status,2);assert.match(result.stderr,/Refusing production test/);
});
test("result public canary verifies exact assets before signup and stays within one owned match",()=>{
  const source=fs.readFileSync(script,"utf8");
  assert.ok(source.indexOf('bytes.equals(git("show"')<source.indexOf('request("/auth/v1/signup"'));
  assert.equal((source.match(/operation:"cpu-start"/g)||[]).length,1);
  assert.doesNotMatch(source,/operation:"(?:gacha|cpu-rematch)"|\.route\(|page\.addInitScript/);
  assert.match(source,/expectedVersion:room\.version,type:"SURRENDER"/);
  assert.match(source,/server room saved history tickets and revision unchanged/);
  assert.match(source,/240_000/);
  assert.match(source,/closeOwnedBrowserServer/);
});
test("result canary distinguishes stable availability reads from matchmaking writes",()=>{
  const source=fs.readFileSync(script,"utf8");
  const code=source.slice(source.indexOf("function isGameWrite("),source.indexOf("async function advanceCpu("));
  const classify=vm.runInNewContext(code+";isGameWrite");
  assert.equal(classify("/rest/v1/rpc/fcg_standard_matchmaking_availability",null),false);
  for(const name of ["find","recruit","cancel"])assert.equal(classify("/rest/v1/rpc/fcg_standard_matchmaking_"+name,null),true);
  assert.equal(classify("/functions/v1/standard-game-action","cpu-roster"),false);
  assert.equal(classify("/functions/v1/standard-game-action","gacha"),true);
});
test("result canary checks a terminal room through the snapshot before considering initialization",()=>{
  const source=fs.readFileSync(script,"utf8");
  const finish=source.slice(source.indexOf("async function finishOwnedMatch"),source.indexOf("async function snapshot"));
  assert.ok(finish.indexOf('observed.room?.status==="finished"')<finish.indexOf('operation:"initialize"'));
  assert.match(source,/room:after\.room,profile:after\.profile/);
});
