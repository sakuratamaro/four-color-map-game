const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-immediate-cpu-canary.mjs"), "utf8");

test("immediate CPU live canary is finite and explicitly gated", () => {
  const guard = source.indexOf('process.argv.includes("--confirm-live")');
  const signup = source.indexOf('request("/auth/v1/signup"');
  assert.ok(guard >= 0 && signup > guard);
  assert.match(source, /setTimeout\([\s\S]+60_000/);
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
});

test("immediate CPU live canary covers create, retry collision, and projection", () => {
  assert.match(source, /operation: "cpu-start"/);
  assert.match(source, /startStatus === "created"/);
  assert.match(source, /startStatus === "duplicate"/);
  assert.match(source, /IDEMPOTENCY_KEY_REUSE/);
  assert.match(source, /fcg_standard_room_snapshot_v2/);
  assert.match(source, /cpu_character_id === "yuzu"/);
  assert.match(source, /display_name === "うっかりユズ"/);
});
