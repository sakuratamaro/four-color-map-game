"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-runbook-a-canary.mjs"), "utf8");

test("Runbook A canary is explicit, bounded, and leaves its canary data intact", () => {
  const guard = source.indexOf('process.argv.includes("--confirm-live")');
  const firstAnonymous = source.indexOf("anonymous(\"A\")");
  assert.ok(guard >= 0 && firstAnonymous > guard);
  assert.match(source, /90_000/);
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
  assert.match(source, /RunbookA-Canary-A/);
  assert.match(source, /RunbookA-Canary-B/);
  assert.doesNotMatch(source, /delete(?:User|Room)|remove(?:User|Room)|auth\.admin|service_role/i);
});

test("Runbook A canary covers the private-room lifecycle through a started rematch", () => {
  for (const contract of [
    "fcg_standard_create_room",
    "fcg_standard_join_room",
    "fcg_standard_room_snapshot_v2",
    'operation: "profile"',
    'operation: "setup"',
    'operation: "initialize"',
    '"CREATE_REGION"',
    'check("post-opening active seat projected"',
    '"SURRENDER"',
    "fcg_standard_request_rematch",
    'check("rematch established"',
  ]) assert.ok(source.includes(contract), contract);
  assert.match(source, /anonymous\("outsider"\)/);
  assert.match(source, /outsider snapshot rejected/);
  assert.match(source, /outsider Edge access rejected/);
  assert.match(source, /finished snapshot A response/);
  assert.match(source, /finished snapshot B response/);
});

test("Runbook A canary never prints live identifiers or credentials", () => {
  const outputCalls = source.match(/console\.(?:log|error)\([^\n]+/g) || [];
  for (const call of outputCalls) {
    assert.doesNotMatch(call, /roomId|roomCode|room_id|room_code|userId|user_id|accessToken|access_token|\btoken\b|publishableKey/);
  }
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*JSON\.stringify/);
  assert.match(source, /\^\[A-Z0-9_\]\{1,64\}\$/);
  assert.match(source, /UNEXPECTED_FAILURE/);
});
