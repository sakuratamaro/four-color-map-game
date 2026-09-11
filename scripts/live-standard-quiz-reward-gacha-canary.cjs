"use strict";

// One opted-in new test profile, one ordinary quiz and one explicit gacha draw.
// Never inject responses/state, reuse a player's session, or delete test data.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { chromium } = require("playwright");
const { closeOwnedBrowserServer } = require("../tests/helpers/browser-server-cleanup.cjs");
const candidateSha = process.argv.find(a => a.startsWith("--candidate="))?.slice(12);
if (!process.argv.includes("--confirm-live") || !/^[0-9a-f]{40}$/.test(candidateSha || "")) {
  console.error("Requires --confirm-live and --candidate=<exact published SHA>.");
  process.exit(2);
}
const candidateRoot = path.resolve(__dirname, "../../reward-gacha-level-20260911");
const git = (...args) => execFileSync("git", ["-c", `safe.directory=${candidateRoot.replaceAll("\\", "/")}`, ...args], { cwd: candidateRoot });
assert.equal(git("rev-parse", "HEAD").toString().trim(), candidateSha);
assert.equal(git("status", "--porcelain").toString().trim(), "");
const publicPage = "https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
const config = fs.readFileSync(path.join(candidateRoot, "online/supabase-config.js"), "utf8");
const url = config.match(/url:\s*"([^"]+)"/)?.[1];
const key = config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
assert.ok(url && key);
const remoteProfileKey = "fourColorMapGame.standard.online.v5.remote-profile";
const checks = [];
const report = { subject: "UDL-059-quiz-v1", candidateSha, answerPacingMs: 700, profilesCreated: 0, quizzesCompleted: 0,
  explicitDraws: 0, matchesCreated: 0, physicalDevices: "NOT_RUN", faultInjection: "NONE",
  pendingAndZeroStock: "FIXED_CANDIDATE_BROWSER_GATE_ONLY", assetHashes: [], checks };
