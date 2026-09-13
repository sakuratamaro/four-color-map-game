"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {planContinuation,pendingBinding,matchingReview,endOfTurnIssues}=require("../scripts/check-commander-continuation.cjs");
const OWNER="01a07b56-616e-7733-9aae-90575659688e", REVIEWER="6aa229e7-e098-83ee-ac5e-d366a12653a4";
function fixture(){
  const s={owner_thread_id:OWNER,candidate_sha:"a".repeat(40),base_sha:"b".repeat(40),spec_snapshot_sha:"c".repeat(40),
    spec_version:"fixture-v1",scope:"Pages_only",db_change_set:[],edge_change_set:[],review_send_attempts:1,
    review_status:"REVIEW_PENDING",review_request_message_id:"fixture-request",
    publication:"NOT_RUN",push_status:"PUSHED_EXACT_BRANCH",windows_status:"SUCCESS"};
  return {decisions:[],coordination:{automation_id:"automation",active_slice:s,
    pending_subject_sha:s.candidate_sha,last_confirmed_sent_message_id:s.review_request_message_id,
    self_sent_message_ids:[s.review_request_message_id],
    pending_review_subject:{subject_sha:s.candidate_sha,base_sha:s.base_sha,spec_snapshot_sha:s.spec_snapshot_sha,
      feature_spec_version:s.spec_version,scope:s.scope,db_change_set:[],edge_change_set:[]},
    wait_budget:{subject_sha:s.candidate_sha,root_request_message_id:s.review_request_message_id,status:"review_pending",
      started_at_utc:"2026-09-12T00:00:00Z",expires_at_utc:"2026-09-12T02:00:00Z",
      automatic_checks:0,max_automatic_checks:3,offset_minutes:[20,40,100],
      reset_on_candidate_revision:false,reset_on_restart_or_unrelated_message:false,
      next_check_utc:"2026-09-12T00:20:00Z",remaining_scheduled_slots:3,consumed_slots_utc:[]}}};
}
function approve(log){
  const s=log.coordination.active_slice;
  s.review_id="fixture-review";s.review_status="APPROVE_RELEASE";s.review_response_message_id="fixture-response";
  log.coordination.wait_budget.status="review_received_closed";
  log.decisions.push({review_id:s.review_id,subject_sha:s.candidate_sha,base_sha:s.base_sha,spec_snapshot_sha:s.spec_snapshot_sha,
    feature_spec_version:s.spec_version,canon_version:"shared-canon-v1.1",scope:s.scope,db_change_set:[],edge_change_set:[],
    decision:"APPROVE_RELEASE",review_kind:"game_production_release_approval",
    source:{kind:"chatgpt",thread_id:REVIEWER,message_id:s.review_response_message_id,request_message_id:s.review_request_message_id}});
}

test("published F3 hands adopted F1 to the same commander without replaying review or release",()=>{
  const log=fixture();approve(log);log.coordination.active_slice.publication="PUBLIC_VERIFIED_SCOPED";
  log.coordination.successor_goal={preparing_independent_slice:{owner_thread_id:OWNER,request_id:"UDL-20260910-051",
    regression_id:"REG-CPU-F1-PALETTE-WASTE",state:"BASELINE_DIAGNOSED_IMPLEMENTATION_PENDING",
    branch:"codex/cpu-palette-efficiency-20260913",worktree:".codex-worktrees/cpu-palette-efficiency-20260913",
    spec_path:"docs/CPU_PALETTE_EFFICIENCY_PLAN_20260913.md",checkpoint_sha:"d".repeat(40),base_sha:"d".repeat(40),
    implementation_authority:{kind:"adopted_user_request",request_id:"UDL-20260910-051"},publication:"NOT_RUN",next_action:"Bounded local implementation."}};
  const original=JSON.stringify(log),p=planContinuation(log);
  assert.equal(p.phase,"NORMAL_WORK");assert.equal(p.action,"CONTINUE_CPU_PALETTE_IMPLEMENTATION");
  assert.equal(p.subject_sha,"d".repeat(40));assert.equal(p.review_id,undefined);
  assert.equal(JSON.stringify(log),original,"planning cannot manufacture approval or mutate old publication");
  const due=JSON.parse(original);due.coordination.wait_budget.status="review_pending";
  assert.equal(planContinuation(due,{now:"2026-09-12T00:20:01Z"}).phase,"RECEIVE","F1 must not hide a due properly bound review");
  assert.equal(planContinuation(log,{otherOwnerActive:true}).phase,"OWNER_ACTIVE");
  for(const [field,value] of [["owner_thread_id","other"],["regression_id","draft"],["branch","main"],["base_sha","bad"],
    ["spec_path","unadopted.md"],["implementation_authority",{kind:"proposal",request_id:"UDL-20260910-051"}],["publication","PUBLIC_VERIFIED"]]){
    const copy=JSON.parse(original);copy.coordination.successor_goal.preparing_independent_slice[field]=value;
    assert.equal(planContinuation(copy).phase,"STOP");
  }
  log.coordination.active_slice.publication="NOT_RUN";
  assert.equal(planContinuation(log).action,"RELEASE_CHECKS","approved unpublished product retains priority");
});
function sourceArtifactHold(log){
  const s=log.coordination.active_slice,r=log.decisions[0];
  s.scope=r.scope="Pages_Edge";
  s.edge_change_set=r.edge_change_set=["supabase/functions/standard-game-action/standard-engine.bundle.js"];
  s.production_gates={edge:"NOT_RUN",main:"NOT_RUN",pages:"NOT_RUN"};
  s.release_preflight_hold={state:"AWAITING_USER_ARTIFACT",kind:"current_edge_source_unavailable",
    subject_sha:s.candidate_sha,spec_snapshot_sha:s.spec_snapshot_sha,review_id:r.review_id,
    review_response_message_id:r.source.message_id,observed_at_utc:"2026-09-13T04:39:17Z",
    evidence_path:"docs/source-artifact-fixture.json",download_attempts:2,user_request_sent:true,
    no_production_mutation:true,automatic_retries:0};
}

