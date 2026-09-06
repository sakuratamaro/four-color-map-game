"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-color-response-canary.mjs"), "utf8");

test("live COLOR-response canary is explicit, finite, public-key only, and always closes its room", () => {
  const guard = source.indexOf('process.argv.includes("--confirm-live")');
  const signup = source.indexOf('request("/auth/v1/signup"');
  assert.ok(guard >= 0 && signup > guard);
  assert.match(source, /180_000/);
  assert.match(source, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.match(source, /AbortSignal\.any\(\[AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\), hardAbortController\.signal\]\)/);
  assert.match(source, /finishCpuRoom[\s\S]+\{ cleanup: true \}/);
  assert.doesNotMatch(source, /hardTimeout[\s\S]{0,220}process\.exit/);
  assert.match(source, /REQUEST_TIMEOUT_MS = 20_000/);
  assert.match(source, /MAX_DRIVER_STEPS = 24/);
  assert.match(source, /MAX_CONSECUTIVE_CPU_STEPS = 8/);
  assert.match(source, /finally \{[\s\S]+finishCpuRoom[\s\S]+clearTimeout\(hardTimeout\)/);
  assert.match(source, /fcg_standard_abandon_room/);
  assert.match(source, /"SURRENDER"/);
  assert.doesNotMatch(source, /service[_ -]?role|SUPABASE_SERVICE_ROLE|sb_secret_/i);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:publishableKey|authorization|access_token)/);
});

test("live COLOR-response canary covers the new engine, authoritative rejection, CPU progress, and public privacy", () => {
  assert.match(source, /EXPECTED_ENGINE_VERSION = "5\.0\.0-alpha\.3"/);
  assert.match(source, /operation: "cpu-start"/);
  assert.match(source, /operation: "initialize"/);
  assert.match(source, /operation: "cpu-action"/);
  assert.match(source, /"DECLARE_NO_COLOR"/);
  assert.match(source, /error\?\.code === "NO_COLOR_DECLARATION_RETIRED"/);
  assert.match(source, /retired declaration is write-free/);
  assert.match(source, /JSON\.stringify\(room\.publicState\) === beforePublic/);
  assert.match(source, /JSON\.stringify\(room\.privateState\) === beforePrivate/);
  assert.match(source, /CPU action advances exactly once/);
  assert.match(source, /maxConsecutiveCpuSteps <= MAX_CONSECUTIVE_CPU_STEPS/);
  assert.match(source, /exposes alpha\.3 category window/);
  assert.match(source, /categoryWindow\?\.actor === publicState\.active/);
  assert.match(source, /skill: "disruptRandomOne"/);
  assert.match(source, /skill: "disruptChoiceOne", color: "red"/);
  assert.match(source, /category probe starts in an unused A WORK window/);
  assert.match(source, /cardConsumed === true/);
  assert.match(source, /error\?\.code === "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW"/);
  assert.match(source, /same-category rejection is write-free/);
  assert.match(source, /room\.version === beforeRejectedVersion/);
  assert.match(source, /JSON\.stringify\(room\.publicState\) === beforeRejectedPublic/);
  assert.match(source, /JSON\.stringify\(room\.privateState\) === beforeRejectedPrivate/);
  assert.match(source, /rejected skill remains available/);
  for (const key of ["hand", "loadout", "basicPalette", "bonusColor", "bonusUsesRemaining", "privateEffects", "hands", "basicPalettes", "bonusColors", "authoritative_state", "profile_a_state", "profile_b_state", "setup_a", "setup_b"]) {
    assert.match(source, new RegExp(`"${key}"`));
  }
});
