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
    "standard_pregame_abandon_receipts",
    "standard_cosmetic_receipts",
  ]) assert.match(sql, new RegExp(`'${table}'`));
  for (const column of ["access_mode", "opponent_kind", "cpu_character_id", "cpu_policy_version", "cpu_user_id", "appearance", "answer_receipts", "explanations"]) {
    assert.match(sql, new RegExp(`'${column}'`));
  }
  for (const boundary of ["card_sale", "matchmaking_recruit", "matchmaking_find", "active_room", "abandon_room", "accept_cpu", "start_cpu", "load_room_v2", "cpu_rematch", "cosmetic", "cleanup_expired_batched", "room_snapshot_v2", "start_quiz_v2", "answer_quiz", "finish_quiz_v2"]) {
    assert.match(sql, new RegExp(boundary));
  }
  for (const boundary of ["fcg_standard_cpu_policy_is_supported", "fcg_standard_cpu_policy_is_current", "kurogane-lookahead-v2", "standard_quiz_answer_receipts_shape", "standard_quiz_explanations_shape"]) {
    assert.match(sql, new RegExp(boundary));
  }
  for (const boundary of ["fcg_standard_guard_member_active_room", "fcg_standard_guard_room_reactivation", "fcg_standard_member_single_active_room", "fcg_standard_room_reactivation_single_active"]) {
    assert.match(sql, new RegExp(boundary));
  }
  assert.match(sql, /single active Standard room per actor preflight/);
  assert.match(sql, /duplicate_actor_count = 0/);
  assert.match(sql, /fcg_standard_pregame_abandon_receipts_actor_idx/);
  for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER"]) {
    assert.match(sql, new RegExp(`has_table_privilege\\('anon', relation\\.oid, '${privilege}'\\)`));
    assert.match(sql, new RegExp(`has_table_privilege\\('authenticated', relation\\.oid, '${privilege}'\\)`));
  }
  assert.match(sql, /standard_pregame_abandon_receipts_pkey/);
  assert.match(sql, /PRIMARY KEY \(room_id, action_id\)/);
  assert.match(sql, /standard_pregame_abandon_receipts_room_id_fkey/);
  assert.match(sql, /confrelid = pg_catalog\.to_regclass\('public\.fcg_rooms'\)/);
  assert.match(sql, /confdeltype = 'c'/);
  assert.match(sql, /standard_pregame_abandon_receipts_expected_version_check/);
  assert.match(sql, /standard_pregame_abandon_receipts_request_fingerprint_check/);
  assert.match(sql, /pg_get_function_result/);
  assert.match(sql, /public\.fcg_standard_active_room\(\)/);
  assert.match(sql, /TABLE\(room_id uuid, seat text, room_status text, room_version bigint, access_mode text, opponent_kind text, cpu_character_id text, setup_revision bigint\)/);
  assert.match(sql, /lower\(definition\) like '%member\.user_id = \(select auth\.uid\(\)\)%'/);
  assert.match(sql, /volatility = 's'/);
  assert.match(sql, /language_name = 'sql'/);
  assert.match(sql, /own_setup\.room_id = room\.id/);
  assert.match(sql, /own_setup\.user_id = member\.user_id/);
  assert.match(sql, /coalesce\(own_setup\.setup_revision/);
  assert.match(sql, /lower\(definition\) like '%limit 2%'/);
  assert.match(sql, /TABLE\(room_status text, room_version bigint, abandon_result text, duplicate boolean, server_time timestamp with time zone\)/);
  assert.match(sql, /index_row\.indexrelid = pg_catalog\.to_regclass\(expected\.schema_name \|\| '\.' \|\| expected\.index_name\)/);
  assert.match(sql, /index_row\.indrelid = pg_catalog\.to_regclass\(expected\.schema_name \|\| '\.' \|\| expected\.table_name\)/);
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
