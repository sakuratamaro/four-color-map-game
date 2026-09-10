"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609100001_standard_quiz_accuracy.sql"), "utf8");

test("quiz accuracy migration counts only newly adjudicated answers and preserves idempotency", () => {
  assert.match(sql, /create or replace function public\.fcg_standard_server_finish_quiz\(/i);
  assert.match(sql, /if v_quiz\.completed_at is not null[\s\S]+return query select v_profile_revision, true, v_profile/i);
  assert.match(sql, /'trackedAnswered', coalesce\(\(v_previous_record ->> 'trackedAnswered'\)::integer, 0\) \+ v_correct \+ v_wrong/i);
  assert.match(sql, /'trackedCorrect', coalesce\(\(v_previous_record ->> 'trackedCorrect'\)::integer, 0\) \+ v_correct/i);
  assert.match(sql, /'trackingStartedAt', v_tracking_started_at/i);
  assert.match(sql, /v_tracking_started_at := coalesce\(\(v_previous_record ->> 'trackingStartedAt'\)::timestamptz, now\(\)\)/i);
  assert.doesNotMatch(sql, /bestCorrect[^\n]+trackedCorrect|attempts[^\n]+trackedAnswered/i);
  assert.match(sql, /revoke all on function[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function[\s\S]+to service_role/i);
});
