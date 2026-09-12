"use strict";
// Read-only routing for the existing commander and coordination record.
// This does not authenticate reviews, publish, write a ledger, or call an AI.
const fs = require("node:fs");
const path = require("node:path");
const OWNER = "01a07b56-616e-7733-9aae-90575659688e";
const REVIEWER = "6aa229e7-e098-83ee-ac5e-d366a12653a4";
const SHA = /^[0-9a-f]{40}$/;
const slices = c => ["active_slice", "preparing_next_slice"].flatMap(ref => c[ref] ? [{ref, slice:c[ref]}] : []);
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);

function matchingReview(log, slice) {
  const matches = log.decisions.filter(r => r.review_id === slice.review_id);
  if (matches.length !== 1) return null;
  const r = matches[0];
  if (r.review_kind !== "game_production_release_approval" ||
      r.canon_version !== "shared-canon-v1.1" ||
      r.source?.kind !== "chatgpt" || r.source.thread_id !== REVIEWER ||
      !r.source.message_id || !r.source.request_message_id ||
      r.source.message_id !== slice.review_response_message_id ||
      r.source.request_message_id !== slice.review_request_message_id) return null;
  for (const [key, field] of [["subject_sha","candidate_sha"],["base_sha","base_sha"],
    ["spec_snapshot_sha","spec_snapshot_sha"]])
    if (!SHA.test(slice[field] || "") || r[key] !== slice[field]) return null;
  if (r.feature_spec_version !== slice.spec_version || r.scope !== slice.scope) return null;
  for (const key of ["db_change_set","edge_change_set"])
    if (!Array.isArray(slice[key]) || !equal(r[key],slice[key])) return null;
  return r;
}

function pendingBinding(c) {
  const w = c.wait_budget || {};
  const subject = w.followup_subject_sha || w.subject_sha;
  const request = w.followup_subject_sha ? w.followup_request_message_id : w.root_request_message_id;
  const matches = slices(c).filter(({slice}) => slice.candidate_sha === subject);
  if (matches.length !== 1) return false;
  const s = matches[0].slice, p = c.pending_review_subject || {};
  const envelopeMatches = SHA.test(subject || "") && subject === c.pending_subject_sha &&
    p.subject_sha === subject && p.base_sha === s.base_sha &&
    p.feature_spec_version === s.spec_version && p.spec_snapshot_sha === s.spec_snapshot_sha &&
    p.scope === s.scope && equal(p.db_change_set,s.db_change_set) &&
    equal(p.edge_change_set,s.edge_change_set);
  if ((w.followup_status || w.status) === "delivery_unconfirmed_api_accepted_no_resend_while_active")
    return envelopeMatches && request === null && s.review_request_message_id === null &&
      s.review_send_attempts === 1 && s.review_delivery_readback_checks === 2 &&
      s.review_status === "DELIVERY_UNCONFIRMED" && s.send_api_accepted === true &&
      s.send_api_target_thread_id === REVIEWER &&
      c.pending_delivery_status === "SEND_API_ACCEPTED_READBACK_UNCONFIRMED_ACTIVE_NO_RESEND";
  return envelopeMatches && Boolean(request) &&
    request === s.review_request_message_id && request === c.last_confirmed_sent_message_id &&
    (c.self_sent_message_ids || []).includes(request);
}

