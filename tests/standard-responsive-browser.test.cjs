"use strict";

const assert = require("node:assert/strict");
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
const settleNeedle = "const settled = await session.settle();";
const renderNeedle = "function renderResult(projection) {";
const instrumentedBundle = productBundle
  .replace(settleNeedle, "const settled = await globalThis.__codexResponsiveSettlementAdapter(() => session.settle());")
  .replace(renderNeedle, `${renderNeedle}\n    globalThis.__codexResponsiveMetrics.resultRenders += 1;`);
const saveKey = "fourColorMapGame.standard.v5.save";
let baseUrl = null;

assert.notEqual(instrumentedBundle, productBundle);

function installedBrowserExecutable() {
  return [
    process.env.PLAYWRIGHT_BROWSER_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    chromium?.executablePath(),
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function startServer() {
  return new Promise((resolve, reject) => {
    const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    const server = http.createServer((request, response) => {
      const requestPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
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
    globalThis.__codexResponsiveMetrics = {
      adapterCalls: 0,
      transactionCalls: 0,
      saveWrites: 0,
      failedWrites: 0,
      generatedIds: 0,
      resultRenders: 0,
    };
    let settlementFailures = 0;
    globalThis.__codexResponsiveFailSettlements = (count) => { settlementFailures = count; };
    globalThis.__codexResponsiveSettlementAdapter = async (transaction) => {
      globalThis.__codexResponsiveMetrics.adapterCalls += 1;
      if (globalThis.__codexResponsiveMetrics.adapterCalls > 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
      globalThis.__codexResponsiveMetrics.transactionCalls += 1;
      return transaction();
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function instrumentedSetItem(name, value) {
      if (name === key && settlementFailures > 0) {
        let decoded = null;
        try { decoded = JSON.parse(value); } catch { decoded = null; }
        if (decoded?.activeMatch?.settlement?.settled === true) {
          settlementFailures -= 1;
          globalThis.__codexResponsiveMetrics.failedWrites += 1;
          throw new DOMException("responsive-settlement-failure", "QuotaExceededError");
        }
      }
      const result = originalSetItem.call(this, name, value);
      if (name === key) globalThis.__codexResponsiveMetrics.saveWrites += 1;
      return result;
    };
    const originalRandomUUID = globalThis.crypto.randomUUID.bind(globalThis.crypto);
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value() {
        globalThis.__codexResponsiveMetrics.generatedIds += 1;
        return originalRandomUUID();
      },
    });
  }, { key: saveKey, delayMs: 650 });
}

async function persistedPayload(page) {
  const value = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  assert.ok(value);
  return value;
}

async function persistedRoot(page) {
  return JSON.parse(await persistedPayload(page));
}

async function metrics(page) {
  return page.evaluate(() => ({ ...globalThis.__codexResponsiveMetrics }));
}

async function selectedCells(page) {
  return page.locator("#board .cell").evaluateAll((cells) => cells.flatMap((cell, index) => cell.classList.contains("selected") ? [index] : []));
}

async function clickCellCenter(page, index, useTouch = false) {
  const cell = page.locator("#board .cell").nth(index);
  await cell.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const box = await cell.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0);
  const point = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
  if (useTouch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function assertOverflowAndControls(page, { mobile = false } = {}) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  const layout = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  assert.ok(layout.documentScrollWidth <= layout.documentClientWidth + 1, JSON.stringify(layout));
  assert.ok(layout.bodyScrollWidth <= layout.bodyClientWidth + 1, JSON.stringify(layout));

  const controls = await page.locator("button:not(.cell), select").evaluateAll((nodes) => nodes.flatMap((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return [];
    return [{
      text: node.textContent.trim(),
      id: node.id,
      width: rect.width,
      height: rect.height,
      left: rect.left + scrollX,
      right: rect.right + scrollX,
      top: rect.top + scrollY,
      bottom: rect.bottom + scrollY,
      overlay: Boolean(node.closest(".handover,.event-reveal")),
    }];
  }));
  for (const control of controls) {
    assert.ok(control.width > 0 && control.height > 0, JSON.stringify(control));
    assert.ok(control.left >= -1 && control.right <= layout.documentScrollWidth + 1, JSON.stringify(control));
    if (mobile) assert.ok(control.height >= 43.5, `mobile control below 44px: ${JSON.stringify(control)}`);
  }
  for (let i = 0; i < controls.length; i += 1) {
    for (let j = i + 1; j < controls.length; j += 1) {
      const left = controls[i];
      const right = controls[j];
      if (left.overlay !== right.overlay) continue;
      const overlapWidth = Math.min(left.right, right.right) - Math.max(left.left, right.left);
      const overlapHeight = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
      assert.ok(overlapWidth <= 1 || overlapHeight <= 1, `peer control overlap: ${JSON.stringify({ left, right })}`);
    }
  }
  return { layout, controls };
}

async function assertNoLegalityOracle(page) {
  const body = await page.locator("body").innerText();
  assert.doesNotMatch(body, /隣接色一覧|合法色一覧|安全色|接色注意/);
  const attributes = await page.locator("#privatePanel button.color").evaluateAll((buttons) => buttons.map((button) => ({
    text: button.textContent,
    title: button.getAttribute("title"),
    aria: button.getAttribute("aria-label"),
    data: [...button.attributes].filter((attribute) => attribute.name.startsWith("data-")).map((attribute) => [attribute.name, attribute.value]),
  })));
  for (const value of attributes) assert.doesNotMatch(JSON.stringify(value), /legal|safe|adjacent|隣接|合法|安全|注意/i);
}

async function assertHandoverBlocksBackground(page, points = []) {
  await page.locator("#handover:not([hidden])").waitFor();
  assert.equal(await page.locator("#privatePanel").textContent(), "");
  assert.equal(await page.locator("#privatePanel").locator(":scope > *").count(), 0);
  const cell = page.locator("#board .cell").nth(13);
  await cell.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const cellBox = await cell.boundingBox();
  assert.ok(cellBox);
  const beforePayload = await persistedPayload(page);
  const beforeMetrics = await metrics(page);
  const beforeSelected = await selectedCells(page);
  await page.mouse.click(cellBox.x + (cellBox.width / 2), cellBox.y + (cellBox.height / 2));
  for (const point of points) {
    if (point && point.x >= 0 && point.y >= 0 && point.x < page.viewportSize().width && point.y < page.viewportSize().height) {
      await page.mouse.click(point.x, point.y);
    }
  }
  assert.equal(await persistedPayload(page), beforePayload);
  assert.deepEqual(await metrics(page), beforeMetrics);
  assert.deepEqual(await selectedCells(page), beforeSelected);
  assert.equal(await page.locator("#privatePanel").textContent(), "");
}

async function reveal(page) {
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.locator("#handover").waitFor({ state: "hidden" });
}

async function bootToBWork(page, { touch = false, resizeProbe = false } = {}) {
  await assertOverflowAndControls(page, { mobile: touch });
  await page.getByRole("button", { name: "標準α対戦を開始" }).click();
  await page.getByText(/Turn 1・Player A・CREATE_FIRST/).waitFor();
  await assertHandoverBlocksBackground(page);
  await reveal(page);
  await clickCellCenter(page, 13, touch);
  assert.deepEqual(await selectedCells(page), [13]);
  if (resizeProbe) {
    await page.setViewportSize({ width: 1365, height: 768 });
    await clickCellCenter(page, 14, touch);
    assert.deepEqual(await selectedCells(page), [13, 14]);
    await page.setViewportSize({ width: 390, height: 844 });
  } else {
    await clickCellCenter(page, 14, touch);
  }
  assert.deepEqual(await selectedCells(page), [13, 14]);
  const commit = page.getByRole("button", { name: "選んだエリアを渡す" });
  await commit.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const commitBox = await commit.boundingBox();
  await commit.click();
  await page.getByText(/Turn 2・Player B・COLOR/).waitFor();
  await assertHandoverBlocksBackground(page, commitBox ? [{ x: commitBox.x + commitBox.width / 2, y: commitBox.y + commitBox.height / 2 }] : []);
  await reveal(page);
  await assertNoLegalityOracle(page);
  await page.getByRole("button", { name: "緑", exact: true }).first().click();
  await page.getByText(/Turn 2・Player B・WORK/).waitFor();
  return { commitBox };
}

async function createForOpponentAndColor(page, { touch = false, macro = 26 } = {}) {
  await clickCellCenter(page, macro, touch);
  assert.deepEqual(await selectedCells(page), [macro]);
  const oldPrivate = await page.locator("#privatePanel button").last().boundingBox();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
  await page.locator("#status").getByText(/Player A・COLOR/).waitFor();
  await assertHandoverBlocksBackground(page, oldPrivate ? [{ x: oldPrivate.x + oldPrivate.width / 2, y: oldPrivate.y + oldPrivate.height / 2 }] : []);
  await reveal(page);
  await assertNoLegalityOracle(page);
  await page.getByRole("button", { name: "青", exact: true }).first().click();
  await page.locator("#status").getByText(/Player A・WORK/).waitFor();
}

async function finishWithFailedSettlement(page, { touch = false, verifyInflight = false } = {}) {
  await page.evaluate(() => globalThis.__codexResponsiveFailSettlements(1));
  await page.getByRole("button", { name: "投了" }).click();
  await page.getByText("対戦は終了しましたが、戦績を保存できていません。").waitFor();
  const retry = page.getByRole("button", { name: "もう一度保存" });
  await retry.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await assertOverflowAndControls(page, { mobile: touch });
  const box = await retry.boundingBox();
  assert.ok(box);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const beforeMetrics = await metrics(page);
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  if (verifyInflight) {
    await page.waitForTimeout(375);
    assert.equal(await retry.isDisabled(), true);
    assert.equal(await retry.getAttribute("aria-busy"), "true");
    if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  }
  await page.getByText("戦績を保存しました。").waitFor();
  const afterMetrics = await metrics(page);
  assert.equal(afterMetrics.adapterCalls, beforeMetrics.adapterCalls + 1);
  assert.equal(afterMetrics.transactionCalls, beforeMetrics.transactionCalls + 1);
  assert.equal(afterMetrics.saveWrites, beforeMetrics.saveWrites + 1);
  assert.equal(afterMetrics.generatedIds, beforeMetrics.generatedIds);
  assert.equal(afterMetrics.resultRenders, beforeMetrics.resultRenders + 1);
  const payload = await persistedPayload(page);
  await page.reload({ waitUntil: "load" });
  await page.getByText("戦績を保存しました。").waitFor();
  assert.equal(await persistedPayload(page), payload);
  assert.equal(await page.locator("#privatePanel").locator(":scope > *").count(), 0);
  assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);
  await assertOverflowAndControls(page, { mobile: touch });
}

async function newScenario(browser, options) {
  const context = await browser.newContext(options);
  const requests = [];
  const consoleProblems = [];
  context.on("request", (request) => requests.push(request.url()));
  context.on("page", (page) => page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) consoleProblems.push(`${message.type()}:${message.text()}`);
  }));
  await installHarness(context);
  const page = await context.newPage();
  return { context, page, requests, consoleProblems };
}

