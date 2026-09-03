"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");
const standardEngine = require("../standard/standard-engine.js");
const standardMatch = require("../standard/standard-match.js");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  // This is an explicit browser gate. Run it with the bundled Playwright directory in NODE_PATH.
}

const root = path.join(__dirname, "..");
const serverScript = path.join(__dirname, "helpers", "static-server.cjs");
const port = 48753;
const baseUrl = `http://127.0.0.1:${port}`;
const saveKey = "fourColorMapGame.standard.v5.save";
const colorNames = Object.freeze({ red: "赤", blue: "青", yellow: "黄", green: "緑" });
const secretSignatures = ["curseBacklash", "temporaryColors", "basicPalette", "bonusColor", "bonusUsesRemaining", "privateEffects", "hands"];

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
    let failNextStandardWrite = false;
    globalThis.__codexFailNextStandardWrite = () => { failNextStandardWrite = true; };
    Storage.prototype.setItem = function instrumentedSetItem(name, value) {
      if (name === key && failNextStandardWrite) {
        failNextStandardWrite = false;
        globalThis.__codexFailedWriteAttempt();
        throw new DOMException("forced-standard-write-failure", "QuotaExceededError");
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

async function persistedSnapshot(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  assert.ok(raw, "standard save must exist");
  const rootValue = JSON.parse(raw);
  const active = rootValue.activeMatch;
  assert.ok(active, "active match must exist");
  const state = active.state;
  const profileCards = Object.fromEntries(Object.entries(active.participants).map(([seat, participant]) => [
    seat,
    participant.type === "PROFILE" ? rootValue.profiles[participant.profileId].inventory : null,
  ]));
  return {
    payloadSha256: sha(raw),
    canonicalRootSha256: sha(rootValue),
    authoritativeMatchSha256: sha(state),
    rngSnapshotSha256: sha(active.rngSnapshot),
    rootRevision: rootValue.rootRevision,
    matchVersion: state.version,
    actionReceipts: Object.keys(rootValue.receipts.matchAction).length,
    consumptionReceipts: Object.keys(rootValue.receipts.matchConsumption).length,
    cardsSha256: sha({ hands: state.hands, inventory: profileCards, reservations: rootValue.reservations }),
    active: state.active,
    phase: state.phase,
    requiredSize: state.requiredSize,
  };
}

async function persistedRoot(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  assert.ok(raw, "standard save must exist");
  return JSON.parse(raw);
}

function geometrySnapshot(state) {
  const regions = Object.values(state.regions).sort((left, right) => left.id.localeCompare(right.id)).map((region) => ({
    id: region.id,
    micro: [...region.micro].sort((left, right) => left - right),
    sourceMacros: [...region.sourceMacros].sort((left, right) => left - right),
    controllers: [...region.controllers].sort(),
    isPending: region.isPending,
    deleted: region.deleted,
    delayed: region.delayed,
    delayState: region.delayState,
  }));
  const owners = regions.flatMap((region) => region.micro.map((micro) => [micro, region.id])).sort((left, right) => left[0] - right[0]);
  return { regions, owners, pending: state.pending };
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
  return { id, micro: macroMicroCells(macro), sourceMacros: [macro], controllers: ["A"], color, isPending: false };
}

async function installCandidateZeroState(page) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  assert.deepEqual(Object.keys(state.regions), ["R1"]);
  state.regions = {
    R1: state.regions.R1,
    R2: regionForMacro("R2", 25, "blue"),
    R3: regionForMacro("R3", 26, "yellow"),
    R4: regionForMacro("R4", 15, "green"),
    R5: regionForMacro("R5", 37, "red"),
  };
  state.pending = null;
  assert.deepEqual(standardEngine.legalRecolorCandidates(state, "R1"), []);
  assert.ok(standardEngine.legalRecolorCandidates(state, "R5").length > 0);
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Turn 2・Player A・WORK/).waitFor();
}

async function publicCellSignature(page, macro) {
  return page.locator('[aria-label="盤面"] button').nth(macro).evaluate((cell) => ({
    disabled: cell.disabled,
    className: cell.className,
    style: cell.getAttribute("style"),
    textContent: cell.textContent,
    ariaLabel: cell.getAttribute("aria-label"),
    ariaDisabled: cell.getAttribute("aria-disabled"),
    title: cell.getAttribute("title"),
    dataset: { ...cell.dataset },
    tabIndex: cell.tabIndex,
    cursor: getComputedStyle(cell).cursor,
    outline: getComputedStyle(cell).outline,
  }));
}

async function assertHandoverIsPrivate(page) {
  await assert.doesNotReject(() => page.getByText("端末を渡してください").waitFor());
  assert.equal(await page.locator("#privatePanel").textContent(), "");
  assert.equal(await page.locator("#privatePanel *").count(), 0);
  const body = await page.locator("body").textContent();
  for (const signature of secretSignatures) assert.equal(body.includes(signature), false, `${signature} leaked into body`);
  assert.equal(await page.locator("[data-secret],[data-private],[data-hand],[data-palette],[data-bonus-color],[data-curse]").count(), 0);
}

async function assertReloadStable(page, metrics, label) {
  const before = await persistedSnapshot(page);
  const beforeCounters = { ...metrics };
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  const after = await persistedSnapshot(page);
  assert.deepEqual(after, before, `${label}: normal URL reload changed authoritative storage`);
  assert.deepEqual(metrics, beforeCounters, `${label}: reload generated an ID or storage write`);
  return after;
}

async function disablePresentation(page) {
  await page.getByLabel("🎲 Xマス演出").uncheck();
  await page.getByLabel("初期持ち色演出").uncheck();
}

async function bootToBWork(page) {
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
  await page.getByRole("button", { name: "緑", exact: true }).first().waitFor();
  await page.getByRole("button", { name: "緑", exact: true }).first().click();
  await page.getByText(/Turn 2・Player B・WORK/).waitFor();
}

async function bootToAWork(page) {
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await disablePresentation(page);
  await page.locator("#firstPlayer").selectOption("B");
  await page.getByRole("button", { name: "標準α対戦を開始" }).click();
  await page.getByText(/Turn 1・Player B・CREATE_FIRST/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  const cells = page.locator('[aria-label="盤面"] button');
  await cells.nth(13).click();
  await cells.nth(14).click();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
  await page.getByText(/Turn 2・Player A・COLOR/).waitFor();
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByRole("button", { name: "赤", exact: true }).first().click();
  await page.getByText(/Turn 2・Player A・WORK/).waitFor();
}

async function newMeasuredPage(browser) {
  const metrics = { saveWrites: 0, failedWriteAttempts: 0, generatedIds: 0 };
  const context = await browser.newContext();
  await installMetrics(context, metrics);
  const page = await context.newPage();
  return { context, page, metrics };
}

async function assertKeyboardUse(browser, key) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToBWork(page);
    const before = await persistedSnapshot(page);
    const beforeCounters = { ...metrics };
    const red = page.getByRole("button", { name: "赤", exact: true }).nth(1);
    await red.focus();
    await page.keyboard.down(key);
    await page.keyboard.down(key);
    await page.keyboard.up(key);
    await page.waitForFunction((keyName) => {
      const rootValue = JSON.parse(localStorage.getItem(keyName));
      return rootValue.rootRevision === 4;
    }, saveKey);
    const after = await persistedSnapshot(page);
    const raw = await page.evaluate((keyName) => JSON.parse(localStorage.getItem(keyName)), saveKey);
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${key}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${key}: storage writes`);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(after.rngSnapshotSha256, before.rngSnapshotSha256, `${key}: skill use consumed RNG`);
    assert.equal(raw.activeMatch.state.hands.B.disruptChoiceOne, 0);
    assert.equal(raw.profiles.playerB.inventory.disruptChoiceOne, 0);
    assert.equal(raw.reservations.playerB.disruptChoiceOne, 0);
    assert.equal(raw.activeMatch.state.publicEffects.A.seals.red, 1);
    assert.equal(raw.activeMatch.state.privateEffects.B.curseBacklash, 1);
    assert.equal(after.active, "B");
    assert.equal(after.phase, "WORK");
  } finally {
    await context.close();
  }
}

async function assertLegalRecolorKeyboardUse(browser, key) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };
    const beforeColor = beforeRoot.activeMatch.state.regions.R1.color;
    const beforeEffectRng = beforeRoot.activeMatch.rngSnapshot["skill-effect"];
    await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
    const target = page.locator('[aria-label="盤面"] button').nth(13);
    await target.focus();
    await page.keyboard.down(key);
    await page.keyboard.down(key);
    await page.keyboard.up(key);
    await assertHandoverIsPrivate(page);
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${key}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${key}: storage writes`);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(afterRoot.activeMatch.rngSnapshot["skill-effect"], (beforeEffectRng + 0x6d2b79f5) >>> 0);
    for (const [name, value] of Object.entries(beforeRoot.activeMatch.rngSnapshot)) {
      if (name !== "skill-effect") assert.equal(afterRoot.activeMatch.rngSnapshot[name], value, `${key}: ${name} moved`);
    }
    assert.equal(afterRoot.activeMatch.state.hands.A.legalRecolor, 0);
    assert.notEqual(afterRoot.activeMatch.state.regions.R1.color, beforeColor);
    assert.deepEqual([after.active, after.phase], ["B", "WORK"]);
    assert.equal(await page.locator("#handover").getAttribute("hidden"), null);
    assert.equal(await page.locator("#privatePanel *").count(), 0);
  } finally {
    await context.close();
  }
}

