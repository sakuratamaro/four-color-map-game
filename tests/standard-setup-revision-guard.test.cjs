"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "202609060002_standard_setup_revision_guard.sql"), "utf8");
const originalRpcMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "202609020002_standard_online_match_rpc.sql"), "utf8");
const candidateVerification = fs.readFileSync(path.join(root, "supabase", "verification", "standard_candidate_verify.sql"), "utf8");
const edgeSource = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");

test("setup revision guard is additive and retains the deployed six-argument initializer", () => {
  assert.doesNotMatch(migration, /\b(?:drop|truncate|delete\s+from)\b/i);
  assert.match(originalRpcMigration, /create or replace function public\.fcg_standard_server_initialize_room\(\s*p_room_id uuid,\s*p_expected_version bigint,\s*p_authoritative_state jsonb,\s*p_public_state jsonb,\s*p_private_a jsonb,\s*p_private_b jsonb\s*\)/i);
  assert.match(migration, /create function public\.fcg_standard_server_initialize_room\(\s*p_room_id uuid,\s*p_expected_version bigint,\s*p_setup_a_revision bigint,\s*p_setup_b_revision bigint,\s*p_authoritative_state jsonb,\s*p_public_state jsonb,\s*p_private_a jsonb,\s*p_private_b jsonb\s*\)/i);
  assert.doesNotMatch(migration, /create\s+or\s+replace\s+function public\.fcg_standard_server_initialize_room/i);
});

test("v3 loads each setup revision beside its loadout in one service-only snapshot", () => {
  assert.match(migration, /create function public\.fcg_standard_server_load_room_v3\(p_room_id uuid, p_actor_id uuid\)/i);
  assert.match(migration, /access_mode text, setup_a_revision bigint, setup_b_revision bigint/i);
  assert.match(migration, /actor_view\.private_state, setup_a\.loadout, setup_b\.loadout,[\s\S]+room\.access_mode, setup_a\.setup_revision, setup_b\.setup_revision/i);
  assert.match(migration, /join public\.fcg_room_members actor on actor\.room_id = room\.id and actor\.user_id = p_actor_id/i);
  assert.match(migration, /revoke all on function public\.fcg_standard_server_load_room_v3\(uuid, uuid\)\s+from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.fcg_standard_server_load_room_v3\(uuid, uuid\)\s+to service_role/i);
  assert.match(edgeSource, /service\.rpc\("fcg_standard_server_load_room_v3", \{ p_room_id: roomId, p_actor_id: actorId \}\)/);
});

test("initializer rejects a setup changed after the Edge snapshot before persisting authority", () => {
  const initializer = migration.slice(
    migration.indexOf("create function public.fcg_standard_server_initialize_room"),
    migration.indexOf("revoke all on function public.fcg_standard_server_load_room_v3"),
  );
  const roomLock = initializer.indexOf("from public.fcg_rooms room");
  const setupALock = initializer.indexOf("setup.seat = 'A'");
  const setupBLock = initializer.indexOf("setup.seat = 'B'");
  const revisionGuard = initializer.indexOf("v_setup_a.setup_revision <> p_setup_a_revision");
  const authorityInsert = initializer.indexOf("insert into fcg_private.authoritative_matches");
  assert.ok(roomLock >= 0 && roomLock < setupALock && setupALock < setupBLock && setupBLock < revisionGuard && revisionGuard < authorityInsert);
  assert.match(initializer, /v_setup_a\.setup_revision <> p_setup_a_revision\s+or v_setup_b\.setup_revision <> p_setup_b_revision[\s\S]+raise exception 'stale setup revision' using errcode = 'PT409'/i);
  assert.match(edgeSource, /const setupARevision = Number\(room\.setup_a_revision\);[\s\S]+const setupBRevision = Number\(room\.setup_b_revision\)/);
  assert.match(edgeSource, /p_setup_a_revision: setupARevision,\s*p_setup_b_revision: setupBRevision/);
});

test("ordinary setup retries keep the pre-lab fingerprint while lab opt-in is bound", () => {
  const setup = edgeSource.slice(edgeSource.indexOf('if (operation === "setup")'), edgeSource.indexOf('stage = "load-room"'));
  assert.match(setup, /fingerprint\(\{\s*roomId, actorId, profileRevision: profile\.revision, loadout, debugMode,\s*\.\.\.\(labMode \? \{ labMode: true \} : \{\}\),\s*\}\)/);
  assert.doesNotMatch(setup, /fingerprint\(\{[^}]*debugMode, labMode\s*\}\)/);
});

test("new setup guard RPCs remain service-role only with an empty search path", () => {
  const definitions = migration.match(/create function public\.[\s\S]+?\$\$;/gi) || [];
  assert.equal(definitions.length, 2);
  for (const definition of definitions) assert.match(definition, /security definer\s+set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.fcg_standard_server_initialize_room\(uuid, bigint, bigint, bigint, jsonb, jsonb, jsonb, jsonb\)\s+from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.fcg_standard_server_initialize_room\(uuid, bigint, bigint, bigint, jsonb, jsonb, jsonb, jsonb\)\s+to service_role/i);
  assert.match(candidateVerification, /'public\.fcg_standard_server_load_room_v3\(uuid,uuid\)', 'service_role'/);
  assert.match(candidateVerification, /'public\.fcg_standard_server_initialize_room\(uuid,bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb\)', 'service_role'/);
});
