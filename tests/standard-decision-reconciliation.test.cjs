"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const scriptUrl = pathToFileURL(path.join(__dirname, "..", "scripts", "check-standard-decision-reconciliation.mjs")).href;
const columns = ["ID", "原文要旨", "決定", "受入条件", "依存関係", "担当", "対象release", "状態", "実装commit", "main統合", "Pages", "live実機", "決定元タスク", "DEFERRED-SUPERSEDED理由", "ユーザー承認"];

test("current command center decision ledger passes the reconciliation gate", async () => {
  const { auditDecisionLedger } = await import(scriptUrl);
  const commandCenter = fs.readFileSync(path.join(__dirname, "..", "docs", "PROJECT_COMMAND_CENTER.md"), "utf8");
  const result = auditDecisionLedger(commandCenter);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.ok(result.entryCount > 0, "the authoritative ledger must not be empty");
});

function ledger(rows, overrideColumns = columns) {
  return ["# Command center", "", "## User Decision Ledger", "", `| ${overrideColumns.join(" | ")} |`, `| ${overrideColumns.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${overrideColumns.map((column) => row[column] ?? "-").join(" | ")} |`), "", "## Next section"].join("\n");
}

function entry(overrides = {}) {
  return {
    ID: "UDL-001", 原文要旨: "Shift対象指定をわかりやすくする", 決定: "1始まりの選択UIにする", 受入条件: "Half 1-12、Triple 2-11を表示する", 依存関係: "engine payloadは0-basedのまま", 担当: "UX", 対象release: "next-pages", 状態: "PUBLIC_VERIFIED", 実装commit: "abc1234", main統合: "main abc1234", Pages: "run 123 success", live実機: "PENDING", 決定元タスク: "task current-user-direction", "DEFERRED-SUPERSEDED理由": "-", ユーザー承認: "user message 2026-09-06", ...overrides,
  };
}

test("decision ledger accepts the exact schema and evidence ladder", async () => {
  const { auditDecisionLedger, LEDGER_COLUMNS, LEDGER_STATES } = await import(scriptUrl);
  assert.deepEqual(LEDGER_COLUMNS, columns);
  assert.deepEqual(LEDGER_STATES, ["INBOX", "DECIDED", "SPEC_READY", "IMPLEMENTING", "LOCAL_VERIFIED", "MERGED", "PUBLIC_VERIFIED", "PHYSICAL_ACCEPTED", "DEFERRED", "SUPERSEDED"]);
  const result = auditDecisionLedger(ledger([entry(), entry({ ID: "UDL-002", 状態: "PHYSICAL_ACCEPTED", live実機: "two-device card 2026-09-06 PASS" })]));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.entryCount, 2);
  assert.deepEqual(result.manualReconciliation, []);
});

test("decision ledger rejects schema drift, duplicate IDs, unknown states, and missing DECIDED fields", async () => {
  const { auditDecisionLedger } = await import(scriptUrl);
  const wrongColumns = [...columns];
  [wrongColumns[4], wrongColumns[5]] = [wrongColumns[5], wrongColumns[4]];
  assert.match(auditDecisionLedger(ledger([entry()], wrongColumns)).errors.join("\n"), /schema must be exactly/);
  const invalid = auditDecisionLedger(ledger([entry({ 状態: "DECIDED", 受入条件: "PENDING", 担当: "-", 対象release: "TBD", 決定元タスク: "なし" }), entry({ 状態: "SHIPPED" })]));
  assert.equal(invalid.ok, false);
  for (const expected of ["duplicate stable ID", "unknown state SHIPPED", "受入条件 is required", "担当 is required", "対象release is required", "決定元タスク is required"]) assert.match(invalid.errors.join("\n"), new RegExp(expected));
});

test("decision ledger enforces implementation, main, Pages, and physical evidence by state", async () => {
  const { auditDecisionLedger } = await import(scriptUrl);
  const result = auditDecisionLedger(ledger([
    entry({ ID: "UDL-011", 状態: "LOCAL_VERIFIED", 実装commit: "-", main統合: "-", Pages: "-" }),
    entry({ ID: "UDL-012", 状態: "MERGED", main統合: "PENDING", Pages: "-" }),
    entry({ ID: "UDL-013", 状態: "PUBLIC_VERIFIED", Pages: "NOT_RUN" }),
    entry({ ID: "UDL-014", 状態: "PHYSICAL_ACCEPTED", live実機: "PENDING" }),
  ]));
  assert.equal(result.ok, false);
  for (const expected of ["UDL-011.*実装commit", "UDL-012.*main統合", "UDL-013.*Pages", "UDL-014.*live実機"]) assert.match(result.errors.join("\n"), new RegExp(expected));
});

test("DEFERRED and SUPERSEDED require a reason and explicit user approval", async () => {
  const { auditDecisionLedger } = await import(scriptUrl);
  const result = auditDecisionLedger(ledger([
    entry({ ID: "UDL-021", 状態: "DEFERRED", "DEFERRED-SUPERSEDED理由": "-", ユーザー承認: "PENDING" }),
    entry({ ID: "UDL-022", 状態: "SUPERSEDED", "DEFERRED-SUPERSEDED理由": "new decision UDL-023", ユーザー承認: "-" }),
  ]));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /UDL-021.*requires a reason/);
  assert.match(result.errors.join("\n"), /UDL-021.*requires user approval/);
  assert.doesNotMatch(result.errors.join("\n"), /UDL-022.*requires a reason/);
  assert.match(result.errors.join("\n"), /UDL-022.*requires user approval/);
});

test("INBOX, conflicting active decisions, and stale task finals enter manual reconciliation", async () => {
  const { auditDecisionLedger } = await import(scriptUrl);
  const result = auditDecisionLedger(ledger([
    entry({ ID: "UDL-031", 状態: "INBOX", 受入条件: "-", 担当: "-", 対象release: "-", 決定元タスク: "-" }),
    entry({ ID: "UDL-032", 状態: "DECIDED", 決定: "案A", 決定元タスク: "old task FINAL" }),
    entry({ ID: "UDL-033", 状態: "SPEC_READY", 決定: "案B" }),
  ]));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const kinds = result.manualReconciliation.map(({ kind }) => kind);
  assert.ok(kinds.includes("INBOX"));
  assert.ok(kinds.includes("STALE_TASK_FINAL"));
  assert.equal(kinds.filter((kind) => kind === "CONFLICTING_DECISION").length, 2);
});

test("missing ledger section is a hard failure", async () => {
  const { auditDecisionLedger } = await import(scriptUrl);
  const result = auditDecisionLedger("# Command center\n\nNo ledger yet.\n");
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /missing .*User Decision Ledger/);
});
