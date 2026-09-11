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
  assert.equal(log.coordination.next_goal.state, "ACTIVE");
  assert.match(log.coordination.successor_goal.state, /^QUEUED_AFTER_UI/);
  assert.equal(log.coordination.remaining_brain_work.verified_zip_version, "v7");
  assert.equal(log.coordination.remaining_brain_work.unverified_zip_version, "v8");
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
  assert.equal(log.coordination.automation_status_at_recording, "PAUSED");
});
