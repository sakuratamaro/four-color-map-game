"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function create(seed = 452) {
  return match.createStandardMatch({
    matchId: `match-${seed}`,
    firstSeat: "A",
    loadouts: { A: { experimental: ["legalRecolor"] }, B: { experimental: ["legalRecolor"] } },
  }, createRngDomains(seed, match.REQUIRED_RNG_STREAMS));
}

test("a blocked palette with colorPrism in hand remains active until the player acts", () => {
  const state = create();
  const usable = [...state.basicPalettes.A, state.bonusColors.A];
  state.phase = "COLOR";
  state.pending = "R4";
  state.hands.A.colorPrism = 1;
  state.regions = {
    R1: { id: "R1", micro: [48], sourceMacros: [], controllers: ["B"], color: usable[0], isPending: false },
    R2: { id: "R2", micro: [50], sourceMacros: [], controllers: ["B"], color: usable[1], isPending: false },
    R3: { id: "R3", micro: [1], sourceMacros: [], controllers: ["B"], color: usable[2], isPending: false },
    R4: { id: "R4", micro: [49], sourceMacros: [], controllers: ["B"], color: null, isPending: true },
  };

  assert.equal(match.validateStandardState(state), true);
  assert.deepEqual(
    [state.status, state.phase, state.active, state.winner, state.terminalReason],
    ["ACTIVE", "COLOR", "A", null, null],
  );
  assert.equal(state.hands.A.colorPrism, 1);
});
