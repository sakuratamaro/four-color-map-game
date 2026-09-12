const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("v4-v6 intake is an additive provenance crosswalk, not implemented game acceptance", async () => {
  const intake = JSON.parse(read("docs/BRAIN_V4_V6_INTAKE_20260911.json"));
  const { parseDecisionLedger } = await import(pathToFileURL(path.join(root,
    "scripts/check-standard-decision-reconciliation.mjs")).href);
  const ids = new Set(parseDecisionLedger(read("docs/PROJECT_COMMAND_CENTER.md")).rows.map(row => row.values.ID));
  assert.equal(intake.kind, "intake_snapshot_not_operational_ledger");
  assert.equal(intake.records.length, 11);
  assert.equal(new Set(intake.records.map(row => row.id)).size, 11);
  assert.deepEqual(intake.packages.map(p => [p.record_count, p.unchanged_previous, p.new_ids.length]), [[20, 17, 3], [25, 20, 5], [28, 25, 3]]);
  for (const item of intake.records) {
    assert.ok(ids.has(item.canonical_id), item.id);
    assert.ok(item.source_quote && /^[0-9A-F]{64}$/.test(item.source.sha256));
    for (const field of ["intent_state", "implementation_state", "verification_state", "release_state"]) assert.ok(item[field]);
    assert.equal(item.new_acceptance_automated, false);
    assert.equal(item.release_state, "no_new_release_claim");
    for (const related of item.existing_related_tests) assert.ok(fs.existsSync(path.join(root, related)), related);
  }
  assert.equal(intake.records.filter(r => r.canonical_id === "UDL-20260910-051").length, 5);
  assert.equal(intake.records.find(r => r.id.endsWith("CORNER-NO-MICRO-REPEAT")).canonical_id, "UDL-20260908-029");
  assert.equal(intake.records.find(r => r.id.endsWith("REWARD-GACHA-LEVEL")).canonical_id, "UDL-20260911-059");
});

test("palette public receipt keeps live evidence and unfinished layout acceptance distinct", () => {
  const log = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json"));
  const done = log.coordination.completed_slices.find(row => row.candidate_sha === "ce6fab535235d7aff90d0bc846bbfb648c9a56e4");
  assert.equal(done.state, "PUBLIC_VERIFIED_ATTRIBUTE_IDENTIFICATION_ONLY");
  assert.equal(done.pages_run, "34554265788");
  assert.equal(done.physical_devices, "NOT_RUN");
  const wait = [...log.coordination.completed_review_waits, log.coordination.wait_budget]
    .find(row => row.subject_sha === done.candidate_sha);
  assert.equal(wait.status, "review_received_closed", "a later review must not reopen the palette wait");
  assert.equal(wait.response_message_id, done.review_response_message_id);
  assert.match(read(done.evidence), /30\/30 PASS/);
  assert.match(read(done.evidence), /UDL-054 remain unfinished/);
});

test("an active review wait stays bound to the delivered current candidate, not an earlier completed slice", () => {
  const { coordination: c } = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json"));
  const waitStatus = c.wait_budget.followup_status || c.wait_budget.status;
  if (waitStatus !== "review_pending" && waitStatus !== "delivery_unconfirmed_api_accepted_no_resend_while_active") return;
  const waitSubject = c.wait_budget.followup_subject_sha || c.wait_budget.subject_sha;
  const waitRequest = c.wait_budget.followup_request_message_id || c.wait_budget.root_request_message_id;
  const matches = [c.active_slice, c.preparing_next_slice].filter(s => s?.candidate_sha === waitSubject);
  assert.equal(matches.length, 1, "the pending review resolves exactly one existing slice");
  const pendingSlice = matches[0];
  if (waitStatus === "delivery_unconfirmed_api_accepted_no_resend_while_active") {
    assert.equal(c.pending_delivery_status, "SEND_API_ACCEPTED_READBACK_UNCONFIRMED_ACTIVE_NO_RESEND");
    assert.equal(c.wait_budget.followup_subject_sha ? c.wait_budget.followup_request_message_id : c.wait_budget.root_request_message_id, null, "do not invent a delivery ID");
    assert.equal(pendingSlice.review_request_message_id, null);
    assert.equal(pendingSlice.review_send_attempts, 1);
    assert.equal(pendingSlice.review_delivery_readback_checks, 2);
    assert.equal(pendingSlice.review_status, "DELIVERY_UNCONFIRMED");
    assert.equal(c.wait_budget.confirmed_delivery_reminders, 0);
    assert.equal(c.wait_budget.reset_on_candidate_revision, false);
    assert.equal(Date.parse(c.wait_budget.expires_at_utc) - Date.parse(c.wait_budget.started_at_utc), 120 * 60_000);
  } else {
    assert.equal(c.wait_budget.followup_status || c.wait_budget.status, "review_pending");
    assert.equal(c.pending_delivery_status, "delivery_verified_response_pending");
    assert.ok(c.self_sent_message_ids.includes(waitRequest));
    assert.equal(c.last_confirmed_sent_message_id, waitRequest);
  }
  assert.equal(c.pending_subject_sha, pendingSlice.candidate_sha);
  assert.equal(waitSubject, pendingSlice.candidate_sha);
  assert.equal(c.pending_review_subject.subject_sha, pendingSlice.candidate_sha);
  assert.equal(c.pending_review_subject.base_sha, pendingSlice.base_sha);
  assert.equal(c.pending_review_subject.spec_snapshot_sha, pendingSlice.spec_snapshot_sha);
  assert.equal(c.pending_review_subject.feature_spec_version, pendingSlice.spec_version);
  assert.equal(c.pending_review_subject.scope, c.pending_scope);
  assert.equal(c.automation_prompt_readback_equal, true);
  assert.equal(c.completed_review_waits.some(row => row.root_request_message_id === c.wait_budget.root_request_message_id), false);
});

