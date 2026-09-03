"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const standardMatch = require("../standard/standard-match.js");
const standardSave = require("../standard/standard-save.js");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit browser gate */ }

const root = path.resolve(__dirname, "..");
const saveKey = "fourColorMapGame.standard.v5.save";
const productBundle = fs.readFileSync(path.join(root, "standard-v5", "app.bundle.js"), "utf8");
const sessionNeedle = "const session = createStandardLocalSession({ storageAdapter: localStorage, clock: { now: () => new Date().toISOString() }, idFactory: makeId });";
const dispatchNeedle = "const result = await session.dispatchAction({ actorSeat, type, payload });";
const settleNeedle = "const settled = await session.settle();";
const revealNeedle = "function showTerminalReveal({ eventId, matchId, sessionGeneration, headline, resultText } = {}) {";
const contactRevealNeedle = "function showContactReveal(contactColorCount) {";
const instrumentedBundle = productBundle
  .replace(sessionNeedle, "const session = createStandardLocalSession({ storageAdapter: localStorage, clock: { now: () => globalThis.__terminalNow || new Date().toISOString() }, idFactory: makeId });")
  .replace(dispatchNeedle, "const result = await globalThis.__terminalActionAdapter(type, () => session.dispatchAction({ actorSeat, type, payload }));")
  .replace(settleNeedle, "globalThis.__terminalMetrics.settlementCalls += 1; const settled = await globalThis.__terminalSettlementAdapter(() => session.settle());")
  .replace(revealNeedle, `${revealNeedle} globalThis.__terminalMetrics.revealCalls += 1;`)
  .replace(contactRevealNeedle, `${contactRevealNeedle} globalThis.__terminalMetrics.contactRevealCalls += 1;`);

assert.notEqual(instrumentedBundle, productBundle);
assert.equal(instrumentedBundle.includes(sessionNeedle), false);
assert.equal(instrumentedBundle.includes(dispatchNeedle), false);
assert.equal(instrumentedBundle.includes(settleNeedle), false);

