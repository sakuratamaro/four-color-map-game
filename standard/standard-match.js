"use strict";

const {
  COLORS,
  StandardRuleError,
  adjacentRegionIds,
} = require("./standard-engine.js");
const { dispatchStandardSkillAction } = require("./standard-skill-dispatcher.js");
const { applyCurseBacklashOnEnterColor, preparedOutgoingCandidates, tickPaletteDebuffsAfterColor, tickSealsAfterColor } = require("./standard-skill-handlers.js");

const SCHEMA_VERSION = 1;
const ENGINE_VERSION = "5.0.0-alpha.1";
const SAVE_KEY = "fourColorMapGame.standard.v5.save";
const PHASES = Object.freeze(["CREATE_FIRST", "COLOR", "WORK", "GAME_OVER"]);
const ACTIONS = Object.freeze(["CREATE_REGION", "COLOR_REGION", "USE_SKILL", "DECLARE_NO_COLOR", "SURRENDER"]);
const REQUIRED_RNG_STREAMS = Object.freeze([
  "match-init", "palette", "bonus-color", "bonus-use-count", "die", "skill-effect",
  "cpu-A", "cpu-B", "cpu-tie-break", "quiz-structure", "quiz-content",
  "quiz-choice-order", "quiz-choice-rank", "quiz-cosmetic-motion", "gacha",
]);
const DIE_POOL = Object.freeze([1, 1, 2, 2, 3, 4]);
const BONUS_USE_POOL = Object.freeze([1, 1, 2, 2, 3, 4]);
const TERMINAL_REASONS = Object.freeze(["ILLEGAL_COLOR", "BOARD_LOCK", "SURRENDER", "SEALED_OUT", "NO_LEGAL_COLOR"]);
const ENGINE_TERMINAL_REASONS = TERMINAL_REASONS;
const FINISHED_STATE_TERMINAL_REASONS = TERMINAL_REASONS;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fail(code, state) {
  return Object.freeze({ ok: false, code, state });
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function assertState(condition, code) {
  if (!condition) throw new StandardRuleError(code, code);
}

function nextRandom(rngStreams, name) {
  const source = rngStreams?.[name];
  const value = typeof source === "function" ? source() : source?.next?.();
  assertState(Number.isFinite(value) && value >= 0 && value < 1, "RNG_REQUIRED_" + name.toUpperCase().replaceAll("-", "_"));
  return value;
}

function shuffledColors(rngStreams) {
  const values = [...COLORS];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(nextRandom(rngStreams, "palette") * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values.slice(0, 3);
}

function initialSeatSecrets(rngStreams) {
  const palette = shuffledColors(rngStreams);
  const bonus = palette[Math.floor(nextRandom(rngStreams, "bonus-color") * palette.length)];
  const basic = palette.filter((color) => color !== bonus);
  const uses = BONUS_USE_POOL[Math.floor(nextRandom(rngStreams, "bonus-use-count") * BONUS_USE_POOL.length)];
  return { basic, bonus, uses };
}

function paletteSignature(secrets) {
  return [...secrets.basic, secrets.bonus].sort().join("|");
}

function handFromLoadout(loadout = {}) {
  const hand = {};
  for (const entries of Object.values(loadout)) {
    for (const skill of Array.isArray(entries) ? entries : []) hand[skill] = 1;
  }
  return hand;
}

function playableMacroIndices(bounds) {
  const result = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) result.push(row * bounds.macroWidth + col);
  }
  return result;
}

