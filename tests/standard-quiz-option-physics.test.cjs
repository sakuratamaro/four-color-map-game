"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "..", "standard-online-v5", "app.js"), "utf8");
const start = app.indexOf("function advanceQuizOptionPhysics(");
const end = app.indexOf("function applyQuizOptionPhysicsPositions(");
assert.ok(start >= 0 && end > start, "physics step must remain independently testable");
const context = vm.createContext({});
new vm.Script(`${app.slice(start, end)}\nglobalThis.step = advanceQuizOptionPhysics;`).runInContext(context);

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
