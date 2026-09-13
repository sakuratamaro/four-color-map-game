"use strict";

// Read dimensions only after native actionability/scroll checks settle the canvas.
// This test helper does not force an action, dispatch a DOM event or retry a click.
async function clickCanvasFraction(canvas, fraction) {
  for (const key of ["x", "y"]) {
    if (!Number.isFinite(fraction?.[key]) || fraction[key] <= 0 || fraction[key] >= 1)
      throw new RangeError("Canvas fraction must be strictly inside the canvas");
  }
  await canvas.click({ trial: true });
  const box = await canvas.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height,
      borderLeft: el.clientLeft, borderTop: el.clientTop };
  });
  if (!box || ![box.width, box.height, box.borderLeft, box.borderTop].every(Number.isFinite)
      || box.width <= 0 || box.height <= 0 || box.borderLeft < 0 || box.borderTop < 0)
    throw new Error("Canvas has no measurable geometry");
  // Locator positions are padding-box relative; the game's grid uses the border box.
  const position = { x: box.width * fraction.x - box.borderLeft,
    y: box.height * fraction.y - box.borderTop };
  if (position.x < 0 || position.y < 0) throw new RangeError("Canvas point is within its border");
  await canvas.click({ position });
  return { ...box, position };
}

module.exports = { clickCanvasFraction };
