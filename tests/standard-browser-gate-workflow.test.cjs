"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("UDL033 artwork contracts join the existing bounded gate without replacing pilot suites",()=>{
  const source=fs.readFileSync(path.join(__dirname,"..",".github/workflows/standard-browser-gate.yml"),"utf8");
  for(const name of ["standard-cpu-portraits","standard-cpu-progression-public-ui","standard-ui-navigation-integration"])
    assert.equal(source.split("          tests/"+name+".test.cjs").length-1,1,name);
  assert.equal(source.split("codex/cpu-wataokiba-public-ui-20260923").length-1,1);
});

const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "standard-browser-gate.yml"), "utf8");

test("Standard browser gate YAML text uses stable whitespace", () => {
  assert.equal(workflow.endsWith("\n"), true);
  assert.doesNotMatch(workflow, /\t|\r(?!\n)/);
  for (const line of workflow.split(/\r?\n/).filter(Boolean)) {
    assert.equal((line.match(/^ */)[0].length % 2), 0, line);
  }
});

test("Standard browser gate is candidate-push, manual, or pull-request only and least-privileged", () => {
  assert.match(workflow, /^on:\r?\n  push:\r?\n    branches: \[codex\/standard-release-command, codex\/quiz-memo-calculator-20260912, codex\/ui-diet-20260912, codex\/ui-play-surface-20260912, codex\/ui-result-20260912, codex\/ui-cosmetics-20260912, codex\/ui-player-copy-20260912, codex\/skill-cutin-20260912, codex\/ui-flat-entry-20260912, codex\/skill-catalog-20260912, codex\/surrender-confirmation-20260913, codex\/cpu-split-rescue-20260913, codex\/skill-cutin-readability-20260913, codex\/skill-cutin-public-names-20260913, codex\/ui-diet-release-20260915, codex\/ui-followup-release-20260915, codex\/ui-public-match-actions-20260913, codex\/ui-public-match-actions-pointer-20260913, codex\/surrender-cpu-face-20260913, codex\/quiz-level-buttons-20260914, codex\/gacha-entry-diet-20260914, codex\/home-rules-diet-20260914, codex\/ui-navigation-release-20260920, codex\/cpu-progression-public-ui-20260921, codex\/cpu-wataokiba-public-ui-20260923\][\s\S]+?  pull_request:[\s\S]+?  workflow_dispatch:/m);
  assert.equal((workflow.match(/      - online\/supabase-config\.js/g) || []).length, 2);
  assert.equal((workflow.match(/      - online-v5\/style\.css/g) || []).length, 2);
  assert.equal((workflow.match(/      - standard-online-v5\/\*\*/g) || []).length, 2);
  assert.equal((workflow.match(/      - standard-v5\/\*\*/g) || []).length, 2);
  assert.equal((workflow.match(/      - scripts\/build-standard-v5-bundle\.mjs/g) || []).length, 2);
  assert.equal((workflow.match(/      - scripts\/build-standard-online-skill-registry\.mjs/g) || []).length, 2);
  assert.equal((workflow.match(/      - scripts\/check-standard-decision-reconciliation\.mjs/g) || []).length, 2);
  assert.equal((workflow.match(/      - docs\/PROJECT_COMMAND_CENTER\.md/g) || []).length, 2);
  assert.equal((workflow.match(/      - docs\/STANDARD_PUBLIC_RELEASE_RUNBOOK\.md/g) || []).length, 2);
  assert.equal((workflow.match(/      - tests\/browser-server-cleanup\.test\.cjs/g) || []).length, 2);
  assert.equal((workflow.match(/      - tests\/helpers\/browser-server-cleanup\.cjs/g) || []).length, 2);
  assert.equal((workflow.match(/      - tests\/helpers\/cpu-sql-runtime\.cjs/g) || []).length, 2);
  for (const entry of ["tests/canvas-native-pointer.test.cjs", "tests/helpers/canvas-native-pointer.cjs", "tests/helpers/public-skill-fixture.cjs", "scripts/check-standard-public-skill-compat.cjs", "docs/SKILL_PUBLIC_EVENT_20260913.md"])
    assert.equal(workflow.replaceAll("\r\n", "\n").split("      - " + entry + "\n").length - 1, 2, entry);
  assert.equal((workflow.match(/      - tests\/sql-runtime\/\*\*/g) || []).length, 2);
  assert.equal((workflow.match(/      - tests\/standard-online-browser\.test\.cjs/g) || []).length, 2);
  assert.equal((workflow.match(/      - tests\/standard-browser-gate-workflow\.test\.cjs/g) || []).length, 2);
  assert.match(workflow, /tests\/standard-public-release-runbook\.test\.cjs/);
  assert.doesNotMatch(workflow, /branches: \[(?:main|master)\]/);
  assert.match(workflow, /^permissions:\r?\n  contents: read\r?$/m);
  assert.doesNotMatch(workflow, /(?:secrets\.|permissions:\s*write|contents:\s*write)/i);
  assert.match(workflow, /^concurrency:\r?\n  group: standard-browser-gate-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\r?\n  cancel-in-progress: true$/m);
});

