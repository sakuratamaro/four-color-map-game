const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "scripts", "live-standard-runbook-c-canary.mjs"), "utf8");
const onlineApp = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");

test("Runbook C live canary requires an explicit live-write confirmation before configuration or requests", () => {
  const guard = script.indexOf('process.argv.includes("--confirm-live")');
  const configRead = script.indexOf("fs.readFileSync");
  const firstFetch = script.indexOf("fetch(");
  assert.ok(guard >= 0);
  assert.ok(configRead > guard);
  assert.ok(firstFetch > guard);
  assert.match(script, /process\.exit\(2\)/);
});

test("Runbook C live canary has finite global and per-request timeouts", () => {
  assert.match(script, /setTimeout\([\s\S]*180_000\)/);
  assert.match(script, /AbortSignal\.timeout\(20_000\)/);
  assert.doesNotMatch(script, /setInterval\s*\(/);
  assert.doesNotMatch(script, /while\s*\(/);
});

test("Runbook C failures identify the exact failed check without dumping payloads", () => {
  assert.match(script, /failedCheck = error instanceof CanaryFailure \? error\.message : activeStage/);
  assert.match(script, /FAIL  \$\{activeStage\}: \$\{failedCheck\} \(\$\{detail\}\)/);
  assert.doesNotMatch(script, /console\.error\([^\n]*JSON\.stringify/);
});

test("Runbook C live canary covers matchmaking, concurrency, finish, and re-search contracts", () => {
  for (const required of [
    "fcg_standard_matchmaking_recruit",
    "fcg_standard_matchmaking_find",
    "fcg_standard_matchmaking_status",
    "fcg_standard_matchmaking_cancel",
    "two simultaneous finders",
    "cancel versus find race",
    "ten simultaneous claims",
    "CREATE_REGION",
    "SURRENDER",
    "public match finished",
    "public reload snapshots agree",
    "finished player can recruit again",
  ]) assert.ok(script.includes(required), `missing ${required}`);
  assert.match(script, /doubleMatches\.length === 1 && doubleMisses\.length === 1/);
  assert.match(script, /bulkMatches\.length === 1 && bulkMisses\.length === 9/);
  assert.match(script, /cancelWon \|\| findWon/);
  assert.match(script, /claimantLabels = \["B", "H", "I", "J", "K", "L", "M", "N", "O", "P"\]/);
});

test("Runbook C live canary never retries or cleans up live records", () => {
  assert.doesNotMatch(script, /\bretry\b/i);
  assert.doesNotMatch(script, /\bcleanup\b/i);
  assert.doesNotMatch(script, /delete(?:_user|User|Room|Ticket|Matchmaking)/);
  assert.doesNotMatch(script, /service[_-]?role/i);
});

test("Runbook C evidence and public UI do not disclose secrets or identifiers", () => {
  assert.match(script, /"room_code", "roomCode", "code_hash", "codeHash"/);
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*(?:token|publishableKey|roomId|room_id|ticketId|ticket_id|user\.id|JSON\.stringify)/);
  assert.match(onlineApp, /accessMode === "public_queue" \? "野良対戦"/);
  assert.doesNotMatch(onlineApp, /accessMode === "public_queue" \?\s*(?:snapshot\.)?roomCode/);
});
