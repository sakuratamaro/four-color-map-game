"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createHash } = require("node:crypto");
const root = path.join(__dirname, "..");
const sql = fs.readFileSync(path.join(root, "supabase/migrations/202609130001_standard_cpu_split_rescue.sql"), "utf8");
const previous = fs.readFileSync(path.join(root, "supabase/migrations/202609050005_standard_kurogane_lookahead.sql"), "utf8");
const roster = require("../standard/standard-cpu-roster.js");
function body(source, name) {
  const start = source.indexOf("create or replace function " + name);
  const next = source.indexOf("create or replace function ", start + 1);
  assert.ok(start >= 0, name);
  return source.slice(start, next < 0 ? source.length : next);
}
const start = body(sql, "public.fcg_standard_server_start_cpu");

test("UDL051 additive migration replaces only two private policy helpers and the start replay boundary", () => {
  assert.deepEqual([...sql.matchAll(/create or replace function ([\w.]+)/g)].map(m => m[1]), [
    "fcg_private.fcg_standard_cpu_policy_is_supported", "fcg_private.fcg_standard_cpu_policy_is_current",
    "public.fcg_standard_server_start_cpu",
  ]);
  assert.doesNotMatch(sql, /(?:create|alter|drop)\s+(?:table|schema|policy)|truncate\s|delete\s+from/i);
  assert.doesNotMatch(sql, /update\s+public\.fcg_rooms\s+set[\s\S]*cpu_policy_version/i);
  for (const name of ["fcg_standard_cpu_policy_is_supported", "fcg_standard_cpu_policy_is_current"]) {
    const helper = body(sql, "fcg_private." + name);
    assert.match(helper, /language sql\s+immutable\s+set search_path = ''/);
    assert.match(helper, /when p_character_id in \('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei'\)/);
    assert.match(helper, /'standard-character-roster-v1:' \|\| p_character_id/);
    assert.match(helper, /'standard-character-split-rescue-v1:' \|\| p_character_id/);
    assert.match(helper, /else false/);
    assert.match(helper, /select coalesce\(case[\s\S]*end, false\)/, "SQL NULL must not bypass a NOT supported/current guard");
    assert.doesNotMatch(helper, /\blike\b|\bilike\b/i);
    assert.match(sql, new RegExp("revoke all on function fcg_private\\." + name + "\\(text, text\\) from public, anon, authenticated"));
  }
  const current = body(sql, "fcg_private.fcg_standard_cpu_policy_is_current");
  assert.doesNotMatch(current, /'standard-character-roster-v1:kurogane'/);
  assert.match(current, /'standard-character-roster-v1:kurogane-lookahead-v2'/);
  assert.match(current, /'standard-character-split-rescue-v1:kurogane'/);
  assert.match(start, /security definer\s+set search_path = ''/);
  assert.match(start, /revoke all on function public\.fcg_standard_server_start_cpu\([^)]+\)\s+from public, anon, authenticated/);
  assert.match(start, /grant execute on function public\.fcg_standard_server_start_cpu\([^)]+\)\s+to service_role/);
});

test("start transition hashes every original input and uses an exact same-character supported version set", () => {
  const compat = start.slice(start.indexOf("select array_agg"), start.indexOf("if fcg_private.fcg_standard_matchmaking_rate_limited"));
  for (const field of ["operation", "character_id", "policy_version", "display_name", "profile_state", "loadout", "loadout_fingerprint"]) {
    assert.match(compat, new RegExp("'" + field + "'"));
  }
  assert.match(compat, /where fcg_private\.fcg_standard_cpu_policy_is_supported\(p_character_id, compatible\.policy_version\)/);
  assert.match(compat, /'standard-character-split-rescue-v1:' \|\| p_character_id/);
  assert.match(compat, /'standard-character-roster-v1:' \|\| p_character_id/);
  assert.match(compat, /case when p_character_id = 'kurogane'\s+then 'standard-character-roster-v1:kurogane-lookahead-v2' end/);
  const replay = start.slice(start.indexOf("select receipt.* into v_receipt"), start.indexOf("if not fcg_private.fcg_standard_cpu_policy_is_current"));
  assert.match(replay, /if not coalesce\(v_receipt\.action_fingerprint = any\(v_compatible_fingerprints\), false\)/);
  assert.doesNotMatch(replay, /v_receipt\.cpu_character_id\s*(?:=|<>|is distinct from)/i);
  assert.match(replay, /CPU start action ID reused with different input/);
});

test("start rate, lock, receipt-before-current gate and all subsequent mutations remain unchanged", () => {
  const old = body(previous, "public.fcg_standard_server_start_cpu");
  const anchor = "  if not fcg_private.fcg_standard_cpu_policy_is_current";
  assert.equal(start.slice(start.indexOf(anchor)).trim(), old.slice(old.indexOf(anchor)).trim());
  const rate = "  if fcg_private.fcg_standard_matchmaking_rate_limited";
  const receipt = "  if found then";
  assert.equal(start.slice(start.indexOf(rate), start.indexOf(receipt, start.indexOf(rate))),
    old.slice(old.indexOf(rate), old.indexOf(receipt, old.indexOf(rate))));
  assert.ok(start.indexOf("select receipt.* into v_receipt") < start.indexOf(anchor));
  for (const name of ["public.fcg_standard_server_accept_cpu", "public.fcg_standard_server_request_cpu_rematch"]) {
    const unchanged = body(previous, name);
    const gate = unchanged.indexOf("if not fcg_private.fcg_standard_cpu_policy_is_current");
    const replay = name.endsWith("accept_cpu") ? unchanged.indexOf("if v_ticket.state = 'claimed'") : unchanged.indexOf("select receipt.* into v_receipt");
    assert.ok(replay >= 0 && gate > replay);
    assert.match(unchanged, /fcg_standard_cpu_policy_is_supported\((?:room|v_room)\.cpu_character_id, (?:room|v_room)\.cpu_policy_version\)/);
  }
});

// Executable fingerprint model only: these assertions are not PostgreSQL runtime
// validation. SQL source contracts above bind the actual all-field hash query.
test("fingerprint model allows policy-only bidirectional retries but rejects every changed request field", () => {
  const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  for (const id of Object.keys(roster.CPU_CHARACTERS)) {
    const versions = [roster.CPU_CHARACTERS[id].policyVersion, roster.PRE_SPLIT_POLICY_VERSIONS[id]];
    if (id === "kurogane") versions.push(roster.KUROGANE_LEGACY_POLICY_VERSION);
    const request = { operation: "cpu-start", character_id: id, policy_version: versions[0],
      display_name: roster.CPU_CHARACTERS[id].name, profile_state: { coins: 0 },
      loadout: roster.CPU_CHARACTERS[id].loadout, loadout_fingerprint: "a".repeat(64) };
    const fingerprints = versions.map(v => hash({ ...request, policy_version: v }));
    for (const version of versions) assert.ok(fingerprints.includes(hash({ ...request, policy_version: version })));
    for (const field of ["operation", "character_id", "display_name", "profile_state", "loadout", "loadout_fingerprint"]) {
      assert.equal(fingerprints.includes(hash({ ...request, [field]: "changed" })), false, id + "/" + field);
    }
    assert.equal(fingerprints.includes(hash({ ...request, policy_version: "invented" })), false);
  }
});
