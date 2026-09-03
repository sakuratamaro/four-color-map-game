"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");
const standardMatch = require("../standard/standard-match.js");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  // This is an explicit browser gate. Run it with the bundled Playwright directory in NODE_PATH.
}

const root = path.join(__dirname, "..");
const serverScript = path.join(__dirname, "helpers", "static-server.cjs");
const port = 48754;
const baseUrl = `http://127.0.0.1:${port}`;
const saveKey = "fourColorMapGame.standard.v5.save";

function installedBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_BROWSER_EXECUTABLE,
    chromium?.executablePath(),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function sha(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverScript, String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`static server exited ${code}: ${stderr}`)));
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("STATIC_SERVER")) resolve(child);
    });
  });
}

async function installMetrics(context, metrics) {
  await context.exposeBinding("__codexSaveWrite", () => { metrics.saveWrites += 1; });
  await context.exposeBinding("__codexFailedWriteAttempt", () => { metrics.failedWriteAttempts += 1; });
  await context.exposeBinding("__codexGeneratedId", () => { metrics.generatedIds += 1; });
  await context.addInitScript((key) => {
    const originalSetItem = Storage.prototype.setItem;
    let failNextSettlementWrite = false;
    globalThis.__codexFailNextSettlementWrite = () => { failNextSettlementWrite = true; };
    Storage.prototype.setItem = function instrumentedSetItem(name, value) {
      if (name === key && failNextSettlementWrite) {
        let decoded = null;
        try { decoded = JSON.parse(value); } catch { decoded = null; }
        if (decoded?.activeMatch?.settlement?.settled === true) {
          failNextSettlementWrite = false;
          globalThis.__codexFailedWriteAttempt();
          throw new DOMException("forced-settlement-write-failure", "QuotaExceededError");
        }
      }
      const result = originalSetItem.call(this, name, value);
      if (name === key) globalThis.__codexSaveWrite();
      return result;
    };
    const originalRandomUUID = globalThis.crypto.randomUUID.bind(globalThis.crypto);
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value() {
        globalThis.__codexGeneratedId();
        return originalRandomUUID();
      },
    });
  }, saveKey);
}

async function newMeasuredPage(browser) {
  const metrics = { saveWrites: 0, failedWriteAttempts: 0, generatedIds: 0 };
  const context = await browser.newContext();
  await installMetrics(context, metrics);
  const page = await context.newPage();
  return { context, page, metrics };
}

async function persistedRoot(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  assert.ok(raw, "standard save must exist");
  return JSON.parse(raw);
}

function terminalSnapshot(rootValue) {
  const activeMatch = rootValue.activeMatch;
  const state = activeMatch.state;
  return {
    rootRevision: rootValue.rootRevision,
    matchVersion: state.version,
    status: state.status,
    phase: state.phase,
    winner: state.winner,
    terminalReason: state.terminalReason,
    pending: state.pending,
    pendingColor: state.regions[state.pending]?.color ?? null,
    geometrySha256: sha(Object.values(state.regions).map((region) => ({
      id: region.id,
      micro: region.micro,
      sourceMacros: region.sourceMacros,
      controllers: region.controllers,
      isPending: region.isPending,
    }))),
    cardsSha256: sha({
      hands: state.hands,
      inventory: Object.fromEntries(Object.entries(rootValue.profiles).map(([id, profile]) => [id, profile.inventory])),
    }),
    reservationsSha256: sha(rootValue.reservations),
    rngSha256: sha(activeMatch.rngSnapshot),
    bonusUsesRemaining: { ...state.bonusUsesRemaining },
    actionReceipts: Object.keys(rootValue.receipts.matchAction).length,
    settlementReceipts: Object.keys(rootValue.receipts.matchSettlement.byMatchId).length,
    statsSha256: sha(Object.fromEntries(Object.entries(rootValue.profiles).map(([id, profile]) => [id, profile.stats]))),
    historyLengths: Object.fromEntries(Object.entries(rootValue.profiles).map(([id, profile]) => [id, profile.matchHistory.length])),
    settled: activeMatch.settlement.settled,
  };
}

