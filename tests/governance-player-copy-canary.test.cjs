"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const file=path.join(__dirname,"../scripts/live-standard-player-copy-canary.cjs");
const {parseOptions,readOnlyRequest}=require(file);

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
  assert.match(src,/JSON\.stringify\(await profile\(\)\)===JSON\.stringify\(baseline\)/);
  assert.match(src,/180_000/);assert.match(src,/closeOwnedBrowserServer/);
  assert.match(src,/NOT_RUN_NO_MATCH/);
  assert.doesNotMatch(src,/\.route\(|addInitScript|service_role|\/admin\/|JSON\.stringify\((?:session|calls)\)/);
});
