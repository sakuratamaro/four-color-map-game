const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

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
    assert.notEqual(decision.review_kind, "game_production_release_approval");
  }
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