async function installBorrowColorState(page, skillId) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "B";
  state.phase = "COLOR";
  state.turn += 1;
  state.regions.R2 = {
    ...regionForMacro("R2", 26, null),
    controllers: ["A"],
    isPending: true,
  };
  state.pending = "R2";
  state.hands.B[skillId] = 1;
  rootValue.activeMatch.cardSources.B[skillId] = "INVENTORY_BACKED";
  rootValue.profiles.playerB.inventory[skillId] = 1;
  rootValue.reservations.playerB[skillId] = 1;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player B の情報/).waitFor();
}

async function installSplitState(page) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "A";
  state.phase = "COLOR";
  state.turn += 1;
  state.regions.R2 = {
    id: "R2",
    micro: [26, 27, 28].flatMap(macroMicroCells),
    sourceMacros: [26, 27, 28],
    controllers: ["B"],
    color: null,
    isPending: true,
  };
  state.pending = "R2";
  state.reserved = null;
  state.hands.A.colorRegionSplit = 1;
  rootValue.activeMatch.cardSources.A.colorRegionSplit = "INVENTORY_BACKED";
  rootValue.profiles.playerA.inventory.colorRegionSplit = 1;
  rootValue.reservations.playerA.colorRegionSplit = 1;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player A の情報/).waitFor();
}

async function installMicroBloomState(page) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "A";
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.preparedOutgoing = null;
  state.hands.A.areaMicroBloom = 1;
  rootValue.activeMatch.cardSources.A.areaMicroBloom = "INVENTORY_BACKED";
  rootValue.profiles.playerA.inventory.areaMicroBloom = 1;
  rootValue.reservations.playerA.areaMicroBloom = 1;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player A の情報/).waitFor();
}

async function assertMicroBloomUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installMicroBloomState(page);
    const cells = page.locator('[aria-label="盤面"] button');
    await cells.nth(27).click();
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };
    const control = page.getByRole("button", { name: "ひとふくらみ", exact: true });
    if (gesture === "pointer") {
      await control.evaluate((button) => { button.click(); button.click(); });
    } else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
      key: saveKey, revision: before.rootRevision,
    });
    const prepared = await persistedSnapshot(page);
    const preparedRoot = await persistedRoot(page);
    const preparedState = preparedRoot.activeMatch.state;
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${gesture}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${gesture}: storage writes`);
    assert.equal(prepared.rootRevision, before.rootRevision + 1);
    assert.equal(prepared.matchVersion, before.matchVersion + 1);
    assert.equal(prepared.actionReceipts, before.actionReceipts + 1);
    assert.equal(prepared.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(preparedRoot.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 0x6d2b79f5) >>> 0);
    for (const [name, value] of Object.entries(beforeRoot.activeMatch.rngSnapshot)) {
      if (name !== "skill-effect") assert.equal(preparedRoot.activeMatch.rngSnapshot[name], value, `${gesture}: ${name} moved`);
    }
    assert.equal(preparedState.hands.A.areaMicroBloom, 0);
    assert.equal(preparedRoot.profiles.playerA.inventory.areaMicroBloom, 0);
    assert.equal(preparedRoot.reservations.playerA.areaMicroBloom, 0);
    assert.deepEqual(preparedState.preparedOutgoing.sourceMacros, [27]);
    assert.equal(preparedState.preparedOutgoing.micro.length, 19);
    assert.deepEqual([prepared.active, prepared.phase], ["A", "WORK"]);
    assert.equal(await cells.nth(27).isDisabled(), true);
    assert.equal(await cells.nth(27).evaluate((cell) => cell.classList.contains("selected")), true);

    await assertReloadStable(page, metrics, `${gesture}: prepared micro bloom`);
    await page.getByRole("button", { name: "自分の情報を表示" }).click();
    assert.equal(await page.getByRole("button", { name: "ひとふくらみ", exact: true }).count(), 0);
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.getByRole("heading", { name: "Player B・COLOR", exact: true }).waitFor();
    const committedRoot = await persistedRoot(page);
    const committed = committedRoot.activeMatch.state;
    assert.equal(committed.preparedOutgoing, null);
    assert.deepEqual([committed.active, committed.phase, committed.pending], ["B", "COLOR", "R2"]);
    assert.equal(committed.regions.R1.micro.length, 31);
    assert.equal(committed.regions.R2.micro.length, 19);
    const occupied = Object.values(committed.regions).flatMap((region) => region.micro);
    assert.equal(new Set(occupied).size, occupied.length);
  } finally {
    await context.close();
  }
}

async function installDiePlusState(page, requiredSize = 1) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "A";
  state.phase = "WORK";
  state.requiredSize = requiredSize;
  state.rolledSize = Math.min(requiredSize, 4);
  state.baseRequiredSize = Math.min(requiredSize, 4);
  state.preparedOutgoing = null;
  state.hands.A.areaDiePlus = 1;
  rootValue.activeMatch.cardSources.A.areaDiePlus = "INVENTORY_BACKED";
  rootValue.profiles.playerA.inventory.areaDiePlus = 1;
  rootValue.reservations.playerA.areaDiePlus = 1;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player A の情報/).waitFor();
}

async function installCornerBloomState(page, blocked = false) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "A";
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.preparedOutgoing = null;
  state.hands.A.areaCornerBloom = 1;
  rootValue.activeMatch.cardSources.A.areaCornerBloom = "INVENTORY_BACKED";
  rootValue.profiles.playerA.inventory.areaCornerBloom = 1;
  rootValue.reservations.playerA.areaCornerBloom = 1;
  if (blocked) {
    const base = new Set(macroMicroCells(27));
    const outside = [];
    for (const [x, y] of [[11, 8], [12, 7], [11, 7], [16, 8], [15, 7], [16, 7], [11, 11], [12, 12], [11, 12], [16, 11], [15, 12], [16, 12]]) {
      const cell = y * 48 + x;
      if (!base.has(cell)) outside.push(cell);
    }
    state.regions = { R1: { id: "R1", micro: outside, sourceMacros: [], controllers: [], color: null, isPending: false } };
    state.pending = null;
    state.reserved = null;
  }
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player A の情報/).waitFor();
}

async function assertCornerBloomUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installCornerBloomState(page);
    const cells = page.locator('[aria-label="盤面"] button');
    await cells.nth(27).click();
    await page.getByRole("button", { name: "角膨張", exact: true }).click();
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };
    const target = cells.nth(27);
    if (gesture === "pointer") {
      await target.evaluate((button) => { button.click(); button.click(); });
    } else {
      await target.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${gesture}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${gesture}: storage writes`);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.deepEqual(afterRoot.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
    assert.equal(afterRoot.activeMatch.state.hands.A.areaCornerBloom, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.areaCornerBloom, 0);
    assert.equal(afterRoot.reservations.playerA.areaCornerBloom, 0);
    assert.deepEqual(afterRoot.activeMatch.state.preparedOutgoing.sourceMacros, [27]);
    assert.equal(afterRoot.activeMatch.state.preparedOutgoing.micro.length, 28);
    await assertReloadStable(page, metrics, `${gesture}: prepared corner bloom`);
  } finally {
    await context.close();
  }
}

async function installTripleShiftState(page) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "A";
  state.phase = "WORK";
  state.preparedOutgoing = null;
  state.regions = {
    R1: { id: "R1", micro: [13, 14, 15].flatMap(macroMicroCells), sourceMacros: [13, 14, 15], controllers: ["A"], color: "red", isPending: false },
  };
  state.pending = null;
  state.reserved = null;
  state.hands.A.areaTripleShift = 1;
  rootValue.activeMatch.cardSources.A.areaTripleShift = "INVENTORY_BACKED";
  rootValue.profiles.playerA.inventory.areaTripleShift = 1;
  rootValue.reservations.playerA.areaTripleShift = 1;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player A の情報/).waitFor();
}

async function assertTripleShiftUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installTripleShiftState(page);
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const counters = { ...metrics };
    const control = page.getByRole("button", { name: "三層断層を確定", exact: true });
    if (gesture === "pointer") await control.evaluate((button) => { button.click(); button.click(); });
    else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, counters.generatedIds + 1);
    assert.equal(metrics.saveWrites, counters.saveWrites + 1);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.deepEqual(afterRoot.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
    assert.equal(afterRoot.activeMatch.state.hands.A.areaTripleShift, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.areaTripleShift, 0);
    assert.equal(afterRoot.reservations.playerA.areaTripleShift, 0);
    assert.notDeepEqual(afterRoot.activeMatch.state.regions.R1.micro, beforeRoot.activeMatch.state.regions.R1.micro);
    await assertReloadStable(page, metrics, `${gesture}: triple shift`);
  } finally {
    await context.close();
  }
}

async function installRandomSealState(page, presealed = false, skillId = "disruptRandomOne") {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "A";
  state.phase = "WORK";
  state.hands.A[skillId] = 1;
  rootValue.activeMatch.cardSources.A[skillId] = "INVENTORY_BACKED";
  rootValue.profiles.playerA.inventory[skillId] = 1;
  rootValue.reservations.playerA[skillId] = 1;
  if (presealed) for (const color of Object.keys(colorNames)) state.publicEffects.B.seals[color] = 3;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player A の情報/).waitFor();
}

async function assertRandomSealUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installRandomSealState(page);
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const counters = { ...metrics };
    const control = page.getByRole("button", { name: "色封じ・乱", exact: true });
    if (gesture === "pointer") await control.evaluate((button) => { button.click(); button.click(); });
    else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, counters.generatedIds + 1);
    assert.equal(metrics.saveWrites, counters.saveWrites + 1);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(afterRoot.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 0x6d2b79f5) >>> 0);
    for (const [name, value] of Object.entries(beforeRoot.activeMatch.rngSnapshot)) if (name !== "skill-effect") assert.equal(afterRoot.activeMatch.rngSnapshot[name], value);
    assert.equal(afterRoot.activeMatch.state.hands.A.disruptRandomOne, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.disruptRandomOne, 0);
    assert.equal(afterRoot.reservations.playerA.disruptRandomOne, 0);
    assert.equal(Object.values(afterRoot.activeMatch.state.publicEffects.B.seals).filter((value) => value === 1).length, 1);
    await assertReloadStable(page, metrics, `${gesture}: random seal`);
  } finally {
    await context.close();
  }
}