function publicActionSuccessor(log){
  const c=log.coordination,s={owner_thread_id:OWNER,request_id:"UDL-20260907-023",
    alias:"ADD-20260913-PUBLIC-MATCH-TWO-ACTIONS",source_message_id:"bbb2135e-cfd1-4da8-845b-9e3d07d8b29a",
    branch:"codex/ui-public-match-actions-20260913",worktree:".codex-worktrees/ui-public-match-actions-20260913",
    spec_path:"docs/UI_PUBLIC_MATCH_ACTIONS_20260913.md",candidate_sha:"d".repeat(40),base_sha:"e".repeat(40),
    release_after_sha:"e".repeat(40),spec_snapshot_sha:"f".repeat(40),spec_version:"UDL-023-public-actions-v1",
    scope:"Pages_only",db_change_set:[],edge_change_set:[],managed_setting_change_set:[],
    state:"LOCAL_VERIFIED_REVIEW_PREPARATION",local_verification:"PASS",review_send_attempts:0,
    review_status:"NOT_SENT",publication:"NOT_RUN",push_status:"NOT_RUN",windows_status:"NOT_RUN"};
  c.remaining_brain_work={current_local_preparation:{state:"PUBLIC_VERIFIED",public_match_followup:s},
    cutin_readability_preparation:{named_skill_followup:{candidate_sha:s.base_sha,publication:"NOT_RUN"}}};
  return s;
}

test("the exact pointer successor uses the same review queue without pairing a different worktree or reviving spent slots",()=>{
  const log=fixture();approve(log);sourceArtifactHold(log);const s=publicActionSuccessor(log);
  s.branch="codex/ui-public-match-actions-pointer-20260913";
  s.worktree=".codex-worktrees/ui-public-match-actions-pointer-20260913";
  s.push_status="PUSHED_EXACT_BRANCH";s.windows_status="SUCCESS";
  const before=JSON.stringify(log);
  assert.equal(planContinuation(log).action,"SEND_REVIEW");
  assert.equal(JSON.stringify(log),before);
  s.worktree=".codex-worktrees/ui-public-match-actions-20260913";
  assert.equal(planContinuation(log).reason,"CURRENT_EDGE_SOURCE_REQUIRES_USER_ARTIFACT");
  s.worktree=".codex-worktrees/ui-public-match-actions-pointer-20260913";
  s.review_send_attempts=1;s.review_status="REVIEW_PENDING";s.review_request_message_id="new-pointer-request";
  const c=log.coordination;c.pending_subject_sha=s.candidate_sha;c.last_confirmed_sent_message_id=s.review_request_message_id;
  c.self_sent_message_ids.push(s.review_request_message_id);
  c.pending_review_subject={subject_sha:s.candidate_sha,base_sha:s.base_sha,feature_spec_version:s.spec_version,
    spec_snapshot_sha:s.spec_snapshot_sha,scope:s.scope,db_change_set:[],edge_change_set:[],managed_setting_change_set:[]};
  Object.assign(c.wait_budget,{followup_subject_sha:s.candidate_sha,followup_request_message_id:s.review_request_message_id,
    followup_status:"review_pending",automatic_checks:2,remaining_scheduled_slots:0});
  assert.equal(pendingBinding(c),true);
  assert.equal(planContinuation(log,{now:"2026-09-12T01:45:00Z"}).reason,"FINITE_WAIT_ENDED_NO_SILENCE_APPROVAL");
});

test("a fixed test repair remains normal preparation after its old review closes without gaining approval or a fresh budget",()=>{
  const log=fixture();approve(log);sourceArtifactHold(log);const s=publicActionSuccessor(log);
  s.state="HOLD_SUPPLEMENT_REVIEW_PENDING";s.review_send_attempts=1;s.review_status="PENDING";
  s.pointer_diagnosis={repair:{owner_thread_id:OWNER,branch:"codex/ui-public-match-actions-pointer-20260913",
    worktree:".codex-worktrees/ui-public-match-actions-pointer-20260913",candidate_sha:"9".repeat(40),
    base_sha:s.candidate_sha,release_base_sha:s.base_sha,spec_snapshot_sha:s.spec_snapshot_sha,spec_version:s.spec_version,
    state:"LOCAL_VERIFIED_WINDOWS_RUNNING_REVIEW_PACKET_READY",local_verification:"PASS",
    product_source_unchanged_from_845:true,review_scope:"Pages_only",db_change_set:[],edge_change_set:[],managed_setting_change_set:[],
    publication:"NOT_RUN",publication_authorized:false,push_status:"PUSHED_EXACT_BRANCH",review_send_attempts:0,
    review_status:"NOT_SENT_PENDING_EXISTING_SUPPLEMENT_DISPOSITION",windows_run:"123"}};
  const original=JSON.stringify(log),p=planContinuation(log);
  assert.equal(p.phase,"NORMAL_WORK");assert.equal(p.action,"PREPARE_FIXED_POINTER_REVIEW");
  assert.equal(p.subject_sha,"9".repeat(40));assert.equal(p.review_id,undefined);
  assert.equal(JSON.stringify(log),original,"routing cannot edit approval, original wait budget or source hold");
  const due=JSON.parse(original);due.coordination.wait_budget.status="review_pending";
  assert.equal(planContinuation(due,{now:"2026-09-12T00:20:01Z"}).reason,"INVALID_PENDING_BINDING");
  due.coordination.pending_review_subject.scope=due.coordination.active_slice.scope;
  due.coordination.pending_review_subject.edge_change_set=due.coordination.active_slice.edge_change_set;
  assert.equal(planContinuation(due,{now:"2026-09-12T00:20:01Z"}).phase,"RECEIVE");
  for(const [key,value] of [["owner_thread_id","other"],["base_sha","0".repeat(40)],
    ["candidate_sha",s.candidate_sha],["publication_authorized",true],["product_source_unchanged_from_845",false],
    ["review_send_attempts",1],["managed_setting_change_set",[{}]],["spec_snapshot_sha","0".repeat(40)]]){
    const copy=JSON.parse(original);copy.coordination.remaining_brain_work.current_local_preparation.public_match_followup.pointer_diagnosis.repair[key]=value;
    assert.equal(planContinuation(copy).reason,"CURRENT_EDGE_SOURCE_REQUIRES_USER_ARTIFACT",key);
  }
});

