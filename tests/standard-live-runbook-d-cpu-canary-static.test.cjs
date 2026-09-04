"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-runbook-d-cpu-canary.mjs"), "utf8");

test("Runbook D canary is explicit, finite, and preserves real 90/180 second gates", () => {
  const guard = source.indexOf('process.argv.includes("--confirm-live")');
  const firstAnonymous = source.indexOf('anonymous("race host")');
  assert.ok(guard >= 0 && firstAnonymous > guard);
  assert.match(source, /const CPU_FIRST_OFFER_MS = 90_000/);
  assert.match(source, /const CPU_SECOND_OFFER_MS = 180_000/);
  assert.match(source, /waitForTicketAge\(raceTicket, CPU_FIRST_OFFER_MS\)/);
  assert.match(source, /waitForTicketAge\(raceTicket, CPU_SECOND_OFFER_MS\)/);
  assert.match(source, /serverAgeMs >= minimumAgeMs[\s\S]+performance\.now\(\) - ticket\.observedAt >= minimumAgeMs/);
  assert.match(source, /const HARD_TIMEOUT_MS = 600_000/);
  assert.match(source, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.doesNotMatch(source, /(?:OFFER_MS|minimumAgeMs)\s*\/|FAKE|SHORTEN|process\.env\.[A-Z_]*WAIT/i);
});

test("Runbook D canary covers roster, consent, three completions, recovery, and same-CPU rematches", () => {
  assert.match(source, /roster\.length === 10/);
  assert.match(source, /character\.strength/);
  assert.match(source, /character\.weakness/);
  assert.match(source, /character\.favorites\.length === 2/);
  assert.match(source, /\["yuzu", "shion", "kurogane"\]/);
  assert.match(source, /CPU_CONSENT_TOO_EARLY/);
  for (const contract of [
    'operation: "cpu-roster"',
    "fcg_standard_matchmaking_recruit",
    "fcg_standard_matchmaking_status",
    'operation: "cpu-accept"',
    'operation: "cpu-action"',
    '"SURRENDER"',
    "fcg_standard_room_snapshot_v2",
    'operation: "cpu-rematch"',
    "same CPU rematch established",
  ]) assert.ok(source.includes(contract), contract);
  assert.match(source, /Promise\.allSettled\(\[[\s\S]+accepted\.map\(runRepresentativeMatch\)/);
  assert.match(source, /CPU aggregate stats updated/);
  assert.match(source, /CPU character stats updated/);
  assert.match(source, /CPU identity visible/);
  assert.match(source, /human opening created/);
  assert.doesNotMatch(source, /human opening colored/);
});

test("Runbook D canary tests the human/CPU resolution race without cleanup or sensitive output", () => {
  assert.match(source, /Promise\.all\(\[\s*edge\(raceHost,[\s\S]+fcg_standard_matchmaking_find/);
  assert.match(source, /Number\(cpuWon\) \+ Number\(humanWon\) === 1/);
  assert.match(source, /resolved ticket cannot create a second room/);
  assert.doesNotMatch(source, /delete(?:User|Room)|remove(?:User|Room)|auth\.admin|service_role/i);
  const outputCalls = source.match(/console\.(?:log|error)\([^\n]+/g) || [];
  for (const call of outputCalls) {
    assert.doesNotMatch(call, /roomId|roomCode|room_id|room_code|userId|user_id|accessToken|access_token|\btoken\b|publishableKey|ticketId|characterId/);
  }
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*JSON\.stringify/);
  assert.match(source, /UNEXPECTED_FAILURE/);
});
