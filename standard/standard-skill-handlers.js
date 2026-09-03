"use strict";

const { COLORS, StandardRuleError, mergeSameColorComponent } = require("./standard-engine.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function consume(state, actor, skill) {
  state.hands[actor][skill] -= 1;
  state.skillsUsed[actor] = (state.skillsUsed[actor] || 0) + 1;
  state.version += 1;
}

function resolved(currentState, actor, skill, mutate, details = {}) {
  const state = clone(currentState);
  mutate(state);
  consume(state, actor, skill);
  return Object.freeze({ ok: true, code: "OK", state, ...details });
}

function applyColorPrism({ state, actor }) {
  return resolved(state, actor, "colorPrism", (next) => {
    next.privateEffects[actor] = next.privateEffects[actor] || {};
    next.privateEffects[actor].prism = true;
    next.publicLog.push(`T${next.turn} Player ${actor} enabled all four colors for this coloring.`);
  });
}

function usedBoardColors(state) {
  return [...new Set(Object.values(state.regions).map((region) => region.color).filter((color) => COLORS.includes(color)))];
}

function addTemporaryColor(state, actor, color) {
  state.privateEffects[actor] = state.privateEffects[actor] || {};
  const temporaryColors = new Set(state.privateEffects[actor].temporaryColors || []);
  temporaryColors.add(color);
  state.privateEffects[actor].temporaryColors = [...temporaryColors];
}

function applyColorRandomBorrow({ state, actor, random }) {
  const candidates = usedBoardColors(state);
  if (!candidates.length) return Object.freeze({ ok: false, code: "NO_BOARD_COLORS", state });
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const color = candidates[Math.floor(draw * candidates.length)];
  return resolved(state, actor, "colorRandomBorrow", (next) => {
    addTemporaryColor(next, actor, color);
    next.publicLog.push(`T${next.turn} Player ${actor} used random color borrow; the added color is private.`);
  });
}

function applyColorChoiceBorrow({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  if (!usedBoardColors(state).includes(payload.color)) return Object.freeze({ ok: false, code: "COLOR_NOT_USED_ON_BOARD", state });
  return resolved(state, actor, "colorChoiceBorrow", (next) => {
    addTemporaryColor(next, actor, payload.color);
    next.publicLog.push(`T${next.turn} Player ${actor} used chosen color borrow; the added color is private.`);
  });
}

function paletteColorAt(state, actor, slot) {
  return slot < 2 ? state.basicPalettes[actor][slot] : state.bonusColors[actor];
}

function setPaletteColorAt(state, actor, slot, color) {
  if (slot < 2) state.basicPalettes[actor][slot] = color;
  else state.bonusColors[actor] = color;
}

function clearPaletteDebuffAtSlot(state, actor, slot) {
  state.privateEffects[actor] = state.privateEffects[actor] || {};
  state.privateEffects[actor].paletteDebuffs = (state.privateEffects[actor].paletteDebuffs || []).filter((effect) => effect.slot !== slot);
  if (!state.privateEffects[actor].paletteDebuffs.length) delete state.privateEffects[actor].paletteDebuffs;
}

function applyColorPaletteChange({ state, actor, payload }) {
  if (!Number.isInteger(payload.slot) || payload.slot < 0 || payload.slot > 2 || !COLORS.includes(payload.color)) {
    return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  }
  if (paletteColorAt(state, actor, payload.slot) === payload.color) return Object.freeze({ ok: false, code: "PALETTE_COLOR_UNCHANGED", state });
  return resolved(state, actor, "colorPaletteChange", (next) => {
    clearPaletteDebuffAtSlot(next, actor, payload.slot);
    setPaletteColorAt(next, actor, payload.slot, payload.color);
    next.publicLog.push(`T${next.turn} Player ${actor} permanently changed one private palette slot.`);
  });
}

function microToMacro(cell, state) {
  const x = cell % state.microWidth;
  const y = Math.floor(cell / state.microWidth);
  const scale = state.playableBounds.microScale;
  return Math.floor(y / scale) * state.playableBounds.macroWidth + Math.floor(x / scale);
}

function nextRegionNumber(state) {
  return Math.max(0, ...Object.keys(state.regions).map((id) => Number(String(id).match(/\d+/)?.[0]) || 0)) + 1;
}

function applyColorRegionSplit({ state, actor, payload }) {
  const region = state.regions?.[payload.regionId];
  if (!region || payload.regionId !== state.pending || !region.isPending || region.color) {
    return Object.freeze({ ok: false, code: "INVALID_SPLIT_TARGET", state });
  }
  if ((region.controllers || []).includes(actor)) return Object.freeze({ ok: false, code: "SPLIT_REQUIRES_OPPONENT_REGION", state });
  if (state.reserved) return Object.freeze({ ok: false, code: "SPLIT_ALREADY_RESERVED", state });
  const original = [...new Set(region.sourceMacros || [])].sort((a, b) => a - b);
  const selected = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  const originalSet = new Set(original);
  if (selected.length !== payload.sourceMacros.length || !selected.every((macro) => originalSet.has(macro))) {
    return Object.freeze({ ok: false, code: "INVALID_SPLIT_SELECTION", state });
  }
  const selectedSet = new Set(selected);
  const returned = original.filter((macro) => !selectedSet.has(macro));
  if (!selected.length || !returned.length) return Object.freeze({ ok: false, code: "SPLIT_SIDE_EMPTY", state });
  if (!connected(selected, state.playableBounds.macroWidth) || !connected(returned, state.playableBounds.macroWidth)) {
    return Object.freeze({ ok: false, code: "SPLIT_SIDE_NOT_CONNECTED", state });
  }
  const selectedMicro = region.micro.filter((cell) => selectedSet.has(microToMacro(cell, state))).sort((a, b) => a - b);
  const returnedMicro = region.micro.filter((cell) => !selectedSet.has(microToMacro(cell, state))).sort((a, b) => a - b);
  if (!connected(selectedMicro, state.microWidth) || !connected(returnedMicro, state.microWidth)) {
    return Object.freeze({ ok: false, code: "SPLIT_GEOMETRY_NOT_CONNECTED", state });
  }
  return resolved(state, actor, "colorRegionSplit", (next) => {
    const firstNumber = nextRegionNumber(next);
    const selectedId = `R${firstNumber}`;
    const returnedId = `R${firstNumber + 1}`;
    delete next.regions[payload.regionId];
    next.regions[selectedId] = {
      id: selectedId,
      micro: selectedMicro,
      sourceMacros: selected,
      controllers: [],
      color: null,
      isPending: true,
      isReserved: false,
    };
    next.regions[returnedId] = {
      id: returnedId,
      micro: returnedMicro,
      sourceMacros: returned,
      controllers: [],
      color: null,
      isPending: false,
      isReserved: true,
    };
    next.pending = selectedId;
    next.reserved = returnedId;
    next.publicLog.push(`T${next.turn} Player ${actor} split ${payload.regionId} into ${selectedId} and reserved ${returnedId}.`);
  }, { selectedId: `R${nextRegionNumber(state)}`, returnedId: `R${nextRegionNumber(state) + 1}` });
}

function macroMicroCells(macro, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const col = macro % macroWidth;
  const row = Math.floor(macro / macroWidth);
  const cells = [];
  for (let dy = 0; dy < scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) cells.push((row * scale + dy) * state.microWidth + col * scale + dx);
  }
  return cells;
}

