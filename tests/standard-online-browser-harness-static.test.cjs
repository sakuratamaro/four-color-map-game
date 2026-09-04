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
  assert.match(withPage, /const \{ server, url \} = await startServer\(\);\s*try \{/);
  assert.match(withPage, /try \{[\s\S]+browser = await chromium\.launch\(\{[^}]+timeout: 15_000[^}]+\}\)/);
  assert.ok(withPage.indexOf("chromium.launch") < withPage.indexOf("} finally {"));
});

test("withPage releases partial startup resources and every HTTP connection", () => {
  assert.match(withPage, /await context\?\.close\(\)/);
  assert.match(withPage, /await browser\?\.close\(\)/);
  assert.match(withPage, /server\.close\(resolve\)/);
  assert.match(withPage, /server\.closeAllConnections\?\.\(\)/);
  assert.ok(withPage.indexOf("context?.close") < withPage.indexOf("browser?.close"));
  assert.ok(withPage.indexOf("browser?.close") < withPage.indexOf("server.close(resolve)"));
  assert.ok(withPage.indexOf("server.close(resolve)") < withPage.indexOf("server.closeAllConnections?.()"));
});
