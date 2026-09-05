"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609050005_standard_kurogane_lookahead.sql"), "utf8");

function startReplayAllowed(receiptFingerprint, currentFingerprint, legacyFingerprint = null) {
  return receiptFingerprint === currentFingerprint || receiptFingerprint === legacyFingerprint;
}

test("Kurogane migration recognizes only exact legacy/current policies and leaves all other identities at v1", () => {
  assert.match(sql, /fcg_standard_cpu_policy_is_supported/);
  assert.match(sql, /fcg_standard_cpu_policy_is_current/);
  assert.match(sql, /standard-character-roster-v1:kurogane'/);
  assert.match(sql, /standard-character-roster-v1:kurogane-lookahead-v2/);
  assert.match(sql, /when p_character_id in \('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei'\)[\s\S]+standard-character-roster-v1:' \|\| p_character_id/i);
  assert.doesNotMatch(sql, /like\s+['"]%kurogane/i);
});

test("new CPU rooms require current policy but legacy retries remain replayable", () => {
  for (const functionName of ["fcg_standard_server_accept_cpu", "fcg_standard_server_start_cpu"]) {
    const start = sql.indexOf(`create or replace function public.${functionName}`);
    const end = sql.indexOf("create or replace function public.", start + 1);
    const body = sql.slice(start, end < 0 ? sql.length : end);
    const replay = functionName.endsWith("accept_cpu") ? body.indexOf("v_ticket.state = 'claimed'") : body.indexOf("if found then");
    const currentGate = body.indexOf("fcg_standard_cpu_policy_is_current", replay);
    assert.ok(replay >= 0 && currentGate > replay, functionName);
    assert.match(body, /retired Standard CPU policy cannot create a room/);
    assert.match(body, /cpu_character_id, cpu_policy_version, cpu_user_id\)[\s\S]+p_character_id, p_policy_version, p_cpu_user_id/i);
  }
});

test("accept retry recovers a claimed legacy room after Edge starts sending current Kurogane policy", () => {
  const start = sql.indexOf("create or replace function public.fcg_standard_server_accept_cpu");
  const end = sql.indexOf("create or replace function public.fcg_standard_server_start_cpu", start);
  const body = sql.slice(start, end);
  const claimed = body.slice(body.indexOf("if v_ticket.state = 'claimed'"), body.indexOf("if not fcg_private.fcg_standard_cpu_policy_is_current"));
  assert.match(claimed, /room\.cpu_character_id = p_character_id/);
  assert.match(claimed, /fcg_standard_cpu_policy_is_supported\(room\.cpu_character_id, room\.cpu_policy_version\)/);
  assert.doesNotMatch(claimed, /room\.cpu_policy_version = p_policy_version/);
});

test("start receipt exact replay ignores recovered room identity and remains fingerprint-authoritative", () => {
  const start = sql.indexOf("create or replace function public.fcg_standard_server_start_cpu");
  const end = sql.indexOf("create or replace function public.fcg_standard_server_request_cpu_rematch", start);
  const body = sql.slice(start, end);
  const replay = body.slice(body.indexOf("select receipt.* into v_receipt"), body.indexOf("if not fcg_private.fcg_standard_cpu_policy_is_current"));
  assert.match(replay, /v_receipt\.action_fingerprint <> v_fingerprint/);
  assert.doesNotMatch(replay, /v_receipt\.cpu_character_id[^,\n]*[<>=]/);
  assert.match(replay, /return query select v_receipt\.room_id, v_receipt\.seat, v_receipt\.opponent_kind/);
  assert.equal(startReplayAllowed("exact-request", "exact-request"), true);
});

test("start receipt permits only an exact Kurogane v1-to-v2 policy fingerprint transition", () => {
  const start = sql.indexOf("create or replace function public.fcg_standard_server_start_cpu");
  const end = sql.indexOf("create or replace function public.fcg_standard_server_request_cpu_rematch", start);
  const body = sql.slice(start, end);
  const legacy = body.slice(body.indexOf("if p_character_id = 'kurogane'"), body.indexOf("if fcg_private.fcg_standard_matchmaking_rate_limited"));
  assert.match(legacy, /p_policy_version = 'standard-character-roster-v1:kurogane-lookahead-v2'/);
  assert.match(legacy, /v_legacy_fingerprint := encode\(extensions\.digest/);
  for (const field of ["operation", "character_id", "display_name", "profile_state", "loadout", "loadout_fingerprint"]) {
    assert.match(legacy, new RegExp(`'${field}'`));
  }
  assert.match(legacy, /'policy_version', 'standard-character-roster-v1:kurogane'/);
  const replay = body.slice(body.indexOf("select receipt.* into v_receipt"), body.indexOf("if not fcg_private.fcg_standard_cpu_policy_is_current"));
  assert.match(replay, /v_receipt\.action_fingerprint is distinct from v_legacy_fingerprint/);
  assert.equal(startReplayAllowed("legacy-kurogane", "current-kurogane", "legacy-kurogane"), true);
});

test("changing a replay to the recovered room character still fails because character is fingerprinted", () => {
  const start = sql.indexOf("create or replace function public.fcg_standard_server_start_cpu");
  const end = sql.indexOf("create or replace function public.fcg_standard_server_request_cpu_rematch", start);
  const body = sql.slice(start, end);
  assert.equal((body.match(/'character_id', p_character_id/g) || []).length, 2);
  assert.match(body, /v_receipt\.action_fingerprint <> v_fingerprint[\s\S]+v_receipt\.action_fingerprint is distinct from v_legacy_fingerprint[\s\S]+CPU start action ID reused with different input/);
  assert.doesNotMatch(body, /v_receipt\.cpu_character_id\s*(?:=|<>|is distinct from)/i);
  assert.equal(startReplayAllowed("original-kurogane", "tampered-yuzu", null), false);
});

test("CPU rematch accepts a supported stored legacy policy then atomically upgrades the room", () => {
  const start = sql.indexOf("create or replace function public.fcg_standard_server_request_cpu_rematch");
  const body = sql.slice(start);
  const replay = body.indexOf("select receipt.* into v_receipt");
  const currentGate = body.indexOf("fcg_standard_cpu_policy_is_current", replay);
  assert.ok(replay >= 0 && currentGate > replay);
  assert.match(body, /fcg_standard_cpu_policy_is_supported\(v_room\.cpu_character_id, v_room\.cpu_policy_version\)/);
  assert.match(body, /expires_at = now\(\) \+ interval '24 hours', cpu_policy_version = p_policy_version/);
  assert.doesNotMatch(body, /v_room\.cpu_policy_version <> p_policy_version/);
});

test("all replaced policy boundaries remain service-only", () => {
  for (const signature of [
    "fcg_standard_server_accept_cpu",
    "fcg_standard_server_start_cpu",
    "fcg_standard_server_request_cpu_rematch",
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${signature}\\([^)]+\\)[\\s\\S]+?from public, anon, authenticated`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature}\\([^)]+\\)[\\s\\S]+?to service_role`, "i"));
  }
});