function validOutgoingMacros(state, sourceMacros) {
  const bounds = state.playableBounds;
  if (sourceMacros.length !== state.requiredSize || !connected(sourceMacros, bounds.macroWidth)) return false;
  const occupiedMacros = new Set(Object.values(state.regions).flatMap((region) => region.sourceMacros || []));
  return sourceMacros.every((macro) => {
    if (!Number.isInteger(macro) || macro < 0 || occupiedMacros.has(macro)) return false;
    const col = macro % bounds.macroWidth;
    const row = Math.floor(macro / bounds.macroWidth);
    return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
  });
}

function microCoordinateInPlayable(state, x, y) {
  const macroCol = Math.floor(x / state.playableBounds.microScale);
  const macroRow = Math.floor(y / state.playableBounds.microScale);
  const bounds = state.playableBounds;
  return x >= 0 && x < state.microWidth && y >= 0 && y < bounds.macroWidth * bounds.microScale
    && macroCol >= bounds.minCol && macroCol <= bounds.maxCol && macroRow >= bounds.minRow && macroRow <= bounds.maxRow;
}

function regionOwners(state) {
  return new Map(Object.values(state.regions).flatMap((region) => (region.micro || []).map((cell) => [cell, region.id])));
}

function shapeTouchesRegion(shape, regionId, owners, width) {
  for (const cell of shape) {
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    if (neighbors.some((neighbor) => !shape.has(neighbor) && owners.get(neighbor) === regionId)) return true;
  }
  return false;
}

