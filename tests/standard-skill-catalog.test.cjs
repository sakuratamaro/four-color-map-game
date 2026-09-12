"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {STANDARD_SKILLS}=require("../standard/standard-skill-registry.js");
const registry=require("../standard-online-v5/standard-skill-registry.generated.js");
const app=fs.readFileSync(path.join(__dirname,"../standard-online-v5/app.js"),"utf8");
const start=app.indexOf("function catalogDefinitions("),end=app.indexOf("function renderCardLibrary(",start);
assert.ok(start>=0&&end>start);
const {catalogDefinitions,catalogAvailability}=vm.runInNewContext(app.slice(start,end)+";({catalogDefinitions,catalogAvailability})");
test("UDL066 catalog equals the full implemented public registry, with both experiments and no hand-list duplication",()=>{
  const expected=Object.values(STANDARD_SKILLS).filter(d=>d.standardEngineImplemented&&(d.standardUiEnabled||d.alphaUiEnabled));
  const actual=[...catalogDefinitions(registry)];
  assert.equal(actual.length,21);assert.equal(new Set(actual.map(d=>d.id)).size,21);
  assert.deepEqual(actual.map(d=>d.id).sort(),expected.map(d=>d.id).sort());
  assert.deepEqual(actual.filter(d=>!d.standardUiEnabled).map(d=>d.id),["colorBonusRefill","legalRecolor"]);
  assert.ok(actual.every(d=>d.rarity>=1&&d.rarity<=5));
});
test("UDL066 rejects unimplemented, debug-only, malformed entries and has deterministic order",()=>{
  const regular=registry.skills.colorRandomBorrow;
  const skills={z:{...regular,id:"z"},a:{...regular,id:"a"},pending:{...regular,id:"pending",standardEngineImplemented:false},
    debug:{...regular,id:"debug",standardUiEnabled:false,alphaUiEnabled:false},
    badRarity:{...regular,id:"badRarity",rarity:9},badCategory:{...regular,id:"badCategory",usageCategory:"internal"},nullEntry:null};
  assert.deepEqual([...catalogDefinitions({skills})].map(d=>d.id),["a","z"]);
  assert.deepEqual([...catalogDefinitions({skills:Object.fromEntries(Object.entries(skills).reverse())})].map(d=>d.id),["a","z"]);
  assert.equal(catalogDefinitions({}).length,0);
});
test("UDL066 details distinguish study, ordinary gacha and corresponding experimental rules",()=>{
  assert.equal(catalogAvailability(registry.skills.colorRandomBorrow),"通常対戦用。通常ガチャの対象です。");
  for(const id of ["colorBonusRefill","legalRecolor"])
    assert.equal(catalogAvailability(registry.skills[id]),"対応するラボ・実験ルール専用。通常ガチャからは出ません。");
  assert.equal(catalogAvailability(null),"");
});
test("UDL066 renderer uses native keyed read-only buttons and keeps unowned profile-free access",()=>{
  const render=app.slice(app.indexOf("function renderCardLibrary("),app.indexOf("function mathNode("));
  assert.match(render,/catalogDefinitions\(\), value = profile\(\)/);
  assert.doesNotMatch(render,/if \(!value\) return|replaceChildren|innerHTML|client\.|localStorage\.setItem|beginSkill|commitOnline/);
  assert.match(render,/document\.createElement\("button"\)/);assert.match(render,/existing\.get\(id\)/);
  assert.match(render,/card\.onclick = \(\) => openSkillInfo\(id\)/);
  assert.match(app,/show\("cardLibraryPanel", true\)/);assert.match(app,/show\("cardSaleBox", synced && Boolean\(profile\(\)\)\)/);
  assert.match(app,/activeAppTab !== "cards"/);
});