function browserExecutable() {
  return [process.env.PLAYWRIGHT_BROWSER_EXECUTABLE, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", chromium?.executablePath()]
    .filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function startServer() {
  return new Promise((resolve, reject) => {
    const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const target = path.resolve(root, relative);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end("Forbidden"); return; }
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
    server.listen(0, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function installHarness(context) {
  await context.route("**/standard-v5/app.bundle.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: instrumentedBundle }));
  await context.addInitScript(({ key }) => {
    globalThis.__terminalMetrics = { actionAdapterCalls: 0, terminalWriteAttempts: 0, successfulTerminalWrites: 0, settlementCalls: 0, settlementWriteAttempts: 0, successfulSettlementWrites: 0, revealCalls: 0, contactRevealCalls: 0, generatedIds: 0 };
    globalThis.__terminalContactTimerCallbacks = [];
    globalThis.__terminalRevealTimerCallbacks = [];
    let terminalFailures = 0;
    let settlementFailures = 0;
    let actionDelayMs = 0;
    globalThis.__setTerminalFailures = (count) => { terminalFailures = count; };
    globalThis.__setSettlementFailures = (count) => { settlementFailures = count; };
    globalThis.__setTerminalActionDelay = (delay) => { actionDelayMs = delay; };
    globalThis.__terminalActionAdapter = async (type, transaction) => {
      if (type === "SURRENDER") {
        globalThis.__terminalMetrics.actionAdapterCalls += 1;
        if (actionDelayMs) await new Promise((resolve) => setTimeout(resolve, actionDelayMs));
      }
      return transaction();
    };
    globalThis.__terminalSettlementAdapter = async (transaction) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return transaction();
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(name, value) {
      let terminalWrite = false;
      let settlementWrite = false;
      if (name === key) {
        try {
          const decoded = JSON.parse(value);
          terminalWrite = decoded?.activeMatch?.state?.status === "FINISHED" && decoded?.activeMatch?.settlement?.settled === false;
          settlementWrite = decoded?.activeMatch?.state?.status === "FINISHED" && decoded?.activeMatch?.settlement?.settled === true;
        } catch { terminalWrite = false; }
      }
      if (terminalWrite) {
        globalThis.__terminalMetrics.terminalWriteAttempts += 1;
        if (terminalFailures > 0) {
          terminalFailures -= 1;
          throw new DOMException("forced-terminal-action-failure", "QuotaExceededError");
        }
      }
      if (settlementWrite) {
        globalThis.__terminalMetrics.settlementWriteAttempts += 1;
        if (settlementFailures > 0) {
          settlementFailures -= 1;
          throw new DOMException("forced-settlement-failure", "QuotaExceededError");
        }
      }
      const result = originalSetItem.call(this, name, value);
      if (terminalWrite) globalThis.__terminalMetrics.successfulTerminalWrites += 1;
      if (settlementWrite) globalThis.__terminalMetrics.successfulSettlementWrites += 1;
      return result;
    };
    const originalRandomUUID = crypto.randomUUID.bind(crypto);
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value() {
      globalThis.__terminalMetrics.generatedIds += 1;
      return globalThis.__terminalUuidQueue?.length ? globalThis.__terminalUuidQueue.shift() : originalRandomUUID();
    } });
    const originalSetTimeout = globalThis.setTimeout.bind(globalThis);
    globalThis.setTimeout = function measuredSetTimeout(callback, delay, ...args) {
      if (delay === 900) globalThis.__terminalContactTimerCallbacks.push(callback);
      if (delay === 1200) globalThis.__terminalRevealTimerCallbacks.push(callback);
      return originalSetTimeout(callback, delay, ...args);
    };
  }, { key: saveKey });
}

async function boot(page, baseUrl, bootstrapQuery = "") {
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html${bootstrapQuery}`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await page.getByLabel("🎲 Xマス演出").uncheck();
  await page.getByLabel("初期持ち色演出").uncheck();
  await page.getByRole("button", { name: "標準α対戦を開始" }).click();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
}

async function metrics(page) { return page.evaluate(() => ({ ...globalThis.__terminalMetrics })); }

function reservationCount(rootValue) {
  return Object.values(rootValue.reservations).reduce(
    (total, inventory) => total + Object.values(inventory).reduce((subtotal, count) => subtotal + count, 0),
    0,
  );
}

function macroMicroCells(macro) {
  const macroRow = Math.floor(macro / 12);
  const macroCol = macro % 12;
  const cells = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) cells.push(((macroRow * 4) + row) * 48 + (macroCol * 4) + col);
  }
  return cells;
}

async function bootToBWork(page, baseUrl) {
  await boot(page, baseUrl);
  const cells = page.locator('[aria-label="盤面"] button');
  await cells.nth(13).click();
  await cells.nth(14).click();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
  await page.getByText(/Turn 2・Player B・COLOR/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByRole("button", { name: "緑", exact: true }).first().click();
  await page.getByText(/Turn 2・Player B・WORK/).waitFor();
}

async function installTierFourContactState(page) {
  const rootValue = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
  for (const [id, macro, color] of [["R2", 25, "blue"], ["R3", 27, "yellow"], ["R4", 38, "red"]]) {
    rootValue.activeMatch.state.regions[id] = { id, micro: macroMicroCells(macro), sourceMacros: [macro], controllers: ["A"], color, isPending: false };
  }
  standardMatch.validateStandardState(rootValue.activeMatch.state);
  standardSave.validateStandardSave(rootValue);
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: saveKey, payload: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await page.getByText(/Turn 2・Player B・WORK/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
}

test("failed terminal persistence stays active and same-intent retry reveals exactly once", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await installHarness(context);
  const page = await context.newPage();
  await boot(page, baseUrl);
  const beforePayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  const beforeMetrics = await metrics(page);
  await page.evaluate(() => globalThis.__setTerminalFailures(1));

  await page.getByRole("button", { name: "投了" }).click();
  await page.getByText("操作できません（PERSISTENCE_FAILED）。").waitFor();
  const failed = await metrics(page);
  assert.equal(failed.terminalWriteAttempts, beforeMetrics.terminalWriteAttempts + 1);
  assert.equal(failed.successfulTerminalWrites, beforeMetrics.successfulTerminalWrites);
  assert.equal(failed.revealCalls, 0);
  assert.equal(failed.settlementCalls, 0);
  assert.equal(failed.generatedIds, beforeMetrics.generatedIds + 1);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforePayload);
  assert.equal(await page.locator(".terminal-reveal").count(), 0);
  assert.equal(await page.locator("#resultPanel").isVisible(), false);
  assert.ok((await page.locator("#privatePanel").textContent()).length > 0);

  await page.getByRole("button", { name: "投了" }).click();
  await page.locator(".terminal-reveal").waitFor();
  assert.match(await page.locator("#settlementStatus").textContent(), /保存しています/);
  const pending = await metrics(page);
  assert.equal(pending.terminalWriteAttempts, beforeMetrics.terminalWriteAttempts + 2);
  assert.equal(pending.successfulTerminalWrites, beforeMetrics.successfulTerminalWrites + 1);
  assert.equal(pending.generatedIds, failed.generatedIds, "retry must reuse the failed action ID");
  assert.equal(pending.revealCalls, 1);
  assert.equal(pending.settlementCalls, 1);
  await page.getByText("戦績を保存しました。").waitFor();
  assert.equal((await metrics(page)).revealCalls, 1);
  assert.equal(await page.locator("#privatePanel").textContent(), "");
  assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);
});

test("650ms terminal action keeps the gesture in flight after the 300ms guard", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await installHarness(context);
  const page = await context.newPage();
  await boot(page, baseUrl);
  await page.evaluate(() => globalThis.__setTerminalActionDelay(650));
  const surrender = page.getByRole("button", { name: "投了" });
  await surrender.click();
  await page.waitForTimeout(375);
  await surrender.click();
  const during = await metrics(page);
  assert.equal(during.actionAdapterCalls, 1);
  assert.equal(during.terminalWriteAttempts, 0);
  assert.equal(during.revealCalls, 0);
  assert.equal(during.settlementCalls, 0);
  await page.locator(".terminal-reveal").waitFor();
  const after = await metrics(page);
  assert.equal(after.actionAdapterCalls, 1);
  assert.equal(after.terminalWriteAttempts, 1);
  assert.equal(after.successfulTerminalWrites, 1);
  assert.equal(after.revealCalls, 1);
  assert.equal(after.settlementCalls, 1);
  await page.getByText("戦績を保存しました。").waitFor();
  assert.equal((await metrics(page)).revealCalls, 1);
});

test("settlement failure and retry never replay terminal or contact presentation", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await installHarness(context);
  const page = await context.newPage();
  await boot(page, baseUrl);
  const before = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
  await page.evaluate(() => globalThis.__setSettlementFailures(1));
  await page.getByRole("button", { name: "投了" }).click();
  await page.getByText("対戦は終了しましたが、戦績を保存できていません。").waitFor();
  const failed = await metrics(page);
  assert.equal(failed.terminalWriteAttempts, 1);
  assert.equal(failed.successfulTerminalWrites, 1);
  assert.equal(failed.settlementCalls, 1);
  assert.equal(failed.settlementWriteAttempts, 1);
  assert.equal(failed.successfulSettlementWrites, 0);
  assert.equal(failed.revealCalls, 1);
  assert.equal(failed.contactRevealCalls, 0);
  assert.equal(await page.locator("#privatePanel").textContent(), "");
  assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);
  const failedRoot = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
  assert.equal(failedRoot.activeMatch.settlement.settled, false);
  assert.equal(failedRoot.profiles.playerA.stats.losses, before.profiles.playerA.stats.losses);
  assert.equal(failedRoot.profiles.playerB.stats.wins, before.profiles.playerB.stats.wins);

  await page.getByRole("button", { name: "もう一度保存" }).click();
  await page.getByText("戦績を保存しました。").waitFor();
  const settled = await metrics(page);
  assert.equal(settled.settlementCalls, 2);
  assert.equal(settled.settlementWriteAttempts, 2);
  assert.equal(settled.successfulSettlementWrites, 1);
  assert.equal(settled.revealCalls, 1);
  assert.equal(settled.contactRevealCalls, 0);
  const settledPayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  const settledRoot = JSON.parse(settledPayload);
  assert.equal(settledRoot.activeMatch.settlement.settled, true);
  assert.equal(settledRoot.profiles.playerA.stats.losses, before.profiles.playerA.stats.losses + 1);
  assert.equal(settledRoot.profiles.playerB.stats.wins, before.profiles.playerB.stats.wins + 1);
  assert.equal(settledRoot.profiles.playerA.matchHistory.length, before.profiles.playerA.matchHistory.length + 1);
  assert.equal(settledRoot.profiles.playerB.matchHistory.length, before.profiles.playerB.matchHistory.length + 1);

  await page.reload({ waitUntil: "load" });
  await page.getByText("戦績を保存しました。").waitFor();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), settledPayload);
  const reloaded = await metrics(page);
  assert.equal(reloaded.revealCalls, 0);
  assert.equal(reloaded.contactRevealCalls, 0);
  assert.equal(reloaded.settlementCalls, 0);
  assert.equal(reloaded.terminalWriteAttempts, 0);
  assert.equal(reloaded.settlementWriteAttempts, 0);
  assert.equal(reloaded.generatedIds, 0);
  assert.equal(await page.locator(".terminal-reveal,.contact-reveal").count(), 0);
  assert.equal(await page.locator("#privatePanel").textContent(), "");
  assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);
});

test("terminal presentation keeps match-start name snapshots literal after profile renames and reload", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await installHarness(context);
  const page = await context.newPage();
  await boot(page, baseUrl, "?xss=1");

  const snapshotA = "><img src=x onerror=document.title=1>";
  const snapshotB = "<svg onload=document.title=2>";
  const currentA = "<script>document.title=3</script>";
  const currentB = "<img src=x onerror=document.title=4>";
  const startState = await page.evaluate(({ key, currentAName, currentBName }) => {
    const rootValue = JSON.parse(localStorage.getItem(key));
    const snapshots = {
      A: rootValue.activeMatch.participants.A.displayNameSnapshot,
      B: rootValue.activeMatch.participants.B.displayNameSnapshot,
    };
    rootValue.profiles.playerA.displayName = currentAName;
    rootValue.profiles.playerB.displayName = currentBName;
    localStorage.setItem(key, JSON.stringify(rootValue));
    return snapshots;
  }, { key: saveKey, currentAName: currentA, currentBName: currentB });
  assert.deepEqual(startState, { A: snapshotA, B: snapshotB });

  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  const scriptCount = await page.locator("script").count();
  await page.getByRole("button", { name: "投了" }).click();
  const reveal = page.locator(".terminal-reveal");
  await reveal.waitFor();
  assert.equal(await reveal.locator(".terminal-reveal-result").textContent(), `${snapshotB} の勝利`);
  assert.equal(await page.locator("#terminalWinner").textContent(), `${snapshotB} の勝利`);
  assert.equal(await page.locator("#terminalReason").textContent(), `${snapshotA} が投了しました。`);
  assert.equal(await page.getByText(currentA, { exact: true }).count(), 0);
  assert.equal(await page.getByText(currentB, { exact: true }).count(), 0);
  assert.equal(await page.locator("img,svg").count(), 0);
  assert.equal(await page.locator("script").count(), scriptCount);
  assert.notEqual(await page.title(), "1");
  assert.notEqual(await page.title(), "2");
  assert.notEqual(await page.title(), "3");
  assert.notEqual(await page.title(), "4");

  await page.getByText("戦績を保存しました。").waitFor();
  const settledPayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  const settledRoot = JSON.parse(settledPayload);
  assert.equal(settledRoot.profiles.playerA.displayName, currentA);
  assert.equal(settledRoot.profiles.playerB.displayName, currentB);
  assert.equal(settledRoot.activeMatch.participants.A.displayNameSnapshot, snapshotA);
  assert.equal(settledRoot.activeMatch.participants.B.displayNameSnapshot, snapshotB);
  assert.equal(settledRoot.profiles.playerA.matchHistory.at(-1).displayNameSnapshot, snapshotA);
  assert.equal(settledRoot.profiles.playerB.matchHistory.at(-1).displayNameSnapshot, snapshotB);

  await page.reload({ waitUntil: "load" });
  await page.getByText("戦績を保存しました。").waitFor();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), settledPayload);
  assert.equal(await page.locator("#terminalWinner").textContent(), `${snapshotB} の勝利`);
  assert.equal(await page.locator("#terminalReason").textContent(), `${snapshotA} が投了しました。`);
  assert.equal(await page.locator(".terminal-reveal,.contact-reveal,img,svg").count(), 0);
  assert.equal(await page.locator("script").count(), scriptCount);
  assert.equal((await metrics(page)).revealCalls, 0);
  assert.equal((await metrics(page)).contactRevealCalls, 0);
  assert.equal((await metrics(page)).settlementCalls, 0);
  assert.notEqual(await page.title(), "1");
  assert.notEqual(await page.title(), "2");
  assert.notEqual(await page.title(), "3");
  assert.notEqual(await page.title(), "4");
});

test("terminal presentation outranks a product-path contact reveal and rejects its stale timer", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await installHarness(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await bootToBWork(page, baseUrl);
  await installTierFourContactState(page);

  const before = await metrics(page);
  await page.locator('[aria-label="盤面"] button').nth(26).click();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
  const contact = page.locator("#contactReveal");
  await contact.waitFor();
  assert.match(await contact.textContent(), /四色包囲!!!/);
  const staleContactTimer = await page.evaluate(() => globalThis.__terminalContactTimerCallbacks.length - 1);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByRole("button", { name: "投了" }).click();

  const terminal = page.locator(".terminal-reveal");
  await terminal.waitFor();
  assert.equal(await page.locator("#contactReveal").count(), 0);
  assert.equal(await page.locator(".terminal-reveal").count(), 1);
  const terminalText = await terminal.textContent();
  const terminalPayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  await page.evaluate((index) => globalThis.__terminalContactTimerCallbacks[index](), staleContactTimer);
  assert.equal(await page.locator("#contactReveal").count(), 0);
  assert.equal(await page.locator(".terminal-reveal").count(), 1);
  assert.equal(await terminal.textContent(), terminalText);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), terminalPayload);

  await page.getByText("戦績を保存しました。").waitFor();
  const after = await metrics(page);
  assert.equal(after.contactRevealCalls, before.contactRevealCalls + 1);
  assert.equal(after.revealCalls, before.revealCalls + 1);
  assert.equal(after.settlementCalls, before.settlementCalls + 1);
  assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
});

test("new-match teardown is equivalent before or after terminal reveal removal", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  t.after(() => browser.close());
  const fixedUuids = Object.freeze(Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-${String(index + 201).padStart(12, "0")}`));

  async function run(waitForRemoval) {
    const context = await browser.newContext();
    await installHarness(context);
    await context.addInitScript(({ now, uuids }) => {
      globalThis.__terminalNow = now;
      globalThis.__terminalUuidQueue = [...uuids];
    }, { now: "2026-09-01T00:00:00.000Z", uuids: fixedUuids });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
      await boot(page, baseUrl);
      await page.getByRole("button", { name: "投了" }).click();
      const terminal = page.locator(".terminal-reveal");
      await terminal.waitFor();
      const staleTerminalTimer = await page.evaluate(() => globalThis.__terminalRevealTimerCallbacks.length - 1);
      await page.getByText("戦績を保存しました。").waitFor();
      if (waitForRemoval) await terminal.waitFor({ state: "detached", timeout: 1800 });

      await page.getByRole("button", { name: "標準α対戦を開始" }).click();
      await page.getByText(/Turn 1・Player A・CREATE_FIRST/).waitFor();
      await page.locator("#handover").waitFor({ state: "visible" });
      assert.equal(await page.locator(".terminal-reveal,.contact-reveal").count(), 0);
      assert.equal(await page.locator("#resultPanel").isVisible(), false);
      const saved = await page.evaluate((key) => localStorage.getItem(key), saveKey);
      const screen = await page.evaluate(() => ({
        handoverHidden: document.getElementById("handover").hidden,
        handoverSeat: document.getElementById("handoverSeat").textContent,
        privateText: document.getElementById("privatePanel").textContent,
        statusText: document.getElementById("status").textContent,
        resultHidden: document.getElementById("resultPanel").hidden,
      }));
      const beforeStaleTimer = await metrics(page);
      await page.evaluate((index) => globalThis.__terminalRevealTimerCallbacks[index](), staleTerminalTimer);
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), saved);
      assert.deepEqual(await metrics(page), beforeStaleTimer);
      assert.equal(await page.locator(".terminal-reveal,.contact-reveal").count(), 0);
      assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
      return { saved, screen, metrics: beforeStaleTimer };
    } finally {
      await context.close();
    }
  }

  const pendingReveal = await run(false);
  const removedReveal = await run(true);
  assert.deepEqual(pendingReveal, removedReveal);
});

