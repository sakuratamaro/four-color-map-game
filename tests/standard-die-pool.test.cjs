"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const match = require("../standard/standard-match.js");
const { createRngDomains } = require("../standard/standard-engine.js");

function make(dieValue, config = {}) {
  const streams = { ...createRngDomains(7101, match.REQUIRED_RNG_STREAMS) };
  let draws = 0;
  streams.die = { next() { draws += 1; return dieValue; } };
  const state = match.createStandardMatch({ matchId: "die-pool-071", firstSeat: "A", ...config }, streams);
  return { state, streams, draws: () => draws };
}

test("small-v2 has the exact nine requested buckets and preserves two-thirds small areas", () => {
  assert.deepEqual(match.DIE_POOL, [1,1,2,2,2,2,3,3,4]);
  assert.deepEqual(match.LEGACY_DIE_POOL, [1,1,2,2,3,4]);
  assert.deepEqual(match.BONUS_USE_POOL, [1,1,2,2,3,4]);
  assert.equal(match.DIE_POOL.filter(n => n <= 2).length, 6);
  assert.equal(match.DIE_POOL.reduce((a,b) => a+b, 0), 20);
  for (let i = 0; i < 9; i += 1) {
    const { state, draws } = make((i + 0.5) / 9);
    assert.equal(state.diePoolVersion, "small-v2");
    assert.equal(state.rolledSize, match.DIE_POOL[i]);
    assert.equal(state.requiredSize, state.rolledSize);
    assert.equal(draws(), 1);
  }
});

test("first-roll bucket boundaries and explicit legacy creation use one die draw", () => {
  for (const [value, expected] of [[0,1],[2/9,2],[6/9,3],[8/9,4],[1-Number.EPSILON,4]]) {
    const f = make(value); assert.equal(f.state.rolledSize, expected); assert.equal(f.draws(), 1);
  }
  const old = make(0.25, { diePoolVersion: "small-v1" });
  assert.equal(old.state.rolledSize, 1); assert.equal(old.draws(), 1);
  assert.equal(Object.hasOwn(old.state, "diePoolVersion"), false);
  assert.equal(make(0.25).state.rolledSize, 2);
});

test("serialized new and unversioned ongoing matches retain their respective next-roll pools", () => {
  for (const version of ["small-v2", "small-v1", undefined]) {
    const f = make(0);
    const initial = JSON.parse(JSON.stringify(f.state));
    if (version === undefined) delete initial.diePoolVersion;
    else initial.diePoolVersion = version;
    const created = match.applyStandardAction({ state: initial, actor: "A", expectedVersion: 0,
      action: { type: "CREATE_REGION", payload: { sourceMacros: [13] } }, rngStreams: f.streams });
    assert.equal(created.ok, true);
    let rolls = 0;
    const rngStreams = { ...f.streams, die: { next() { rolls += 1; return 0.25; } } };
    const state = JSON.parse(JSON.stringify(created.state));
    const colored = match.applyStandardAction({ state, actor: "B", expectedVersion: state.version,
      action: { type: "COLOR_REGION", payload: { color: state.basicPalettes.B[0] } }, rngStreams });
    assert.equal(colored.ok, true); assert.equal(colored.state.phase, "WORK");
    assert.equal(colored.state.rolledSize, version === "small-v2" ? 2 : 1);
    assert.equal(colored.state.diePoolVersion, version); assert.equal(rolls, 1);
    assert.equal(match.validateStandardState(colored.state), true);
  }
});

test("changing the die distribution does not change palettes, bonus uses or their stream cursors", () => {
  const newer = make(0.25), older = make(0.25, { diePoolVersion: "small-v1" });
  for (const key of ["basicPalettes", "bonusColors", "bonusUsesRemaining", "initialPalettes"]) {
    assert.deepEqual(newer.state[key], older.state[key]);
  }
  for (const name of match.REQUIRED_RNG_STREAMS.filter(name => name !== "die")) {
    assert.equal(newer.streams[name].next(), older.streams[name].next());
  }
});

test("public projection exposes only the rule version and keeps legacy absence unchanged", () => {
  const { state } = make(0);
  assert.equal(match.projectStandardPublicState(state).diePoolVersion, "small-v2");
  delete state.diePoolVersion;
  const old = match.projectStandardPublicState(state);
  assert.equal(Object.hasOwn(old, "diePoolVersion"), false);
  assert.equal(Object.hasOwn(old, "basicPalettes"), false);
});

test("unknown distribution versions reject before RNG or saved-state mutation", () => {
  assert.throws(() => match.createStandardMatch({ matchId: "bad-version", diePoolVersion: "unknown" },
    { die: { next() { throw new Error("RNG_MUST_NOT_BE_USED"); } } }), /INVALID_DIE_POOL_VERSION/);
  const { state } = make(0); state.diePoolVersion = "unknown";
  const before = JSON.stringify(state);
  assert.throws(() => match.validateStandardState(state), /INVALID_DIE_POOL_VERSION/);
  assert.equal(JSON.stringify(state), before);
});