test("Standard browser gate uses finite Windows Chrome and Edge jobs", () => {
  assert.match(workflow, /runs-on: windows-2025/);
  assert.match(workflow, /^    timeout-minutes: 45$/m);
  assert.equal((workflow.match(/timeout-minutes:/g) || []).length, 1, "one finite job cap, no per-step override");
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /STANDARD_BROWSER: \[chrome, edge\]/);
  assert.match(workflow, /STANDARD_BROWSER: \$\{\{ matrix\.STANDARD_BROWSER \}\}/);
});

test("independent UI diet adds its exact branch and five contracts to the existing bounded gate", () => {
  assert.equal(workflow.split("codex/ui-diet-release-20260915").length - 1, 1);
  for (const name of ["standard-palette-notice-lifecycle.test.cjs", "standard-board-affordance.test.cjs", "standard-half-shift-candidate-parity.test.cjs", "standard-turn-guide-diet.test.cjs", "standard-hand-compact.test.cjs"])
    assert.equal(workflow.split("tests/" + name).length - 1, 1, name);
  assert.equal(workflow.replaceAll("\r\n", "\n").split("      - tests/helpers/board-affordance-fixture.cjs\n").length - 1, 2);
});

test("two UI follow-ups use only their exact branch and the existing bounded gate", () => {
  assert.equal(workflow.split("codex/ui-followup-release-20260915").length-1,1);
  for (const name of ["standard-palette-origin-rim.test.cjs", "standard-gacha-lobby.test.cjs"])
    assert.equal(workflow.split("tests/"+name).length-1,1,name);
});

test("compact profile contracts are in the existing Windows step without enabling a new push branch", () => {
  const contracts = workflow.match(/- name: Run Standard CPU policy contract tests\r?\n\s+run: >-\r?\n([\s\S]*?)(?=\r?\n\s+- name:)/)?.[1];
  assert.ok(contracts, "existing contract step must be present");
  assert.equal((contracts.match(/^\s+tests\/standard-profile-compact\.test\.cjs\s*$/gm) || []).length, 1);
  for (const file of ["standard-profile.test.cjs", "standard-learned-technique.test.cjs", "standard-technique-profile-sql-runtime.test.cjs", "standard-ren-trial.test.cjs", "standard-cpu-trial-sql-runtime.test.cjs", "standard-cpu-progression-fixture.test.cjs", "standard-cpu-progression-client.test.cjs", "standard-cpu-progression-ui.test.cjs"]) {
    assert.equal(contracts.split("tests/" + file).length - 1, 1, file);
  }
  const push = workflow.slice(workflow.indexOf("  push:"), workflow.indexOf("  pull_request:"));
  assert.doesNotMatch(push, /branches:.*codex\/profile-compact-20260914/);
  assert.doesNotMatch(push, /branches:.*codex\/cpu-progression-pilot-20260914/);
});

test("Standard browser gate pins its tools and disables package-manager caching and install scripts", () => {
  assert.match(workflow, /uses: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1[\s\S]*?persist-credentials: false/);
  assert.match(workflow, /uses: actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7\.0\.0[\s\S]*?node-version: "24"[\s\S]*?package-manager-cache: false/);
  assert.match(workflow, /run: npm install --no-save --no-package-lock --ignore-scripts playwright@1\.62\.1 @electric-sql\/pglite@0\.5\.8 pg@8\.23\.0\r?$/m);
});

