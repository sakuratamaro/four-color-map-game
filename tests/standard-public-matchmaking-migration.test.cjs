"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030007_standard_public_matchmaking.sql"), "utf8");

test("public matchmaking adds mode labels while keeping all queue data private", () => {
  assert.match(sql, /access_mode text not null default 'private_code'/i);
  assert.match(sql, /opponent_kind text not null default 'human'/i);
  assert.match(sql, /create table if not exists fcg_private\.standard_matchmaking_tickets/i);
  assert.match(sql, /create unique index[^;]+\(user_id\) where state = 'searching'/i);
  assert.match(sql, /alter table fcg_private\.standard_matchmaking_tickets enable row level security/i);
  assert.match(sql, /revoke all on table fcg_private\.standard_matchmaking_tickets from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant select on (?:table )?fcg_private\.standard_matchmaking_tickets/i);
});

test("find atomically locks the oldest foreign ticket and creates exactly one ready room", () => {
  const find = sql.slice(sql.indexOf("create or replace function public.fcg_standard_matchmaking_find"), sql.indexOf("create or replace function public.fcg_standard_matchmaking_status"));
  assert.match(find, /ticket\.user_id <> v_user_id/i);
  assert.match(find, /order by ticket\.created_at, ticket\.ticket_id[\s\S]+for update skip locked/i);
  assert.match(find, /access_mode, opponent_kind, status[\s\S]+'public_queue', 'human', 'ready'/i);
  assert.match(find, /values \(v_room_id, v_candidate\.user_id, 'A'[\s\S]+v_room_id, v_user_id, 'B'/i);
  assert.match(find, /set state = 'claimed', room_id = v_room_id/i);
  assert.match(find, /standard_matchmaking_find_receipts/i);
  assert.match(find, /action_fingerprint <> v_fingerprint[\s\S]+errcode = '23505'/i);
});

test("status heartbeats, expiry, cancellation, and rate limits are server controlled", () => {
  assert.match(sql, /expires_at = now\(\) \+ interval '2 minutes'/i);
  assert.match(sql, /v_ticket\.state = 'searching' and v_ticket\.expires_at <= now\(\)/i);
  assert.match(sql, /set state = 'cancelled', resolved_at = now\(\)/i);
  assert.match(sql, /standard_matchmaking_limits/i);
  assert.match(sql, /request_count >= 60[\s\S]+blocked_until = now\(\) \+ interval '1 minute'/i);
});

test("matchmaking RPCs are authenticated-only security definers with pinned search paths", () => {
  for (const name of ["recruit", "find", "status", "cancel"]) {
    assert.match(sql, new RegExp(`create or replace function public\\.fcg_standard_matchmaking_${name}[\\s\\S]+security definer[\\s\\S]+set search_path = ''`, "i"));
    assert.match(sql, new RegExp(`revoke all on function public\\.fcg_standard_matchmaking_${name}[^;]+from public, anon`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.fcg_standard_matchmaking_${name}[^;]+to authenticated`, "i"));
  }
});