test("adopted v14 public actions progress locally without reopening a parent source hold or inheriting approval",()=>{
  const log=fixture();approve(log);sourceArtifactHold(log);publicActionSuccessor(log);
  const original=JSON.stringify(log),p=planContinuation(log);
  assert.equal(p.action,"PREPARE_FIXED_PUBLIC_MATCH_REVIEW");assert.equal(p.subject_sha,"d".repeat(40));
  assert.equal(p.review_id,undefined);assert.equal(JSON.stringify(log),original);
  for(const [field,value] of [["owner_thread_id","other"],["source_message_id","invented"],["base_sha","bad"],
    ["release_after_sha","0".repeat(40)],["spec_snapshot_sha","bad"],["branch","main"],
    ["edge_change_set",["unauthorized"]],["managed_setting_change_set",[{}]],["alias","draft"]]){
    const copy=JSON.parse(original);copy.coordination.remaining_brain_work.current_local_preparation.public_match_followup[field]=value;
    assert.equal(planContinuation(copy).reason,"CURRENT_EDGE_SOURCE_REQUIRES_USER_ARTIFACT",field);
  }
});

test("public-action approval still waits for exact parent publication; no read-only planner grants that state",()=>{
  const log=fixture();approve(log);sourceArtifactHold(log);const s=publicActionSuccessor(log);
  s.review_request_message_id="successor-request";s.review_send_attempts=1;
  const approved=fixture();approved.coordination.active_slice=s;approve(approved);
  s.review_id="successor-review";approved.decisions[0].review_id=s.review_id;
  s.push_status="PUSHED_EXACT_BRANCH";s.windows_status="SUCCESS";log.decisions.push(approved.decisions[0]);
  const original=JSON.stringify(log);
  assert.equal(planContinuation(log).reason,"PARENT_RELEASE_REQUIRED_BEFORE_PUBLIC_ACTIONS");
  assert.equal(JSON.stringify(log),original);
  Object.assign(log.coordination.remaining_brain_work.cutin_readability_preparation.named_skill_followup,
    {publication:"PAGES_PUBLISHED",main_sha:s.base_sha,pages_sha:s.base_sha,pages_status:"SUCCESS"});
  const p=planContinuation(log);assert.equal(p.action,"RELEASE_CHECKS");assert.equal(p.subject_sha,s.candidate_sha);
});
test("a genuine pre-write source artifact hold stops repeated release attempts without losing approval",()=>{
  const log=fixture();approve(log);sourceArtifactHold(log);
  const original=JSON.stringify(log),p=planContinuation(log);
  assert.equal(p.phase,"STOP");assert.equal(p.reason,"CURRENT_EDGE_SOURCE_REQUIRES_USER_ARTIFACT");
  assert.equal(p.subject_sha,log.coordination.active_slice.candidate_sha);
  assert.equal(JSON.stringify(log),original,"read-only routing cannot clear the hold or change the review");
  delete log.coordination.active_slice.release_preflight_hold;
  assert.equal(planContinuation(log).action,"RELEASE_CHECKS","explicitly resolved source returns to exact existing gates");
});
test("a source artifact hold fails closed on mismatched proof and does not hide independent ready work",()=>{
  const log=fixture();approve(log);sourceArtifactHold(log);
  for(const [key,value] of [["subject_sha","d".repeat(40)],["review_id","other"],
    ["review_response_message_id","other"],["spec_snapshot_sha","d".repeat(40)],
    ["observed_at_utc","invalid"],["evidence_path",""],["user_request_sent",false],
    ["no_production_mutation",false],["automatic_retries",1],["download_attempts",3]]){
    const copy=JSON.parse(JSON.stringify(log));copy.coordination.active_slice.release_preflight_hold[key]=value;
    assert.equal(planContinuation(copy).reason,"RECONCILE_INVALID_REVIEW",key);
  }
  const changed=JSON.parse(JSON.stringify(log));changed.coordination.active_slice.production_gates.edge="DEPLOYED";
  assert.equal(planContinuation(changed).reason,"RECONCILE_INVALID_REVIEW");
  const s=JSON.parse(JSON.stringify(log.coordination.active_slice));delete s.release_preflight_hold;
  s.candidate_sha="d".repeat(40);s.review_id="other-review";s.review_request_message_id="other-request";
  s.review_response_message_id="other-response";log.coordination.preparing_next_slice=s;
  const r=JSON.parse(JSON.stringify(log.decisions[0]));r.subject_sha=s.candidate_sha;r.review_id=s.review_id;
  r.source.message_id=s.review_response_message_id;r.source.request_message_id=s.review_request_message_id;
  log.decisions.push(r);
  assert.equal(planContinuation(log).subject_sha,s.candidate_sha);
  assert.equal(planContinuation(log).action,"RELEASE_CHECKS");
});

test("new pending review can live in preparing_next_slice while parent remains partial",()=>{
  const log=fixture(),c=log.coordination;c.preparing_next_slice=c.active_slice;delete c.active_slice;
  assert.equal(pendingBinding(c),true);
  assert.equal(planContinuation(log,{now:"2026-09-12T00:10:00Z"}).phase,"WAIT_REVIEW");
  c.pending_review_subject.base_sha="d".repeat(40);assert.equal(pendingBinding(c),false);
});