function createStandardMatch(config = {}, rngStreams = {}) {
  assertState(typeof config.matchId === "string" && config.matchId.length > 0, "MATCH_ID_REQUIRED");
  const A = initialSeatSecrets(rngStreams);
  let B = initialSeatSecrets(rngStreams);
  for (let retries = 0; paletteSignature(B) === paletteSignature(A) && retries < 15; retries += 1) {
    B = initialSeatSecrets(rngStreams);
  }
  if (paletteSignature(B) === paletteSignature(A)) {
    const missing = COLORS.find((color) => ![...B.basic, B.bonus].includes(color));
    B = { ...B, basic: [B.basic[1], missing] };
  }
  const active = config.firstSeat || (nextRandom(rngStreams, "match-init") < 0.5 ? "A" : "B");
  const rolledSize = DIE_POOL[Math.floor(nextRandom(rngStreams, "die") * DIE_POOL.length)];
  const loadouts = clone(config.loadouts || { A: {}, B: {} });
  const playableBounds = clone(config.playableBounds || { minCol: 1, maxCol: 10, minRow: 1, maxRow: 10, macroWidth: 12, microScale: 4 });
  const state = {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    mode: "standard",
    matchId: config.matchId,
    status: "ACTIVE",
    version: 0,
    turn: 1,
    active,
    phase: "CREATE_FIRST",
    regions: {},
    pending: null,
    reserved: null,
    preparedOutgoing: null,
    playableBounds,
    trophyTargetMacros: playableMacroIndices(playableBounds),
    microWidth: Number(config.microWidth) || 48,
    requiredSize: rolledSize,
    rolledSize,
    baseRequiredSize: rolledSize,
    basicPalettes: { A: A.basic, B: B.basic },
    bonusColors: { A: A.bonus, B: B.bonus },
    bonusUsesRemaining: { A: A.uses, B: B.uses },
    hands: config.hands ? clone(config.hands) : { A: handFromLoadout(loadouts.A), B: handFromLoadout(loadouts.B) },
    loadouts,
    publicEffects: clone(config.publicEffects || { A: { seals: {} }, B: { seals: {} } }),
    privateEffects: clone(config.privateEffects || { A: {}, B: {} }),
    interferenceLock: false,
    skillsUsed: { A: 0, B: 0 },
    winner: null,
    terminalReason: null,
    publicLog: ["Standard match created."],
  };
  validateStandardState(state);
  return state;
}

