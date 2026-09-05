"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-release-preflight.mjs"), "utf8");

test("release preflight is read-only, secret-free, finite, and stage-aware", () => {
  assert.match(source, /publishableKey/);
  assert.doesNotMatch(source, /serviceRole|service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /auth\/v1\/(?:signup|admin)|anonymous\(\)/);
  assert.doesNotMatch(source, /create_room|join_room|cpu-accept|quiz-start|gacha|cosmetic-action/);
  assert.match(source, /00000000-0000-0000-0000-000000000000/);
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
  for (const phase of ["baseline", "db-ready", "candidate"]) assert.match(source, new RegExp(`"${phase}"`));
  assert.match(source, /fcg_standard_room_snapshot_v2/);
  assert.match(source, /fcg_standard_matchmaking_recruit/);
  assert.match(source, /fcg_standard_abandon_room/);
  assert.match(source, /hasPregameAbandon/);
  assert.match(source, /SNAPSHOT_V2_BASELINE_MISSING/);
  assert.match(source, /PUBLIC_BASELINE_UI_MISSING/);
  assert.doesNotMatch(source, /console\.log\([^\n]*(?:publishableKey|authorization)/);
});
