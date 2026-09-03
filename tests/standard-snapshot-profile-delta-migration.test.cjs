"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030013_standard_snapshot_profile_delta.sql"), "utf8");

test("profile appearance is a trigger-maintained allowlisted projection", () => {
  assert.match(sql, /create or replace function fcg_private\.fcg_standard_safe_appearance/i);
  assert.match(sql, /add column if not exists appearance jsonb not null/i);
  assert.match(sql, /before insert or update of profile_state/i);
  assert.match(sql, /new\.appearance := fcg_private\.fcg_standard_safe_appearance\(new\.profile_state\)/i);
  assert.match(sql, /check \(appearance = fcg_private\.fcg_standard_safe_appearance\(profile_state\)\)/i);
  assert.match(sql, /grant execute on function fcg_private\.fcg_standard_safe_appearance\(jsonb\) to service_role/i);
  for (const fallback of ["boardDefault", "effectDefault", "nameplateDefault", "titleNone"]) assert.match(sql, new RegExp(`else '${fallback}' end`));
});

test("snapshot v2 returns the full profile only when its revision changed", () => {
  assert.match(sql, /fcg_standard_room_snapshot_v2\(p_room_id uuid, p_known_profile_revision bigint\)/i);
  assert.match(sql, /'snapshot_schema_version',2/i);
  assert.match(sql, /'profile_revision',own_profile\.revision/i);
  assert.match(sql, /case when p_known_profile_revision = own_profile\.revision then null/i);
  assert.match(sql, /member_profile\.appearance/i);
  assert.doesNotMatch(sql, /'appearance'[\s\S]{0,500}member_profile\.profile_state/i);
});

test("snapshot v2 remains member-scoped and authenticated-only", () => {
  assert.match(sql, /actor\.user_id=v_user_id/i);
  assert.match(sql, /own_view\.user_id=v_user_id/i);
  assert.match(sql, /room\.game_mode='standard_v5'/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_room_snapshot_v2\(uuid, bigint\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_room_snapshot_v2\(uuid, bigint\) to authenticated/i);
});
