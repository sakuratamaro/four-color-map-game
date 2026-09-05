"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-immediate-cpu-rematch-canary.mjs"), "utf8");

test("immediate CPU flow canary is explicit, finite, and uses one anonymous user", () => {
  const guard = source.indexOf('process.argv.includes("--confirm-live")');
  const signup = source.indexOf('request("/auth/v1/signup"');
  assert.ok(guard >= 0 && signup > guard);
  assert.match(source, /const HARD_TIMEOUT_MS = 120_000/);
  assert.match(source, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.equal((source.match(/request\("\/auth\/v1\/signup"/g) || []).length, 1);
  assert.match(source, /CPUFlowCanary-0905/);
});

test("immediate CPU flow canary covers a result and same-character reinitialization without a 90-second ticket", () => {
  for (const contract of [
    'operation: "cpu-start"',
    'operation: "setup"',
    'operation: "initialize"',
    'operation: "cpu-action"',
    '"SURRENDER"',
    'operation: "cpu-rematch"',
    "fcg_standard_room_snapshot_v2",
    "CPU loss settlement persisted",
    "same CPU rematch requested",
    "same CPU rematch reinitialized",
  ]) assert.ok(source.includes(contract), contract);
  assert.match(source, /cpu_character_id === CHARACTER_ID/);
  assert.match(source, /cpuMember\?\.display_name === CHARACTER_NAME/);
  assert.match(source, /publicState\?\.matchId !== firstMatchId/);
  assert.doesNotMatch(source, /matchmaking_recruit|cpu-accept|CPU_FIRST_OFFER|90_000|waitForTicketAge/);
});

test("immediate CPU flow canary does not clean up or print live identifiers and secrets", () => {
  assert.doesNotMatch(source, /delete(?:User|Room)|remove(?:User|Room)|auth\.admin|service_role/i);
  const outputCalls = source.match(/console\.(?:log|error)\([^\n]+/g) || [];
  for (const call of outputCalls) {
    assert.doesNotMatch(call, /roomId|roomCode|room_id|room_code|userId|user_id|accessToken|access_token|\btoken\b|publishableKey/);
  }
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*JSON\.stringify/);
  assert.match(source, /UNEXPECTED_FAILURE/);
});
