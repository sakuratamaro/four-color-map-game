"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "scripts", "live-standard-runbook-b-canary.mjs"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");
const builder = fs.readFileSync(path.join(root, "scripts", "build-standard-online-engine.mjs"), "utf8");
const bundleTests = fs.readFileSync(path.join(root, "tests", "standard-online-engine-bundle.test.cjs"), "utf8");
const profileTests = fs.readFileSync(path.join(root, "tests", "standard-profile.test.cjs"), "utf8");
const transactionTests = fs.readFileSync(path.join(root, "tests", "standard-root-transaction.test.cjs"), "utf8");
const { STANDARD_SKILLS } = require("../standard/standard-skill-registry.js");
const { coinValueForSkill } = require("../standard/standard-profile.js");

test("Runbook B canary is explicit, bounded, and never uses privileged cleanup", () => {
  const guard = source.indexOf('process.argv.includes("--confirm-live")');
  const firstAnonymous = source.indexOf('anonymous("A")');
  assert.ok(guard >= 0 && firstAnonymous > guard);
  assert.match(source, /240_000/);
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
  assert.match(source, /const QUIZ_ROUNDS = 22/);
  assert.match(source, /round <= QUIZ_ROUNDS/);
  assert.match(source, /paid cosmetic is owned once/);
  assert.match(source, /surrender trophy state is stable/);
  assert.match(source, /NOT_COVERED  New fullPaint trophy unlock/);
});

test("Runbook B uses only the opaque timeout answer and never derives a correct answer from public quiz facts", () => {
  assert.match(source, /forbiddenQuizKey\(started\.data\.questions\)/);
  assert.match(source, /Array\.from\(\{ length: 10 \}, \(\) => started\.data\.timeoutAnswerId\)/);
  assert.match(source, /finished\.data\?\.correct === 0/);
  assert.match(source, /finished\.data\?\.wrong === 10/);
  assert.match(source, /QUIZ_RESCUE_TICKET_LEVEL = 4/);
  assert.doesNotMatch(source, /solveQuestion|numericParts/);
  assert.doesNotMatch(source, /question(?:\?\.|\.)(?:templateId|math|prompt)/);
  assert.doesNotMatch(source, /option(?:\?\.|\.)label/);
  assert.doesNotMatch(source, /started\.data\.(?:answerIds|answer_ids|correctAnswer)/);
  assert.match(edge, /p_answer_ids: challenge\.answerIds/);
  assert.doesNotMatch(edge, /return json\(200, \{[\s\S]{0,400}answerIds/);
});

test("twenty-two rescue rounds fund the paid cosmetic for every possible gacha result", () => {
  const starterBlock = builder.match(/const starterInventory = \{([\s\S]*?)\};/)?.[1] || "";
  const starterInventory = Object.fromEntries(
    [...starterBlock.matchAll(/([a-z][A-Za-z]+):(\d+)/g)].map(([, skillId, count]) => [skillId, Number(count)]),
  );
  const gachaPool = Object.values(STANDARD_SKILLS)
    .filter((skill) => skill.gachaEnabled && !skill.experimental && skill.v49Catalogued);
  const newSkillSlots = gachaPool.filter((skill) => !Object.hasOwn(starterInventory, skill.id)).length;
  const starterSaleCoins = Object.entries(starterInventory)
    .reduce((coins, [skillId, count]) => coins + (count - 1) * coinValueForSkill(skillId), 0);
  const lockReserveCoins = coinValueForSkill("areaMicroBloom");
  const minimumCardCoins = Math.min(...gachaPool.map((skill) => coinValueForSkill(skill.id)));
  const totalDraws = 3 + 22;
  const guaranteedDuplicateDraws = totalDraws - newSkillSlots;
  const guaranteedCoins = starterSaleCoins - lockReserveCoins + guaranteedDuplicateDraws * minimumCardCoins;

  assert.equal(Object.keys(starterInventory).length, 6);
  assert.equal(gachaPool.length, 19);
  assert.equal(newSkillSlots, 13);
  assert.equal(guaranteedDuplicateDraws, 12);
  assert.equal(guaranteedCoins, 350);
  assert.match(source, /EXPECTED_TOTAL_GACHA_DRAWS = 25/);
  assert.match(source, /for \(const ticketLevel of \[1, QUIZ_RESCUE_TICKET_LEVEL\]\)/);
  assert.match(source, /MATCH_LOCK_RETAINED_COUNT = 2/);
  assert.match(source, /PAID_COSMETIC_PRICE = 350/);
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
