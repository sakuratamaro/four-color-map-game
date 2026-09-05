"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrations = path.join(__dirname, "..", "supabase", "migrations");
const sql = fs.readFileSync(path.join(migrations, "202609050002_standard_immediate_cpu.sql"), "utf8");
const originalCpuSql = fs.readFileSync(path.join(migrations, "202609030008_standard_cpu_opponents.sql"), "utf8");
const start = sql.slice(sql.indexOf("create or replace function public.fcg_standard_server_start_cpu"));

test("immediate CPU is additive and leaves the existing 90-second acceptance RPC unchanged", () => {
  assert.doesNotMatch(sql, /create or replace function public\.fcg_standard_server_accept_cpu/i);
  assert.doesNotMatch(sql, /CPU_CONSENT_TOO_EARLY|interval '90 seconds'/i);
  assert.match(originalCpuSql, /create or replace function public\.fcg_standard_server_accept_cpu/i);
  assert.match(originalCpuSql, /v_ticket\.created_at > now\(\) - interval '90 seconds'/i);
  assert.match(originalCpuSql, /CPU_CONSENT_TOO_EARLY/);
});

test("immediate CPU receipts are private, room-scoped, and cascade with their room", () => {
  assert.match(sql, /create table if not exists fcg_private\.standard_cpu_start_receipts/i);
  assert.match(sql, /room_id uuid not null references public\.fcg_rooms\(id\) on delete cascade/i);
  assert.match(sql, /primary key \(user_id, action_id\)/i);
  assert.match(sql, /action_fingerprint text not null check \(action_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'\)/i);
  assert.match(sql, /result_kind text not null check \(result_kind in \('created', 'recovered_existing'\)\)/i);
  assert.match(sql, /alter table fcg_private\.standard_cpu_start_receipts enable row level security/i);
  assert.match(sql, /revoke all on table fcg_private\.standard_cpu_start_receipts from public, anon, authenticated/i);
});

test("direct start is durably limited, actor-serialized, and replays before doing work", () => {
  const rate = start.indexOf("fcg_standard_matchmaking_rate_limited(p_user_id)");
  const actorLock = start.indexOf("pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0))");
  const replay = start.indexOf("from fcg_private.standard_cpu_start_receipts receipt");
  const searchLock = start.indexOf("from fcg_private.standard_matchmaking_tickets ticket");
  const activeRoom = start.indexOf("from public.fcg_room_members member");
  const createRoom = start.indexOf("insert into public.fcg_rooms");
  assert.ok(rate >= 0 && actorLock > rate && replay > actorLock && searchLock > replay && activeRoom > searchLock && createRoom > activeRoom);
  assert.match(start, /where receipt\.user_id = p_user_id and receipt\.action_id = p_action_id[\s\S]+for update/i);
  assert.match(start, /v_receipt\.action_fingerprint <> v_fingerprint[\s\S]+errcode = '23505'/i);
  assert.match(start, /return query select v_receipt\.room_id[\s\S]+true, v_receipt\.result_kind = 'recovered_existing'/i);
});

test("direct choice locks and cancels its own search before recovering any active Standard room", () => {
  assert.match(start, /where ticket\.user_id = p_user_id and ticket\.state = 'searching'[\s\S]+limit 1 for update/i);
  assert.match(start, /set state = 'cancelled', resolved_at = now\(\), heartbeat_at = now\(\)/i);
  assert.match(start, /member\.user_id = p_user_id and room\.game_mode = 'standard_v5'[\s\S]+room\.status in \('waiting', 'ready', 'playing'\)/i);
  assert.match(start, /'recovered_existing', v_room_id, v_seat, v_opponent_kind, v_cpu_character_id/i);
  assert.match(start, /return query select v_room_id, v_seat, v_opponent_kind, v_cpu_character_id, false, true/i);
});

test("new direct rooms use the authoritative human name and the existing CPU ownership and setup model", () => {
  assert.match(start, /select profile\.display_name, profile\.revision[\s\S]+where profile\.user_id = p_user_id[\s\S]+for share/i);
  assert.match(start, /insert into public\.fcg_rooms[\s\S]+'standard_v5', 'cpu', 'cpu',[\s\S]+'ready'/i);
  assert.match(start, /insert into public\.fcg_standard_profiles[\s\S]+p_cpu_user_id, 1, btrim\(p_cpu_display_name\), p_cpu_profile_state/i);
  assert.match(start, /insert into fcg_private\.standard_cpu_profile_owners[\s\S]+v_room_id, p_cpu_user_id/i);
  assert.match(start, /v_room_id, p_user_id, 'A', v_human_display_name[\s\S]+v_room_id, p_cpu_user_id, 'B'/i);
  assert.match(start, /insert into fcg_private\.standard_room_setups[\s\S]+v_room_id, p_cpu_user_id, 'B', 1, 1/i);
  assert.match(start, /'created', v_room_id, 'A', 'cpu', p_character_id/i);
});

test("the immediate RPC accepts only the fixed server CPU contract and is service-only", () => {
  assert.match(start, /p_character_id not in \('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei','kurogane'\)/i);
  assert.match(start, /p_policy_version <> 'standard-character-roster-v1:' \|\| p_character_id/i);
  assert.match(start, /p_loadout_fingerprint !~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(start, /security definer[\s\S]+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_server_start_cpu\([^)]+\)[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_server_start_cpu\([^)]+\)[\s\S]+to service_role/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]+to authenticated/i);
  assert.doesNotMatch(sql, /insert into auth\.(?:users|identities)/i);
});