function validateStandardState(state) {
  assertState(state && typeof state === "object", "INVALID_STATE");
  assertState(state.schemaVersion === SCHEMA_VERSION, "INVALID_SCHEMA_VERSION");
  assertState(state.engineVersion === ENGINE_VERSION, "INVALID_ENGINE_VERSION");
  assertState(state.mode === "standard", "WRONG_MODE");
  assertState(typeof state.matchId === "string" && state.matchId.length > 0, "INVALID_MATCH_ID");
  assertState(Number.isInteger(state.version) && state.version >= 0, "INVALID_VERSION");
  assertState(Number.isInteger(state.turn) && state.turn >= 1, "INVALID_TURN");
  assertState(state.active === "A" || state.active === "B", "INVALID_ACTIVE_SEAT");
  assertState(PHASES.includes(state.phase), "INVALID_PHASE");
  assertState(state.status === "ACTIVE" || state.status === "FINISHED", "INVALID_STATUS");
  assertState(Number.isInteger(state.rolledSize) && state.rolledSize >= 1 && state.rolledSize <= 4, "INVALID_ROLLED_SIZE");
  assertState(Number.isInteger(state.baseRequiredSize) && state.baseRequiredSize >= 0 && state.baseRequiredSize <= 4, "INVALID_BASE_REQUIRED_SIZE");
  assertState(Number.isInteger(state.requiredSize) && state.requiredSize >= 0 && state.requiredSize <= 5, "INVALID_REQUIRED_SIZE");
  if (state.status === "ACTIVE") assertState(state.baseRequiredSize >= 1 && state.requiredSize >= 1, "INVALID_REQUIRED_SIZE");
  const bounds = state.playableBounds;
  assertState(bounds && [bounds.minCol, bounds.maxCol, bounds.minRow, bounds.maxRow, bounds.macroWidth, bounds.microScale].every(Number.isInteger)
    && bounds.macroWidth >= 6 && bounds.microScale >= 1 && state.microWidth === bounds.macroWidth * bounds.microScale
    && bounds.minCol >= 0 && bounds.minCol <= bounds.maxCol && bounds.maxCol < bounds.macroWidth
    && bounds.minRow >= 0 && bounds.minRow <= bounds.maxRow && bounds.maxRow < bounds.macroWidth
    && bounds.maxCol - bounds.minCol + 1 >= 6 && bounds.maxRow - bounds.minRow + 1 >= 6, "INVALID_PLAYABLE_BOUNDS");
  assertState(state.trophyTargetMacros === undefined || (Array.isArray(state.trophyTargetMacros)
    && new Set(state.trophyTargetMacros).size === state.trophyTargetMacros.length
    && state.trophyTargetMacros.every((macro) => Number.isInteger(macro) && macro >= 0 && macro < bounds.macroWidth * bounds.macroWidth)), "INVALID_TROPHY_TARGETS");
  const trophyTargets = new Set(state.trophyTargetMacros || playableMacroIndices(bounds));
  assertState(playableMacroIndices(bounds).every((macro) => trophyTargets.has(macro)), "INVALID_TROPHY_TARGETS");
  const worldMicroCount = state.microWidth * bounds.macroWidth * bounds.microScale;
  assertState(Boolean(state.regions) && typeof state.regions === "object", "INVALID_REGIONS");
  assertState(Boolean(state.hands) && Boolean(state.loadouts), "INVALID_CARDS");
  assertState(typeof state.interferenceLock === "boolean", "INVALID_INTERFERENCE_LOCK");
  assertState(Array.isArray(state.publicLog), "INVALID_PUBLIC_LOG");
  if (state.preparedOutgoing !== null && state.preparedOutgoing !== undefined) {
    const prepared = state.preparedOutgoing;
    assertState((prepared.actor === "A" || prepared.actor === "B") && Array.isArray(prepared.sourceMacros)
      && prepared.sourceMacros.length > 0 && new Set(prepared.sourceMacros).size === prepared.sourceMacros.length
      && prepared.sourceMacros.every((macro) => Number.isInteger(macro) && macro >= 0)
      && Array.isArray(prepared.micro) && prepared.micro.length > 0 && new Set(prepared.micro).size === prepared.micro.length
      && prepared.micro.every((cell) => Number.isInteger(cell) && cell >= 0)
      && Array.isArray(prepared.skills) && prepared.skills.length > 0
      && new Set(prepared.skills).size === prepared.skills.length
      && prepared.skills.every((skill) => ["areaMicroBloom", "areaCornerBloom"].includes(skill)), "INVALID_PREPARED_OUTGOING");
    const microHeight = bounds.macroWidth * bounds.microScale;
    assertState(state.status === "ACTIVE" && ["CREATE_FIRST", "WORK"].includes(state.phase)
      && prepared.actor === state.active && state.pending === null
      && prepared.sourceMacros.length === state.requiredSize
      && isConnected(prepared.sourceMacros, bounds.macroWidth)
      && prepared.sourceMacros.every((macro) => {
        const col = macro % bounds.macroWidth;
        const row = Math.floor(macro / bounds.macroWidth);
        return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
      })
      && prepared.micro.every((cell) => cell < state.microWidth * microHeight), "INVALID_PREPARED_OUTGOING");
    const uncoloredOccupied = new Set(Object.values(state.regions).filter((region) => !region.color).flatMap((region) => region.micro || []));
    assertState(prepared.micro.every((cell) => !uncoloredOccupied.has(cell)) && isConnected(prepared.micro, state.microWidth), "INVALID_PREPARED_OUTGOING");
    const candidates = preparedOutgoingCandidates({ ...state, preparedOutgoing: null }, prepared.sourceMacros, prepared.skills);
    assertState(candidates.some((candidate) => JSON.stringify(candidate) === JSON.stringify(prepared.micro)), "INVALID_PREPARED_OUTGOING");
  }
  const occupied = new Set();
  const pendingRegionIds = [];
  const reservedRegionIds = [];
  for (const [id, region] of Object.entries(state.regions)) {
    assertState(region?.id === id && Array.isArray(region.micro), "INVALID_REGION");
    if (region.isPending) {
      pendingRegionIds.push(id);
      assertState(region.color === null || region.color === undefined, "INVALID_PENDING_STATE");
    }
    if (region.isReserved) {
      reservedRegionIds.push(id);
      assertState(!region.isPending && (region.color === null || region.color === undefined), "INVALID_RESERVED_STATE");
    }
    for (const cell of region.micro) {
      assertState(Number.isInteger(cell) && cell >= 0 && cell < worldMicroCount && !occupied.has(cell), "INVALID_REGION_GEOMETRY");
      occupied.add(cell);
    }
  }
  assertState(pendingRegionIds.length <= 1, "INVALID_PENDING_STATE");
  if (state.pending === null) assertState(pendingRegionIds.length === 0, "INVALID_PENDING_STATE");
  else assertState(pendingRegionIds.length === 1 && pendingRegionIds[0] === state.pending, "INVALID_PENDING_STATE");
  assertState(reservedRegionIds.length <= 1, "INVALID_RESERVED_STATE");
  if (state.reserved === null || state.reserved === undefined) assertState(reservedRegionIds.length === 0, "INVALID_RESERVED_STATE");
  else assertState(reservedRegionIds.length === 1 && reservedRegionIds[0] === state.reserved && state.reserved !== state.pending, "INVALID_RESERVED_STATE");
  for (const seat of ["A", "B"]) {
    const basic = state.basicPalettes?.[seat];
    const bonus = state.bonusColors?.[seat];
    assertState(Array.isArray(basic) && basic.length === 2, "INVALID_PALETTE");
    assertState([...basic, bonus].every((color) => COLORS.includes(color)), "INVALID_PALETTE");
    assertState(Number.isInteger(state.bonusUsesRemaining?.[seat]) && state.bonusUsesRemaining[seat] >= 0, "INVALID_BONUS_USES");
    const temporaryColors = state.privateEffects?.[seat]?.temporaryColors;
    assertState(temporaryColors === undefined || (Array.isArray(temporaryColors)
      && temporaryColors.every((color) => COLORS.includes(color))
      && new Set(temporaryColors).size === temporaryColors.length), "INVALID_TEMPORARY_COLORS");
    const paletteDebuffs = state.privateEffects?.[seat]?.paletteDebuffs;
    assertState(paletteDebuffs === undefined || (Array.isArray(paletteDebuffs)
      && new Set(paletteDebuffs.map((effect) => effect.slot)).size === paletteDebuffs.length
      && paletteDebuffs.every((effect) => effect && Number.isInteger(effect.slot) && effect.slot >= 0 && effect.slot <= 2
        && COLORS.includes(effect.previousColor) && COLORS.includes(effect.injectedColor)
        && Number.isInteger(effect.remaining) && effect.remaining >= 1 && effect.remaining <= 2
        && (effect.slot < 2 ? state.basicPalettes[seat][effect.slot] : state.bonusColors[seat]) === effect.injectedColor)), "INVALID_PALETTE_DEBUFFS");
  }
  if (state.status === "FINISHED") assertState(state.phase === "GAME_OVER" && ["A", "B"].includes(state.winner) && FINISHED_STATE_TERMINAL_REASONS.includes(state.terminalReason), "INVALID_TERMINAL_STATE");
  if (state.phase === "GAME_OVER") assertState(state.status === "FINISHED", "INVALID_TERMINAL_STATE");
  return true;
}

