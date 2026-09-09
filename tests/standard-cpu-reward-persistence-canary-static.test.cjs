"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-standard-cpu-reward-persistence-canary.mjs"), "utf8");

test("live CPU reward canary is explicit and finite", () => {
  assert.match(source, /process\.argv\.includes\("--confirm-live"\)/);
  assert.match(source, /setTimeout\([\s\S]+90_000/);
  assert.match(source, /AbortSignal\.timeout\(20_000\)/);
});

test("live CPU reward canary finishes a real CPU match and verifies the profile delta", () => {
  assert.match(source, /operation: "cpu-start"/);
  assert.match(source, /operation: "setup"/);
  assert.match(source, /operation: "initialize"/);
  assert.match(source, /type: "SURRENDER"/);
  assert.match(source, /p_known_profile_revision: knownProfileRevision/);
  assert.match(source, /finished snapshot returns profile delta/);
  assert.match(source, /gachaTickets\?\.\["1"\][\s\S]+priorTickets \+ 1/);
});

test("live CPU reward canary verifies reload and idempotent terminal replay", () => {
  assert.match(source, /fcg_standard_profiles\?select=revision,profile_state/);
  assert.match(source, /full reload keeps completion ticket/);
  assert.match(source, /operation: "action", roomId, action: surrenderAction/);
  assert.match(source, /terminal action replay is idempotent/);
  assert.match(source, /replay does not increment revision/);
  assert.match(source, /replay does not duplicate ticket/);
});
