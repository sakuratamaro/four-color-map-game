"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-legal-recolor-lab-canary.mjs"), "utf8");

test("live legal-recolor LAB canary is explicit, bounded, public-key only, and cleans up", () => {
  assert.match(source, /process\.argv\.includes\("--confirm-live"\)/);
  assert.match(source, /90_000/);
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
  assert.match(source, /supabase-config\.js/);
  assert.doesNotMatch(source, /service[_ -]?role|SUPABASE_SERVICE_ROLE/i);
  assert.match(source, /fcg_standard_create_room/);
  assert.match(source, /fcg_standard_join_room/);
  assert.match(source, /operation:\s*"setup"[\s\S]+labMode:\s*true/);
  assert.match(source, /STANDARD_V5_LEGAL_RECOLOR_LAB_V1/);
  assert.match(source, /privateState\?\.hand\?\.legalRecolor === 1/);
  assert.match(source, /skill:\s*"legalRecolor",\s*regionId:\s*"R1"/);
  assert.match(source, /trace\?\.type === "LEGAL_RECOLOR"/);
  assert.match(source, /privateState\?\.hand\?\.legalRecolor === 0/);
  assert.match(source, /terminalReason === "SURRENDER"/);
  assert.match(source, /LAB profile A unchanged/);
  assert.match(source, /LAB profile B unchanged/);
});
