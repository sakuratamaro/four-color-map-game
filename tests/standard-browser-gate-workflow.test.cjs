"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "standard-browser-gate.yml"), "utf8");

test("Standard browser gate YAML text uses stable whitespace", () => {
  assert.equal(workflow.endsWith("\n"), true);
  assert.doesNotMatch(workflow, /\t|\r(?!\n)/);
  for (const line of workflow.split(/\r?\n/).filter(Boolean)) {
    assert.equal((line.match(/^ */)[0].length % 2), 0, line);
  }
});

test("Standard browser gate is candidate-push, manual, or pull-request only and least-privileged", () => {
  assert.match(workflow, /^on:\r?\n  push:\r?\n    branches: \[codex\/standard-release-command\]\r?\n  pull_request:\r?\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /branches: \[(?:main|master)\]/);
  assert.match(workflow, /^permissions:\r?\n  contents: read\r?$/m);
  assert.doesNotMatch(workflow, /(?:secrets\.|permissions:\s*write|contents:\s*write)/i);
  assert.match(workflow, /^concurrency:\r?\n  group: standard-browser-gate-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\r?\n  cancel-in-progress: true$/m);
});

test("Standard browser gate uses finite Windows Chrome and Edge jobs", () => {
  assert.match(workflow, /runs-on: windows-2025/);
  assert.match(workflow, /timeout-minutes: 15/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /STANDARD_BROWSER: \[chrome, edge\]/);
  assert.match(workflow, /STANDARD_BROWSER: \$\{\{ matrix\.STANDARD_BROWSER \}\}/);
});

test("Standard browser gate pins its tools and disables package-manager caching and install scripts", () => {
  assert.match(workflow, /uses: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1[\s\S]*?persist-credentials: false/);
  assert.match(workflow, /uses: actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7\.0\.0[\s\S]*?node-version: "24"[\s\S]*?package-manager-cache: false/);
  assert.match(workflow, /run: npm install --no-save --no-package-lock --ignore-scripts playwright@1\.62\.1/);
});

test("Standard browser gate runs only the scoped browser file serially and has no release integration", () => {
  assert.match(workflow, /run: node --test --test-concurrency=1 tests\/standard-online-browser\.test\.cjs/);
  assert.equal((workflow.match(/^\s+run:/gm) || []).length, 2);
  assert.doesNotMatch(workflow, /(?:supabase|deploy|github-pages|pages\/|upload-pages|npm test)/i);
});
