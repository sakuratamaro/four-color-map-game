"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const file=path.join(__dirname,"../scripts/live-standard-skill-catalog-canary.cjs");
const {parseOptions,isSameIds,finalResults,screenshotPath}=require(file);
const sha="2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152";
const report=path.join(__dirname,"../docs/CATALOG_NOT_EXECUTED_UNIT_TEST.json");
test("catalog screenshot filename cannot retain JSON extension or overwrite raw evidence",()=>{
  for(const width of [390,768,1280]){
    const image=screenshotPath(report,width);
    assert.equal(path.dirname(image),path.dirname(report));assert.equal(path.extname(image),".png");
    assert.notEqual(image,report);assert.equal(path.basename(image),"CATALOG_NOT_EXECUTED_UNIT_TEST-"+width+".png");
  }
  assert.throws(()=>screenshotPath(report,0));assert.throws(()=>screenshotPath(report+".other",390));
});
test("catalog029 requires fixed reviewed SHA, opt-in and a new scoped output",()=>{
  const base=["--confirm-live","--candidate="+sha,"--report="+report];
  assert.equal(parseOptions(base).candidate,sha);
  for(const args of [[],base.slice(1),base.concat("--extra-profile"),base.concat("--force"),
    base.map(x=>x==="--candidate="+sha?"--candidate="+"0".repeat(40):x),
    base.map(x=>x.startsWith("--report=")?"--report="+path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json"):x)])assert.throws(()=>parseOptions(args));
  const p=spawnSync(process.execPath,[file],{encoding:"utf8",windowsHide:true,timeout:10000,env:{...process.env,NODE_PATH:""}});
  assert.equal(p.status,2);assert.match(p.stderr,/Refusing production test/);
});
test("catalog exact set rejects omissions duplicates and additions without depending on order",()=>{
  assert.equal(isSameIds(["b","a"],["a","b"]),true);
  for(const actual of [["a"],["a","a"],["a","b","c"],["a","c"]])assert.equal(isSameIds(actual,["a","b"]),false);
});
test("catalog independent failure audits retain missing profile, denied writes and console failures",()=>{
  const p={revision:1,profileState:{inventory:{x:0},history:[]}};
  const result=finalResults({actual:null,expected:p,calls:[{method:"POST",pathname:"/functions/v1/standard-game-action",operation:"gacha"}],errors:1,warnings:0});
  assert.deepEqual(result.checks.map(x=>x.passed),[false,false,false]);
  const pass=finalResults({actual:{revision:1,profileState:{history:[],inventory:{x:0}}},expected:{...p,displayName:"Fixture"},calls:[],errors:0,warnings:0});
  assert.deepEqual(pass.checks.map(x=>x.passed),[true,true,true]);assert.equal(pass.comparison.responseName.same,false);
});
test("catalog live driver guards all four bytes before one profile and never creates a match",()=>{
  const s=fs.readFileSync(file,"utf8");
  for(const marker of ["app.js?v=20260912-40","standard-skill-registry.generated.js?v=20260912-2","skill-catalog.css?v=20260912-1"])assert.ok(s.includes(marker));
  assert.ok(s.indexOf('bytes.equals(git("show"')<s.indexOf('request("/auth/v1/signup"'));
  assert.equal((s.match(/request\("\/auth\/v1\/signup"/g)||[]).length,1);
  assert.match(s,/report\.profileAttempts=1/);assert.match(s,/matchesCreated:0/);assert.match(s,/180_000/);
  assert.match(s,/route\.abort\("blockedbyclient"\)/);
  assert.doesNotMatch(s,/route\.fulfill|addInitScript|service_role|\/admin\/|operation:"(?:gacha|cpu-start|setup|action|card-sale|cosmetic-action)"/);
  assert.ok(s.indexOf("context.close()")<s.indexOf("actual=await profile(true)"));
  assert.ok(s.indexOf('status:"FINAL_CHECKS_CAPTURED_NOT_YET_ACCEPTED"')<s.indexOf("failed=failed||!result.checks.every"));
});
test("catalog acceptance covers all details native keys timing viewport reload and new visual artifacts",()=>{
  const s=fs.readFileSync(file,"utf8");
  for(const marker of ['expected.entries()','i%2?"Space":"Enter"','page.keyboard.press("Escape")','definition.timing==="COLOR"','[390,768,1280]','c.width>=44&&c.height>=44','page.reload','fs.existsSync(screenshot)','page.locator("#cardLibraryPanel").screenshot'])assert.ok(s.includes(marker),marker);
  assert.match(s,/faultInjection:"NONE"/);assert.doesNotMatch(s,/JSON\.stringify\((?:session|calls|baseline|actual|token)\)/);
});