function projectStandardPublicState(state) {
  validateStandardState(state);
  const keys = ["schemaVersion", "engineVersion", "mode", "matchId", "status", "version", "turn", "active", "phase", "regions", "pending", "reserved", "preparedOutgoing", "playableBounds", "trophyTargetMacros", "requiredSize", "rolledSize", "baseRequiredSize", "publicEffects", "interferenceLock", "winner", "terminalReason", "publicLog"];
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, clone(key === "trophyTargetMacros"
    ? (state.trophyTargetMacros || playableMacroIndices(state.playableBounds))
    : state[key])] )));
}

function projectStandardPrivateState(state, seat) {
  validateStandardState(state);
  assertState(seat === "A" || seat === "B", "NOT_A_PLAYER");
  return Object.freeze({
    seat,
    basicPalette: clone(state.basicPalettes[seat]),
    bonusColor: state.bonusColors[seat],
    bonusUsesRemaining: state.bonusUsesRemaining[seat],
    hand: clone(state.hands[seat]),
    loadout: clone(state.loadouts[seat]),
    privateEffects: clone(state.privateEffects[seat]),
  });
}

function isMapCompleteWin(state) {
  validateStandardState(state);
  if (state.status !== "FINISHED" || state.terminalReason !== "BOARD_LOCK" || !["A", "B"].includes(state.winner)) return false;
  const coloredOwners = new Set(Object.values(state.regions).filter((region) => region.color).flatMap((region) => region.micro || []));
  for (const macro of state.trophyTargetMacros || playableMacroIndices(state.playableBounds)) {
    if (macroMicroCells(macro, state.playableBounds, state.microWidth).some((cell) => !coloredOwners.has(cell))) return false;
  }
  return Object.values(state.regions).every((region) => Boolean(region.color) && !region.isPending);
}

