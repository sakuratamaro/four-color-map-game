"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit browser gate */ }

const root = path.join(__dirname, "..");
const port = 48758;
const baseUrl = `http://127.0.0.1:${port}`;
const saveKey = "fourColorMapGame.standard.v5.save";
const loadout = Object.freeze({
  color: Object.freeze(["colorPrism", "colorChoiceBorrow"]),
  area: Object.freeze(["areaHalfShift", "areaResize"]),
  disrupt: Object.freeze(["disruptChoiceOne", "disruptRandomOne"]),
});

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

async function installMetrics(context, metrics) {
  await context.exposeBinding("__codexLoadoutWrite", () => { metrics.saveWrites += 1; });
  await context.exposeBinding("__codexLoadoutFailedWrite", () => { metrics.failedWrites += 1; });
  await context.exposeBinding("__codexLoadoutId", () => { metrics.generatedIds += 1; });
  await context.addInitScript((key) => {
    const NativeDate = Date;
    let nowOffsetMs = 0;
    class ControlledDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [NativeDate.now() + nowOffsetMs])); }
      static now() { return NativeDate.now() + nowOffsetMs; }
    }
    Object.defineProperty(globalThis, "Date", { configurable: true, value: ControlledDate });
    globalThis.__codexAdvanceLoadoutTime = (milliseconds) => { nowOffsetMs += milliseconds; };
    const originalSetItem = Storage.prototype.setItem;
    let failNext = false;
    globalThis.__codexFailNextLoadoutWrite = () => { failNext = true; };
    Storage.prototype.setItem = function instrumentedSetItem(name, value) {
      if (name === key && failNext) {
        failNext = false;
        globalThis.__codexLoadoutFailedWrite();
        throw new DOMException("forced-loadout-write-failure", "QuotaExceededError");
      }
      const result = originalSetItem.call(this, name, value);
      if (name === key) globalThis.__codexLoadoutWrite();
      return result;
    };
    const originalRandomUUID = globalThis.crypto.randomUUID.bind(globalThis.crypto);
    Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value() { globalThis.__codexLoadoutId(); return originalRandomUUID(); } });
  }, saveKey);
}

async function chooseLoadouts(page) {
  for (const seat of ["A", "B"]) for (const [category, skillIds] of Object.entries(loadout)) for (const skillId of skillIds) {
    await page.locator(`#loadout${seat} input[data-category="${category}"][data-skill="${skillId}"]`).check();
  }
}

async function activateStart(page, method) {
  const button = page.locator("#startMatch");
  if (method === "pointer") await button.evaluate((node) => { node.click(); node.click(); });
  else {
    await button.focus();
    await page.keyboard.down(method);
    await page.keyboard.down(method);
    await page.keyboard.up(method);
  }
}

