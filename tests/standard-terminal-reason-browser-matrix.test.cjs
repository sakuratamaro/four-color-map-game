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
const contactNeedle = "function showContactReveal(contactColorCount) {";
const surrenderNeedle = "surrender.onclick = () => dispatch(\"SURRENDER\");";
const instrumentedBundle = productBundle
  .replace(sessionNeedle, `${sessionNeedle}\n  globalThis.__terminalMatrixSession = session;`)
  .replace(dispatchNeedle, "globalThis.__terminalMatrixAction(type); const result = await session.dispatchAction({ actorSeat, type, payload });")
  .replace(settleNeedle, "globalThis.__terminalMatrixSettlement(); const settled = await session.settle();")
  .replace(revealNeedle, `${revealNeedle} globalThis.__terminalMatrixReveal();`)
  .replace(contactNeedle, `${contactNeedle} globalThis.__terminalMatrixContact();`)
  .replace(surrenderNeedle, `globalThis.__terminalMatrixDispatch = dispatch; ${surrenderNeedle}`);

for (const needle of [sessionNeedle, dispatchNeedle, settleNeedle, revealNeedle, contactNeedle, surrenderNeedle]) {
  assert.ok(productBundle.includes(needle), `missing instrumentation needle: ${needle}`);
}
assert.notEqual(instrumentedBundle, productBundle);
assert.equal(productBundle.includes("__terminalMatrix"), false, "terminal matrix hooks must remain test-only");
assert.equal(instrumentedBundle.includes("__terminalMatrix"), true);

function browserExecutable() {
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
  await context.route("**/standard-v5/app.bundle.js", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: instrumentedBundle,
  }));
  await context.addInitScript(({ key }) => {
    const marker = "terminal-matrix-first-document";
    if (!sessionStorage.getItem(marker)) sessionStorage.setItem(marker, localStorage.getItem(key) === null ? "empty" : "not-empty");
    globalThis.__terminalMatrixMetrics = {
      actionCalls: 0,
      actionTypes: [],
      totalSaveWrites: 0,
      terminalWrites: 0,
      settlementWrites: 0,
      settlementCalls: 0,
      revealCalls: 0,
      contactCalls: 0,
      generatedIds: 0,
    };
    globalThis.__terminalMatrixAction = (type) => {
      globalThis.__terminalMatrixMetrics.actionCalls += 1;
      globalThis.__terminalMatrixMetrics.actionTypes.push(type);
    };
    globalThis.__terminalMatrixSettlement = () => { globalThis.__terminalMatrixMetrics.settlementCalls += 1; };
    globalThis.__terminalMatrixReveal = () => { globalThis.__terminalMatrixMetrics.revealCalls += 1; };
    globalThis.__terminalMatrixContact = () => { globalThis.__terminalMatrixMetrics.contactCalls += 1; };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function matrixSetItem(name, value) {
      const result = originalSetItem.call(this, name, value);
      if (name !== key) return result;
      globalThis.__terminalMatrixMetrics.totalSaveWrites += 1;
      try {
        const decoded = JSON.parse(value);
        if (decoded?.activeMatch?.state?.status === "FINISHED") {
          if (decoded.activeMatch.settlement?.settled === true) globalThis.__terminalMatrixMetrics.settlementWrites += 1;
          else globalThis.__terminalMatrixMetrics.terminalWrites += 1;
        }
      } catch { /* invalid writes are rejected elsewhere */ }
      return result;
    };
    const originalRandomUUID = crypto.randomUUID.bind(crypto);
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value() {
        globalThis.__terminalMatrixMetrics.generatedIds += 1;
        return originalRandomUUID();
      },
    });
  }, { key: saveKey });
}

async function metrics(page) {
  return page.evaluate(() => ({ ...globalThis.__terminalMatrixMetrics, actionTypes: [...globalThis.__terminalMatrixMetrics.actionTypes] }));
}

async function persistedPayload(page) {
  const payload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  assert.ok(payload);
  return payload;
}

async function persistedRoot(page) { return JSON.parse(await persistedPayload(page)); }

