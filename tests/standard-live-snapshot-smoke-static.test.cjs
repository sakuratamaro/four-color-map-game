"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-room-snapshot-smoke.mjs"), "utf8");

test("live snapshot smoke is explicit, bounded, and tests profile-delta bytes", () => {
  const guard = source.indexOf('process.argv.includes("--confirm-live")');
  const firstAnonymous = source.indexOf("anonymous()");
  assert.ok(guard >= 0 && firstAnonymous > guard);
  assert.match(source, /90_000/);
  assert.match(source, /fcg_standard_room_snapshot_v2/);
  assert.match(source, /p_known_profile_revision: snapshotA\.profile_revision/);
  assert.match(source, /assert\.equal\(deltaA\.profile, null\)/);
  assert.match(source, /assert\.ok\(deltaBytes < fullBytes/);
  assert.match(source, /savedSnapshotBytes: fullBytes - deltaBytes/);
  assert.doesNotMatch(source, /console\.log\([^\n]*(?:accessToken|publishableKey|userId)/);
});
