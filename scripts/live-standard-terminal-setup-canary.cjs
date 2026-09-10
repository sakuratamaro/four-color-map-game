"use strict";

// Explicitly opted-in production test: one new anonymous profile and one CPU match.
// No service key, existing-player writes, SQL changes, state injection, or deletion.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const { closeOwnedBrowserServer } = require("../tests/helpers/browser-server-cleanup.cjs");

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing live test profile/match creation without --confirm-live.");
  process.exit(2);
}
const publicPage = "https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
const config = fs.readFileSync(path.join(__dirname, "../online/supabase-config.js"), "utf8");
const url = config.match(/url:\s*"([^"]+)"/)?.[1];
const key = config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
assert.ok(url && key);
const connectionKey = "fourColorMapGame.standard.online.v5.connection";
const checks = [];
const report = { subject: "UDL-055", publicAssetSha: "5c03e6c2d0e94c843776ea7eae0d7bbe2917a174", profilesCreated: 0, matchesCreated: 0, cleanup: "NOT_NEEDED", physicalDevice: "NOT_RUN", checks };
let token, roomId, room, browserServer, context;
let stage = "starting";
let failed = false;
const hardTimeout = setTimeout(() => { console.error("FAIL safety timeout; inspect owned test match cleanup status"); process.exit(1); }, 240_000);