async function prepare(page) {
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html?standard=1`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await page.locator("#ruleSet").selectOption("STANDARD_V5");
  await assert.doesNotReject(() => page.locator("#loadoutBuilder").waitFor({ state: "visible" }));
  assert.equal(await page.locator("#startMatch").isDisabled(), true);
}

test("formal Standard loadout UI is stale-safe and starts exactly once for pointer, Enter, and Space", { timeout: 120000 }, async (t) => {
  assert.ok(chromium, "Playwright is required");
  const executablePath = browserExecutable();
  assert.ok(executablePath, "Edge or Chromium is required");
  const server = await startServer();
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const method of ["pointer", "Enter", " "]) await t.test(method === " " ? "Space" : method, async () => {
      const metrics = { saveWrites: 0, failedWrites: 0, generatedIds: 0 };
      const context = await browser.newContext();
      await installMetrics(context, metrics);
      const page = await context.newPage();
      try {
        await prepare(page);
        await page.locator('#loadoutA input[data-skill="colorPrism"]').check();
        await page.locator("#profileA").selectOption("playerB");
        await page.locator("#profileA").selectOption("playerA");
        assert.equal(await page.locator("#loadoutA input:checked").count(), 0);
        await page.locator("#ruleSet").selectOption("STANDARD_V5_ALPHA_SLICE");
        await page.locator("#ruleSet").selectOption("STANDARD_V5");
        assert.equal(await page.locator("#loadoutA input:checked, #loadoutB input:checked").count(), 0);
        await chooseLoadouts(page);
        assert.equal(await page.locator("#startMatch").isEnabled(), true);
        const before = { ...metrics };
        if (method === "pointer") await page.evaluate(() => globalThis.__codexFailNextLoadoutWrite());
        await activateStart(page, method);
        if (method === "pointer") {
          await page.waitForTimeout(100);
          assert.match(await page.locator("#notice").textContent(), /開始を保存できません（PERSISTENCE_FAILED）/, JSON.stringify(metrics));
          assert.deepEqual(metrics, { saveWrites: before.saveWrites, failedWrites: before.failedWrites + 1, generatedIds: before.generatedIds + 4 });
          assert.equal(await page.locator("#loadoutA input:checked, #loadoutB input:checked").count(), 12);
          await page.waitForTimeout(250);
          await activateStart(page, method);
        }
        await page.getByText("端末を渡してください").waitFor();
        assert.equal(metrics.generatedIds, before.generatedIds + 4);
        assert.equal(metrics.saveWrites, before.saveWrites + 1);
        const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
        assert.equal(persisted.activeMatch.ruleSetId, "STANDARD_V5");
        assert.equal(Object.keys(persisted.receipts.matchStart.byMatchId).length, 1);
        for (const seat of ["A", "B"]) {
          assert.deepEqual(Object.keys(persisted.activeMatch.state.hands[seat]).sort(), Object.values(loadout).flat().sort());
          assert.equal(Object.hasOwn(persisted.activeMatch.state.hands[seat], "legalRecolor"), false);
          assert.equal(Object.keys(persisted.reservations[`player${seat}`]).length, 6);
        }
        assert.equal(await page.locator("#privatePanel *").count(), 0);
        const beforeReload = JSON.stringify(persisted);
        await page.reload({ waitUntil: "load" });
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforeReload);
        await page.getByText("端末を渡してください").waitFor();
      } finally {
        await context.close();
      }
    });
    await t.test("expired quotes are write-free and the next activation requotes the unchanged selection", async () => {
      const metrics = { saveWrites: 0, failedWrites: 0, generatedIds: 0 };
      const context = await browser.newContext();
      await installMetrics(context, metrics);
      const page = await context.newPage();
      try {
        await prepare(page);
        await chooseLoadouts(page);
        const before = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextLoadoutWrite());
        await activateStart(page, "pointer");
        await page.waitForTimeout(350);
        assert.match(await page.locator("#notice").textContent(), /PERSISTENCE_FAILED/);
        const quoted = { ...metrics };
        assert.deepEqual(quoted, { saveWrites: before.saveWrites, failedWrites: before.failedWrites + 1, generatedIds: before.generatedIds + 4 });
        await page.evaluate(() => globalThis.__codexAdvanceLoadoutTime(300_001));
        await activateStart(page, "pointer");
        await page.waitForTimeout(350);
        assert.match(await page.locator("#notice").textContent(), /QUOTE_EXPIRED/);
        assert.deepEqual(metrics, quoted);
        assert.equal(await page.locator("#loadoutA input:checked, #loadoutB input:checked").count(), 12);
        await activateStart(page, "pointer");
        await page.getByText("端末を渡してください").waitFor();
        assert.equal(metrics.generatedIds, quoted.generatedIds + 2);
        assert.equal(metrics.saveWrites, quoted.saveWrites + 1);
        assert.equal(metrics.failedWrites, quoted.failedWrites);
      } finally {
        await context.close();
      }
    });
  } finally {
    await browser.close();
    server.kill();
  }
});
