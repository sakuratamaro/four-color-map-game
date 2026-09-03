"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
const saveKey = "fourColorMapGame.standard.v5.save";
const productBundle = fs.readFileSync(path.join(root, "standard-v5", "app.bundle.js"), "utf8");
const sessionNeedle = "const session = createStandardLocalSession({ storageAdapter: localStorage, clock: { now: () => new Date().toISOString() }, idFactory: makeId });";
const validRevealNeedle = "if (!reveal) return;";
const timerNeedle = "contactRevealTimer = setTimeout(() => {";
const dispatchNeedle = "const result = await session.dispatchAction({ actorSeat, type, payload });";
const handoverShowNeedle = "handover.hidden = false;";
const revealNeedle = "const result = session.revealPrivate(projection.seat);";
const privateClearNeedle = "clearPrivateDom(privatePanel);";
const publicRenderNeedle = "renderPublic(projection.publicState);";
const showContactNeedle = "function showContactReveal(contactColorCount) {";
const handleResolvedNeedle = "function handleResolved(result, actorSeat, terminalSessionContext) {";
const expectedRevisionNeedle = "expectedRootRevision: root.rootRevision,\n      expectedMatchVersion: root.activeMatch.state.version,";
const instrumentedBundle = productBundle
  .replace(sessionNeedle, `const session = createStandardLocalSession({ storageAdapter: localStorage, clock: { now: () => globalThis.__codexNow ?? new Date().toISOString() }, idFactory: makeId });\n  globalThis.__codexContactSession = session;`)
  .replace(validRevealNeedle, `${validRevealNeedle}\n    globalThis.__codexContactMetrics.presentationStarts += 1;`)
  .replace(timerNeedle, `globalThis.__codexContactMetrics.timerStarts += 1;\n    ${timerNeedle}`)
  .replace(handleResolvedNeedle, `globalThis.__codexShowContactReveal = showContactReveal;\n  globalThis.__codexClearContactReveal = clearContactReveal;\n\n  ${handleResolvedNeedle}`)
  .replace(dispatchNeedle, `globalThis.__codexContactMetrics.transactionCalls += 1;\n      globalThis.__codexContactMetrics.dispatchTrace.push({ type, actorSeat, generation: interactionGeneration, at: performance.now() });\n      const result = await (globalThis.__codexContactDelayMs > 0\n        ? new Promise((resolve) => setTimeout(() => resolve(session.dispatchAction({ actorSeat, type, payload })), globalThis.__codexContactDelayMs))\n        : session.dispatchAction({ actorSeat, type, payload }));\n      globalThis.__codexLastContactResult = JSON.parse(JSON.stringify(result));`)
  .replace(privateClearNeedle, `${privateClearNeedle}\n    globalThis.__codexContactMetrics.orderEvents.push({ name: "private-cleared", at: performance.now() });`)
  .replace(publicRenderNeedle, `${publicRenderNeedle}\n    globalThis.__codexContactMetrics.orderEvents.push({ name: "public-rendered", at: performance.now() });`)
  .replace(handoverShowNeedle, `globalThis.__codexContactMetrics.handoverShows += 1;\n    ${handoverShowNeedle}\n    globalThis.__codexContactMetrics.orderEvents.push({ name: "handover-visible", at: performance.now() });`)
  .replace(revealNeedle, `globalThis.__codexContactMetrics.revealClicks += 1;\n      ${revealNeedle}`)
  .replaceAll(expectedRevisionNeedle, "expectedRootRevision: globalThis.__codexExpectedRootRevision ?? root.rootRevision,\n      expectedMatchVersion: globalThis.__codexExpectedMatchVersion ?? root.activeMatch.state.version,");

assert.notEqual(instrumentedBundle, productBundle);
assert.equal(instrumentedBundle.includes("__codexContactSession"), true);
assert.equal(instrumentedBundle.includes("__codexContactMetrics.presentationStarts"), true);
assert.equal(instrumentedBundle.includes("__codexContactMetrics.timerStarts"), true);
assert.equal(instrumentedBundle.includes("__codexLastContactResult"), true);
assert.equal(instrumentedBundle.includes("__codexExpectedRootRevision"), true);
assert.equal(instrumentedBundle.includes('name: "private-cleared"'), true);
assert.equal(instrumentedBundle.includes('name: "public-rendered"'), true);
assert.equal(instrumentedBundle.includes('name: "handover-visible"'), true);
assert.equal(instrumentedBundle.includes("__codexShowContactReveal"), true);

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
    server.listen(0, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function installHarness(context) {
  await context.route("**/standard-v5/app.bundle.js", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: instrumentedBundle,
  }));
  await context.addInitScript((key) => {
    globalThis.__codexContactMetrics = {
      setItemAttempts: 0,
      saveWrites: 0,
      failedWrites: 0,
      generatedIds: 0,
      transactionCalls: 0,
      dispatchTrace: [],
      handoverShows: 0,
      revealClicks: 0,
      presentationStarts: 0,
      timerStarts: 0,
      domAdds: 0,
      domRemoves: 0,
      domAddedAt: [],
      domRemovedAt: [],
      orderEvents: [],
      liveSnapshots: [],
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function measuredSetItem(name, value) {
      if (name === key) {
        globalThis.__codexContactMetrics.setItemAttempts += 1;
        if (globalThis.__codexFailNextContactWrite) {
          globalThis.__codexFailNextContactWrite = false;
          globalThis.__codexContactMetrics.failedWrites += 1;
          throw new DOMException("Injected contact persistence failure", "QuotaExceededError");
        }
      }
      const result = originalSetItem.call(this, name, value);
      if (name === key) {
        globalThis.__codexContactMetrics.saveWrites += 1;
        globalThis.__codexContactMetrics.orderEvents.push({ name: "storage-success", at: performance.now() });
      }
      return result;
    };
    const originalRandomUUID = globalThis.crypto.randomUUID.bind(globalThis.crypto);
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value() {
        globalThis.__codexContactMetrics.generatedIds += 1;
        if (globalThis.__codexNextUuids?.length) return globalThis.__codexNextUuids.shift();
        if (globalThis.__codexNextUuid) {
          const fixed = globalThis.__codexNextUuid;
          globalThis.__codexNextUuid = null;
          return fixed;
        }
        return originalRandomUUID();
      },
    });
    globalThis.__codexContactTimerCallbacks = [];
    const originalSetTimeout = globalThis.setTimeout.bind(globalThis);
    globalThis.setTimeout = function measuredSetTimeout(callback, delay, ...args) {
      if (delay === 900) globalThis.__codexContactTimerCallbacks.push(callback);
      return originalSetTimeout(callback, delay, ...args);
    };
    addEventListener("DOMContentLoaded", () => {
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) if (node.nodeType === 1 && (node.id === "contactReveal" || node.querySelector?.("#contactReveal"))) {
            globalThis.__codexContactMetrics.domAdds += 1;
            globalThis.__codexContactMetrics.domAddedAt.push(performance.now());
            const layer = node.id === "contactReveal" ? node : node.querySelector("#contactReveal");
            const privatePanel = document.getElementById("privatePanel");
            const handover = document.getElementById("handover");
            const stored = JSON.parse(localStorage.getItem(key));
            const snapshot = {
              name: "contact-live-created",
              at: performance.now(),
              privateText: privatePanel.textContent,
              privateChildren: privatePanel.childElementCount,
              privateSignatureCount: document.querySelectorAll("[data-codex-private-signature]").length,
              handoverHidden: handover.hidden,
              revealClicks: globalThis.__codexContactMetrics.revealClicks,
              statusText: document.getElementById("status").textContent,
              pendingCells: document.querySelectorAll("#board .pending").length,
              pointerEvents: getComputedStyle(layer).pointerEvents,
              focusableCount: layer.querySelectorAll("button,a,input,select,textarea,[tabindex]:not([tabindex='-1'])").length,
              buttonCount: layer.querySelectorAll("button").length,
              dialogCount: layer.querySelectorAll('[role="dialog"]').length,
              activeInside: layer.contains(document.activeElement),
              saveWrites: globalThis.__codexContactMetrics.saveWrites,
              rootRevision: stored.rootRevision,
              matchVersion: stored.activeMatch.state.version,
              rng: JSON.stringify(stored.activeMatch.rngSnapshot),
            };
            globalThis.__codexContactMetrics.liveSnapshots.push(snapshot);
            globalThis.__codexContactMetrics.orderEvents.push({ name: snapshot.name, at: snapshot.at });
          }
          for (const node of record.removedNodes) if (node.nodeType === 1 && (node.id === "contactReveal" || node.querySelector?.("#contactReveal"))) {
            globalThis.__codexContactMetrics.domRemoves += 1;
            globalThis.__codexContactMetrics.domRemovedAt.push(performance.now());
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    }, { once: true });
  }, saveKey);
}

