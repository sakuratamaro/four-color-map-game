"use strict";

// One explicitly permitted isolated test profile and ordinary Lv.5 quiz.
// No response/clock/game-state injection, player session reuse, gacha or matches.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { chromium } = require("playwright");
const { closeOwnedBrowserServer } = require("../tests/helpers/browser-server-cleanup.cjs");
const candidateSha = process.argv.find(a => a.startsWith("--candidate="))?.slice(12);
const reportPath = process.argv.find(a => a.startsWith("--report="))?.slice(9);
if (!process.argv.includes("--confirm-live") || !/^[0-9a-f]{40}$/.test(candidateSha || "")) {
  console.error("Requires --confirm-live and --candidate=<exact published SHA>.");
  process.exit(2);
}
const candidateRoot = path.resolve(__dirname, "../../quiz-memo-calculator-20260912");
const git = (...args) => execFileSync("git", ["-c", `safe.directory=${candidateRoot.replaceAll("\\", "/")}`, ...args], { cwd: candidateRoot });
assert.equal(git("rev-parse", "HEAD").toString().trim(), candidateSha);
assert.equal(git("status", "--porcelain").toString().trim(), "");
const publicPage = "https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
const config = fs.readFileSync(path.join(candidateRoot, "online/supabase-config.js"), "utf8");
const url = config.match(/url:\s*"([^"]+)"/)?.[1];
const key = config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
assert.ok(url && key);
const scratchKey = "fourColorMapGame.standard.online.v5.quiz-scratch-v1";
const pendingKey = "fourColorMapGame.standard.online.v5.pending-quiz";
const profileKey = "fourColorMapGame.standard.online.v5.remote-profile";
const checks = [], calls = [], responses = [];
const report = { subject: "UDL-20260910-048", candidateSha, profilesCreated: 0, quizzesStarted: 0, quizzesCompleted: 0,
  matchesCreated: 0, explicitDraws: 0, physicalDevices: "NOT_RUN", faultInjection: "NONE", assetHashes: [], checks };
