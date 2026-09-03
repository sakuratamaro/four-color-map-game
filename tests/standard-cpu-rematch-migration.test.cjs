"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030009_standard_cpu_rematch.sql"), "utf8");

test("CPU rematch is service-only, locks the room, and accepts only its human A member", () => {
  assert.match(sql, /create or replace function public\.fcg_standard_server_request_cpu_rematch/);
  assert.match(sql, /select room\.\* into v_room from public\.fcg_rooms room where room\.id = p_room_id for update/i);
  assert.match(sql, /v_room\.opponent_kind <> 'cpu'/i);
  assert.match(sql, /member\.user_id = p_user_id and member\.seat = 'A'/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_server_request_cpu_rematch\([^)]+\)[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_server_request_cpu_rematch\([^)]+\)[\s\S]+to service_role/i);
});

test("CPU rematch is idempotent and atomically resets match state plus a fresh server profile and loadout", () => {
  assert.match(sql, /standard_rematch_receipts[\s\S]+receipt\.action_id = p_action_id/i);
  assert.match(sql, /v_receipt\.actor_id <> p_user_id or v_receipt\.request_fingerprint <> v_fingerprint/i);
  assert.match(sql, /delete from fcg_private\.standard_room_setups where room_id = p_room_id/i);
  assert.match(sql, /delete from public\.fcg_player_views where room_id = p_room_id/i);
  assert.match(sql, /delete from fcg_private\.authoritative_matches where room_id = p_room_id and game_mode = 'standard_v5'/i);
  assert.match(sql, /set revision = revision \+ 1[\s\S]+profile_state = p_cpu_profile_state/i);
  assert.match(sql, /p_room_id, v_room\.cpu_user_id, 'B', 1, v_cpu_profile_revision/i);
  assert.match(sql, /set status = 'ready', version = p_expected_version \+ 1, public_state = '\{\}'::jsonb/i);
  assert.match(sql, /insert into fcg_private\.standard_rematch_receipts/i);
});

test("CPU rematch binds the unchanged roster identity and rejects caller-crafted policy versions", () => {
  assert.match(sql, /p_character_id not in \('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei','kurogane'\)/i);
  assert.match(sql, /p_policy_version <> 'standard-character-roster-v1:' \|\| p_character_id/i);
  assert.match(sql, /v_room\.cpu_character_id <> p_character_id or v_room\.cpu_policy_version <> p_policy_version/i);
});
