"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit browser gate */ }

const root = path.join(__dirname, "..");
const port = 48764;
const baseUrl = `http://127.0.0.1:${port}`;
const saveKey = "fourColorMapGame.standard.v5.save";

function browserExecutable() {
  return [process.env.PLAYWRIGHT_BROWSER_EXECUTABLE, chromium?.executablePath(), "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "helpers", "static-server.cjs"), String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`static server exited ${code}: ${stderr}`)));
    child.stdout.on("data", (chunk) => { if (String(chunk).includes("STATIC_SERVER")) resolve(child); });
  });
}

async function boot(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html?standard=1&sale=1`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await page.locator("#cardSaleProfile").selectOption("playerA");
  await page.locator("#cardSaleSkill").selectOption("colorPrism");
  await page.locator("#cardSaleQuantity").fill("3");
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

test("card sale requires a quote and remains exactly once for Pointer, Enter, Space, failure retry, and reload", { timeout: 60000 }, async (t) => {
  assert.ok(chromium, "Playwright is required");
  const executablePath = browserExecutable();
  assert.ok(executablePath, "Edge or Chromium is required");
  const server = await startServer();
  t.after(() => server.kill());
  const browser = await chromium.launch({ headless: true, executablePath });
  t.after(() => browser.close());

  for (const [method, viewport] of [["pointer", { width: 390, height: 844 }], ["Enter", { width: 768, height: 1024 }], [" ", { width: 1365, height: 768 }]]) {
    await t.test(method === " " ? "Space" : method, async () => {
      const page = await boot(browser, viewport);
      await activate(page, "#cardSaleQuote", method);
      await page.waitForFunction(() => document.querySelector("#cardSaleStatus")?.textContent.includes("内容を確認"));
      assert.equal(await page.locator("#cardSaleConfirmation").isVisible(), true);
      assert.match(await page.locator("#cardSaleConfirmationText").textContent(), /240コイン/);
      await activate(page, "#cardSaleCommit", method);
      await page.waitForFunction(() => document.querySelector("#cardSaleStatus")?.textContent.includes("一度だけ保存"));
      const savedText = await page.evaluate((key) => localStorage.getItem(key), saveKey);
      const saved = JSON.parse(savedText);
      assert.equal(saved.profiles.playerA.inventory.colorPrism, 1);
      assert.equal(saved.profiles.playerA.coins, 240);
      assert.equal(Object.keys(saved.receipts.cardSale).length, 1);
      assert.equal(saved.rootRevision, 1);
      await page.reload({ waitUntil: "load" });
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), savedText);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1);
      await page.close();
    });
  }

  await t.test("forced first persistence failure retries the same sale once", async () => {
    const page = await boot(browser, { width: 1365, height: 768 });
    await activate(page, "#cardSaleQuote", "pointer");
    await page.waitForFunction(() => document.querySelector("#cardSaleStatus")?.textContent.includes("内容を確認"));
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      let failNext = true;
      Storage.prototype.setItem = function failFirstSaleWrite(name, value) {
        if (name === key && failNext) { failNext = false; throw new DOMException("forced-sale-write-failure", "QuotaExceededError"); }
        return original.call(this, name, value);
      };
    }, saveKey);
    const beforeText = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    await activate(page, "#cardSaleCommit", "pointer");
    await page.waitForFunction(() => document.querySelector("#cardSaleStatus")?.textContent.includes("保存できません"));
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforeText);
    assert.equal(await page.locator("#cardSaleRetry").isVisible(), true);
    await page.locator("#cardSaleRetry").evaluate((node) => { node.click(); node.click(); });
    await page.waitForFunction(() => document.querySelector("#cardSaleStatus")?.textContent.includes("一度だけ保存"));
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
    assert.equal(saved.profiles.playerA.inventory.colorPrism, 1);
    assert.equal(saved.profiles.playerA.coins, 240);
    assert.equal(Object.keys(saved.receipts.cardSale).length, 1);
    assert.equal(saved.rootRevision, 1);
  });
});