async function rootValue(page) {
  const payload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  assert.ok(payload);
  return JSON.parse(payload);
}

async function metrics(page) {
  return page.evaluate(() => ({ ...globalThis.__codexContactMetrics }));
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

async function disableOtherPresentation(page) {
  await page.getByLabel("🎲 Xマス演出").uncheck();
  await page.getByLabel("初期持ち色演出").uncheck();
}

async function reveal(page) {
  await page.getByRole("button", { name: "自分の情報を表示" }).click();
  await page.locator("#handover").waitFor({ state: "hidden" });
}

async function selectAndCommit(page, macros) {
  const cells = page.locator('[aria-label="盤面"] button');
  for (const macro of macros) await cells.nth(macro).click();
  await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
}

async function bootToBWork(page, baseUrl) {
  await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
  await page.waitForURL(`${baseUrl}/standard-v5/`);
  await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
  await disableOtherPresentation(page);
  await page.getByRole("button", { name: "標準α対戦を開始" }).click();
  await reveal(page);
  await selectAndCommit(page, [13, 14]);
  await page.getByText(/Turn 2・Player B・COLOR/).waitFor();
  await reveal(page);
  await page.getByRole("button", { name: "緑", exact: true }).first().click();
  await page.getByText(/Turn 2・Player B・WORK/).waitFor();
}

async function installTierState(page, tier) {
  const rootState = await rootValue(page);
  const state = rootState.activeMatch.state;
  const extras = [
    ["R2", 25, "blue"],
    ["R3", 27, "yellow"],
    ["R4", 38, "red"],
  ];
  for (const [id, macro, color] of extras.slice(0, Math.max(0, tier - 1))) state.regions[id] = regionForMacro(id, macro, color);
  standardMatch.validateStandardState(state);
  standardSave.validateStandardSave(rootState);
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: saveKey, payload: JSON.stringify(rootState) });
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
  await page.getByText(/Turn 2・Player B・WORK/).waitFor();
  await reveal(page);
}

function audit(rootState) {
  return {
    rootRevision: rootState.rootRevision,
    matchVersion: rootState.activeMatch.state.version,
    receipts: Object.keys(rootState.receipts.matchAction).length,
    rng: JSON.stringify(rootState.activeMatch.rngSnapshot),
  };
}

function privateVariantRoot(baseRoot, variant) {
  const rootState = JSON.parse(JSON.stringify(baseRoot));
  const state = rootState.activeMatch.state;
  for (const [id, macro, color] of [["R2", 25, "blue"], ["R3", 27, "yellow"], ["R4", 38, "red"]]) {
    state.regions[id] = regionForMacro(id, macro, color);
  }
  if (variant === "alternate-private") {
    for (const seat of ["A", "B"]) {
      const [first, second] = state.basicPalettes[seat];
      const bonus = state.bonusColors[seat];
      state.basicPalettes[seat] = [second, bonus];
      state.bonusColors[seat] = first;
      state.bonusUsesRemaining[seat] = seat === "A" ? 0 : 9;
      state.hands[seat] = { legalRecolor: seat === "A" ? 2 : 1 };
      state.loadouts[seat] = { experimental: ["legalRecolor"] };
      state.privateEffects[seat] = { secretToken: `${seat}-PRIVATE-VARIANT` };
      const participant = rootState.activeMatch.participants[seat];
      if (participant.type === "PROFILE") {
        for (const skillId of Object.keys(rootState.reservations[participant.profileId] || {})) {
          rootState.reservations[participant.profileId][skillId] = 0;
        }
      }
    }
  }
  standardMatch.validateStandardState(state);
  standardSave.validateStandardSave(rootState);
  return rootState;
}

async function assertNoPreActionLeak(page) {
  assert.equal(await page.locator("#contactReveal").count(), 0);
  const values = await page.locator("#board .selected,#commitRegion,#status,#notice").evaluateAll((nodes) => nodes.map((node) => ({
    text: node.textContent,
    className: node.className,
    title: node.getAttribute("title"),
    aria: node.getAttribute("aria-label"),
    data: [...node.attributes].filter((attribute) => attribute.name.startsWith("data-")).map((attribute) => [attribute.name, attribute.value]),
  })));
  assert.doesNotMatch(JSON.stringify(values), /contact-pressure|contactColorCount|二色接触|三色圧力|四色包囲/i);
}

async function assertTierPresentation(page, tier, beforeMetrics, beforeAudit) {
  await page.locator("#handover:not([hidden])").waitFor();
  await page.waitForTimeout(0);
  const afterMetrics = await metrics(page);
  const afterAudit = audit(await rootValue(page));
  assert.equal(afterMetrics.saveWrites, beforeMetrics.saveWrites + 1);
  assert.equal(afterMetrics.generatedIds, beforeMetrics.generatedIds + 1);
  assert.equal(afterAudit.rootRevision, beforeAudit.rootRevision + 1);
  assert.equal(afterAudit.matchVersion, beforeAudit.matchVersion + 1);
  assert.equal(afterAudit.receipts, beforeAudit.receipts + 1);
  assert.equal(afterAudit.rng, beforeAudit.rng);
  assert.equal(await page.locator("#privatePanel").textContent(), "");
  assert.equal(await page.locator("#privatePanel").locator(":scope > *").count(), 0);

  if (tier < 2) {
    assert.equal(await page.locator("#contactReveal").count(), 0);
    assert.equal(afterMetrics.presentationStarts, beforeMetrics.presentationStarts);
    assert.equal(afterMetrics.timerStarts, beforeMetrics.timerStarts);
    assert.equal(afterMetrics.domAdds, beforeMetrics.domAdds);
    return;
  }

  const expected = {
    2: ["二色接触！", "contact-pressure-2"],
    3: ["三色圧力!!", "contact-pressure-3"],
    4: ["四色包囲!!!", "contact-pressure-4"],
  }[tier];
  const layer = page.locator("#contactReveal");
  await layer.waitFor();
  assert.match(await layer.textContent(), new RegExp(expected[0]));
  assert.equal(await layer.getAttribute("role"), "status");
  assert.equal(await layer.getAttribute("aria-live"), "polite");
  assert.equal(await layer.getAttribute("aria-atomic"), "true");
  assert.equal(await layer.locator(`.${expected[1]}`).count(), 1);
  assert.equal(await layer.locator("button,[role=dialog],a,input,select,textarea,[tabindex]:not([tabindex='-1'])").count(), 0);
  assert.equal(await layer.evaluate((node) => getComputedStyle(node).pointerEvents), "none");
  assert.equal(afterMetrics.presentationStarts, beforeMetrics.presentationStarts + 1);
  assert.equal(afterMetrics.timerStarts, beforeMetrics.timerStarts + 1);
  assert.equal(afterMetrics.domAdds, beforeMetrics.domAdds + 1);
  await layer.waitFor({ state: "detached", timeout: 1500 });
  const finalMetrics = await metrics(page);
  assert.equal(finalMetrics.domRemoves, beforeMetrics.domRemoves + 1);
  const lifetimeMs = finalMetrics.domRemovedAt.at(-1) - finalMetrics.domAddedAt.at(-1);
  assert.ok(lifetimeMs >= 80 && lifetimeMs <= 1500, `unexpected contact presentation lifetime: ${lifetimeMs}`);
  assert.deepEqual(audit(await rootValue(page)), afterAudit);
  assert.equal(finalMetrics.saveWrites, afterMetrics.saveWrites);
}