async function disablePresentation(page) {
  await page.getByLabel("🎲 Xマス演出").uncheck();
  await page.getByLabel("初期持ち色演出").uncheck();
}

async function assertNativeSpaceCreateStability(browser) {
  for (let iteration = 1; iteration <= 20; iteration += 1) {
    const { context, page, metrics } = await newMeasuredPage(browser);
    try {
      await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
      await page.waitForURL(`${baseUrl}/standard-v5/`);
      await disablePresentation(page);
      await page.getByRole("button", { name: "標準α対戦を開始" }).click();
      await page.getByText(/Turn 1・Player A・CREATE_FIRST/).waitFor();
      await page.getByRole("button", { name: "自分の情報を表示" }).click();
      const cells = page.locator('[aria-label="盤面"] button');
      await cells.nth(13).click();
      await cells.nth(14).click();
      const before = await persistedRoot(page);
      const writesBefore = metrics.saveWrites;
      const idsBefore = metrics.generatedIds;
      const commit = page.getByRole("button", { name: "選んだエリアを渡す" });
      await commit.focus();
      await page.keyboard.down(" ");
      await page.keyboard.down(" ");
      await page.keyboard.up(" ");
      await page.getByText(/Turn 2・Player B・COLOR/).waitFor();
      await page.locator("#handover:not([hidden])").waitFor();
      const after = await persistedRoot(page);
      assert.equal(after.rootRevision, before.rootRevision + 1, `iteration ${iteration}`);
      assert.equal(after.activeMatch.state.version, before.activeMatch.state.version + 1, `iteration ${iteration}`);
      assert.equal(metrics.saveWrites, writesBefore + 1, `iteration ${iteration}`);
      assert.equal(metrics.generatedIds, idsBefore + 1, `iteration ${iteration}`);
      assert.equal(Object.keys(after.receipts.matchAction).length, Object.keys(before.receipts.matchAction).length + 1, `iteration ${iteration}`);
    } finally {
      await context.close();
    }
  }
}

