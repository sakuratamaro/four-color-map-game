"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit browser gate */ }

const root = path.join(__dirname, "..");
const port = 48765;
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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html?standard=1&cosmetic=1`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await page.waitForTimeout(250);
  if (await page.locator("#cosmeticProfile option").count() === 0) throw new Error(`product boot failed: ${pageErrors.join(" | ") || "no pageerror"}`);
  await page.locator("#cosmeticProfile").selectOption("playerA");
  return page;
}

async function activate(page, button, method) {
  if (method === "pointer") await button.evaluate((node) => { node.click(); node.click(); });
  else {
    await button.focus();
    await page.keyboard.down(method);
    await page.keyboard.down(method);
    await page.keyboard.up(method);
  }
}

function auroraButton(page) {
  return page.locator("#cosmeticCatalog .collection-card", { hasText: "オーロラ盤面" }).locator("button");
}

test("cosmetic purchase/equip is capability-neutral and exactly once for Pointer, Enter, Space, retry, and reload", { timeout: 60000 }, async (t) => {
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
      await activate(page, auroraButton(page), method);
      await page.waitForFunction(() => document.querySelector("#cosmeticStatus")?.textContent.includes("内容を確認"));
      assert.match(await page.locator("#cosmeticConfirmationText").textContent(), /600コイン/);
      await activate(page, page.locator("#cosmeticCommit"), method);
      await page.waitForFunction(() => document.querySelector("#cosmeticStatus")?.textContent.includes("一度だけ保存"));
      const savedText = await page.evaluate((key) => localStorage.getItem(key), saveKey);
      const saved = JSON.parse(savedText);
      assert.equal(saved.profiles.playerA.coins, 300);
      assert.equal(saved.profiles.playerA.cosmeticsOwned.includes("boardAurora"), true);
      assert.equal(saved.profiles.playerA.equipped.board, "boardAurora");
      assert.equal(Object.keys(saved.receipts.cosmeticAction).length, 1);
      assert.equal(saved.rootRevision, 1);
      assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("skin-board-aurora")), true);
      const inventoryBefore = JSON.stringify(saved.profiles.playerA.inventory);
      const ticketsBefore = JSON.stringify(saved.profiles.playerA.gachaTickets);
      await page.reload({ waitUntil: "load" });
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), savedText);
      const reloaded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
      assert.equal(JSON.stringify(reloaded.profiles.playerA.inventory), inventoryBefore);
      assert.equal(JSON.stringify(reloaded.profiles.playerA.gachaTickets), ticketsBefore);
      assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("skin-board-aurora")), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1);
      await page.close();
    });
  }

  await t.test("forced first persistence failure retries the same purchase once", async () => {
    const page = await boot(browser, { width: 1365, height: 768 });
    await activate(page, auroraButton(page), "pointer");
    await page.waitForFunction(() => document.querySelector("#cosmeticStatus")?.textContent.includes("内容を確認"));
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      let failNext = true;
      Storage.prototype.setItem = function failFirstCosmeticWrite(name, value) {
        if (name === key && failNext) { failNext = false; throw new DOMException("forced-cosmetic-write-failure", "QuotaExceededError"); }
        return original.call(this, name, value);
      };
    }, saveKey);
    const beforeText = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    await activate(page, page.locator("#cosmeticCommit"), "pointer");
    await page.waitForFunction(() => document.querySelector("#cosmeticStatus")?.textContent.includes("保存できません"));
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforeText);
    assert.equal(await page.locator("#cosmeticRetry").isVisible(), true);
    await activate(page, page.locator("#cosmeticRetry"), "pointer");
    await page.waitForFunction(() => document.querySelector("#cosmeticStatus")?.textContent.includes("一度だけ保存"));
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
    assert.equal(saved.profiles.playerA.coins, 300);
    assert.equal(Object.keys(saved.receipts.cosmeticAction).length, 1);
    assert.equal(saved.rootRevision, 1);
  });
});