test("existing v14 preparation receives a bound review without moving partial or CPU records",()=>{
 const log=fixture(),c=log.coordination,ui=c.active_slice;
 Object.assign(ui,{request_id:"UDL-20260912-065",branch:"codex/skill-cutin-readability-20260913",
   worktree:".codex-worktrees/skill-cutin-readability-20260913"});
 c.remaining_brain_work={cutin_readability_preparation:ui};
 c.active_slice={owner_thread_id:OWNER,state:"PAGES_PUBLISHED_LIVE_ACCEPTANCE_PARTIAL",publication:"PAGES_PUBLISHED"};
 const original=JSON.stringify(c.active_slice);
 assert.equal(pendingBinding(c),true);
 assert.equal(planContinuation(log,{now:"2026-09-12T00:10:00Z"}).phase,"WAIT_REVIEW");
 ui.review_status="NOT_SENT";ui.review_send_attempts=0;c.wait_budget.status="closed";
 const p=planContinuation(log);assert.equal(p.action,"SEND_REVIEW");assert.equal(p.ref,"remaining_brain_work.cutin_readability_preparation");
 assert.equal(JSON.stringify(c.active_slice),original);
 ui.branch="main";assert.equal(planContinuation(log).phase,"STOP");
});

test("fixed named successor uses the existing bounded review route without borrowing published parent authority",()=>{
 const log=fixture(),c=log.coordination,n=c.active_slice;delete c.active_slice;
 Object.assign(n,{request_id:"UDL-20260912-065",source_message_id:"bbb2135e-cfd1-4da8-845b-9e3d07d8b29a",
  branch:"codex/skill-cutin-public-names-20260913",worktree:".codex-worktrees/skill-cutin-public-names-20260913",
  spec_path:"docs/SKILL_PUBLIC_EVENT_20260913.md"});
 const ui={owner_thread_id:OWNER,request_id:n.request_id,branch:"codex/skill-cutin-readability-20260913",
  worktree:".codex-worktrees/skill-cutin-readability-20260913",candidate_sha:n.base_sha,publication:"PAGES_PUBLISHED",
  live_canary_attempts:1,live_canary_state:"ATTEMPT_FINISHED",named_skill_followup:n};
 c.remaining_brain_work={cutin_readability_preparation:ui};
 const original=JSON.stringify(log);assert.equal(pendingBinding(c),true);
 assert.equal(planContinuation(log,{now:"2026-09-12T00:10:00Z"}).phase,"WAIT_REVIEW");
 assert.equal(JSON.stringify(log),original);
 for(const key of ["owner_thread_id","source_message_id","branch","worktree","spec_path","base_sha"]){
  const copy=JSON.parse(original);copy.coordination.remaining_brain_work.cutin_readability_preparation.named_skill_followup[key]="wrong";
  assert.equal(pendingBinding(copy.coordination),false);
 }
 n.state="LOCAL_VERIFIED_REVIEW_PREPARATION";n.local_verification="PASS";n.review_send_attempts=0;
 n.review_status="NOT_SENT";n.windows_status="IN_PROGRESS";c.wait_budget.status="closed";
 assert.equal(planContinuation(log).action,"PREPARE_FIXED_PUBLIC_SKILL_REVIEW");
 n.windows_status="SUCCESS";assert.equal(planContinuation(log).action,"SEND_REVIEW");
 n.review_id="parent-only";assert.equal(matchingReview(log,n),null);
 n.review_status="REVIEW_PENDING";n.review_send_attempts=1;
 assert.equal(planContinuation(log).reason,"RECONCILE_INVALID_REVIEW");
});

test("v14 preparation approval still requires genuine exact scope and cannot borrow CPU approval",()=>{
 const log=fixture();approve(log);const c=log.coordination,ui=c.active_slice;
 Object.assign(ui,{request_id:"UDL-20260912-065",branch:"codex/skill-cutin-readability-20260913",
   worktree:".codex-worktrees/skill-cutin-readability-20260913"});
 c.remaining_brain_work={cutin_readability_preparation:ui};delete c.active_slice;
 assert.equal(planContinuation(log).action,"RELEASE_CHECKS");
 ui.candidate_sha="d".repeat(40);assert.equal(planContinuation(log).reason,"RECONCILE_INVALID_REVIEW");
 ui.candidate_sha="a".repeat(40);log.decisions[0].scope="Pages_Edge_DB_managed_activation";
 assert.equal(planContinuation(log).reason,"RECONCILE_INVALID_REVIEW");
});
test("published v14 retains only its exact bounded unused acceptance, never CPU or an old attempt",()=>{
 const log=fixture();approve(log);const c=log.coordination,ui=c.active_slice,r=log.decisions[0];
 const bounds={additional_profiles:1,matches:1,character_id:"yuzu",wall_ms:240000,ordinary_play_ms:150000,
  final_read_and_teardown_reserve_ms:90000,cpu_sends:8,own_game_sends:6,surrender_sends:1,attempts:1,retries:0,rematches:0};
 Object.assign(ui,{request_id:"UDL-20260912-065",branch:"codex/skill-cutin-readability-20260913",
  worktree:".codex-worktrees/skill-cutin-readability-20260913",publication:"PAGES_PUBLISHED",
  main_sha:ui.candidate_sha,pages_sha:ui.candidate_sha,pages_status:"SUCCESS",live_canary_attempts:0,
  live_canary_state:"AUTHORIZED_HARNESS_INCOMPLETE",live_canary_bounds:bounds,
  production_gates:{main:"EXACT_SHA_PUBLISHED",pages:"SUCCESS_PREFLIGHT_BYTE_EXACT"},
  live_canary_authorization:{explicitly_authorized:true,source_review_id:r.review_id,
   source_request_message_id:r.source.request_message_id,source_response_message_id:r.source.message_id,bounds}});
 Object.assign(r.source,{response_complete:true,request_body_equality:true});
 c.remaining_brain_work={cutin_readability_preparation:ui};delete c.active_slice;
 const before=JSON.stringify(log);assert.equal(planContinuation(log).action,"PREPARE_BOUNDED_UI_CANARY");
 assert.equal(JSON.stringify(log),before);
 ui.live_canary_state="HARNESS_LOCAL_VERIFIED_NOT_RESERVED";assert.equal(planContinuation(log).action,"EXECUTE_BOUNDED_UI_CANARY");
 ui.live_canary_attempts=1;ui.live_canary_state="RESERVED_BEFORE_EXECUTION";
 assert.equal(planContinuation(log).action,"INSPECT_RESERVED_UI_CANARY_READ_ONLY");
 ui.live_canary_state="ATTEMPT_FINISHED";assert.equal(planContinuation(log).phase,"STOP");
 ui.named_skill_followup={state:"LOCAL_PREPARATION_PENDING",owner_thread_id:ui.owner_thread_id,
  request_id:"UDL-20260912-065",source_message_id:"bbb2135e-cfd1-4da8-845b-9e3d07d8b29a",base_sha:ui.candidate_sha,
  spec_path:"docs/SKILL_PUBLIC_EVENT_PLAN_20260913.md",publication_authorized:false,live_reexecution_authorized:false};
 assert.equal(planContinuation(log).action,"PREPARE_PUBLIC_SKILL_EVENT");
 for(const key of ["owner_thread_id","source_message_id","base_sha"]){const old=ui.named_skill_followup[key];ui.named_skill_followup[key]="wrong";assert.equal(planContinuation(log).phase,"STOP");ui.named_skill_followup[key]=old;}
 ui.named_skill_followup.live_reexecution_authorized=true;assert.equal(planContinuation(log).phase,"STOP");ui.named_skill_followup.live_reexecution_authorized=false;
 for(const mutate of [s=>s.pages_sha="d".repeat(40),s=>s.live_canary_authorization.explicitly_authorized=false,
  s=>s.live_canary_authorization.source_response_message_id="old",s=>s.live_canary_authorization.bounds.cpu_sends=9,
  s=>s.live_canary_attempts=2,s=>s.production_gates.pages="NOT_RUN"]){
  const x=JSON.parse(before);mutate(x.coordination.remaining_brain_work.cutin_readability_preparation);
  assert.equal(planContinuation(x).phase,"STOP");
 }
});

