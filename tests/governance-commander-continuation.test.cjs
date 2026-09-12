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
test("new pending review can live in preparing_next_slice while parent remains partial",()=>{
  const log=fixture(),c=log.coordination;c.preparing_next_slice=c.active_slice;delete c.active_slice;
  assert.equal(pendingBinding(c),true);
  assert.equal(planContinuation(log,{now:"2026-09-12T00:10:00Z"}).phase,"WAIT_REVIEW");
  c.pending_review_subject.base_sha="d".repeat(40);assert.equal(pendingBinding(c),false);
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
  assert.deepEqual(endOfTurnIssues(plan,continuation,{id:"automation",status:"ACTIVE",readback_verified:true,target_thread_id:OWNER}),[]);
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
test("repository routing uses one automation and records actual execution separately from configuration",()=>{
  const c=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8")).coordination;
  assert.equal(c.continuation.resume_transport,"existing_heartbeat_next_run");
  assert.equal(c.continuation.self_send_is_execution,false);
  assert.equal(c.continuation.configuration_is_execution,false);
  assert.equal(c.continuation.owner_thread_id,OWNER);
  assert.ok(["NOT_RUN","OBSERVED"].includes(c.continuation.first_scheduled_normal_run.status));
});