let token, browserServer, context, page, failed = false, stage = "published byte equality", warnings = 0, errors = 0;
const hardTimeout = setTimeout(() => { console.error("FAIL safety timeout; no data deletion attempted"); process.exit(1); }, 240_000);
const check = (label, value) => { assert.ok(value, label); checks.push(label); };
async function bounded(label, promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]); }
  finally { clearTimeout(timer); }
}
async function request(endpoint, body) {
  const response = await fetch(`${url}${endpoint}`, { method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { apikey: key, authorization: `Bearer ${token || key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}
const readScratch = () => page.evaluate(k => JSON.parse(sessionStorage.getItem(k) || "null"), scratchKey);
(async () => {
  try {
    for (const file of ["index.html", "app.js", "quiz-memo.js", "quiz-calculator.js", "quiz-scratch-state.js", "quiz-memo-canvas.js", "quiz-memo.css"]) {
      const suffix = file === "index.html" ? "" : `${file}?v=${file === "app.js" ? "20260912-28" : "20260912-1"}`;
      const response = await fetch(publicPage + suffix, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
      check(`${file}: HTTP 200`, response.status === 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      check(`${file}: exact candidate bytes`, bytes.equals(git("show", `${candidateSha}:standard-online-v5/${file}`)));
      report.assetHashes.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
    stage = "new isolated test profile";
    const session = await request("/auth/v1/signup", {});
    token = session.access_token;
    check("new anonymous test session", typeof token === "string");
    const created = await request("/functions/v1/standard-game-action", { operation: "profile", expectedRevision: 0, displayName: "QuizMemoCanary", profileState: {} });
    report.profilesCreated = 1;
    check("new test profile persisted", created.revision === 1);
    browserServer = await chromium.launchServer({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, timeout: 20_000 });
    const browser = await chromium.connect(browserServer.wsEndpoint());
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const bootstrap = await context.newPage();
    await bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Auth bootstrap only, using this canary's fresh account. No quiz state injected.
    await bootstrap.evaluate(async ({ url, key, accessToken, refreshToken }) => {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw new Error("TEST_SESSION_SETUP_FAILED");
      client.auth.stopAutoRefresh();
    }, { url, key, accessToken: token, refreshToken: session.refresh_token });
    await bootstrap.close();
    context.on("request", req => { if (req.url() === `${url}/functions/v1/standard-game-action` && req.method() === "POST") calls.push(req.postDataJSON()); });
    context.on("response", res => {
      if (res.url() === `${url}/functions/v1/standard-game-action`) responses.push({ operation: res.request().postDataJSON()?.operation, status: res.status() });
    });
    page = await context.newPage();
    page.on("pageerror", () => { errors += 1; });
    page.on("console", msg => { if (msg.type() === "warning") warnings += 1; if (msg.type() === "error") errors += 1; });
    page.setDefaultTimeout(20_000);
    stage = "public profile hydration";
    await page.goto(`${publicPage}#quiz`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("#connectionBadge.good").waitFor();
    await page.waitForFunction(k => Boolean(JSON.parse(localStorage.getItem(k) || "null")), profileKey);
    await page.locator("#quizStart:not(:disabled)").waitFor();
    await page.locator("#quizLevel").selectOption("5");
    await page.locator("#quizStart").click();
    await page.locator("#quizMemoOn").waitFor();
    report.quizzesStarted = 1;
    stage = "ordinary Lv5 memo and arithmetic";
    await page.locator("#quizMemoOn").click();
    check("memo enables and background is inert", await page.locator("main").evaluate(node => node.inert));
    check("scratch canvas is transparent", await page.locator("#quizMemoCanvas").evaluate(node => getComputedStyle(node).backgroundColor === "rgba(0, 0, 0, 0)"));
    const beforeTimer = await page.locator("#quizTimeBar").evaluate(node => parseFloat(node.style.width));
    await page.mouse.move(25, 350); await page.mouse.down(); await page.mouse.move(55, 450, { steps: 10 }); await page.mouse.up();
    await page.waitForFunction(k => JSON.parse(sessionStorage.getItem(k) || "null")?.operations.length > 0, scratchKey);
    const ink = (await readScratch()).operations;
    check("native mouse creates a multi-point stroke", ink[0].points.length > 1);
    await page.locator("#quizCalculatorPanel summary").click();
    await page.locator("#quizCalculatorExpression").fill("(1234.56+2)*3");
    await page.locator("#quizCalculatorExpression").press("Enter");
    check("four operations calculate independently", await page.locator("#quizCalculatorResult").textContent() === "3709.68");
    check("memo does not pause timer", await page.locator("#quizTimeBar").evaluate(node => parseFloat(node.style.width)) < beforeTimer);
    check("no answer while memo used", calls.filter(c => c.operation === "quiz-answer").length === 0);
    check("pending quiz contains no scratch data", await page.evaluate(k => !/scratch|calculator|operations/.test(localStorage.getItem(k)), pendingKey));
    check("390px no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (reportPath) await page.screenshot({ path: `${reportPath}.390.png` });
    stage = "OFF and same-question reload";
    await page.locator("#quizMemoOff").click();
    check("OFF restores background and pointer access", await page.evaluate(() => !document.querySelector("main").inert && getComputedStyle(document.querySelector("#quizMemoCanvas")).pointerEvents === "none"));
    const saved = await readScratch();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("#quizMemoOn").waitFor();
    check("same-question reload preserves ink and calculator", JSON.stringify(await readScratch()) === JSON.stringify(saved));
    await page.locator("#quizMemoOn").click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForFunction(() => document.querySelector("#quizMemoCanvas").width === Math.ceil(innerWidth * devicePixelRatio));
    check("resize preserves normalized ink", JSON.stringify((await readScratch()).operations) === JSON.stringify(ink));
    check("1280px no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (reportPath) await page.screenshot({ path: `${reportPath}.1280.png` });
    await page.locator("#quizMemoOff").click();
    await page.waitForTimeout(700);
    stage = "server acknowledged answer clears only scratch";
    await page.locator("#quizOptions [data-quiz-option]").first().click();
    await page.waitForFunction(() => document.querySelector("#quizProgress").textContent === "2 / 10");
    check("next acknowledged question clears scratch", await readScratch() === null);
    check("next question calculator is empty", await page.locator("#quizCalculatorExpression").inputValue() === "");
    stage = "finish one ordinary quiz without manipulating answers";
    for (let index = 1; index < 10; index += 1) {
      await page.waitForFunction(i => document.querySelector("#quizProgress").textContent === `${i + 1} / 10`
        && Boolean(document.querySelector("#quizOptions [data-quiz-option]:not(:disabled)")), index);
      await page.waitForTimeout(700);
      await page.locator("#quizOptions [data-quiz-option]").first().click();
    }
    await page.locator("#quizResult:not(.hidden)").waitFor();
    report.quizzesCompleted = 1;
    check("completion clears scratch and hides entry", await readScratch() === null && await page.locator("#quizMemoOn").isHidden());
    check("exactly one start ten answers one finish", calls.filter(c => c.operation === "quiz-start").length === 1 && calls.filter(c => c.operation === "quiz-answer").length === 10 && calls.filter(c => c.operation === "quiz-finish").length === 1);
    check("scratch and calculator never enter network payloads", !/quiz-scratch|calculator|1234\.56|3709\.68|\"operations\"/.test(JSON.stringify(calls)));
    check("no match or gacha operations", calls.every(c => !["gacha", "cpu-start", "create", "join", "setup", "action", "cpu-action"].includes(c.operation)));
    check("no unsuccessful API response", responses.every(r => r.status >= 200 && r.status < 300));
    check("console and page errors zero", warnings === 0 && errors === 0);
    report.liveGameplay = "REAL_PUBLIC_LV5_MEMO_CALCULATOR_RELOAD_ACK_CLEAR_COMPLETION_NO_MOCKS";
  } catch (error) {
    failed = true; report.failureStage = stage; report.errorKind = error?.name || "Error"; report.errorCode = error?.code || null;
    if (error?.code === "ERR_ASSERTION") report.failedCheck = error.message;
    console.error(`FAIL ${stage}`);
  } finally {
    try { if (context) await bounded("context-close", context.close(), 10_000); } catch { failed = true; report.browserCleanup = "CONTEXT_CLOSE_FAILED"; }
    try { await closeOwnedBrowserServer({ browserServer, bounded, stage: () => {} }); } catch { failed = true; report.browserCleanup = "FAILED"; }
    clearTimeout(hardTimeout);
    report.cleanup = "NO_MATCH_CREATED_NO_DATA_DELETED";
    report.operationCounts = Object.fromEntries(["quiz-start", "quiz-answer", "quiz-finish", "gacha"].map(op => [op, calls.filter(c => c.operation === op).length]));
    report.operationResponses = responses; report.ok = !failed; report.completedAt = new Date().toISOString();
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
})();