async function runTier(browser, baseUrl, tier) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    if (tier === 0) {
      await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
      await page.waitForURL(`${baseUrl}/standard-v5/`);
      await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
      await disableOtherPresentation(page);
      await page.getByRole("button", { name: "標準α対戦を開始" }).click();
      await reveal(page);
      const beforeMetrics = await metrics(page);
      const beforeAudit = audit(await rootValue(page));
      await page.locator('[aria-label="盤面"] button').nth(13).click();
      await page.locator('[aria-label="盤面"] button').nth(14).click();
      await assertNoPreActionLeak(page);
      await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
      await assertTierPresentation(page, tier, beforeMetrics, beforeAudit);
      return;
    }

    await bootToBWork(page, baseUrl);
    if (tier > 1) await installTierState(page, tier);
    const beforeMetrics = await metrics(page);
    const beforeAudit = audit(await rootValue(page));
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await assertNoPreActionLeak(page);
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await assertTierPresentation(page, tier, beforeMetrics, beforeAudit);
  } finally {
    await context.close();
  }
}

async function runReloadNonReplay(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    await bootToBWork(page, baseUrl);
    await installTierState(page, 4);
    const beforeMetrics = await metrics(page);
    const beforeAudit = audit(await rootValue(page));
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.locator("#contactReveal").waitFor();
    const persisted = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    const persistedAudit = audit(JSON.parse(persisted));
    const afterActionMetrics = await metrics(page);
    assert.equal(afterActionMetrics.presentationStarts, beforeMetrics.presentationStarts + 1);
    assert.equal(afterActionMetrics.timerStarts, beforeMetrics.timerStarts + 1);
    assert.equal(persistedAudit.rootRevision, beforeAudit.rootRevision + 1);
    assert.equal(persistedAudit.matchVersion, beforeAudit.matchVersion + 1);

    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.locator("#handover:not([hidden])").waitFor();
    await page.waitForTimeout(100);

    assert.equal(await page.locator("#contactReveal").count(), 0);
    assert.equal(await page.locator("#privatePanel").textContent(), "");
    assert.equal(await page.locator("#privatePanel").locator(":scope > *").count(), 0);
    assert.equal(await page.getByRole("button", { name: "自分の情報を表示" }).count(), 1);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), persisted);
    assert.deepEqual(audit(await rootValue(page)), persistedAudit);
    const reloadMetrics = await metrics(page);
    assert.deepEqual({ ...reloadMetrics, orderEvents: reloadMetrics.orderEvents.map((event) => event.name) }, {
      setItemAttempts: 0,
      saveWrites: 0,
      failedWrites: 0,
      generatedIds: 0,
      transactionCalls: 0,
      dispatchTrace: [],
      handoverShows: 1,
      revealClicks: 0,
      presentationStarts: 0,
      timerStarts: 0,
      domAdds: 0,
      domRemoves: 0,
      domAddedAt: [],
      domRemovedAt: [],
      orderEvents: ["private-cleared", "public-rendered", "handover-visible"],
      liveSnapshots: [],
    });
  } finally {
    await context.close();
  }
}

async function runStorageFailureRetryAndDuplicate(browser, baseUrl, fixtureRoot) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  const fixedUuid = "00000000-0000-4000-8000-000000000042";
  const actionId = `action-${fixedUuid}`;
  const consoleMessages = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), {
      key: saveKey,
      payload: JSON.stringify(fixtureRoot),
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await assertNoPreActionLeak(page);
    const beforePayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    const beforeAudit = audit(JSON.parse(beforePayload));
    const beforeMetrics = await metrics(page);

    await page.evaluate((uuid) => {
      globalThis.__codexFailNextContactWrite = true;
      globalThis.__codexNextUuid = uuid;
    }, fixedUuid);
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.getByText(/PERSISTENCE_FAILED/).waitFor();
    const failed = await page.evaluate(() => globalThis.__codexLastContactResult);
    const failedMetrics = await metrics(page);
    assert.equal(failed.ok, false);
    assert.equal(failed.status, "REJECTED");
    assert.equal(failed.code, "PERSISTENCE_FAILED");
    assert.equal(failed.actionId, actionId);
    assert.equal(failed.appliedNow, false);
    assert.equal(failed.replayedReceipt, false);
    assert.equal(failed.contactColorCount, null);
    assert.equal(failedMetrics.setItemAttempts, beforeMetrics.setItemAttempts + 1);
    assert.equal(failedMetrics.saveWrites, beforeMetrics.saveWrites);
    assert.equal(failedMetrics.failedWrites, beforeMetrics.failedWrites + 1);
    assert.equal(failedMetrics.presentationStarts, beforeMetrics.presentationStarts);
    assert.equal(failedMetrics.timerStarts, beforeMetrics.timerStarts);
    assert.equal(failedMetrics.domAdds, beforeMetrics.domAdds);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforePayload);
    assert.deepEqual(audit(await rootValue(page)), beforeAudit);
    assert.equal(beforePayload.includes(actionId), false);
    assert.equal(await page.evaluate((id) => JSON.stringify({
      publicState: globalThis.__codexContactSession.getPublicProjection(),
      privateState: globalThis.__codexContactSession.revealPrivate("B"),
    }).includes(id), actionId), false);
    assert.equal((await page.locator("body").evaluate((body) => body.outerHTML)).includes(actionId), false);
    assert.equal(consoleMessages.some((message) => message.includes(actionId)), false);
    assert.equal(await page.locator("#handover").getAttribute("hidden"), "");
    assert.equal(await page.locator("#contactReveal").count(), 0);

    await page.waitForTimeout(350);
    await page.evaluate((uuid) => { globalThis.__codexNextUuid = uuid; }, fixedUuid);
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.locator("#handover:not([hidden])").waitFor();
    await page.locator("#contactReveal").waitFor();
    const succeeded = await page.evaluate(() => globalThis.__codexLastContactResult);
    const successMetrics = await metrics(page);
    const successAudit = audit(await rootValue(page));
    assert.equal(succeeded.ok, true);
    assert.equal(succeeded.status, "RESOLVED");
    assert.equal(succeeded.actionId, actionId);
    assert.equal(succeeded.appliedNow, true);
    assert.equal(succeeded.replayedReceipt, false);
    assert.equal(succeeded.contactColorCount, 4);
    assert.equal(successMetrics.setItemAttempts, beforeMetrics.setItemAttempts + 2);
    assert.equal(successMetrics.saveWrites, beforeMetrics.saveWrites + 1);
    assert.equal(successMetrics.presentationStarts, beforeMetrics.presentationStarts + 1);
    assert.equal(successMetrics.timerStarts, beforeMetrics.timerStarts + 1);
    assert.equal(successAudit.rootRevision, beforeAudit.rootRevision + 1);
    assert.equal(successAudit.matchVersion, beforeAudit.matchVersion + 1);
    assert.equal(successAudit.receipts, beforeAudit.receipts + 1);
    assert.equal(successAudit.rng, beforeAudit.rng);

    const duplicate = await page.evaluate(({ id }) => globalThis.__codexContactSession.dispatchAction({
      actorSeat: "B",
      type: "CREATE_REGION",
      payload: { sourceMacros: [26] },
      actionId: id,
    }), { id: actionId });
    const duplicateMetrics = await metrics(page);
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.status, "RESOLVED");
    assert.equal(duplicate.code, "IDEMPOTENT_REPLAY");
    assert.equal(duplicate.appliedNow, false);
    assert.equal(duplicate.replayedReceipt, true);
    assert.equal(duplicate.contactColorCount, null);
    assert.deepEqual(audit(await rootValue(page)), successAudit);
    assert.equal(duplicateMetrics.setItemAttempts, successMetrics.setItemAttempts);
    assert.equal(duplicateMetrics.saveWrites, successMetrics.saveWrites);
    assert.equal(duplicateMetrics.presentationStarts, successMetrics.presentationStarts);
    assert.equal(duplicateMetrics.timerStarts, successMetrics.timerStarts);
  } finally {
    await context.close();
  }
}

