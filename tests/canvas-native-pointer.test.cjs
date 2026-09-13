"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { clickCanvasFraction } = require("./helpers/canvas-native-pointer.cjs");

test("canvas pointer measures after native actionability and retains one unforced click", async () => {
  const calls = [];
  let width = 328;
  const canvas = {
    async click(options) {
      calls.push(["click", options]);
      if (options.trial) width = 292;
    },
    async evaluate(measure) {
      calls.push(["measure"]);
      return measure({ getBoundingClientRect: () => ({ width, height: width }), clientLeft: 3, clientTop: 3 });
    },
  };
  const result = await clickCanvasFraction(canvas, { x: 0.45, y: 4.5 / 12 });
  assert.deepEqual(calls, [
    ["click", { trial: true }], ["measure"],
    ["click", { position: { x: 292 * 0.45 - 3, y: 292 * (4.5 / 12) - 3 } }],
  ]);
  assert.equal(result.width, 292);
});

test("canvas pointer rejects outside or nonfinite fractions before any browser input", async () => {
  const canvas = { click() { assert.fail("invalid point must not reach native input"); } };
  for (const fraction of [null, { x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0.5, y: -1 },
    { x: Infinity, y: 0.5 }, { x: 0.5, y: NaN }]) {
    await assert.rejects(clickCanvasFraction(canvas, fraction), RangeError);
  }
});

test("canvas pointer never turns unmeasurable geometry into a real click", async () => {
  for (const geometry of [null, { width: 0, height: 100, borderLeft: 0, borderTop: 0 },
    { width: 100, height: 100, borderLeft: -1, borderTop: 0 }]) {
    const clicks = [];
    await assert.rejects(clickCanvasFraction({
      async click(options) { clicks.push(options); },
      async evaluate() { return geometry; },
    }, { x: 0.45, y: 4.5 / 12 }), /measurable geometry/);
    assert.deepEqual(clicks, [{ trial: true }]);
  }
});
