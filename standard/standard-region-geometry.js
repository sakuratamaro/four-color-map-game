"use strict";

function connected(cellsInput, width) {
  if (!cellsInput.length) return false;
  const cells = new Set(cellsInput);
  const seen = new Set([cellsInput[0]]);
  const queue = [cellsInput[0]];
  while (queue.length) {
    const cell = queue.shift();
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    for (const neighbor of neighbors) {
      if (cells.has(neighbor) && !seen.has(neighbor)) {
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return seen.size === cells.size;
}

function macroMicroCells(macro, bounds, microWidth) {
  const col = macro % bounds.macroWidth;
  const row = Math.floor(macro / bounds.macroWidth);
  const result = [];
  for (let dy = 0; dy < bounds.microScale; dy += 1) {
    for (let dx = 0; dx < bounds.microScale; dx += 1) {
      result.push((row * bounds.microScale + dy) * microWidth + col * bounds.microScale + dx);
    }
  }
  return result;
}

function createRegionGeometryContext(state) {
  const bounds = state.playableBounds;
  const microWidth = state.microWidth || bounds.macroWidth * bounds.microScale;
  const ownerByMicro = new Map();
  for (const region of Object.values(state.regions || {})) {
    for (const cell of region.micro || []) ownerByMicro.set(cell, region.id);
  }

  function analyze(sourceMacros) {
    const micro = [];
    let everyMacroHasFree = true;
    for (const macro of sourceMacros) {
      const free = macroMicroCells(macro, bounds, microWidth).filter((cell) => !ownerByMicro.has(cell));
      if (!free.length) everyMacroHasFree = false;
      micro.push(...free);
    }
    const shape = new Set(micro);
    const adjacentIds = new Set();
    for (const cell of micro) {
      const x = cell % microWidth;
      const neighbors = [cell - microWidth, cell + microWidth];
      if (x > 0) neighbors.push(cell - 1);
      if (x < microWidth - 1) neighbors.push(cell + 1);
      for (const neighbor of neighbors) {
        if (shape.has(neighbor)) continue;
        const regionId = ownerByMicro.get(neighbor);
        if (!regionId) continue;
        adjacentIds.add(regionId);
      }
    }
    const contactColors = [...new Set([...adjacentIds]
      .map((id) => state.regions?.[id]?.color)
      .filter(Boolean))].sort();
    return Object.freeze({
      micro: Object.freeze(micro),
      everyMacroHasFree,
      connected: connected(micro, microWidth),
      touchesExisting: adjacentIds.size > 0,
      adjacentRegionIds: Object.freeze([...adjacentIds].sort()),
      contactColors: Object.freeze(contactColors),
    });
  }

  return Object.freeze({ analyze });
}

module.exports = { createRegionGeometryContext };
