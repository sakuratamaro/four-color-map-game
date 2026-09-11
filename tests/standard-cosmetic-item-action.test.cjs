"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const modulePromise=import(pathToFileURL(path.join(__dirname,"../standard-online-v5/cosmetic-item-action.js")).href);
const item={cosmeticId:"boardAurora",owned:false,equipped:false,trophyUnlocked:true,price:600};
test("UDL061 intent uses the displayed item and requires a valid unlocked action",async()=>{
  const {displayedCosmeticIntent}=await modulePromise;
  assert.deepEqual(displayedCosmeticIntent(item),{cosmeticId:"boardAurora",purchaseRequired:true,price:600});
  assert.deepEqual(displayedCosmeticIntent({...item,owned:true}),{cosmeticId:"boardAurora",purchaseRequired:false,price:0});
  for(const value of [null,{...item,equipped:true},{...item,trophyUnlocked:false},{...item,price:"600"},{...item,price:-1},{...item,price:NaN}])assert.equal(displayedCosmeticIntent(value),null);
});
test("UDL061 changed price, ownership or target cannot reuse the first displayed intent",async()=>{
  const {displayedCosmeticIntent,cosmeticQuoteMatchesIntent}=await modulePromise;
  const intent=displayedCosmeticIntent(item),quote={...intent};
  assert.equal(cosmeticQuoteMatchesIntent(intent,quote),true);
  for(const patch of [{price:601},{price:599},{price:"600"},{price:NaN},{cosmeticId:"boardGold"},{purchaseRequired:false},{purchaseRequired:1}])assert.equal(cosmeticQuoteMatchesIntent(intent,{...quote,...patch}),false);
  assert.equal(cosmeticQuoteMatchesIntent(intent,null),false);
});
test("UDL061 reload never auto-submits legacy confirmation or an indeterminate saved action",async()=>{
  const {pendingCosmeticPresentation}=await modulePromise;
  assert.equal(pendingCosmeticPresentation(null),"idle");
  assert.equal(pendingCosmeticPresentation({actionId:"legacy",failed:false}),"confirm");
  assert.equal(pendingCosmeticPresentation({actionId:"legacy",failed:true}),"retry");
  assert.equal(pendingCosmeticPresentation({actionId:"new",submitted:true,failed:false}),"retry");
  assert.equal(pendingCosmeticPresentation({actionId:"changed",submitted:false}),"confirm");
});
