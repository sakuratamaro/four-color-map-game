"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

let chromium;
try { ({ chromium } = require("playwright")); } catch { /* explicit actual-browser gate */ }

const root = path.resolve(__dirname, "..");
const BROWSER_PATHS = Object.freeze({
  edge: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  chrome: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const browserName = process.env.STANDARD_BROWSER || "edge";
if (!Object.hasOwn(BROWSER_PATHS, browserName)) throw new Error("STANDARD_BROWSER must be edge or chrome");
const browserPath = BROWSER_PATHS[browserName];
const productHtml = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const scriptStart = productHtml.indexOf('  <script src="standard-online-client.js');
assert.ok(scriptStart > 0);
const fixtureHtml = `${productHtml.slice(0, scriptStart)}
  <script src="basic-feedback.js?v=20260908-1"></script>
  <script>
    globalThis.__feedbackController = globalThis.FourColorStandardBasicFeedback.createBasicFeedbackController({
      storage: localStorage, documentRef: document, navigatorRef: navigator, globalRef: globalThis,
    });
    globalThis.__feedbackController.bindControls({
      soundInput: document.querySelector("#soundEffectsEnabled"),
      vibrationInput: document.querySelector("#vibrationEnabled"),
      status: document.querySelector("#feedbackSettingsStatus"),
    });
    globalThis.__feedbackController.installGestureUnlock(document);
    addEventListener("storage", (event) => globalThis.__feedbackController.handleStorageEvent(event));
  </script>
</body>
</html>`;

function startServer() {
  return new Promise((resolve, reject) => {
    const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      if (pathname === "/standard-online-v5/feedback-fixture.html") {
        response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mime[".html"] });
        response.end(fixtureHtml);
        return;
      }
      const target = path.resolve(root, pathname.replace(/^\/+/, ""));
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end("Forbidden");
      fs.readFile(target, (error, body) => {
        if (error) return response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
        response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mime[path.extname(target)] || "application/octet-stream" });
        response.end(body);
      });
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/standard-online-v5/feedback-fixture.html` }));
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

async function installPresentationFakes(context) {
  await context.addInitScript(() => {
    globalThis.__feedbackAudio = { contexts: 0, notes: [], starts: 0, stops: 0, fail: false };
    globalThis.__feedbackVibrations = [];
    class FakeAudioContext {
      constructor() {
        globalThis.__feedbackAudio.contexts += 1;
        this.currentTime = 3;
        this.destination = {};
        this.state = "running";
      }
      createOscillator() {
        if (globalThis.__feedbackAudio.fail) throw new Error("AUDIO_TEST_FAILURE");
        return {
          type: "",
          frequency: { setValueAtTime(value) { globalThis.__feedbackAudio.notes.push(value); } },
          connect() {},
          start() { globalThis.__feedbackAudio.starts += 1; },
          stop() { globalThis.__feedbackAudio.stops += 1; },
        };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
      }
      resume() { this.state = "running"; return Promise.resolve(); }
      suspend() { this.state = "suspended"; return Promise.resolve(); }
      close() { this.state = "closed"; return Promise.resolve(); }
    }
    globalThis.AudioContext = FakeAudioContext;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value(pattern) { globalThis.__feedbackVibrations.push(Array.isArray(pattern) ? [...pattern] : pattern); return true; },
    });
  });
}

test("390px keyboard settings and public event feedback stay opt-in, finite, and replay-safe", { skip: !chromium || !fs.existsSync(browserPath), timeout: 120000 }, async () => {
  const { server, url } = await startServer();
  let browser;
  let context;
  try {
    browser = await chromium.launch({ executablePath: browserPath, headless: true, timeout: 15000 });
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await installPresentationFakes(context);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
    await page.waitForFunction(() => Boolean(globalThis.__feedbackController));

    const sound = page.locator("#soundEffectsEnabled");
    const vibration = page.locator("#vibrationEnabled");
    assert.equal(await sound.isChecked(), false);
    assert.equal(await vibration.isChecked(), false);
    assert.equal(await page.locator("#feedbackSettingsStatus").textContent(), "効果音 OFF｜振動 OFF");
    assert.equal(await page.evaluate(() => globalThis.__feedbackAudio.contexts), 0);

    await sound.focus();
    await page.keyboard.press("Space");
    await vibration.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector("#feedbackSettingsStatus").textContent === "効果音 ON｜振動 ON");
    const savedSettings = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), "fourColorMapGame.standard.online.v5.basic-feedback-settings-v1");
    assert.deepEqual(savedSettings, { schemaVersion: 1, sound: true, vibration: true });
    assert.equal(await page.evaluate(() => globalThis.__feedbackAudio.contexts), 1);

    const first = await page.evaluate(() => globalThis.__feedbackController.notify({ eventId: "match-browser:7", cue: "contact-2" }));
    assert.deepEqual(first, { accepted: true, duplicate: false, sound: true, vibration: true });
    assert.deepEqual(await page.evaluate(() => ({ notes: globalThis.__feedbackAudio.notes, vibrations: globalThis.__feedbackVibrations })), {
      notes: [440, 660], vibrations: [[35, 30, 35]],
    });
    const duplicate = await page.evaluate(() => globalThis.__feedbackController.notify({ eventId: "match-browser:7", cue: "contact-2" }));
    assert.equal(duplicate.duplicate, true);
    assert.equal(await page.evaluate(() => globalThis.__feedbackAudio.notes.length), 2);

    const layout = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      card: document.querySelector("#feedbackSettings").getBoundingClientRect().toJSON(),
      toggles: [...document.querySelectorAll(".feedback-toggle")].map((node) => node.getBoundingClientRect().toJSON()),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }));
    assert.equal(layout.reducedMotion, true);
    assert.ok(layout.pageWidth <= layout.viewportWidth, JSON.stringify(layout));
    assert.ok(layout.card.left >= 0 && layout.card.right <= layout.viewportWidth, JSON.stringify(layout));
    assert.ok(layout.toggles.every((rect) => rect.height >= 56 && rect.left >= 0 && rect.right <= layout.viewportWidth), JSON.stringify(layout));

    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__feedbackController));
    assert.equal(await sound.isChecked(), true);
    assert.equal(await vibration.isChecked(), true);
    assert.equal(await page.locator("#feedbackSettingsStatus").textContent(), "効果音 ON（次の操作で有効）｜振動 ON");
    assert.equal(await page.evaluate(() => globalThis.__feedbackAudio.contexts), 0);
    assert.equal((await page.evaluate(() => globalThis.__feedbackController.notify({ eventId: "match-browser:7", cue: "contact-2" }))).duplicate, true);
    assert.equal(await page.evaluate(() => globalThis.__feedbackAudio.contexts), 0);

    await page.locator("#feedbackSettingsTitle").click();
    await page.waitForFunction(() => globalThis.__feedbackAudio.contexts === 1);
    const turn = await page.evaluate(() => globalThis.__feedbackController.notify({ eventId: "match-browser:8:turn:A", cue: "turn" }));
    assert.deepEqual(turn, { accepted: true, duplicate: false, sound: true, vibration: true });

    await page.evaluate(() => {
      globalThis.__feedbackHidden = true;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => globalThis.__feedbackHidden });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => globalThis.__feedbackHidden ? "hidden" : "visible" });
    });
    const beforeSuppressed = await page.evaluate(() => ({ notes: globalThis.__feedbackAudio.notes.length, vibrations: globalThis.__feedbackVibrations.length }));
    const hidden = await page.evaluate(() => globalThis.__feedbackController.notify({ eventId: "match-browser:9", cue: "victory" }));
    assert.deepEqual(hidden, { accepted: true, duplicate: false, sound: false, vibration: false });
    await page.evaluate(() => { globalThis.__feedbackHidden = false; });
    assert.equal((await page.evaluate(() => globalThis.__feedbackController.notify({ eventId: "match-browser:9", cue: "victory" }))).duplicate, true);

    await context.setOffline(true);
    const offline = await page.evaluate(() => globalThis.__feedbackController.notify({ eventId: "match-browser:10", cue: "defeat" }));
    assert.deepEqual(offline, { accepted: true, duplicate: false, sound: false, vibration: false });
    await context.setOffline(false);
    assert.equal((await page.evaluate(() => globalThis.__feedbackController.notify({ eventId: "match-browser:10", cue: "defeat" }))).duplicate, true);
    assert.deepEqual(await page.evaluate(() => ({ notes: globalThis.__feedbackAudio.notes.length, vibrations: globalThis.__feedbackVibrations.length })), beforeSuppressed);

    const failedAudio = await page.evaluate(() => {
      globalThis.__feedbackAudio.fail = true;
      return globalThis.__feedbackController.notify({ eventId: "match-browser:11", cue: "victory" });
    });
    assert.deepEqual(failedAudio, { accepted: true, duplicate: false, sound: false, vibration: true });
    assert.equal(await page.locator("#feedbackSettingsTitle").textContent(), "効果音と振動");
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await closeServer(server);
  }
});

test("two pages atomically elect one presenter and retain simultaneous distinct event ids", { skip: !chromium || !fs.existsSync(browserPath), timeout: 120000 }, async () => {
  const { server, url } = await startServer();
  let browser;
  let context;
  try {
    browser = await chromium.launch({ executablePath: browserPath, headless: true, timeout: 15000 });
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await installPresentationFakes(context);
    const firstPage = await context.newPage();
    const secondPage = await context.newPage();
    await Promise.all([
      firstPage.goto(url, { waitUntil: "load", timeout: 20000 }),
      secondPage.goto(url, { waitUntil: "load", timeout: 20000 }),
    ]);
    await Promise.all([
      firstPage.waitForFunction(() => Boolean(globalThis.__feedbackController)),
      secondPage.waitForFunction(() => Boolean(globalThis.__feedbackController)),
    ]);
    assert.equal(await firstPage.evaluate(() => typeof navigator.locks?.request), "function");
    assert.equal(await secondPage.evaluate(() => typeof navigator.locks?.request), "function");

    for (const page of [firstPage, secondPage]) {
      await page.evaluate(() => globalThis.__feedbackController.setSettings({ sound: true, vibration: true }));
      await page.locator("#feedbackSettingsTitle").click();
      await page.waitForFunction(() => globalThis.__feedbackController.snapshot().audioUnlocked === true);
    }

    async function armAtCommonBarrier(page, eventId, releaseAt) {
      await page.evaluate(({ eventId: id, release }) => {
        globalThis.__pendingFeedbackAtBarrier = (async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, release - Date.now())));
          return globalThis.__feedbackController.notify({ eventId: id, cue: "turn" });
        })();
        return true;
      }, { eventId, release: releaseAt });
    }

    const sameRelease = Date.now() + 750;
    await Promise.all([
      armAtCommonBarrier(firstPage, "match-browser-lock:same", sameRelease),
      armAtCommonBarrier(secondPage, "match-browser-lock:same", sameRelease),
    ]);
    const sameResults = await Promise.all([
      firstPage.evaluate(() => globalThis.__pendingFeedbackAtBarrier),
      secondPage.evaluate(() => globalThis.__pendingFeedbackAtBarrier),
    ]);
    assert.equal(sameResults.filter((result) => result.accepted).length, 1, JSON.stringify(sameResults));
    assert.equal(sameResults.filter((result) => result.duplicate).length, 1, JSON.stringify(sameResults));
    assert.equal(await firstPage.evaluate(() => globalThis.__feedbackAudio.notes.length), sameResults[0].accepted ? 1 : 0);
    assert.equal(await secondPage.evaluate(() => globalThis.__feedbackAudio.notes.length), sameResults[1].accepted ? 1 : 0);
    assert.equal((await firstPage.evaluate(() => globalThis.__feedbackVibrations.length))
      + (await secondPage.evaluate(() => globalThis.__feedbackVibrations.length)), 1);

    const distinctRelease = Date.now() + 750;
    await Promise.all([
      armAtCommonBarrier(firstPage, "match-browser-lock:distinct-a", distinctRelease),
      armAtCommonBarrier(secondPage, "match-browser-lock:distinct-b", distinctRelease),
    ]);
    const distinctResults = await Promise.all([
      firstPage.evaluate(() => globalThis.__pendingFeedbackAtBarrier),
      secondPage.evaluate(() => globalThis.__pendingFeedbackAtBarrier),
    ]);
    assert.ok(distinctResults.every((result) => result.accepted && !result.duplicate), JSON.stringify(distinctResults));

    const expectedDistinctIds = ["match-browser-lock:distinct-a", "match-browser-lock:distinct-b"];
    await Promise.all([firstPage, secondPage].map((currentPage) => currentPage.waitForFunction(({ key, eventIds }) => {
      const persisted = JSON.parse(localStorage.getItem(key) || "null");
      return persisted?.schemaVersion === 1 && eventIds.every((eventId) => persisted.eventIds?.includes(eventId));
    }, { key: "fourColorMapGame.standard.online.v5.basic-feedback-events-v1", eventIds: expectedDistinctIds })));

    const freshPage = await context.newPage();
    await freshPage.goto(url, { waitUntil: "load", timeout: 20000 });
    await freshPage.waitForFunction(() => Boolean(globalThis.__feedbackController));
    const replay = await freshPage.evaluate(async () => [
      await globalThis.__feedbackController.notify({ eventId: "match-browser-lock:distinct-a", cue: "turn" }),
      await globalThis.__feedbackController.notify({ eventId: "match-browser-lock:distinct-b", cue: "turn" }),
    ]);
    assert.ok(replay.every((result) => result.duplicate && !result.accepted), JSON.stringify(replay));
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await closeServer(server);
  }
});
