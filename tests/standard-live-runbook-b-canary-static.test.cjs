"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "scripts", "live-standard-runbook-b-canary.mjs"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");
const bundleTests = fs.readFileSync(path.join(root, "tests", "standard-online-engine-bundle.test.cjs"), "utf8");
const profileTests = fs.readFileSync(path.join(root, "tests", "standard-profile.test.cjs"), "utf8");
const transactionTests = fs.readFileSync(path.join(root, "tests", "standard-root-transaction.test.cjs"), "utf8");

test("Runbook B canary is explicit, bounded, and never uses privileged cleanup", () => {
  const guard = source.indexOf('process.argv.includes("--confirm-live")');
  const firstAnonymous = source.indexOf('anonymous("A")');
  assert.ok(guard >= 0 && firstAnonymous > guard);
  assert.match(source, /180_000/);
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
  assert.match(source, /RunbookB-Canary-A/);
  assert.match(source, /RunbookB-Canary-B/);
  assert.doesNotMatch(source, /delete(?:User|Room)|remove(?:User|Room)|auth\.admin|service_role/i);
});

test("Runbook B canary covers economy retries, cancellation, lock, settlement, and cold restore", () => {
  for (const contract of [
    'operation: "quiz-start"',
    'operation: "quiz-finish"',
    'operation: "gacha"',
    'operation: "card-sale-quote"',
    'operation: "card-sale"',
    'confirmed: false',
    'operation: "cosmetic-quote"',
    'operation: "cosmetic-action"',
    "fcg_standard_room_snapshot_v2",
    '"SURRENDER"',
    "duplicate === true",
    "CARD_SALE_MATCH_LOCKED",
    "known profile revision omits duplicate body",
  ]) assert.ok(source.includes(contract), contract);
  assert.match(source, /for \(let round = 1; round <= 3; round \+= 1\)/);
  assert.match(source, /paid cosmetic is owned once/);
  assert.match(source, /surrender trophy state is stable/);
  assert.match(source, /NOT_COVERED  New fullPaint trophy unlock/);
});

test("Runbook B uses public quiz facts without accepting an answer key", () => {
  assert.match(source, /forbiddenQuizKey\(started\.data\.questions\)/);
  assert.match(source, /solveQuestion/);
  assert.match(source, /question\.templateId/);
  assert.doesNotMatch(source, /started\.data\.(?:answerIds|answer_ids|correctAnswer)/);
  assert.match(edge, /p_answer_ids: challenge\.answerIds/);
  assert.doesNotMatch(edge, /return json\(200, \{[\s\S]{0,400}answerIds/);
});

test("Runbook B output cannot print live credentials or identifiers", () => {
  const outputCalls = source.match(/console\.(?:log|error)\([^\n]+/g) || [];
  for (const call of outputCalls) {
    assert.doesNotMatch(call, /roomId|roomCode|room_id|room_code|userId|user_id|sessionId|actionId|accessToken|access_token|\btoken\b|publishableKey/);
  }
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*JSON\.stringify/);
  assert.match(source, /\^\[A-Z0-9_\]\{1,64\}\$/);
  assert.match(source, /UNEXPECTED_FAILURE/);
});

test("full-paint trophy acquisition remains covered by deterministic transaction tests", () => {
  assert.match(profileTests, /wins, losses, streaks, history, and full-paint trophies are recorded once/);
  assert.match(profileTests, /trophies\.fullPaint3/);
  assert.match(transactionTests, /derives full-paint trophies/);
  assert.match(transactionTests, /trophies\.noSkillFullPaint/);
  assert.match(bundleTests, /terminal profile settlement is derived from the accepted authoritative state/);
});
