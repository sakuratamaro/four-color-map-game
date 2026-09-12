"use strict";
// One unauthenticated OPTIONS probe. No profiles, RPC, mutation, retry or approval.
const assert=require("node:assert/strict");
const ENDPOINT="https://qkcuhludisairpgzhryl.supabase.co/functions/v1/standard-game-action";
const CAPABILITY="standard-character-split-rescue-v1";
const GENERATIONS=new Set(["baseline","legacy","current"]);
function evaluate(response,body,expectedGeneration){
  assert.ok(GENERATIONS.has(expectedGeneration),"INVALID_EXPECTED_GENERATION");
  const capability=response.headers.get("x-fcg-cpu-policy-capability");
  const generation=response.headers.get("x-fcg-cpu-policy-generation");
  const advertised=capability===CAPABILITY;
  const baseline=capability===null&&generation===null;
  const matches=expectedGeneration==="baseline"?baseline:advertised&&generation===expectedGeneration;
  return {
    ok:response.status===200&&body==="ok"&&matches,
    status:response.status,bodyMatches:body==="ok",expectedGeneration,
    capability:advertised?"MATCH":capability===null?"NOT_ADVERTISED":"UNEXPECTED",
    generation:generation===null?"NOT_ADVERTISED":["legacy","current"].includes(generation)?generation:"UNEXPECTED",
    requestCount:1,profileWrites:0,databaseWrites:0,
    artifactEquality:"NOT_CHECKED",allRegions:"NOT_CHECKED",workerDrain:"NOT_EVALUATED",
    releaseAuthorized:false,
  };
}
async function probe({expectedGeneration,fetchImpl=globalThis.fetch}){
  assert.ok(GENERATIONS.has(expectedGeneration),"INVALID_EXPECTED_GENERATION");
  const response=await fetchImpl(ENDPOINT,{
    method:"OPTIONS",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000),
  });
  const body=await response.text();
  assert.ok(body.length<=4096,"UNEXPECTED_RESPONSE_SIZE");
  return evaluate(response,body,expectedGeneration);
}
function parseArgs(args){
  assert.equal(args.length,1,"Exactly --generation=baseline|legacy|current is required");
  const match=args[0].match(/^--generation=(baseline|legacy|current)$/);
  assert.ok(match,"INVALID_EXPECTED_GENERATION");
  return {expectedGeneration:match[1]};
}
if(require.main===module){
  (async()=>{
    const result=await probe(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({observedAt:new Date().toISOString(),...result},null,2));
    if(!result.ok)process.exitCode=1;
  })().catch(error=>{
    console.error(JSON.stringify({ok:false,error:error?.code==="ERR_ASSERTION"?"INPUT_OR_CONTRACT":error?.name==="TimeoutError"?"TIMEOUT":"NETWORK_OR_CONTRACT",releaseAuthorized:false}));
    process.exitCode=1;
  });
}
module.exports={probe,evaluate,parseArgs,ENDPOINT,CAPABILITY};