async function runRejectedOrStale(browser, baseUrl, fixtureRoot, scenario) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), {
      key: saveKey,
      payload: JSON.stringify(fixtureRoot),
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    const macros = scenario === "wrong-size" ? [] : scenario === "not-adjacent" ? [100] : [26];
    for (const macro of macros) await page.locator('[aria-label="盤面"] button').nth(macro).click();
    await assertNoPreActionLeak(page);
    const beforePayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    const beforeAudit = audit(JSON.parse(beforePayload));
    const beforeMetrics = await metrics(page);
    if (scenario === "stale-root") {
      await page.evaluate((revision) => { globalThis.__codexExpectedRootRevision = revision - 1; }, beforeAudit.rootRevision);
    }
    if (scenario === "stale-match") {
      await page.evaluate((version) => { globalThis.__codexExpectedMatchVersion = version - 1; }, beforeAudit.matchVersion);
    }
    const expectedCode = {
      "wrong-size": "WRONG_REGION_SIZE",
      "not-adjacent": "REGION_NOT_ADJACENT",
      "stale-root": "STALE_ROOT_REVISION",
      "stale-match": "STALE_MATCH_VERSION",
    }[scenario];
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.getByText(new RegExp(expectedCode)).waitFor();
    const result = await page.evaluate(() => globalThis.__codexLastContactResult);
    const afterMetrics = await metrics(page);
    assert.equal(result.ok, false);
    assert.equal(result.status, "REJECTED");
    assert.equal(result.code, expectedCode);
    assert.equal(result.appliedNow, false);
    assert.equal(result.replayedReceipt, false);
    assert.equal(result.contactColorCount, null);
    assert.equal(afterMetrics.setItemAttempts, beforeMetrics.setItemAttempts);
    assert.equal(afterMetrics.saveWrites, beforeMetrics.saveWrites);
    assert.equal(afterMetrics.presentationStarts, beforeMetrics.presentationStarts);
    assert.equal(afterMetrics.timerStarts, beforeMetrics.timerStarts);
    assert.equal(afterMetrics.domAdds, beforeMetrics.domAdds);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforePayload);
    assert.deepEqual(audit(await rootValue(page)), beforeAudit);
    assert.equal(await page.locator("#handover").getAttribute("hidden"), "");
    assert.equal(await page.locator("#contactReveal").count(), 0);
    const exposed = await page.locator("#notice,#status,#privatePanel").allTextContents();
    assert.doesNotMatch(exposed.join(" "), /contactColorCount|二色接触|三色圧力|四色包囲|contact-pressure/i);
  } finally {
    await context.close();
  }
}

async function runRetryIdentityLifecycle(browser, baseUrl, fixtureRoot, scenario) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  const failedUuid = scenario === "changed" ? "00000000-0000-4000-8000-000000000051" : "00000000-0000-4000-8000-000000000061";
  const nextUuid = scenario === "changed" ? "00000000-0000-4000-8000-000000000052" : "00000000-0000-4000-8000-000000000062";
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: saveKey, payload: JSON.stringify(fixtureRoot) });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    const cells = page.locator('[aria-label="盤面"] button');
    await cells.nth(26).click();
    const beforePayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    const beforeAudit = audit(JSON.parse(beforePayload));
    const beforeMetrics = await metrics(page);
    await page.evaluate((uuid) => {
      globalThis.__codexFailNextContactWrite = true;
      globalThis.__codexNextUuid = uuid;
    }, failedUuid);
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.getByText(/PERSISTENCE_FAILED/).waitFor();
    const failed = await page.evaluate(() => globalThis.__codexLastContactResult);
    assert.equal(failed.actionId, `action-${failedUuid}`);

    const mismatchBefore = await metrics(page);
    const mismatch = await page.evaluate(({ id }) => globalThis.__codexContactSession.dispatchAction({
      actorSeat: "B",
      type: "CREATE_REGION",
      payload: { sourceMacros: [37] },
      actionId: id,
    }), { id: failed.actionId });
    assert.equal(mismatch.code, "ACTION_ID_PAYLOAD_MISMATCH");
    assert.equal(mismatch.appliedNow, false);
    assert.equal(mismatch.replayedReceipt, false);
    assert.equal(mismatch.contactColorCount, null);
    assert.deepEqual(await metrics(page), mismatchBefore);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforePayload);

    await cells.nth(26).click();
    assert.equal(await page.locator("#board .selected").count(), 0);
    const targetMacro = scenario === "changed" ? 37 : 26;
    await cells.nth(targetMacro).click();
    const beforeRetry = await metrics(page);
    assert.equal(beforeRetry.setItemAttempts, beforeMetrics.setItemAttempts + 1);
    assert.equal(beforeRetry.saveWrites, beforeMetrics.saveWrites);
    assert.equal(beforeRetry.presentationStarts, beforeMetrics.presentationStarts);
    assert.equal(beforeRetry.timerStarts, beforeMetrics.timerStarts);
    assert.equal(await page.locator("#handover").getAttribute("hidden"), "");
    await page.waitForTimeout(350);
    await page.evaluate((uuid) => { globalThis.__codexNextUuid = uuid; }, nextUuid);
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.locator("#handover:not([hidden])").waitFor();
    await page.locator("#contactReveal").waitFor();
    const succeeded = await page.evaluate(() => globalThis.__codexLastContactResult);
    const afterMetrics = await metrics(page);
    const afterAudit = audit(await rootValue(page));
    assert.equal(succeeded.ok, true);
    assert.equal(succeeded.actionId, `action-${nextUuid}`);
    assert.notEqual(succeeded.actionId, failed.actionId);
    assert.notEqual(succeeded.code, "IDEMPOTENCY_KEY_REUSE");
    assert.equal(succeeded.contactColorCount, scenario === "changed" ? 2 : 4);
    assert.equal(afterMetrics.generatedIds, beforeMetrics.generatedIds + 2);
    assert.equal(afterMetrics.setItemAttempts, beforeMetrics.setItemAttempts + 2);
    assert.equal(afterMetrics.saveWrites, beforeMetrics.saveWrites + 1);
    assert.equal(afterMetrics.presentationStarts, beforeMetrics.presentationStarts + 1);
    assert.equal(afterMetrics.timerStarts, beforeMetrics.timerStarts + 1);
    assert.equal(afterAudit.rootRevision, beforeAudit.rootRevision + 1);
    assert.equal(afterAudit.matchVersion, beforeAudit.matchVersion + 1);
    assert.equal(afterAudit.receipts, beforeAudit.receipts + 1);
    assert.equal(afterAudit.rng, beforeAudit.rng);
  } finally {
    await context.close();
  }
}

async function runRepeatedCreateGesture(browser, baseUrl, fixtureRoot, gesture, iteration) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: saveKey, payload: JSON.stringify(fixtureRoot) });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    const beforeMetrics = await metrics(page);
    const beforeAudit = audit(await rootValue(page));
    const commit = page.getByRole("button", { name: "選んだエリアを渡す" });
    if (gesture === "pointer") {
      const box = await commit.boundingBox();
      assert.ok(box, `${gesture} ${iteration}: commit geometry`);
      await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2), { clickCount: 2, delay: 0 });
    } else {
      await commit.focus();
      const key = gesture === "enter" ? "Enter" : " ";
      await page.keyboard.down(key);
      await page.keyboard.down(key);
      await page.keyboard.up(key);
    }
    await page.locator("#handover:not([hidden])").waitFor();
    await page.locator("#contactReveal").waitFor();
    await page.waitForTimeout(50);
    const result = await page.evaluate(() => globalThis.__codexLastContactResult);
    const afterMetrics = await metrics(page);
    const afterAudit = audit(await rootValue(page));
    assert.equal(result.ok, true, `${gesture} ${iteration}: accepted`);
    assert.equal(result.contactColorCount, 4, `${gesture} ${iteration}: tier`);
    assert.equal(afterMetrics.generatedIds, beforeMetrics.generatedIds + 1, `${gesture} ${iteration}: action ID`);
    assert.equal(afterMetrics.transactionCalls, beforeMetrics.transactionCalls + 1, `${gesture} ${iteration}: transaction`);
    assert.equal(afterMetrics.setItemAttempts, beforeMetrics.setItemAttempts + 1, `${gesture} ${iteration}: write attempt`);
    assert.equal(afterMetrics.saveWrites, beforeMetrics.saveWrites + 1, `${gesture} ${iteration}: successful write`);
    assert.equal(afterMetrics.presentationStarts, beforeMetrics.presentationStarts + 1, `${gesture} ${iteration}: presentation`);
    assert.equal(afterAudit.rootRevision, beforeAudit.rootRevision + 1, `${gesture} ${iteration}: root revision`);
    assert.equal(afterAudit.matchVersion, beforeAudit.matchVersion + 1, `${gesture} ${iteration}: match version`);
    assert.equal(afterAudit.receipts, beforeAudit.receipts + 1, `${gesture} ${iteration}: receipt`);
    assert.equal(await page.locator("#handover:not([hidden])").count(), 1, `${gesture} ${iteration}: handover`);
    assert.equal(await page.locator("#privatePanel").textContent(), "", `${gesture} ${iteration}: no next-seat reveal`);
    assert.equal(await page.locator("#privatePanel").locator(":scope > *").count(), 0, `${gesture} ${iteration}: no old/new control activation`);
  } finally {
    await context.close();
  }
}