test("quiz reward release traces exact review and public behavior while retaining failed attempts", () => {
  const log = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json"));
  const done = log.coordination.completed_slices.find(row => row.id === "UDL-20260911-059");
  const review = log.decisions.find(row => row.review_id === done.review_id);
  const evidence = JSON.parse(read(done.evidence_json));
  assert.equal(done.state, "PUBLIC_VERIFIED_QUIZ_REWARD_LEVEL_NAVIGATION");
  assert.equal(done.candidate_sha, review.subject_sha);
  assert.equal(done.main_sha, review.subject_sha);
  assert.equal(done.spec_snapshot_sha, review.spec_snapshot_sha);
  assert.equal(done.review_response_message_id, "bbc180c1-1cdb-4754-b53b-71eec1e11895");
  assert.equal(done.pages_run, "34562271949");
  assert.equal(evidence.candidate_sha, done.candidate_sha);
  assert.equal(evidence.pages_run, done.pages_run);
  assert.equal(evidence.attempts.length, 4);
  assert.deepEqual(evidence.attempts.map(row => row.ok), [false, false, false, true]);
  assert.equal(evidence.attempts.reduce((sum, row) => sum + row.profilesCreated, 0), 4);
  const final = evidence.attempts.at(-1);
  assert.equal(final.checks.length, 22);
  assert.equal(final.faultInjection, "NONE");
  assert.deepEqual(final.operationCounts, { "quiz-start": 1, "quiz-answer": 10, "quiz-finish": 1, gacha: 1 });
  assert.ok(final.operationResponses.every(row => row.status === 200));
  assert.equal(final.reward.ticketLevel, 1, "live reward level is observed, not relabeled as the Lv2 fixture");
  assert.equal(done.physical_devices, "NOT_RUN");
  assert.equal(evidence.public_preflight.ok, true);
  assert.match(read(done.evidence), /22\/22 PASS/);
  const wait = [...log.coordination.completed_review_waits, log.coordination.wait_budget]
    .find(row => row.subject_sha === done.candidate_sha);
  assert.equal(wait.status, "review_received_closed");
  assert.equal(wait.response_message_id, review.source.message_id);
});

test("v8 paired intake preserves withdrawal, canonical reuse and unimplemented successor scope", async () => {
  const intake = JSON.parse(read("docs/BRAIN_V8_PAIRED_INTAKE_20260912.json"));
  assert.equal(intake.kind, "intake_snapshot_not_operational_ledger");
  assert.equal(intake.source.user_message_id, "bbb21715-8ab0-4dfb-ad2f-b46883434765");
  assert.equal(intake.source.response_message_id, "c1c1a98e-749e-42ec-8a95-2ef30abd5035");
  const { parseDecisionLedger } = await import(pathToFileURL(path.join(root,
    "scripts/check-standard-decision-reconciliation.mjs")).href);
  const ids = new Set(parseDecisionLedger(read("docs/PROJECT_COMMAND_CENTER.md")).rows.map(r => r.values.ID));
  assert.equal(intake.records.length, 7);
  assert.equal(intake.source.zip_status, "ZIP_RECEIVED_HASH_AND_MANIFEST_VERIFIED");
  assert.equal(intake.source.package.sha256, "CC27C090BFEE5F69A66AA32BC84ED32771A8655D876602ACF077151F0B35587B");
  assert.equal(intake.source.package.bytes, 522675);
  assert.equal(intake.zip_aliases.length, 7);
  assert.equal(new Set(intake.zip_aliases.map(row => row.zip_id)).size, 7);
  for (const row of intake.zip_aliases) for (const id of row.canonical_ids) assert.ok(ids.has(id), id);
  assert.deepEqual(intake.zip_aliases.find(row => row.zip_id.endsWith("COSMETIC-DIRECT-CHECKOUT")).canonical_ids, ["UDL-20260912-061"]);
  for (const row of intake.records) {
    assert.ok(row.source_quote && row.design_summary);
    for (const id of row.canonical_ids) assert.ok(ids.has(id), id);
    assert.equal(row.new_acceptance_automated, false);
    assert.equal(row.implementation_state, "not_started");
    assert.equal(row.verification_state, "not_run");
  }
  assert.match(intake.records[1].source_quote, /色ごとに位置固定は撤回/);
  assert.deepEqual(intake.records[1].canonical_ids, ["UDL-20260910-052"]);
});

