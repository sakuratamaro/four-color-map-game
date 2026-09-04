"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-realtime-smoke.mjs"), "utf8");

test("live Realtime smoke is opt-in, bounded, and follows the public room-update contract", () => {
  assert.match(source, /--confirm-live/);
  assert.match(source, /35_000/);
  assert.match(source, /AbortSignal\.timeout\(15_000\)/);
  assert.match(source, /CLEANUP_ROOM/);
  assert.match(source, /realtime:public:fcg_rooms:id=eq\.\$\{roomId\}/);
  assert.match(source, /postgres_changes: \[\{ event: "UPDATE", schema: "public", table: "fcg_rooms"/);
  assert.match(source, /member\.messages\.some\(isDatabaseChange\)[\s\S]*8_000/);
  assert.doesNotMatch(source, /fcg_room_members|fcg_player_views/);
});
