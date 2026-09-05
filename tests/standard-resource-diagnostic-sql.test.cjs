"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sqlPath = path.join(__dirname, "..", "supabase", "verification", "standard_resource_diagnostic.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
const executableSql = sql
  .replace(/--[^\r\n]*/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .trim();

test("resource diagnostic is one read-only aggregate statement", () => {
  const statements = executableSql.split(";").map((statement) => statement.trim()).filter(Boolean);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /^with\b/i);
  assert.doesNotMatch(
    executableSql,
    /\b(insert|update|delete|merge|call|create|alter|drop|truncate|grant|revoke|copy|vacuum|analyze|reset|set)\b/i,
  );
});

test("resource diagnostic does not expose user-level or SQL-text data", () => {
  assert.doesNotMatch(executableSql, /\b(user_id|actor_id|host_user_id|auth\.users|pg_stat_activity\.query)\b/i);
  assert.doesNotMatch(executableSql, /select\s+\*/i);
  assert.match(executableSql, /jsonb_build_object/i);
});

test("resource diagnostic covers each pressure hypothesis without cleanup", () => {
  for (const expected of [
    "pg_publication_tables",
    "pg_replication_slots",
    "pg_stat_activity",
    "pg_stat_user_tables",
    "pg_total_relation_size",
    "sum_of_per_slot_lag_bytes",
    "retained_wal_bytes_max",
    "retention_candidates",
    "matchmaking_limits_older_than_7d",
  ]) {
    assert.ok(executableSql.includes(expected), `missing ${expected}`);
  }
});
