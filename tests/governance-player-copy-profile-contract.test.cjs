"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {profileReadbackComparison}=require("../scripts/live-standard-player-copy-canary.cjs");
const root=path.resolve(__dirname,"..");
const subject="a1a9b1c830eceb98464b107f2442deacaf765505";
const gitFile=file=>execFileSync("git",["-c","safe.directory="+root.replaceAll("\\","/"),"show",subject+":"+file],{cwd:root,windowsHide:true,encoding:"utf8"});
const handler=gitFile("supabase/functions/standard-game-action/index.ts");
const sql=gitFile("supabase/migrations/202609020006_standard_profile_load.sql");
const branch=handler.slice(handler.indexOf('if (operation === "profile") {'),handler.indexOf('if (operation === "gacha") {'));
const expression=branch.match(/if \(existing\) \{\s*return json\(200, (\{[\s\S]*?\})\);/)?.[1];
assert.ok(expression,"exact existing-profile response expression must be found");
const existingResponse=new Function("existing","return ("+expression+");");
test("fixed product RPC deliberately returns revision and profile_state without display_name",()=>{
  assert.match(sql,/returns table\s*\(\s*revision bigint,\s*profile_state jsonb\s*\)/);
  assert.match(sql,/select profile\.revision, profile\.profile_state/);
  assert.doesNotMatch(sql,/display_name/);
  assert.match(expression,/displayName: existing\.display_name/);
});
test("real handler expression omits top-level name for the actual SQL return contract",()=>{
  const baseline={revision:1,displayName:"CopyCanary",profileState:{displayName:"CopyCanary",gold:0,inventory:{}}};
  const loaded=JSON.parse(JSON.stringify(existingResponse({revision:1,profile_state:baseline.profileState})));
  assert.equal(Object.hasOwn(loaded,"displayName"),false);
  assert.equal(loaded.profileState.displayName,"CopyCanary");
  assert.deepEqual(profileReadbackComparison(loaded,baseline),{
    equal:false,sameRevision:true,sameDisplayName:false,sameProfileState:true
  });
});
test("contract diagnosis must not ignore an actual stored name or state change",()=>{
  const baseline={revision:1,displayName:"CopyCanary",profileState:{displayName:"CopyCanary",gold:0,inventory:{}}};
  const loaded=JSON.parse(JSON.stringify(existingResponse({revision:1,profile_state:{...baseline.profileState,displayName:"Changed"}})));
  assert.equal(profileReadbackComparison(loaded,baseline).sameProfileState,false);
  assert.equal(profileReadbackComparison({...baseline,revision:2},baseline).sameRevision,false);
});
// This executes the fixed source response expression against the fixed SQL shape.
// It is an offline reproduction, not retrieval of the discarded live envelope.
