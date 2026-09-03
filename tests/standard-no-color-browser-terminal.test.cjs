"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const standardMatch = require("../standard/standard-match.js");
const standardSave = require("../standard/standard-save.js");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  // Explicit browser gate; run with bundled Playwright in NODE_PATH.
}

const root = path.join(__dirname, "..");
const productBundle = fs.readFileSync(path.join(root, "standard-v5", "app.bundle.js"), "utf8");
const sessionNeedle = "const session = createStandardLocalSession({ storageAdapter: localStorage, clock: { now: () => new Date().toISOString() }, idFactory: makeId });";
const instrumentedBundle = productBundle.replace(sessionNeedle, `${sessionNeedle}\n  globalThis.__codexStandardSession = session;`);
const port = 48806;
const baseUrl = `http://127.0.0.1:${port}`;
const saveKey = "fourColorMapGame.standard.v5.save";

assert.notEqual(instrumentedBundle, productBundle, "test harness session hook must be injected only into the served test response");

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
      const requestPath = decodeURIComponent(new URL(request.url, baseUrl).pathname);
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
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function installHarness(context, metrics) {
  await context.route(`**/standard-v5/app.bundle.js`, (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: instrumentedBundle,
  }));
  await context.exposeBinding("__codexSaveWrite", () => { metrics.saveWrites += 1; });
  await context.addInitScript((key) => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function instrumentedSetItem(name, value) {
      const result = originalSetItem.call(this, name, value);
      if (name === key) globalThis.__codexSaveWrite();
      return result;
    };
  }, saveKey);
}

async function newMeasuredPage(browser) {
  const metrics = { saveWrites: 0 };
  const context = await browser.newContext();
  await installHarness(context, metrics);
  const page = await context.newPage();
  return { context, page, metrics };
}

async function persistedPayload(page) {
  const payload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  assert.ok(payload);
  return payload;
}

async function persistedRoot(page) {
  return JSON.parse(await persistedPayload(page));
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

function regionForMacro(id, macro, color) {
  return { id, micro: macroMicroCells(macro), sourceMacros: [macro], controllers: ["B"], color, isPending: false };
}

function geometryHash(state) {
  return sha(Object.values(state.regions).sort((a, b) => a.id.localeCompare(b.id)).map((region) => ({
    id: region.id,
    micro: region.micro,
    sourceMacros: region.sourceMacros,
    controllers: region.controllers,
    color: region.color,
    isPending: region.isPending,
  })));
}

function audit(rootValue) {
  const active = rootValue.activeMatch;
  const state = active.state;
  return {
    rootRevision: rootValue.rootRevision,
    matchVersion: state.version,
    phase: state.phase,
    status: state.status,
    winner: state.winner,
    terminalReason: state.terminalReason,
    geometryHash: geometryHash(state),
    rngHash: sha(active.rngSnapshot),
    cardsHash: sha({ hands: state.hands, inventories: Object.fromEntries(Object.entries(rootValue.profiles).map(([id, profile]) => [id, profile.inventory])) }),
    reservationsHash: sha(rootValue.reservations),
    actionReceipts: Object.keys(rootValue.receipts.matchAction).length,
    settlementReceipts: Object.keys(rootValue.receipts.matchSettlement.byMatchId).length,
    settled: active.settlement.settled,
  };
}

async function disablePresentation(page) {
  await page.getByLabel("🎲 Xマス演出").uncheck();
  await page.getByLabel("初期持ち色演出").uncheck();
}

async function bootToAColor(page) {
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await page.waitForFunction(() => Boolean(globalThis.__codexStandardSession));
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
}

async function installNoLegalColorState(page, { leaveLegalColor = false, keepPrism = false } = {}) {
  const rootValue = await persistedRoot(page);
  const active = rootValue.activeMatch;
  const state = active.state;
  const colors = [...state.basicPalettes.A, state.bonusColors.A];
  assert.equal(new Set(colors).size, 3);
  state.regions.R1.color = colors[0];
  if (!leaveLegalColor) {
    state.regions.R3 = regionForMacro("R3", 25, colors[1]);
    state.regions.R4 = regionForMacro("R4", 27, colors[2]);
  }
  if (!keepPrism) {
    state.hands.A.colorPrism = 0;
    rootValue.profiles.playerA.inventory.colorPrism = 0;
    rootValue.reservations.playerA.colorPrism = 0;
  }
  standardMatch.validateStandardState(state);
  standardSave.validateStandardSave(rootValue);
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: saveKey, payload: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => Boolean(globalThis.__codexStandardSession));
  await page.getByText(/Turn 3・Player A・COLOR/).waitFor();
  return colors;
}

