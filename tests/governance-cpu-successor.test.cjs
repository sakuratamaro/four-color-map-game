"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));

test("v7 additions map once without treating proposals as product implementation", () => {
  const intake = read("docs/BRAIN_V7_ADDITIVE_INTAKE_20260912.json");
  assert.equal(intake.package_id, "BRAIN-UPDATE-20260911-07");
  assert.equal(intake.zip_sha256, "1b4e19afd40b69b800a924318006614dcb65ece2260302efaf58578635bf7560");
  assert.equal(intake.records.length, 8);
  assert.equal(new Set(intake.records.map(r => r.id)).size, 8);
  for (const row of intake.records) {
    assert.equal(row.implementation_state, "not_started");
    assert.equal(row.release_state, "not_merged");
    assert.equal(row.integration_state, "mapped_by_existing_commander");
    assert.ok(row.canonical_udl_refs.length);
  }
  const progression = intake.records.find(r => r.id === "ADD-20260911-CPU-RECORD-DIALOGUE-STAGE");
  assert.deepEqual(progression.canonical_udl_refs, ["UDL-20260912-064"]);
  assert.equal(intake.records.find(r => r.id === "ADD-20260911-MATCH-LENGTH-FOUR-FIVE").intent_state, "user_requests_balance_review_not_color_change");
  const log = read("docs/CHATGPT_REVIEW_DECISIONS.json");
  const closed061 = [...log.coordination.completed_review_waits, log.coordination.wait_budget]
    .find(w => w.followup_subject_sha === "a757c126e1325532bb11a719cf92d0d13401d3ae");
  assert.equal(closed061.followup_status, "review_received_closed");
  assert.equal(closed061.next_check_utc, null);
  assert.equal(closed061.automatic_checks, 2);
  assert.equal(closed061.remaining_scheduled_slots, 0);
  assert.equal(closed061.expires_at_utc, "2026-09-12T02:24:00Z", "publication must not reset the original review deadline");
  assert.equal(closed061.followup_response_message_id, "c64ae754-9306-452b-83ad-0d9233eef7cc");
  const goal = log.coordination.next_goal;
  assert.equal(goal.actual_api_status, goal.actual_api_observation_history.at(-1).status,
    "current label must match the latest real goal API receipt, not a desired state");
  assert.equal(goal.actual_api_observation_history.at(-1).source, "get_goal");
  assert.equal(goal.actual_api_observation_history.some(r => r.status === "blocked"), true,
    "keep the prior blocked observation instead of rewriting history");
  assert.equal(goal.status, "COMPLETE", "original delivery audit is distinct from its last retained API observation");
  assert.equal(goal.completion_audit.complete, true);
  assert.equal(goal.completion_audit.later_v13_changes_not_complete, true);
  assert.equal(log.coordination.successor_goal.state, "F3_PUBLISHED_F1_IMPLEMENTATION_PENDING");
  const checkpoint = log.coordination.successor_goal.preparing_independent_slice;
  assert.equal(checkpoint.request_id, "UDL-20260910-051");
  assert.equal(checkpoint.publication, "NOT_RUN", "F1 is not implemented or released by the F3 result");
  assert.equal(checkpoint.state, "BASELINE_DIAGNOSED_IMPLEMENTATION_PENDING");
  assert.equal(checkpoint.regression_id,"REG-CPU-F1-PALETTE-WASTE");
  assert.equal(checkpoint.branch,"codex/cpu-palette-efficiency-20260913");
  assert.equal(log.coordination.successor_goal.completed_independent_slices.at(-1).publication,"PUBLIC_VERIFIED_SCOPED");
  assert.equal(checkpoint.checkpoint_sha, "d9ce111d7d97019d55b3e90842602001e045ea04");
  assert.equal(log.coordination.preparing_next_slice.candidate_sha,checkpoint.checkpoint_sha);
  assert.equal(log.coordination.preparing_next_slice.push_status,"PUSHED_EXACT_BRANCH");
  assert.equal(log.coordination.preparing_next_slice.managed_setting_change_set[0].activation_value,"standard-character-split-rescue-v1");
  assert.match(checkpoint.checkpoint_sha, /^[0-9a-f]{40}$/);
  const api = log.coordination.continuation.successor_goal_api_receipt.latest_observation;
  assert.equal(api.source, "get_goal");
  assert.equal(api.status, "active", "successor evidence must not rewrite the old goal history");
  assert.equal(log.coordination.remaining_brain_work.verified_zip_version, "v13");
  assert.equal(log.coordination.remaining_brain_work.unverified_zip_version, null);
  assert.equal(log.coordination.latest_implementation_instruction.state, "V13_VERIFIED_INTAKE_RECONCILIATION");
});

