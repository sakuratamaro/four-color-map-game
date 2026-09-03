"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const transaction = fs.readFileSync(path.join(root, "supabase", "migrations", "202609030010_standard_online_cosmetics.sql"), "utf8");
const snapshot = fs.readFileSync(path.join(root, "supabase", "migrations", "202609030011_standard_member_appearance.sql"), "utf8");

test("cosmetic receipts are private, actor-scoped, collision-safe, and CAS committed", () => {
  assert.match(transaction, /create table if not exists fcg_private\.standard_cosmetic_receipts/i);
  assert.match(transaction, /primary key \(user_id, action_id\)/i);
  assert.match(transaction, /enable row level security/i);
  assert.match(transaction, /where receipt\.user_id = p_user_id and receipt\.action_id = p_action_id/i);
  assert.match(transaction, /action_fingerprint <> p_action_fingerprint[\s\S]+errcode = '23505'/i);
  const commit = transaction.slice(transaction.indexOf("create or replace function public.fcg_standard_server_commit_cosmetic"));
  assert.match(commit, /select profile\.revision[\s\S]+for update/i);
  assert.match(commit, /v_current <> p_expected_revision[\s\S]+errcode = 'PT409'/i);
  assert.match(commit, /update public\.fcg_standard_profiles[\s\S]+profile_state = p_profile_state/i);
  assert.match(commit, /insert into fcg_private\.standard_cosmetic_receipts/i);
  assert.doesNotMatch(transaction, /grant execute[^;]+to authenticated/i);
  assert.match(transaction, /grant execute[\s\S]+to service_role/i);
});

test("room snapshots expose only allowlisted equipped appearance", () => {
  assert.match(snapshot, /join public\.fcg_room_members actor[\s\S]+actor\.user_id=v_user_id/i);
  assert.match(snapshot, /'appearance',jsonb_build_object/i);
  for (const id of ["boardAurora", "effectPrism", "nameplateGold", "titleArtisan"]) assert.match(snapshot, new RegExp(id));
  assert.match(snapshot, /else 'boardDefault' end/i);
  assert.match(snapshot, /else 'effectDefault' end/i);
  assert.match(snapshot, /else 'nameplateDefault' end/i);
  assert.match(snapshot, /else 'titleNone' end/i);
  assert.doesNotMatch(snapshot, /'profile_state',member_profile\.profile_state/i);
});
