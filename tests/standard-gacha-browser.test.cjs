"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit browser gate */ }

const root = path.join(__dirname, "..");
const port = 48762;
const baseUrl = `http://127.0.0.1:${port}`;
const saveKey = "fourColorMapGame.standard.v5.save";

function browserExecutable() {
  return [process.env.PLAYWRIGHT_BROWSER_EXECUTABLE, chromium?.executablePath(), "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function startServer(serverPort = port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "helpers", "static-server.cjs"), String(serverPort)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`static server exited ${code}: ${stderr}`)));
    child.stdout.on("data", (chunk) => { if (String(chunk).includes("STATIC_SERVER")) resolve(child); });
  });
}

async function boot(browser, viewport = { width: 768, height: 1024 }, targetBaseUrl = baseUrl) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${targetBaseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html?standard=1&gacha=1`, { waitUntil: "load" });
  await page.waitForURL(`${targetBaseUrl}/standard-v5/`);
  await page.locator("#gachaLevel").selectOption("4");
  return page;
}

async function activate(page, selector, method) {
  const button = page.locator(selector);
  if (method === "pointer") await button.evaluate((node) => { node.click(); node.click(); });
  else {
    await button.focus();
    await page.keyboard.down(method);
    await page.keyboard.down(method);
    await page.keyboard.up(method);
  }
}

test("gacha Pointer, Enter, and Space repetition consume and award exactly once, then reload without replay", { timeout: 60000 }, async (t) => {
  assert.ok(chromium, "Playwright is required");
  const executablePath = browserExecutable();
  assert.ok(executablePath, "Edge or Chromium is required");
  const server = await startServer();
  t.after(() => server.kill());
  const browser = await chromium.launch({ headless: true, executablePath });
  t.after(() => browser.close());
  for (const method of ["pointer", "Enter", " "]) await t.test(method === " " ? "Space" : method, async () => {
    const page = await boot(browser, method === "pointer" ? { width: 390, height: 844 } : { width: 768, height: 1024 });
    const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
    await activate(page, "#gachaDrawOne", method);
    await page.waitForFunction(() => document.querySelector("#gachaStatus")?.textContent.includes("1枚を獲得"));
    const savedText = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    const saved = JSON.parse(savedText);
    assert.equal(saved.profiles.playerA.gachaTickets[4], 2);
    assert.equal(Object.keys(saved.receipts.gachaDraw).length, 1);
    assert.equal(Object.values(saved.profiles.playerA.inventory).reduce((sum, count) => sum + count, 0), Object.values(before.profiles.playerA.inventory).reduce((sum, count) => sum + count, 0) + 1);
    assert.equal(saved.rootRevision, 1);
    assert.equal(await page.locator("#gachaResults .gacha-card").count(), 1);
    await page.reload({ waitUntil: "load" });
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), savedText);
    assert.equal(await page.locator("#gachaResults .gacha-card").count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1);
    await page.close();
  });
});

test("failed all-ticket draw is byte-stable and double-click retry persists one ordered draw list", { timeout: 30000 }, async (t) => {
  assert.ok(chromium, "Playwright is required");
  const executablePath = browserExecutable();
  assert.ok(executablePath, "Edge or Chromium is required");
  const retryPort = 48763;
  const retryBaseUrl = `http://127.0.0.1:${retryPort}`;
  const server = await startServer(retryPort);
  t.after(() => server.kill());
  const browser = await chromium.launch({ headless: true, executablePath });
  t.after(() => browser.close());
  const page = await boot(browser, { width: 1365, height: 768 }, retryBaseUrl);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    let failNext = true;
    Storage.prototype.setItem = function failFirstGachaWrite(name, value) {
      if (name === key && failNext) { failNext = false; throw new DOMException("forced-gacha-write-failure", "QuotaExceededError"); }
      return original.call(this, name, value);
    };
  }, saveKey);
  const beforeText = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  await activate(page, "#gachaDrawAll", "pointer");
  await page.waitForFunction(() => document.querySelector("#gachaStatus")?.textContent.includes("保存できません"));
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforeText);
  assert.equal(await page.locator("#gachaRetry").isVisible(), true);
  await page.locator("#gachaRetry").evaluate((node) => { node.click(); node.click(); });
  await page.waitForFunction(() => document.querySelector("#gachaStatus")?.textContent.includes("3枚を獲得"));
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
  assert.equal(saved.profiles.playerA.gachaTickets[4], 0);
  assert.equal(Object.keys(saved.receipts.gachaDraw).length, 1);
  assert.equal(Object.values(saved.receipts.gachaDraw)[0].draws.length, 3);
  assert.equal(await page.locator("#gachaResults .gacha-card").count(), 3);
  assert.equal(saved.rootRevision, 1);
});
