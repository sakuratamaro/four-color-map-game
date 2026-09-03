"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit browser gate */ }

const root = path.join(__dirname, "..");
const port = 48760;
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

function width(page) {
  return page.locator("#quizTimeBar").evaluate((node) => Number.parseFloat(node.style.width));
}

test("formal Number Rush starts in Edge, hides answer metadata, and freezes the timer for the complete hint interval", { timeout: 30000 }, async (t) => {
  assert.ok(chromium, "Playwright is required");
  const executablePath = browserExecutable();
  assert.ok(executablePath, "Edge or Chromium is required");
  const server = await startServer();
  t.after(() => server.kill());
  const browser = await chromium.launch({ headless: true, executablePath });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html?standard=1`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  const savedBefore = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  await page.locator("#quizLevel").selectOption("4");
  await page.locator("#startQuiz").click();
  const options = page.locator("#quizOptions button");
  assert.equal(await options.count(), 6);
  for (let index = 0; index < 6; index += 1) assert.deepEqual(await options.nth(index).evaluate((node) => [...node.attributes].map(({ name }) => name).sort()), ["type"]);

  await page.locator("#quizHint").click();
  const frozen = await width(page);
  await page.waitForTimeout(1000);
  assert.ok(Math.abs(await width(page) - frozen) < 0.01);
  assert.equal(await options.first().isDisabled(), true);
  assert.equal(await page.locator("#quizHintText").isVisible(), true);
  await page.waitForTimeout(2200);
  assert.equal(await page.locator("#quizHintText").isHidden(), true);
  const resumed = await width(page);
  await page.waitForTimeout(400);
  assert.ok(await width(page) < resumed);

  await options.first().evaluate((node) => { node.click(); node.click(); });
  await page.locator("#quizNext").waitFor({ state: "visible" });
  assert.match(await page.locator("#quizStatus").textContent(), /正解|不正解/);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), savedBefore);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `horizontal overflow ${overflow}`);
});

test("completed Number Rush persists exactly one receipt and the awarded ticket count in Edge", { timeout: 30000 }, async (t) => {
  assert.ok(chromium, "Playwright is required");
  const executablePath = browserExecutable();
  assert.ok(executablePath, "Edge or Chromium is required");
  const rewardPort = 48761;
  const rewardBaseUrl = `http://127.0.0.1:${rewardPort}`;
  const server = await startServer(rewardPort);
  t.after(() => server.kill());
  const browser = await chromium.launch({ headless: true, executablePath });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await page.goto(`${rewardBaseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html?standard=1`, { waitUntil: "load" });
  await page.waitForURL(`${rewardBaseUrl}/standard-v5/`);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    let failNext = true;
    Storage.prototype.setItem = function failFirstQuizSettlement(name, value) {
      if (name === key && failNext) { failNext = false; throw new DOMException("forced-quiz-write-failure", "QuotaExceededError"); }
      return original.call(this, name, value);
    };
  }, saveKey);
  await page.locator("#quizLevel").selectOption("4");
  await page.locator("#startQuiz").click();
  for (let guard = 0; guard < 10 && await page.locator("#quizResult").isHidden(); guard += 1) {
    const previousCounter = await page.locator("#quizCounter").textContent();
    await page.locator("#quizOptions button").first().click();
    await page.locator("#quizNext").waitFor({ state: "visible" });
    await page.locator("#quizNext").click();
    await page.waitForFunction((previous) => {
      const result = document.querySelector("#quizResult");
      return !result?.hidden || document.querySelector("#quizCounter")?.textContent !== previous;
    }, previousCounter);
  }
  await page.locator("#quizResult").waitFor({ state: "visible" });
  assert.match(await page.locator("#quizStatus").textContent(), /報酬を保存できません/);
  assert.equal(await page.locator("#quizSaveReward").isVisible(), true);
  const beforeRetry = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
  assert.equal(Object.keys(beforeRetry.receipts.quizSettlement).length, 0);
  await page.locator("#quizSaveReward").evaluate((node) => { node.click(); node.click(); });
  await page.waitForFunction(() => document.querySelector("#quizStatus")?.textContent.includes("報酬を保存しました"));
  assert.equal(await page.locator("#quizSaveReward").isHidden(), true);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
  const receipts = Object.values(saved.receipts.quizSettlement);
  assert.equal(receipts.length, 1);
  const receipt = receipts[0];
  assert.equal(saved.profiles.playerA.gachaTickets[String(receipt.ticketLevel)], receipt.ticketCount);
  assert.equal(saved.profiles.playerA.quizRecords[String(receipt.selectedLevel)].attempts, 1);
  assert.equal(saved.rootRevision, 1);
});