function regionNumber(id) {
  const match = String(id).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function isConnected(cellsInput, width) {
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
    for (const neighbor of neighbors) if (cells.has(neighbor) && !seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
  }
  return seen.size === cells.size;
}

function connectedComponents(cellsInput, width) {
  const remaining = new Set(cellsInput);
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
    parts.push(part.sort((left, right) => left - right));
  }
  return parts.sort((left, right) => left[0] - right[0]);
}

function sourceMacrosFromMicro(cells, state) {
  const scale = state.playableBounds.microScale;
  const macroWidth = state.playableBounds.macroWidth;
  return [...new Set(cells.map((cell) => {
    const x = cell % state.microWidth;
    const y = Math.floor(cell / state.microWidth);
    return Math.floor(y / scale) * macroWidth + Math.floor(x / scale);
  }))].sort((left, right) => left - right);
}

function geometryTouchesExisting(micro, regions, microWidth) {
  const shape = new Set(micro);
  const occupied = new Set(Object.values(regions).flatMap((region) => region.micro || []));
  for (const cell of shape) {
    const x = cell % microWidth;
    const neighbors = [cell - microWidth, cell + microWidth];
    if (x > 0) neighbors.push(cell - 1);
    if (x < microWidth - 1) neighbors.push(cell + 1);
    if (neighbors.some((neighbor) => !shape.has(neighbor) && occupied.has(neighbor))) return true;
  }
  return false;
}

function transferPreparedIntrusions(state, micro, firstSplitNumber) {
  const owners = new Map(Object.values(state.regions).flatMap((region) => (region.micro || []).map((cell) => [cell, region.id])));
  const donors = new Set();
  for (const cell of micro) {
    const donorId = owners.get(cell);
    if (!donorId) continue;
    assertState(Boolean(state.regions[donorId]?.color), "PREPARED_OVERLAP_UNCOLORED");
    state.regions[donorId].micro = state.regions[donorId].micro.filter((candidate) => candidate !== cell);
    donors.add(donorId);
  }
  let nextNumber = firstSplitNumber;
  let splitCount = 0;
  let removedCount = 0;
  for (const donorId of [...donors].sort((left, right) => regionNumber(left) - regionNumber(right))) {
    const donor = state.regions[donorId];
    if (!donor.micro.length) {
      delete state.regions[donorId];
      removedCount += 1;
      continue;
    }
    const parts = connectedComponents(donor.micro, state.microWidth);
    donor.micro = parts[0];
    donor.sourceMacros = sourceMacrosFromMicro(parts[0], state);
    for (const part of parts.slice(1)) {
      const id = `R${nextNumber}`;
      nextNumber += 1;
      state.regions[id] = {
        ...donor,
        id,
        micro: part,
        sourceMacros: sourceMacrosFromMicro(part, state),
        controllers: [...(donor.controllers || [])],
        isPending: false,
        isReserved: false,
      };
      splitCount += 1;
    }
  }
  return Object.freeze({ donorCount: donors.size, splitCount, removedCount });
}

function macroMicroCells(macro, bounds, microWidth) {
  const macroWidth = bounds.macroWidth;
  const scale = bounds.microScale;
  const col = macro % macroWidth;
  const row = Math.floor(macro / macroWidth);
  const result = [];
  for (let dy = 0; dy < scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) result.push((row * scale + dy) * microWidth + col * scale + dx);
  }
  return result;
}

function touchesExistingRegion(sourceMacros, regions, macroWidth) {
  const occupied = new Set(Object.values(regions).flatMap((region) => region.sourceMacros || []));
  return sourceMacros.some((macro) => {
    const col = macro % macroWidth;
    const neighbors = [macro - macroWidth, macro + macroWidth];
    if (col > 0) neighbors.push(macro - 1);
    if (col < macroWidth - 1) neighbors.push(macro + 1);
    return neighbors.some((neighbor) => occupied.has(neighbor));
  });
}

