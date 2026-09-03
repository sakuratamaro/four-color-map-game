"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030008_standard_cpu_opponents.sql"), "utf8");

test("CPU identity is room-scoped, complete, and never exposed through a login account", () => {
  assert.match(sql, /add column if not exists cpu_character_id text/);
  assert.match(sql, /add column if not exists cpu_policy_version text/);
  assert.match(sql, /add column if not exists cpu_user_id uuid/);
  assert.match(sql, /\(opponent_kind = 'cpu'\) = \(cpu_character_id is not null and cpu_policy_version is not null and cpu_user_id is not null\)/i);
  assert.match(sql, /standard_cpu_profile_owners[\s\S]+room_id uuid primary key references public\.fcg_rooms\(id\) on delete cascade/i);
  assert.doesNotMatch(sql, /insert into auth\.(?:users|identities)/i);
});

test("CPU acceptance locks the exact ticket, requires 90 seconds, and claims it atomically", () => {
  const accept = sql.slice(sql.indexOf("create or replace function public.fcg_standard_server_accept_cpu"), sql.indexOf("create or replace function public.fcg_standard_server_load_room_v2"));
  assert.match(accept, /where ticket\.ticket_id = p_ticket_id and ticket\.user_id = p_user_id for update/i);
  assert.match(accept, /v_ticket\.created_at > now\(\) - interval '90 seconds'/i);
  assert.match(accept, /CPU_CONSENT_TOO_EARLY/);
  assert.match(accept, /p_character_id not in \('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei','kurogane'\)/i);
  assert.match(accept, /p_policy_version <> 'standard-character-roster-v1:' \|\| p_character_id/i);
  assert.match(accept, /insert into public\.fcg_rooms[\s\S]+opponent_kind[\s\S]+values[\s\S]+'cpu', 'cpu'/i);
  assert.match(accept, /insert into fcg_private\.standard_room_setups[\s\S]+p_cpu_user_id, 'B'/i);
  assert.match(accept, /set state = 'claimed', room_id = v_room_id, resolved_at = now\(\), heartbeat_at = now\(\)/i);
});

test("CPU storage and room loading remain service-only while the member snapshot labels CPU safely", () => {
  assert.match(sql, /alter table fcg_private\.standard_cpu_profile_owners enable row level security/i);
  assert.match(sql, /revoke all on table fcg_private\.standard_cpu_profile_owners from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_server_accept_cpu\([^)]+\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_server_accept_cpu\([^)]+\) to service_role/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_server_load_room_v2\(uuid, uuid\) from public, anon, authenticated/i);
  assert.match(sql, /member\.user_id=room\.cpu_user_id,'last_seen_at'/i);
  assert.match(sql, /join public\.fcg_room_members actor on actor\.room_id=room\.id and actor\.user_id=v_user_id/i);
  assert.doesNotMatch(sql, /'profile_state',profile_b\.profile_state/i);
});

test("deleting a CPU room removes its synthetic profile through the private ownership row", () => {
  assert.match(sql, /create trigger fcg_delete_standard_cpu_profile_after_room[\s\S]+after delete on fcg_private\.standard_cpu_profile_owners/i);
  assert.match(sql, /delete from public\.fcg_standard_profiles profile where profile\.user_id = old\.cpu_user_id/i);
});
