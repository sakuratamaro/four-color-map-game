"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const sql = fs.readFileSync(path.join(root, "supabase", "migrations", "202609020006_standard_profile_load.sql"), "utf8");

test("profile load RPC exposes only the revision and profile state", () => {
  assert.match(sql, /create or replace function public\.fcg_standard_server_load_profile\(p_user_id uuid\)/i);
  assert.match(sql, /returns table\s*\(\s*revision bigint,\s*profile_state jsonb\s*\)/i);
  assert.match(sql, /select profile\.revision, profile\.profile_state/i);
  assert.doesNotMatch(sql, /display_name|email|auth\.users/i);
});

test("profile load RPC is service-only and pins an empty search path", () => {
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_server_load_profile\(uuid\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_server_load_profile\(uuid\)\s+to service_role/i);
  assert.doesNotMatch(sql, /\b(?:drop|truncate|delete|insert|update)\b/i);
});