async function activateCreate(page, gesture, commit) {
  if (gesture === "pointer") {
    const box = await commit.boundingBox();
    assert.ok(box, "CREATE control geometry");
    await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2));
    return;
  }
  if (!(await commit.evaluate((control) => control === document.activeElement))) await commit.focus();
  await page.keyboard.press(gesture === "enter" ? "Enter" : " ");
}

async function runInflightCreate(browser, baseUrl, fixtureRoot, gesture) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: saveKey, payload: JSON.stringify(fixtureRoot) });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await page.evaluate(() => { globalThis.__codexContactDelayMs = 650; });
    const commit = page.getByRole("button", { name: "選んだエリアを渡す" });
    const beforeMetrics = await metrics(page);
    const beforeAudit = audit(await rootValue(page));
    await activateCreate(page, gesture, commit);
    await page.waitForTimeout(375);
    const inflightMetrics = await metrics(page);
    assert.equal(await commit.isDisabled(), true, `${gesture}: disabled while in flight`);
    assert.equal(await commit.getAttribute("aria-busy"), "true", `${gesture}: busy while in flight`);
    assert.equal(inflightMetrics.transactionCalls, beforeMetrics.transactionCalls + 1, `${gesture}: first transaction call`);
    assert.equal(inflightMetrics.generatedIds, beforeMetrics.generatedIds, `${gesture}: no second ID before persistence`);
    assert.equal(inflightMetrics.setItemAttempts, beforeMetrics.setItemAttempts, `${gesture}: persistence pending`);
    assert.equal(inflightMetrics.presentationStarts, beforeMetrics.presentationStarts, `${gesture}: no early presentation`);
    assert.equal(await page.locator("#handover").getAttribute("hidden"), "", `${gesture}: no early handover`);
    await activateCreate(page, gesture, commit);
    await page.locator("#handover:not([hidden])").waitFor({ timeout: 2000 });
    await page.locator("#contactReveal").waitFor();
    const afterMetrics = await metrics(page);
    const afterAudit = audit(await rootValue(page));
    assert.equal(afterMetrics.generatedIds, beforeMetrics.generatedIds + 1, `${gesture}: one action ID`);
    assert.equal(afterMetrics.transactionCalls, beforeMetrics.transactionCalls + 1, `${gesture}: one transaction`);
    assert.equal(afterMetrics.setItemAttempts, beforeMetrics.setItemAttempts + 1, `${gesture}: one attempt`);
    assert.equal(afterMetrics.saveWrites, beforeMetrics.saveWrites + 1, `${gesture}: one write`);
    assert.equal(afterMetrics.presentationStarts, beforeMetrics.presentationStarts + 1, `${gesture}: one presentation`);
    assert.equal(afterAudit.rootRevision, beforeAudit.rootRevision + 1, `${gesture}: root revision`);
    assert.equal(afterAudit.matchVersion, beforeAudit.matchVersion + 1, `${gesture}: match version`);
    assert.equal(afterAudit.receipts, beforeAudit.receipts + 1, `${gesture}: receipt`);
    assert.equal(await page.locator("#handover:not([hidden])").count(), 1, `${gesture}: one handover`);
    assert.equal(await page.locator("#privatePanel").textContent(), "", `${gesture}: private cleared`);
  } finally {
    await context.close();
  }
}

async function runInflightFailureRecovery(browser, baseUrl, fixtureRoot) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: saveKey, payload: JSON.stringify(fixtureRoot) });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await page.evaluate(() => {
      globalThis.__codexContactDelayMs = 650;
      globalThis.__codexFailNextContactWrite = true;
      globalThis.__codexNextUuid = "00000000-0000-4000-8000-000000000075";
    });
    const commit = page.getByRole("button", { name: "選んだエリアを渡す" });
    const beforePayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    const beforeAudit = audit(JSON.parse(beforePayload));
    const beforeMetrics = await metrics(page);
    await commit.click();
    await page.getByText(/PERSISTENCE_FAILED/).waitFor({ timeout: 2000 });
    const failed = await page.evaluate(() => globalThis.__codexLastContactResult);
    const failedMetrics = await metrics(page);
    assert.equal(failed.code, "PERSISTENCE_FAILED");
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforePayload);
    assert.deepEqual(audit(await rootValue(page)), beforeAudit);
    assert.equal(failedMetrics.generatedIds, beforeMetrics.generatedIds + 1);
    assert.equal(failedMetrics.transactionCalls, beforeMetrics.transactionCalls + 1);
    assert.equal(failedMetrics.setItemAttempts, beforeMetrics.setItemAttempts + 1);
    assert.equal(failedMetrics.saveWrites, beforeMetrics.saveWrites);
    assert.equal(failedMetrics.presentationStarts, beforeMetrics.presentationStarts);
    assert.equal(await page.locator("#handover").getAttribute("hidden"), "");
    assert.equal(await commit.isEnabled(), true);
    assert.equal(await commit.getAttribute("aria-busy"), null);

    await page.evaluate(() => { globalThis.__codexContactDelayMs = 0; });
    await commit.click();
    await page.locator("#handover:not([hidden])").waitFor();
    await page.locator("#contactReveal").waitFor();
    const succeeded = await page.evaluate(() => globalThis.__codexLastContactResult);
    const afterMetrics = await metrics(page);
    const afterAudit = audit(await rootValue(page));
    assert.equal(succeeded.ok, true);
    assert.equal(succeeded.actionId, failed.actionId);
    assert.equal(afterMetrics.generatedIds, beforeMetrics.generatedIds + 1);
    assert.equal(afterMetrics.transactionCalls, beforeMetrics.transactionCalls + 2);
    assert.equal(afterMetrics.setItemAttempts, beforeMetrics.setItemAttempts + 2);
    assert.equal(afterMetrics.saveWrites, beforeMetrics.saveWrites + 1);
    assert.equal(afterMetrics.presentationStarts, beforeMetrics.presentationStarts + 1);
    assert.equal(afterAudit.rootRevision, beforeAudit.rootRevision + 1);
    assert.equal(afterAudit.matchVersion, beforeAudit.matchVersion + 1);
    assert.equal(afterAudit.receipts, beforeAudit.receipts + 1);
  } finally {
    await context.close();
  }
}

