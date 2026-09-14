"use strict";

const assert = require("node:assert/strict");
const engine = require("../../standard/standard-engine.js");
const match = require("../../standard/standard-match.js");

function halfShiftScenario({ axis = "COLUMN", index = 1, direction = "plus", sourceMacros = [13, 14] } = {}) {
  const rng = engine.createRngDomains(9901, match.REQUIRED_RNG_STREAMS);
  let state = match.createStandardMatch({ matchId: "half-shift-guidance", firstSeat: "B",
    hands: { A: { areaHalfShift: 1 }, B: {} } }, rng);
  assert.equal(state.requiredSize, 2);
  let actions = 0;
  const apply = (actor, type, payload) => {
    const result = match.applyStandardAction({ state, actor, action: { type, payload }, expectedVersion: state.version, rngStreams: rng });
    assert.equal(result.ok, true, JSON.stringify(result));
    state = result.state;
    actions += 1;
  };
  apply("B", "CREATE_REGION", { sourceMacros });
  apply("A", "COLOR_REGION", { color: "red" });
  const before = state;
  apply("A", "USE_SKILL", { skill: "areaHalfShift", axis, index, direction });
  return { before, after: state, rng, actions };
}

// Enumerate complete connected macro sets independently of the UI's completion DFS
// and without filtering occupied cells. The real dispatcher supplies legality.
function connectedMacroSets(bounds, required) {
  const cells = [];
  for (let y = bounds.minRow; y <= bounds.maxRow; y += 1)
    for (let x = bounds.minCol; x <= bounds.maxCol; x += 1) cells.push(y * bounds.macroWidth + x);
  let sets = new Map(cells.map(cell => [String(cell), [cell]]));
  for (let size = 2; size <= required; size += 1) {
    const next = new Map();
    for (const shape of sets.values()) for (const cell of cells) {
      if (shape.includes(cell)) continue;
      const x = cell % bounds.macroWidth, y = Math.floor(cell / bounds.macroWidth);
      if (!shape.some(other => Math.abs(other % bounds.macroWidth - x) + Math.abs(Math.floor(other / bounds.macroWidth) - y) === 1)) continue;
      const grown = [...shape, cell].sort((a, b) => a - b);
      next.set(grown.join(","), grown);
    }
    sets = next;
  }
  return [...sets.values()];
}

function acceptedShapes(state, rng) {
  return connectedMacroSets(state.playableBounds, state.requiredSize).flatMap(sourceMacros => {
    const result = match.applyStandardAction({ state, actor: state.active, action: { type: "CREATE_REGION", payload: { sourceMacros } },
      expectedVersion: state.version, rngStreams: rng });
    return result.ok ? [{ sourceMacros, micro: result.state.regions[result.state.pending].micro }] : [];
  });
}

module.exports = { halfShiftScenario, connectedMacroSets, acceptedShapes };
