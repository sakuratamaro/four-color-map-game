"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609060001_standard_active_room_recovery.sql"), "utf8");
const body = sql.slice(sql.indexOf("create or replace function"), sql.indexOf("revoke all on function"));

test("active-room recovery is a stable authenticated caller-only boundary", () => {
  assert.match(body, /create or replace function public\.fcg_standard_active_room\(\)/i);
  assert.match(body, /language sql[\s\S]+stable[\s\S]+security definer[\s\S]+set search_path = ''/i);
  assert.match(body, /member\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_active_room\(\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_active_room\(\) to authenticated/i);
});

test("active-room recovery returns only live Standard memberships and caps duplicate evidence at two", () => {
  assert.match(body, /from public\.fcg_room_members member[\s\S]+join public\.fcg_rooms room on room\.id = member\.room_id/i);
  assert.match(body, /room\.game_mode = 'standard_v5'/i);
  assert.match(body, /room\.status in \('waiting', 'ready', 'playing'\)/i);
  assert.match(body, /room\.expires_at > now\(\)/i);
  assert.match(body, /order by room\.created_at desc, room\.id[\s\S]+limit 2/i);
  assert.doesNotMatch(body, /\b(?:insert|update|delete|merge|truncate)\b/i);
});

test("active-room recovery exposes only finite room metadata and the caller's setup revision", () => {
  assert.match(body, /returns table \(\s*room_id uuid,\s*seat text,\s*room_status text,\s*room_version bigint,\s*access_mode text,\s*opponent_kind text,\s*cpu_character_id text,\s*setup_revision bigint\s*\)/i);
  assert.match(body, /left join fcg_private\.standard_room_setups own_setup[\s\S]+own_setup\.room_id = room\.id[\s\S]+own_setup\.user_id = member\.user_id/i);
  assert.match(body, /coalesce\(own_setup\.setup_revision, 0::bigint\)/i);
  assert.doesNotMatch(body, /\b(?:loadout|loadout_fingerprint|quote_id|profile_state|authoritative_state|private_state|code_hash|cpu_user_id)\b/i);
});
