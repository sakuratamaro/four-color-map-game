"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "standard-online-browser.test.cjs"), "utf8");
const start = source.indexOf("async function withPage(");
const end = source.indexOf("\ntest(", start);
const withPage = source.slice(start, end);

test("browser selection allows only fixed Edge and Chrome executables", () => {
  assert.match(source, /const BROWSER_PATHS = Object\.freeze\(\{/);
  assert.match(source, /edge: "C:\\\\Program Files \(x86\)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge\.exe"/);
  assert.match(source, /chrome: "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome\.exe"/);
  assert.match(source, /const browserName = process\.env\.STANDARD_BROWSER \|\| "edge"/);
  assert.match(source, /if \(!Object\.hasOwn\(BROWSER_PATHS, browserName\)\) throw new Error\("STANDARD_BROWSER must be edge or chrome"\)/);
  assert.match(source, /const browserPath = BROWSER_PATHS\[browserName\]/);
  assert.doesNotMatch(source, /STANDARD_BROWSER_PATH|executablePath:\s*process\.env/);
});

test("withPage owns server and browser startup inside one finite try/finally", () => {
  assert.ok(start >= 0 && end > start);
  assert.match(withPage, /const \{ server, url \} = await bounded\("server-ready", startServer\(\), 5_000\);\s*browserStage\("server-ready"\);\s*try \{/);
  assert.match(withPage, /try \{[\s\S]+browser = await bounded\("browser-launch", chromium\.launch\(\{[^}]+timeout: 15_000[^}]+\}\), 15_000\)/);
  assert.ok(withPage.indexOf("chromium.launch") < withPage.indexOf("} finally {"));
});

test("withPage emits deterministic stages and bounds every setup and test-body await", () => {
  for (const stage of [
    "server-start", "server-ready", "browser-launch-start", "browser-launch-ready",
    "context-start", "context-ready", "page-start", "page-ready",
    "navigation-start", "navigation-ready", "badge-start", "badge-ready",
    "test-body-start", "test-body-ready", "teardown-start", "teardown-ready",
  ]) assert.match(withPage, new RegExp(`browserStage\\("${stage}"\\)`));
  assert.match(withPage, /bounded\("context-ready", browser\.newContext\([\s\S]+?\), 5_000\)/);
  assert.match(withPage, /bounded\("mock-ready", installMock\(context, mode\), 5_000\)/);
  assert.match(withPage, /bounded\("page-ready", context\.newPage\(\), 5_000\)/);
  assert.match(withPage, /bounded\("navigation-ready", page\.goto\([\s\S]+?timeout: 10_000[\s\S]+?\), 10_000\)/);
  assert.match(withPage, /bounded\("badge-ready", page\.locator\("#connectionBadge\.good"\)\.waitFor\(\{ state: "visible", timeout: 10_000 \}\), 10_000\)/);
  assert.match(withPage, /RESTORED_ROOM_MODES\.has\(mode\)[\s\S]+?bounded\("room-ready", page\.locator\("#room:not\(\.hidden\)"\)\.waitFor\(\{ timeout: 15_000 \}\), 15_000\)/);
  assert.match(withPage, /bounded\("test-body", run\(page\), bodyTimeout\)/);
});

test("timeout hierarchy preserves Playwright diagnostics and teardown room", () => {
  assert.match(withPage, /\{ bodyTimeout = 35_000 \}/);
  assert.equal((source.match(/\{ timeout: 130000 \}/g) || []).length, 17);
  assert.match(source, /cpu action then returns control[\s\S]+?\{ timeout: 150000 \}/i);
  assert.match(source, /const RESTORED_ROOM_MODES = new Set\(\["finished", "playing", "cpuTurn", "finishedCpu"\]\);/);
});

test("withPage releases partial startup resources and every HTTP connection", () => {
  assert.match(withPage, /bounded\("context-close", context\.close\(\), 3_000\)/);
  assert.match(withPage, /bounded\("browser-close", browser\.close\(\), 10_000\)/);
  assert.match(withPage, /bounded\("server-close", closeServer\(server\), 3_000\)/);
  assert.ok(withPage.indexOf("context.close") < withPage.indexOf("browser.close"));
  assert.ok(withPage.indexOf("browser.close") < withPage.indexOf("closeServer(server)"));
});

test("the long CPU action keeps its existing wait inside a finite body bound", () => {
  assert.match(source, /withPage\("cpuTurn",[\s\S]+?waitForFunction\([\s\S]+?timeout: 45000[\s\S]+?\}, \{ bodyTimeout: 50_000 \}\)/);
});
