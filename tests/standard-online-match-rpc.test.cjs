"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "202609020002_standard_online_match_rpc.sql"), "utf8");
const quick = fs.readFileSync(path.join(root, "supabase", "migrations", "202608280001_online_quick_mvp.sql"));

test("the applied Quick migration remains byte-identical", () => {
  assert.equal(
    crypto.createHash("sha256").update(quick).digest("hex").toUpperCase(),
    "0A9ABEC7DD86F30FEA5DECE458C38DC8DF94590D286A78554980DBB7A15846B3",
  );
});

test("Standard match RPC migration is additive and mode-scoped", () => {
  assert.doesNotMatch(migration, /\b(?:drop|truncate|delete\s+from)\b/i);
  assert.doesNotMatch(migration, /create or replace function public\.fcg_server_/i);
  assert.match(migration, /authority\.game_mode = 'standard_v5'/i);
  assert.match(migration, /v_room\.game_mode <> 'standard_v5'/i);
});

test("server load returns only the caller projection plus service-owned inputs", () => {
  assert.match(migration, /create or replace function public\.fcg_standard_server_load_room/i);
  assert.match(migration, /actor\.user_id = p_actor_id/i);
  assert.match(migration, /actor_view\.user_id = p_actor_id/i);
  assert.match(migration, /actor_private_state jsonb/i);
  assert.match(migration, /setup_a jsonb[\s\S]+setup_b jsonb/i);
  assert.doesNotMatch(migration, /grant execute on function public\.fcg_standard_server_load_room\([^;]+to authenticated/i);
});

test("initialization locks the room and both profile-backed loadout quotes", () => {
  assert.match(migration, /create or replace function public\.fcg_standard_server_initialize_room/i);
  assert.match(migration, /from public\.fcg_rooms room[\s\S]+for update/i);
  assert.match(migration, /setup\.seat = 'A'[\s\S]+for update/i);
  assert.match(migration, /setup\.seat = 'B'[\s\S]+for update/i);
  assert.match(migration, /v_setup_a\.quote_expires_at <= now\(\)[\s\S]+v_setup_b\.quote_expires_at <= now\(\)/i);
  assert.match(migration, /v_profile_a_revision <> v_setup_a\.profile_revision/i);
  assert.match(migration, /v_profile_b_revision <> v_setup_b\.profile_revision/i);
  assert.match(migration, /insert into fcg_private\.authoritative_matches \(room_id, version, state, game_mode\)/i);
});

test("action commit rechecks idempotency under the room lock", () => {
  const receiptQueries = migration.match(/from fcg_private\.standard_action_receipts receipt/g) || [];
  assert.equal(receiptQueries.length, 2);
  assert.match(migration, /v_receipt\.actor_id <> p_actor_id or v_receipt\.action_fingerprint <> p_action_fingerprint/i);
  assert.match(migration, /p_action_fingerprint !~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /primary|insert into fcg_private\.standard_action_receipts/i);
  assert.match(migration, /p_result \|\| jsonb_build_object\('version', p_expected_version \+ 1\)/i);
});

test("match, profile, private projection, public projection, and receipt share one transaction", () => {
  assert.match(migration, /update fcg_private\.authoritative_matches[\s\S]+version = p_expected_version \+ 1/i);
  assert.match(migration, /where room_id = p_room_id[\s\S]+version = p_expected_version/i);
  assert.match(migration, /update public\.fcg_standard_profiles[\s\S]+revision = p_profile_a_expected_revision \+ 1/i);
  assert.match(migration, /update public\.fcg_standard_profiles[\s\S]+revision = p_profile_b_expected_revision \+ 1/i);
  assert.match(migration, /update public\.fcg_player_views[\s\S]+private_state = case when seat = 'A'/i);
  assert.match(migration, /update public\.fcg_rooms[\s\S]+status = case when p_finished/i);
  assert.match(migration, /raise exception 'stale authoritative version' using errcode = 'PT409'/i);
  assert.match(migration, /raise exception 'stale seat A profile revision' using errcode = 'PT409'/i);
  assert.match(migration, /raise exception 'stale seat B profile revision' using errcode = 'PT409'/i);
});

test("every Standard server RPC is service-role only with an empty search path", () => {
  for (const fn of [
    "fcg_standard_server_load_room",
    "fcg_standard_server_initialize_room",
    "fcg_standard_server_commit_action",
  ]) {
    const start = migration.search(new RegExp(`create or replace function public\\.${fn}\\(`, "i"));
    assert.notEqual(start, -1, `${fn} must exist`);
    const end = migration.indexOf("$$;", start);
    assert.match(migration.slice(start, end), /security definer\s+set search_path = ''/i);
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]+?from public, anon, authenticated`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]+?to service_role`, "i"));
  }
});

test("no credential or Realtime secret projection is introduced", () => {
  assert.doesNotMatch(migration, /alter publication supabase_realtime/i);
  assert.doesNotMatch(migration, /sb_secret_/i);
  assert.doesNotMatch(migration, /service_role\s*[:=]\s*['\"][A-Za-z0-9._-]+/i);
  assert.doesNotMatch(migration, /postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/i);
});
