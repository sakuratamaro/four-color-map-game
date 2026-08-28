"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../online/quick-engine.js");

function cycleRandom(values = [0.01, 0.2, 0.4, 0.6, 0.8]) {
  let index = 0;
  return () => values[index++ % values.length];
}

function action(id, expectedVersion, type, payload = {}) {
  const suffix = String(id).replace(/[^0-9a-f]/gi, "").padStart(12, "0").slice(-12);
  return { id: `00000000-0000-4000-8000-${suffix}`, expectedVersion, type, payload };
}

function horizontal(state, row, column = 1) {
  const start = engine.internals.mIndex(column, row);
  return Array.from({ length: state.requiredSize }, (_, offset) => start + offset);
}

test("quick game starts with distinct two-color palettes and three loaned skills", () => {
  const state = engine.createQuickGame({ random: cycleRandom() });
  assert.equal(state.mode, "quick");
  assert.equal(state.active, "A");
  assert.equal(state.phase, "CREATE_FIRST");
  assert.ok(state.requiredSize >= 1 && state.requiredSize <= 4);
  assert.equal(state.palettes.A.length, 2);
  assert.equal(state.palettes.B.length, 2);
  assert.notDeepEqual([...state.palettes.A].sort(), [...state.palettes.B].sort());
  assert.deepEqual(state.hands.A, { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 });
});

test("create and color actions follow v4.9 turn ownership", () => {
  const random = cycleRandom();
  let state = engine.createQuickGame({ random });
  const macro = engine.internals.mIndex(1, 1);
  const macros = Array.from({ length: state.requiredSize }, (_, offset) => macro + offset);

  state = engine.applyAction(state, "A", action("create-1", 0, "CREATE_REGION", { macros }), { random }).state;
  assert.equal(state.active, "B");
  assert.equal(state.phase, "COLOR");
  assert.equal(state.pending, "R1");

  const color = state.palettes.B[0];
  state = engine.applyAction(state, "B", action("color--1", 1, "COLOR_REGION", { color }), { random }).state;
  assert.equal(state.active, "B");
  assert.equal(state.phase, "WORK");
  assert.equal(state.regions.R1.color, color);
});

test("stale actions are rejected and accepted action ids are idempotent", () => {
  const random = cycleRandom();
  const initial = engine.createQuickGame({ random });
  const start = engine.internals.mIndex(1, 1);
  const macros = Array.from({ length: initial.requiredSize }, (_, offset) => start + offset);
  const create = action("create-2", 0, "CREATE_REGION", { macros });
  const accepted = engine.applyAction(initial, "A", create, { random });
  const duplicate = engine.applyAction(accepted.state, "A", create, { random });

  assert.equal(duplicate.duplicate, true);
  assert.strictEqual(duplicate.state, accepted.state);
  assert.throws(
    () => engine.applyAction(accepted.state, "B", action("stale---", 0, "COLOR_REGION", { color: accepted.state.palettes.B[0] }), { random }),
    (error) => error.code === "STALE_VERSION",
  );
});

test("public projection never includes either secret palette or hand", () => {
  const state = engine.createQuickGame({ random: cycleRandom() });
  const publicProjection = engine.publicState(state);
  const own = engine.privateState(state, "A");
  assert.equal("palettes" in publicProjection, false);
  assert.equal("hands" in publicProjection, false);
  assert.deepEqual(own.palette, state.palettes.A);
  assert.equal("opponentPalette" in own, false);
  assert.equal("opponentHand" in own, false);
});

test("Four Color Release allows a non-palette color but still loses on adjacency", () => {
  const random = cycleRandom();
  let state = engine.createQuickGame({ random });
  const first = engine.internals.mIndex(1, 1);
  const firstMacros = Array.from({ length: state.requiredSize }, (_, offset) => first + offset);
  state = engine.applyAction(state, "A", action("create-3", 0, "CREATE_REGION", { macros: firstMacros }), { random }).state;
  const firstColor = state.palettes.B[0];
  state = engine.applyAction(state, "B", action("color--3", 1, "COLOR_REGION", { color: firstColor }), { random }).state;

  const adjacent = engine.internals.mIndex(1, 2);
  const secondMacros = Array.from({ length: state.requiredSize }, (_, offset) => adjacent + offset);
  state = engine.applyAction(state, "B", action("create-4", 2, "CREATE_REGION", { macros: secondMacros }), { random }).state;
  state = engine.applyAction(state, "A", action("prism--4", 3, "USE_SKILL", { skill: "colorPrism" }), { random }).state;
  state = engine.applyAction(state, "A", action("illegal4", 4, "COLOR_REGION", { color: firstColor }), { random }).state;

  assert.equal(state.winner, "B");
  assert.equal(state.reason, "ILLEGAL_COLOR");
});

test("Half Shift moves a populated band by half a macro and consumes exactly one card", () => {
  const random = cycleRandom();
  let state = engine.createQuickGame({ random });
  state = engine.applyAction(state, "A", action("create-5", 0, "CREATE_REGION", { macros: horizontal(state, 1) }), { random }).state;
  state = engine.applyAction(state, "B", action("color--5", 1, "COLOR_REGION", { color: state.palettes.B[0] }), { random }).state;
  const before = [...state.regions.R1.micro];

  state = engine.applyAction(state, "B", action("shift--5", 2, "USE_SKILL", {
    skill: "areaHalfShift",
    macro: engine.internals.mIndex(1, 1),
    direction: "right",
  }), { random }).state;

  assert.equal(state.hands.B.areaHalfShift, 0);
  assert.deepEqual(state.regions.R1.micro, before.map((micro) => micro + 2));
  assert.equal(state.version, 3);
});

test("Color Seal affects the opponent once and later rebounds onto its user", () => {
  const random = cycleRandom();
  let state = engine.createQuickGame({ random });
  state = engine.applyAction(state, "A", action("create-6", 0, "CREATE_REGION", { macros: horizontal(state, 1) }), { random }).state;
  const firstColor = state.palettes.B[0];
  state = engine.applyAction(state, "B", action("color--6", 1, "COLOR_REGION", { color: firstColor }), { random }).state;
  state = engine.applyAction(state, "B", action("seal---6", 2, "USE_SKILL", { skill: "disruptChoiceOne", color: "red" }), { random }).state;
  assert.equal(state.seals.A.red, 1);
  assert.equal(state.curseBacklash.B, 1);

  state = engine.applyAction(state, "B", action("create-7", 3, "CREATE_REGION", { macros: horizontal(state, 2) }), { random }).state;
  const secondColor = state.palettes.A.find((color) => color !== firstColor && state.seals.A[color] === 0);
  assert.ok(secondColor);
  state = engine.applyAction(state, "A", action("color--7", 4, "COLOR_REGION", { color: secondColor }), { random }).state;
  state = engine.applyAction(state, "A", action("create-8", 5, "CREATE_REGION", { macros: horizontal(state, 3) }), { random }).state;

  assert.equal(state.curseBacklash.B, 0);
  assert.equal(Object.values(state.seals.B).filter((count) => count > 0).length, 1);
});

test("surrender finishes the match and every later action is rejected", () => {
  const random = cycleRandom();
  let state = engine.createQuickGame({ random });
  state = engine.applyAction(state, "B", action("giveup-9", 0, "SURRENDER"), { random }).state;
  assert.equal(state.winner, "A");
  assert.equal(state.reason, "SURRENDER");
  assert.throws(
    () => engine.applyAction(state, "A", action("after--9", 1, "SURRENDER"), { random }),
    (error) => error.code === "MATCH_FINISHED",
  );
});
