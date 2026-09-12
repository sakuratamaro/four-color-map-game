"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const {cosmeticItemLayoutPass}=require("./helpers/cosmetic-canary-layout.cjs");
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

test("cosmetic reload layout does not require an old transient ACK message",()=>{
  const geometry={viewport:390,overflow:false,cardWidth:320,buttonWidth:72,buttonHeight:45,feedbackInside:false};
  assert.equal(cosmeticItemLayoutPass(geometry),false);
  assert.equal(cosmeticItemLayoutPass({...geometry,feedbackInside:true}),true);
  assert.equal(cosmeticItemLayoutPass(geometry,{requireFeedback:false}),true);
  for(const patch of [{overflow:true},{cardWidth:0},{cardWidth:391},{buttonWidth:43},{buttonHeight:43}])
    assert.equal(cosmeticItemLayoutPass({...geometry,...patch},{requireFeedback:false}),false);
  const source=fs.readFileSync(file,"utf8");
  assert.match(source,/gold\.getByRole\("button",\{name:"装備中",exact:true\}\)\.waitFor\(\)/);
  assert.match(source,/inspect\("390-reloaded",\{requireFeedback:false\}\)/);
  assert.ok(source.indexOf('report.geometry.push')<source.indexOf('check(label+'));
});

test("cosmetic publication never converts the failed live attempt or offline diagnosis into full live proof",()=>{
  const read=file=>JSON.parse(fs.readFileSync(path.join(root,"docs",file),"utf8"));
  const live=read("UI_COSMETICS_LIVE_20260912.json"),local=read("UI_COSMETICS_RELOAD_DIAGNOSIS_20260912.json");
  const c=read("CHATGPT_REVIEW_DECISIONS.json").coordination;
  assert.equal(live.ok,false);assert.equal(live.profilesCreated,1);assert.equal(live.cosmeticActions,3);
  assert.equal(live.failedCheck,"390-reloaded: item feedback and44px controls fit");
  assert.equal(local.kind,"OFFLINE_FIXTURE_NOT_LIVE");assert.equal(local.productionRequests,0);assert.equal(local.ok,true);
  assert.equal(local.candidate,live.candidateSha);
  const slice=[c.active_slice,...c.completed_slices].find(s=>s.candidate_sha===live.candidateSha);
  assert.equal(slice.main_sha,live.candidateSha);assert.equal(slice.pages_run,"34671793635");
  assert.equal(slice.live_acceptance.additional_profiles,1);assert.equal(slice.live_acceptance.physical_devices,"NOT_RUN");
  assert.equal(slice.live_acceptance.initial_attempt.not_executed.length,4);
  assert.equal(slice.live_acceptance.not_executed.length,0);
  assert.equal(slice.state,"PUBLIC_VERIFIED");
  const retry=read("UI_COSMETICS_RETRY_LIVE_20260912.json");
  assert.equal(retry.ok,true);assert.equal(retry.checks.length,94);assert.equal(retry.candidateSha,live.candidateSha);
  assert.equal(retry.profilesCreated,1);assert.equal(slice.live_acceptance.cumulative_profiles,live.profilesCreated+retry.profilesCreated);
  for(const label of ["reload is a read-only exact profile restore","exactly three acknowledged cosmetic actions",
    "browser makes no match quiz draw or sale writes","console warning error and pageerror zero"]) assert.ok(retry.checks.includes(label));
  assert.equal(slice.live_acceptance_followup.source_response_message_id,"f2aebe0a-d1a8-4966-85d6-9a09625f453b");
  assert.equal(slice.live_acceptance_followup.attempts_started,1);
  assert.equal(c.normal_work_handoff.send_attempts,1,"no repeated self-send to pretend another worker exists");
});
