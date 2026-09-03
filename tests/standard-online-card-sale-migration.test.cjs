"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030006_standard_online_card_sale.sql"), "utf8");

test("card-sale receipts are private, actor-scoped, and collision safe", () => {
  assert.match(sql, /create table if not exists fcg_private\.standard_card_sale_receipts/i);
  assert.match(sql, /primary key \(user_id, action_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table fcg_private\.standard_card_sale_receipts from public, anon, authenticated/i);
  assert.match(sql, /where receipt\.user_id = p_user_id and receipt\.action_id = p_action_id/i);
  assert.match(sql, /action_fingerprint <> p_action_fingerprint[\s\S]+errcode = '23505'/i);
});

test("card-sale commit locks the profile, rejects reserved or active inventory, and uses CAS", () => {
  const commit = sql.slice(sql.indexOf("create or replace function public.fcg_standard_server_commit_card_sale"));
  assert.match(commit, /select profile\.revision[\s\S]+for update/i);
  assert.match(commit, /standard_room_setups[\s\S]+room\.status in \('waiting', 'ready', 'playing'\)/i);
  assert.match(commit, /room\.status in \('ready', 'playing'\)/i);
  assert.match(commit, /CARD_SALE_MATCH_LOCKED[\s\S]+errcode = '55000'/i);
  assert.match(commit, /v_current <> p_expected_revision[\s\S]+errcode = 'PT409'/i);
  assert.match(commit, /update public\.fcg_standard_profiles[\s\S]+profile_state = p_profile_state/i);
  assert.match(commit, /insert into fcg_private\.standard_card_sale_receipts[\s\S]+p_expected_revision \+ 1/i);
});

test("only the service role can replay or commit card sales", () => {
  assert.match(sql, /revoke all on function public\.fcg_standard_server_replay_card_sale[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.fcg_standard_server_commit_card_sale[\s\S]+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_server_replay_card_sale[\s\S]+to service_role/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_server_commit_card_sale[\s\S]+to service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.fcg_standard_server_commit_card_sale[^;]+to authenticated/i);
});