function hasLegalRegionOfSize(state, size) {
  if (!Number.isInteger(size) || size < 1) return false;
  const bounds = state.playableBounds;
  const width = bounds.macroWidth;
  const occupied = new Set(Object.values(state.regions).flatMap((region) => region.sourceMacros || []));
  const free = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      const macro = row * width + col;
      if (!occupied.has(macro)) free.push(macro);
    }
  }
  if (free.length < size) return false;
  const freeSet = new Set(free);
  const seen = new Set();
  function search(selected, frontier) {
    const signature = [...selected].sort((a, b) => a - b).join(",");
    if (seen.has(signature)) return false;
    seen.add(signature);
    if (selected.size === size) return !occupied.size || touchesExistingRegion([...selected], state.regions, width);
    for (const macro of frontier) {
      const nextSelected = new Set(selected).add(macro);
      const nextFrontier = new Set(frontier);
      nextFrontier.delete(macro);
      const col = macro % width;
      const around = [macro - width, macro + width];
      if (col > 0) around.push(macro - 1);
      if (col < width - 1) around.push(macro + 1);
      for (const next of around) if (freeSet.has(next) && !nextSelected.has(next)) nextFrontier.add(next);
      if (search(nextSelected, nextFrontier)) return true;
    }
    return false;
  }
  for (const start of free) {
    const col = start % width;
    const around = [start - width, start + width];
    if (col > 0) around.push(start - 1);
    if (col < width - 1) around.push(start + 1);
    if (search(new Set([start]), new Set(around.filter((macro) => freeSet.has(macro))))) return true;
  }
  return false;
}

function bestLegalSize(state, maximum) {
  for (let size = maximum; size >= 1; size -= 1) if (hasLegalRegionOfSize(state, size)) return size;
  return 0;
}

function createRegion(state, actor, payload = {}, rngStreams = {}) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "CREATE_FIRST" || state.phase === "WORK", "WRONG_PHASE");
  assertState(!state.pending, "PENDING_EXISTS");
  const rawSourceMacros = Array.isArray(payload.sourceMacros) ? payload.sourceMacros : [];
  const sourceMacros = [...new Set(rawSourceMacros)].sort((a, b) => a - b);
  assertState(rawSourceMacros.length === sourceMacros.length, "DUPLICATE_REGION_CELL");
  const prepared = state.preparedOutgoing;
  if (prepared) {
    assertState(prepared.actor === actor, "PREPARED_WRONG_ACTOR");
    assertState(JSON.stringify(sourceMacros) === JSON.stringify(prepared.sourceMacros), "PREPARED_SELECTION_MISMATCH");
  }
  assertState(sourceMacros.length === state.requiredSize, "WRONG_REGION_SIZE");
  const bounds = state.playableBounds;
  assertState(sourceMacros.every((macro) => {
    if (!Number.isInteger(macro) || macro < 0) return false;
    const col = macro % bounds.macroWidth;
    const row = Math.floor(macro / bounds.macroWidth);
    return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
  }), "OUTSIDE_PLAYABLE_BOUNDS");
  assertState(isConnected(sourceMacros, bounds.macroWidth), "REGION_NOT_CONNECTED");
  const micro = prepared ? [...prepared.micro] : sourceMacros.flatMap((macro) => macroMicroCells(macro, bounds, state.microWidth));
  assertState(isConnected(micro, state.microWidth), "REGION_NOT_CONNECTED");
  if (Object.keys(state.regions).length) {
    assertState(prepared ? geometryTouchesExisting(micro, state.regions, state.microWidth) : touchesExistingRegion(sourceMacros, state.regions, bounds.macroWidth), "REGION_NOT_ADJACENT");
  }
  const occupied = new Set(Object.values(state.regions).flatMap((region) => region.micro || []));
  if (!prepared) assertState(micro.every((cell) => !occupied.has(cell)), "REGION_OVERLAP");
  const idNumber = Math.max(0, ...Object.keys(state.regions).map(regionNumber)) + 1;
  const id = `R${idNumber}`;
  const next = clone(state);
  const intrusion = prepared ? transferPreparedIntrusions(next, micro, idNumber + 1) : { donorCount: 0, splitCount: 0, removedCount: 0 };
  next.regions[id] = { id, micro, sourceMacros, controllers: [actor], color: null, isPending: true };
  next.pending = id;
  next.preparedOutgoing = null;
  next.active = other(actor);
  next.phase = "COLOR";
  next.turn += 1;
  next.interferenceLock = false;
  next.version += 1;
  next.publicLog.push(`T${next.turn - 1} Player ${actor} created ${id}${intrusion.donorCount ? ` with ${intrusion.donorCount} colored-region intrusion${intrusion.splitCount ? ` and ${intrusion.splitCount} donor split` : ""}${intrusion.removedCount ? ` and ${intrusion.removedCount} donor removal` : ""}` : ""}; Player ${next.active} must color it.`);
  applyCurseBacklashOnEnterColor(next, next.active, () => nextRandom(rngStreams, "skill-effect"));
  const contactColorCount = new Set(adjacentRegionIds(next, id)
    .map((regionId) => next.regions[regionId])
    .filter((region) => region && !region.isPending && region.color)
    .map((region) => region.color)).size;
  return { ok: true, code: "OK", state: next, regionId: id, contactColorCount };
}

