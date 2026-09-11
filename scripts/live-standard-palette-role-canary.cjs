"use strict";

// Opted-in public test: one new profile/match, ordinary game operations only.
// Overlap/seal/exhaustion fixtures belong to the fixed-candidate browser gate.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { randomUUID, createHash } = require("node:crypto");
const { chromium } = require("playwright");
const { closeOwnedBrowserServer } = require("../tests/helpers/browser-server-cleanup.cjs");

if (!process.argv.includes("--confirm-live")) {
  console.error("Refusing production test profile/match creation without --confirm-live.");
  process.exit(2);
}
const candidateSha = "ce6fab535235d7aff90d0bc846bbfb648c9a56e4";
const candidateRoot = path.resolve(__dirname, "../../palette-role-identification-20260911");
const publicPage = "https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/";
const config = fs.readFileSync(path.join(__dirname, "../online/supabase-config.js"), "utf8");
const url = config.match(/url:\s*"([^"]+)"/)?.[1];
const key = config.match(/publishableKey:\s*"([^"]+)"/)?.[1];
assert.ok(url && key);
const connectionKey = "fourColorMapGame.standard.online.v5.connection";
const checks = [];
const report = { subject: "UDL-052-roles-v1", candidateSha, profilesCreated: 0, matchesCreated: 0,
  cleanup: "NOT_NEEDED", physicalDevices: "NOT_RUN", liveOverlapSealExhaustion: "NOT_RUN_USE_FIXED_CANDIDATE_GATE",
  assetHashes: [], browserWidths: [], checks };