async function sessionDispatch(page, actionId) {
  return page.evaluate((id) => globalThis.__codexStandardSession.dispatchAction({
    actorSeat: "A",
    type: "DECLARE_NO_COLOR",
    payload: {},
    actionId: id,
  }), actionId);
}

test("NO_LEGAL_COLOR browser session transaction gates", { skip: !chromium || !installedBrowserExecutable() }, async (t) => {
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: installedBrowserExecutable() });

    await t.test("correct declaration settles and reloads; wrong declaration is byte-stable", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAColor(page);
        const colors = await installNoLegalColorState(page);
        const beforePayload = await persistedPayload(page);
        const beforeRoot = JSON.parse(beforePayload);
        const before = audit(beforeRoot);
        const writesBefore = metrics.saveWrites;
        assert.equal(beforeRoot.activeMatch.state.hands.A.colorPrism, 0);
        assert.equal(colors.every((color) => Object.values(beforeRoot.activeMatch.state.regions)
          .some((region) => region.id !== beforeRoot.activeMatch.state.pending && region.color === color)), true);

        const action = await sessionDispatch(page, "declare-no-color-correct");
        assert.deepEqual({ ok: action.ok, status: action.status, code: action.code, saved: action.saved, finished: action.finished }, {
          ok: true, status: "RESOLVED", code: "OK", saved: true, finished: true,
        });
        assert.equal(action.projection.stage, "SETTLEMENT_PENDING");
        const actionRoot = await persistedRoot(page);
        const afterAction = audit(actionRoot);
        assert.equal(afterAction.rootRevision, before.rootRevision + 1);
        assert.equal(afterAction.matchVersion, before.matchVersion + 1);
        assert.deepEqual([afterAction.status, afterAction.phase, afterAction.winner, afterAction.terminalReason], ["FINISHED", "GAME_OVER", "B", "NO_LEGAL_COLOR"]);
        assert.equal(afterAction.geometryHash, before.geometryHash);
        assert.equal(afterAction.rngHash, before.rngHash);
        assert.equal(afterAction.cardsHash, before.cardsHash);
        assert.equal(afterAction.reservationsHash, before.reservationsHash);
        assert.equal(afterAction.actionReceipts, before.actionReceipts + 1);
        assert.equal(afterAction.settlementReceipts, before.settlementReceipts);
        assert.equal(afterAction.settled, false);
        assert.equal(metrics.saveWrites, writesBefore + 1);

        const settlement = await page.evaluate(() => globalThis.__codexStandardSession.settle());
        assert.deepEqual({ ok: settlement.ok, status: settlement.status, code: settlement.code, stage: settlement.projection.stage }, {
          ok: true, status: "SETTLED", code: "SETTLED", stage: "RESULT",
        });
        assert.deepEqual([settlement.projection.winnerSeat, settlement.projection.terminalReason], ["B", "NO_LEGAL_COLOR"]);
        const settledRoot = await persistedRoot(page);
        const settled = audit(settledRoot);
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
        assert.equal(metrics.saveWrites, writesBefore + 2);

        const settledPayload = await persistedPayload(page);
        const countersBeforeReload = { ...metrics };
        await page.reload({ waitUntil: "load" });
        await page.locator("#terminalWinner").getByText("Bob の勝利").waitFor();
        assert.equal(await page.locator("#terminalHeadline").getByText("詰み！").count(), 1);
        assert.equal(await page.locator("#terminalReason").getByText("Alice は塗れる色がありません。").count(), 1);
        assert.equal(await page.getByText("NO_LEGAL_COLOR", { exact: true }).count(), 0);
        assert.equal(await persistedPayload(page), settledPayload);
        assert.deepEqual(metrics, countersBeforeReload);

        await bootToAColor(page);
        await installNoLegalColorState(page, { leaveLegalColor: true });
        const wrongBeforePayload = await persistedPayload(page);
        const wrongBefore = audit(JSON.parse(wrongBeforePayload));
        const writesBeforeWrong = metrics.saveWrites;
        const wrong = await sessionDispatch(page, "declare-no-color-wrong");
        assert.deepEqual({ ok: wrong.ok, status: wrong.status, code: wrong.code, saved: wrong.saved }, {
          ok: false, status: "REJECTED", code: "COLOR_AVAILABLE", saved: false,
        });
        assert.equal(await persistedPayload(page), wrongBeforePayload);
        assert.deepEqual(audit(await persistedRoot(page)), wrongBefore);
        assert.equal(metrics.saveWrites, writesBeforeWrong);
      } finally {
        await context.close();
      }
    });

  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
