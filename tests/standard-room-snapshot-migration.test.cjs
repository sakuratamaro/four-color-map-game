"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609030005_standard_room_snapshot.sql"), "utf8");

test("snapshot RPC checks the authenticated caller's membership before returning projections", () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /actor\.user_id\s*=\s*v_user_id/i);
  assert.match(migration, /own_view\.user_id\s*=\s*v_user_id/i);
  assert.match(migration, /own_profile\.user_id\s*=\s*v_user_id/i);
  assert.match(migration, /room\.game_mode\s*=\s*'standard_v5'/i);
  assert.match(migration, /grant execute on function public\.fcg_standard_room_snapshot\(uuid\) to authenticated/i);
  assert.doesNotMatch(migration, /grant execute[^;]*\bto\s+(?:public|anon)\b/i);
});

test("snapshot RPC preserves private data separation while returning one JSON document", () => {
  assert.match(migration, /'room',\s*jsonb_build_object/i);
  assert.match(migration, /'members',\s*members\.value/i);
  assert.match(migration, /'view',\s*player_view\.value/i);
  assert.match(migration, /'profile',\s*profile\.value/i);
  assert.match(migration, /'snapshot_schema_version',\s*1/i);
  assert.match(migration, /'snapshot_version',\s*room\.version/i);
  assert.match(migration, /'server_time',\s*statement_timestamp\(\)/i);
  assert.doesNotMatch(migration, /authoritative_matches|fcg_private/i);
});