function assertLocalRequestsOnly(requests) {
  const allowed = new Set([
    "/tests/fixtures/standard-v5-browser-bootstrap.html",
    "/standard-v5/",
    "/standard-v5/style.css",
    "/standard-v5/terminal-reveal.css",
    "/standard-v5/app.bundle.js",
  ]);
  for (const request of requests) {
    const url = new URL(request);
    assert.equal(url.origin, baseUrl);
    assert.ok(allowed.has(url.pathname), `unexpected browser request: ${request}`);
  }
}

async function run390(browser) {
  const scenario = await newScenario(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const { context, page, requests, consoleProblems } = scenario;
  try {
    await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
    await page.waitForURL(`${baseUrl}/standard-v5/`);
    await page.getByLabel("🎲 Xマス演出").uncheck();
    await page.getByLabel("初期持ち色演出").uncheck();
    await bootToBWork(page, { touch: true, resizeProbe: true });
    await createForOpponentAndColor(page, { touch: true });

    const beforeCancelPayload = await persistedPayload(page);
    const beforeCancelMetrics = await metrics(page);
    await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
    const cancel = page.getByRole("button", { name: "対象選択をキャンセル" });
    await cancel.waitFor();
    await assertOverflowAndControls(page, { mobile: true });
    await cancel.click();
    assert.equal(await cancel.count(), 0);
    assert.equal(await persistedPayload(page), beforeCancelPayload);
    assert.deepEqual(await metrics(page), beforeCancelMetrics);

    await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
    await clickCellCenter(page, 13, true);
    await page.locator("#status").getByText(/Player B・WORK/).waitFor();
    await assertHandoverBlocksBackground(page);
    await reveal(page);
    await finishWithFailedSettlement(page, { touch: true, verifyInflight: true });
    assert.equal(await page.evaluate(() => document.title), "四色地図 標準モード α");
    assert.equal(consoleProblems.length, 0, JSON.stringify(consoleProblems));
    assertLocalRequestsOnly(requests);
  } finally {
    await context.close();
  }
}

async function run768(browser) {
  const scenario = await newScenario(browser, { viewport: { width: 768, height: 1024 } });
  const { context, page, requests, consoleProblems } = scenario;
  try {
    await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
    await page.waitForURL(`${baseUrl}/standard-v5/`);
    await page.getByLabel("🎲 Xマス演出").uncheck();
    await page.getByLabel("初期持ち色演出").uncheck();
    await bootToBWork(page);
    const shiftApply = page.getByRole("button", { name: "半マスシフトを確定" });
    const shiftIndex = page.getByLabel("基準位置");
    const beforeRejectPayload = await persistedPayload(page);
    const beforeRejectMetrics = await metrics(page);
    await shiftIndex.fill("10");
    await shiftApply.click();
    await page.getByText(/EMPTY_SHIFT_BAND/).waitFor();
    assert.equal(await persistedPayload(page), beforeRejectPayload);
    const afterRejectMetrics = await metrics(page);
    assert.equal(afterRejectMetrics.adapterCalls, beforeRejectMetrics.adapterCalls);
    assert.equal(afterRejectMetrics.transactionCalls, beforeRejectMetrics.transactionCalls);
    assert.equal(afterRejectMetrics.saveWrites, beforeRejectMetrics.saveWrites);
    assert.equal(afterRejectMetrics.failedWrites, beforeRejectMetrics.failedWrites);
    assert.equal(afterRejectMetrics.resultRenders, beforeRejectMetrics.resultRenders);
    assert.equal(afterRejectMetrics.generatedIds, beforeRejectMetrics.generatedIds + 1);
    await page.waitForTimeout(325);
    await shiftIndex.fill("1");
    const oldApply = await shiftApply.elementHandle();
    assert.ok(oldApply);
    await shiftApply.click();
    await page.getByText("操作を保存しました。").waitFor();
    const shiftedPayload = await persistedPayload(page);
    const shiftedRoot = JSON.parse(shiftedPayload);
    await oldApply.evaluate((button) => button.click());
    assert.equal(await persistedPayload(page), shiftedPayload);
    await page.reload({ waitUntil: "load" });
    await page.locator("#status").getByText(/Player B・WORK/).waitFor();
    assert.equal(await persistedPayload(page), shiftedPayload);
    assert.deepEqual((await persistedRoot(page)).activeMatch.state.regions, shiftedRoot.activeMatch.state.regions);
    await assertHandoverBlocksBackground(page);
    await reveal(page);
    await createForOpponentAndColor(page, { macro: 26 });
    await finishWithFailedSettlement(page);
    assert.equal(consoleProblems.length, 0, JSON.stringify(consoleProblems));
    assertLocalRequestsOnly(requests);
  } finally {
    await context.close();
  }
}

async function run1365(browser) {
  const scenario = await newScenario(browser, { viewport: { width: 1365, height: 768 } });
  const { context, page, requests, consoleProblems } = scenario;
  try {
    await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html?xss=1`, { waitUntil: "load" });
    await page.waitForURL(`${baseUrl}/standard-v5/`);
    await page.getByLabel("🎲 Xマス演出").uncheck();
    await page.getByLabel("初期持ち色演出").uncheck();
    await bootToBWork(page);
    await assertOverflowAndControls(page);
    const label = page.getByText("色封じ（全4色から選択）");
    await label.waitFor();
    const colorButtons = page.locator("#privatePanel button.skill").filter({ hasText: /^(赤|青|黄|緑)$/ });
    assert.deepEqual(await colorButtons.allTextContents(), ["赤", "青", "黄", "緑"]);
    const oldRed = await page.getByRole("button", { name: "赤", exact: true }).last().elementHandle();
    assert.ok(oldRed);
    await page.getByRole("button", { name: "赤", exact: true }).last().click();
    await page.getByText("操作を保存しました。").waitFor();
    const afterSealPayload = await persistedPayload(page);
    await oldRed.evaluate((button) => button.click());
    assert.equal(await persistedPayload(page), afterSealPayload);
    await createForOpponentAndColor(page, { macro: 26 });
    await finishWithFailedSettlement(page);
    assert.equal(await page.locator("img,svg").count(), 0);
    assert.equal(await page.locator("script").count(), 1);
    assert.match(await page.locator("#resultPanel").textContent(), /<img src=x onerror=document\.title=1>|<svg onload=document\.title=2>/);
    assert.equal(await page.evaluate(() => document.title), "四色地図 標準モード α");
    assert.equal(consoleProblems.length, 0, JSON.stringify(consoleProblems));
    assertLocalRequestsOnly(requests);
  } finally {
    await context.close();
  }
}

test("standard responsive browser paths use the exact three target viewports", { skip: !chromium || !installedBrowserExecutable() }, async (t) => {
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: installedBrowserExecutable() });
    await t.test("390x844 touch path covers resize, legalRecolor cancel/success, and delayed retry", () => run390(browser));
    await t.test("768x1024 covers rejected and accepted areaHalfShift, reload, and continuation", () => run768(browser));
    await t.test("1365x768 covers four-color disruptChoiceOne, XSS, settlement, and reload", () => run1365(browser));
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});