function microBloomCandidates(state, sourceMacros) {
  if (!validOutgoingMacros(state, sourceMacros)) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", candidates: [] });
  const prepared = state.preparedOutgoing;
  if (prepared && (prepared.actor !== state.active || JSON.stringify(prepared.sourceMacros) !== JSON.stringify(sourceMacros))) {
    return Object.freeze({ ok: false, code: "PREPARED_SELECTION_MISMATCH", candidates: [] });
  }
  const base = new Set(prepared?.micro || sourceMacros.flatMap((macro) => macroMicroCells(macro, state)));
  const owners = regionOwners(state);
  const scale = state.playableBounds.microScale;
  const width = state.microWidth;
  const corners = [
    { name: "top-left", diagonal: [-1, -1], plan: [[-1, 0], [0, -1], [-1, -1]] },
    { name: "top-right", diagonal: [scale, -1], plan: [[scale, 0], [scale - 1, -1], [scale, -1]] },
    { name: "bottom-left", diagonal: [-1, scale], plan: [[-1, scale - 1], [0, scale], [-1, scale]] },
    { name: "bottom-right", diagonal: [scale, scale], plan: [[scale, scale - 1], [scale - 1, scale], [scale, scale]] },
  ];
  const candidates = [];
  for (const macro of sourceMacros) {
    const macroCol = macro % state.playableBounds.macroWidth;
    const macroRow = Math.floor(macro / state.playableBounds.macroWidth);
    const x0 = macroCol * scale;
    const y0 = macroRow * scale;
    for (const corner of corners) {
      const diagonalX = x0 + corner.diagonal[0];
      const diagonalY = y0 + corner.diagonal[1];
      if (!microCoordinateInPlayable(state, diagonalX, diagonalY)) continue;
      const diagonalCell = diagonalY * width + diagonalX;
      const diagonalRegion = owners.get(diagonalCell);
      if (!diagonalRegion || !state.regions[diagonalRegion]?.color || shapeTouchesRegion(base, diagonalRegion, owners, width)) continue;
      const plan = new Set();
      for (const [dx, dy] of corner.plan) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (!microCoordinateInPlayable(state, x, y)) continue;
        const cell = y * width + x;
        if (base.has(cell) || plan.has(cell)) continue;
        const owner = owners.get(cell);
        if (owner && !state.regions[owner]?.color) continue;
        const cellX = cell % width;
        const neighbors = [cell - width, cell + width];
        if (cellX > 0) neighbors.push(cell - 1);
        if (cellX < width - 1) neighbors.push(cell + 1);
        if (neighbors.some((neighbor) => base.has(neighbor) || plan.has(neighbor))) plan.add(cell);
      }
      if (!plan.size) continue;
      const expanded = new Set([...base, ...plan]);
      if (shapeTouchesRegion(expanded, diagonalRegion, owners, width)) {
        candidates.push(Object.freeze({ macro, corner: corner.name, diagonalRegion, plan: Object.freeze([...plan].sort((a, b) => a - b)), micro: Object.freeze([...expanded].sort((a, b) => a - b)) }));
      }
    }
  }
  return Object.freeze({ ok: true, candidates: Object.freeze(candidates) });
}

function cornerBloomPlan(state, sourceMacros, macro) {
  if (!validOutgoingMacros(state, sourceMacros)) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", plan: [], micro: [] });
  const prepared = state.preparedOutgoing;
  if (prepared && (prepared.actor !== state.active || JSON.stringify(prepared.sourceMacros) !== JSON.stringify(sourceMacros))) {
    return Object.freeze({ ok: false, code: "PREPARED_SELECTION_MISMATCH", plan: [], micro: [] });
  }
  if (!sourceMacros.includes(macro)) return Object.freeze({ ok: false, code: "INVALID_CORNER_BLOOM_TARGET", plan: [], micro: [] });
  const shape = new Set(prepared?.micro || sourceMacros.flatMap((sourceMacro) => macroMicroCells(sourceMacro, state)));
  const owners = regionOwners(state);
  const scale = state.playableBounds.microScale;
  const width = state.microWidth;
  const macroCol = macro % state.playableBounds.macroWidth;
  const macroRow = Math.floor(macro / state.playableBounds.macroWidth);
  const x0 = macroCol * scale;
  const y0 = macroRow * scale;
  const corners = [
    [[-1, 0], [0, -1], [-1, -1]],
    [[scale, 0], [scale - 1, -1], [scale, -1]],
    [[-1, scale - 1], [0, scale], [-1, scale]],
    [[scale, scale - 1], [scale - 1, scale], [scale, scale]],
  ];
  const planned = new Set();
  for (const corner of corners) {
    const cornerPlan = new Set();
    for (let pass = 0; pass < 3; pass += 1) {
      for (const [dx, dy] of corner) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (!microCoordinateInPlayable(state, x, y)) continue;
        const cell = y * width + x;
        if (shape.has(cell) || planned.has(cell) || cornerPlan.has(cell)) continue;
        const owner = owners.get(cell);
        if (owner && !state.regions[owner]?.color) continue;
        const cellX = cell % width;
        const neighbors = [cell - width, cell + width];
        if (cellX > 0) neighbors.push(cell - 1);
        if (cellX < width - 1) neighbors.push(cell + 1);
        if (neighbors.some((neighbor) => shape.has(neighbor) || planned.has(neighbor) || cornerPlan.has(neighbor))) cornerPlan.add(cell);
      }
    }
    for (const cell of cornerPlan) planned.add(cell);
  }
  return Object.freeze({
    ok: true,
    plan: Object.freeze([...planned].sort((a, b) => a - b)),
    micro: Object.freeze([...new Set([...shape, ...planned])].sort((a, b) => a - b)),
  });
}