test("terminal transient and static result fit the exact three target viewports", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  t.after(() => browser.close());
  const viewports = [
    { width: 390, height: 844, touch: true },
    { width: 768, height: 1024, touch: false },
    { width: 1365, height: 768, touch: false },
  ];

  for (const viewport of viewports) {
    await t.test(`${viewport.width}x${viewport.height}`, async () => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.touch,
        hasTouch: viewport.touch,
      });
      await installHarness(context);
      const page = await context.newPage();
      const consoleProblems = [];
      page.on("console", (message) => {
        if (["warning", "error"].includes(message.type())) consoleProblems.push(`${message.type()}:${message.text()}`);
      });
      page.on("pageerror", (error) => consoleProblems.push(`pageerror:${error.message}`));
      try {
        await boot(page, baseUrl);
        const surrender = page.getByRole("button", { name: "投了" });
        await surrender.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
        const surrenderBox = await surrender.boundingBox();
        assert.ok(surrenderBox && surrenderBox.width > 0 && surrenderBox.height > 0);
        if (viewport.touch) {
          assert.ok(surrenderBox.width >= 44 && surrenderBox.height >= 44);
          await page.touchscreen.tap(surrenderBox.x + surrenderBox.width / 2, surrenderBox.y + surrenderBox.height / 2);
        } else {
          await surrender.click();
        }

        const terminal = page.locator(".terminal-reveal");
        await terminal.waitFor();
        const transientGeometry = await terminal.evaluate((layer) => {
          const card = layer.querySelector(".terminal-reveal-card");
          const layerRect = layer.getBoundingClientRect();
          const cardRect = card.getBoundingClientRect();
          return {
            innerWidth,
            innerHeight,
            documentScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            layer: { left: layerRect.left, top: layerRect.top, right: layerRect.right, bottom: layerRect.bottom },
            card: { left: cardRect.left, top: cardRect.top, right: cardRect.right, bottom: cardRect.bottom },
            pointerEvents: getComputedStyle(layer).pointerEvents,
            ariaHidden: layer.getAttribute("aria-hidden"),
            focusable: layer.querySelectorAll("button,a,input,select,textarea,[tabindex]:not([tabindex='-1'])").length,
          };
        });
        assert.equal(transientGeometry.innerWidth, viewport.width);
        assert.equal(transientGeometry.innerHeight, viewport.height);
        assert.ok(transientGeometry.documentScrollWidth <= viewport.width);
        assert.ok(transientGeometry.bodyScrollWidth <= viewport.width);
        assert.deepEqual(transientGeometry.layer, { left: 0, top: 0, right: viewport.width, bottom: viewport.height });
        assert.ok(transientGeometry.card.left >= 0 && transientGeometry.card.right <= viewport.width);
        assert.ok(transientGeometry.card.top >= 0 && transientGeometry.card.bottom <= viewport.height);
        assert.equal(transientGeometry.pointerEvents, "none");
        assert.equal(transientGeometry.ariaHidden, "true");
        assert.equal(transientGeometry.focusable, 0);

        await page.getByText("戦績を保存しました。").waitFor();
        const resultPanel = page.locator("#resultPanel");
        await resultPanel.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
        const staticGeometry = await resultPanel.evaluate((panel) => {
          const rect = panel.getBoundingClientRect();
          return {
            documentScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            rect: { left: rect.left, right: rect.right, width: rect.width },
          };
        });
        assert.ok(staticGeometry.documentScrollWidth <= viewport.width);
        assert.ok(staticGeometry.bodyScrollWidth <= viewport.width);
        assert.ok(staticGeometry.rect.left >= 0 && staticGeometry.rect.right <= viewport.width && staticGeometry.rect.width > 0);
        assert.equal(await page.locator("#privatePanel").textContent(), "");
        assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);

        const settledPayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        await page.reload({ waitUntil: "load" });
        await page.getByText("戦績を保存しました。").waitFor();
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), settledPayload);
        assert.equal(await page.locator(".terminal-reveal,.contact-reveal").count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth));
        assert.deepEqual(await metrics(page), {
          actionAdapterCalls: 0,
          terminalWriteAttempts: 0,
          successfulTerminalWrites: 0,
          settlementCalls: 0,
          settlementWriteAttempts: 0,
          successfulSettlementWrites: 0,
          revealCalls: 0,
          contactRevealCalls: 0,
          generatedIds: 0,
        });
        assert.equal(consoleProblems.length, 0, JSON.stringify(consoleProblems));
      } finally {
        await context.close();
      }
    });
  }
});