async function assertRandomTwoSealUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installRandomSealState(page, false, "disruptRandomTwo");
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const counters = { ...metrics };
    const control = page.getByRole("button", { name: "二重封じ・乱", exact: true });
    if (gesture === "pointer") await control.evaluate((button) => { button.click(); button.click(); });
    else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, counters.generatedIds + 1);
    assert.equal(metrics.saveWrites, counters.saveWrites + 1);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(afterRoot.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 2 * 0x6d2b79f5) >>> 0);
    for (const [name, value] of Object.entries(beforeRoot.activeMatch.rngSnapshot)) if (name !== "skill-effect") assert.equal(afterRoot.activeMatch.rngSnapshot[name], value);
    assert.equal(afterRoot.activeMatch.state.hands.A.disruptRandomTwo, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.disruptRandomTwo, 0);
    assert.equal(afterRoot.reservations.playerA.disruptRandomTwo, 0);
    assert.equal(Object.values(afterRoot.activeMatch.state.publicEffects.B.seals).filter((value) => value === 1).length, 2);
    await assertReloadStable(page, metrics, `${gesture}: random double seal`);
  } finally {
    await context.close();
  }
}

async function assertChoiceSealUse(browser, gesture, skillId = "disruptChoiceTwo", label = "追封：赤", duration = 2) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installRandomSealState(page, false, skillId);
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const counters = { ...metrics };
    const control = page.getByRole("button", { name: label, exact: true });
    if (gesture === "pointer") await control.evaluate((button) => { button.click(); button.click(); });
    else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, counters.generatedIds + 1);
    assert.equal(metrics.saveWrites, counters.saveWrites + 1);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.deepEqual(afterRoot.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
    assert.equal(afterRoot.activeMatch.state.hands.A[skillId], 0);
    assert.equal(afterRoot.profiles.playerA.inventory[skillId], 0);
    assert.equal(afterRoot.reservations.playerA[skillId], 0);
    assert.equal(afterRoot.activeMatch.state.publicEffects.B.seals.red, duration);
    await assertReloadStable(page, metrics, `${gesture}: chosen ${duration}-coloring seal`);
  } finally {
    await context.close();
  }
}

async function installPaletteRandomState(page, skillId = "disruptPaletteRandom") {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "A";
  state.phase = "WORK";
  state.regions = {};
  state.pending = null;
  state.reserved = null;
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.hands.A[skillId] = 1;
  rootValue.activeMatch.cardSources.A[skillId] = "INVENTORY_BACKED";
  rootValue.profiles.playerA.inventory[skillId] = 1;
  rootValue.reservations.playerA[skillId] = 1;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player A の情報/).waitFor();
}

async function assertPaletteRandomUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installPaletteRandomState(page);
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const counters = { ...metrics };
    const control = page.getByRole("button", { name: "持ち色汚染・乱", exact: true });
    if (gesture === "pointer") await control.evaluate((button) => { button.click(); button.click(); });
    else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, counters.generatedIds + 1);
    assert.equal(metrics.saveWrites, counters.saveWrites + 1);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(afterRoot.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 2 * 0x6d2b79f5) >>> 0);
    assert.equal(afterRoot.activeMatch.state.hands.A.disruptPaletteRandom, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.disruptPaletteRandom, 0);
    assert.equal(afterRoot.reservations.playerA.disruptPaletteRandom, 0);
    assert.equal(afterRoot.activeMatch.state.privateEffects.B.paletteDebuffs.length, 1);
    assert.equal(await page.getByText(/持ち色汚染中/).count(), 0);
    await assertReloadStable(page, metrics, `${gesture}: random palette corruption`);
  } finally {
    await context.close();
  }
}

async function assertPaletteChoiceUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installPaletteRandomState(page, "disruptPaletteChoice");
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const counters = { ...metrics };
    const control = page.getByRole("button", { name: "汚染：赤", exact: true });
    if (gesture === "pointer") await control.evaluate((button) => { button.click(); button.click(); });
    else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, counters.generatedIds + 1);
    assert.equal(metrics.saveWrites, counters.saveWrites + 1);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(afterRoot.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 0x6d2b79f5) >>> 0);
    assert.equal(afterRoot.activeMatch.state.hands.A.disruptPaletteChoice, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.disruptPaletteChoice, 0);
    assert.equal(afterRoot.reservations.playerA.disruptPaletteChoice, 0);
    const effect = afterRoot.activeMatch.state.privateEffects.B.paletteDebuffs[0];
    assert.deepEqual({ color: effect.injectedColor, remaining: effect.remaining }, { color: "red", remaining: 2 });
    assert.equal(await page.getByText(/持ち色汚染中/).count(), 0);
    await assertReloadStable(page, metrics, `${gesture}: chosen palette corruption`);
  } finally {
    await context.close();
  }
}

async function assertForcedPaletteUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installPaletteRandomState(page, "disruptForcedPalette");
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforePalette = [...beforeRoot.activeMatch.state.basicPalettes.B, beforeRoot.activeMatch.state.bonusColors.B];
    const counters = { ...metrics };
    const control = page.getByRole("button", { name: "強制：赤", exact: true });
    if (gesture === "pointer") await control.evaluate((button) => { button.click(); button.click(); });
    else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    const afterPalette = [...afterRoot.activeMatch.state.basicPalettes.B, afterRoot.activeMatch.state.bonusColors.B];
    assert.equal(metrics.generatedIds, counters.generatedIds + 1);
    assert.equal(metrics.saveWrites, counters.saveWrites + 1);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(afterRoot.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 0x6d2b79f5) >>> 0);
    assert.equal(afterRoot.activeMatch.state.hands.A.disruptForcedPalette, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.disruptForcedPalette, 0);
    assert.equal(afterRoot.reservations.playerA.disruptForcedPalette, 0);
    assert.equal(afterPalette.filter((color, slot) => color !== beforePalette[slot]).length, 1);
    assert.equal(afterPalette.filter((color) => color === "red").length, beforePalette.filter((color) => color === "red").length + 1);
    assert.equal(afterRoot.activeMatch.state.privateEffects.B.paletteDebuffs, undefined);
    assert.equal(await page.getByText(/持ち色汚染中/).count(), 0);
    await assertReloadStable(page, metrics, `${gesture}: forced permanent palette`);
  } finally {
    await context.close();
  }
}

async function assertDiePlusUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installDiePlusState(page);
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };
    const control = page.getByRole("button", { name: "エリア拡張", exact: true });
    if (gesture === "pointer") {
      await control.evaluate((button) => { button.click(); button.click(); });
    } else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
      key: saveKey, revision: before.rootRevision,
    });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    const state = afterRoot.activeMatch.state;
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${gesture}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${gesture}: storage writes`);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.deepEqual(afterRoot.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
    assert.equal(state.requiredSize, 2);
    assert.equal(state.baseRequiredSize, 1);
    assert.equal(state.hands.A.areaDiePlus, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.areaDiePlus, 0);
    assert.equal(afterRoot.reservations.playerA.areaDiePlus, 0);
    assert.deepEqual([state.active, state.phase], ["A", "WORK"]);

    await assertReloadStable(page, metrics, `${gesture}: expanded size`);
    await page.getByRole("button", { name: "自分の情報を表示" }).click();
    assert.equal(await page.getByRole("button", { name: "エリア拡張", exact: true }).count(), 0);
    const cells = page.locator('[aria-label="盤面"] button');
    await cells.nth(26).click();
    await cells.nth(27).click();
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.getByRole("heading", { name: "Player B・COLOR", exact: true }).waitFor();
    const created = (await persistedRoot(page)).activeMatch.state;
    assert.deepEqual(created.regions.R2.sourceMacros, [26, 27]);
    assert.deepEqual([created.active, created.phase, created.pending], ["B", "COLOR", "R2"]);
  } finally {
    await context.close();
  }
}

async function installResizeState(page) {
  const rootValue = await persistedRoot(page);
  const state = rootValue.activeMatch.state;
  state.active = "A";
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.preparedOutgoing = null;
  state.hands.A.areaResize = 1;
  rootValue.activeMatch.cardSources.A.areaResize = "INVENTORY_BACKED";
  rootValue.profiles.playerA.inventory.areaResize = 1;
  rootValue.reservations.playerA.areaResize = 1;
  standardMatch.validateStandardState(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: saveKey, value: JSON.stringify(rootValue) });
  await page.reload({ waitUntil: "load" });
  await assertHandoverIsPrivate(page);
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.getByText(/Player A の情報/).waitFor();
}

async function chooseResizeMode(page, mode) {
  await page.getByRole("button", { name: "拡大縮小", exact: true }).click();
  await page.getByRole("button", { name: mode === "expand" ? "盤面を拡大" : "盤面を縮小", exact: true }).click();
}

async function assertResizeUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installResizeState(page);
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };
    await chooseResizeMode(page, "expand");
    assert.deepEqual(await persistedSnapshot(page), before);
    assert.deepEqual(metrics, beforeCounters);
    const control = page.getByRole("button", { name: "上側を拡大", exact: true });
    if (gesture === "pointer") {
      await control.evaluate((button) => { button.click(); button.click(); });
    } else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
      key: saveKey, revision: before.rootRevision,
    });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    const state = afterRoot.activeMatch.state;
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${gesture}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${gesture}: storage writes`);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.deepEqual(afterRoot.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
    assert.equal(state.playableBounds.minRow, 0);
    assert.equal(state.trophyTargetMacros.length, 110);
    assert.equal(state.hands.A.areaResize, 0);
    assert.equal(afterRoot.profiles.playerA.inventory.areaResize, 0);
    assert.equal(afterRoot.reservations.playerA.areaResize, 0);
    assert.deepEqual([state.active, state.phase], ["A", "WORK"]);

    await assertReloadStable(page, metrics, `${gesture}: expanded board`);
    await page.getByRole("button", { name: "自分の情報を表示" }).click();
    assert.equal(await page.getByRole("button", { name: "拡大縮小", exact: true }).count(), 0);
    const cells = page.locator('[aria-label="盤面"] button');
    assert.equal(await cells.nth(1).isDisabled(), false);
    await cells.nth(1).click();
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.getByRole("heading", { name: "Player B・COLOR", exact: true }).waitFor();
    assert.deepEqual((await persistedRoot(page)).activeMatch.state.regions.R2.sourceMacros, [1]);
  } finally {
    await context.close();
  }
}