function preparedOutgoingCandidates(state, sourceMacros, skills) {
  let shapes = [null];
  for (const skill of skills) {
    const nextShapes = [];
    for (const micro of shapes) {
      const candidateState = { ...state, preparedOutgoing: micro ? { actor: state.active, sourceMacros, micro, skills: [] } : null };
      if (skill === "areaMicroBloom") {
        const result = microBloomCandidates(candidateState, sourceMacros);
        if (result.ok) for (const candidate of result.candidates) nextShapes.push([...candidate.micro]);
      } else if (skill === "areaCornerBloom") {
        for (const macro of sourceMacros) {
          const result = cornerBloomPlan(candidateState, sourceMacros, macro);
          if (result.ok && result.plan.length) nextShapes.push([...result.micro]);
        }
      }
    }
    const unique = new Map(nextShapes.map((micro) => [JSON.stringify(micro), micro]));
    shapes = [...unique.values()];
  }
  return Object.freeze(shapes.map((micro) => Object.freeze(micro)));
}

function applyAreaMicroBloom({ state, actor, payload, random }) {
  const sourceMacros = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  if (sourceMacros.length !== payload.sourceMacros.length) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", state });
  const planned = microBloomCandidates(state, sourceMacros);
  if (!planned.ok) return Object.freeze({ ok: false, code: planned.code, state });
  if (!planned.candidates.length) return Object.freeze({ ok: false, code: "NO_MICRO_BLOOM_CANDIDATE", state });
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const picked = planned.candidates[Math.floor(draw * planned.candidates.length)];
  return resolved(state, actor, "areaMicroBloom", (next) => {
    next.preparedOutgoing = {
      actor,
      sourceMacros,
      micro: [...picked.micro],
      skills: [...new Set([...(next.preparedOutgoing?.skills || []), "areaMicroBloom"])],
    };
    next.publicLog.push(`T${next.turn} Player ${actor} used micro bloom at ${picked.macro} ${picked.corner}, creating edge contact with ${picked.diagonalRegion}.`);
  }, { macro: picked.macro, corner: picked.corner, diagonalRegion: picked.diagonalRegion, addedCount: picked.plan.length });
}

function applyAreaCornerBloom({ state, actor, payload }) {
  const sourceMacros = [...new Set(payload.sourceMacros)].sort((a, b) => a - b);
  if (sourceMacros.length !== payload.sourceMacros.length) return Object.freeze({ ok: false, code: "INVALID_OUTGOING_SELECTION", state });
  const planned = cornerBloomPlan(state, sourceMacros, payload.macro);
  if (!planned.ok) return Object.freeze({ ok: false, code: planned.code, state });
  if (!planned.plan.length) return Object.freeze({ ok: false, code: "NO_CORNER_BLOOM_CANDIDATE", state });
  return resolved(state, actor, "areaCornerBloom", (next) => {
    next.preparedOutgoing = {
      actor,
      sourceMacros,
      micro: [...planned.micro],
      skills: [...new Set([...(next.preparedOutgoing?.skills || []), "areaCornerBloom"])],
    };
    next.publicLog.push(`T${next.turn} Player ${actor} expanded all available corners of macro ${payload.macro}, adding ${planned.plan.length} microcells.`);
  }, { macro: payload.macro, addedCount: planned.plan.length });
}

function applyAreaDiePlus({ state, actor, hasLegalRegionOfSize }) {
  const desired = state.requiredSize + 1;
  if (desired > 5) return Object.freeze({ ok: false, code: "AREA_SIZE_MAX", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  if (typeof hasLegalRegionOfSize !== "function" || !hasLegalRegionOfSize(state, desired)) {
    return Object.freeze({ ok: false, code: "NO_LEGAL_REGION_SIZE", state });
  }
  return resolved(state, actor, "areaDiePlus", (next) => {
    next.requiredSize = desired;
    next.publicLog.push(`T${next.turn} Player ${actor} increased this turn's required area size to ${desired}.`);
  }, { requiredSize: desired });
}

function resizedBounds(state, mode, side) {
  if (!["expand", "shrink"].includes(mode) || !["top", "bottom", "left", "right"].includes(side)) return null;
  const bounds = state.playableBounds;
  const width = bounds.maxCol - bounds.minCol + 1;
  const height = bounds.maxRow - bounds.minRow + 1;
  const next = { ...bounds };
  if (mode === "expand") {
    if (side === "left" && bounds.minCol > 0) next.minCol -= 1;
    else if (side === "right" && bounds.maxCol < bounds.macroWidth - 1) next.maxCol += 1;
    else if (side === "top" && bounds.minRow > 0) next.minRow -= 1;
    else if (side === "bottom" && bounds.maxRow < bounds.macroWidth - 1) next.maxRow += 1;
    else return null;
  } else {
    if (["left", "right"].includes(side) && width <= 6) return null;
    if (["top", "bottom"].includes(side) && height <= 6) return null;
    if (side === "left") next.minCol += 1;
    else if (side === "right") next.maxCol -= 1;
    else if (side === "top") next.minRow += 1;
    else next.maxRow -= 1;
  }
  return next;
}

function playableMacros(bounds) {
  const result = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) result.push(row * bounds.macroWidth + col);
  }
  return result;
}

