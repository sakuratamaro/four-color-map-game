"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const engine = require("../standard/standard-engine.js"), match = require("../standard/standard-match.js");
const { halfShiftScenario, acceptedShapes } = require("./helpers/board-affordance-fixture.cjs");
const app = fs.readFileSync(path.join(__dirname, "../standard-online-v5/app.js"), "utf8");
const source = app.slice(app.indexOf("function playableMacro("), app.indexOf("function boardMacroDescription("));
const sorted = values => [...values].sort((a, b) => a - b);

function ui() {
  const sandbox = { targetDraft: null, selectedMacros: new Set(), boardSelectionAvailable: () => true };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { timeout: 1000 });
  return sandbox;
}

function connectedPrefix(cells, width) {
  const seen = new Set([cells[0]]), queue = [cells[0]];
  while (queue.length) {
    const cell = queue.shift();
    for (const next of cells) if (!seen.has(next)
      && Math.abs(cell % width - next % width) + Math.abs(Math.floor(cell / width) - Math.floor(next / width)) === 1) {
      seen.add(next); queue.push(next);
    }
  }
  return seen.size === cells.length;
}

for (const config of [
  { axis: "ROW", index: 1, direction: "plus" },
  { axis: "ROW", index: 1, direction: "minus" },
  { axis: "COLUMN", index: 1, direction: "plus" },
  { axis: "COLUMN", index: 1, direction: "minus" },
  { axis: "ROW", index: 10, direction: "plus", sourceMacros: [129, 130] },
  { axis: "COLUMN", index: 10, direction: "plus", sourceMacros: [129, 130] },
]) {
  test(`UDL039 Half Shift ${config.axis} ${config.index} ${config.direction}: UI candidates equal accepted server shapes before and after`, { timeout: 90000 }, t => {
    const scenario = halfShiftScenario(config), view = ui();
    assert.equal(scenario.actions, 3);
    let acceptedCount = 0, prefixCount = 0, partialMacros = 0;
    for (const stage of ["before", "after"]) for (const requiredSize of [1, 2, 3, 4, 5]) {
      // Board fixtures vary only the public required-size parameter; all geometry,
      // private projection and shift results come from the actual three actions.
      const state = { ...scenario[stage], requiredSize };
      const unchanged = JSON.stringify(state), rngBefore = JSON.stringify(engine.snapshotRngDomains(scenario.rng, match.REQUIRED_RNG_STREAMS));
      const publicState = match.projectStandardPublicState(state), legal = acceptedShapes(state, scenario.rng);
      assert.ok(legal.length > 0);
      acceptedCount += legal.length;
      const starts = new Set(legal.flatMap(shape => shape.sourceMacros));
      view.selectedMacros = new Set();
      assert.deepEqual(sorted(view.startCandidateMacros(publicState)), sorted(starts), `${stage} size${requiredSize} start`);
      const prefixes = new Map([...starts].map(cell => [String(cell), [cell]]));
      for (const { sourceMacros } of legal) for (let mask = 1; mask < (1 << requiredSize) - 1; mask += 1) {
        const prefix = sourceMacros.filter((_, index) => mask & (1 << index));
        if (connectedPrefix(prefix, state.playableBounds.macroWidth)) prefixes.set(prefix.join(","), prefix);
      }
      for (const prefix of prefixes.values()) {
        view.selectedMacros = new Set(prefix);
        const expected = new Set(legal.filter(shape => prefix.every(cell => shape.sourceMacros.includes(cell)))
          .flatMap(shape => shape.sourceMacros).filter(cell => !prefix.includes(cell)));
        // A completion may contain a distant cell, but only an adjacent cell is
        // the immediate next click from this connected prefix.
        for (const cell of expected) if (!prefix.some(other => Math.abs(cell % state.playableBounds.macroWidth - other % state.playableBounds.macroWidth)
          + Math.abs(Math.floor(cell / state.playableBounds.macroWidth) - Math.floor(other / state.playableBounds.macroWidth)) === 1)) expected.delete(cell);
        assert.deepEqual(sorted(view.connectedCandidateMacros(publicState)), sorted(expected), `${stage} size${requiredSize} prefix ${prefix}`);
        prefixCount += 1;
      }
      for (const shape of legal) {
        assert.equal(view.outgoingSelectionAcceptedByCurrentMode(publicState, shape.sourceMacros), true);
        const drawnFree = shape.sourceMacros.flatMap(macro => [...view.macroFreeMicros(publicState, macro)]);
        assert.deepEqual(sorted(drawnFree), sorted(shape.micro), "selected free cells equal the server-committed region");
      }
      if (stage === "after") for (const macro of starts) {
        const free = view.macroFreeMicros(publicState, macro).length;
        if (free > 0 && free < state.playableBounds.microScale ** 2) partialMacros += 1;
      }
      for (const macro of [0, 11, 132, 143]) {
        assert.equal(view.macroHasFreeMicro(publicState, macro), false, "outer margin is not a selectable empty macro");
        assert.equal(starts.has(macro), false);
      }
      assert.equal(JSON.stringify(state), unchanged, "UI queries and hypothetical acceptance do not change source state");
      assert.equal(JSON.stringify(engine.snapshotRngDomains(scenario.rng, match.REQUIRED_RNG_STREAMS)), rngBefore);
    }
    assert.ok(partialMacros > 0, "actual shift produces partly occupied selectable macros");
    t.diagnostic(JSON.stringify({ acceptedCount, prefixCount, partialMacros, boundsBefore: scenario.before.playableBounds, boundsAfter: scenario.after.playableBounds }));
  });
}
