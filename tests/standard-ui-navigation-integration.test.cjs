"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const html=read("standard-online-v5/index.html"),app=read("standard-online-v5/app.js"),spec=read("docs/UI_NAVIGATION_RELEASE_20260920.md");
const workflow=read(".github/workflows/standard-browser-gate.yml"),runbook=read("docs/STANDARD_PUBLIC_RELEASE_RUNBOOK.md");
const lane=runbook.slice(runbook.indexOf("## 2026-09-20 UI導線統合候補"),runbook.indexOf("## 2026-09-15 UI後続便"));
test("navigation parent markers stay frozen while both UI families survive in the pilot",()=>{
  const current=marker=>({"app.js?v=20260920-1":"app.js?v=20260923-1","style.css?v=20260920-1":"style.css?v=20260921-1",
    "standard-skill-registry.generated.js?v=20260914-1":"standard-skill-registry.generated.js?v=20260914-2",
    "result-continuation.js?v=20260914-1":"result-continuation.js?v=20260914-2"})[marker]||marker;
  for(const marker of ["app.js?v=20260920-1","style.css?v=20260920-1","play-surface.css?v=20260915-5",
    "ui-diet.css?v=20260914-2","progression.css?v=20260914-1","terminal-result.css?v=20260914-1",
    "surrender-confirmation.css?v=20260913-2","standard-skill-registry.generated.js?v=20260914-1"]){
    assert.ok(html.includes(current(marker)),current(marker));assert.ok(spec.includes(marker),marker);assert.ok(lane.includes(marker),marker);
  }
  for(const marker of ["play-surface-model.js?v=20260915-1","result-continuation.js?v=20260914-1","action-recovery.js?v=20260914-1"]){
    assert.ok(app.includes(current(marker)),current(marker));assert.ok(spec.includes(marker),marker);assert.ok(lane.includes(marker),marker);
  }
  assert.doesNotMatch(html,/app\.js\?v=202609(?:14-9|15-8)|style\.css\?v=202609(?:14-3|15-8)/);
});
test("navigation candidate binds scope without replacing a frozen approval or publishing itself",()=>{
  for(const value of ["UDL-023-060-062-067-068-navigation-v1","fc089450e3a4e41e6c287f5359fc076f085f2903",
    "codex/ui-navigation-release-20260920","NOT_RUN"])assert.ok(spec.includes(value)&&lane.includes(value),value);
  for(const value of ["172c35651b2e6c5afd44179733d34ed269e88daf","70e691b6f8f1d808476e80990d20df7862bfb782",
    "98d→fc","GACHA_ODDS","No old live/CI/review budget"])assert.ok(spec.includes(value),value);
  assert.equal(workflow.split("codex/ui-navigation-release-20260920").length-1,1);
  assert.match(workflow,/timeout-minutes: 45/);
  assert.match(workflow,/STANDARD_BROWSER: \[chrome, edge\]/);
  assert.match(workflow,/permissions:\r?\n  contents: read/);
});
test("existing gate retains the combined regression contracts exactly once",()=>{
  for(const name of ["standard-ui-navigation-integration","browser-startup-diagnostics","standard-home-rules","standard-profile-compact","standard-action-recovery",
    "standard-quiz-level-start","standard-gacha-entry","standard-quiz-reward-gacha","standard-surrender-confirmation",
    "standard-result-continuation","standard-palette-origin-rim","standard-gacha-lobby","standard-palette-notice-lifecycle",
    "standard-board-affordance","standard-half-shift-candidate-parity","standard-turn-guide-diet","standard-hand-compact"]){
    assert.equal(workflow.split("          tests/"+name+".test.cjs").length-1,1,name);
    assert.ok(fs.existsSync(path.join(root,"tests",name+".test.cjs")),name);
  }
});