async function runNextGenerationSequence(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/tests/fixtures/standard-v5-browser-bootstrap.html`, { waitUntil: "load" });
    await page.waitForURL(`${baseUrl}/standard-v5/`);
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await disableOtherPresentation(page);
    await page.getByRole("button", { name: "標準α対戦を開始" }).click();
    await reveal(page);
    const beforeMetrics = await metrics(page);
    const beforeAudit = audit(await rootValue(page));

    const cells = page.locator('[aria-label="盤面"] button');
    for (const macro of [13, 14]) await cells.nth(macro).click();
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.getByText(/Turn 2・Player B・COLOR/).waitFor();
    await page.locator("#handover:not([hidden])").waitFor();
    const afterA = await metrics(page);
    const afterAAudit = audit(await rootValue(page));
    assert.equal(afterA.transactionCalls, beforeMetrics.transactionCalls + 1);
    assert.equal(afterA.saveWrites, beforeMetrics.saveWrites + 1);
    assert.equal(afterA.handoverShows, beforeMetrics.handoverShows + 1);
    assert.equal(afterAAudit.rootRevision, beforeAudit.rootRevision + 1);
    assert.equal(afterAAudit.matchVersion, beforeAudit.matchVersion + 1);

    const beforeRevealPayload = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    await reveal(page);
    const afterReveal = await metrics(page);
    assert.equal(afterReveal.revealClicks, afterA.revealClicks + 1);
    assert.equal(afterReveal.saveWrites, afterA.saveWrites);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), beforeRevealPayload);
    assert.deepEqual(audit(await rootValue(page)), afterAAudit);

    await page.getByRole("button", { name: "緑", exact: true }).first().click();
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    const afterColor = await metrics(page);
    const afterColorAudit = audit(await rootValue(page));
    assert.equal(afterColor.transactionCalls, afterA.transactionCalls + 1);
    assert.equal(afterColor.saveWrites, afterA.saveWrites + 1);
    assert.equal(afterColor.handoverShows, afterA.handoverShows);
    assert.equal(afterColorAudit.rootRevision, afterAAudit.rootRevision + 1);
    assert.equal(afterColorAudit.matchVersion, afterAAudit.matchVersion + 1);

    const requiredSize = await page.evaluate(() => globalThis.__codexContactSession.getPublicProjection().requiredSize);
    assert.ok(Number.isInteger(requiredSize) && requiredSize >= 1 && requiredSize <= 6);
    const boxes = [];
    for (let index = 0; index < requiredSize; index += 1) boxes.push(await cells.nth(25 + index).boundingBox());
    for (const box of boxes) {
      assert.ok(box);
      await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2));
    }
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.locator("#status").getByText(/Player A・COLOR/).waitFor();
    await page.locator("#handover:not([hidden])").waitFor();
    const afterB = await metrics(page);
    const afterBAudit = audit(await rootValue(page));
    assert.equal(afterB.transactionCalls, beforeMetrics.transactionCalls + 3);
    assert.equal(afterB.generatedIds, beforeMetrics.generatedIds + 3);
    assert.equal(afterB.setItemAttempts, beforeMetrics.setItemAttempts + 3);
    assert.equal(afterB.saveWrites, beforeMetrics.saveWrites + 3);
    assert.equal(afterB.handoverShows, beforeMetrics.handoverShows + 2);
    assert.equal(afterB.revealClicks, beforeMetrics.revealClicks + 1);
    assert.equal(afterBAudit.rootRevision, beforeAudit.rootRevision + 3);
    assert.equal(afterBAudit.matchVersion, beforeAudit.matchVersion + 3);
    assert.equal(afterBAudit.receipts, beforeAudit.receipts + 3);
    const trace = afterB.dispatchTrace.slice(beforeMetrics.dispatchTrace.length);
    assert.deepEqual(trace.map(({ type, actorSeat }) => [type, actorSeat]), [
      ["CREATE_REGION", "A"],
      ["COLOR_REGION", "B"],
      ["CREATE_REGION", "B"],
    ]);
    assert.equal(new Set(trace.map(({ generation }) => generation)).size, 3);
    assert.ok(trace.every(({ at }) => Number.isFinite(at)));
    assert.ok(trace[0].at <= trace[1].at && trace[1].at <= trace[2].at);
    assert.equal(await page.locator("#privatePanel").textContent(), "");
    assert.equal(await page.locator("#privatePanel").locator(":scope > *").count(), 0);
  } finally {
    await context.close();
  }
}

async function runPrivateVariant(browser, baseUrl, fixtureRoot) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), {
      key: saveKey,
      payload: JSON.stringify(fixtureRoot),
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    const beforeMetrics = await metrics(page);
    const beforeAudit = audit(await rootValue(page));
    await page.evaluate(() => { globalThis.__codexNextUuid = "00000000-0000-4000-8000-000000000026"; });
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await assertNoPreActionLeak(page);
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.locator("#contactReveal").waitFor();
    const result = await page.evaluate(() => globalThis.__codexLastContactResult);
    const layer = page.locator("#contactReveal");
    const afterMetrics = await metrics(page);
    const afterAudit = audit(await rootValue(page));
    const summary = {
      accepted: result.ok,
      status: result.status,
      code: result.code,
      actionId: result.actionId,
      resultKeys: Object.keys(result).sort(),
      appliedNow: result.appliedNow,
      replayedReceipt: result.replayedReceipt,
      contactColorCount: result.contactColorCount,
      publicHash: crypto.createHash("sha256").update(JSON.stringify(result.projection.publicState)).digest("hex"),
      handoverSeat: result.projection.seat,
      phase: result.projection.publicState.phase,
      text: await layer.textContent(),
      className: await layer.locator(".contact-pressure-4").getAttribute("class"),
      role: await layer.getAttribute("role"),
      ariaLive: await layer.getAttribute("aria-live"),
      ariaAtomic: await layer.getAttribute("aria-atomic"),
      domAdds: afterMetrics.domAdds - beforeMetrics.domAdds,
      timerStarts: afterMetrics.timerStarts - beforeMetrics.timerStarts,
      rootDelta: afterAudit.rootRevision - beforeAudit.rootRevision,
      matchDelta: afterAudit.matchVersion - beforeAudit.matchVersion,
      receiptDelta: afterAudit.receipts - beforeAudit.receipts,
      rngChanged: afterAudit.rng !== beforeAudit.rng,
    };
    await layer.waitFor({ state: "detached", timeout: 1500 });
    const finalMetrics = await metrics(page);
    const lifetime = finalMetrics.domRemovedAt.at(-1) - finalMetrics.domAddedAt.at(-1);
    summary.lifetimeBucket = lifetime >= 80 && lifetime <= 1500 ? "BOUNDED" : "OUT_OF_RANGE";
    return summary;
  } finally {
    await context.close();
  }
}

async function runHandoverContactOrdering(browser, baseUrl, fixtureRoot) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), {
      key: saveKey,
      payload: JSON.stringify(fixtureRoot),
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    await page.locator("#privatePanel").evaluate((panel) => {
      const signature = document.createElement("span");
      signature.dataset.codexPrivateSignature = "previous-seat";
      signature.textContent = "PREVIOUS-SEAT-PRIVATE-SIGNATURE";
      panel.appendChild(signature);
    });

    const beforeMetrics = await metrics(page);
    const beforeAudit = audit(await rootValue(page));
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    await page.locator("#contactReveal").waitFor();
    await page.waitForTimeout(0);

    const afterMetrics = await metrics(page);
    const afterAudit = audit(await rootValue(page));
    const events = afterMetrics.orderEvents.slice(beforeMetrics.orderEvents.length);
    const names = events.map((event) => event.name);
    const storageIndex = names.indexOf("storage-success");
    const privateIndex = names.indexOf("private-cleared", storageIndex + 1);
    const publicIndex = names.indexOf("public-rendered", privateIndex + 1);
    const handoverIndex = names.indexOf("handover-visible", publicIndex + 1);
    const contactIndex = names.indexOf("contact-live-created", handoverIndex + 1);
    assert.ok(storageIndex >= 0, `missing storage success: ${names.join(", ")}`);
    assert.ok(privateIndex > storageIndex, `private was not cleared after storage: ${names.join(", ")}`);
    assert.ok(publicIndex > privateIndex, `public board was not rendered after private clear: ${names.join(", ")}`);
    assert.ok(handoverIndex > publicIndex, `HANDOVER was not visible after public render: ${names.join(", ")}`);
    assert.ok(contactIndex > handoverIndex, `contact live region was not observed last: ${names.join(", ")}`);

    const snapshot = afterMetrics.liveSnapshots.at(-1);
    assert.ok(snapshot);
    assert.equal(snapshot.privateText, "");
    assert.equal(snapshot.privateChildren, 0);
    assert.equal(snapshot.privateSignatureCount, 0);
    assert.equal(snapshot.handoverHidden, false);
    assert.equal(snapshot.revealClicks, beforeMetrics.revealClicks);
    assert.match(snapshot.statusText, /Player A・COLOR/);
    assert.ok(snapshot.pendingCells > 0);
    assert.equal(snapshot.pointerEvents, "none");
    assert.equal(snapshot.focusableCount, 0);
    assert.equal(snapshot.buttonCount, 0);
    assert.equal(snapshot.dialogCount, 0);
    assert.equal(snapshot.activeInside, false);
    assert.equal(snapshot.saveWrites, beforeMetrics.saveWrites + 1);
    assert.equal(snapshot.rootRevision, beforeAudit.rootRevision + 1);
    assert.equal(snapshot.matchVersion, beforeAudit.matchVersion + 1);
    assert.equal(snapshot.rng, beforeAudit.rng);
    assert.equal(afterMetrics.revealClicks, beforeMetrics.revealClicks);
    assert.equal(afterMetrics.saveWrites, snapshot.saveWrites);
    assert.deepEqual(afterAudit, {
      ...beforeAudit,
      rootRevision: beforeAudit.rootRevision + 1,
      matchVersion: beforeAudit.matchVersion + 1,
      receipts: beforeAudit.receipts + 1,
    });

    await page.waitForTimeout(100);
    const settledMetrics = await metrics(page);
    assert.equal(settledMetrics.saveWrites, snapshot.saveWrites);
    assert.equal(settledMetrics.revealClicks, beforeMetrics.revealClicks);
    assert.deepEqual(audit(await rootValue(page)), afterAudit);
  } finally {
    await context.close();
  }
}

async function runContactTimerReplacement(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await bootToBWork(page, baseUrl);
    await installTierState(page, 2);
    const beforeMetrics = await metrics(page);
    const beforeAudit = audit(await rootValue(page));
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    const layer = page.locator("#contactReveal");
    await layer.waitFor();
    assert.match(await layer.textContent(), /二色接触！/);
    assert.equal(await layer.locator(".contact-pressure-2").count(), 1);
    assert.equal(await page.evaluate(() => globalThis.__codexContactTimerCallbacks.length), 1);
    await page.waitForTimeout(100);
    assert.equal(await layer.count(), 1);

    await page.evaluate(() => globalThis.__codexShowContactReveal(4));
    assert.equal(await layer.count(), 1);
    assert.match(await layer.textContent(), /四色包囲!!!/);
    assert.equal(await layer.locator(".contact-pressure-4").count(), 1);
    assert.equal(await page.evaluate(() => globalThis.__codexContactTimerCallbacks.length), 2);

    await page.waitForTimeout(350);
    await page.evaluate(() => globalThis.__codexContactTimerCallbacks[0]());
    assert.equal(await layer.count(), 1);
    assert.match(await layer.textContent(), /四色包囲!!!/);
    assert.equal(await layer.locator(".contact-pressure-4").count(), 1);
    assert.equal((await metrics(page)).domAdds - beforeMetrics.domAdds, 1);

    await page.waitForTimeout(100);
    assert.equal(await layer.count(), 1);
    assert.match(await layer.textContent(), /四色包囲!!!/);
    await layer.waitFor({ state: "detached", timeout: 1500 });
    assert.equal(await page.locator("#contactReveal").count(), 0);
    assert.equal(pageErrors.length, 0);
    const afterMetrics = await metrics(page);
    assert.equal(afterMetrics.saveWrites, beforeMetrics.saveWrites + 1);
    assert.deepEqual(audit(await rootValue(page)), {
      ...beforeAudit,
      rootRevision: beforeAudit.rootRevision + 1,
      matchVersion: beforeAudit.matchVersion + 1,
      receipts: beforeAudit.receipts + 1,
    });
  } finally {
    await context.close();
  }
}

async function makeSettledFixture(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  try {
    await bootToBWork(page, baseUrl);
    await page.getByRole("button", { name: "投了" }).click();
    await page.locator("#terminalWinner").getByText("Alice の勝利").waitFor();
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).activeMatch?.settlement?.settled === true, saveKey);
    return await rootValue(page);
  } finally {
    await context.close();
  }
}

async function runNewMatchCleanupVariant(browser, baseUrl, fixtureRoot, withPresentation) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), {
      key: saveKey,
      payload: JSON.stringify(fixtureRoot),
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.locator("#terminalWinner").getByText("Alice の勝利").waitFor();
    const revealSkip = page.getByRole("button", { name: "次へ" });
    if (await revealSkip.isVisible()) await revealSkip.click();
    await disableOtherPresentation(page);
    await page.evaluate(() => {
      const setup = globalThis.__codexContactSession.getSetupProjection();
      const profileA = document.getElementById("profileA");
      const profileB = document.getElementById("profileB");
      for (const profile of setup.profiles) {
        for (const select of [profileA, profileB]) {
          const option = document.createElement("option");
          option.value = profile.profileId;
          option.textContent = profile.displayName;
          select.appendChild(option);
        }
      }
      profileB.selectedIndex = 1;
      document.getElementById("startMatch").disabled = false;
      globalThis.__codexNow = "2026-08-31T05:30:00.000Z";
      globalThis.__codexNextUuids = [
        "00000000-0000-4000-8000-000000000101",
        "00000000-0000-4000-8000-000000000102",
      ];
    });

    let staleTimerIndex = null;
    if (withPresentation) {
      await page.evaluate(() => globalThis.__codexShowContactReveal(4));
      await page.locator("#contactReveal").waitFor();
      staleTimerIndex = await page.evaluate(() => globalThis.__codexContactTimerCallbacks.length - 1);
    }
    const before = await metrics(page);
    await page.getByRole("button", { name: "標準α対戦を開始" }).click();
    await page.waitForFunction(() => document.querySelectorAll("#contactReveal").length === 0);
    await page.waitForTimeout(0);
    assert.equal(await page.locator("#contactReveal").count(), 0);
    const saved = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    const screen = await page.evaluate(() => ({
      handoverHidden: document.getElementById("handover").hidden,
      handoverSeat: document.getElementById("handoverSeat").textContent,
      privateText: document.getElementById("privatePanel").textContent,
      statusText: document.getElementById("status").textContent,
      noticeText: document.getElementById("notice").textContent,
      contactCount: document.querySelectorAll("#contactReveal").length,
    }));
    if (staleTimerIndex !== null) {
      await page.evaluate((index) => globalThis.__codexContactTimerCallbacks[index](), staleTimerIndex);
      assert.equal(await page.locator("#contactReveal").count(), 0);
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), saveKey), saved);
    }
    const after = await metrics(page);
    assert.equal(after.saveWrites, before.saveWrites + 1);
    assert.equal(pageErrors.length, 0);
    return { saved, screen, writes: after.saveWrites - before.saveWrites };
  } finally {
    await context.close();
  }
}

async function runReducedMotionVariant(browser, baseUrl, fixtureRoot, reducedMotion) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await installHarness(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion });
    await page.goto(`${baseUrl}/standard-v5/`, { waitUntil: "load" });
    await disableOtherPresentation(page);
    await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), {
      key: saveKey,
      payload: JSON.stringify(fixtureRoot),
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__codexContactSession));
    await page.getByText(/Turn 2・Player B・WORK/).waitFor();
    await reveal(page);
    const beforeMetrics = await metrics(page);
    await page.evaluate(() => { globalThis.__codexNextUuid = "00000000-0000-4000-8000-000000000125"; });
    await page.locator('[aria-label="盤面"] button').nth(26).click();
    await page.getByRole("button", { name: "選んだエリアを渡す" }).click();
    const layer = page.locator("#contactReveal");
    await layer.waitFor();
    const card = layer.locator(".contact-pressure-4");
    const motion = await card.evaluate((node) => {
      const animations = node.getAnimations().map((animation) => ({
        name: animation.animationName || "",
        iterations: animation.effect.getTiming().iterations,
        duration: animation.effect.getTiming().duration,
        keyframes: animation.effect.getKeyframes().map((frame) => ({
          offset: frame.offset,
          opacity: frame.opacity,
          transform: frame.transform,
        })),
      }));
      return { animations, computedTransform: getComputedStyle(node).transform };
    });
    assert.equal(motion.animations.length, 1);
    assert.equal(motion.animations[0].iterations, 1);
    assert.ok(Number.isFinite(motion.animations[0].duration));
    if (reducedMotion === "reduce") {
      assert.equal(motion.animations[0].name, "contact-fade");
      assert.ok(motion.animations[0].keyframes.every((frame) => !frame.transform || frame.transform === "none" || frame.transform === "matrix(1, 0, 0, 1, 0, 0)"));
    } else {
      assert.equal(motion.animations[0].name, "contact-pop");
      assert.ok(motion.animations[0].keyframes.some((frame) => frame.transform && !["none", "matrix(1, 0, 0, 1, 0, 0)", "scale(1)"].includes(frame.transform)));
    }
    assert.match(await layer.textContent(), /四色包囲!!!/);
    assert.equal(await layer.getAttribute("role"), "status");
    assert.equal(await layer.getAttribute("aria-live"), "polite");
    assert.equal(await layer.getAttribute("aria-atomic"), "true");
    assert.equal(await layer.evaluate((node) => getComputedStyle(node).pointerEvents), "none");
    assert.equal(await layer.locator("button,a,input,select,textarea,[tabindex]:not([tabindex='-1'])").count(), 0);
    assert.equal(await layer.evaluate((node) => node.contains(document.activeElement)), false);

    const result = await page.evaluate(() => globalThis.__codexLastContactResult);
    const saved = await page.evaluate((key) => localStorage.getItem(key), saveKey);
    assert.doesNotMatch(saved, /contactPresentationGeneration/);
    const parsed = JSON.parse(saved);
    const afterMetrics = await metrics(page);
    const summary = {
      accepted: result.ok,
      resultKeys: Object.keys(result).sort(),
      appliedNow: result.appliedNow,
      replayedReceipt: result.replayedReceipt,
      contactColorCount: result.contactColorCount,
      tierClass: await card.getAttribute("class"),
      publicHash: crypto.createHash("sha256").update(JSON.stringify(result.projection.publicState)).digest("hex"),
      saved,
      rootRevision: parsed.rootRevision,
      matchVersion: parsed.activeMatch.state.version,
      rngHash: crypto.createHash("sha256").update(JSON.stringify(parsed.activeMatch.rngSnapshot)).digest("hex"),
      active: parsed.activeMatch.state.active,
      phase: parsed.activeMatch.state.phase,
      hand: parsed.activeMatch.state.hands,
      inventory: parsed.profiles,
      reservations: parsed.reservations,
      actionReceipt: parsed.receipts.matchAction,
      handoverSeat: result.projection.seat,
      writes: afterMetrics.saveWrites - beforeMetrics.saveWrites,
      presentations: afterMetrics.presentationStarts - beforeMetrics.presentationStarts,
      timers: afterMetrics.timerStarts - beforeMetrics.timerStarts,
    };
    await layer.waitFor({ state: "detached", timeout: 1500 });
    assert.equal(await page.locator("#contactReveal").count(), 0);
    assert.equal(pageErrors.length, 0);
    return summary;
  } finally {
    await context.close();
  }
}

test("contact-pressure tiers use the normal browser transaction path", { skip: !chromium || !installedBrowserExecutable() }, async (t) => {
  const { server, baseUrl } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: installedBrowserExecutable() });
    for (let tier = 0; tier <= 4; tier += 1) await t.test(`tier ${tier}`, () => runTier(browser, baseUrl, tier));
    await t.test("reload does not replay a persisted contact presentation", () => runReloadNonReplay(browser, baseUrl));
    await t.test("private state substitution cannot change public contact presentation", async () => {
      const setupContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      await installHarness(setupContext);
      const setupPage = await setupContext.newPage();
      let baseRoot;
      try {
        await bootToBWork(setupPage, baseUrl);
        baseRoot = await rootValue(setupPage);
      } finally {
        await setupContext.close();
      }
      const baseline = await runPrivateVariant(browser, baseUrl, privateVariantRoot(baseRoot, "baseline"));
      const alternate = await runPrivateVariant(browser, baseUrl, privateVariantRoot(baseRoot, "alternate-private"));
      assert.deepEqual(alternate, baseline);
    });
    await t.test("storage failure retries the same action ID once and duplicate replay is presentation-free", async () => {
      const setupContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      await installHarness(setupContext);
      const setupPage = await setupContext.newPage();
      let baseRoot;
      try {
        await bootToBWork(setupPage, baseUrl);
        baseRoot = await rootValue(setupPage);
      } finally {
        await setupContext.close();
      }
      await runStorageFailureRetryAndDuplicate(browser, baseUrl, privateVariantRoot(baseRoot, "baseline"));
    });
    await t.test("rejected and stale CREATE results keep contact metadata private", async (contactTest) => {
      const setupContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      await installHarness(setupContext);
      const setupPage = await setupContext.newPage();
      let fixtureRoot;
      try {
        await bootToBWork(setupPage, baseUrl);
        fixtureRoot = privateVariantRoot(await rootValue(setupPage), "baseline");
      } finally {
        await setupContext.close();
      }
      for (const scenario of ["wrong-size", "not-adjacent", "stale-root", "stale-match"]) {
        await contactTest.test(scenario, () => runRejectedOrStale(browser, baseUrl, fixtureRoot, scenario));
      }
    });
    await t.test("failed action identity is discarded after payload change or selection cancel", async (identityTest) => {
      const setupContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      await installHarness(setupContext);
      const setupPage = await setupContext.newPage();
      let fixtureRoot;
      try {
        await bootToBWork(setupPage, baseUrl);
        fixtureRoot = privateVariantRoot(await rootValue(setupPage), "baseline");
      } finally {
        await setupContext.close();
      }
      await identityTest.test("changed payload", () => runRetryIdentityLifecycle(browser, baseUrl, fixtureRoot, "changed"));
      await identityTest.test("selection cancel", () => runRetryIdentityLifecycle(browser, baseUrl, fixtureRoot, "cancel"));
    });
    await t.test("tier-4 CREATE is one-shot for repeated native input", async (inputTest) => {
      const setupContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      await installHarness(setupContext);
      const setupPage = await setupContext.newPage();
      let fixtureRoot;
      try {
        await bootToBWork(setupPage, baseUrl);
        fixtureRoot = privateVariantRoot(await rootValue(setupPage), "baseline");
      } finally {
        await setupContext.close();
      }
      for (const gesture of ["pointer", "enter", "space"]) {
        for (let iteration = 1; iteration <= 5; iteration += 1) {
          await inputTest.test(`${gesture} ${iteration}/5`, () => runRepeatedCreateGesture(browser, baseUrl, fixtureRoot, gesture, iteration));
        }
      }
    });
    await t.test("650ms CREATE keeps the in-flight lock beyond the 300ms guard", async (inflightTest) => {
      const setupContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      await installHarness(setupContext);
      const setupPage = await setupContext.newPage();
      let fixtureRoot;
      try {
        await bootToBWork(setupPage, baseUrl);
        fixtureRoot = privateVariantRoot(await rootValue(setupPage), "baseline");
      } finally {
        await setupContext.close();
      }
      for (const gesture of ["pointer", "enter", "space"]) {
        await inflightTest.test(gesture, () => runInflightCreate(browser, baseUrl, fixtureRoot, gesture));
      }
      await inflightTest.test("failed persistence releases the lock and retries the same ID", () => runInflightFailureRecovery(browser, baseUrl, fixtureRoot));
    });
    await t.test("the next interaction generation accepts the next player's normal sequence", () => runNextGenerationSequence(browser, baseUrl));
    await t.test("HANDOVER is safe before the contact live region is observed", async () => {
      const setupContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      await installHarness(setupContext);
      const setupPage = await setupContext.newPage();
      let fixtureRoot;
      try {
        await bootToBWork(setupPage, baseUrl);
        fixtureRoot = privateVariantRoot(await rootValue(setupPage), "baseline");
      } finally {
        await setupContext.close();
      }
      await runHandoverContactOrdering(browser, baseUrl, fixtureRoot);
    });
    await t.test("a stale presentation timer cannot remove the replacement tier", () => runContactTimerReplacement(browser, baseUrl));
    await t.test("new-match cleanup is identical with and without a pending contact presentation", async () => {
      const fixtureRoot = await makeSettledFixture(browser, baseUrl);
      const withPresentation = await runNewMatchCleanupVariant(browser, baseUrl, fixtureRoot, true);
      const withoutPresentation = await runNewMatchCleanupVariant(browser, baseUrl, fixtureRoot, false);
      assert.deepEqual(withPresentation, withoutPresentation);
    });
    await t.test("reduced motion changes only contact animation, not game state", async () => {
      const setupContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
      await installHarness(setupContext);
      const setupPage = await setupContext.newPage();
      let fixtureRoot;
      try {
        await bootToBWork(setupPage, baseUrl);
        fixtureRoot = privateVariantRoot(await rootValue(setupPage), "baseline");
      } finally {
        await setupContext.close();
      }
      const normal = await runReducedMotionVariant(browser, baseUrl, fixtureRoot, "no-preference");
      const reduced = await runReducedMotionVariant(browser, baseUrl, fixtureRoot, "reduce");
      assert.deepEqual(reduced, normal);
    });
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
