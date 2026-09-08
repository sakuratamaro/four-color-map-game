"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "app.js"), "utf8");
const start = app.indexOf("const QUIZ_OPTION_VELOCITY_ANGLES");
const end = app.indexOf("function applyQuizOptionPhysicsPositions(");
assert.ok(start >= 0 && end > start, "physics step must remain independently testable");
const context = vm.createContext({});
new vm.Script(`${app.slice(start, end)}\nglobalThis.step = advanceQuizOptionPhysics; globalThis.initialVelocity = quizOptionInitialVelocity;`).runInContext(context);

test("whole-button physics reflects from every arena wall", () => {
  const items = [
    { x: -1, y: 20, width: 40, height: 20, vx: -12, vy: 3 },
    { x: 185, y: 88, width: 20, height: 16, vx: 9, vy: 11 },
  ];
  context.step(items, 200, 100, 0);
  assert.deepEqual(items[0], { x: 0, y: 20, width: 40, height: 20, vx: 12, vy: 3 });
  assert.deepEqual(items[1], { x: 180, y: 84, width: 20, height: 16, vx: -9, vy: -11 });
});

test("whole-button physics separates colliding choices and exchanges approaching velocity", () => {
  const items = [
    { x: 20, y: 20, width: 50, height: 30, vx: 14, vy: 0 },
    { x: 60, y: 20, width: 50, height: 30, vx: -8, vy: 0 },
  ];
  context.step(items, 200, 100, 0);
  assert.ok(items[0].x + items[0].width <= items[1].x, JSON.stringify(items));
  assert.equal(items[0].vx, -8);
  assert.equal(items[1].vx, 14);
});

test("whole-button physics keeps all choice hitboxes inside the arena", () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    x: index % 2 ? 179 : -3,
    y: index % 3 ? 83 : -2,
    width: 24,
    height: 18,
    vx: index % 2 ? 20 : -20,
    vy: index % 3 ? 15 : -15,
  }));
  context.step(items, 200, 100, 0.02);
  for (const item of items) {
    assert.ok(item.x >= 0 && item.x + item.width <= 200, JSON.stringify(item));
    assert.ok(item.y >= 0 && item.y + item.height <= 100, JSON.stringify(item));
  }
});

test("whole-button physics visibly travels and trades columns within five seconds at 390px", () => {
  const arenaWidth = 358;
  const arenaHeight = 290;
  const widths = [52, 52, 52, 64, 86, 104];
  const items = Array.from({ length: 6 }, (_, index) => ({
    id: index,
    x: 12 + (index % 3) * 117 + (104 - widths[index]) / 2,
    y: 28 + Math.floor(index / 3) * 145,
    width: widths[index],
    height: index > 3 ? 56 : 52,
    ...context.initialVelocity(index),
  }));
  const initialSides = items.map((item) => item.x + item.width / 2 < arenaWidth / 2);
  const initialVisualOrder = items.map((item) => item.id).join("");
  const travelled = items.map(() => 0);
  let visualOrderChanged = false;
  let maximumSideChanges = 0;

  for (let frame = 0; frame < 270; frame += 1) {
    const before = items.map((item) => ({ x: item.x, y: item.y }));
    context.step(items, arenaWidth, arenaHeight, 1 / 60);
    items.forEach((item, index) => { travelled[index] += Math.hypot(item.x - before[index].x, item.y - before[index].y); });
    const visualOrder = [...items].sort((left, right) => left.y - right.y || left.x - right.x).map((item) => item.id).join("");
    visualOrderChanged ||= visualOrder !== initialVisualOrder;
    maximumSideChanges = Math.max(maximumSideChanges, items.filter((item, index) => (item.x + item.width / 2 < arenaWidth / 2) !== initialSides[index]).length);
    for (const item of items) {
      assert.ok(item.x >= 0 && item.x + item.width <= arenaWidth, JSON.stringify(item));
      assert.ok(item.y >= 0 && item.y + item.height <= arenaHeight, JSON.stringify(item));
    }
    for (let index = 0; index < items.length; index += 1) for (let other = index + 1; other < items.length; other += 1) {
      const left = items[index]; const right = items[other];
      assert.ok(left.x + left.width <= right.x + 0.001 || right.x + right.width <= left.x + 0.001
        || left.y + left.height <= right.y + 0.001 || right.y + right.height <= left.y + 0.001,
      JSON.stringify({ frame, left, right }));
    }
  }

  assert.ok(travelled.every((distance) => distance >= 200), JSON.stringify(travelled));
  assert.equal(visualOrderChanged, true);
  assert.ok(maximumSideChanges >= 2, String(maximumSideChanges));
});