test("accepted send with unconfirmed delivery gets only its original finite read, never an invented message ID",()=>{
  for(const followup of [false,true]){
    const log=fixture(),c=log.coordination,s=c.active_slice,w=c.wait_budget;
    const status="delivery_unconfirmed_api_accepted_no_resend_while_active";
    if(followup){c.preparing_next_slice=s;delete c.active_slice;w.followup_subject_sha=s.candidate_sha;
      w.followup_request_message_id=null;w.followup_status=status;w.root_request_message_id="old-received-request";}
    else {w.root_request_message_id=null;w.status=status;}
    Object.assign(s,{review_request_message_id:null,review_status:"DELIVERY_UNCONFIRMED",
      review_delivery_readback_checks:2,send_api_accepted:true,send_api_target_thread_id:REVIEWER});
    c.pending_delivery_status="SEND_API_ACCEPTED_READBACK_UNCONFIRMED_ACTIVE_NO_RESEND";
    assert.equal(pendingBinding(c),true);
    const p=planContinuation(log,{now:"2026-09-12T00:10:00Z"});
    assert.equal(p.phase,"WAIT_REVIEW");assert.equal(p.request_message_id,null);
    assert.equal(p.at_utc,"2026-09-12T00:20:00.000Z");
    assert.equal(planContinuation(log,{now:"2026-09-12T02:00:00Z"}).phase,"STOP");
    s.send_api_target_thread_id="another-chat";assert.equal(pendingBinding(c),false);
    s.send_api_target_thread_id=REVIEWER;s.review_send_attempts=2;assert.equal(pendingBinding(c),false);
  }
});

test("review receipt schedules a distinct normal run, never a self-send or automatic publication",()=>{
  const log=fixture();approve(log);
  const before=JSON.stringify(log),plan=planContinuation(log,{now:"2026-09-12T00:21:00Z"});
  assert.equal(plan.phase,"NORMAL_WORK");assert.equal(plan.action,"RELEASE_CHECKS");
  assert.equal(JSON.stringify(log),before,"planner must not write evidence or publish");
  const continuation={resume_transport:"self_send",next_run:{phase:"NORMAL_WORK",subject_sha:plan.subject_sha,at_utc:"2026-09-12T00:22:00Z"}};
  assert.ok(endOfTurnIssues(plan,continuation,{status:"PAUSED"}).includes("ORPHANED_ACTIONABLE_WORK"));
  assert.ok(endOfTurnIssues(plan,continuation,{status:"PAUSED"}).includes("NO_SELF_SEND_OR_NEW_CONTROLLER"));
  continuation.resume_transport="existing_heartbeat_next_run";
  assert.deepEqual(endOfTurnIssues(plan,continuation,{id:"automation",status:"ACTIVE",readback_verified:true,
    target_thread_id:OWNER,scheduled_for_utc:"2026-09-12T00:22:00Z"},{now:"2026-09-12T00:19:00Z"}),[]);
});
test("an ACTIVE calendar reservation cannot pass after its slot or just before the current turn ends",()=>{
  const log=fixture(),plan=planContinuation(log,{now:"2026-09-12T00:19:00Z"});
  const continuation={resume_transport:"existing_heartbeat_next_run",next_run:{phase:"RECEIVE",
    subject_sha:plan.subject_sha,at_utc:"2026-09-12T00:20:00Z"}};
  const automation={id:"automation",status:"ACTIVE",readback_verified:true,target_thread_id:OWNER,
    scheduled_for_utc:"2026-09-12T00:20:00Z"};
  for(const now of ["2026-09-12T00:19:00Z","2026-09-12T00:20:01Z"])
    assert.ok(endOfTurnIssues(plan,continuation,automation,{now}).includes("NEXT_RUN_MUST_HAVE_TWO_MINUTE_END_TURN_MARGIN"));
  automation.scheduled_for_utc="2026-09-13T00:20:00Z";
  assert.ok(endOfTurnIssues(plan,continuation,automation,{now:"2026-09-12T00:10:00Z"}).includes("ACTUAL_SCHEDULE_TIME_MISMATCH"));
});
test("wrong SHA, source, spec or change set cannot route to release",()=>{
  for(const patch of [
    {subject_sha:"d".repeat(40)},{base_sha:"d".repeat(40)},{spec_snapshot_sha:"d".repeat(40)},
    {feature_spec_version:"fixture-v2"},{db_change_set:["new.sql"]},{edge_change_set:["new-edge"]},
    {source:{kind:"codex",thread_id:REVIEWER,message_id:"fixture-response",request_message_id:"fixture-request"}},
    {source:{kind:"chatgpt",thread_id:"another-chat",message_id:"fixture-response",request_message_id:"fixture-request"}},
    {review_kind:"documentation_introduction",decision:"APPROVE_DOCS"}]){
    const log=fixture();approve(log);Object.assign(log.decisions[0],patch);
    assert.equal(matchingReview(log,log.coordination.active_slice),null);
    assert.equal(planContinuation(log).phase,"STOP");
  }
});
test("an unsent tested candidate is normal work, not indefinite response waiting",()=>{
  const log=fixture(),s=log.coordination.active_slice;
  s.review_status="NOT_SENT";s.review_send_attempts=0;log.coordination.wait_budget.status="closed";
  assert.equal(planContinuation(log).action,"SEND_REVIEW");
});