// Same-run CI continuation is metadata on the existing slice, not a second queue.
function pendingCiPlan(s, review, ref, now) {
  const base={phase:"NORMAL_WORK",ref,subject_sha:s.candidate_sha,review_id:review.review_id,run_id:s.windows_run};
  const investigate=reason=>{
    const saved=s.ci_followup?.investigation;
    if(saved?.status==="RECORDED" && saved.reason===reason &&
        saved.subject_sha===s.candidate_sha && saved.run_id===s.windows_run)
      return {...base,phase:"STOP",reason:reason+"_RECORDED"};
    return {...base,action:"INVESTIGATE_CI",reason};
  };
  if(!/^[1-9][0-9]*$/.test(String(s.windows_run||"")))return investigate("CI_RUN_BINDING_MISSING");
  const start=Date.parse(review.recorded_at_utc),time=Date.parse(now);
  if(!Number.isFinite(start)||!Number.isFinite(time))return investigate("CI_REVIEW_ANCHOR_MISSING");
  const offsets=[5,20,50],expiry=start+60*60_000,slots=offsets.map(m=>new Date(start+m*60_000).toISOString());
  const budget=s.ci_followup || {run_id:s.windows_run,subject_sha:s.candidate_sha,
    started_at_utc:new Date(start).toISOString(),expires_at_utc:new Date(expiry).toISOString(),
    offset_minutes:offsets,max_checks:3,consumed_slots_utc:[],skipped_slots_utc:[],reset_on_restart_or_candidate_revision:false};
  const consumed=budget.consumed_slots_utc,skipped=budget.skipped_slots_utc;
  if(budget.run_id!==s.windows_run || budget.subject_sha!==s.candidate_sha ||
      Date.parse(budget.started_at_utc)!==start || Date.parse(budget.expires_at_utc)!==expiry ||
      budget.max_checks!==3 || !equal(budget.offset_minutes,offsets) ||
      budget.reset_on_restart_or_candidate_revision!==false || !Array.isArray(consumed) || !Array.isArray(skipped) ||
      consumed.length+skipped.length>3 || new Set([...consumed,...skipped]).size!==consumed.length+skipped.length ||
      [...consumed,...skipped].some(at=>!slots.includes(at)))
    return investigate("CI_BUDGET_INVALID");
  if(!["IN_PROGRESS","QUEUED","PENDING","WAITING"].includes(s.windows_status))
    return investigate("CI_FAILED_OR_UNKNOWN");
  if(time>=expiry)return investigate("CI_DEADLINE_EXPIRED");
  const last=Math.max(-Infinity,...[...consumed,...skipped].map(Date.parse));
  const remaining=slots.filter(at=>Date.parse(at)>last);
  if(consumed.length>=3||!remaining.length)return investigate("CI_CHECK_BUDGET_EXHAUSTED");
  const due=remaining.filter(at=>Date.parse(at)<=time);
  return {...base,action:"CHECK_CI",at_utc:due.at(-1)||remaining[0],
    ci_budget:budget,budget_persisted:Boolean(s.ci_followup),
    reason:"APPROVED_UNPUBLISHED_SAME_CI_RUN_REQUIRES_BOUNDED_CHECK"};
}

