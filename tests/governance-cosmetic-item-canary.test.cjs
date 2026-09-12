"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),file=path.join(root,"scripts/live-standard-cosmetic-item-canary.cjs");
test("cosmetic public canary refuses before loading browser or touching network without explicit opt-in",()=>{
  const r=spawnSync(process.execPath,[file],{cwd:root,encoding:"utf8",windowsHide:true,timeout:10_000,env:{...process.env,NODE_PATH:""}});
  assert.equal(r.status,2);assert.match(r.stderr,/Refusing production test/);
});
test("cosmetic public canary verifies exact assets before one owned profile and finite funding",()=>{
  const source=fs.readFileSync(file,"utf8");
  assert.ok(source.indexOf('bytes.equals(git("show"')<source.indexOf('session=await request("/auth/v1/signup"'));
  assert.equal((source.match(/session=await request\("\/auth\/v1\/signup"/g)||[]).length,1);
  assert.match(source,/round<3&&current\.profileState\.coins<350/);
  assert.match(source,/30-report\.draws/);assert.match(source,/report\.saleActions<30/);
  assert.match(source,/count>1&&current\.profileState\.protectedSkills/);
  assert.match(source,/started\.timeoutAnswerId/);assert.match(source,/INSUFFICIENT_STOP_NO_EXTRA_PROFILE_OR_CREDIT/);
  assert.doesNotMatch(source,/operation:"(?:cpu-start|cpu-rematch|action|setup)"|\.route\(|addInitScript|service_role|\/admin\//);
});
test("cosmetic public canary verifies real item ACK, exact debit, reload and bounded cleanup",()=>{
  const source=fs.readFileSync(file,"utf8");
  assert.match(source,/getByRole\("button",\{name:"購入して装備"/);
  assert.match(source,/paid\.revision===baseline\.revision\+1&&paid\.profileState\.coins===coins-350/);
  assert.match(source,/report\.cosmeticActions===3&&acknowledged\.length===3/);
  assert.match(source,/JSON\.stringify\(final\)===JSON\.stringify\(after\)/);
  assert.match(source,/300_000/);assert.match(source,/closeOwnedBrowserServer/);
  assert.doesNotMatch(source,/console\.log\((?:session|token|current|actions)\)|JSON\.stringify\(session\)/);
});