function availableColors(state, actor) {
  const colors = new Set(state.basicPalettes[actor]);
  if (state.bonusUsesRemaining[actor] > 0) colors.add(state.bonusColors[actor]);
  for (const color of state.privateEffects[actor]?.temporaryColors || []) colors.add(color);
  if (state.privateEffects[actor]?.prism) for (const color of COLORS) colors.add(color);
  const seals = state.publicEffects?.[actor]?.seals || {};
  return [...colors].filter((color) => !(seals[color] > 0));
}

function colorRegion(state, actor, payload = {}, rngStreams = {}) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "COLOR" && state.pending, "WRONG_PHASE");
  const color = payload.color;
  assertState(COLORS.includes(color) && availableColors(state, actor).includes(color), "COLOR_UNAVAILABLE");
  const next = clone(state);
  if (adjacentRegionIds(state, state.pending).some((id) => state.regions[id].color === color)) {
    if (next.privateEffects[actor]?.prism) delete next.privateEffects[actor].prism;
    if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
    next.status = "FINISHED";
    next.phase = "GAME_OVER";
    next.winner = other(actor);
    next.terminalReason = "ILLEGAL_COLOR";
    next.version += 1;
    next.publicLog.push(`T${next.turn} Player ${actor} lost by illegal coloring.`);
    return { ok: true, code: "ILLEGAL_COLOR", state: next };
  }
  const target = next.regions[next.pending];
  target.color = color;
  target.isPending = false;
  if (!target.controllers.includes(actor)) target.controllers.push(actor);
  const prism = Boolean(next.privateEffects[actor]?.prism);
  const temporary = (next.privateEffects[actor]?.temporaryColors || []).includes(color);
  const hasUnlimitedBasicSlot = next.basicPalettes[actor].includes(color);
  if (!prism && !temporary && !hasUnlimitedBasicSlot && color === next.bonusColors[actor]) next.bonusUsesRemaining[actor] -= 1;
  if (prism) delete next.privateEffects[actor].prism;
  if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
  tickSealsAfterColor(next, actor);
  tickPaletteDebuffsAfterColor(next, actor);
  if (next.reserved) {
    const returnedId = next.reserved;
    const returned = next.regions[returnedId];
    next.reserved = null;
    returned.isReserved = false;
    returned.isPending = true;
    next.pending = returnedId;
    next.active = other(actor);
    next.phase = "COLOR";
    next.turn += 1;
    next.interferenceLock = false;
    applyCurseBacklashOnEnterColor(next, next.active, () => nextRandom(rngStreams, "skill-effect"));
    next.version += 1;
    next.publicLog.push(`Player ${actor} colored ${target.id}; split region ${returnedId} returned to Player ${next.active}.`);
    return { ok: true, code: "OK", state: next, returnedRegionId: returnedId };
  }
  next.pending = null;
  next.phase = "WORK";
  next.rolledSize = DIE_POOL[Math.floor(nextRandom(rngStreams, "die") * DIE_POOL.length)];
  next.baseRequiredSize = bestLegalSize(next, next.rolledSize);
  next.requiredSize = next.baseRequiredSize;
  if (next.requiredSize <= 0) {
    next.status = "FINISHED";
    next.phase = "GAME_OVER";
    next.winner = actor;
    next.terminalReason = "BOARD_LOCK";
  }
  next.version += 1;
  next.publicLog.push(`Player ${actor} colored ${target.id}.`);
  return { ok: true, code: "OK", state: next };
}