async function bootToAColor(page, paletteMode = "basic", prism = false) {
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await disablePresentation(page);
  await page.getByRole("button", { name: "標準α対戦を開始" }).click();
  await page.getByText(/Turn 1・Player A・CREATE_FIRST/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  const cells = page.locator('[aria-label="盤面"] button');
  await cells.nth(13).click();
  await cells.nth(14).click();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
  await page.getByText(/Turn 2・Player B・COLOR/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByRole("button", { name: "緑", exact: true }).first().click();
  await page.getByText(/Turn 2・Player B・WORK/).waitFor();
  assert.equal((await persistedRoot(page)).activeMatch.state.requiredSize, 1);
  await cells.nth(26).click();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
  await page.getByText(/Turn 3・Player A・COLOR/).waitFor();

  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.regions.R1.color = "red";
  assert.equal(state.basicPalettes.A.includes("red"), true);
  if (paletteMode === "bonus") {
    const oldBonus = state.bonusColors.A;
    state.basicPalettes.A = state.basicPalettes.A.map((color) => color === "red" ? oldBonus : color);
    state.bonusColors.A = "red";
    assert.ok(state.bonusUsesRemaining.A > 0);
  }
  if (prism) state.privateEffects.A.prism = true;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await page.getByText(/Turn 3・Player A・COLOR/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  return { red: page.locator("#privatePanel button.color.red"), legal: page.locator("#privatePanel button.color.blue") };
}

async function assertNormalIllegalColorControl(page, red, legal) {
  await red.waitFor();
  assert.equal(await red.count(), 1);
  assert.equal(await red.isDisabled(), false);
  assert.equal(await red.getAttribute("aria-disabled"), null);
  assert.equal(await red.getAttribute("title"), null);
  assert.equal(await red.getAttribute("style"), null);
  assert.equal(await red.getAttribute("data-illegal"), null);
  assert.equal(await red.getAttribute("data-warning"), null);
  assert.equal(await red.evaluate((button) => button.tabIndex), 0);
  const redVisual = await red.evaluate((button) => ({
    opacity: getComputedStyle(button).opacity,
    filter: getComputedStyle(button).filter,
    textDecoration: getComputedStyle(button).textDecorationLine,
    classes: [...button.classList].filter((name) => !["red", "blue", "yellow", "green"].includes(name)),
    text: button.textContent,
  }));
  const legalVisual = await legal.evaluate((button) => ({
    opacity: getComputedStyle(button).opacity,
    filter: getComputedStyle(button).filter,
    textDecoration: getComputedStyle(button).textDecorationLine,
    classes: [...button.classList].filter((name) => !["red", "blue", "yellow", "green"].includes(name)),
  }));
  assert.deepEqual({ ...redVisual, text: undefined }, { ...legalVisual, text: undefined });
  assert.doesNotMatch(redVisual.text, /隣接|禁止|不可|警告|×|✕/);
}

async function activate(control, page, gesture) {
  if (gesture === "pointer") {
    await control.evaluate((button) => { button.click(); button.click(); });
    return;
  }
  await control.focus();
  await page.keyboard.down(gesture);
  await page.keyboard.down(gesture);
  await page.keyboard.up(gesture);
}

async function assertIllegalColorLifecycle(browser, { paletteMode, prism = false, gesture, failSettlement = false }) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    const { red, legal } = await bootToAColor(page, paletteMode, prism);
    await assertNormalIllegalColorControl(page, red, legal);
    const beforeRoot = await persistedRoot(page);
    const before = terminalSnapshot(beforeRoot);
    const beforeMetrics = { ...metrics };
    if (failSettlement) await page.evaluate(() => globalThis.__codexFailNextSettlementWrite());

    await activate(red, page, gesture);
    if (failSettlement) {
      await page.getByText("対戦は終了しましたが、戦績を保存できていません。").waitFor();
      assert.equal(await page.locator("#terminalStats").isHidden(), true);
      assert.equal(await page.locator("#unlockedTrophies").isHidden(), true);
      assert.equal(await page.getByRole("button", { name: "もう一度保存" }).isVisible(), true);
    } else await page.getByText("戦績を保存しました。").waitFor();

    const afterActionRoot = await persistedRoot(page);
    const afterAction = terminalSnapshot(afterActionRoot);
    assert.equal(afterAction.rootRevision, before.rootRevision + (failSettlement ? 1 : 2));
    assert.equal(afterAction.matchVersion, before.matchVersion + 1);
    assert.deepEqual([afterAction.status, afterAction.phase, afterAction.winner, afterAction.terminalReason], ["FINISHED", "GAME_OVER", "B", "ILLEGAL_COLOR"]);
    assert.equal(afterAction.pending, before.pending);
    assert.equal(afterAction.pendingColor, null);
    assert.equal(afterAction.geometrySha256, before.geometrySha256);
    assert.equal(afterAction.cardsSha256, before.cardsSha256);
    assert.equal(afterAction.rngSha256, before.rngSha256);
    assert.deepEqual(afterAction.bonusUsesRemaining, before.bonusUsesRemaining);
    assert.equal(afterAction.actionReceipts, before.actionReceipts + 1);

    if (failSettlement) {
      assert.equal(afterAction.settled, false);
      assert.equal(afterAction.settlementReceipts, before.settlementReceipts);
      assert.equal(afterAction.reservationsSha256, before.reservationsSha256);
      assert.equal(afterAction.statsSha256, before.statsSha256);
      assert.deepEqual(afterAction.historyLengths, before.historyLengths);
      assert.equal(metrics.saveWrites, beforeMetrics.saveWrites + 1);
      assert.equal(metrics.failedWriteAttempts, beforeMetrics.failedWriteAttempts + 1);
      await page.getByRole("button", { name: "もう一度保存" }).click();
      await page.getByText("戦績を保存しました。").waitFor();
    } else {
      assert.equal(afterAction.settled, true);
      assert.equal(afterAction.settlementReceipts, before.settlementReceipts + 1);
    }

    const settledRoot = await persistedRoot(page);
    const settled = terminalSnapshot(settledRoot);
    assert.equal(settled.rootRevision, before.rootRevision + 2);
    assert.equal(settled.matchVersion, before.matchVersion + 1);
    assert.equal(settled.actionReceipts, before.actionReceipts + 1);
    assert.equal(settled.settlementReceipts, before.settlementReceipts + 1);
    assert.equal(settled.settled, true);
    assert.deepEqual(settledRoot.reservations, {});
    assert.equal(settledRoot.profiles.playerA.stats.losses, beforeRoot.profiles.playerA.stats.losses + 1);
    assert.equal(settledRoot.profiles.playerB.stats.wins, beforeRoot.profiles.playerB.stats.wins + 1);
    assert.equal(settledRoot.profiles.playerA.matchHistory.length, beforeRoot.profiles.playerA.matchHistory.length + 1);
    assert.equal(settledRoot.profiles.playerB.matchHistory.length, beforeRoot.profiles.playerB.matchHistory.length + 1);
    assert.equal(metrics.saveWrites, beforeMetrics.saveWrites + 2);
    assert.equal(metrics.generatedIds, beforeMetrics.generatedIds + 1);
    assert.equal(await page.locator("#terminalHeadline").getByText("接色違反！").count(), 1);
    assert.equal(await page.locator("#terminalReason").getByText("Alice が接色禁止に違反しました。").count(), 1);
    assert.equal(await page.getByText("ILLEGAL_COLOR", { exact: true }).count(), 0);
    assert.equal(await page.getByText("GAME OVER").count(), 0);
    assert.equal(await page.locator("#terminalStats .terminal-seat-stats").count(), 2);
    assert.equal(await page.locator("#retrySettlement").isHidden(), true);
    assert.equal(await page.locator("#privatePanel").locator(":scope > *").count(), 0);
    assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);
    assert.equal(await page.locator("#handover").isHidden(), true);
    assert.equal(await page.locator("#eventReveal").isHidden(), true);

    const receiptBeforeReload = JSON.stringify(settledRoot.receipts.matchSettlement);
    const countersBeforeReload = { ...metrics };
    await page.reload({ waitUntil: "load" });
    await page.getByText("戦績を保存しました。").waitFor();
    const reloaded = await persistedRoot(page);
    assert.equal(JSON.stringify(reloaded), JSON.stringify(settledRoot));
    assert.equal(JSON.stringify(reloaded.receipts.matchSettlement), receiptBeforeReload);
    assert.deepEqual(metrics, countersBeforeReload);
  } finally {
    await context.close();
  }
}

test("ILLEGAL_COLOR real-browser terminal, settlement, input-lock, and reload gates", { skip: !chromium || !installedBrowserExecutable() }, async (t) => {
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: installedBrowserExecutable() });
    await t.test("native Space CREATE repeat is stable in 20 fresh contexts", () => assertNativeSpaceCreateStability(browser));
    await t.test("basic color remains normal and reaches durable two-stage terminal state", () => assertIllegalColorLifecycle(browser, {
      paletteMode: "basic", gesture: "pointer", failSettlement: true,
    }));
    await t.test("bonus color remains normal and loses without consuming its use", () => assertIllegalColorLifecycle(browser, {
      paletteMode: "bonus", gesture: "pointer",
    }));
    await t.test("color prism does not bypass adjacency illegality", () => assertIllegalColorLifecycle(browser, {
      paletteMode: "basic", prism: true, gesture: "pointer",
    }));
    await t.test("native Enter repeat resolves and settles once", () => assertIllegalColorLifecycle(browser, {
      paletteMode: "basic", gesture: "Enter",
    }));
    await t.test("native Space repeat resolves and settles once", () => assertIllegalColorLifecycle(browser, {
      paletteMode: "basic", gesture: " ",
    }));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
