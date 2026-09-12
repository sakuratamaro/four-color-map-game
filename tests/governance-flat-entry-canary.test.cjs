"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const file=path.join(__dirname,"../scripts/live-standard-flat-entry-canary.cjs");
const {parseOptions,persistedComparison,finalResults}=require(file);
const {readOnlyRequest}=require("../scripts/live-standard-player-copy-canary.cjs");
const sha="9515f9bed9536dc2c44b71817129abb9c86ef24f";
const report=path.join(__dirname,"../docs/FLAT_ENTRY_NOT_EXECUTED_UNIT_TEST.json");
test("flat UI canary requires exact opt-in, a new scoped report, and rejects duplicates/extra authority",()=>{
  for(const args of [[],["--confirm-live"],["--confirm-live","--candidate=bad","--report="+report],
    ["--confirm-live","--candidate="+sha,"--report="+path.join(__dirname,"../outside.json")],
    ["--confirm-live","--candidate="+sha,"--report="+path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json")],
    ["--confirm-live","--candidate="+sha,"--report="+report,"--extra-profile"]])assert.throws(()=>parseOptions(args));
  assert.deepEqual(parseOptions(["--confirm-live","--candidate="+sha,"--report="+report]),{candidate:sha,report:path.resolve(report)});
  const p=spawnSync(process.execPath,[file],{encoding:"utf8",windowsHide:true,timeout:10000,env:{...process.env,NODE_PATH:""}});
  assert.equal(p.status,2);assert.match(p.stderr,/Refusing production test/);
});
test("flat UI persisted comparison rejects any stored change or missing snapshot, not response envelope-only differences",()=>{
  const baseline={revision:1,displayName:"Fixture",profileState:{name:"Fixture",coins:0,inventory:{a:1,b:2},history:["x","y"]}};
  const existing={revision:1,profileState:{history:["x","y"],inventory:{b:2,a:1},coins:0,name:"Fixture"}};
  const equal=persistedComparison(existing,baseline);
  assert.equal(equal.validSnapshots,true);assert.equal(equal.sameRevision,true);assert.equal(equal.sameProfileState,true);
  assert.deepEqual(equal.responseName,{beforePresent:true,afterPresent:false,same:false});
  assert.match(equal.responseNameDisposition,/UNRESOLVED_REG-/);
  for(const value of [null,{}, {...existing,revision:2},{...existing,profileState:{...existing.profileState,name:"Changed"}},
    {...existing,profileState:{...existing.profileState,coins:1}},{...existing,profileState:{...existing.profileState,inventory:{a:0,b:2}}},
    {...existing,profileState:{...existing.profileState,history:["y","x"]}}]) {
    const result=persistedComparison(value,baseline);assert.equal(result.validSnapshots&&result.sameRevision&&result.sameProfileState,false);
  }
});
test("flat UI final results retain every independent failure without relabelling old062 results",()=>{
  const profile={revision:1,profileState:{coins:0}};
  const result=finalResults({actual:{...profile,revision:2},expected:profile,
    calls:[{method:"POST",pathname:"/functions/v1/standard-game-action",operation:"cpu-start"}],errors:1,warnings:0});
  assert.equal(result.checks.length,3);assert.deepEqual(result.checks.map(c=>c.passed),[false,false,false]);
  assert.deepEqual(finalResults({actual:profile,expected:profile,calls:[],errors:0,warnings:0}).checks.map(c=>c.passed),[true,true,true]);
});
test("flat UI reuses deny-by-default browser writes policy without banning actual read-only CPU roster",()=>{
  assert.equal(readOnlyRequest("POST","/functions/v1/standard-game-action","cpu-roster"),true);
  for(const op of ["profile","cpu-start","setup","action","quiz-start","gacha","cosmetic-action"])
    assert.equal(readOnlyRequest("POST","/functions/v1/standard-game-action",op),false);
  assert.equal(readOnlyRequest("POST","/rest/v1/rpc/fcg_standard_matchmaking_find"),false);
  assert.equal(readOnlyRequest("DELETE","/rest/v1/fcg_standard_profiles"),false);
});
test("flat UI driver binds bytes before one profile, blocks unexpected writes, and saves final checks before aggregate",()=>{
  const s=fs.readFileSync(file,"utf8");
  assert.ok(s.indexOf('bytes.equals(git("show"')<s.indexOf('request("/auth/v1/signup"'));
  assert.equal((s.match(/request\("\/auth\/v1\/signup"/g)||[]).length,1);
  assert.match(s,/report\.profileAttempts=1/);assert.match(s,/baseline=await profile\(\)/);assert.match(s,/actual=await profile\(true\)/);
  assert.match(s,/route\.abort\("blockedbyclient"\)/);assert.doesNotMatch(s,/route\.fulfill|addInitScript|service_role|\/admin\//);
  assert.match(s,/180_000/);assert.match(s,/finalRead\?AbortSignal\.timeout\(15_000\)/);
  assert.ok(s.indexOf('context.close()')<s.indexOf('actual=await profile(true)'));
  assert.ok(s.indexOf('status:"FINAL_CHECKS_CAPTURED_NOT_YET_ACCEPTED"')<s.indexOf('failed=failed||!result.checks.every'));
  assert.doesNotMatch(s,/JSON\.stringify\((?:session|calls|baseline|actual|token)\)/);
  assert.match(s,/initialAcceptance062:"CLOSED_NO_ADDITIONAL062_PROFILE"/);
  assert.ok(s.indexOf('await page.waitForFunction(()=>document.querySelectorAll("#cpuRosterGrid .cpu-character-card").length===10')
    <s.indexOf('check(width+": ten CPU choices"'));
});