function receiptCounts(rootValue) {
  return {
    action: Object.keys(rootValue.receipts.matchAction).length,
    settlement: Object.keys(rootValue.receipts.matchSettlement.byMatchId).length,
    historyA: rootValue.profiles.playerA.matchHistory.length,
    historyB: rootValue.profiles.playerB.matchHistory.length,
    winsA: rootValue.profiles.playerA.stats.wins,
    winsB: rootValue.profiles.playerB.stats.wins,
    lossesA: rootValue.profiles.playerA.stats.losses,
    lossesB: rootValue.profiles.playerB.stats.losses,
  };
}

async function boot(page, baseUrl) {
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "commit" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await page.locator("#startMatch").waitFor({ state: "attached" });
  await page.waitForFunction(() => Boolean(globalThis.__terminalMatrixSession && globalThis.__terminalMatrixDispatch));
  assert.equal(await page.evaluate(() => sessionStorage.getItem("terminal-matrix-first-document")), "empty");
  await page.evaluate(() => {
    for (const id of ["sizeRevealEnabled", "paletteRevealEnabled"]) {
      const input = document.getElementById(id);
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.getByRole("button", { name: "標準α対戦を開始" }).click();
  await page.getByText(/Turn 1・Player A・CREATE_FIRST/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
}

async function bootToAColor(page, baseUrl) {
  await boot(page, baseUrl);
  const cells = page.locator('[aria-label="盤面"] button');
  await cells.nth(13).click();
  await cells.nth(14).click();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
  await page.getByText(/Turn 2・Player B・COLOR/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByRole("button", { name: "緑", exact: true }).first().click();
  await page.getByText(/Turn 2・Player B・WORK/).waitFor();
  await cells.nth(26).click();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
  await page.getByText(/Turn 3・Player A・COLOR/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
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

async function installReasonState(page, reason) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  const color = state.basicPalettes.A[0];
  if (reason === "ILLEGAL_COLOR") {
    state.regions.R1.color = color;
  } else if (reason === "BOARD_LOCK") {
    const playable = [];
    const bounds = state.playableBounds;
    for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) playable.push(row * bounds.macroWidth + col);
    }
    const last = playable.pop();
    const adjacentColor = ["red", "blue", "yellow", "green"].find((entry) => entry !== color);
    state.regions = {
      R1: { id: "R1", micro: playable.flatMap(macroMicroCells), sourceMacros: playable, controllers: ["B"], color: adjacentColor, isPending: false },
      R2: { id: "R2", micro: macroMicroCells(last), sourceMacros: [last], controllers: ["B"], color: null, isPending: true },
    };
    state.pending = "R2";
  } else if (reason === "NO_LEGAL_COLOR") {
    const colors = [...state.basicPalettes.A, state.bonusColors.A];
    state.regions.R1.color = colors[0];
    state.regions.R3 = regionForMacro("R3", 25, colors[1]);
    state.regions.R4 = regionForMacro("R4", 27, colors[2]);
    state.hands.A.colorPrism = 0;
    rootValue.profiles.playerA.inventory.colorPrism = 0;
    rootValue.reservations.playerA.colorPrism = 0;
  } else if (reason === "SEALED_OUT") {
    state.publicEffects.A.seals = { red: 1, blue: 1, yellow: 1, green: 1 };
    state.hands.A.colorPrism = 0;
    rootValue.profiles.playerA.inventory.colorPrism = 0;
    rootValue.reservations.playerA.colorPrism = 0;
  }
  standardMatch.validateStandardState(state);
  standardSave.validateStandardSave(rootValue);
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: saveKey, payload: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "commit" });
  await page.waitForFunction(() => Boolean(globalThis.__terminalMatrixSession && globalThis.__terminalMatrixDispatch));
  await page.getByText(/Turn 3・Player A・COLOR/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  return { color };
}

async function addDeclarationControl(page) {
  return page.evaluate(() => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "terminalMatrixDeclare";
    button.textContent = "塗れる色なしを宣言（テスト入力）";
    button.onclick = () => globalThis.__terminalMatrixDispatch("DECLARE_NO_COLOR");
    button.onkeydown = (event) => {
      if (event.repeat && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.querySelector("#privatePanel").appendChild(button);
    return true;
  });
}

async function activate(control, page, gesture) {
  if (gesture === "pointer") {
    await control.click({ clickCount: 2, delay: 0 });
    return;
  }
  await control.focus();
  await page.keyboard.down(gesture);
  await page.keyboard.down(gesture);
  await page.keyboard.up(gesture);
}

async function triggerReason(page, reason, gesture, color) {
  let control;
  if (reason === "SURRENDER") control = page.getByRole("button", { name: "投了" });
  else if (reason === "ILLEGAL_COLOR" || reason === "BOARD_LOCK") {
    const colorName = { red: "赤", blue: "青", yellow: "黄", green: "緑" }[color];
    control = page.getByRole("button", { name: colorName, exact: true }).first();
  } else {
    await addDeclarationControl(page);
    control = page.locator("#terminalMatrixDeclare");
  }
  await activate(control, page, gesture);
}

async function assertPostTerminalInputIsInert(page) {
  const before = await metrics(page);
  await page.locator("#surrender").evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", repeat: true }));
    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " ", repeat: true }));
    button.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " " }));
  });
  await page.waitForTimeout(350);
  assert.deepEqual(await metrics(page), before);
}

