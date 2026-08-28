"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const codec = require("../online/state-codec.js");

test("v4.9-shaped state survives a JSON round trip", () => {
  const original = {
    active: "A",
    phase: "color",
    selection: { A: new Set(["1,2", "2,2"]), B: new Set() },
    trophyTargetMacros: new Set(["0,0", "1,0"]),
    limitedRemaining: { A: Infinity, B: 3 },
    regions: [{ id: 1, cells: new Set(["1,2"]), color: null }],
    lookup: new Map([["1,2", 1]]),
  };

  const restored = codec.parse(codec.stringify(original));

  assert.notStrictEqual(restored, original);
  assert.deepEqual(restored.selection.A, new Set(["1,2", "2,2"]));
  assert.deepEqual(restored.trophyTargetMacros, original.trophyTargetMacros);
  assert.equal(restored.limitedRemaining.A, Infinity);
  assert.equal(restored.limitedRemaining.B, 3);
  assert.deepEqual(restored.regions[0].cells, new Set(["1,2"]));
  assert.deepEqual(restored.lookup, new Map([["1,2", 1]]));
});

test("encoding does not mutate live state", () => {
  const cells = new Set(["0,0"]);
  const game = { cells };
  const snapshot = codec.toSnapshot(game);

  snapshot.cells.values.push("9,9");
  assert.deepEqual(cells, new Set(["0,0"]));
});

test("circular state fails explicitly", () => {
  const game = {};
  game.self = game;
  assert.throws(() => codec.toSnapshot(game), /circular references/);
});
