"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "verification", "standard_candidate_verify.sql"), "utf8");

test("candidate verification SQL is read-only and covers the current Standard release boundary", () => {
  assert.doesNotMatch(sql, /^\s*(?:insert|update|delete|drop|alter|create|grant|revoke|truncate|call|do)\b/im);
  for (const table of [
    "standard_card_sale_receipts",
    "standard_matchmaking_tickets",
    "standard_matchmaking_find_receipts",
    "standard_matchmaking_limits",
    "standard_cpu_profile_owners",
    "standard_cpu_start_receipts",
    "standard_cosmetic_receipts",
  ]) assert.match(sql, new RegExp(`'${table}'`));
  for (const column of ["access_mode", "opponent_kind", "cpu_character_id", "cpu_policy_version", "cpu_user_id", "appearance", "answer_receipts", "explanations"]) {
    assert.match(sql, new RegExp(`'${column}'`));
  }
  for (const boundary of ["card_sale", "matchmaking_recruit", "matchmaking_find", "accept_cpu", "start_cpu", "load_room_v2", "cpu_rematch", "cosmetic", "cleanup_expired_batched", "room_snapshot_v2", "start_quiz_v2", "answer_quiz", "finish_quiz_v2"]) {
    assert.match(sql, new RegExp(boundary));
  }
  for (const boundary of ["fcg_standard_cpu_policy_is_supported", "fcg_standard_cpu_policy_is_current", "kurogane-lookahead-v2", "standard_quiz_answer_receipts_shape", "standard_quiz_explanations_shape"]) {
    assert.match(sql, new RegExp(boundary));
  }
});

test("candidate verification checks ACL, RLS, definer search paths, DB objects, and appearance drift", () => {
  for (const phrase of [
    "has_table_privilege",
    "has_function_privilege",
    "relrowsecurity",
    "prosecdef",
    "search_path=",
    "pg_constraint",
    "pg_trigger",
    "pg_index",
    "appearance backfill consistency",
  ]) assert.match(sql, new RegExp(phrase));
  assert.match(sql, /order by ok, check_name/i);
});