function planContinuation(log, {now = new Date().toISOString(), otherOwnerActive = false} = {}) {
  const c = log.coordination;
  if (!c || c.automation_id !== "automation") return {phase:"STOP", reason:"INVALID_EXISTING_COORDINATION"};
  if (otherOwnerActive) return {phase:"OWNER_ACTIVE", reason:"NO_CONCURRENT_LEDGER_WRITE"};
  const issues = [];
  let recordedCiStop;
  for (const {ref,slice:s} of slices(c)) {
    if (s.owner_thread_id !== OWNER) continue;
    const r = matchingReview(log,s);
    const f = s.live_acceptance_followup;
    const disposition = f && log.decisions.find(d => d.review_id === f.source_review_id);
    if (f?.state === "READY_BOUNDED_TEST" && f.subject_sha === s.candidate_sha &&
        f.spec_snapshot_sha === s.spec_snapshot_sha && f.source_quote &&
        disposition?.source?.kind === "chatgpt" && disposition.source.thread_id === REVIEWER &&
        disposition.source.message_id === f.source_response_message_id &&
        disposition.source.request_message_id === f.source_request_message_id &&
        f.bounds?.additional_profiles === 1 && f.bounds?.matches === 0 && f.bounds?.deletions === 0)
      return {phase:"NORMAL_WORK", action:"BOUNDED_LIVE_FOLLOWUP", ref, subject_sha:s.candidate_sha,
        review_id:f.source_review_id, reason:"EXPLICIT_REVIEW_DISPOSITION_WITH_ORIGINAL_FAILURE_PRESERVED"};
    if (s.review_id && !r) issues.push(ref + ":EXACT_REVIEW_BINDING_REQUIRED");
    // A review is a gate, not a release command: fresh main/CI/Pages/live checks remain mandatory.
    if (r && ["APPROVE_RELEASE","APPROVE","APPROVE_WITH_CONDITIONS"].includes(r.decision) &&
        ["NOT_RUN","NOT_MERGED","not_merged"].includes(s.publication) &&
        s.push_status === "PUSHED_EXACT_BRANCH") {
      if(s.windows_status === "SUCCESS")
        return {phase:"NORMAL_WORK", action:"RELEASE_CHECKS", ref, subject_sha:s.candidate_sha,
          review_id:r.review_id, reason:"APPROVED_UNPUBLISHED_WORK_MUST_NOT_BE_ORPHANED"};
      const ci=pendingCiPlan(s,r,ref,now);
      if(ci.phase!=="STOP")return ci;
      recordedCiStop=ci; // A recorded CI hold must not hide another ready slice or review.
    }
    if (r?.decision === "REQUEST_CHANGES" && s.state === "REVISION_REQUIRED_NOT_PUBLISHED")
      return {phase:"NORMAL_WORK", action:"REVISE_EXACT_SLICE", ref, subject_sha:s.candidate_sha,
        review_id:r.review_id, reason:"RECEIVED_CHANGES_NEED_NORMAL_WORK"};
    if (s.review_send_attempts === 0 && s.review_status === "NOT_SENT" &&
        s.windows_status === "SUCCESS" && s.push_status === "PUSHED_EXACT_BRANCH")
      return {phase:"NORMAL_WORK", action:"SEND_REVIEW", ref, subject_sha:s.candidate_sha,
        reason:"READY_UNSENT_IS_WORK_NOT_A_REVIEW_WAIT"};
  }
  if (issues.length) return {phase:"STOP", reason:"RECONCILE_INVALID_REVIEW", issues};
  const independent=c.successor_goal?.preparing_independent_slice;
  const independentPlan=independent?.owner_thread_id===OWNER
    &&independent.request_id==="UDL-20260910-051"
    &&independent.regression_id==="REG-CPU-F3-SPLIT-ORIENTATION"
    &&independent.state==="LOCAL_IMPLEMENTED_COMPATIBILITY_PENDING"
    &&independent.branch==="codex/cpu-split-rescue-20260913"
    &&independent.worktree===".codex-worktrees/cpu-split-rescue-20260913"
    &&SHA.test(independent.checkpoint_sha||"")&&SHA.test(independent.base_sha||"")
    &&independent.publication==="NOT_RUN"&&independent.next_action
    ? {phase:"NORMAL_WORK",action:"CONTINUE_INDEPENDENT_IMPLEMENTATION",
      ref:"successor_goal.preparing_independent_slice",subject_sha:independent.checkpoint_sha,
      request_id:independent.request_id,reason:"CLOSED_REVIEW_MUST_NOT_ORPHAN_ADOPTED_LOCAL_WORK"}:null;
  const w = c.wait_budget || {}, pending = ["review_pending","delivery_unconfirmed_api_accepted_no_resend_while_active"].includes(w.followup_status || w.status);
  if (!pending) return independentPlan || recordedCiStop || {phase:"STOP", reason:"NO_ELIGIBLE_REVIEW_OR_READY_WORK"};
  if (!pendingBinding(c)) return {phase:"STOP", reason:"INVALID_PENDING_BINDING"};
  const start = Date.parse(w.started_at_utc), expiry = Date.parse(w.expires_at_utc), time = Date.parse(now);
  const checks = w.automatic_checks;
  if (![start,expiry,time].every(Number.isFinite) || expiry-start !== 120*60_000 ||
      w.max_automatic_checks !== 3 || !equal(w.offset_minutes,[20,40,100]) ||
      w.reset_on_candidate_revision !== false || w.reset_on_restart_or_unrelated_message !== false ||
      !Number.isInteger(checks) || checks < 0 || checks > 3)
    return {phase:"STOP", reason:"INVALID_FINITE_BUDGET"};
  if (time >= expiry || checks >= 3 || w.remaining_scheduled_slots === 0)
    return independentPlan || {phase:"STOP", reason:"FINITE_WAIT_ENDED_NO_SILENCE_APPROVAL"};
  const at = Date.parse(w.next_check_utc);
  const validSlots = w.offset_minutes.map(m => start + m*60_000);
  if (!validSlots.includes(at) || at >= expiry)
    return {phase:"STOP", reason:"INVALID_NEXT_SLOT"};
  const consumed = w.consumed_slots_utc || [];
  if (consumed.includes(w.next_check_utc))
    return {phase:"STOP", reason:"CONSUMED_SLOT_CANNOT_RUN_TWICE"};
  // A late restart reads at most once at the latest due slot, never a burst of catch-up polls.
  const due = validSlots.filter(t => t >= at && t <= time && !consumed.some(s => Date.parse(s) === t));
  const next = due.length ? due.at(-1) : at;
  return {phase:time >= at ? "RECEIVE" : "WAIT_REVIEW",
    at_utc:new Date(next).toISOString(), subject_sha:w.followup_subject_sha || w.subject_sha,
    request_message_id:w.followup_subject_sha ? w.followup_request_message_id : w.root_request_message_id,
    reason:(w.followup_status || w.status) === "review_pending" ? "ONE_BOUNDED_READ_ONLY_NO_RESEND" : "ONE_BOUNDED_DELIVERY_READ_NO_RESEND"};
}

