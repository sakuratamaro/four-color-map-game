"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const baseSql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609020005_standard_rematch.sql"), "utf8");
const resetSql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030002_standard_rematch_reset.sql"), "utf8");
const sql = `${baseSql}\n${resetSql}`;

test("rematch is a two-member, finished Standard-room handshake", () => {
  assert.match(sql, /create table if not exists fcg_private\.standard_rematch_votes/i);
  assert.match(sql, /create or replace function public\.fcg_standard_request_rematch/i);
  assert.match(sql, /v_room\.game_mode <> 'standard_v5' or v_room\.status <> 'finished'/i);
  assert.match(sql, /v_room\.version <> p_expected_version/i);
  assert.match(sql, /join public\.fcg_room_members[\s\S]+v_vote_count < 2/i);
  assert.match(sql, /grant execute[\s\S]+to authenticated/i);
});

test("rematch action identity is replay-safe and collision-safe", () => {
  assert.match(sql, /standard_rematch_receipts/i);
  assert.match(sql, /request_fingerprint text not null[\s\S]+primary key \(room_id, action_id\)/i);
  assert.match(sql, /v_receipt\.actor_id <> v_user_id or v_receipt\.request_fingerprint <> v_fingerprint/i);
  assert.match(sql, /rematch action id reuse'[\s\S]+errcode = '23505'/i);
  assert.match(sql, /return query select[\s\S]+true;/i);
});

test("second vote atomically resets only match-scoped state", () => {
  assert.match(resetSql, /delete from fcg_private\.standard_room_setups where room_id = p_room_id/i);
  assert.match(resetSql, /delete from public\.fcg_player_views where room_id = p_room_id/i);
  assert.match(resetSql, /delete from fcg_private\.authoritative_matches[\s\S]+game_mode = 'standard_v5'/i);
  assert.match(resetSql, /set status = 'ready'[\s\S]+version = p_expected_version \+ 1[\s\S]+public_state = '\{\}'::jsonb[\s\S]+winner_seat = null/i);
  assert.doesNotMatch(resetSql, /public_state = null/i);
  assert.doesNotMatch(resetSql, /delete from public\.fcg_standard_profiles/i);
  assert.doesNotMatch(resetSql, /delete from fcg_private\.standard_action_receipts/i);
});

test("first vote leaves the finished room and match projections intact", () => {
  const waiting = resetSql.slice(resetSql.indexOf("if v_vote_count < 2 then"), resetSql.indexOf("else", resetSql.indexOf("if v_vote_count < 2 then")));
  assert.match(waiting, /'roomStatus', 'finished'/i);
  assert.match(waiting, /'readyToSetup', false/i);
  assert.doesNotMatch(waiting, /update public\.fcg_rooms|delete from/i);
});
