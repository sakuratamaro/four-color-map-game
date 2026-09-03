"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  // Explicit browser gate; run with bundled Playwright in NODE_PATH.
}

const root = path.join(__dirname, "..");
const productBundle = fs.readFileSync(path.join(root, "standard-v5", "app.bundle.js"), "utf8");
const settlementNeedle = "const settled = await session.settle();";
const renderNeedle = "function renderResult(projection) {";
const instrumentedBundle = productBundle
  .replace(settlementNeedle, "const settled = await globalThis.__codexSettlementDelayAdapter(() => session.settle());")
  .replace(renderNeedle, `${renderNeedle}\n    globalThis.__codexSettlementMetrics.resultRenders += 1;`);
let baseUrl = null;
const saveKey = "fourColorMapGame.standard.v5.save";

assert.notEqual(instrumentedBundle, productBundle, "settlement delay adapter must be injected only into the served test response");
assert.equal(instrumentedBundle.includes(settlementNeedle), false);

function installedBrowserExecutable() {
  return [
    process.env.PLAYWRIGHT_BROWSER_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    chromium?.executablePath(),
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function sha(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    const server = http.createServer((request, response) => {
      const requestPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
      const target = path.resolve(root, relative);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      fs.stat(target, (statError, stat) => {
        const file = !statError && stat.isDirectory() ? path.join(target, "index.html") : target;
        fs.readFile(file, (error, body) => {
          if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); return; }
          response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
          response.end(body);
        });
      });
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve(server);
    });
  });
}

async function installHarness(context) {
  await context.route("**/standard-v5/app.bundle.js", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: instrumentedBundle,
  }));
  await context.addInitScript(({ key, delayMs }) => {
    globalThis.__codexSettlementMetrics = {
      adapterCalls: 0,
      transactionCalls: 0,
      saveWrites: 0,
      failedWriteAttempts: 0,
      generatedIds: 0,
      resultRenders: 0,
    };
    let settlementFailuresRemaining = 0;
    globalThis.__codexSetSettlementFailures = (count) => { settlementFailuresRemaining = count; };
    globalThis.__codexSettlementDelayAdapter = async (transaction) => {
      globalThis.__codexSettlementMetrics.adapterCalls += 1;
      if (globalThis.__codexSettlementMetrics.adapterCalls > 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      globalThis.__codexSettlementMetrics.transactionCalls += 1;
      return transaction();
    };

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function instrumentedSetItem(name, value) {
      if (name === key && settlementFailuresRemaining > 0) {
        let decoded = null;
        try { decoded = JSON.parse(value); } catch { decoded = null; }
        if (decoded?.activeMatch?.settlement?.settled === true) {
          settlementFailuresRemaining -= 1;
          globalThis.__codexSettlementMetrics.failedWriteAttempts += 1;
          throw new DOMException("forced-delayed-settlement-failure", "QuotaExceededError");
        }
      }
      const result = originalSetItem.call(this, name, value);
      if (name === key) globalThis.__codexSettlementMetrics.saveWrites += 1;
      return result;
    };
    const originalRandomUUID = globalThis.crypto.randomUUID.bind(globalThis.crypto);
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value() {
        globalThis.__codexSettlementMetrics.generatedIds += 1;
        return originalRandomUUID();
      },
    });
  }, { key: saveKey, delayMs: 650 });
}

async function persistedPayload(page) {
  const payload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  assert.ok(payload);
  return payload;
}

async function persistedRoot(page) {
  return JSON.parse(await persistedPayload(page));
}

async function metrics(page) {
  return page.evaluate(() => ({ ...globalThis.__codexSettlementMetrics }));
}

function reservationCount(rootValue) {
  return Object.values(rootValue.reservations).reduce(
    (total, inventory) => total + Object.values(inventory).reduce((subtotal, count) => subtotal + count, 0),
    0,
  );
}

function snapshot(rootValue, payload) {
  return {
    payloadSha256: sha(payload),
    rootRevision: rootValue.rootRevision,
    matchVersion: rootValue.activeMatch.state.version,
    status: rootValue.activeMatch.state.status,
    phase: rootValue.activeMatch.state.phase,
    winner: rootValue.activeMatch.state.winner,
    terminalReason: rootValue.activeMatch.state.terminalReason,
    settled: rootValue.activeMatch.settlement.settled,
    settlementReceipts: Object.keys(rootValue.receipts.matchSettlement.byMatchId).length,
    reservations: reservationCount(rootValue),
    stats: Object.fromEntries(Object.entries(rootValue.profiles).map(([id, profile]) => [id, { ...profile.stats }])),
    history: Object.fromEntries(Object.entries(rootValue.profiles).map(([id, profile]) => [id, profile.matchHistory.length])),
  };
}