test("Standard browser gate runs CPU contracts and the scoped browser file serially without release integration", () => {
  assert.match(workflow, /node scripts\/build-standard-v5-bundle\.mjs[\s\S]+node scripts\/build-standard-online-engine\.mjs[\s\S]+node scripts\/build-standard-online-skill-registry\.mjs[\s\S]+git diff --exit-code -- standard-v5\/app\.bundle\.js supabase\/functions\/standard-game-action\/standard-engine\.bundle\.js standard-online-v5\/standard-skill-registry\.generated\.js/);
  assert.match(workflow, /node --test --test-concurrency=1[\s\S]+?tests\/standard-kurogane-lookahead\.test\.cjs[\s\S]+?tests\/standard-cpu-browser\.test\.cjs/);
  assert.match(workflow, /tests\/standard-browser-gate-workflow\.test\.cjs/);
  assert.match(workflow, /tests\/standard-online-browser-harness-static\.test\.cjs/);
  assert.match(workflow, /tests\/browser-server-cleanup\.test\.cjs/);
  assert.match(workflow, /          tests\/canvas-native-pointer\.test\.cjs/);
  assert.match(workflow, /tests\/standard-online-quiz-generator-runtime\.test\.cjs/);
  assert.match(workflow, /tests\/standard-quiz-level-start\.test\.cjs/);
  assert.match(workflow, /tests\/standard-home-rules\.test\.cjs/);
  for (const file of ["standard-gacha-entry.test.cjs", "standard-gacha-transaction.test.cjs", "standard-quiz-reward-gacha.test.cjs"]) {
    assert.match(workflow, new RegExp("tests/" + file.replaceAll(".", "\\.")));
  }
  assert.match(workflow, /tests\/standard-matchmaking-availability-migration\.test\.cjs/);
  assert.match(workflow, /tests\/standard-cpu-commentary\.test\.cjs/);
  for (const file of ["standard-cpu-split-rescue.test.cjs", "standard-cpu-split-policy-migration.test.cjs", "standard-cpu-rollout.test.cjs", "standard-cpu-split-sql-runtime.test.cjs"]) {
    assert.match(workflow, new RegExp(`tests/${file.replaceAll(".", "\\.")}`));
  }
  assert.match(workflow, /tests\/standard-basic-feedback\.test\.cjs/);
  assert.match(workflow, /tests\/standard-online-basic-feedback-static\.test\.cjs/);
  assert.match(workflow, /tests\/standard-online-contact-feedback\.test\.cjs/);
  assert.match(workflow, /tests\/standard-online-skill-registry\.test\.cjs/);
  assert.match(workflow, /tests\/standard-public-skill-event\.test\.cjs/);
  assert.match(workflow, /tests\/standard-public-skill-persistence\.test\.cjs/);
  for (const file of ["standard-cpu.test.cjs", "standard-cpu-colored-corner-bloom.test.cjs", "standard-cpu-roster.test.cjs", "standard-no-color-rescue.test.cjs", "standard-color-region-split.test.cjs", "standard-area-colored-corner-bloom.test.cjs", "standard-local-ui-static.test.cjs", "standard-live-color-response-canary-static.test.cjs", "standard-decision-reconciliation.test.cjs"]) {
    assert.match(workflow, new RegExp(`tests/${file.replaceAll(".", "\\.")}`));
  }
  assert.match(workflow, /if: matrix\.STANDARD_BROWSER == 'edge'[\s\S]+?tests\/standard-color-seal-browser-lifecycle\.test\.cjs[\s\S]+?tests\/standard-no-color-browser-terminal\.test\.cjs/);
  assert.match(workflow, /node --test --test-concurrency=1[\s\S]+?tests\/standard-basic-feedback-browser\.test\.cjs[\s\S]+?tests\/standard-online-browser\.test\.cjs/);
  assert.equal((workflow.match(/^\s+run:/gm) || []).length, 6);
  assert.doesNotMatch(workflow, /^\s+(?:uses|run):.*(?:supabase|deploy|github-pages|pages\/|upload-pages|npm test)/im);
});

test("pilot native journey and real PostgreSQL races join the existing gate without a production connection", () => {
  for (const file of ["cpu-progression-runtime.cjs", "cpu-progression-browser.cjs", "native-postgres.cjs", "static-server.cjs"])
    assert.equal(workflow.replaceAll("\r\n", "\n").split("      - tests/helpers/" + file + "\n").length - 1, 2, file);
  assert.match(workflow, /name: Run Standard isolated PostgreSQL race tests\r?\n\s+if: matrix\.STANDARD_BROWSER == 'chrome'\r?\n\s+run: \|\r?\n\s+\$env:FCG_TEST_POSTGRES_BIN = 'C:\\Program Files\\PostgreSQL\\17\\bin'\r?\n\s+node --test --test-concurrency=1 tests\/standard-cpu-progression-postgres\.test\.cjs/);
  assert.match(workflow, /tests\/standard-online-browser\.test\.cjs\r?\n\s+tests\/standard-cpu-progression-browser\.test\.cjs/);
  assert.doesNotMatch(workflow, /(?:DATABASE_URL|SUPABASE_DB_URL|Start-Service|pg_ctl.*register)/i);
  assert.match(workflow, /fetch-depth: 0/);
  assert.equal(workflow.split("tests/standard-cpu-progression-rollout.test.cjs").length-1,1);
});