let token, roomId, room, browserServer, context, failed = false, stage = "public assets";
const hardTimeout = setTimeout(() => { console.error("FAIL safety timeout; owned test cleanup may need follow-up"); process.exit(1); }, 240_000);
function check(label, value) { assert.ok(value, label); checks.push(label); }
async function bounded(label, promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]); }
  finally { clearTimeout(timer); }
}
async function request(endpoint, body, useToken = token) {
  const response = await fetch(`${url}${endpoint}`, { method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { apikey: key, authorization: `Bearer ${useToken || key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return data;
}
const edge = body => request("/functions/v1/standard-game-action", body);
async function action(type, payload = {}) {
  room = (await edge({ operation: "action", roomId, action: { id: randomUUID(), expectedVersion: room.version, type, payload } })).room;
}
async function advanceCpu() {
  for (let i = 0; i < 12 && room?.status === "playing" && room.publicState?.active === "B"; i += 1) {
    room = (await edge({ operation: "cpu-action", roomId, expectedVersion: room.version })).room;
  }
}
async function finishOwnedMatch() {
  if (!roomId) return;
  room = (await edge({ operation: "initialize", roomId })).room;
  await advanceCpu();
  if (room?.status === "playing" && room.publicState?.active === "A") await action("SURRENDER");
  report.cleanup = room?.status === "finished" ? "TERMINAL_CONFIRMED_NO_DELETION" : "PENDING";
}

(async () => {
  try {
    for (const [file, suffix] of [["index.html", ""], ["app.js", "app.js?v=20260911-26"], ["standard-online-skill-intents.js", "standard-online-skill-intents.js?v=20260911-21"]]) {
      const response = await fetch(publicPage + suffix, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      check(`${file}: public HTTP 200`, response.status === 200);
      const delivered = Buffer.from(await response.arrayBuffer());
      const expected = execFileSync("git", ["-c", `safe.directory=${candidateRoot.replaceAll("\\", "/")}`, "show", `${candidateSha}:standard-online-v5/${file}`], { cwd: candidateRoot, windowsHide: true, maxBuffer: 2_000_000 });
      check(`${file}: exact Git blob bytes delivered`, delivered.equals(expected));
      report.assetHashes.push({ file, sha256: createHash("sha256").update(delivered).digest("hex") });
    }
    stage = "create isolated profile and CPU match";
    const session = await request("/auth/v1/signup", {}, null);
    token = session.access_token;
    check("anonymous test session", typeof token === "string");
    const profile = await edge({ operation: "profile", expectedRevision: 0, displayName: "PaletteRoleCanary", profileState: {} });
    report.profilesCreated += 1;
    check("new profile persisted", Number(profile.revision) === 1);
    const start = await edge({ operation: "cpu-start", actionId: randomUUID(), characterId: "yuzu", confirmed: true });
    roomId = start.roomId;
    report.matchesCreated += 1;
    report.cleanup = "PENDING";
    check("one new CPU match", start.startStatus === "created" && start.opponentKind === "cpu");
    await edge({ operation: "setup", roomId, expectedSetupRevision: 0, setupActionId: randomUUID(), loadout: {
      color: ["colorRandomBorrow", "colorChoiceBorrow"], area: ["areaMicroBloom", "areaDiePlus"], disrupt: ["disruptRandomOne", "disruptChoiceOne"],
    } });
    room = (await edge({ operation: "initialize", roomId })).room;
    await advanceCpu();
    if (room?.publicState?.active === "A" && room.publicState.phase === "CREATE_FIRST") {
      const bounds = room.publicState.playableBounds;
      const size = room.publicState.requiredSize;
      check("ordinary opening fits public bounds", bounds && Number.isSafeInteger(size) && size > 0 && bounds.minCol + size - 1 <= bounds.maxCol);
      await action("CREATE_REGION", { sourceMacros: Array.from({ length: size }, (_, n) => bounds.minRow * bounds.macroWidth + bounds.minCol + n) });
      await advanceCpu();
    }
    check("actual human COLOR phase reached", room?.status === "playing" && room.publicState.active === "A" && room.publicState.phase === "COLOR");
    check("own private projection only", room.privateState?.seat === "A" && room.privateState.basicPalette?.length === 2);
    const own = room.privateState;
    const before = JSON.stringify(room);
    stage = "public Chrome cold restore and reload";
    browserServer = await chromium.launchServer({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, timeout: 20_000 });
    const browser = await chromium.connect(browserServer.wsEndpoint());
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
    let errors = 0, warnings = 0, gameWrites = 0;
    context.on("request", req => {
      if (req.url() === `${url}/functions/v1/standard-game-action` && req.method() === "POST"
          && ["action", "cpu-action", "setup", "gacha", "cpu-start"].includes(req.postDataJSON()?.operation)) gameWrites += 1;
    });
    const page = await context.newPage();
    page.on("pageerror", () => { errors += 1; });
    page.on("console", msg => { if (msg.type() === "warning") warnings += 1; if (msg.type() === "error") errors += 1; });
    const inspect = async label => {
      await page.locator("#colorResponse:not(.hidden) .color-button").first().waitFor({ timeout: 30_000 });
      await page.locator("#randomReveal").waitFor({ state: "hidden", timeout: 15_000 });
      for (const color of new Set(own.basicPalette)) {
        const count = own.basicPalette.filter(c => c === color).length;
        const button = page.locator(`#paletteControls [data-color="${color}"]`);
        const expected = `基本色${count > 1 ? `×${count}` : ""}・回数無制限`;
        check(`${label}: basic role visible and accessible`, (await button.innerText()).includes(expected) && (await button.getAttribute("aria-label")).includes(expected));
      }
      const bonus = page.locator(`#paletteControls [data-color="${own.bonusColor}"]`);
      check(`${label}: saved bonus remaining displayed`, (await bonus.innerText()).includes(`おまけ色 残り${own.bonusUsesRemaining}回`));
      check(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      check(`${label}: own room retained`, await page.evaluate(({ connectionKey, roomId }) => JSON.parse(localStorage.getItem(connectionKey)).roomId === roomId, { connectionKey, roomId }));
    };
    await page.goto(`${publicPage}#battle`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await inspect("390px cold");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await inspect("390px reload");
    report.browserWidths.push(390);
    await page.setViewportSize({ width: 1280, height: 900 });
    await inspect("1280px resized");
    report.browserWidths.push(1280);
    check("no game writes from inspection", gameWrites === 0);
    check("console and page errors zero", errors === 0 && warnings === 0);
    const after = (await edge({ operation: "initialize", roomId })).room;
    check("room state unchanged by restore and inspection", JSON.stringify(after) === before);
    report.liveGameplay = "ORDINARY_CPU_OPENING_TO_HUMAN_COLOR_NO_MOCKS";
  } catch (error) {
    failed = true;
    report.failureStage = stage;
    report.errorKind = error?.name || "Error";
    console.error(`FAIL ${stage}`);
  } finally {
    try { if (context) await bounded("context-close", context.close(), 10_000); }
    catch { report.browserCleanup = "CONTEXT_CLOSE_FAILED"; failed = true; }
    try { await closeOwnedBrowserServer({ browserServer, bounded, stage: () => {} }); }
    catch { report.browserCleanup = "FAILED"; failed = true; }
    try { if (roomId) await finishOwnedMatch(); }
    catch { report.cleanup = "PENDING_REQUIRES_OWNED_TEST_ROOM_FOLLOWUP"; failed = true; }
    clearTimeout(hardTimeout);
    report.ok = !failed && report.cleanup === "TERMINAL_CONFIRMED_NO_DELETION";
    report.completedAt = new Date().toISOString();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
})().catch(() => { clearTimeout(hardTimeout); console.error("FAIL unhandled canary error (details redacted)"); process.exitCode = 1; });
