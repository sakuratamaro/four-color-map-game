"use strict";

// One explicitly permitted isolated profile; public navigation only, no matchmaking writes.
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
const candidateRoot = path.resolve(__dirname, "../../ui-diet-20260912");
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
const checks = [], calls = [], responses = [], rpcNames = [];
const report = { subject: "UDL-20260907-023", candidateSha, profilesCreated: 0, quizzesStarted: 0, quizzesCompleted: 0,
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
    for (const file of ["index.html", "app.js", "ui-diet.css"]) {
      const suffix = file === "index.html" ? "" : `${file}?v=${file === "app.js" ? "20260912-30" : "20260912-2"}`;
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
    const created = await request("/functions/v1/standard-game-action", { operation: "profile", expectedRevision: 0, displayName: "UiEntranceCanary", profileState: {} });
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
    context.on("request", req => { if (req.method() === "POST" && req.url().startsWith(`${url}/rest/v1/rpc/`)) rpcNames.push(req.url().split("/").pop()); if (req.url() === `${url}/functions/v1/standard-game-action` && req.method() === "POST") calls.push(req.postDataJSON()); });
    context.on("response", res => {
      if (res.url() === `${url}/functions/v1/standard-game-action`) responses.push({ operation: res.request().postDataJSON()?.operation, status: res.status() });
    });
    page = await context.newPage();
    page.on("pageerror", () => { errors += 1; });
    page.on("console", msg => { if (msg.type() === "warning") warnings += 1; if (msg.type() === "error") errors += 1; });
    page.setDefaultTimeout(20_000);
    stage = "public profile hydration";
    await page.goto(`${publicPage}#battle`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("#connectionBadge.good").waitFor();
    await page.waitForFunction(k => Boolean(JSON.parse(localStorage.getItem(k) || "null")), profileKey);
    await page.locator("#lobby").waitFor({ state: "visible" });
    check("returning profile editor hidden on battle", await page.locator("#profileCard").isHidden());
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      check(viewport.width + "px three choices visible and hit targets >=44px", await page.evaluate(() => {
        const tabs = document.querySelector(".app-tabs").getBoundingClientRect(), atBottom = tabs.top > innerHeight / 2;
        return ["startStandardCpuLobby", "chooseFriendBattle", "choosePublicBattle"].every(id => {
          const el = document.getElementById(id), r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return r.width >= 44 && r.height >= 44 && r.top >= (atBottom ? 0 : tabs.bottom) && r.bottom <= (atBottom ? tabs.top : innerHeight) && (hit === el || el.contains(hit));
        });
      }));
      check(viewport.width + "px no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (reportPath) await page.screenshot({ path: reportPath + "." + viewport.width + ".png" });
    }
    check("unselected human routes hidden", await page.locator("#friendBattlePanel").isHidden() && await page.locator("#matchmakingPanel").isHidden());
    await page.locator("#chooseFriendBattle").focus();
    await page.keyboard.press("Enter");
    check("keyboard opens friend route only", await page.locator("#friendBattlePanel").isVisible() && await page.locator("#matchmakingPanel").isHidden());
    await page.locator("#roomCode").fill("UITEST");
    await page.locator("#choosePublicBattle").click();
    check("public route replaces friend controls", await page.locator("#friendBattlePanel").isHidden() && await page.locator("#matchmakingPanel").isVisible());
    check("optional wait-only controls collapsed", !(await page.locator("#publicWaitingOptions").evaluate(el => el.open)));
    await page.locator("#startStandardCpuLobby").click();
    await page.locator("#cpuRosterDialog[open]").waitFor();
    check("CPU route shows ten actual roster choices", await page.locator("#cpuRosterGrid .cpu-character-card").count() === 10);
    await page.keyboard.press("Escape");
    check("CPU close restores focus without starting match", await page.evaluate(() => document.activeElement?.id === "startStandardCpuLobby"));
    await page.getByRole("button", { name: "マイページ", exact: true }).click();
    check("profile editor accessible on My Page", await page.locator("#profileCard").isVisible());
    await page.getByRole("button", { name: "対戦", exact: true }).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#lobby").waitFor({ state: "visible" });
    check("reload starts with collapsed routes", await page.locator("#friendBattlePanel").isHidden() && await page.locator("#matchmakingPanel").isHidden());
    check("no normal Local or Quick links", await page.locator('a[href*="solo-v5"], a[href*="standard-v5"]').count() === 0);
    check("route selections allocate no room or matchmaking RPC", rpcNames.every(name => !/^fcg_standard_(create_room|join_room|matchmaking_find|matchmaking_recruit)$/.test(name)));
    check("no game or reward mutation from navigation", calls.every(c => !["gacha", "quiz-start", "quiz-answer", "quiz-finish", "cpu-start", "cpu-accept", "create", "join", "setup", "action", "cpu-action"].includes(c.operation)));
    check("no unsuccessful Edge API response", responses.every(r => r.status >= 200 && r.status < 300));
    check("console and page errors zero", warnings === 0 && errors === 0);
    report.liveGameplay = "REAL_PUBLIC_NAVIGATION_CPU_ROSTER_NO_GAMEPLAY_MUTATION";
    report.livePublicMatchmaking = "NOT_RUN_TO_AVOID_MATCHING_REAL_PLAYERS; matched/none/lost/cancel verified in fixtures";
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
