"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migrationPath = path.join(root, "supabase", "migrations", "202609020001_standard_online_foundation.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

test("standard foundation is additive and preserves quick rooms by default", () => {
  assert.match(sql, /alter table public\.fcg_rooms\s+add column if not exists game_mode text not null default 'quick_v5'/i);
  assert.match(sql, /alter table fcg_private\.authoritative_matches\s+add column if not exists game_mode text not null default 'quick_v5'/i);
  assert.match(sql, /check \(game_mode in \('quick_v5', 'standard_v5'\)\)/i);
  assert.doesNotMatch(sql, /\b(?:drop|truncate)\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
});

test("standard profiles are owner-readable and browser read-only", () => {
  assert.match(sql, /create table if not exists public\.fcg_standard_profiles/i);
  assert.match(sql, /alter table public\.fcg_standard_profiles enable row level security/i);
  assert.match(sql, /for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(sql, /revoke all on table public\.fcg_standard_profiles from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.fcg_standard_profiles to authenticated/i);
  assert.doesNotMatch(sql, /create policy[^;]+fcg_standard_profiles[^;]+for (?:insert|update|delete|all)/i);
});

test("private setup and action receipt tables carry revision and idempotency material", () => {
  for (const table of ["standard_room_setups", "standard_action_receipts"]) {
    assert.match(sql, new RegExp(`create table if not exists fcg_private\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table fcg_private\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on table fcg_private\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.match(sql, /setup_revision bigint not null default 0/i);
  assert.match(sql, /unique \(room_id, quote_id\)/i);
  assert.match(sql, /primary key \(room_id, action_id\)/i);
  assert.match(sql, /loadout_fingerprint text not null check \(loadout_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'\)/i);
  assert.match(sql, /action_fingerprint text not null check \(action_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'\)/i);
});

test("standard room creation is mode-scoped and retains abuse controls", () => {
  assert.match(sql, /create or replace function public\.fcg_standard_create_room\(p_display_name text\)/i);
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /pg_catalog\.pg_advisory_xact_lock/i);
  assert.match(sql, /status in \('waiting', 'ready', 'playing'\)[\s\S]+>= 3/i);
  assert.match(sql, /insert into public\.fcg_rooms \(code_hash, host_user_id, game_mode\)[\s\S]+values \([^;]+, 'standard_v5'\)/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_create_room\(text\) to authenticated/i);
});

test("service profile and loadout commits use explicit compare-and-swap revisions", () => {
  assert.match(sql, /create or replace function public\.fcg_standard_server_commit_profile/i);
  assert.match(sql, /if p_expected_revision <> 0 then raise exception 'stale profile revision' using errcode = 'PT409'/i);
  assert.match(sql, /values \(p_user_id, 1, btrim\(p_display_name\), p_profile_state\)/i);
  assert.match(sql, /where user_id = p_user_id and revision = p_expected_revision/i);

  assert.match(sql, /create or replace function public\.fcg_standard_server_submit_loadout\([\s\S]+p_expected_setup_revision bigint/i);
  assert.match(sql, /if v_current_setup\.setup_revision <> p_expected_setup_revision[\s\S]+errcode = 'PT409'/i);
  assert.match(sql, /if p_expected_setup_revision <> 0[\s\S]+errcode = 'PT409'/i);
  assert.match(sql, /v_current_setup\.quote_id = p_quote_id[\s\S]+return v_current_setup\.setup_revision/i);
});

test("server functions are service-role only and pin the search path", () => {
  for (const fn of ["fcg_standard_server_commit_profile", "fcg_standard_server_submit_loadout"]) {
    const start = sql.search(new RegExp(`create or replace function public\\.${fn}\\(`, "i"));
    assert.notEqual(start, -1, `${fn} must exist`);
    const body = sql.slice(start, sql.indexOf("$$;", start) + 3);
    assert.match(body, /security definer\s+set search_path = ''/i);
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]+?from public, anon, authenticated`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]+?to service_role`, "i"));
  }
});

test("foundation exposes no secret table through Realtime and embeds no credential", () => {
  assert.doesNotMatch(sql, /alter publication supabase_realtime add table[^;]*(?:fcg_standard_profiles|standard_room_setups|standard_action_receipts)/i);
  assert.doesNotMatch(sql, /sb_secret_/i);
  assert.doesNotMatch(sql, /service_role\s*[:=]\s*['\"][A-Za-z0-9._-]+/i);
  assert.doesNotMatch(sql, /postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/i);
});
