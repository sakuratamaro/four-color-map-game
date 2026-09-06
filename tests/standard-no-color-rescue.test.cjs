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

test("a real CREATE opens a response window where prism can rescue the receiver before coloring", () => {
  const rng = createRngDomains(453, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({
    matchId: "create-prism-rescue",
    firstSeat: "A",
    loadouts: { A: {}, B: { color: ["colorPrism"] } },
  }, rng);
  const microFor = (macro) => {
    const col = macro % 12;
    const row = Math.floor(macro / 12);
    return Array.from({ length: 16 }, (_, index) => (row * 4 + Math.floor(index / 4)) * 48 + col * 4 + (index % 4));
  };
  const usable = [...state.basicPalettes.B, state.bonusColors.B];
  state.phase = "WORK";
  state.requiredSize = state.rolledSize = state.baseRequiredSize = 1;
  state.regions = {
    R1: { id: "R1", micro: microFor(13), sourceMacros: [13], controllers: ["A"], color: usable[0], isPending: false },
    R2: { id: "R2", micro: microFor(15), sourceMacros: [15], controllers: ["A"], color: usable[1], isPending: false },
    R3: { id: "R3", micro: [3 * 48 + 8], sourceMacros: [], controllers: ["A"], color: usable[2], isPending: false },
  };

  const created = match.applyStandardAction({ state, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: [14] } }, expectedVersion: 0, rngStreams: rng });
  assert.deepEqual([created.state.status, created.state.active, created.state.phase, created.state.version], ["ACTIVE", "B", "COLOR", 1]);

  const rescued = match.applyStandardAction({ state: created.state, actor: "B", action: { type: "USE_SKILL", payload: { skill: "colorPrism" } }, expectedVersion: 1, rngStreams: rng });
  assert.equal(rescued.ok, true);
  assert.deepEqual([rescued.state.status, rescued.state.phase, rescued.state.version, rescued.state.hands.B.colorPrism], ["ACTIVE", "COLOR", 2, 0]);
  const rescueColor = ["red", "blue", "yellow", "green"].find((color) => !usable.includes(color));
  const colored = match.applyStandardAction({ state: rescued.state, actor: "B", action: { type: "COLOR_REGION", payload: { color: rescueColor } }, expectedVersion: 2, rngStreams: rng });
  assert.equal(colored.ok, true);
  assert.deepEqual([colored.state.status, colored.state.phase, colored.state.version], ["ACTIVE", "WORK", 3]);

  const retired = match.applyStandardAction({ state: created.state, actor: "B", action: { type: "DECLARE_NO_COLOR" }, expectedVersion: 1 });
  assert.deepEqual([retired.ok, retired.code, retired.state], [false, "NO_COLOR_DECLARATION_RETIRED", created.state]);
  const voluntary = match.applyStandardAction({ state: created.state, actor: "B", action: { type: "SURRENDER" }, expectedVersion: 1 });
  assert.equal(voluntary.ok, true, "the blocked player decides whether to surrender after considering rescue cards");
  assert.deepEqual([voluntary.state.status, voluntary.state.winner, voluntary.state.terminalReason], ["FINISHED", "A", "SURRENDER"]);
});
