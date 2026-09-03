"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609020003_standard_action_replay_lookup.sql"), "utf8");

test("replay preflight is additive, stable, and Standard-mode scoped", () => {
  assert.doesNotMatch(sql, /\b(?:drop|truncate|delete\s+from|update|insert\s+into)\b/i);
  assert.match(sql, /create or replace function public\.fcg_standard_server_replay_action/i);
  assert.match(sql, /language plpgsql\s+stable\s+security definer\s+set search_path = ''/i);
  assert.match(sql, /room\.game_mode = 'standard_v5'/i);
});

test("replay lookup authenticates membership and binds actor plus fingerprint", () => {
  assert.match(sql, /member\.user_id = p_actor_id/i);
  assert.match(sql, /p_action_fingerprint !~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(sql, /receipt\.room_id = p_room_id and receipt\.action_id = p_action_id/i);
  assert.match(sql, /v_receipt\.actor_id <> p_actor_id or v_receipt\.action_fingerprint <> p_action_fingerprint/i);
  assert.match(sql, /raise exception 'action id reuse' using errcode = '23505'/i);
});

test("replay lookup returns a finite found/result shape without exposing receipts", () => {
  assert.match(sql, /returns table \(found boolean, action_result jsonb\)/i);
  assert.match(sql, /return query select false, null::jsonb/i);
  assert.match(sql, /return query select true, v_receipt\.result/i);
  assert.doesNotMatch(sql, /return query select[^;]+v_receipt\.actor_id/i);
});

test("replay lookup is executable only by service_role", () => {
  assert.match(sql, /revoke all on function public\.fcg_standard_server_replay_action\(uuid, uuid, uuid, text\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_server_replay_action\(uuid, uuid, uuid, text\)\s+to service_role/i);
  assert.doesNotMatch(sql, /sb_secret_|postgres(?:ql)?:\/\//i);
});
