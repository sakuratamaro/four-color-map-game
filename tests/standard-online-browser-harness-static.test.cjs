"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "standard-online-browser.test.cjs"), "utf8");
const start = source.indexOf("async function withPage(");
const end = source.indexOf("\ntest(", start);
const withPage = source.slice(start, end);

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