async function bounded(label, promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`BROWSER_STAGE_TIMEOUT ${label}`)), ms); })]); }
  finally { clearTimeout(timer); }
}
function check(label, condition) { assert.ok(condition, label); checks.push(label); }
async function request(endpoint, body, useToken = token) {
  const response = await fetch(`${url}${endpoint}`, { method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { apikey: key, authorization: `Bearer ${useToken || key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return data;
}
const edge = (body) => request("/functions/v1/standard-game-action", body);
async function snapshot() {
  const data = await request("/rest/v1/rpc/fcg_standard_room_snapshot_v2", { p_room_id: roomId, p_known_profile_revision: null });
  return Array.isArray(data) ? data[0] : data;
}
async function finishOwnedMatch() {
  for (let i = 0; i < 12 && room?.status === "playing" && room.publicState?.active === "B"; i += 1) {
    room = (await edge({ operation: "cpu-action", roomId, expectedVersion: room.version })).room;
  }
  if (room?.status === "playing" && room.publicState?.active === "A") {
    room = (await edge({ operation: "action", roomId, action: { id: randomUUID(), expectedVersion: room.version, type: "SURRENDER", payload: {} } })).room;
  }
  report.cleanup = room?.status === "finished" ? "TERMINAL_CONFIRMED_NO_DELETION" : "PENDING";
}

(async () => {
  try {
    stage = "create isolated test profile";
    const session = await request("/auth/v1/signup", {}, null);
    token = session.access_token;
    check("anonymous test session", typeof token === "string");
    const profile = await edge({ operation: "profile", expectedRevision: 0, displayName: "TerminalCanary", profileState: {} });
    report.profilesCreated += 1;
    check("new test profile persisted", Number(profile.revision) === 1);
    stage = "start one test CPU match";
    const start = await edge({ operation: "cpu-start", actionId: randomUUID(), characterId: "yuzu", confirmed: true });
    roomId = start.roomId;
    report.matchesCreated += 1;
    report.cleanup = "PENDING";
    check("new isolated CPU room", start.startStatus === "created" && start.opponentKind === "cpu");
    await edge({ operation: "setup", roomId, expectedSetupRevision: 0, setupActionId: randomUUID(), loadout: {
      color: ["colorRandomBorrow", "colorChoiceBorrow"], area: ["areaMicroBloom", "areaDiePlus"], disrupt: ["disruptRandomOne", "disruptChoiceOne"],
    } });
    room = (await edge({ operation: "initialize", roomId })).room;
    check("test match initialized", room?.status === "playing");
    stage = "finish test match normally";
    await finishOwnedMatch();
    check("test match terminated by surrender", room?.status === "finished" && room.publicState?.terminalReason === "SURRENDER");
    const before = await snapshot();
    const profileBefore = JSON.stringify(before.profile);
    const stateBefore = JSON.stringify(before.room);
    check("server confirms finished result", before.room?.status === "finished");
    stage = "launch isolated Chrome";
    browserServer = await chromium.launchServer({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, timeout: 20_000 });
    const browser = await chromium.connect(browserServer.wsEndpoint());
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Persist only this newly-created session using the same SDK as the real app.
    const bootstrap = await context.newPage();
    await bootstrap.goto("https://sakuratamaro.github.io/four-color-map-game/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await bootstrap.evaluate(async ({ url, key, accessToken, refreshToken, roomId, connectionKey }) => {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw new Error("TEST_SESSION_SETUP_FAILED");
      localStorage.setItem(connectionKey, JSON.stringify({ roomId, roomCode: null, profileRevision: 0, setupRevision: 1 }));
      client.auth.stopAutoRefresh();
    }, { url, key, accessToken: token, refreshToken: session.refresh_token, roomId, connectionKey });
    await bootstrap.close();
    let errorCount = 0;
    const writes = [];
    context.on("request", (req) => {
      if (req.url().startsWith(`${url}/functions/v1/standard-game-action`) && req.method() === "POST") {
        const op = req.postDataJSON()?.operation;
        if (op && op !== "cosmetic-catalog") writes.push(op);
      }
    });
    const inspect = async (page, label) => {
      page.on("pageerror", () => { errorCount += 1; });
      await page.addInitScript(() => {
        globalThis.__liveTerminalRevealCount = 0;
        const toggle = DOMTokenList.prototype.toggle;
        DOMTokenList.prototype.toggle = function (...args) {
          const result = toggle.apply(this, args);
          if (this === document.getElementById("randomReveal")?.classList && args[0] === "hidden" && !result) globalThis.__liveTerminalRevealCount += 1;
          return result;
        };
      });
      await page.goto(`${publicPage}#battle`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.locator("#terminalSummary:not(.hidden)").waitFor({ timeout: 30_000 });
      check(`${label}: zero setup reveal calls`, await page.evaluate(() => globalThis.__liveTerminalRevealCount === 0));
      check(`${label}: setup overlay hidden`, await page.locator("#randomReveal").isHidden());
      check(`${label}: correct room retained`, await page.evaluate(({ roomId, connectionKey }) => JSON.parse(localStorage.getItem(connectionKey)).roomId === roomId, { roomId, connectionKey }));
      return page.locator("#terminalOutcomeReason").textContent();
    };
    stage = "finished cold restore, reload and new tab";
    const page = await context.newPage();
    const reason = await inspect(page, "cold restore");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("#terminalSummary:not(.hidden)").waitFor({ timeout: 30_000 });
    check("reload: zero setup reveal calls", await page.evaluate(() => globalThis.__liveTerminalRevealCount === 0));
    check("reload: same terminal reason", await page.locator("#terminalOutcomeReason").textContent() === reason);
    const fresh = await context.newPage();
    check("new tab: same terminal reason", await inspect(fresh, "new tab") === reason);
    await page.bringToFront();
    check("return to original tab: overlay hidden", await page.locator("#randomReveal").isHidden());
    check("no client game writes while restoring terminal result", writes.length === 0);
    check("no browser page errors", errorCount === 0);
    const after = await snapshot();
    check("profile/rewards/history unchanged by browser restores", JSON.stringify(after.profile) === profileBefore);
    check("server finished room unchanged by browser restores", JSON.stringify(after.room) === stateBefore);
    report.gameplay = "NEW_TEST_CPU_MATCH_INITIALIZED_AND_SURRENDERED";
    report.browser = "ACTUAL_CHROME_390PX_COLD_RELOAD_NEW_TAB";
  } catch (error) {
    failed = true;
    report.failureStage = stage;
    report.errorKind = error?.name || "Error";
    console.error(`FAIL ${stage}`);
  } finally {
    if (roomId && room?.status !== "finished") {
      try { await finishOwnedMatch(); } catch { report.cleanup = "PENDING_REQUIRES_OWNED_TEST_ROOM_FOLLOWUP"; }
    }
    try { if (context) await bounded("context-close", context.close(), 10_000); }
    catch { report.browserCleanup = "CONTEXT_CLOSE_FAILED"; failed = true; }
    try { await closeOwnedBrowserServer({ browserServer, bounded, stage: () => {} }); }
    catch { report.browserCleanup = "FAILED"; failed = true; }
    clearTimeout(hardTimeout);
    report.ok = !failed && report.cleanup === "TERMINAL_CONFIRMED_NO_DELETION";
    report.completedAt = new Date().toISOString();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
})().catch(() => { clearTimeout(hardTimeout); console.error("FAIL unhandled canary error (details redacted)"); process.exitCode = 1; });