function availableColor(state, seat, regionId, excluded = []) {
  const colors = new Set(state.basicPalettes[seat]);
  if (state.bonusUsesRemaining[seat] > 0) colors.add(state.bonusColors[seat]);
  const blocked = new Set(standardEngine.adjacentRegionIds(state, regionId).map((id) => state.regions[id]?.color).filter(Boolean));
  return [...colors].find((color) => !blocked.has(color) && !excluded.includes(color));
}

async function assertSplitUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installSplitState(page);
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };
    await page.getByRole("button", { name: "エリア二分", exact: true }).click();
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    const confirm = page.getByRole("button", { name: "エリア二分を確定" });
    if (gesture === "pointer") {
      await confirm.evaluate((button) => { button.click(); button.click(); });
    } else {
      await confirm.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
      key: saveKey, revision: before.rootRevision,
    });
    const divided = await persistedSnapshot(page);
    const dividedRoot = await persistedRoot(page);
    const dividedState = dividedRoot.activeMatch.state;
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${gesture}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${gesture}: storage writes`);
    assert.equal(divided.rootRevision, before.rootRevision + 1);
    assert.equal(divided.matchVersion, before.matchVersion + 1);
    assert.equal(divided.actionReceipts, before.actionReceipts + 1);
    assert.equal(divided.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(divided.rngSnapshotSha256, before.rngSnapshotSha256);
    assert.equal(dividedState.hands.A.colorRegionSplit, 0);
    assert.equal(dividedRoot.profiles.playerA.inventory.colorRegionSplit, 0);
    assert.equal(dividedRoot.reservations.playerA.colorRegionSplit, 0);
    assert.equal(dividedState.regions.R2, undefined);
    assert.deepEqual(dividedState.regions.R3.sourceMacros, [26]);
    assert.deepEqual(dividedState.regions.R4.sourceMacros, [27, 28]);
    assert.deepEqual([dividedState.pending, dividedState.reserved], ["R3", "R4"]);
    assert.deepEqual([divided.active, divided.phase], ["A", "COLOR"]);

    await assertReloadStable(page, metrics, `${gesture}: divided state`);
    await page.getByRole("button", { name: "自分の情報を表示" }).click();
    assert.equal(await page.getByRole("button", { name: "エリア二分", exact: true }).count(), 0);
    const selectedColor = availableColor(dividedState, "A", "R3");
    assert.ok(selectedColor);
    const dieBefore = dividedRoot.activeMatch.rngSnapshot.die;
    await page.getByRole("button", { name: colorNames[selectedColor], exact: true }).first().click();
    await page.getByRole("heading", { name: "Player B・COLOR", exact: true }).waitFor();
    await assertHandoverIsPrivate(page);
    const returnedRoot = await persistedRoot(page);
    const returned = returnedRoot.activeMatch.state;
    assert.deepEqual([returned.pending, returned.reserved], ["R4", null]);
    assert.deepEqual([returned.active, returned.phase], ["B", "COLOR"]);
    assert.equal(returned.regions.R3.color, selectedColor);
    assert.equal(returned.regions.R4.isPending, true);
    assert.equal(returnedRoot.activeMatch.rngSnapshot.die, dieBefore);

    await page.getByRole("button", { name: "自分の情報を表示" }).click();
    const returnedColor = availableColor(returned, "B", "R4");
    assert.ok(returnedColor);
    await page.getByRole("button", { name: colorNames[returnedColor], exact: true }).first().click();
    await page.getByText(/Player B・WORK/).waitFor();
    const completedRoot = await persistedRoot(page);
    assert.deepEqual([completedRoot.activeMatch.state.pending, completedRoot.activeMatch.state.reserved], [null, null]);
    assert.notEqual(completedRoot.activeMatch.rngSnapshot.die, dieBefore);
  } finally {
    await context.close();
  }
}

async function assertRandomBorrowUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installBorrowColorState(page, "colorRandomBorrow");
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };
    const control = page.getByRole("button", { name: "色拾い・乱" });
    if (gesture === "pointer") {
      await control.evaluate((button) => { button.click(); button.click(); });
    } else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
      key: saveKey, revision: before.rootRevision,
    });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${gesture}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${gesture}: storage writes`);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.equal(afterRoot.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 0x6d2b79f5) >>> 0);
    for (const [name, value] of Object.entries(beforeRoot.activeMatch.rngSnapshot)) {
      if (name !== "skill-effect") assert.equal(afterRoot.activeMatch.rngSnapshot[name], value, `${gesture}: ${name} moved`);
    }
    assert.equal(afterRoot.activeMatch.state.hands.B.colorRandomBorrow, 0);
    assert.equal(afterRoot.profiles.playerB.inventory.colorRandomBorrow, 0);
    assert.equal(afterRoot.reservations.playerB.colorRandomBorrow, 0);
    assert.deepEqual(afterRoot.activeMatch.state.privateEffects.B.temporaryColors, ["red"]);
    assert.equal(afterRoot.activeMatch.state.publicLog.at(-1).includes("red"), false);
    assert.deepEqual([after.active, after.phase], ["B", "COLOR"]);

    const persistedBeforeReload = await persistedSnapshot(page);
    await page.reload({ waitUntil: "load" });
    await assertHandoverIsPrivate(page);
    assert.deepEqual(await persistedSnapshot(page), persistedBeforeReload, `${gesture}: reload drift`);
    await page.getByRole("button", { name: "自分の情報を表示" }).click();
    assert.equal(await page.getByRole("button", { name: "色拾い・乱" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "赤", exact: true }).count() > 0, true);
  } finally {
    await context.close();
  }
}