function endOfTurnIssues(plan, continuation, automation, {now = new Date().toISOString()} = {}) {
  const errors = [];
  if (continuation?.resume_transport !== "existing_heartbeat_next_run")
    errors.push("NO_SELF_SEND_OR_NEW_CONTROLLER");
  if (plan.phase === "OWNER_ACTIVE") return errors;
  const needed = ["NORMAL_WORK","RECEIVE","WAIT_REVIEW"].includes(plan.phase);
  if (needed && automation.status !== "ACTIVE") errors.push("ORPHANED_ACTIONABLE_WORK");
  if (needed && (!automation.readback_verified || automation.id !== "automation" ||
      automation.target_thread_id !== OWNER)) errors.push("ACTUAL_EXISTING_SCHEDULE_READBACK_REQUIRED");
  if (needed && continuation.next_run?.phase !== (plan.phase === "NORMAL_WORK" ? "NORMAL_WORK" : "RECEIVE"))
    errors.push("NEXT_RUN_PHASE_MISMATCH");
  if (needed && continuation.next_run?.subject_sha !== plan.subject_sha)
    errors.push("NEXT_RUN_SUBJECT_MISMATCH");
  if (needed && !Number.isFinite(Date.parse(continuation.next_run?.at_utc)))
    errors.push("NEXT_RUN_TIME_REQUIRED");
  if (needed && Date.parse(automation.scheduled_for_utc) !== Date.parse(continuation.next_run?.at_utc))
    errors.push("ACTUAL_SCHEDULE_TIME_MISMATCH");
  if (needed && Date.parse(continuation.next_run?.at_utc) - Date.parse(now) < 120_000)
    errors.push("NEXT_RUN_MUST_HAVE_TWO_MINUTE_END_TURN_MARGIN");
  if (needed && plan.phase !== "NORMAL_WORK" && Date.parse(continuation.next_run?.at_utc) !== Date.parse(plan.at_utc))
    errors.push("FINITE_SLOT_MUST_NOT_MOVE");
  if (plan.action === "CHECK_CI") {
    if (!plan.budget_persisted) errors.push("CI_BUDGET_MUST_BE_SAVED_BEFORE_END");
    if (Date.parse(continuation.next_run?.at_utc) !== Date.parse(plan.at_utc)) errors.push("CI_SLOT_MUST_NOT_MOVE");
    if (Date.parse(continuation.next_run?.at_utc) >= Date.parse(plan.ci_budget.expires_at_utc)) errors.push("CI_DEADLINE_MUST_NOT_EXTEND");
  }
  if (!needed && automation.status !== "PAUSED") errors.push("PAUSE_WHEN_NO_ELIGIBLE_WORK");
  return errors;
}

if (require.main === module) {
  const args = process.argv.slice(2), fileArg = args.find(a => a.startsWith("--file="));
  const nowArg = args.find(a => a.startsWith("--now="));
  const file = fileArg ? path.resolve(fileArg.slice(7)) : path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json");
  if (args.some(a => !a.startsWith("--file=") && !a.startsWith("--now=") && a !== "--end-turn"))
    throw new Error("Only --file, --now and --end-turn are accepted; this command never mutates state.");
  const log = JSON.parse(fs.readFileSync(file,"utf8"));
  const plan = planContinuation(log,{now:nowArg?.slice(6)});
  const errors = args.includes("--end-turn") ? endOfTurnIssues(plan,log.coordination.continuation,
    log.coordination.continuation?.automation_readback || {}, {now:nowArg?.slice(6)}) : [];
  console.log(JSON.stringify({plan,end_turn_errors:errors},null,2));
  if (errors.length || (plan.phase === "STOP" && /INVALID|RECONCILE/.test(plan.reason))) process.exitCode=1;
}
module.exports = {planContinuation,pendingBinding,matchingReview,endOfTurnIssues};