function applyAreaResize({ state, actor, payload, bestLegalSize }) {
  const nextBounds = resizedBounds(state, payload.mode, payload.side);
  if (!nextBounds) return Object.freeze({ ok: false, code: "BOARD_SIDE_UNAVAILABLE", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  if (typeof bestLegalSize !== "function") return Object.freeze({ ok: false, code: "LEGAL_SIZE_SERVICE_REQUIRED", state });
  const bonus = Math.max(0, state.requiredSize - state.baseRequiredSize);
  return resolved(state, actor, "areaResize", (next) => {
    const targets = new Set(next.trophyTargetMacros || playableMacros(state.playableBounds));
    next.playableBounds = nextBounds;
    if (payload.mode === "expand") {
      for (const macro of playableMacros(nextBounds)) targets.add(macro);
    }
    next.trophyTargetMacros = [...targets].sort((left, right) => left - right);
    const base = bestLegalSize(next, next.rolledSize);
    next.baseRequiredSize = base;
    if (base <= 0) {
      next.requiredSize = 0;
      next.status = "FINISHED";
      next.phase = "GAME_OVER";
      next.winner = actor;
      next.terminalReason = "BOARD_LOCK";
    } else {
      next.requiredSize = bestLegalSize(next, Math.min(5, base + bonus)) || base;
    }
    next.publicLog.push(`T${next.turn} Player ${actor} ${payload.mode === "expand" ? "expanded" : "shrunk"} the ${payload.side} writable board edge; colored geometry remains.`);
  }, { playableBounds: nextBounds });
}

function normalizeHalfShift(payload) {
  const axis = String(payload.axis || "").toUpperCase();
  const direction = String(payload.direction || "").toLowerCase();
  const index = Number(payload.index);
  if (!Number.isInteger(index) || !["ROW", "COLUMN"].includes(axis)) return null;
  const minus = ["minus", "left", "up", "-"].includes(direction);
  const plus = ["plus", "right", "down", "+"].includes(direction);
  if (!minus && !plus) return null;
  return { axis, index, delta: minus ? -2 : 2, direction: minus ? "minus" : "plus" };
}

function connected(cells, width) {
  if (!cells.length) return false;
  const remaining = new Set(cells);
  const queue = [cells[0]];
  remaining.delete(cells[0]);
  while (queue.length) {
    const cell = queue.shift();
    const x = cell % width;
    const neighbors = [cell - width, cell + width];
    if (x > 0) neighbors.push(cell - 1);
    if (x < width - 1) neighbors.push(cell + 1);
    for (const neighbor of neighbors) if (remaining.delete(neighbor)) queue.push(neighbor);
  }
  return remaining.size === 0;
}

function connectedComponents(cells, width) {
  const remaining = new Set(cells);
  const parts = [];
  while (remaining.size) {
    const start = Math.min(...remaining);
    const part = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const cell = queue.shift();
      part.push(cell);
      const x = cell % width;
      const neighbors = [cell - width, cell + width];
      if (x > 0) neighbors.push(cell - 1);
      if (x < width - 1) neighbors.push(cell + 1);
      for (const neighbor of neighbors) if (remaining.delete(neighbor)) queue.push(neighbor);
    }
    parts.push(part.sort((a, b) => a - b));
  }
  return parts.sort((a, b) => a[0] - b[0]);
}

function sourceMacrosFromMicro(cells, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  return [...new Set(cells.map((cell) => {
    const x = cell % state.microWidth;
    const y = Math.floor(cell / state.microWidth);
    return Math.floor(y / scale) * macroWidth + Math.floor(x / scale);
  }))].sort((a, b) => a - b);
}

function planHalfShift(state, payload) {
  const request = normalizeHalfShift(payload);
  if (!request) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const width = state.microWidth;
  const height = macroWidth * scale;
  if (request.index < 0 || request.index >= macroWidth) return Object.freeze({ ok: false, code: "INVALID_SHIFT_BAND", state });
  const sets = {};
  let movedCount = 0;
  for (const [id, region] of Object.entries(state.regions)) {
    sets[id] = region.micro.map((cell) => {
      const x = cell % width;
      const y = Math.floor(cell / width);
      const inBand = request.axis === "ROW"
        ? Math.floor(y / scale) === request.index
        : Math.floor(x / scale) === request.index;
      if (!inBand) return cell;
      movedCount += 1;
      return request.axis === "ROW" ? cell + request.delta : cell + request.delta * width;
    });
  }
  if (!movedCount) return Object.freeze({ ok: false, code: "EMPTY_SHIFT_BAND", state });
  const occupied = new Set();
  let splitCount = 0;
  for (const cells of Object.values(sets)) {
    splitCount += Math.max(0, connectedComponents(cells, width).length - 1);
    for (const cell of cells) {
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (!Number.isInteger(cell) || x < 0 || x >= width || y < 0 || y >= height) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
      if (occupied.has(cell)) return Object.freeze({ ok: false, code: "SHIFT_OVERLAP", state });
      occupied.add(cell);
    }
  }
  return Object.freeze({ ok: true, ...request, movedCount, splitCount, sets });
}

function applyAreaHalfShift({ state, actor, payload }) {
  const plan = planHalfShift(state, payload);
  if (!plan.ok) return plan;
  return resolved(state, actor, "areaHalfShift", (next) => {
    for (const [id, cells] of Object.entries(plan.sets)) {
      next.regions[id].micro = [...cells].sort((a, b) => a - b);
      next.regions[id].sourceMacros = sourceMacrosFromMicro(cells, next);
    }
    let nextNumber = Math.max(0, ...Object.keys(next.regions).map((id) => Number(String(id).match(/\d+/)?.[0]) || 0)) + 1;
    for (const id of Object.keys(plan.sets).sort()) {
      const region = next.regions[id];
      const parts = connectedComponents(region.micro, next.microWidth);
      region.micro = parts[0];
      region.sourceMacros = sourceMacrosFromMicro(parts[0], next);
      for (const part of parts.slice(1)) {
        const newId = `R${nextNumber}`;
        nextNumber += 1;
        next.regions[newId] = {
          ...region,
          id: newId,
          micro: part,
          sourceMacros: sourceMacrosFromMicro(part, next),
          controllers: [...(region.controllers || [])],
          isPending: false,
        };
      }
    }
    const ids = Object.keys(next.regions).sort();
    for (const id of ids) if (next.regions[id]) mergeSameColorComponent(next, id);
    next.publicLog.push(`T${next.turn} Player ${actor} shifted ${plan.axis} ${plan.index} ${plan.direction} by half a macro cell${plan.splitCount ? `; split into ${plan.splitCount + 1} components` : ""}.`);
  }, { movedCount: plan.movedCount, splitCount: plan.splitCount, axis: plan.axis, index: plan.index, direction: plan.direction });
}

function planTripleShift(state, payload) {
  const request = normalizeHalfShift(payload);
  if (!request) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  const width = state.microWidth;
  const height = macroWidth * scale;
  if (request.index <= 0 || request.index >= macroWidth - 1) return Object.freeze({ ok: false, code: "INVALID_SHIFT_BAND", state });
  if (state.preparedOutgoing) return Object.freeze({ ok: false, code: "PREPARED_OUTGOING_EXISTS", state });
  const deltaByBand = new Map([
    [request.index - 1, request.delta],
    [request.index, request.delta * 2],
    [request.index + 1, request.delta],
  ]);
  const sets = {};
  let movedCount = 0;
  let outsideWorld = false;
  for (const [id, region] of Object.entries(state.regions)) {
    const cells = region.micro.map((cell) => {
      const x = cell % width;
      const y = Math.floor(cell / width);
      const band = request.axis === "ROW" ? Math.floor(y / scale) : Math.floor(x / scale);
      const delta = deltaByBand.get(band) || 0;
      if (!delta) return cell;
      movedCount += 1;
      const nextX = request.axis === "ROW" ? x + delta : x;
      const nextY = request.axis === "COLUMN" ? y + delta : y;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) outsideWorld = true;
      return nextY * width + nextX;
    });
    if (outsideWorld) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
    if (!connected(cells, width)) return Object.freeze({ ok: false, code: "SHIFT_DISCONNECTS_REGION", state });
    sets[id] = cells;
  }
  if (!movedCount) return Object.freeze({ ok: false, code: "EMPTY_SHIFT_BAND", state });
  const occupied = new Set();
  for (const cells of Object.values(sets)) {
    for (const cell of cells) {
      const x = cell % width;
      const y = Math.floor(cell / width);
      if (!Number.isInteger(cell) || x < 0 || x >= width || y < 0 || y >= height) return Object.freeze({ ok: false, code: "SHIFT_OUT_OF_WORLD", state });
      if (occupied.has(cell)) return Object.freeze({ ok: false, code: "SHIFT_OVERLAP", state });
      occupied.add(cell);
    }
  }
  return Object.freeze({ ok: true, ...request, movedCount, sets });
}