async function assertChoiceBorrowUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installBorrowColorState(page, "colorChoiceBorrow");
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };

    await page.getByRole("button", { name: "色借り", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "借りる：赤", exact: true }).count(), 1);
    assert.equal(await page.getByRole("button", { name: /^借りる：/ }).count(), 1);
    await page.getByRole("button", { name: "色借りをキャンセル" }).click();
    assert.deepEqual(await persistedSnapshot(page), before);
    assert.deepEqual(metrics, beforeCounters);

    await page.getByRole("button", { name: "色借り", exact: true }).click();
    const control = page.getByRole("button", { name: "借りる：赤", exact: true });
    if (gesture === "pointer") {
      await control.evaluate((button) => { button.click(); button.click(); });
    } else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
      key: saveKey, revision: before.rootRevision,
    });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${gesture}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${gesture}: storage writes`);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.deepEqual(afterRoot.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot, `${gesture}: RNG moved`);
    assert.equal(afterRoot.activeMatch.state.hands.B.colorChoiceBorrow, 0);
    assert.equal(afterRoot.profiles.playerB.inventory.colorChoiceBorrow, 0);
    assert.equal(afterRoot.reservations.playerB.colorChoiceBorrow, 0);
    assert.deepEqual(afterRoot.activeMatch.state.privateEffects.B.temporaryColors, ["red"]);
    assert.equal(afterRoot.activeMatch.state.publicLog.at(-1).includes("red"), false);
    assert.deepEqual([after.active, after.phase], ["B", "COLOR"]);

    const persistedBeforeReload = await persistedSnapshot(page);
    await page.reload({ waitUntil: "load" });
    await assertHandoverIsPrivate(page);
    assert.deepEqual(await persistedSnapshot(page), persistedBeforeReload, `${gesture}: reload drift`);
    await page.getByRole("button", { name: "自分の情報を表示" }).click();
    assert.equal(await page.getByRole("button", { name: "色借り", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "赤", exact: true }).count() > 0, true);
  } finally {
    await context.close();
  }
}

async function assertPaletteChangeUse(browser, gesture) {
  const { context, page, metrics } = await newMeasuredPage(browser);
  try {
    await bootToAWork(page);
    await installBorrowColorState(page, "colorPaletteChange");
    const before = await persistedSnapshot(page);
    const beforeRoot = await persistedRoot(page);
    const beforeCounters = { ...metrics };
    const paletteBefore = [...beforeRoot.activeMatch.state.basicPalettes.B, beforeRoot.activeMatch.state.bonusColors.B];
    const usesBefore = beforeRoot.activeMatch.state.bonusUsesRemaining.B;

    await page.getByRole("button", { name: "持ち色変更", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /^変更枠/ }).count(), 3);
    await page.getByRole("button", { name: "持ち色変更をキャンセル" }).click();
    assert.deepEqual(await persistedSnapshot(page), before);
    assert.deepEqual(metrics, beforeCounters);

    await page.getByRole("button", { name: "持ち色変更", exact: true }).click();
    await page.getByRole("button", { name: `変更枠1：${colorNames[paletteBefore[0]]}`, exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /^変更先：/ }).count(), 3);
    const replacement = paletteBefore[1];
    const control = page.getByRole("button", { name: `変更先：${colorNames[replacement]}`, exact: true });
    if (gesture === "pointer") {
      await control.evaluate((button) => { button.click(); button.click(); });
    } else {
      await control.focus();
      await page.keyboard.down(gesture);
      await page.keyboard.down(gesture);
      await page.keyboard.up(gesture);
    }
    await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
      key: saveKey, revision: before.rootRevision,
    });
    const after = await persistedSnapshot(page);
    const afterRoot = await persistedRoot(page);
    assert.equal(metrics.generatedIds, beforeCounters.generatedIds + 1, `${gesture}: generated action IDs`);
    assert.equal(metrics.saveWrites, beforeCounters.saveWrites + 1, `${gesture}: storage writes`);
    assert.equal(after.rootRevision, before.rootRevision + 1);
    assert.equal(after.matchVersion, before.matchVersion + 1);
    assert.equal(after.actionReceipts, before.actionReceipts + 1);
    assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
    assert.deepEqual(afterRoot.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot, `${gesture}: RNG moved`);
    assert.equal(afterRoot.activeMatch.state.hands.B.colorPaletteChange, 0);
    assert.equal(afterRoot.profiles.playerB.inventory.colorPaletteChange, 0);
    assert.equal(afterRoot.reservations.playerB.colorPaletteChange, 0);
    assert.deepEqual(afterRoot.activeMatch.state.basicPalettes.B, [replacement, replacement]);
    assert.equal(afterRoot.activeMatch.state.bonusColors.B, paletteBefore[2]);
    assert.equal(afterRoot.activeMatch.state.bonusUsesRemaining.B, usesBefore);
    assert.equal(afterRoot.activeMatch.state.publicLog.at(-1).includes(replacement), false);
    assert.deepEqual([after.active, after.phase], ["B", "COLOR"]);

    const persistedBeforeReload = await persistedSnapshot(page);
    await page.reload({ waitUntil: "load" });
    await assertHandoverIsPrivate(page);
    assert.deepEqual(await persistedSnapshot(page), persistedBeforeReload, `${gesture}: reload drift`);
    await page.getByRole("button", { name: "自分の情報を表示" }).click();
    assert.equal(await page.getByRole("button", { name: "持ち色変更", exact: true }).count(), 0);
  } finally {
    await context.close();
  }
}

test("color-seal native keyboard and normal-URL lifecycle gates", { skip: !chromium || !installedBrowserExecutable() }, async (t) => {
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: installedBrowserExecutable() });
    await t.test("four normal URL reloads are byte/hash/counter stable", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToBWork(page);
        await page.getByRole("button", { name: "赤", exact: true }).nth(1).click();
        await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
        let state = await assertReloadStable(page, metrics, "after disruptChoiceOne");
        assert.deepEqual([state.active, state.phase], ["B", "WORK"]);

        await page.getByRole("button", { name: "自分の情報を表示" }).click();
        await page.locator('[aria-label="盤面"] button').nth(26).click();
        await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
        state = await assertReloadStable(page, metrics, "opponent COLOR");
        assert.deepEqual([state.active, state.phase], ["A", "COLOR"]);

        await page.getByRole("button", { name: "自分の情報を表示" }).click();
        await page.getByRole("button", { name: "青", exact: true }).first().click();
        state = await assertReloadStable(page, metrics, "pending backlash");
        assert.deepEqual([state.active, state.phase], ["A", "WORK"]);

        await page.getByRole("button", { name: "自分の情報を表示" }).click();
        const cells = page.locator('[aria-label="盤面"] button');
        await cells.nth(25).click();
        await cells.nth(37).click();
        await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
        state = await assertReloadStable(page, metrics, "resolved backlash COLOR");
        assert.deepEqual([state.active, state.phase], ["B", "COLOR"]);
        assert.deepEqual(await page.context().pages().length, 1);
      } finally {
        await context.close();
      }
    });

    await t.test("private controls rotate from A to B without stale or duplicate reveal", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
        await page.waitForURL(`${baseUrl}/standard-v5/`);
        await disablePresentation(page);
        await page.getByRole("button", { name: "標準α対戦を開始" }).click();
        await page.getByText(/Turn 1・Player A・CREATE_FIRST/).waitFor();
        const reveal = page.getByRole("button", { name: "自分の情報を表示" });
        await reveal.click();
        await page.evaluate(() => {
          globalThis.__stalePrivateControl = [...document.querySelectorAll("#privatePanel button")]
            .find((button) => button.textContent.includes("合法リカラー"));
        });
        const cells = page.locator('[aria-label="盤面"] button');
        await cells.nth(13).click();
        await cells.nth(14).click();
        await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
        await page.getByText(/Turn 2・Player B・COLOR/).waitFor();
        await reveal.evaluate((button) => { button.click(); button.click(); });
        const heading = page.locator("#privatePanel .private-title");
        await assert.doesNotReject(() => heading.getByText("Player B の情報", { exact: true }).waitFor());
        const beforeCounters = { ...metrics };
        const before = await persistedSnapshot(page);
        await page.evaluate(() => globalThis.__stalePrivateControl.click());
        assert.equal(await heading.textContent(), "Player B の情報");
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, beforeCounters);
      } finally {
        await context.close();
      }
    });

    await t.test("legalRecolor succeeds once, survives reload, rejects chaining, then unlocks on COLOR", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const beforeState = beforeRoot.activeMatch.state;
        const target = beforeState.regions.R1;
        const candidates = standardEngine.legalRecolorCandidates(beforeState, target.id);
        const geometryBefore = geometrySnapshot(beforeState);
        const inventoryBefore = JSON.stringify(beforeRoot.profiles.playerA.inventory);
        const reservationsBefore = JSON.stringify(beforeRoot.reservations.playerA || {});
        const rngBefore = { ...beforeRoot.activeMatch.rngSnapshot };
        const countersBefore = { ...metrics };
        assert.equal(beforeState.active, "A");
        assert.equal(beforeState.phase, "WORK");
        assert.equal(beforeState.hands.A.legalRecolor, 1);
        assert.equal(beforeState.interferenceLock, false);
        assert.ok(target.color);
        assert.equal(target.isPending, false);
        assert.ok(candidates.length > 0);

        await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
        assert.equal(await page.locator("#notice").textContent(), "彩色済みエリアを1つ選んでください。");
        assert.equal(await page.locator("[data-legal-recolor],[data-candidate-count],[data-probability]").count(), 0);
        const privateText = await page.locator("#privatePanel").textContent();
        assert.equal(privateText.includes("候補"), false);
        assert.equal(privateText.includes("確率"), false);
        assert.equal(privateText.includes("変更先なし"), false);
        assert.equal(privateText.includes("Player B の情報"), false);
        await page.locator('[aria-label="盤面"] button').nth(13).dblclick();
        await assertHandoverIsPrivate(page);

        const after = await persistedSnapshot(page);
        const afterRoot = await persistedRoot(page);
        const afterState = afterRoot.activeMatch.state;
        const actionIdsBefore = new Set(Object.keys(beforeRoot.receipts.matchAction));
        const consumptionIdsBefore = new Set(Object.keys(beforeRoot.receipts.matchConsumption));
        const newActionIds = Object.keys(afterRoot.receipts.matchAction).filter((id) => !actionIdsBefore.has(id));
        const newConsumptionIds = Object.keys(afterRoot.receipts.matchConsumption).filter((id) => !consumptionIdsBefore.has(id));
        assert.equal(metrics.generatedIds, countersBefore.generatedIds + 1);
        assert.equal(metrics.saveWrites, countersBefore.saveWrites + 1);
        assert.equal(after.rootRevision, before.rootRevision + 1);
        assert.equal(after.matchVersion, before.matchVersion + 1);
        assert.equal(after.actionReceipts, before.actionReceipts + 1);
        assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
        assert.equal(newActionIds.length, 1);
        assert.equal(newConsumptionIds.length, 1);
        assert.equal(afterRoot.receipts.matchConsumption[newConsumptionIds[0]].source, "EXPERIMENTAL_LOAN");
        assert.equal(afterState.hands.A.legalRecolor, 0);
        assert.equal(JSON.stringify(afterRoot.profiles.playerA.inventory), inventoryBefore);
        assert.equal(JSON.stringify(afterRoot.reservations.playerA || {}), reservationsBefore);
        assert.notEqual(afterState.regions.R1.color, target.color);
        assert.ok(candidates.includes(afterState.regions.R1.color));
        assert.deepEqual(geometrySnapshot(afterState), geometryBefore);
        assert.equal(Object.keys(afterState.regions).length, Object.keys(beforeState.regions).length);
        assert.equal(afterState.active, "B");
        assert.equal(afterState.phase, "WORK");
        assert.equal(afterState.requiredSize, beforeState.requiredSize);
        assert.equal(afterState.rolledSize, beforeState.rolledSize);
        assert.equal(afterState.interferenceLock, true);
        for (const [name, value] of Object.entries(rngBefore)) {
          const expected = name === "skill-effect" ? (value + 0x6d2b79f5) >>> 0 : value;
          assert.equal(afterRoot.activeMatch.rngSnapshot[name], expected, `${name}: unexpected RNG movement`);
        }

        const stable = await assertReloadStable(page, metrics, "legalRecolor success");
        assert.deepEqual([stable.active, stable.phase], ["B", "WORK"]);
        await page.getByRole("button", { name: "自分の情報を表示" }).click();
        const rejectedBefore = await persistedSnapshot(page);
        const rejectedCounters = { ...metrics };
        await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
        await page.locator('[aria-label="盤面"] button').nth(13).click();
        await page.getByText("操作できません（INTERFERENCE_CHAINED）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), rejectedBefore);
        assert.equal(metrics.saveWrites, rejectedCounters.saveWrites);
        assert.equal(await page.locator("#privatePanel .private-title").textContent(), "Player B の情報");

        const invalidCreateBefore = await persistedSnapshot(page);
        const invalidCreateCounters = { ...metrics };
        await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
        await page.getByText("操作できません（WRONG_REGION_SIZE）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), invalidCreateBefore);
        assert.equal(metrics.saveWrites, invalidCreateCounters.saveWrites);
        assert.equal((await persistedRoot(page)).activeMatch.state.interferenceLock, true);

        await page.waitForTimeout(350);
        await page.locator('[aria-label="盤面"] button').nth(26).click();
        await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
        await page.getByText(/Turn 3・Player A・COLOR/).waitFor();
        const unlockedRoot = await persistedRoot(page);
        assert.equal(unlockedRoot.activeMatch.state.interferenceLock, false);
      } finally {
        await context.close();
      }
    });

    await t.test("legalRecolor candidate-zero rejects without UI oracle or authoritative drift", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installCandidateZeroState(page);
        const beforeRoot = await persistedRoot(page);
        const before = await persistedSnapshot(page);
        const rawBefore = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        const publicBefore = standardMatch.projectStandardPublicState(beforeRoot.activeMatch.state);
        const privateBefore = standardMatch.projectStandardPrivateState(beforeRoot.activeMatch.state, "A");
        const privateDomBefore = await page.locator("#privatePanel").innerHTML();
        const countersBefore = { ...metrics };
        const zeroSignature = await publicCellSignature(page, 13);
        const positiveSignature = await publicCellSignature(page, 37);
        assert.deepEqual(zeroSignature, positiveSignature, "candidate-zero target leaked through public cell presentation");

        await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
        assert.equal(await page.locator("#notice").textContent(), "彩色済みエリアを1つ選んでください。");
        assert.deepEqual(await publicCellSignature(page, 13), await publicCellSignature(page, 37));
        await page.locator('[aria-label="盤面"] button').nth(13).click();
        await page.getByText("変更先がありません。カードは消費されませんでした。", { exact: true }).waitFor();

        const afterRoot = await persistedRoot(page);
        const after = await persistedSnapshot(page);
        const rawAfter = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        const publicAfter = standardMatch.projectStandardPublicState(afterRoot.activeMatch.state);
        const privateAfter = standardMatch.projectStandardPrivateState(afterRoot.activeMatch.state, "A");
        assert.equal(rawAfter, rawBefore);
        assert.equal(sha(afterRoot), sha(beforeRoot));
        assert.equal(sha(afterRoot.activeMatch.state), sha(beforeRoot.activeMatch.state));
        assert.equal(sha(publicAfter), sha(publicBefore));
        assert.equal(sha(privateAfter), sha(privateBefore));
        assert.deepEqual(after, before);
        assert.equal(metrics.saveWrites, countersBefore.saveWrites);
        assert.equal(afterRoot.activeMatch.state.hands.A.legalRecolor, 1);
        assert.equal(afterRoot.activeMatch.state.active, "A");
        assert.equal(afterRoot.activeMatch.state.phase, "WORK");
        assert.equal(afterRoot.activeMatch.state.interferenceLock, false);
        assert.equal(await page.locator("#privatePanel").innerHTML(), privateDomBefore);
        assert.equal(await page.locator("#handover").getAttribute("hidden"), "");

        await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
        assert.equal(await page.locator("#notice").textContent(), "彩色済みエリアを1つ選んでください。");
        await page.locator('[aria-label="盤面"] button').nth(16).click();
        await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
        await page.getByText(/Turn 3・Player B・COLOR/).waitFor();
      } finally {
        await context.close();
      }
    });

    await t.test("legalRecolor storage failure rolls back UI and authoritative state before a clean retry", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        const beforeRoot = await persistedRoot(page);
        const before = await persistedSnapshot(page);
        const rawBefore = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        const privateDomBefore = await page.locator("#privatePanel").innerHTML();
        const countersBefore = { ...metrics };
        await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.locator('[aria-label="盤面"] button').nth(13).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();

        const failedRoot = await persistedRoot(page);
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), rawBefore);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(sha(failedRoot), sha(beforeRoot));
        assert.equal(metrics.saveWrites, countersBefore.saveWrites);
        assert.equal(metrics.failedWriteAttempts, countersBefore.failedWriteAttempts + 1);
        assert.equal(metrics.generatedIds, countersBefore.generatedIds + 1);
        assert.equal(failedRoot.activeMatch.state.regions.R1.color, beforeRoot.activeMatch.state.regions.R1.color);
        assert.equal(failedRoot.activeMatch.rngSnapshot["skill-effect"], beforeRoot.activeMatch.rngSnapshot["skill-effect"]);
        assert.equal(failedRoot.activeMatch.state.hands.A.legalRecolor, 1);
        assert.equal(failedRoot.activeMatch.state.active, "A");
        assert.equal(failedRoot.activeMatch.state.interferenceLock, false);
        assert.equal(await page.locator("#privatePanel").innerHTML(), privateDomBefore);
        assert.equal(await page.locator("#handover").getAttribute("hidden"), "");

        await page.waitForTimeout(350);
        const retryBefore = { ...metrics };
        await page.getByRole("button", { name: "合法リカラー（実験貸与）" }).click();
        await page.locator('[aria-label="盤面"] button').nth(13).click();
        await assertHandoverIsPrivate(page);
        const retriedRoot = await persistedRoot(page);
        assert.equal(metrics.saveWrites, retryBefore.saveWrites + 1);
        assert.equal(metrics.failedWriteAttempts, retryBefore.failedWriteAttempts);
        assert.equal(metrics.generatedIds, retryBefore.generatedIds);
        assert.equal(retriedRoot.rootRevision, beforeRoot.rootRevision + 1);
        assert.equal(retriedRoot.activeMatch.state.version, beforeRoot.activeMatch.state.version + 1);
        assert.equal(retriedRoot.activeMatch.state.hands.A.legalRecolor, 0);
        assert.notEqual(retriedRoot.activeMatch.state.regions.R1.color, beforeRoot.activeMatch.state.regions.R1.color);
        assert.deepEqual([retriedRoot.activeMatch.state.active, retriedRoot.activeMatch.state.phase], ["B", "WORK"]);
      } finally {
        await context.close();
      }
    });

    await t.test("Enter repeat resolves disruptChoiceOne exactly once", () => assertKeyboardUse(browser, "Enter"));
    await t.test("Space repeat resolves disruptChoiceOne exactly once", () => assertKeyboardUse(browser, "Space"));
    await t.test("Enter repeat resolves legalRecolor exactly once", () => assertLegalRecolorKeyboardUse(browser, "Enter"));
    await t.test("Space repeat resolves legalRecolor exactly once", () => assertLegalRecolorKeyboardUse(browser, "Space"));
    await t.test("pointer double activation resolves colorRandomBorrow exactly once", () => assertRandomBorrowUse(browser, "pointer"));
    await t.test("Enter repeat resolves colorRandomBorrow exactly once", () => assertRandomBorrowUse(browser, "Enter"));
    await t.test("Space repeat resolves colorRandomBorrow exactly once", () => assertRandomBorrowUse(browser, " "));
    await t.test("pointer double activation resolves colorChoiceBorrow exactly once", () => assertChoiceBorrowUse(browser, "pointer"));
    await t.test("Enter repeat resolves colorChoiceBorrow exactly once", () => assertChoiceBorrowUse(browser, "Enter"));
    await t.test("Space repeat resolves colorChoiceBorrow exactly once", () => assertChoiceBorrowUse(browser, " "));
    await t.test("pointer double activation resolves colorPaletteChange exactly once", () => assertPaletteChangeUse(browser, "pointer"));
    await t.test("Enter repeat resolves colorPaletteChange exactly once", () => assertPaletteChangeUse(browser, "Enter"));
    await t.test("Space repeat resolves colorPaletteChange exactly once", () => assertPaletteChangeUse(browser, " "));
    await t.test("split selection cancel and reload are write-free and never revive selection UI", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installSplitState(page);
        const before = await persistedSnapshot(page);
        const counters = { ...metrics };
        await page.getByRole("button", { name: "エリア二分", exact: true }).click();
        await page.locator('[aria-label="盤面"] button').nth(26).click();
        assert.equal(await page.locator('[aria-label="盤面"] button.selected').count(), 1);
        await page.getByRole("button", { name: "エリア二分をキャンセル" }).click();
        assert.equal(await page.locator('[aria-label="盤面"] button.selected').count(), 0);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, counters);

        await page.getByRole("button", { name: "エリア二分", exact: true }).click();
        await page.locator('[aria-label="盤面"] button').nth(26).click();
        await page.reload({ waitUntil: "load" });
        await assertHandoverIsPrivate(page);
        assert.equal(await page.locator('[aria-label="盤面"] button.selected').count(), 0);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, counters);
        await page.getByRole("button", { name: "自分の情報を表示" }).click();
        assert.equal(await page.getByRole("button", { name: "エリア二分をキャンセル" }).count(), 0);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves colorRegionSplit exactly once", () => assertSplitUse(browser, "pointer"));
    await t.test("Enter repeat resolves colorRegionSplit exactly once", () => assertSplitUse(browser, "Enter"));
    await t.test("Space repeat resolves colorRegionSplit exactly once", () => assertSplitUse(browser, " "));
    await t.test("colorRegionSplit persistence failure is byte-stable and retries the same action ID", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installSplitState(page);
        const before = await persistedSnapshot(page);
        const rawBefore = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        const counters = { ...metrics };
        await page.getByRole("button", { name: "エリア二分", exact: true }).click();
        await page.locator('[aria-label="盤面"] button').nth(26).click();
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "エリア二分を確定" }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), rawBefore);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.failedWriteAttempts, counters.failedWriteAttempts + 1);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.equal(await page.locator('[aria-label="盤面"] button.selected').count(), 1);

        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "エリア二分を確定" }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
          key: saveKey, revision: before.rootRevision,
        });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(metrics.failedWriteAttempts, retryCounters.failedWriteAttempts);
        assert.equal(retried.activeMatch.state.hands.A.colorRegionSplit, 0);
        assert.deepEqual([retried.activeMatch.state.pending, retried.activeMatch.state.reserved], ["R3", "R4"]);
      } finally {
        await context.close();
      }
    });
    await t.test("micro-bloom uncommitted selection is write-free and does not survive reload", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installMicroBloomState(page);
        const before = await persistedSnapshot(page);
        const counters = { ...metrics };
        await page.locator('[aria-label="盤面"] button').nth(27).click();
        assert.equal(await page.locator('[aria-label="盤面"] button.selected').count(), 1);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, counters);
        await page.reload({ waitUntil: "load" });
        await assertHandoverIsPrivate(page);
        assert.equal(await page.locator('[aria-label="盤面"] button.selected').count(), 0);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, counters);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves areaMicroBloom exactly once", () => assertMicroBloomUse(browser, "pointer"));
    await t.test("Enter repeat resolves areaMicroBloom exactly once", () => assertMicroBloomUse(browser, "Enter"));
    await t.test("Space repeat resolves areaMicroBloom exactly once", () => assertMicroBloomUse(browser, " "));
    await t.test("areaMicroBloom candidate-zero and persistence retry remain atomic", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installMicroBloomState(page);
        const cells = page.locator('[aria-label="盤面"] button');
        await cells.nth(26).click();
        const zeroBefore = await persistedSnapshot(page);
        const zeroRoot = await persistedRoot(page);
        const zeroCounters = { ...metrics };
        await page.getByRole("button", { name: "ひとふくらみ", exact: true }).click();
        await page.getByText("操作できません（NO_MICRO_BLOOM_CANDIDATE）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), zeroBefore);
        assert.equal(metrics.saveWrites, zeroCounters.saveWrites);
        assert.equal((await persistedRoot(page)).activeMatch.state.hands.A.areaMicroBloom, 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, zeroRoot.activeMatch.rngSnapshot);

        await cells.nth(26).click();
        await cells.nth(27).click();
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const rawBefore = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "ひとふくらみ", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), rawBefore);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.failedWriteAttempts, counters.failedWriteAttempts + 1);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.equal(await page.locator('[aria-label="盤面"] button.selected').count(), 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);

        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "ひとふくらみ", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
          key: saveKey, revision: before.rootRevision,
        });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(metrics.failedWriteAttempts, retryCounters.failedWriteAttempts);
        assert.equal(retried.activeMatch.state.hands.A.areaMicroBloom, 0);
        assert.deepEqual(retried.activeMatch.state.preparedOutgoing.sourceMacros, [27]);
      } finally {
        await context.close();
      }
    });
    await t.test("corner-bloom target cancel and reload are write-free", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installCornerBloomState(page);
        const cells = page.locator('[aria-label="盤面"] button');
        await cells.nth(27).click();
        const before = await persistedSnapshot(page);
        const counters = { ...metrics };
        await page.getByRole("button", { name: "角膨張", exact: true }).click();
        await page.getByRole("button", { name: "角膨張をキャンセル", exact: true }).click();
        assert.equal(await cells.nth(27).evaluate((cell) => cell.classList.contains("selected")), true);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, counters);
        await page.reload({ waitUntil: "load" });
        await assertHandoverIsPrivate(page);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, counters);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves areaCornerBloom exactly once", () => assertCornerBloomUse(browser, "pointer"));
    await t.test("Enter repeat resolves areaCornerBloom exactly once", () => assertCornerBloomUse(browser, "Enter"));
    await t.test("Space repeat resolves areaCornerBloom exactly once", () => assertCornerBloomUse(browser, " "));
    await t.test("areaCornerBloom candidate-zero rejects without write or consumption", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installCornerBloomState(page, true);
        const cells = page.locator('[aria-label="盤面"] button');
        await cells.nth(27).click();
        await page.getByRole("button", { name: "角膨張", exact: true }).click();
        const before = await persistedSnapshot(page);
        const counters = { ...metrics };
        await cells.nth(27).click();
        await page.getByText("操作できません（NO_CORNER_BLOOM_CANDIDATE）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal((await persistedRoot(page)).activeMatch.state.hands.A.areaCornerBloom, 1);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves areaTripleShift exactly once", () => assertTripleShiftUse(browser, "pointer"));
    await t.test("Enter repeat resolves areaTripleShift exactly once", () => assertTripleShiftUse(browser, "Enter"));
    await t.test("Space repeat resolves areaTripleShift exactly once", () => assertTripleShiftUse(browser, " "));
    await t.test("areaTripleShift invalid band and persistence retry remain atomic", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installTripleShiftState(page);
        await page.getByLabel("中央帯").fill("0");
        const invalidBefore = await persistedSnapshot(page);
        const invalidWrites = metrics.saveWrites;
        await page.getByRole("button", { name: "三層断層を確定", exact: true }).click();
        await page.getByText("操作できません（INVALID_SHIFT_BAND）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), invalidBefore);
        assert.equal(metrics.saveWrites, invalidWrites);

        await page.getByLabel("中央帯").fill("2");
        const before = await persistedSnapshot(page);
        const rawBefore = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "三層断層を確定", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), rawBefore);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "三層断層を確定", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(retried.activeMatch.state.hands.A.areaTripleShift, 0);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves disruptRandomOne exactly once", () => assertRandomSealUse(browser, "pointer"));
    await t.test("Enter repeat resolves disruptRandomOne exactly once", () => assertRandomSealUse(browser, "Enter"));
    await t.test("Space repeat resolves disruptRandomOne exactly once", () => assertRandomSealUse(browser, " "));
    await t.test("disruptRandomOne legal empty hit and persistence retry remain exact", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installRandomSealState(page, true);
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "色封じ・乱", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "色封じ・乱", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(retried.activeMatch.state.hands.A.disruptRandomOne, 0);
        assert.deepEqual(retried.activeMatch.state.publicEffects.B.seals, { red: 3, blue: 3, yellow: 3, green: 3 });
        assert.equal(retried.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 0x6d2b79f5) >>> 0);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves disruptRandomTwo exactly once", () => assertRandomTwoSealUse(browser, "pointer"));
    await t.test("Enter repeat resolves disruptRandomTwo exactly once", () => assertRandomTwoSealUse(browser, "Enter"));
    await t.test("Space repeat resolves disruptRandomTwo exactly once", () => assertRandomTwoSealUse(browser, " "));
    await t.test("disruptRandomTwo legal empty hit and persistence retry remain exact", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installRandomSealState(page, true, "disruptRandomTwo");
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "二重封じ・乱", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "二重封じ・乱", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(retried.activeMatch.state.hands.A.disruptRandomTwo, 0);
        assert.deepEqual(retried.activeMatch.state.publicEffects.B.seals, { red: 3, blue: 3, yellow: 3, green: 3 });
        assert.equal(retried.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 2 * 0x6d2b79f5) >>> 0);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves disruptChoiceTwo exactly once", () => assertChoiceSealUse(browser, "pointer"));
    await t.test("Enter repeat resolves disruptChoiceTwo exactly once", () => assertChoiceSealUse(browser, "Enter"));
    await t.test("Space repeat resolves disruptChoiceTwo exactly once", () => assertChoiceSealUse(browser, " "));
    await t.test("disruptChoiceTwo persistence retry keeps the same action ID and two-coloring duration", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installRandomSealState(page, true, "disruptChoiceTwo");
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "追封：赤", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "追封：赤", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(retried.activeMatch.state.hands.A.disruptChoiceTwo, 0);
        assert.deepEqual(retried.activeMatch.state.publicEffects.B.seals, { red: 3, blue: 3, yellow: 3, green: 3 });
        assert.deepEqual(retried.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves disruptChoiceThree exactly once", () => assertChoiceSealUse(browser, "pointer", "disruptChoiceThree", "長封：赤", 3));
    await t.test("Enter repeat resolves disruptChoiceThree exactly once", () => assertChoiceSealUse(browser, "Enter", "disruptChoiceThree", "長封：赤", 3));
    await t.test("Space repeat resolves disruptChoiceThree exactly once", () => assertChoiceSealUse(browser, " ", "disruptChoiceThree", "長封：赤", 3));
    await t.test("disruptChoiceThree persistence retry keeps the same action ID and three-coloring duration", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installRandomSealState(page, false, "disruptChoiceThree");
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "長封：赤", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "長封：赤", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(retried.activeMatch.state.hands.A.disruptChoiceThree, 0);
        assert.equal(retried.activeMatch.state.publicEffects.B.seals.red, 3);
        assert.deepEqual(retried.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves disruptPaletteRandom exactly once", () => assertPaletteRandomUse(browser, "pointer"));
    await t.test("Enter repeat resolves disruptPaletteRandom exactly once", () => assertPaletteRandomUse(browser, "Enter"));
    await t.test("Space repeat resolves disruptPaletteRandom exactly once", () => assertPaletteRandomUse(browser, " "));
    await t.test("disruptPaletteRandom remains target-private, restores after coloring, and retries the same ID", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installPaletteRandomState(page);
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "持ち色汚染・乱", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "持ち色汚染・乱", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        const corrupted = await persistedRoot(page);
        const effect = corrupted.activeMatch.state.privateEffects.B.paletteDebuffs[0];
        const originalColor = effect.previousColor;
        assert.equal(await page.getByText(/持ち色汚染中/).count(), 0);

        const cells = page.locator('[aria-label="盤面"] button');
        await cells.nth(26).click();
        await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
        await page.getByRole("heading", { name: "Player B・COLOR", exact: true }).waitFor();
        await page.getByRole("button", { name: "自分の情報を表示" }).click();
        await page.getByText("持ち色汚染中：残り1彩色", { exact: true }).waitFor();
        await page.getByRole("button", { name: new RegExp(`^${colorNames[effect.injectedColor]}`) }).first().click();
        const restored = await persistedRoot(page);
        const restoredPalette = [...restored.activeMatch.state.basicPalettes.B, restored.activeMatch.state.bonusColors.B];
        assert.equal(restoredPalette[effect.slot], originalColor);
        assert.equal(restored.activeMatch.state.privateEffects.B.paletteDebuffs, undefined);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves disruptPaletteChoice exactly once", () => assertPaletteChoiceUse(browser, "pointer"));
    await t.test("Enter repeat resolves disruptPaletteChoice exactly once", () => assertPaletteChoiceUse(browser, "Enter"));
    await t.test("Space repeat resolves disruptPaletteChoice exactly once", () => assertPaletteChoiceUse(browser, " "));
    await t.test("disruptPaletteChoice stays target-private, persists one coloring, and retries the same ID", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installPaletteRandomState(page, "disruptPaletteChoice");
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "汚染：赤", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "汚染：赤", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        const corrupted = await persistedRoot(page);
        const effect = corrupted.activeMatch.state.privateEffects.B.paletteDebuffs[0];
        assert.deepEqual({ color: effect.injectedColor, remaining: effect.remaining }, { color: "red", remaining: 2 });
        assert.equal(await page.getByText(/持ち色汚染中/).count(), 0);
        const cells = page.locator('[aria-label="盤面"] button');
        await cells.nth(26).click();
        await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
        await page.getByRole("heading", { name: "Player B・COLOR", exact: true }).waitFor();
        await page.getByRole("button", { name: "自分の情報を表示" }).click();
        await page.getByText("持ち色汚染中：残り2彩色", { exact: true }).waitFor();
        await page.getByRole("button", { name: /^赤/ }).first().click();
        const afterColor = await persistedRoot(page);
        assert.equal(afterColor.activeMatch.state.privateEffects.B.paletteDebuffs[0].remaining, 1);
        assert.equal([...afterColor.activeMatch.state.basicPalettes.B, afterColor.activeMatch.state.bonusColors.B][effect.slot], "red");
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves disruptForcedPalette exactly once", () => assertForcedPaletteUse(browser, "pointer"));
    await t.test("Enter repeat resolves disruptForcedPalette exactly once", () => assertForcedPaletteUse(browser, "Enter"));
    await t.test("Space repeat resolves disruptForcedPalette exactly once", () => assertForcedPaletteUse(browser, " "));
    await t.test("disruptForcedPalette is permanent, target-private, and retries the same action ID", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installPaletteRandomState(page, "disruptForcedPalette");
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "強制：赤", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "強制：赤", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        const forced = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(forced.activeMatch.state.hands.A.disruptForcedPalette, 0);
        assert.equal(forced.activeMatch.state.privateEffects.B.paletteDebuffs, undefined);
        assert.equal(forced.activeMatch.rngSnapshot["skill-effect"], (beforeRoot.activeMatch.rngSnapshot["skill-effect"] + 0x6d2b79f5) >>> 0);
        await page.reload({ waitUntil: "load" });
        await assertHandoverIsPrivate(page);
        assert.equal(await page.getByText(/持ち色汚染中/).count(), 0);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves areaDiePlus exactly once", () => assertDiePlusUse(browser, "pointer"));
    await t.test("Enter repeat resolves areaDiePlus exactly once", () => assertDiePlusUse(browser, "Enter"));
    await t.test("Space repeat resolves areaDiePlus exactly once", () => assertDiePlusUse(browser, " "));
    await t.test("areaDiePlus max rejection and persistence retry remain atomic", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installDiePlusState(page, 5);
        const maxBefore = await persistedSnapshot(page);
        const maxRoot = await persistedRoot(page);
        const maxCounters = { ...metrics };
        await page.getByRole("button", { name: "エリア拡張", exact: true }).click();
        await page.getByText("操作できません（AREA_SIZE_MAX）。", { exact: true }).waitFor();
        assert.deepEqual(await persistedSnapshot(page), maxBefore);
        assert.equal(metrics.saveWrites, maxCounters.saveWrites);
        assert.equal((await persistedRoot(page)).activeMatch.state.hands.A.areaDiePlus, 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, maxRoot.activeMatch.rngSnapshot);

        await installDiePlusState(page, 1);
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const rawBefore = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        const counters = { ...metrics };
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "エリア拡張", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), rawBefore);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.failedWriteAttempts, counters.failedWriteAttempts + 1);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);

        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "エリア拡張", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, {
          key: saveKey, revision: before.rootRevision,
        });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(metrics.failedWriteAttempts, retryCounters.failedWriteAttempts);
        assert.equal(retried.activeMatch.state.hands.A.areaDiePlus, 0);
        assert.equal(retried.activeMatch.state.requiredSize, 2);
        assert.deepEqual(retried.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
      } finally {
        await context.close();
      }
    });
    await t.test("resize selection cancel and reload are write-free", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installResizeState(page);
        const before = await persistedSnapshot(page);
        const counters = { ...metrics };
        await chooseResizeMode(page, "expand");
        await page.getByRole("button", { name: "拡大縮小をキャンセル", exact: true }).click();
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, counters);
        assert.equal(await page.getByRole("button", { name: "拡大縮小", exact: true }).count(), 1);

        await chooseResizeMode(page, "shrink");
        await page.reload({ waitUntil: "load" });
        await assertHandoverIsPrivate(page);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.deepEqual(metrics, counters);
        await page.getByRole("button", { name: "自分の情報を表示" }).click();
        assert.equal(await page.getByRole("button", { name: "拡大縮小をキャンセル", exact: true }).count(), 0);
      } finally {
        await context.close();
      }
    });
    await t.test("pointer double activation resolves areaResize exactly once", () => assertResizeUse(browser, "pointer"));
    await t.test("Enter repeat resolves areaResize exactly once", () => assertResizeUse(browser, "Enter"));
    await t.test("Space repeat resolves areaResize exactly once", () => assertResizeUse(browser, " "));
    await t.test("areaResize shrink keeps colored outside geometry visible and write-protected", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installResizeState(page);
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const beforeGeometry = JSON.stringify(beforeRoot.activeMatch.state.regions.R1);
        await chooseResizeMode(page, "shrink");
        await page.getByRole("button", { name: "左側を縮小", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        const afterRoot = await persistedRoot(page);
        assert.equal(afterRoot.activeMatch.state.playableBounds.minCol, 2);
        assert.equal(afterRoot.activeMatch.state.trophyTargetMacros.length, 100);
        assert.equal(JSON.stringify(afterRoot.activeMatch.state.regions.R1), beforeGeometry);
        assert.deepEqual(afterRoot.activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        const cell = page.locator('[aria-label="盤面"] button').nth(13);
        assert.equal(await cell.isDisabled(), true);
        assert.equal(await cell.evaluate((node) => node.classList.contains("red")), true);
        assert.equal(metrics.saveWrites > 0, true);
      } finally {
        await context.close();
      }
    });
    await t.test("areaResize persistence failure is byte-stable and retries the same action ID", async () => {
      const { context, page, metrics } = await newMeasuredPage(browser);
      try {
        await bootToAWork(page);
        await installResizeState(page);
        const before = await persistedSnapshot(page);
        const beforeRoot = await persistedRoot(page);
        const rawBefore = await page.evaluate((key) => localStorage.getItem(key), saveKey);
        const counters = { ...metrics };
        await chooseResizeMode(page, "expand");
        await page.evaluate(() => globalThis.__codexFailNextStandardWrite());
        await page.getByRole("button", { name: "上側を拡大", exact: true }).click();
        await page.getByText("操作できません（PERSISTENCE_FAILED）。", { exact: true }).waitFor();
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), rawBefore);
        assert.deepEqual(await persistedSnapshot(page), before);
        assert.equal(metrics.saveWrites, counters.saveWrites);
        assert.equal(metrics.failedWriteAttempts, counters.failedWriteAttempts + 1);
        assert.equal(metrics.generatedIds, counters.generatedIds + 1);
        assert.deepEqual((await persistedRoot(page)).activeMatch.rngSnapshot, beforeRoot.activeMatch.rngSnapshot);
        assert.equal(await page.getByRole("button", { name: "上側を拡大", exact: true }).count(), 1);

        await page.waitForTimeout(350);
        const retryCounters = { ...metrics };
        await page.getByRole("button", { name: "上側を拡大", exact: true }).click();
        await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).rootRevision === revision + 1, { key: saveKey, revision: before.rootRevision });
        const retried = await persistedRoot(page);
        assert.equal(metrics.generatedIds, retryCounters.generatedIds);
        assert.equal(metrics.saveWrites, retryCounters.saveWrites + 1);
        assert.equal(metrics.failedWriteAttempts, retryCounters.failedWriteAttempts);
        assert.equal(retried.activeMatch.state.hands.A.areaResize, 0);
        assert.equal(retried.activeMatch.state.playableBounds.minRow, 0);
      } finally {
        await context.close();
      }
    });
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
