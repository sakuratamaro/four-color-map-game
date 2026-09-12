"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {probe,evaluate,parseArgs,ENDPOINT,CAPABILITY}=require("../scripts/check-cpu-split-readiness.cjs");
const response=(generation,capability=CAPABILITY,status=200)=>new Response("ok",{status,headers:{
  ...(generation===undefined?{}:{"x-fcg-cpu-policy-generation":generation}),
  ...(capability===undefined?{}:{"x-fcg-cpu-policy-capability":capability}),
}});
test("readiness probe performs exactly one fixed-origin write-free OPTIONS with no auth or body",async()=>{
  let calls=0;
  const result=await probe({expectedGeneration:"current",fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,ENDPOINT);assert.equal(options.method,"OPTIONS");
    assert.equal(options.redirect,"error");assert.equal(options.cache,"no-store");
    assert.equal(options.headers,undefined);assert.equal(options.body,undefined);
    assert.ok(options.signal instanceof AbortSignal);
    return response("current");
  }});
  assert.equal(calls,1);assert.equal(result.ok,true);assert.equal(result.databaseWrites,0);
  assert.equal(result.profileWrites,0);assert.equal(result.releaseAuthorized,false);
  assert.equal(result.artifactEquality,"NOT_CHECKED");assert.equal(result.allRegions,"NOT_CHECKED");
  assert.equal(result.workerDrain,"NOT_EVALUATED");
});
test("legacy and current readiness require exact capability and generation",()=>{
  for(const generation of ["legacy","current"]){
    assert.equal(evaluate(response(generation),"ok",generation).ok,true);
    assert.equal(evaluate(response(generation==="legacy"?"current":"legacy"),"ok",generation).ok,false);
    assert.equal(evaluate(response(generation,"wrong"),"ok",generation).ok,false);
    assert.equal(evaluate(response(generation),"ok\n",generation).ok,false);
    assert.equal(evaluate(response(generation,CAPABILITY,403),"ok",generation).ok,false);
  }
});
test("unadvertised baseline is metadata only and cannot pass a legacy compatibility gate",()=>{
  const baseline=new Response("ok",{status:200});
  assert.equal(evaluate(baseline,"ok","baseline").ok,true);
  assert.equal(evaluate(baseline,"ok","baseline").capability,"NOT_ADVERTISED");
  assert.equal(evaluate(baseline,"ok","legacy").ok,false);
  assert.equal(evaluate(baseline,"ok","current").ok,false);
  assert.equal(evaluate(response("legacy"),"ok","baseline").ok,false);
});
test("unexpected response content never becomes report text or a false readiness pass",()=>{
  const report=evaluate(response("sensitive-generation","private-value"),"untrusted response body","current");
  assert.equal(report.ok,false);
  assert.equal(report.generation,"UNEXPECTED");assert.equal(report.capability,"UNEXPECTED");
  assert.doesNotMatch(JSON.stringify(report),/sensitive|private-value|untrusted response/);
});
test("invalid input is rejected before fetch and CLI does not accept arbitrary URLs",async()=>{
  let calls=0;
  await assert.rejects(probe({expectedGeneration:"true",fetchImpl:async()=>{calls++;}}));
  assert.equal(calls,0);
  for(const args of [[],["--generation=oops"],["--generation=current","--url=https://other.example"]])assert.throws(()=>parseArgs(args));
  for(const generation of ["baseline","legacy","current"])assert.deepEqual(parseArgs(["--generation="+generation]),{expectedGeneration:generation});
});
test("network and excessive-body failures never retry",async()=>{
  let calls=0;
  await assert.rejects(probe({expectedGeneration:"current",fetchImpl:async()=>{calls++;throw new Error("fixture");}}));
  assert.equal(calls,1);
  await assert.rejects(probe({expectedGeneration:"current",fetchImpl:async()=>new Response("x".repeat(4097))}));
});
test("probe artifact has no production mutation or credential-loading path",()=>{
  const source=fs.readFileSync(path.join(__dirname,"../scripts/check-cpu-split-readiness.cjs"),"utf8");
  assert.doesNotMatch(source,/service_role|publishableKey|process\.env|\/auth\/|\/rest\/|method:\s*["']POST|setInterval|writeFile|execFile/);
  assert.match(source,/AbortSignal\.timeout\(10000\)/);
  assert.equal((source.match(/fetchImpl\(/g)||[]).length,1);
});