function applyAreaTripleShift({ state, actor, payload }) {
  const plan = planTripleShift(state, payload);
  if (!plan.ok) return plan;
  return resolved(state, actor, "areaTripleShift", (next) => {
    for (const [id, cells] of Object.entries(plan.sets)) {
      next.regions[id].micro = [...cells].sort((a, b) => a - b);
      next.regions[id].sourceMacros = sourceMacrosFromMicro(cells, next);
    }
    const ids = Object.keys(next.regions).sort();
    for (const id of ids) if (next.regions[id]) mergeSameColorComponent(next, id);
    next.publicLog.push(`T${next.turn} Player ${actor} shifted ${plan.axis} ${plan.index} ${plan.direction}; the center band moved one macro and both adjacent bands moved half a macro.`);
  }, { movedCount: plan.movedCount, axis: plan.axis, index: plan.index, direction: plan.direction });
}

function applyDisruptChoiceOne({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceOne", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 1);
    next.privateEffects[actor] = next.privateEffects[actor] || {};
    next.privateEffects[actor].curseBacklash = (next.privateEffects[actor].curseBacklash || 0) + 1;
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target}; curse backlash is pending.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptChoiceTwo({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceTwo", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 2);
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target} for the next two colorings.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptChoiceThree({ state, actor, payload }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  return resolved(state, actor, "disruptChoiceThree", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[payload.color] = Math.max(next.publicEffects[target].seals[payload.color] || 0, 3);
    next.publicLog.push(`T${next.turn} Player ${actor} sealed ${payload.color} for Player ${target} for the next three colorings.`);
  }, { color: payload.color, target: other(actor) });
}

function applyDisruptRandomOne({ state, actor, random }) {
  const draw = Number(random());
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  const color = COLORS[Math.floor(draw * COLORS.length)];
  return resolved(state, actor, "disruptRandomOne", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    next.publicEffects[target].seals[color] = Math.max(next.publicEffects[target].seals[color] || 0, 1);
    next.publicLog.push(`T${next.turn} Player ${actor} randomly sealed ${color} for Player ${target} for the next coloring.`);
  }, { color, target: other(actor) });
}