test("managed CPU activation must bind exactly in both pending envelopes and genuine release records",()=>{
  const changes=[{name:"FCG_CPU_SPLIT_RESCUE",compatible_deploy_value:null,activation_value:"standard-character-split-rescue-v1"}];
  for(const mismatch of [undefined,null,[],[{...changes[0],activation_value:"true"}],[{...changes[0],compatible_deploy_value:"active"}]]){
    const log=fixture(),s=log.coordination.active_slice;
    s.managed_setting_change_set=changes;
    log.coordination.pending_review_subject.managed_setting_change_set=mismatch;
    assert.equal(pendingBinding(log.coordination),false);
    approve(log);log.decisions[0].managed_setting_change_set=mismatch;
    assert.equal(matchingReview(log,s),null);
    assert.equal(planContinuation(log).phase,"STOP");
  }
  const log=fixture(),s=log.coordination.active_slice;
  s.managed_setting_change_set=changes;
  log.coordination.pending_review_subject.managed_setting_change_set=changes;
  assert.equal(pendingBinding(log.coordination),true);
  approve(log);log.decisions[0].managed_setting_change_set=changes;
  assert.equal(matchingReview(log,s),log.decisions[0]);
  assert.equal(planContinuation(log).action,"RELEASE_CHECKS");
});
test("no response has only three fixed slots and an immutable two-hour deadline",()=>{
  const log=fixture();
  assert.equal(planContinuation(log,{now:"2026-09-12T00:19:00Z"}).phase,"WAIT_REVIEW");
  assert.equal(planContinuation(log,{now:"2026-09-12T00:20:00Z"}).phase,"RECEIVE");
  assert.equal(planContinuation(log,{now:"2026-09-12T02:00:00Z"}).reason,"FINITE_WAIT_ENDED_NO_SILENCE_APPROVAL");
  log.coordination.wait_budget.automatic_checks=3;
  assert.equal(planContinuation(log,{now:"2026-09-12T01:50:00Z"}).phase,"STOP");
  log.coordination.wait_budget.expires_at_utc="2026-09-12T02:01:00Z";
  assert.equal(planContinuation(log).reason,"INVALID_FINITE_BUDGET");
});
test("late restart skips missed polls and a consumed slot cannot run again",()=>{
  const log=fixture(),w=log.coordination.wait_budget;
  assert.equal(planContinuation(log,{now:"2026-09-12T01:50:00Z"}).at_utc,"2026-09-12T01:40:00.000Z");
  w.consumed_slots_utc.push(w.next_check_utc);
  assert.equal(planContinuation(log,{now:"2026-09-12T00:20:00Z"}).reason,"CONSUMED_SLOT_CANNOT_RUN_TWICE");
});
test("REQUEST_CHANGES routes only revision work and an active different owner prevents concurrent integration",()=>{
  const log=fixture();approve(log);log.decisions[0].decision="REQUEST_CHANGES";
  log.coordination.active_slice.state="REVISION_REQUIRED_NOT_PUBLISHED";
  assert.equal(planContinuation(log).action,"REVISE_EXACT_SLICE");
  assert.equal(planContinuation(log,{otherOwnerActive:true}).phase,"OWNER_ACTIVE");
});
test("an explicitly received bounded live followup is actionable even if product publication is already done",()=>{
  const log=fixture();approve(log);const s=log.coordination.active_slice;s.publication="PAGES_PUBLISHED";
  s.live_acceptance_followup={state:"READY_BOUNDED_TEST",subject_sha:s.candidate_sha,spec_snapshot_sha:s.spec_snapshot_sha,
    source_review_id:"fixture-review",source_response_message_id:"fixture-response",source_request_message_id:"fixture-request",
    source_quote:"Fixture only: permit the bounded followup.",bounds:{additional_profiles:1,matches:0,deletions:0}};
  assert.equal(planContinuation(log).action,"BOUNDED_LIVE_FOLLOWUP");
  s.live_acceptance_followup.source_response_message_id="unreceived";
  assert.equal(planContinuation(log).phase,"STOP","an outbound request alone is not permission");
});
test("finished work pauses without another model loop; blocked goal label is not an authorization gate",()=>{
  const log=fixture();approve(log);
  log.coordination.next_goal={actual_api_status:"blocked"};
  assert.equal(planContinuation(log).phase,"NORMAL_WORK","explicitly resumed work is not blocked by a stale goal label");
  log.coordination.active_slice.publication="PAGES_PUBLISHED";
  const plan=planContinuation(log);assert.equal(plan.phase,"STOP");
  assert.ok(endOfTurnIssues(plan,{resume_transport:"existing_heartbeat_next_run"},{status:"ACTIVE"}).includes("PAUSE_WHEN_NO_ELIGIBLE_WORK"));
});