let token, browserServer, context, page, failed = false, stage = "published candidate byte equality";
const calls = [], reads = [], operationResponses = [];
const hardTimeout = setTimeout(() => { console.error("FAIL safety timeout; no data deletion attempted"); process.exit(1); }, 240_000);
const check = (label, value) => { assert.ok(value, label); checks.push(label); };
async function bounded(label, promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]); }
  finally { clearTimeout(timer); }
}
async function request(endpoint, body, useToken = token) {
  const response = await fetch(`${url}${endpoint}`, { method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { apikey: key, authorization: `Bearer ${useToken || key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}
(async () => {
  try {
    for (const [file, suffix] of [["index.html", ""], ["app.js", "app.js?v=20260911-27"]]) {
      const response = await fetch(publicPage + suffix, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
      check(`${file}: HTTP 200`, response.status === 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      check(`${file}: exact published candidate bytes`, bytes.equals(git("show", `${candidateSha}:standard-online-v5/${file}`)));
      report.assetHashes.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
    stage = "new isolated test profile";
    const session = await request("/auth/v1/signup", {}, null);
    token = session.access_token;
    check("new anonymous test session", typeof token === "string");
    const created = await request("/functions/v1/standard-game-action", { operation: "profile", expectedRevision: 0, displayName: "QuizGachaCanary", profileState: {} });
    report.profilesCreated = 1;
    check("new test profile persisted", created.revision === 1);
    stage = "isolated Chrome launch";
    browserServer = await chromium.launchServer({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, timeout: 20_000 });
    const browser = await chromium.connect(browserServer.wsEndpoint());
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const bootstrap = await context.newPage();
    stage = "test session bootstrap";
    await bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await bootstrap.evaluate(async ({ url, key, accessToken, refreshToken }) => {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw new Error("TEST_SESSION_SETUP_FAILED");
      client.auth.stopAutoRefresh();
    }, { url, key, accessToken: token, refreshToken: session.refresh_token });
    await bootstrap.close();
    let finished, warnings = 0, errors = 0;
    context.on("request", req => {
      if (req.url() === `${url}/functions/v1/standard-game-action` && req.method() === "POST") calls.push(req.postDataJSON());
    });
    context.on("response", res => {
      if (res.url() === `${url}/functions/v1/standard-game-action`) {
        const operation = res.request().postDataJSON()?.operation;
        if (["quiz-start", "quiz-answer", "quiz-finish", "gacha"].includes(operation)) operationResponses.push({ operation, status: res.status() });
      }
      if (res.url() === `${url}/functions/v1/standard-game-action` && res.request().postDataJSON()?.operation === "quiz-finish") {
        reads.push(res.json().then(value => { finished = value; }));
      }
    });
    page = await context.newPage();
    page.on("pageerror", () => { errors += 1; });
    page.on("console", msg => { if (msg.type() === "warning") warnings += 1; if (msg.type() === "error") errors += 1; });
    page.setDefaultTimeout(20_000);
    stage = "public profile hydration";
    await page.goto(`${publicPage}#quiz`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("#connectionBadge.good").waitFor();
    // The login badge precedes readProfile/hydrateProfileRow at boot.
    await page.waitForFunction(key => Boolean(JSON.parse(localStorage.getItem(key) || "null")), remoteProfileKey);
    await page.locator("#quizStart:not(:disabled)").waitFor();
    const beforeTickets = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).gachaTickets || {}, remoteProfileKey);
    stage = "select previous gacha Lv5";
    await page.locator("#gachaLevel").selectOption("5");
    stage = "select quiz Lv2";
    await page.locator("#quizLevel").selectOption("2");
    stage = "start ordinary quiz";
    await page.locator("#quizStart").click();
    for (let i = 0; i < 10; i += 1) {
      stage = `question ${i + 1} ready`;
      await page.waitForFunction(index => document.querySelector("#quizProgress").textContent === `${index + 1} / 10`
        && Boolean(document.querySelector("#quizOptions [data-quiz-option]:not(:disabled)")), i);
      // Preserve the server's five-second QUIZ_TOO_FAST guard; do not alter clocks.
      await page.waitForTimeout(report.answerPacingMs);
      stage = `question ${i + 1} explicit answer`;
      await page.locator("#quizOptions [data-quiz-option]").first().click();
    }
    stage = "quiz finished result";
    await page.locator("#quizResult:not(.hidden)").waitFor();
    await Promise.all(reads);
    check("one real quiz finish response", reads.length === 1 && Number.isSafeInteger(finished?.reward?.ticketLevel));
    const level = finished.reward.ticketLevel;
    check("saved reward differs from prior Lv5", level >= 1 && level <= 2);
    const savedTickets = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).gachaTickets, remoteProfileKey);
    check("persisted profile matches finish reward", savedTickets[String(level)] === Number(beforeTickets[String(level)] || 0) + finished.reward.draws);
    report.quizzesCompleted = 1;
    report.reward = { ticketLevel: level, draws: finished.reward.draws };
    stage = "reward link then one explicit draw";
    await page.locator("#quizGoGacha").click();
    check("reward link selects saved level", await page.locator("#gachaLevel").inputValue() === String(level));
    check("odds use saved level", (await page.locator("#gachaOdds").textContent()).startsWith(`Lv.${level} 排出率`));
    check("navigation creates no draw", calls.filter(c => c.operation === "gacha").length === 0);
    check("navigation consumes no ticket", JSON.stringify(savedTickets) === JSON.stringify(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).gachaTickets, remoteProfileKey)));
    await page.locator("#gachaDrawOne").click();
    await page.waitForFunction(() => document.querySelector("#gachaStatus").textContent.includes("1枚を獲得"));
    const draws = calls.filter(c => c.operation === "gacha");
    check("one explicit draw uses displayed reward level", draws.length === 1 && draws[0].ticketLevel === level && draws[0].count === 1);
    report.explicitDraws = 1;
    const afterTickets = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).gachaTickets, remoteProfileKey);
    check("only selected-level ticket decremented", [1, 2, 3, 4, 5].every(n => Number(afterTickets[n] || 0) === Number(savedTickets[n] || 0) - (n === level ? 1 : 0)));
    await page.locator("#gachaLevel").selectOption("3");
    await page.locator('[data-app-tab="battle"]').click();
    await page.locator('[data-app-tab="quiz"]').click();
    check("manual selection survives ordinary tab return", await page.locator("#gachaLevel").inputValue() === "3");
    check("390px no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1280, height: 900 });
    check("1280px no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("#connectionBadge.good").waitFor();
    await page.waitForFunction(key => Boolean(JSON.parse(localStorage.getItem(key) || "null")), remoteProfileKey);
    check("tickets survive reload", JSON.stringify(afterTickets) === JSON.stringify(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).gachaTickets, remoteProfileKey)));
    check("reload creates no duplicate finish or draw", calls.filter(c => c.operation === "quiz-finish").length === 1 && calls.filter(c => c.operation === "gacha").length === 1);
    check("no match operations", calls.every(c => !["cpu-start", "create", "join", "setup", "action", "cpu-action"].includes(c.operation)));
    check("console and page errors zero", warnings === 0 && errors === 0);
    report.liveGameplay = "REAL_PUBLIC_QUIZ_REWARD_NAVIGATION_EXPLICIT_DRAW_NO_MOCKS";
  } catch (error) {
    failed = true;
    report.failureStage = stage;
    report.errorKind = error?.name || "Error";
    report.errorCode = error?.code || null;
    // Only our assertion labels may be persisted; never browser URLs or auth input.
    if (error?.code === "ERR_ASSERTION") report.failedCheck = error.message;
    if (page) report.failureUi = await page.evaluate(() => ({
      quizProgress: document.querySelector("#quizProgress")?.textContent,
      quizStatus: document.querySelector("#quizStatus")?.textContent,
      optionCount: document.querySelectorAll("#quizOptions [data-quiz-option]").length,
      quizVisible: !document.querySelector("#quizPanel")?.classList.contains("hidden"),
      gachaVisible: !document.querySelector("#gachaPanel")?.classList.contains("hidden"),
    })).catch(() => null);
    console.error(`FAIL ${stage}`);
  } finally {
    try { if (context) await bounded("context-close", context.close(), 10_000); }
    catch { failed = true; report.browserCleanup = "CONTEXT_CLOSE_FAILED"; }
    try { await closeOwnedBrowserServer({ browserServer, bounded, stage: () => {} }); }
    catch { failed = true; report.browserCleanup = "FAILED"; }
    clearTimeout(hardTimeout);
    report.cleanup = "NO_MATCH_CREATED_NO_DATA_DELETED";
    report.operationCounts = Object.fromEntries(["quiz-start", "quiz-answer", "quiz-finish", "gacha"].map(operation => [operation, calls.filter(c => c.operation === operation).length]));
    report.operationResponses = operationResponses;
    report.ok = !failed;
    report.completedAt = new Date().toISOString();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
})();