const cases = Object.freeze([
  { reason: "ILLEGAL_COLOR", winner: "B", gesture: "pointer", headline: "接色違反！", reasonText: "Alice が接色禁止に違反しました。" },
  { reason: "BOARD_LOCK", winner: "A", gesture: "Enter", headline: "完塗り勝利！", reasonText: "盤面をすべて塗り切りました。" },
  { reason: "SURRENDER", winner: "B", gesture: " ", headline: "Bob の勝利", reasonText: "Alice が投了しました。" },
  { reason: "SEALED_OUT", winner: "B", gesture: "pointer", headline: "色封じによる詰み！", reasonText: "Alice は使える色がありません。" },
  { reason: "NO_LEGAL_COLOR", winner: "B", gesture: "Enter", headline: "詰み！", reasonText: "Alice は塗れる色がありません。" },
]);
const reasonFilter = process.env.STANDARD_TERMINAL_REASON || "";
const selectedCases = reasonFilter ? cases.filter((entry) => entry.reason === reasonFilter) : cases;
if (reasonFilter && selectedCases.length !== 1) throw new Error(`UNKNOWN_STANDARD_TERMINAL_REASON_FILTER:${reasonFilter}`);

test("all five terminal reasons persist, present, settle, lock input, and reload exactly once", { skip: !chromium || !browserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const terminalActionIds = new Set();

  for (const entry of selectedCases) {
    await t.test(`${entry.reason} via ${entry.gesture === " " ? "Space" : entry.gesture}`, async () => {
      const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
      const context = await browser.newContext();
      await installHarness(context);
      const page = await context.newPage();
      try {
        let color = null;
        if (entry.reason === "SURRENDER") await boot(page, baseUrl);
        else {
          await bootToAColor(page, baseUrl);
          ({ color } = await installReasonState(page, entry.reason));
        }
        const beforeRoot = await persistedRoot(page);
        const beforeCounts = receiptCounts(beforeRoot);
        const beforeMetrics = await metrics(page);
        const beforeActionIds = new Set(Object.keys(beforeRoot.receipts.matchAction));

        await triggerReason(page, entry.reason, entry.gesture, color);
        await page.getByText("戦績を保存しました。").waitFor();

        const afterRoot = await persistedRoot(page);
        const afterCounts = receiptCounts(afterRoot);
        const afterMetrics = await metrics(page);
        assert.deepEqual(
          [afterRoot.activeMatch.state.status, afterRoot.activeMatch.state.phase, afterRoot.activeMatch.state.winner, afterRoot.activeMatch.state.terminalReason],
          ["FINISHED", "GAME_OVER", entry.winner, entry.reason],
        );
        assert.equal(afterRoot.activeMatch.settlement.settled, true);
        assert.equal(afterRoot.rootRevision, beforeRoot.rootRevision + 2);
        assert.equal(afterRoot.activeMatch.state.version, beforeRoot.activeMatch.state.version + 1);
        assert.equal(afterCounts.action, beforeCounts.action + 1);
        assert.equal(afterCounts.settlement, beforeCounts.settlement + 1);
        assert.equal(afterCounts.historyA, beforeCounts.historyA + 1);
        assert.equal(afterCounts.historyB, beforeCounts.historyB + 1);
        assert.equal(afterCounts[`wins${entry.winner}`], beforeCounts[`wins${entry.winner}`] + 1);
        const loser = entry.winner === "A" ? "B" : "A";
        assert.equal(afterCounts[`losses${loser}`], beforeCounts[`losses${loser}`] + 1);
        assert.equal(afterMetrics.actionCalls, beforeMetrics.actionCalls + 1);
        assert.deepEqual(afterMetrics.actionTypes.slice(beforeMetrics.actionTypes.length), [entry.reason === "SURRENDER" ? "SURRENDER" : entry.reason === "ILLEGAL_COLOR" || entry.reason === "BOARD_LOCK" ? "COLOR_REGION" : "DECLARE_NO_COLOR"]);
        assert.equal(afterMetrics.totalSaveWrites, beforeMetrics.totalSaveWrites + 2);
        assert.equal(afterMetrics.terminalWrites, beforeMetrics.terminalWrites + 1);
        assert.equal(afterMetrics.settlementWrites, beforeMetrics.settlementWrites + 1);
        assert.equal(afterMetrics.settlementCalls, beforeMetrics.settlementCalls + 1);
        assert.equal(afterMetrics.revealCalls, beforeMetrics.revealCalls + 1);
        assert.equal(afterMetrics.contactCalls, beforeMetrics.contactCalls);
        assert.equal(afterMetrics.generatedIds, beforeMetrics.generatedIds + 1);
        assert.equal(await page.locator("#terminalHeadline").getByText(entry.headline, { exact: true }).count(), 1);
        assert.equal(await page.locator("#terminalReason").getByText(entry.reasonText, { exact: true }).count(), 1);
        assert.equal(await page.getByText(entry.reason, { exact: true }).count(), 0);
        assert.equal(await page.locator("#privatePanel").textContent(), "");
        assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);
        assert.equal(await page.locator("#surrender").isDisabled(), true);
        assert.equal(await page.locator("#handover").isHidden(), true);
        assert.equal(afterRoot.activeMatch.state.terminalReason === "BOARD_LOCK" ? standardMatch.isMapCompleteWin(afterRoot.activeMatch.state) : false, entry.reason === "BOARD_LOCK");

        const newActionIds = Object.keys(afterRoot.receipts.matchAction).filter((id) => !beforeActionIds.has(id));
        assert.equal(newActionIds.length, 1);
        assert.equal(terminalActionIds.has(newActionIds[0]), false, "fresh contexts must not reuse terminal action IDs");
        terminalActionIds.add(newActionIds[0]);

        await assertPostTerminalInputIsInert(page);
        const settledPayload = await persistedPayload(page);
        await page.reload({ waitUntil: "commit" });
        await page.getByText("戦績を保存しました。").waitFor();
        assert.equal(await persistedPayload(page), settledPayload);
        assert.deepEqual(await metrics(page), {
          actionCalls: 0,
          actionTypes: [],
          totalSaveWrites: 0,
          terminalWrites: 0,
          settlementWrites: 0,
          settlementCalls: 0,
          revealCalls: 0,
          contactCalls: 0,
          generatedIds: 0,
        });
        assert.equal(await page.locator(".terminal-reveal,.contact-reveal").count(), 0);
        assert.equal(await page.locator("#privatePanel").textContent(), "");
        assert.equal(await page.locator("#board button:not(:disabled)").count(), 0);
      } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
      }
    });
  }

  assert.equal(terminalActionIds.size, selectedCases.length);
});
