"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.join(__dirname, "..");
const runner = path.join(root, "scripts", "run-standard-product-tests.mjs");
const source = fs.readFileSync(runner, "utf8");

test("product test runner is root-scoped, serial by default, and excludes the nested Expo prototype", () => {
  assert.match(source, /entry\.isFile\(\) && entry\.name\.endsWith\("\.test\.cjs"\)/);
  assert.match(source, /--test-concurrency=1/);
  assert.doesNotMatch(source, /recursive:\s*true/);

  const listed = spawnSync(process.execPath, [runner, "--list"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(listed.status, 0, listed.stderr);

  const actual = listed.stdout.trim().split(/\r?\n/).filter(Boolean);
  const expected = fs.readdirSync(__dirname, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.cjs"))
    .map((entry) => `tests/${entry.name}`)
    .sort((left, right) => left.localeCompare(right, "en"));

  assert.deepEqual(actual, expected);
  assert.ok(actual.length > 80);
  assert.equal(actual.some((file) => file.startsWith("four-color-map-game/")), false);
});