function applyDisruptRandomTwo({ state, actor, random }) {
  const firstDraw = Number(random());
  const secondDraw = Number(random());
  if (![firstDraw, secondDraw].every((draw) => Number.isFinite(draw) && draw >= 0 && draw < 1)) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const remaining = [...COLORS];
  const colors = [remaining.splice(Math.floor(firstDraw * remaining.length), 1)[0]];
  colors.push(remaining[Math.floor(secondDraw * remaining.length)]);
  return resolved(state, actor, "disruptRandomTwo", (next) => {
    const target = other(actor);
    next.publicEffects[target] = next.publicEffects[target] || { seals: {} };
    next.publicEffects[target].seals = next.publicEffects[target].seals || {};
    for (const color of colors) next.publicEffects[target].seals[color] = Math.max(next.publicEffects[target].seals[color] || 0, 1);
    next.publicLog.push(`T${next.turn} Player ${actor} randomly sealed ${colors.join(",")} for Player ${target} for the next coloring.`);
  }, { colors, target: other(actor) });
}

function applyDisruptPaletteRandom({ state, actor, random }) {
  const colorDraw = Number(random());
  const slotDraw = Number(random());
  if (![colorDraw, slotDraw].every((draw) => Number.isFinite(draw) && draw >= 0 && draw < 1)) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = COLORS[Math.floor(colorDraw * COLORS.length)];
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptPaletteRandom", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    const previousColor = paletteColorAt(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.privateEffects[target].paletteDebuffs = [{ slot, previousColor, injectedColor: color, remaining: 1 }, ...(next.privateEffects[target].paletteDebuffs || [])];
    next.publicLog.push(`T${next.turn} Player ${actor} randomly injected ${color} into one private palette slot of Player ${target} for the next coloring.`);
  }, { color, target });
}

function applyDisruptPaletteChoice({ state, actor, payload, random }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const slotDraw = Number(random());
  if (!Number.isFinite(slotDraw) || slotDraw < 0 || slotDraw >= 1) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = payload.color;
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptPaletteChoice", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    const previousColor = paletteColorAt(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.privateEffects[target].paletteDebuffs = [{ slot, previousColor, injectedColor: color, remaining: 2 }, ...(next.privateEffects[target].paletteDebuffs || [])];
    next.publicLog.push(`T${next.turn} Player ${actor} injected chosen ${color} into one private palette slot of Player ${target} for the next two colorings.`);
  }, { color, target });
}