async function bootToRetry(page, failureCount = 1) {
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await page.getByLabel("🎲 Xマス演出").uncheck();
  await page.getByLabel("初期持ち色演出").uncheck();
  await page.getByRole("button", { name: "標準α対戦を開始" }).click();
  await page.getByText(/Turn 1・Player A・CREATE_FIRST/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.evaluate((count) => globalThis.__codexSetSettlementFailures(count), failureCount);
  await page.getByRole("button", { name: "投了" }).click();
  await page.getByText("対戦は終了しましたが、戦績を保存できていません。").waitFor();
  const retry = page.getByRole("button", { name: "もう一度保存" });
  await retry.waitFor();
  assert.equal(await retry.isEnabled(), true);
  const payload = await persistedPayload(page);
  const rootValue = JSON.parse(payload);
  assert.deepEqual(
    [rootValue.activeMatch.state.status, rootValue.activeMatch.state.phase, rootValue.activeMatch.state.winner, rootValue.activeMatch.state.terminalReason],
    ["FINISHED", "GAME_OVER", "B", "SURRENDER"],
  );
  assert.equal(rootValue.activeMatch.settlement.settled, false);
  return { retry, payload, rootValue, before: snapshot(rootValue, payload), beforeMetrics: await metrics(page) };
}

async function activateRetry(page, retry, gesture) {
  if (gesture === "pointer") {
    await retry.scrollIntoViewIfNeeded();
    const box = await retry.boundingBox();
    assert.ok(box);
    const point = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
    await page.mouse.click(point.x, point.y);
    return async () => page.mouse.click(point.x, point.y);
  }
  await retry.focus();
  if (gesture.endsWith("-repeat")) {
    const key = gesture.split("-")[0];
    await page.keyboard.down(key);
    await page.keyboard.down(key);
    await page.keyboard.up(key);
    return async () => page.keyboard.press(key);
  }
  await page.keyboard.press(gesture);
  return async () => page.keyboard.press(gesture);
}

async function assertSuccessfulInflightRetry(browser, gesture) {
  const context = await browser.newContext();
  await installHarness(context);
  const page = await context.newPage();
  try {
    const initial = await bootToRetry(page);
    const retryHandle = await initial.retry.elementHandle();
    assert.ok(retryHandle);
    const secondActivation = await activateRetry(page, initial.retry, gesture);
    await page.waitForTimeout(375);

    assert.equal(await initial.retry.isDisabled(), true);
    assert.equal(await initial.retry.getAttribute("aria-busy"), "true");
    const during = await metrics(page);
    assert.equal(during.adapterCalls, initial.beforeMetrics.adapterCalls + 1);
    assert.equal(during.transactionCalls, initial.beforeMetrics.transactionCalls);
    assert.equal(during.generatedIds, initial.beforeMetrics.generatedIds);
    assert.equal(during.saveWrites, initial.beforeMetrics.saveWrites);
    await secondActivation();
    await page.waitForTimeout(50);
    assert.deepEqual(await metrics(page), during);

    await page.getByText("戦績を保存しました。").waitFor();
    const payload = await persistedPayload(page);
    const rootValue = JSON.parse(payload);
    const after = snapshot(rootValue, payload);
    const afterMetrics = await metrics(page);
    assert.equal(after.rootRevision, initial.before.rootRevision + 1);
    assert.equal(after.matchVersion, initial.before.matchVersion);
    assert.equal(after.settlementReceipts, initial.before.settlementReceipts + 1);
    assert.equal(after.reservations, 0);
    assert.ok(initial.before.reservations > 0);
    assert.equal(after.stats.playerA.losses, initial.before.stats.playerA.losses + 1);
    assert.equal(after.stats.playerB.wins, initial.before.stats.playerB.wins + 1);
    assert.equal(after.stats.playerA.currentWinStreak, 0);
    assert.equal(after.stats.playerB.currentWinStreak, initial.before.stats.playerB.currentWinStreak + 1);
    assert.equal(after.history.playerA, initial.before.history.playerA + 1);
    assert.equal(after.history.playerB, initial.before.history.playerB + 1);
    assert.equal(after.settled, true);
    assert.equal(afterMetrics.adapterCalls, initial.beforeMetrics.adapterCalls + 1);
    assert.equal(afterMetrics.transactionCalls, initial.beforeMetrics.transactionCalls + 1);
    assert.equal(afterMetrics.saveWrites, initial.beforeMetrics.saveWrites + 1);
    assert.equal(afterMetrics.failedWriteAttempts, initial.beforeMetrics.failedWriteAttempts);
    assert.equal(afterMetrics.generatedIds, initial.beforeMetrics.generatedIds, "settlement reuses matchId as its operationId");
    assert.equal(afterMetrics.resultRenders, initial.beforeMetrics.resultRenders + 1);

    const stableMetrics = { ...afterMetrics };
    const stablePayload = payload;
    await retryHandle.evaluate((button) => button.click());
    await page.waitForTimeout(50);
    assert.equal(await retryHandle.evaluate((button) => button.isConnected), true);
    assert.equal(await retryHandle.evaluate((button) => button.hidden), true);
    assert.deepEqual(await metrics(page), stableMetrics);
    assert.equal(await persistedPayload(page), stablePayload);
  } finally {
    await context.close();
  }
}

async function assertFailedRetryUnlocks(browser) {
  const context = await browser.newContext();
  await installHarness(context);
  const page = await context.newPage();
  try {
    const initial = await bootToRetry(page, 2);
    const oldRetry = await initial.retry.elementHandle();
    assert.ok(oldRetry);
    const secondActivation = await activateRetry(page, initial.retry, "pointer");
    await page.waitForTimeout(375);
    assert.equal(await initial.retry.isDisabled(), true);
    assert.equal(await initial.retry.getAttribute("aria-busy"), "true");
    await secondActivation();
    await page.waitForFunction((button) => button.isConnected && !button.hidden && !button.disabled, oldRetry);
    const newRetry = page.getByRole("button", { name: "もう一度保存" });
    await newRetry.waitFor();
    assert.equal(await oldRetry.evaluate((button) => button.isConnected), true);
    assert.equal(await newRetry.isEnabled(), true);
    assert.equal(await newRetry.getAttribute("aria-busy"), null);
    assert.equal(await persistedPayload(page), initial.payload);
    const failedMetrics = await metrics(page);
    assert.equal(failedMetrics.adapterCalls, initial.beforeMetrics.adapterCalls + 1);
    assert.equal(failedMetrics.transactionCalls, initial.beforeMetrics.transactionCalls + 1);
    assert.equal(failedMetrics.saveWrites, initial.beforeMetrics.saveWrites);
    assert.equal(failedMetrics.failedWriteAttempts, initial.beforeMetrics.failedWriteAttempts + 1);
    assert.equal(failedMetrics.generatedIds, initial.beforeMetrics.generatedIds);
    assert.equal(failedMetrics.resultRenders, initial.beforeMetrics.resultRenders + 1);

    await newRetry.click();
    await page.getByText("戦績を保存しました。").waitFor();
    const rootValue = await persistedRoot(page);
    const finalMetrics = await metrics(page);
    assert.equal(rootValue.rootRevision, initial.before.rootRevision + 1);
    assert.equal(rootValue.activeMatch.settlement.settled, true);
    assert.equal(Object.keys(rootValue.receipts.matchSettlement.byMatchId).length, initial.before.settlementReceipts + 1);
    assert.equal(finalMetrics.adapterCalls, initial.beforeMetrics.adapterCalls + 2);
    assert.equal(finalMetrics.transactionCalls, initial.beforeMetrics.transactionCalls + 2);
    assert.equal(finalMetrics.saveWrites, initial.beforeMetrics.saveWrites + 1);
    assert.equal(finalMetrics.generatedIds, initial.beforeMetrics.generatedIds);
    assert.equal(finalMetrics.resultRenders, initial.beforeMetrics.resultRenders + 2);
  } finally {
    await context.close();
  }
}

test("settlement retry remains exclusive for a 650 ms async persistence window", { skip: !chromium || !installedBrowserExecutable() }, async (t) => {
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: installedBrowserExecutable() });
    for (const [name, gesture] of [
      ["pointer second activation at 375 ms", "pointer"],
      ["native Enter second activation at 375 ms", "Enter"],
      ["native Space second activation at 375 ms", "Space"],
      ["native Enter repeat plus delayed activation", "Enter-repeat"],
      ["native Space repeat plus delayed activation", "Space-repeat"],
    ]) await t.test(name, () => assertSuccessfulInflightRetry(browser, gesture));
    await t.test("a delayed failed retry unlocks and the next retry settles once", () => assertFailedRetryUnlocks(browser));
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});