test("CPU baseline evidence records real defects and mirror control without claiming a fix", () => {
  const report = read("docs/CPU_SUCCESSOR_DIAGNOSIS_20260912.json");
  assert.equal(report.reproducedCount, 3);
  assert.match(report.scope, /not benchmark or live verification/);
  assert.equal(report.sourceGitBlobs["standard/standard-cpu.js"], "1269eebf065630c8cfb142ca2cd721280b411be2");
  assert.equal(report.findings.every(r => r.privacyUnchanged), true);
  const split = report.findings.find(r => r.id === "F3_SPLIT_ORIENTATION");
  assert.equal(split.characterId, "rei");
  assert.equal(split.selected.type, "SURRENDER");
  assert.equal(split.enumeratedSafeSide, false);
  assert.equal(split.splitThenColorThenOpponentReturnAccepted, true);
  assert.equal(report.findings.find(r => r.id === "F3_MIRROR_CONTROL").mirrorControlPassed, true);
});

test("current ledger uses canonical coarse states while CPU review and partial067 acceptance stay explicit", async () => {
  const {pathToFileURL}=require("node:url");
  const {auditDecisionLedger,parseDecisionLedger}=await import(pathToFileURL(path.join(__dirname,"../scripts/check-standard-decision-reconciliation.mjs")).href);
  const source=fs.readFileSync(path.join(__dirname,"../docs/PROJECT_COMMAND_CENTER.md"),"utf8");
  assert.equal(auditDecisionLedger(source).ok,true);
  const rows=parseDecisionLedger(source).rows;
  assert.equal(rows.find(r=>r.values.ID==="UDL-20260910-051").values.状態,"IMPLEMENTING");
  assert.equal(rows.find(r=>r.values.ID==="UDL-20260912-067").values.状態,"MERGED");
  const log=read("docs/CHATGPT_REVIEW_DECISIONS.json");
  assert.equal(log.coordination.active_slice.state,"PAGES_PUBLISHED_LIVE_ACCEPTANCE_PARTIAL");
  assert.equal(log.coordination.preparing_next_slice.review_status,"APPROVE_RELEASE");
});