test("SURRENDER pointer Enter and Space repetition is exactly once in fresh contexts", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  async function run(gesture) {
    const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
    const context = await browser.newContext();
    await installHarness(context);
    const page = await context.newPage();
    try {
      await boot(page, baseUrl);
      const beforeMetrics = await metrics(page);
      const beforeRoot = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
      const surrender = page.getByRole("button", { name: "投了" });
      if (gesture === "pointer") {
        await surrender.click({ clickCount: 2, delay: 0 });
      } else {
        await surrender.focus();
        await page.keyboard.down(gesture);
        await page.keyboard.down(gesture);
        await page.keyboard.up(gesture);
      }
      await page.getByText("戦績を保存しました。").waitFor();
      const afterMetrics = await metrics(page);
      const afterRoot = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
      assert.equal(afterMetrics.actionAdapterCalls, beforeMetrics.actionAdapterCalls + 1);
      assert.equal(afterMetrics.terminalWriteAttempts, beforeMetrics.terminalWriteAttempts + 1);
      assert.equal(afterMetrics.successfulTerminalWrites, beforeMetrics.successfulTerminalWrites + 1);
      assert.equal(afterMetrics.settlementCalls, beforeMetrics.settlementCalls + 1);
      assert.equal(afterMetrics.settlementWriteAttempts, beforeMetrics.settlementWriteAttempts + 1);
      assert.equal(afterMetrics.successfulSettlementWrites, beforeMetrics.successfulSettlementWrites + 1);
      assert.equal(afterMetrics.revealCalls, beforeMetrics.revealCalls + 1);
      assert.equal(afterMetrics.contactRevealCalls, beforeMetrics.contactRevealCalls);
      assert.equal(afterMetrics.generatedIds, beforeMetrics.generatedIds + 1);
      assert.equal(afterRoot.rootRevision, beforeRoot.rootRevision + 2);
      assert.equal(afterRoot.activeMatch.state.version, beforeRoot.activeMatch.state.version + 1);
      assert.equal(afterRoot.activeMatch.state.terminalReason, "SURRENDER");
      assert.equal(afterRoot.activeMatch.state.winner, "B");
      assert.equal(afterRoot.activeMatch.settlement.settled, true);
      assert.ok(reservationCount(beforeRoot) > 0);
      assert.equal(reservationCount(afterRoot), 0);
      assert.equal(afterRoot.profiles.playerA.stats.losses, beforeRoot.profiles.playerA.stats.losses + 1);
      assert.equal(afterRoot.profiles.playerB.stats.wins, beforeRoot.profiles.playerB.stats.wins + 1);
      assert.equal(afterRoot.profiles.playerA.matchHistory.length, beforeRoot.profiles.playerA.matchHistory.length + 1);
      assert.equal(afterRoot.profiles.playerB.matchHistory.length, beforeRoot.profiles.playerB.matchHistory.length + 1);
      assert.equal(await page.locator("#privatePanel").textContent(), "");
      assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);
    } finally {
      await context.close();
      await browser.close();
    }
  }

  const contextCount = Number(process.env.STANDARD_TERMINAL_REPEAT_CONTEXTS || 5);
  const gestures = (process.env.STANDARD_TERMINAL_REPEAT_GESTURES || "pointer,Enter,Space").split(",").filter(Boolean);
  for (const gesture of gestures) {
    await t.test(`${gesture} ${contextCount} fresh contexts`, async () => {
      for (let index = 0; index < contextCount; index += 1) await run(gesture);
    });
  }
});