function waitingCiFixture(){
  const log=fixture();approve(log);
  log.decisions[0].recorded_at_utc="2026-09-12T00:00:00Z";
  const s=log.coordination.active_slice;s.windows_status="IN_PROGRESS";s.windows_run="12345";
  return log;
}
test("approved unpublished CI in progress remains normal work, never an idle stop",()=>{
  const log=waitingCiFixture(),before=JSON.stringify(log);
  const plan=planContinuation(log,{now:"2026-09-12T00:01:00Z"});
  assert.equal(plan.phase,"NORMAL_WORK");assert.equal(plan.action,"CHECK_CI");
  assert.equal(plan.run_id,"12345");assert.equal(plan.at_utc,"2026-09-12T00:05:00.000Z");
  assert.equal(plan.ci_budget.expires_at_utc,"2026-09-12T01:00:00.000Z");
  assert.equal(plan.ci_budget.max_checks,3);assert.equal(JSON.stringify(log),before);
  const continuation={resume_transport:"existing_heartbeat_next_run",next_run:{phase:"NORMAL_WORK",subject_sha:plan.subject_sha,at_utc:plan.at_utc}};
  assert.ok(endOfTurnIssues(plan,continuation,{status:"PAUSED"},{now:"2026-09-12T00:01:00Z"}).includes("ORPHANED_ACTIONABLE_WORK"));
  assert.ok(endOfTurnIssues(plan,continuation,{status:"ACTIVE"},{now:"2026-09-12T00:01:00Z"}).includes("CI_BUDGET_MUST_BE_SAVED_BEFORE_END"));
  log.coordination.active_slice.ci_followup=plan.ci_budget;
  const saved=planContinuation(log,{now:"2026-09-12T00:01:00Z"});
  assert.deepEqual(endOfTurnIssues(saved,continuation,{id:"automation",status:"ACTIVE",target_thread_id:OWNER,
    readback_verified:true,scheduled_for_utc:plan.at_utc},{now:"2026-09-12T00:01:00Z"}),[]);
  log.coordination.active_slice.windows_status="SUCCESS";
  assert.equal(planContinuation(log,{now:"2026-09-12T00:06:00Z"}).action,"RELEASE_CHECKS");
  assert.equal(log.coordination.wait_budget.status,"review_received_closed");
});
test("conditional approval preserves exact decision and cannot bypass failed or unfinished CI",()=>{
  for (const [status, action] of [["IN_PROGRESS","CHECK_CI"],["FAILURE","INVESTIGATE_CI"],["SUCCESS","RELEASE_CHECKS"]]) {
    const log=waitingCiFixture();
    log.decisions[0].decision="APPROVE_WITH_CONDITIONS";
    log.coordination.active_slice.windows_status=status;
    const before=JSON.stringify(log);
    assert.equal(planContinuation(log,{now:"2026-09-12T00:01:00Z"}).action,action);
    assert.equal(JSON.stringify(log),before);
    log.decisions[0].subject_sha="d".repeat(40);
    assert.equal(planContinuation(log,{now:"2026-09-12T00:01:00Z"}).phase,"STOP");
  }
});

test("CI check slots and deadline do not reset across restart or missing a slot",()=>{
  const log=waitingCiFixture(),s=log.coordination.active_slice;
  s.ci_followup=planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget;
  assert.equal(planContinuation(log,{now:"2026-09-12T00:30:00Z"}).at_utc,"2026-09-12T00:20:00.000Z");
  s.ci_followup.consumed_slots_utc=["2026-09-12T00:20:00.000Z"];
  const plan=planContinuation(log,{now:"2026-09-12T00:31:00Z"});
  assert.equal(plan.at_utc,"2026-09-12T00:50:00.000Z");
  assert.equal(plan.ci_budget.started_at_utc,"2026-09-12T00:00:00.000Z");
  assert.equal(plan.ci_budget.expires_at_utc,"2026-09-12T01:00:00.000Z");
  const continuation={resume_transport:"existing_heartbeat_next_run",next_run:{phase:"NORMAL_WORK",subject_sha:plan.subject_sha,at_utc:"2026-09-12T00:55:00Z"}};
  assert.ok(endOfTurnIssues(plan,continuation,{status:"ACTIVE"},{now:"2026-09-12T00:31:00Z"}).includes("CI_SLOT_MUST_NOT_MOVE"));
});
test("failed, exhausted or expired CI moves to one diagnosis, not endless result checks",()=>{
  for(const scenario of ["failure","exhausted","expired"]){
    const log=waitingCiFixture(),s=log.coordination.active_slice;
    s.ci_followup=planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget;
    if(scenario==="failure")s.windows_status="FAILURE";
    if(scenario==="exhausted")s.ci_followup.consumed_slots_utc=["2026-09-12T00:05:00.000Z","2026-09-12T00:20:00.000Z","2026-09-12T00:50:00.000Z"];
    const now=scenario==="expired"?"2026-09-12T01:00:00Z":"2026-09-12T00:51:00Z";
    const plan=planContinuation(log,{now});assert.equal(plan.action,"INVESTIGATE_CI");assert.equal(plan.phase,"NORMAL_WORK");
    s.ci_followup.investigation={subject_sha:s.candidate_sha,run_id:s.windows_run,reason:plan.reason,status:"RECORDED"};
    const held=planContinuation(log,{now});assert.equal(held.phase,"STOP");assert.match(held.reason,/CI_.*_RECORDED/);
    assert.equal(log.coordination.wait_budget.status,"review_received_closed");
  }
});
test("CI budget rejects changed run, anchor, expiry and duplicate consumed slots",()=>{
  for(const patch of [{run_id:"67890"},{started_at_utc:"2026-09-12T00:01:00Z"},{expires_at_utc:"2026-09-12T02:00:00Z"},
    {consumed_slots_utc:["2026-09-12T00:05:00.000Z","2026-09-12T00:05:00.000Z"]},{max_checks:4}]){
    const log=waitingCiFixture(),s=log.coordination.active_slice;
    s.ci_followup={...planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget,...patch};
    assert.equal(planContinuation(log,{now:"2026-09-12T00:02:00Z"}).action,"INVESTIGATE_CI");
  }
  const log=waitingCiFixture();delete log.coordination.active_slice.windows_run;
  assert.equal(planContinuation(log,{now:"2026-09-12T00:02:00Z"}).reason,"CI_RUN_BINDING_MISSING");
});

