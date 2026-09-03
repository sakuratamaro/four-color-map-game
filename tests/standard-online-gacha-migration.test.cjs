"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030001_standard_online_gacha.sql"), "utf8");

test("gacha receipts are private, actor-scoped, and replay collision safe", () => {
  assert.match(sql, /create table if not exists fcg_private\.standard_gacha_receipts/i);
  assert.match(sql, /alter table fcg_private\.standard_gacha_receipts enable row level security/i);
  assert.match(sql, /primary key \(user_id, action_id\)/i);
  assert.match(sql, /revoke all on table fcg_private\.standard_gacha_receipts from public, anon, authenticated/i);
  assert.match(sql, /create or replace function public\.fcg_standard_server_replay_gacha/i);
  assert.match(sql, /where receipt\.user_id = p_user_id and receipt\.action_id = p_action_id/i);
  assert.match(sql, /v_receipt\.action_fingerprint <> p_action_fingerprint[\s\S]+errcode = '23505'/i);
  assert.match(sql, /return query select true, v_receipt\.profile_revision, v_receipt\.action_result/i);
});

test("existing profile sync can rename but cannot overwrite progression", () => {
  const update = sql.slice(sql.indexOf("update public.fcg_standard_profiles"), sql.indexOf("create or replace function public.fcg_standard_server_commit_gacha"));
  assert.match(update, /set revision = p_expected_revision \+ 1,[\s\S]+display_name = btrim\(p_display_name\)/i);
  assert.doesNotMatch(update, /profile_state\s*=/i);
  assert.match(sql, /if not found then[\s\S]+insert into public\.fcg_standard_profiles[\s\S]+p_profile_state/i);
});

test("gacha CAS updates profile and stores its receipt in one definer transaction", () => {
  const commit = sql.slice(sql.indexOf("create or replace function public.fcg_standard_server_commit_gacha"));
  assert.match(commit, /select profile\.revision[\s\S]+for update/i);
  assert.match(commit, /v_current <> p_expected_revision[\s\S]+errcode = 'PT409'/i);
  assert.match(commit, /update public\.fcg_standard_profiles[\s\S]+profile_state = p_profile_state/i);
  assert.match(commit, /insert into fcg_private\.standard_gacha_receipts[\s\S]+p_expected_revision \+ 1, p_action_result/i);
  assert.match(commit, /return query select p_expected_revision \+ 1, false, p_action_result/i);
  assert.match(sql, /grant execute on function public\.fcg_standard_server_commit_gacha[^\n]+[\s\S]+to service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.fcg_standard_server_commit_gacha[^\n]+[\s\S]+to authenticated/i);
});