function applyDisruptForcedPalette({ state, actor, payload, random }) {
  if (!COLORS.includes(payload.color)) return Object.freeze({ ok: false, code: "INVALID_TARGET_SCHEMA", state });
  const slotDraw = Number(random());
  if (!Number.isFinite(slotDraw) || slotDraw < 0 || slotDraw >= 1) {
    throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
  }
  const color = payload.color;
  const target = other(actor);
  const palette = [state.basicPalettes[target][0], state.basicPalettes[target][1], state.bonusColors[target]];
  const differing = palette.map((current, slot) => current !== color ? slot : -1).filter((slot) => slot >= 0);
  const slots = differing.length ? differing : [0, 1, 2];
  const slot = slots[Math.floor(slotDraw * slots.length)];
  return resolved(state, actor, "disruptForcedPalette", (next) => {
    next.privateEffects[target] = next.privateEffects[target] || {};
    const existing = (next.privateEffects[target].paletteDebuffs || []).filter((effect) => effect.slot === slot).sort((left, right) => right.remaining - left.remaining);
    for (const effect of existing) if (paletteColorAt(next, target, slot) === effect.injectedColor) setPaletteColorAt(next, target, slot, effect.previousColor);
    clearPaletteDebuffAtSlot(next, target, slot);
    setPaletteColorAt(next, target, slot, color);
    next.publicLog.push(`T${next.turn} Player ${actor} permanently injected chosen ${color} into one private palette slot of Player ${target}.`);
  }, { color, target });
}

function paletteBeforeSeals(state, actor) {
  const colors = new Set(state.basicPalettes[actor]);
  if (state.bonusUsesRemaining[actor] > 0) colors.add(state.bonusColors[actor]);
  if (state.privateEffects[actor]?.prism) for (const color of COLORS) colors.add(color);
  return [...colors];
}

function applyCurseBacklashOnEnterColor(state, actor, random) {
  const count = Math.max(0, Number(state.privateEffects[actor]?.curseBacklash) || 0);
  if (!count) return state;
  state.publicEffects[actor] = state.publicEffects[actor] || { seals: {} };
  state.publicEffects[actor].seals = state.publicEffects[actor].seals || {};
  const sealed = [];
  for (let index = 0; index < count; index += 1) {
    const candidates = paletteBeforeSeals(state, actor).filter((color) => !(state.publicEffects[actor].seals[color] > 0));
    if (!candidates.length) break;
    const draw = Number(random());
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StandardRuleError("RNG_REQUIRED_SKILL_EFFECT", "Named RNG stream is required");
    const color = candidates[Math.floor(draw * candidates.length)];
    state.publicEffects[actor].seals[color] = Math.max(state.publicEffects[actor].seals[color] || 0, 1);
    sealed.push(color);
  }
  delete state.privateEffects[actor].curseBacklash;
  state.publicLog.push(sealed.length
    ? `Curse backlash sealed ${sealed.join(",")} for Player ${actor} for this coloring.`
    : `Curse backlash resolved empty for Player ${actor}.`);
  return state;
}

function tickSealsAfterColor(state, actor) {
  const seals = state.publicEffects?.[actor]?.seals || {};
  for (const color of COLORS) if (seals[color] > 0) seals[color] -= 1;
  return state;
}

function tickPaletteDebuffsAfterColor(state, actor) {
  const effects = state.privateEffects?.[actor]?.paletteDebuffs || [];
  const remaining = [];
  for (const effect of effects) {
    const nextRemaining = effect.remaining - 1;
    if (nextRemaining > 0) remaining.push({ ...effect, remaining: nextRemaining });
    else if (paletteColorAt(state, actor, effect.slot) === effect.injectedColor) setPaletteColorAt(state, actor, effect.slot, effect.previousColor);
  }
  if (remaining.length) state.privateEffects[actor].paletteDebuffs = remaining;
  else if (state.privateEffects?.[actor]) delete state.privateEffects[actor].paletteDebuffs;
  return state;
}

module.exports = {
  applyAreaCornerBloom,
  applyAreaDiePlus,
  applyAreaHalfShift,
  applyAreaMicroBloom,
  applyAreaResize,
  applyAreaTripleShift,
  applyColorChoiceBorrow,
  applyColorPaletteChange,
  applyColorRandomBorrow,
  applyColorPrism,
  applyColorRegionSplit,
  applyCurseBacklashOnEnterColor,
  applyDisruptChoiceOne,
  applyDisruptChoiceThree,
  applyDisruptChoiceTwo,
  applyDisruptForcedPalette,
  applyDisruptPaletteChoice,
  applyDisruptRandomOne,
  applyDisruptRandomTwo,
  applyDisruptPaletteRandom,
  microBloomCandidates,
  cornerBloomPlan,
  preparedOutgoingCandidates,
  planHalfShift,
  planTripleShift,
  tickSealsAfterColor,
  tickPaletteDebuffsAfterColor,
};