test("receive-only work may skip a missed CI slot without inventing a check or shifting the deadline",()=>{
  const log=waitingCiFixture(),s=log.coordination.active_slice;
  s.ci_followup=planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget;
  s.ci_followup.skipped_slots_utc=["2026-09-12T00:05:00.000Z"];
  const plan=planContinuation(log,{now:"2026-09-12T00:10:00Z"});
  assert.equal(plan.at_utc,"2026-09-12T00:20:00.000Z");assert.equal(plan.ci_budget.consumed_slots_utc.length,0);
  assert.equal(plan.ci_budget.expires_at_utc,"2026-09-12T01:00:00.000Z");
});

test("a recorded CI hold does not orphan another ready existing slice",()=>{
  const log=waitingCiFixture(),s=log.coordination.active_slice;
  s.ci_followup=planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget;s.windows_status="FAILURE";
  const held=planContinuation(log,{now:"2026-09-12T00:10:00Z"});
  s.ci_followup.investigation={subject_sha:s.candidate_sha,run_id:s.windows_run,reason:held.reason,status:"RECORDED"};
  log.coordination.preparing_next_slice={owner_thread_id:OWNER,candidate_sha:"e".repeat(40),
    review_send_attempts:0,review_status:"NOT_SENT",windows_status:"SUCCESS",push_status:"PUSHED_EXACT_BRANCH"};
  assert.equal(planContinuation(log,{now:"2026-09-12T00:10:00Z"}).action,"SEND_REVIEW");
});

test("repository routing uses one automation and records actual execution separately from configuration",()=>{
  const c=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8")).coordination;
  assert.equal(c.continuation.resume_transport,"existing_heartbeat_next_run");
  assert.equal(c.continuation.self_send_is_execution,false);
  assert.equal(c.continuation.configuration_is_execution,false);
  assert.equal(c.continuation.owner_thread_id,OWNER);
  assert.ok(["NOT_RUN","OBSERVED"].includes(c.continuation.first_scheduled_normal_run.status));
});
function independentCpu(log) {
  log.coordination.successor_goal={preparing_independent_slice:{owner_thread_id:OWNER,
    request_id:"UDL-20260910-051",regression_id:"REG-CPU-F3-SPLIT-ORIENTATION",
    state:"LOCAL_IMPLEMENTED_COMPATIBILITY_PENDING",branch:"codex/cpu-split-rescue-20260913",
    worktree:".codex-worktrees/cpu-split-rescue-20260913",checkpoint_sha:"d".repeat(40),base_sha:"b".repeat(40),
    publication:"NOT_RUN",next_action:"Validate compatibility and freeze a distinct reviewed CPU candidate."}};
  return log.coordination.successor_goal.preparing_independent_slice;
}
test("closed/exhausted UI review does not orphan an adopted, owned CPU implementation or reset any budget",()=>{
  for(const status of ["closed_review_received","review_pending"]) {
    const log=fixture();independentCpu(log);
    Object.assign(log.coordination.wait_budget,{status,automatic_checks:3,remaining_scheduled_slots:0});
    const before=JSON.stringify(log),plan=planContinuation(log,{now:"2026-09-12T01:55:00Z"});
    assert.equal(plan.action,"CONTINUE_INDEPENDENT_IMPLEMENTATION");assert.equal(plan.subject_sha,"d".repeat(40));
    assert.equal(JSON.stringify(log),before);
    assert.ok(endOfTurnIssues(plan,{resume_transport:"existing_heartbeat_next_run"},{status:"PAUSED"}).includes("ORPHANED_ACTIONABLE_WORK"));
  }
});
test("independent CPU continuation never bypasses due reviews, approval binding errors or another owner",()=>{
  const log=fixture();independentCpu(log);
  assert.equal(planContinuation(log,{now:"2026-09-12T00:20:00Z"}).phase,"RECEIVE");
  assert.equal(planContinuation(log,{now:"2026-09-12T00:10:00Z"}).phase,"WAIT_REVIEW");
  assert.equal(planContinuation(log,{otherOwnerActive:true}).phase,"OWNER_ACTIVE");
  approve(log);log.decisions[0].subject_sha="e".repeat(40);
  assert.equal(planContinuation(log).reason,"RECONCILE_INVALID_REVIEW");
});
test("absent, finished, malformed or differently owned independent CPU work remains stopped",()=>{
  for(const change of [s=>s.owner_thread_id="someone",s=>s.state="PUBLIC_VERIFIED",s=>s.checkpoint_sha="short",
    s=>s.request_id="unadopted",s=>s.worktree="elsewhere",s=>s.publication="PUBLIC_VERIFIED"]) {
    const log=fixture(),s=independentCpu(log);log.coordination.wait_budget.status="closed";change(s);
    assert.equal(planContinuation(log).phase,"STOP");
  }
});
