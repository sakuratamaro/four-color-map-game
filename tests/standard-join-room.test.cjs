"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const original = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609020004_standard_join_room.sql"), "utf8");
const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030003_standard_join_rate_limit.sql"), "utf8");

test("Standard join delegates every attempt to the already-hardened transaction", () => {
  assert.match(sql, /create or replace function public\.fcg_standard_join_room/i);
  assert.match(sql, /from public\.fcg_join_room\([\s\S]+p_display_name/i);
  assert.doesNotMatch(sql, /insert into public\.fcg_room_members/i);
  assert.doesNotMatch(sql, /\b(?:drop|truncate|delete\s+from)\b/i);
});

test("generic failures return without rolling back the base rate-limit update", () => {
  assert.match(original, /if not found then raise exception 'room not found'/i);
  assert.match(sql, /select room\.game_mode into v_mode/i);
  assert.match(sql, /then 'STANDARD_MODE_MISMATCH'/i);
  assert.match(sql, /if not found or v_joined\.room_id is null then[\s\S]+return query select null::uuid/i);
  assert.doesNotMatch(sql, /raise exception 'room not found'/i);
  assert.match(sql, /returns table \([\s\S]+game_mode text/i);
});

test("Standard join is authenticated-only with a pinned search path", () => {
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_join_room\(text, text\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_join_room\(text, text\) to authenticated/i);
  assert.doesNotMatch(sql, /sb_secret_|postgres(?:ql)?:\/\//i);
});
