"use strict";
// Local preparation for954e only. Importing this module never contacts production.
const assert=require("node:assert/strict"),{isDeepStrictEqual}=require("node:util");
const CANDIDATE="954e1c5c52d5453fc9fee9872b2d7e922f850a39";
const BASE="d9ce111d7d97019d55b3e90842602001e045ea04";
const SPEC="2af5d73528a35edc29f45b3be5b700f6ceaf4688";
const REQUEST="3e6efd53-710a-45ed-9de4-05627ca5f40e";
const ORIGIN="https://qkcuhludisairpgzhryl.supabase.co",EDGE="/functions/v1/standard-game-action";
const SNAPSHOT="/rest/v1/rpc/fcg_standard_room_snapshot_v2";
const LOADOUT={color:["colorRandomBorrow","colorChoiceBorrow"],area:["areaMicroBloom","areaDiePlus"],disrupt:["disruptRandomOne","disruptChoiceOne"]};
const BOUNDS={additional_profiles:1,matches:1,character_id:"yuzu",wall_ms:240000,ordinary_play_ms:150000,
 final_read_and_teardown_reserve_ms:90000,cpu_sends:8,own_game_sends:6,surrender_sends:1,attempts:1,retries:0,rematches:0};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
function createBudget(now=Date.now){
 const started=now(),deadline=started+BOUNDS.wall_ms,playDeadline=started+BOUNDS.ordinary_play_ms;
 const used={signup:0,profileSeed:0,match:0,setup:0,initialize:0,cpu:0,own:0,surrender:0};
 const limits={signup:1,profileSeed:1,match:1,setup:1,initialize:1,cpu:8,own:6,surrender:1};
 let final=false;
 function remaining(){const ms=(final?deadline:playDeadline)-now();if(ms<=0)fail("DEADLINE");return ms;}
 function spend(kind){
  remaining();if(!(kind in limits))fail("UNPERMITTED_OPERATION");
  if(final&&kind!=="surrender")fail("ORDINARY_PLAY_CLOSED");
  if(kind==="surrender"&&!final)fail("FINAL_PHASE_REQUIRED");
  if(used[kind]>=limits[kind])fail("OPERATION_BUDGET");
  used[kind]++; // This admission occurs before the browser/API send, never after its ACK.
 }
 return Object.freeze({started,deadline,playDeadline,remaining,spend,beginFinal(){final=true;},
  get final(){return final;},get counts(){return Object.freeze({...used});}});
}
function classify(method,endpoint,body,owned,viewer){
 const url=new URL(endpoint,ORIGIN);if(url.origin!==ORIGIN)return null;
 if(method==="GET"&&url.pathname==="/rest/v1/fcg_standard_profiles"&&UUID.test(viewer||"")
  &&url.searchParams.get("user_id")==="eq."+viewer&&url.searchParams.get("select")==="revision,display_name,profile_state"
  &&[...url.searchParams.keys()].sort().join(",")==="select,user_id")return "read";
 if(url.search)return null;
 if(method==="OPTIONS")return "read";
 if(method==="GET"&&endpoint==="/auth/v1/user")return "read";
 if(method!=="POST")return null;
 if(endpoint==="/auth/v1/signup"&&isDeepStrictEqual(body,{}))return "signup";
 if(endpoint===SNAPSHOT&&UUID.test(owned||"")&&body?.p_room_id===owned
   &&Number.isSafeInteger(body.p_known_profile_revision)&&body.p_known_profile_revision>=0
   &&Object.keys(body).every(k=>["p_room_id","p_known_profile_revision"].includes(k)))return "read";
 if(["/rest/v1/rpc/fcg_standard_active_room","/rest/v1/rpc/fcg_standard_matchmaking_availability"].includes(endpoint)
  &&isDeepStrictEqual(body,{}))return "read";
 if(endpoint!==EDGE)return null;
 if(body?.operation==="profile"&&body.expectedRevision===0&&body.displayName==="CutinReadCanary"
   &&isDeepStrictEqual(body.profileState,{})&&Object.keys(body).length===4)return "profileSeed";
 if(["cpu-roster","cosmetic-catalog"].includes(body?.operation)&&Object.keys(body).length===1)return "read";
 if(body?.operation==="cpu-start"&&!owned&&body.characterId==="yuzu"&&body.confirmed===true&&UUID.test(body.actionId))return "match";
 if(!UUID.test(owned||"")||body?.roomId!==owned)return null;
 if(body.operation==="setup"&&body.expectedSetupRevision===0&&UUID.test(body.setupActionId)
   &&isDeepStrictEqual(body.loadout,LOADOUT)&&!body.debugMode&&!body.labMode)return "setup";
 if(body.operation==="initialize"&&Object.keys(body).every(k=>["operation","roomId"].includes(k)))return "initialize";
 if(body.operation==="cpu-action"&&Number.isSafeInteger(body.expectedVersion)&&body.expectedVersion>=0)return "cpu";
 const a=body.action;
 if(body.operation!=="action"||!UUID.test(a?.id)||!Number.isSafeInteger(a.expectedVersion)||a.expectedVersion<0)return null;
 if(a.type==="SURRENDER"&&isDeepStrictEqual(a.payload,{}))return "surrender";
 if(["CREATE_REGION","COLOR_REGION"].includes(a.type)&&a.payload&&typeof a.payload==="object"&&!Array.isArray(a.payload))return "own";
 if(a.type==="USE_SKILL"&&a.payload?.skill==="colorRandomBorrow")return "own";
 return null;
}
function parseSnapshot(raw,owned,viewer){
 const s=Array.isArray(raw)?raw[0]:raw,r=s?.room,v=s?.view;
 const members=Array.isArray(s?.members)?s.members:[],own=members.filter(m=>m.user_id===viewer),cpu=members.filter(m=>m.seat==="B");
 if(!(UUID.test(viewer||"")&&s?.snapshot_schema_version===2&&r?.id===owned&&r.game_mode==="standard_v5"
  &&Number.isSafeInteger(Number(s.profile_revision))&&Number(s.profile_revision)>0
  &&Array.isArray(members)&&members.length===2&&own.length===1&&own[0].seat==="A"&&own[0].is_cpu===false
  &&cpu.length===1&&cpu[0].is_cpu===true&&cpu[0].user_id!==viewer
  &&Number.isSafeInteger(Number(r.version))&&Number(r.version)>=0
  &&Number(r.version)===Number(s.snapshot_version)&&v?.seat==="A"&&Number(v.version)===Number(r.version)
  &&v.private_state&&r.public_state&&r.cpu_character_id==="yuzu"&&r.opponent_kind==="cpu"
  &&Number(r.public_state.version)===Number(r.version)
  &&((r.status==="playing"&&r.public_state.status==="ACTIVE")||(r.status==="finished"&&r.public_state.status==="FINISHED"))))fail("OWNED_SNAPSHOT_REQUIRED");
 // This is the viewer's private state only. Consumers must never serialize it into reports.
 return {status:r.status,version:Number(r.version),profileRevision:Number(s.profile_revision),publicState:r.public_state,
  privateState:{...v.private_state,seat:"A"}};
}
function createAdmission(budget){
 const sent=new Set();
 return (method,endpoint,body,owned,viewer)=>{
  const kind=classify(method,endpoint,body,owned,viewer);if(!kind)fail("UNPERMITTED_OPERATION");
  budget.remaining();
  if(kind!=="read"){
   const identity=kind==="cpu"?"cpu:"+body.expectedVersion:kind==="own"||kind==="surrender"?"action:"+body.action.id:kind;
   if(sent.has(identity))fail("NO_SEND_RETRY");
   budget.spend(kind);sent.add(identity);
  }
  return kind;
 };
}
function validateGate(doc){
 const s=doc.coordination?.remaining_brain_work?.cutin_readability_preparation;
 assert.equal(s?.candidate_sha,CANDIDATE);assert.equal(s.base_sha,BASE);assert.equal(s.spec_snapshot_sha,SPEC);
 assert.equal(s.spec_version,"UDL-065-readability-v1.1");assert.equal(s.scope,"Pages_only");
 for(const k of ["db_change_set","edge_change_set","managed_setting_change_set"])assert.deepEqual(s[k],[]);
 const {matchingReview}=require("./check-commander-continuation.cjs");
 const r=matchingReview(doc,s);
 assert.ok(r&&["APPROVE_RELEASE","APPROVE","APPROVE_WITH_CONDITIONS"].includes(r.decision),"GENUINE_REVIEW_REQUIRED");
 assert.equal(r.source.request_message_id,REQUEST);assert.equal(r.source.response_complete,true);
 assert.equal(r.source.request_body_equality,true);
 const a=s.live_canary_authorization;
 assert.ok(a?.source_review_id===r.review_id&&a.source_response_message_id===r.source.message_id
  &&a.source_request_message_id===REQUEST&&a.explicitly_authorized===true,"LIVE_SCOPE_REQUIRED");
 assert.deepEqual(a.bounds,BOUNDS);assert.deepEqual(s.live_canary_bounds,BOUNDS);
 assert.equal(s.live_canary_attempts,1);assert.equal(s.live_canary_state,"RESERVED_BEFORE_EXECUTION");
 assert.equal(s.windows_status,"SUCCESS");assert.equal(s.windows_run,"34728306768");assert.equal(s.windows_attempt,1);
 assert.equal(s.main_sha,CANDIDATE);assert.equal(s.pages_sha,CANDIDATE);assert.equal(s.pages_status,"SUCCESS");
 assert.equal(s.pages_run,"34730074280");assert.equal(s.publication,"PAGES_PUBLISHED");
 const g=s.production_gates;
 assert.ok(g?.main==="EXACT_SHA_PUBLISHED"&&g.pages==="SUCCESS_PREFLIGHT_BYTE_EXACT","PUBLICATION_GATES_REQUIRED");
 return r;
}
module.exports={createBudget,createAdmission,classify,parseSnapshot,validateGate,CANDIDATE,BASE,SPEC,REQUEST,ORIGIN,EDGE,SNAPSHOT,LOADOUT,BOUNDS};
