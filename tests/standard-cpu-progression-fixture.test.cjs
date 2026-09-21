"use strict";
// Regression for acceptance-harness failures, not randomized game balance.
const assert = require("node:assert/strict"), test = require("node:test");
const { createHash } = require("node:crypto");
const { api, winningEdgeScript } = require("./helpers/cpu-progression-runtime.cjs");
const { plain } = require("./helpers/public-skill-fixture.cjs");
const { TRIAL_POLICY_VERSION } = require("../standard/standard-cpu-progression.js");

for (const suffix of ["000000000010", "000000000034"]) {
  const roomId = "10000000-0000-4000-8000-" + suffix;
  test("WIN acceptance fixture replays legal real-CPU turns for prior failing room " + suffix, () => {
    const initial = plain(api.createRenTrial({ matchId: roomId + ":0", seed: 1 }));
    const before = plain(initial), trace = winningEdgeScript(initial, roomId);
    assert.deepEqual(initial, before, "strategy search never edits the fixture input");
    assert.ok(trace.length > 0 && trace.length <= 160);
    let current = initial;
    for (const turn of trace) {
      assert.equal(turn.seat, current.state.active);
      assert.equal(turn.version, current.state.version);
      if (turn.seat === "B") {
        const seed = parseInt(createHash("sha256").update(JSON.stringify({
          characterId: "ren", policyVersion: TRIAL_POLICY_VERSION, roomId, version: turn.version,
        })).digest("hex").slice(0, 8), 16) >>> 0;
        assert.deepEqual(turn.action, plain(api.chooseCpuAction({
          publicState: api.publicState(current.state), ownPrivateState: api.privateState(current.state, "B"),
          characterId: "ren", policyVersion: TRIAL_POLICY_VERSION, seed,
        })), "the real CPU is never forced to lose");
      }
      const applied = plain(api.apply({ ...current, actor: turn.seat, expectedVersion: turn.version, action: turn.action }));
      assert.equal(applied.ok, true, applied.code);
      current = { state: applied.state, rngSnapshot: applied.rngSnapshot };
    }
    assert.equal(current.state.status, "FINISHED");
    assert.equal(current.state.winner, "A");
  });
}