test("shared canon entrypoint routes to the existing authorities", () => {
  const agents = read("AGENTS.md");
  const canon = read("docs/SHARED_CANON.md");
  for (const relativePath of [
    "docs/PROJECT_COMMAND_CENTER.md",
    "docs/STANDARD_MODE_SPEC.md",
    "docs/STANDARD_RELEASE_EVIDENCE.md",
    "docs/STANDARD_PUBLIC_RELEASE_RUNBOOK.md",
    "docs/WORKTREE_HYGIENE_INVENTORY.md",
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
    assert.match(canon, new RegExp(relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(agents, /docs\/SHARED_CANON\.md/);
  assert.match(canon, /shared-canon-v1\.1/);
  assert.match(canon, /2f855ccfef11d7c099cfb73fb57ec3da79be8789/);
});

test("imported request aliases keep provenance and four independent state dimensions", () => {
  const index = JSON.parse(read("docs/SHARED_CANON_REQUEST_INDEX.json"));
  assert.equal(index.kind, "imported_request_crosswalk_not_second_ledger");
  assert.equal(index.requests.length, 28);
  assert.equal(new Set(index.requests.map(({ id }) => id)).size, 28);
  for (const request of index.requests) {
    assert.match(request.id, /^REQ-\d{8}-\d{3}$/);
    assert.ok(index.sources[request.source]);
    for (const field of [
      "intent_state",
      "implementation_state",
      "verification_state",
      "release_state",
    ]) {
      assert.equal(typeof request[field], "string", `${request.id}.${field}`);
      assert.notEqual(request[field].length, 0, `${request.id}.${field}`);
    }
    for (const testPath of request.tests) {
      assert.equal(fs.existsSync(path.join(root, testPath)), true, `${request.id}: ${testPath}`);
    }
  }
});

test("representative corner-bloom trace stays candidate-only", () => {
  const index = JSON.parse(read("docs/SHARED_CANON_REQUEST_INDEX.json"));
  const request = index.requests.find(({ id }) => id === "REQ-20260906-008");
  assert.ok(request);
  assert.deepEqual(request.udl_refs, ["UDL-20260908-029"]);
  assert.equal(request.implementation_state, "implemented_candidate");
  assert.equal(request.verification_state, "windows_gate_pass");
  assert.equal(request.release_state, "not_merged");
  assert.ok(request.evidence.includes("candidate 98bad1d"));
  assert.ok(request.evidence.includes("Windows 34447976952"));
});

test("first incoming Astra request is provenance-bound and remains unimplemented", () => {
  const index = JSON.parse(read("docs/SHARED_CANON_REQUEST_INDEX.json"));
  assert.equal(index.incoming_requests.length, 1);
  const request = index.incoming_requests[0];
  assert.equal(request.id, "REQ-CPU-20260910-KUROGANE-STRENGTH");
  assert.deepEqual(request.udl_refs, ["UDL-20260910-051"]);
  assert.equal(request.implementation_state, "not_started");
  assert.equal(request.release_state, "not_merged");
  const source = index.sources[request.source];
  assert.equal(source.chatgpt_thread_id, "6aa229e7-e098-83ee-ac5e-d366a12653a4");
  assert.equal(source.artifact_sha256, "B0E5B9DDE10D3B913A1B9BDB7EC50C8963D9F16F333E6423EF01E8962D424A93");
  assert.match(read("docs/PROJECT_COMMAND_CENTER.md"), /UDL-20260910-051/);
});

test("illustration handoff reuses UDL033 without inventing permissions or completed replacement", async () => {
  const intake = JSON.parse(read("docs/CPU_ILLUSTRATION_INTAKE_20260911.json"));
  assert.equal(intake.kind, "intake_snapshot_not_operational_ledger");
  assert.equal(intake.canonical_id, "UDL-20260908-033");
  assert.equal(intake.source.thread_id, "6aa364fd-b598-83ee-8d71-ba37dbcae648");
  assert.equal(intake.source.user_message_id, "bbb21389-6f9d-4690-bb88-499547529b83");
  assert.equal(intake.source.response_message_id, "96e97c41-9676-414e-aac8-2a2c49bbf04d");
  assert.equal(intake.source.user_text, "変更してほしいなー");
  assert.equal(intake.source.readback, "FULL_COMPLETED_PAIR_VERIFIED");
  assert.match(intake.source_response_text, /最新公開版の交換状況についての断定は撤回/);
  assert.equal(intake.rights_verification.state, "NOT_VERIFIED");
  assert.equal(intake.author_contact.allowed, false);
  assert.equal(intake.author_contact.user_handles_email, true);
  assert.equal(intake.authority_reconciliation.is_game_release_approval, false);
  assert.notEqual(intake.source.thread_id, intake.authority_reconciliation.designated_release_reviewer_thread_id);
  assert.equal(intake.new_material_acceptance_automated, false);
  for (const related of intake.existing_related_tests) assert.ok(fs.existsSync(path.join(root, related)));
  const { parseDecisionLedger } = await import(pathToFileURL(path.join(root,
    "scripts/check-standard-decision-reconciliation.mjs")).href);
  const rows = parseDecisionLedger(read("docs/PROJECT_COMMAND_CENTER.md")).rows
    .filter(row => row.values.ID === intake.canonical_id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].values.状態, "DECIDED");
  assert.equal(rows[0].values.main統合, "NO");
  assert.equal(rows[0].values.Pages, "NO");
});

test("latest user artwork decision supersedes the old publication hold without inventing author permission", async () => {
  const { coordination: c } = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json"));
  const decision = c.successor_goal.artwork_publication_decision;
  const intake = JSON.parse(read("docs/CPU_ILLUSTRATION_INTAKE_20260911.json"));
  assert.equal(c.successor_goal.rights_state, "USER_AUTHORIZED_GAME_RUNTIME_ASSETS_NO_PRERELEASE_AUTHOR_WAIT");
  assert.equal(decision.decision_id, "ARTWORK-USER-20260912-033");
  assert.equal(decision.request_id, intake.canonical_id);
  assert.equal(decision.state, "ADOPTED");
  assert.equal(decision.source.kind, "direct_user_message");
  assert.equal(decision.source.thread_id, c.successor_goal.owner_thread_id);
  assert.match(decision.source.quote, /公開後ぼくから作者にメール/);
  assert.equal(decision.public_repository, "sakuratamaro/four-color-map-game");
  assert.equal(decision.game_runtime_assets_publication_authorized, true);
  assert.equal(decision.prerelease_author_confirmation_required, false);
  assert.equal(decision.repeat_user_confirmation_on_same_facts, false);
  assert.equal(decision.reopen_old_public_repository_hold, false);
  assert.equal(decision.author_permission_obtained, false);
  assert.deepEqual(decision.author_contact, { owner: "user", timing: "after_publication", ai_contact_authorized: false });
  assert.equal(decision.is_exact_candidate_astra_release_approval, false);
  assert.ok(decision.excluded_scope.includes("original_download_zip"));
  assert.ok(decision.excluded_scope.includes("unused_expression_pack"));
  assert.ok(decision.excluded_scope.includes("private_Q10_attachment_forwarding"));
  assert.equal(intake.subsequent_decision_ref.decision_id, decision.decision_id);
  assert.equal(intake.rights_verification.state, "NOT_VERIFIED", "keep the historical intake evidence, not its old operational hold");
  assert.equal(decision.publication_state, "NOT_RUN", "recording user authority is not publication evidence");
  assert.match(read(decision.evidence), /公開前の作者確認では止めない。公開後のメールはユーザーが行う/);
  const { parseDecisionLedger } = await import(pathToFileURL(path.join(root,
    "scripts/check-standard-decision-reconciliation.mjs")).href);
  const row = parseDecisionLedger(read("docs/PROJECT_COMMAND_CENTER.md")).rows
    .find(row => row.values.ID === decision.request_id);
  assert.ok(row);
  assert.match(JSON.stringify(row.values), /ARTWORK-USER-20260912-033/);
  assert.match(JSON.stringify(row.values), /公開前の作者確認では止めない/);
});

test("ChatGPT review records require an exact subject and cannot imply production approval", () => {
  const log = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json"));
  assert.equal(log.rules.silence_is_approval, false);
  assert.equal(log.rules.codex_self_approval, false);
  assert.equal(log.rules.cross_ai_substitution, false);
  assert.equal(log.rules.documentation_approval_is_game_release_approval, false);
  for (const decision of log.decisions) {
    for (const field of ["review_id", "review_kind", "subject_sha", "canon_version", "base_sha", "spec_snapshot_sha", "db_change_set", "edge_change_set", "scope", "decision", "source"]) {
      assert.ok(decision[field], field);
    }
    if (decision.review_kind === "documentation_introduction") {
      assert.notEqual(decision.decision, "APPROVE_RELEASE");
      assert.equal(decision.scope, "documentation_introduction");
    } else {
      if (decision.review_id === "CHATGPT-REVIEW-20260912-022") {
        assert.equal(decision.review_kind, "public_acceptance_supplement");
        assert.equal(decision.decision, "APPROVE_BOUNDED_ACCEPTANCE");
        assert.deepEqual(decision.bounds, {additional_profiles:1,attempts:1,max_seconds:180,matches:0,economy_actions:0,deletions:0});
      } else if (decision.review_id === "CHATGPT-REVIEW-20260913-030") {
        assert.equal(decision.review_kind, "public_acceptance_supplement");
        assert.equal(decision.decision, "APPROVE_BOUNDED_ACCEPTANCE");
        assert.deepEqual(decision.bounds, {additional_profiles:0,accounts:0,matches:0,attempts:1,max_seconds:90,economy_actions:0,deletions:0});
        assert.equal(decision.source.message_id, "8adbfdb6-2d36-4f20-8958-8fe4dd7d6450");
        assert.equal(decision.source.request_message_id, "9ff538bc-db7a-4b1e-a73a-9ab0a4a75768");
      } else if (decision.review_id === "CHATGPT-REVIEW-20260913-028") {
        assert.equal(decision.review_kind, "public_acceptance_supplement");
        assert.equal(decision.decision, "APPROVE_BOUNDED_ACCEPTANCE");
        assert.deepEqual(decision.bounds, {additional_profiles:1,attempts:1,max_seconds:240,matches:1,cpu_actions:24,own_actions:9,economy_actions:0,deletions:0});
        assert.equal(decision.source.message_id, "0398f396-109f-485c-9add-9950421fc477");
        assert.equal(decision.source.request_message_id, "1b0193a0-02b0-4500-807f-0e5f2e6ae52f");
      } else if (decision.review_id === "CHATGPT-REVIEW-20260913-032") {
        assert.equal(decision.review_kind, "public_acceptance_disposition");
        assert.equal(decision.decision, "ACCEPT");
        assert.equal(decision.evidence_sha, "4d1301236e7fbf16d9caaf581f2b6f94d372f05c");
        assert.equal(decision.source.message_id, "fa226fa2-ad5e-437c-a447-3a6c84fcd2c1");
        assert.equal(decision.source.request_message_id, "f5646b27-8424-405f-95a7-a21c87b09274");
      } else if (decision.review_id === "CHATGPT-REVIEW-20260912-024") {
        assert.equal(decision.review_kind, "public_acceptance_disposition");
        assert.equal(decision.decision, "ACCEPT");
        assert.equal(decision.evidence_sha, "77080770757deae155d153583ab134c20d53e5a5");
        assert.equal(decision.source.message_id, "b8f091ec-3669-45e4-ab62-a4a5a508c20a");
        assert.equal(decision.source.request_message_id, "b39fb94d-9d9c-4349-9663-0233256beb92");
        assert.equal(decision.source.request_body_equality, true);
      } else {
        assert.equal(decision.review_kind, "game_production_release_approval");
      }
      assert.equal(decision.source.kind, "chatgpt");
      assert.equal(decision.source.thread_id, "6aa229e7-e098-83ee-ac5e-d366a12653a4");
      assert.ok(decision.source.message_id && decision.source.request_message_id);
      assert.match(decision.subject_sha, /^[0-9a-f]{40}$/);
      assert.match(decision.spec_snapshot_sha, /^[0-9a-f]{40}$/);
      const bindings = {
        "CHATGPT-REVIEW-20260913-034": ["f507c0b2dd9701f3ac1867131150b5e48d0ada8d", "2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152", "UDL-067-surrender-v1.1", "1e7e2a4c02acd58ed40ca0b6f2fbb0513f333463", "Pages_only"],
        "CHATGPT-REVIEW-20260913-033": ["23133ef52efb81c39d0623479b0ea7819f850f7d", "2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152", "UDL-067-surrender-v1", "e5f2c0617d3defcc8dc6105bf567f6ed59fb4432", "Pages_only"],
        "CHATGPT-REVIEW-20260913-032": ["2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152", "9515f9bed9536dc2c44b71817129abb9c86ef24f", "UDL-066-catalog-v1", "9aa1c780aac6b394bf1ee622cc2ba10297b6bab1", "post_publication_bounded_acceptance"],
        "CHATGPT-REVIEW-20260913-031": ["8fe4c206547851550de7b4b59c0eb82241ba3060", "2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152", "UDL-067-surrender-v1", "e5f2c0617d3defcc8dc6105bf567f6ed59fb4432", "Pages_only"],
        "CHATGPT-REVIEW-20260913-030": ["2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152", "9515f9bed9536dc2c44b71817129abb9c86ef24f", "UDL-066-catalog-v1", "9aa1c780aac6b394bf1ee622cc2ba10297b6bab1", "post_publication_bounded_acceptance"],
        "CHATGPT-REVIEW-20260913-029": ["2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152", "9515f9bed9536dc2c44b71817129abb9c86ef24f", "UDL-066-catalog-v1", "9aa1c780aac6b394bf1ee622cc2ba10297b6bab1", "Pages_only"],
        "CHATGPT-REVIEW-20260913-027": ["9515f9bed9536dc2c44b71817129abb9c86ef24f", "3b1d4e65197c476686b7b8a13c49f97ffd591e68", "UDL-023-entrance-v2", "630964f0af6956ff544d0209ba55209f6ba7d317", "Pages_only"],
        "CHATGPT-REVIEW-20260913-028": ["3b1d4e65197c476686b7b8a13c49f97ffd591e68", "a1a9b1c830eceb98464b107f2442deacaf765505", "UDL-065-cutin-v1.1", "40410ee0cc5dee8ca2a46281c54e504c8c01a15f", "post_publication_bounded_acceptance"],
        "CHATGPT-REVIEW-20260912-025": ["be52f755b813e8a6de58529eb2a39065ffc63623", "a1a9b1c830eceb98464b107f2442deacaf765505", "UDL-065-cutin-v1", "ee8c6c5c699e1083c6f8bb2780a4fccd6e599f9e", "Pages_only"],
        "CHATGPT-REVIEW-20260913-026": ["3b1d4e65197c476686b7b8a13c49f97ffd591e68", "a1a9b1c830eceb98464b107f2442deacaf765505", "UDL-065-cutin-v1.1", "40410ee0cc5dee8ca2a46281c54e504c8c01a15f", "Pages_only"],
        "CHATGPT-REVIEW-20260912-024": ["a1a9b1c830eceb98464b107f2442deacaf765505", "a757c126e1325532bb11a719cf92d0d13401d3ae", "UDL-062-copy-v1.1", "5481afd8c2b9ff5354bba0e671615c97fb8ceef7", "Pages_only"],
        "CHATGPT-REVIEW-20260912-022": ["a1a9b1c830eceb98464b107f2442deacaf765505", "a757c126e1325532bb11a719cf92d0d13401d3ae", "UDL-062-copy-v1.1", "5481afd8c2b9ff5354bba0e671615c97fb8ceef7", "post_publication_read_only_acceptance"],
        "CHATGPT-REVIEW-20260912-020": ["a1a9b1c830eceb98464b107f2442deacaf765505", "a757c126e1325532bb11a719cf92d0d13401d3ae", "UDL-062-copy-v1.1", "5481afd8c2b9ff5354bba0e671615c97fb8ceef7", "Pages_only"],
        "CHATGPT-REVIEW-20260912-019": ["6f8aeab0cbdfe9e013541f5cf30e16c93fb18cd3", "a757c126e1325532bb11a719cf92d0d13401d3ae", "UDL-062-copy-v1", "9a3488f3b7e5d2c94666a64529a679bc863d8171", "Pages_only"],
        "CHATGPT-REVIEW-20260912-018": ["a757c126e1325532bb11a719cf92d0d13401d3ae", "b81a1d52e8230d41ec9e69610d89bafc86d1d84e", "UDL-061-cosmetics-v1.1", "12eb7874f69b5c707104de79a2b631ac55aff345", "Pages_only"],
        "CHATGPT-REVIEW-20260912-017": ["0b5d0b2ea7ab510ce107bfc2477e2e275f9a9125", "b81a1d52e8230d41ec9e69610d89bafc86d1d84e", "UDL-061-cosmetics-v1", "ebb2229705f4b7e075b97e315b789198ee84126c", "Pages_only"],
        "CHATGPT-REVIEW-20260912-016": ["b81a1d52e8230d41ec9e69610d89bafc86d1d84e", "d6f745d3f1291457539dd2f3476e9a749a547069", "UDL-060-result-v1.1", "54cd9c8a945fcc84dff1354733fad6a32cc5624a", "Pages_only"],
        "CHATGPT-REVIEW-20260912-015": ["ccc9e91e0d1fecb74ce693b15d324c375671f8a1", "d6f745d3f1291457539dd2f3476e9a749a547069", "UDL-060-result-v1", "191a69d0db1b3cfa47521ff70d2a577f7b046213", "Pages_only"],
        "CHATGPT-REVIEW-20260912-014": ["d6f745d3f1291457539dd2f3476e9a749a547069", "93c05c7c68576b28a126588d0716f0f56c015531", "UDL-052-054-063-play-v1.2", "5a63468c8f75d777cafcb6de7fec19e4048d0f5b", "Pages_only"],
        "CHATGPT-REVIEW-20260912-013": ["6cd12ae888f26c9403fb504596f92f4d9a65b301", "93c05c7c68576b28a126588d0716f0f56c015531", "UDL-052-054-063-play-v1", "67d52446047eafb6a6c32e38e8e7c9538aea88b4", "Pages_only"],
        "CHATGPT-REVIEW-20260912-012": ["93c05c7c68576b28a126588d0716f0f56c015531", "a26ffd14a8f896d9d087dac032d8f079ece82f7d", "UDL-023-entrance-v1.1", "dd839a5424fc13ecd9d6b604023666b1996cbd76", "Pages_only"],
        "CHATGPT-REVIEW-20260912-011": ["a9b2ff984c448819483286eae5acfa91530fc5db", "a26ffd14a8f896d9d087dac032d8f079ece82f7d", "UDL-023-entrance-v1", "d5c0f6e8b6de875d844eaf9bd8c154e281472952", "Pages_only"],
        "CHATGPT-REVIEW-20260912-010": ["a26ffd14a8f896d9d087dac032d8f079ece82f7d", "a6c24f496338412a7cb4e933b0faba06cb28ccce", "UDL-048-memo-v1.1", "347b31327c14937530b019a4eb36b9a9e22d5a30", "Pages_only"],
        "CHATGPT-REVIEW-20260912-009": ["a6c24f496338412a7cb4e933b0faba06cb28ccce", "f8713d7006da0619b9c356d53a472754833fb910", "UDL-048-memo-v1", "3182edb815f723039ceacb41ae00e5e05391ee93", "Pages_only"],
        "CHATGPT-REVIEW-20260910-004": ["2e5e1d050adb60640454a17281b989e0af642df0", "2f855ccfef11d7c099cfb73fb57ec3da79be8789", "UDL-055-v1", "f6d3c85f7d30e599f1ea1682516a5776fbc24899", "Pages-only game bugfix"],
        "CHATGPT-REVIEW-20260910-005": ["5c03e6c2d0e94c843776ea7eae0d7bbe2917a174", "2f855ccfef11d7c099cfb73fb57ec3da79be8789", "UDL-055-v1", "f6d3c85f7d30e599f1ea1682516a5776fbc24899", "Pages-only game bugfix"],
        "CHATGPT-REVIEW-20260911-007": ["ce6fab535235d7aff90d0bc846bbfb648c9a56e4", "5c03e6c2d0e94c843776ea7eae0d7bbe2917a174", "UDL-052-roles-v1", "5652a3f41caa453c67cb69fbe80a7a14a6a5c2ef", "Pages_only"],
        "CHATGPT-REVIEW-20260911-008": ["f8713d7006da0619b9c356d53a472754833fb910", "ce6fab535235d7aff90d0bc846bbfb648c9a56e4", "UDL-059-quiz-v1", "d548792499924e84709957750dabdd5106d9f99a", "Pages_only"],
      };
      assert.ok(bindings[decision.review_id], "each genuine review needs an explicit exact binding");
      assert.deepEqual([decision.subject_sha, decision.base_sha, decision.feature_spec_version,
        decision.spec_snapshot_sha, decision.scope], bindings[decision.review_id]);
      assert.deepEqual(decision.db_change_set, []);
      assert.deepEqual(decision.edge_change_set, []);
    }
  }
});

test("UDL062 exhausted bounded retry preserves both failures and records all final outcomes", () => {
  const log = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json"));
  const slice = log.coordination.completed_slices.find(item => item.id === "UDL-20260912-062");
  const original = JSON.parse(read("docs/UI_PLAYER_COPY_LIVE_20260912.json"));
  const retry = JSON.parse(read("docs/UI_PLAYER_COPY_RETRY_LIVE_20260912.json"));
  assert.equal(original.ok, false);
  assert.equal(original.checks.length, 52);
  assert.equal(retry.ok, false);
  assert.equal(retry.candidate, "a1a9b1c830eceb98464b107f2442deacaf765505");
  assert.equal(retry.checks.length, 54);
  assert.deepEqual(retry.finalChecks.map(item => item.passed), [false, true, true]);
  assert.deepEqual(retry.serverComparison, {equal:false,sameRevision:true,sameDisplayName:false,sameProfileState:true});
  assert.equal(original.profilesCreated + retry.profilesCreated, 2);
  for (const key of ["matchesCreated", "gameEconomyActions", "browserNonReadRequests", "deletions"])
    assert.equal(retry[key], 0, key);
  assert.equal(slice.live_acceptance.new_profile_retry_authorized, false);
  assert.equal(slice.live_acceptance_followup.attempts_started, 1);
  assert.equal(slice.live_acceptance_followup.state, "FAILED_ONE_AUTHORIZED_RETRY_CONSUMED");
  assert.equal(slice.state, "PUBLIC_VERIFIED");
  assert.equal(slice.public_acceptance_disposition.review_id, "CHATGPT-REVIEW-20260912-024");
  assert.equal(slice.public_acceptance_disposition.raw_canary_ok, false);
  assert.equal(slice.public_acceptance_disposition.raw_checks, "54/55");
  assert.equal(slice.public_acceptance_disposition.unresolved_issue_id, "REG-20260912-PROFILE-RESPONSE-CONTRACT-01");
  assert.equal(log.decisions.find(item => item.review_id === "CHATGPT-REVIEW-20260912-023").decision, "APPROVE_DOCS");
});

test("v13 delta is verified, source-bound and does not duplicate repeated requests or infer screenshot details", () => {
  const data = JSON.parse(read("docs/BRAIN_V13_DELTA_INTAKE_20260912.json"));
  assert.equal(data.kind, "dated_delta_crosswalk_not_second_ledger");
  assert.equal(data.records.length, 16);
  assert.equal(data.preserved_records + data.records.length, 59);
  assert.equal(new Set(data.records.map(r => r.alias)).size, 16);
  for (const record of data.records) {
    assert.ok(record.canonical_ids.length);
    assert.match(record.source_message_id, /^[0-9a-f-]{36}$/);
    assert.equal(record.historical_publication_is_not_new_acceptance, true);
  }
  const cutin = data.records.find(r => r.alias === "ADD-20260912-SKILL-CUTIN-PRIORITY");
  assert.deepEqual(cutin.canonical_ids, ["UDL-20260912-065"]);
  assert.equal(new Set([cutin.source_message_id,...cutin.independent_repeat_message_ids]).size, 2);
  assert.equal(data.repeat_priority.latest_withdrawals_override_old_repeat_counts, true);
  assert.equal(data.pending_screenshot_memo.inferred_requests, 0);
  assert.equal(data.pending_screenshot_memo.private_image_bytes_published, false);
  const s = data.records.filter(r => r.alias.includes("SURRENDER"));
  assert.equal(s.length, 2);
  assert.equal(new Set(s.flatMap(r => r.canonical_ids)).size, 1);
});

test("UDL048 closure preserves the initial visual failure and binds the final public evidence", () => {
  const log = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json"));
  const slice = log.coordination.completed_slices.find((item) => item.id === "UDL-20260910-048");
  const live = JSON.parse(read("docs/QUIZ_MEMO_FOLLOWUP_LIVE_20260912.json"));
  const initial = JSON.parse(read("docs/QUIZ_MEMO_LIVE_20260912.json"));
  assert.equal(slice.candidate_sha, "a26ffd14a8f896d9d087dac032d8f079ece82f7d");
  assert.equal(live.candidateSha, slice.candidate_sha);
  assert.equal(slice.state, "PUBLIC_VERIFIED");
  assert.equal(slice.windows_status, "SUCCESS");
  assert.equal(slice.windows_jobs.every((job) => job.status === "SUCCESS"), true);
  assert.equal(slice.pages_run, "34631861134");
  assert.equal(live.ok, true);
  assert.equal(live.checks.length, 38);
  assert.equal(live.visual_inspection.status, "PASS_PORTRAIT_AND_DESKTOP");
  assert.equal(initial.visual_inspection.status, "FAIL_PORTRAIT_QUESTION_OFFSCREEN");
  assert.equal(live.physicalDevices, "NOT_RUN");
});

test("finite wait policy records a non-resetting three-check two-hour deadline and real pause evidence", () => {
  const log = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json"));
  const budget = log.coordination.wait_budget;
  assert.equal(budget.max_automatic_checks, 3);
  assert.equal(budget.max_age_minutes, 120);
  assert.deepEqual(budget.offset_minutes, [20, 40, 100]);
  assert.equal(Date.parse(budget.expires_at_utc) - Date.parse(budget.started_at_utc), 120 * 60_000);
  assert.equal(budget.reset_on_candidate_revision, false);
  assert.equal(budget.reset_on_restart_or_unrelated_message, false);
  assert.equal(budget.confirmed_delivery_reminders, 0);
  assert.ok(budget.automatic_checks <= budget.max_automatic_checks);
  assert.match(read("docs/CHATGPT_COLLABORATION_OPERATION.md"), /updated_at=1789050322147/);
  // This validates the saved policy/evidence, not a future scheduler execution.
});

test("palette addendum reuses canonical IDs and keeps design and numeric proposals unapproved", async () => {
  const intake = JSON.parse(read("docs/REQUEST_ADDENDUM_20260910_PALETTE.json"));
  const { parseDecisionLedger } = await import(pathToFileURL(path.join(root,
    "scripts/check-standard-decision-reconciliation.mjs")).href);
  const ledger = parseDecisionLedger(read("docs/PROJECT_COMMAND_CENTER.md"));
  const ids = new Set(ledger.rows.map((row) => row.values.ID));
  assert.equal(intake.kind, "intake_snapshot_not_operational_ledger");
  assert.equal(intake.records.length, 7);
  assert.equal(new Set(intake.records.map((row) => row.id)).size, 7);
  assert.equal(intake.source.user_message_id, "03751588-f991-4bd6-84bf-578e76949808");
  assert.equal(intake.source.artifact_sha256, "7D6E0B050DE3E6391A56A2372F7ED7FF336BC7DC5FAD2F180B02252C5CA180CE");
  for (const row of intake.records) {
    assert.ok(ids.has(row.canonical_id), row.id);
    for (const field of ["source_quote", "intent_state", "implementation_state", "verification_state", "release_state"]) {
      assert.ok(typeof row[field] === "string" && row[field].length > 0, `${row.id}.${field}`);
    }
    for (const testPath of row.tests_existing_related ?? []) {
      assert.ok(fs.existsSync(path.join(root, testPath)), testPath);
    }
  }
  const byId = Object.fromEntries(intake.records.map((row) => [row.id, row]));
  assert.equal(byId["ADD-20260910-PALETTE-01"].canonical_id, byId["ADD-20260910-PALETTE-02"].canonical_id);
  assert.equal(byId["ADD-20260910-PALETTE-02"].user_approved_design, false);
  assert.equal(byId["ADD-20260910-GACHA-01"].adopted_lv2_star4_percent, null);
  assert.equal(byId["ADD-20260910-SKILL-01"].canonical_id, "UDL-20260906-010");
  assert.equal(byId["ADD-20260910-RULE-01"].intent_state, "answered_no_rule_change");
});

test("binding checker rejects stale, cross-scope, missing, and substitute-AI approvals", async () => {
  const { auditChatgptReviewBinding } = await import(pathToFileURL(path.join(root,
    "scripts/check-standard-decision-reconciliation.mjs")).href);
  // Synthetic approval is only a fixture, never an entry in the real review log.
  const subject = {
    subject_sha: "a".repeat(40), base_sha: "b".repeat(40), spec_snapshot_sha: "c".repeat(40),
    canon_version: "fixture-v1", scope: "documentation_introduction",
    review_kind: "documentation_introduction", db_change_set: [], edge_change_set: [],
    reviewer_thread_id: "fixture-designated-chatgpt",
  };
  const approval = { ...subject, decision: "APPROVE_DOCS",
    source: { kind: "chatgpt", thread_id: subject.reviewer_thread_id, message_id: "fixture-response" } };
  assert.equal(auditChatgptReviewBinding(approval, subject).ok, true);
  for (const change of [
    { subject_sha: "d".repeat(40) }, { base_sha: "d".repeat(40) },
    { spec_snapshot_sha: "d".repeat(40) }, { canon_version: "fixture-v2" },
    { scope: "game_production" }, { review_kind: "game_production_release_approval" },
    { db_change_set: ["new-migration.sql"] }, { edge_change_set: ["new-bundle"] },
    { decision: "HOLD" }, { decision: "REQUEST_CHANGES" },
    { source: { kind: "codex", thread_id: subject.reviewer_thread_id, message_id: "self" } },
    { source: { kind: "chatgpt", thread_id: "different-ai", message_id: "other" } },
    { source: { kind: "chatgpt", thread_id: subject.reviewer_thread_id } },
  ]) {
    assert.equal(auditChatgptReviewBinding({ ...approval, ...change }, subject).ok, false,
      JSON.stringify(change));
  }
  assert.equal(auditChatgptReviewBinding(null, subject).ok, false);
  assert.equal(auditChatgptReviewBinding(approval, null).ok, false);
  assert.equal(auditChatgptReviewBinding(approval, { ...subject, db_change_set: null }).ok, false);
  const actualHold = JSON.parse(read("docs/CHATGPT_REVIEW_DECISIONS.json")).decisions[0];
  assert.equal(actualHold.decision, "HOLD");
  assert.equal(auditChatgptReviewBinding(actualHold, {
    ...actualHold, reviewer_thread_id: actualHold.source.thread_id,
  }).ok, false, "real HOLD must never authorize its own unchanged candidate");
});