function surrender(state, actor) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  const next = clone(state);
  if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
  next.preparedOutgoing = null;
  next.status = "FINISHED";
  next.phase = "GAME_OVER";
  next.winner = other(actor);
  next.terminalReason = "SURRENDER";
  next.version += 1;
  next.publicLog.push(`Player ${actor} surrendered.`);
  return { ok: true, code: "OK", state: next };
}

function declareNoColor(state, actor) {
  assertState(state.active === actor, "NOT_YOUR_TURN");
  assertState(state.phase === "COLOR", "WRONG_PHASE");
  const usable = availableColors(state, actor);
  const blocked = new Set(adjacentRegionIds(state, state.pending).map((id) => state.regions[id]?.color).filter(Boolean));
  assertState(usable.every((color) => blocked.has(color)), "COLOR_AVAILABLE");
  const next = clone(state);
  if (next.privateEffects[actor]?.temporaryColors) delete next.privateEffects[actor].temporaryColors;
  next.status = "FINISHED";
  next.phase = "GAME_OVER";
  next.winner = other(actor);
  next.terminalReason = usable.length === 0 ? "SEALED_OUT" : "NO_LEGAL_COLOR";
  next.version += 1;
  next.publicLog.push(`Player ${actor} declared no usable color.`);
  return { ok: true, code: "OK", state: next };
}

function applyStandardAction({ state, actor, action, expectedVersion, rngStreams = {} }) {
  validateStandardState(state);
  if (expectedVersion !== state.version) return fail("VERSION_CONFLICT", state);
  if (!action || !ACTIONS.includes(action.type)) return fail("UNKNOWN_ACTION", state);
  if (state.status === "FINISHED") return fail("MATCH_FINISHED", state);
  try {
    let result;
    if (action.type === "CREATE_REGION") result = createRegion(state, actor, action.payload, rngStreams);
    else if (action.type === "COLOR_REGION") result = colorRegion(state, actor, action.payload, rngStreams);
    else if (action.type === "DECLARE_NO_COLOR") result = declareNoColor(state, actor);
    else if (action.type === "SURRENDER") result = surrender(state, actor);
    else {
      return dispatchStandardSkillAction({
        state,
        actor,
        action,
        expectedVersion,
        rngStreams,
        validateState: validateStandardState,
        projectPublic: projectStandardPublicState,
        projectPrivate: projectStandardPrivateState,
        hasLegalRegionOfSize,
        bestLegalSize,
      });
    }
    if (result.ok) {
      assertState(result.state.version === state.version + 1, "VERSION_INCREMENT_INVARIANT");
      validateStandardState(result.state);
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof StandardRuleError) return fail(error.code, state);
    throw error;
  }
}

function encodeStandardMatch(state, rngSnapshot) {
  validateStandardState(state);
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, state, rngSnapshot: clone(rngSnapshot || {}) });
}

function decodeStandardMatch(payload) {
  const decoded = typeof payload === "string" ? JSON.parse(payload) : clone(payload);
  assertState(decoded?.schemaVersion === SCHEMA_VERSION, "INVALID_SAVE_SCHEMA");
  validateStandardState(decoded.state);
  return Object.freeze({ state: decoded.state, rngSnapshot: decoded.rngSnapshot || {} });
}

module.exports = {
  ACTIONS,
  BONUS_USE_POOL,
  DIE_POOL,
  ENGINE_VERSION,
  ENGINE_TERMINAL_REASONS,
  FINISHED_STATE_TERMINAL_REASONS,
  PHASES,
  REQUIRED_RNG_STREAMS,
  SAVE_KEY,
  SCHEMA_VERSION,
  TERMINAL_REASONS,
  applyStandardAction,
  createStandardMatch,
  decodeStandardMatch,
  encodeStandardMatch,
  isMapCompleteWin,
  projectStandardPrivateState,
  projectStandardPublicState,
  validateStandardState,
};
