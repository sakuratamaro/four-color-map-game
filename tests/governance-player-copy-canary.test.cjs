"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const file=path.join(__dirname,"../scripts/live-standard-player-copy-canary.cjs");
const {parseOptions,readOnlyRequest,profileReadbackComparison,recordFinalChecks,collectFinalChecks}=require(file);

test("copy canary refuses without complete opt-in before browser/network",()=>{
  for(const args of [[],["--confirm-live"],["--confirm-live","--candidate=short","--report=x"]])assert.throws(()=>parseOptions(args),/Refusing production test/);
  const r=spawnSync(process.execPath,[file],{encoding:"utf8",windowsHide:true,timeout:10000,env:{...process.env,NODE_PATH:""}});
  assert.equal(r.status,2);assert.match(r.stderr,/Refusing production test/);
});
test("copy canary browser allowlist rejects game, economy, profile and destructive writes",()=>{
  for(const op of ["cosmetic-catalog","cosmetic-quote","cpu-roster"])
    assert.equal(readOnlyRequest("POST","/functions/v1/standard-game-action",op),true);
  for(const op of ["profile","action","setup","gacha","quiz-start","cosmetic-action","card-sale","cpu-start"])
    assert.equal(readOnlyRequest("POST","/functions/v1/standard-game-action",op),false);
  for(const rpc of ["fcg_standard_active_room","fcg_standard_matchmaking_availability"])
    assert.equal(readOnlyRequest("POST","/rest/v1/rpc/"+rpc),true);
  for(const rpc of ["fcg_standard_create_room","fcg_standard_matchmaking_find","fcg_standard_abandon_room"])
    assert.equal(readOnlyRequest("POST","/rest/v1/rpc/"+rpc),false);
  assert.equal(readOnlyRequest("DELETE","/rest/v1/fcg_standard_profiles"),false);
  assert.equal(readOnlyRequest("GET","/rest/v1/fcg_standard_profiles"),true);
});
test("copy canary preserves evidence and credentials while binding real public bytes before signup",()=>{
  const src=fs.readFileSync(file,"utf8");
  assert.ok(src.indexOf('bytes.equals(git("show"')<src.indexOf('session=await request("/auth/v1/signup"'));
  assert.equal((src.match(/session=await request\("\/auth\/v1\/signup"/g)||[]).length,1);
  assert.match(src,/fs\.existsSync\(reportPath\),false/);
  assert.match(src,/profileReadbackComparison\(final,baseline\)/);
  assert.ok(src.indexOf('await collectFinalChecks(report,{readProfile:profile,baseline,calls,errors,warnings})')<src.indexOf('assert.ok(finalPass'));
  assert.ok(src.indexOf('status:"FINAL_CHECKS_CAPTURED_NOT_YET_ACCEPTED"')<src.indexOf('assert.ok(finalPass'));
  assert.match(src,/180_000/);assert.match(src,/closeOwnedBrowserServer/);
  assert.match(src,/NOT_RUN_NO_MATCH/);
  assert.doesNotMatch(src,/\.route\(|addInitScript|service_role|\/admin\/|JSON\.stringify\((?:session|calls)\)/);
});

test("profile readback ignores JSON object key order but no persisted value or array order",()=>{
  const initial={revision:1,profileState:{coins:0,inventory:{red:1,blue:2},history:["a","b"]},displayName:"Fixture"};
  const loaded={displayName:"Fixture",profileState:{history:["a","b"],inventory:{blue:2,red:1},coins:0},revision:1};
  assert.notEqual(JSON.stringify(initial),JSON.stringify(loaded),"old comparison falsely rejects key order alone");
  assert.equal(profileReadbackComparison(loaded,initial).equal,true);
  for(const changed of [{...loaded,revision:2},{...loaded,displayName:"Changed"},
    {...loaded,profileState:{...loaded.profileState,coins:1}},
    {...loaded,profileState:{...loaded.profileState,inventory:{blue:2,red:0}}},
    {...loaded,profileState:{...loaded.profileState,history:["b","a"]}}])
    assert.equal(profileReadbackComparison(changed,initial).equal,false);
  assert.equal(profileReadbackComparison(undefined,undefined).equal,false);
  assert.equal(profileReadbackComparison({},{}).equal,false);
});

test("all independent final outcomes are retained even when server equality fails",()=>{
  const report={},calls=[{method:"POST",pathname:"/rest/v1/rpc/fcg_standard_active_room"}];
  assert.equal(recordFinalChecks(report,{serverComparison:{equal:false,sameRevision:false,sameDisplayName:true,sameProfileState:false},calls,errors:0,warnings:0}),false);
  assert.deepEqual(report.finalChecks.map(r=>r.passed),[false,true,true]);
  assert.equal(report.requestCount,1);assert.deepEqual(report.consoleCounts,{errors:0,warnings:0});
  const allFailed={};
  assert.equal(recordFinalChecks(allFailed,{serverComparison:{equal:false},calls:[{method:"POST",pathname:"/functions/v1/standard-game-action",operation:"gacha"}],errors:1,warnings:1}),false);
  assert.deepEqual(allFailed.finalChecks.map(r=>r.passed),[false,false,false]);
  const passed={};assert.equal(recordFinalChecks(passed,{serverComparison:{equal:true},calls,errors:0,warnings:0}),true);
  assert.deepEqual(passed.finalChecks.map(r=>r.passed),[true,true,true]);
});

test("profile read failure still captures independent outcomes without leaking error details",async()=>{
  const report={},baseline={revision:1,displayName:"Fixture",profileState:{coins:0}};
  assert.equal(await collectFinalChecks(report,{readProfile:async()=>{throw new Error("private-auth-detail");},baseline,calls:[],errors:0,warnings:0}),false);
  assert.deepEqual(report.finalChecks.map(r=>r.passed),[false,true,true]);
  assert.deepEqual(report.finalProfileReadError,{kind:"Error"});
  assert.doesNotMatch(JSON.stringify(report),/private-auth-detail/);
});
