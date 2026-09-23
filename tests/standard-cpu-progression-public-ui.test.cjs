"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const html=read("standard-online-v5/index.html"),app=read("standard-online-v5/app.js"),spec=read("docs/CPU_PUBLIC_UI_INTEGRATION_20260921.md");
test("combined pilot colored corner capability accepts only alpha4 and legitimate alpha5",()=>{
 const source=app.match(/function supportsColoredCornerBloom\(state\) \{[^}]+\}/)?.[0];
 assert.ok(source);
 const supports=require("node:vm").runInNewContext("("+source+")");
 for(const version of ["5.0.0-alpha.4","5.0.0-alpha.5"])assert.equal(supports({engineVersion:version}),true,version);
 for(const version of [undefined,null,"","5.0.0-alpha.1","5.0.0-alpha.2","5.0.0-alpha.3","5.0.0-alpha.6","5.0.0"])assert.equal(supports({engineVersion:version}),false,String(version));
 assert.equal(supports(null),false);assert.equal(supports(undefined),false);
});
test("combined pilot keeps published board/palette model and surface bytes",()=>{
 for(const [p,sha] of Object.entries({
  "standard-online-v5/play-surface-model.js":"579899caca33573667c2b1b0f8c7d21df91868e7d9e4dcaab2af936be9005f09",
  "standard-online-v5/play-surface.css":"bd8a33a2863423b400642fa7d0b598f7d30d8df3a4be7cdeba6e2c1291f4555d"
 }))assert.equal(crypto.createHash("sha256").update(read(p)).digest("hex"),sha,p);
});
test("combined pilot identifies new assets separately from frozen navigation and CPU parents",()=>{
 for(const marker of ["app.js?v=20260921-2","style.css?v=20260921-1","standard-online-client.js?v=20260914-1","standard-skill-registry.generated.js?v=20260914-2"]){
  const current=marker==="app.js?v=20260921-2"?"app.js?v=20260923-1":marker;
  assert.ok(html.includes(current),current);assert.ok(spec.includes(marker),marker);
 }
 for(const marker of ["play-surface-model.js?v=20260915-1","result-continuation.js?v=20260914-2","cpu-progression-model.js?v=20260914-1"]){
  assert.ok(app.includes(marker),marker);assert.ok(spec.includes(marker),marker);
 }
 const localMarker="app.bundle.js?v=20260914-11-63d4f2b526f1";
 assert.ok(read("standard-v5/index.html").includes(localMarker));assert.ok(spec.includes(localMarker));
 for(const phrase of ["4d91bbd4ea407be428144fe04ff5eb8821b3a8a0","2e30e9a25db674fe4168bac3ec745fe04641b3c9","UDL011064-pilot-design-v2","NOT_RUN","Old052/057","default OFF"])assert.ok(spec.includes(phrase),phrase);
});
test("separate technique control does not restore removed setup clutter or replace the hand",()=>{
 const hand=html.indexOf('id="skillControls"'),targets=html.indexOf('id="skillTargetControls"'),tech=html.indexOf('id="techniqueControls"'),history=html.indexOf('id="paletteHistoryPanel"');
 assert.ok(hand>0&&hand<targets&&targets<tech&&tech<history);
 assert.equal(html.split('id="techniqueControls"').length-1,1);
 assert.doesNotMatch(html,/id="(?:matchSetupDetails|randomSummaryTitle|rolledSizeValue)"/);
 assert.ok(html.includes('aria-controls="techniqueTargets"'));
 assert.match(app,/stableHandSlots\(/);
 assert.match(app,/paletteRoleSlots\(/);
 assert.match(app,/cardActionRecovery\(/);
});