test("terminal reveal uses finite scale motion normally and opacity-only reduced motion", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  t.after(() => browser.close());

  async function run(reducedMotion) {
    const context = await browser.newContext();
    await installHarness(context);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion });
    await boot(page, baseUrl);
    await page.getByRole("button", { name: "投了" }).click();
    const layer = page.locator(".terminal-reveal");
    await layer.waitFor();
    const card = layer.locator(".terminal-reveal-card");
    const motion = await card.evaluate((node) => ({
      pointerEvents: getComputedStyle(node.parentElement).pointerEvents,
      animations: node.getAnimations().map((animation) => ({
        name: animation.animationName || "",
        iterations: animation.effect.getTiming().iterations,
        duration: animation.effect.getTiming().duration,
        keyframes: animation.effect.getKeyframes().map((frame) => ({ opacity: frame.opacity, transform: frame.transform })),
      })),
      activeInside: node.contains(document.activeElement),
    }));
    assert.equal(await layer.getAttribute("aria-hidden"), "true");
    assert.equal(await layer.locator("button,a,input,select,textarea,[tabindex]:not([tabindex='-1'])").count(), 0);
    assert.equal(motion.pointerEvents, "none");
    assert.equal(motion.activeInside, false);
    assert.equal(motion.animations.length, 1);
    assert.equal(motion.animations[0].iterations, 1);
    assert.ok(Number.isFinite(motion.animations[0].duration));
    if (reducedMotion === "reduce") {
      assert.equal(motion.animations[0].name, "terminal-reveal-fade");
      assert.ok(motion.animations[0].keyframes.every((frame) => !frame.transform || frame.transform === "none" || frame.transform === "matrix(1, 0, 0, 1, 0, 0)"));
    } else {
      assert.equal(motion.animations[0].name, "terminal-reveal-pop");
      assert.ok(motion.animations[0].keyframes.some((frame) => frame.transform && !["none", "matrix(1, 0, 0, 1, 0, 0)", "scale(1)"].includes(frame.transform)));
    }
    await page.getByText("戦績を保存しました。").waitFor();
    const rootValue = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
    const summary = {
      terminalReason: rootValue.activeMatch.state.terminalReason,
      winner: rootValue.activeMatch.state.winner,
      rootRevision: rootValue.rootRevision,
      matchVersion: rootValue.activeMatch.state.version,
      settled: rootValue.activeMatch.settlement.settled,
      stats: Object.fromEntries(Object.entries(rootValue.profiles).map(([id, profile]) => [id, profile.stats])),
      historyLengths: Object.fromEntries(Object.entries(rootValue.profiles).map(([id, profile]) => [id, profile.matchHistory.length])),
      resultText: await page.locator("#resultPanel").textContent(),
      metrics: await metrics(page),
    };
    await layer.waitFor({ state: "detached", timeout: 1800 });
    await context.close();
    return { motion, summary };
  }

  const normal = await run("no-preference");
  const reduced = await run("reduce");
  assert.deepEqual(normal.summary, reduced.summary);
});