test("genuine CPU036 and docs037 stay separate, bounded and exact after the first review read", () => {
  const log=read("docs/CHATGPT_REVIEW_DECISIONS.json");
  const {matchingReview,planContinuation}=require("../scripts/check-commander-continuation.cjs");
  const cpu=log.decisions.find(r=>r.review_id==="CHATGPT-REVIEW-20260913-036");
  const docs=log.decisions.find(r=>r.review_id==="CHATGPT-REVIEW-20260913-037");
  const slice=log.coordination.preparing_next_slice;
  assert.equal(matchingReview(log,slice),cpu);
  assert.equal(planContinuation(log).action,"CONTINUE_CPU_PALETTE_IMPLEMENTATION");
  assert.equal(cpu.decision,"APPROVE_RELEASE");
  assert.equal(cpu.source.message_id,"7f806672-5501-4673-8bc9-6f7626e08552");
  assert.equal(cpu.source.request_message_id,"c566e41e-1282-4603-8c56-1f3a46e2db9c");
  assert.equal(cpu.source.request_body_equality,true);
  assert.equal(cpu.source.verified_request_characters,6755);
  assert.equal(cpu.source.response_complete,true);
  assert.deepEqual(cpu.bounds,{profiles:1,matches:1,character_id:"rei",attempts:1,max_seconds:240,cpu_send_attempts:8,surrender_send_attempts:1,additional_matches:0,additional_profiles:0,economy_actions:0,deletions:0,privileged_room_recovery:false});
  assert.deepEqual(slice.live_canary_bounds,cpu.bounds);
  assert.equal(slice.live_canary_attempts,1);
  assert.equal(slice.publication,"PUBLIC_VERIFIED_SCOPED");
  assert.equal(slice.live_canary_state,"PASS_SINGLE_ATTEMPT_API_ONLY");
  assert.equal(docs.review_kind,"documentation_introduction");
  assert.equal(docs.decision,"APPROVE_DOCS");
  assert.deepEqual([docs.subject_sha,docs.base_sha,docs.spec_snapshot_sha],
    ["3930f3cf60519ae2f54bb015d96d52267007ff84","233a778249be91e2c379c05747a625593f28912f","5413c3a4e927b8091cdf796c38b31ba17d5d4951"]);
  assert.equal(docs.source.message_id,cpu.source.message_id);
  assert.equal(docs.source.request_message_id,cpu.source.request_message_id);
  assert.deepEqual(docs.db_change_set,[]);
  assert.deepEqual(docs.edge_change_set,[]);
  assert.equal((cpu.source.response_text+"\n---\n\n"+docs.source.response_text).length,4641);
  const forged=JSON.parse(JSON.stringify(slice));forged.review_id=docs.review_id;
  assert.equal(matchingReview(log,forged),null,"docs approval cannot authorize CPU release");
  const w=log.coordination.wait_budget;
  assert.equal(w.status,"review_received_closed");
  assert.equal(w.automatic_checks,1);
  assert.equal(w.expires_at_utc,"2026-09-12T22:24:15.000Z");
  assert.equal(w.next_check_utc,null);
  assert.equal(w.remaining_scheduled_slots,0);
  assert.deepEqual(w.consumed_slots_utc,["2026-09-12T20:44:15.000Z"]);
  assert.equal(w.check_receipts[0].reserved_before_api,true);
  assert.equal(w.check_receipts[0].supplementary_reads,0);
});

test("final play-surface live proof binds d6 and normal390 width while keeping physical NOT_RUN", () => {
  const report = read("docs/UI_PLAY_SURFACE_LIVE_20260912.json");
  assert.equal(report.candidateSha, "d6f745d3f1291457539dd2f3476e9a749a547069");
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 55);
  assert.equal(report.assetHashes.length, 5);
  assert.equal(report.profilesCreated, 1);
  assert.equal(report.matchesCreated, 1);
  assert.equal(report.explicitBrowserSkillActions, 1);
  assert.equal(report.cleanup, "TERMINAL_CONFIRMED_NO_DELETION");
  assert.equal(report.physicalDevices, "NOT_RUN");
  assert.equal(report.geometry.filter(r => r.viewport.width === 390).length, 2);
  assert.equal(report.geometry.filter(r => r.viewport.width === 390).every(r => r.board.width > 300 && r.fullBoardVisible), true);
  const log = read("docs/CHATGPT_REVIEW_DECISIONS.json");
  const approval = log.decisions.find(r => r.review_id === "CHATGPT-REVIEW-20260912-014");
  assert.equal(approval.decision, "APPROVE");
  assert.equal(approval.subject_sha, report.candidateSha);
  assert.equal(approval.source.message_id, "9b9b252a-2a5e-43b8-a9c8-20f6b87e9f1f");
  const closed = log.coordination.completed_review_waits.find(w => w.followup_subject_sha === report.candidateSha);
  assert.equal(closed.followup_status, "review_received_closed");
  assert.equal(closed.followup_response_message_id, approval.source.message_id);
  assert.equal(closed.expires_at_utc, "2026-09-11T22:17:19Z");
  assert.equal(closed.automatic_checks, 2, "a later independent wait must not reopen or reset the d6 budget");
});
