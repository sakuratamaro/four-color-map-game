"use strict";

const COLORS = Object.freeze(["red", "blue", "yellow", "green"]);
const MICRO_WIDTH = 48;

class StandardRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StandardRuleError";
    this.code = code;
  }
}

function assertRule(condition, code, message) {
  if (!condition) throw new StandardRuleError(code, message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function other(seat) {
  return seat === "A" ? "B" : "A";
}

function numericRegionId(id) {
  const match = String(id).match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function compareRegionIds(left, right) {
  const delta = numericRegionId(left) - numericRegionId(right);
  return Number.isFinite(delta) && delta !== 0 ? delta : String(left).localeCompare(String(right));
}

function microNeighbors(index, width = MICRO_WIDTH) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result = [];
  if (x > 0) result.push(index - 1);
  if (x < width - 1) result.push(index + 1);
  if (y > 0) result.push(index - width);
  result.push(index + width);
  return result;
}

function ownerMap(state) {
  const result = new Map();
  for (const region of Object.values(state.regions || {})) {
    for (const micro of region.micro || []) {
      assertRule(Number.isInteger(micro) && micro >= 0, "INVALID_STATE", "Region geometry contains an invalid cell");
      assertRule(!result.has(micro), "INVALID_STATE", "Regions overlap");
      result.set(micro, region.id);
    }
  }
  return result;
}

function adjacentRegionIds(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  const width = state.microWidth || MICRO_WIDTH;
  const owners = ownerMap(state);
  const adjacent = new Set();
  for (const micro of region.micro || []) {
    for (const neighbor of microNeighbors(micro, width)) {
      const owner = owners.get(neighbor);
      if (owner && owner !== regionId) adjacent.add(owner);
    }
  }
  return [...adjacent].sort(compareRegionIds);
}

function legalRecolorCandidates(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  const blocked = new Set([region.color]);
  for (const adjacentId of adjacentRegionIds(state, regionId)) {
    const color = state.regions[adjacentId]?.color;
    if (color) blocked.add(color);
  }
  return Object.freeze(COLORS.filter((color) => !blocked.has(color)));
}

function sameColorAdjacentCount(state, regionId) {
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  if (!region.color) return 0;
  return adjacentRegionIds(state, regionId).filter((adjacentId) => state.regions[adjacentId]?.color === region.color).length;
}

function mergeSameColorComponent(state, startRegionId) {
  const start = state.regions[startRegionId];
  if (!start?.color) return Object.freeze({ keptId: startRegionId, droppedIds: [] });
  const component = new Set([startRegionId]);
  const queue = [startRegionId];
  while (queue.length) {
    const current = queue.shift();
    for (const adjacentId of adjacentRegionIds(state, current)) {
      if (!component.has(adjacentId) && state.regions[adjacentId]?.color === start.color) {
        component.add(adjacentId);
        queue.push(adjacentId);
      }
    }
  }
  const ids = [...component].sort(compareRegionIds);
  const keptId = ids[0];
  const droppedIds = ids.slice(1);
  if (!droppedIds.length) return Object.freeze({ keptId, droppedIds: [] });
  const kept = state.regions[keptId];
  kept.micro = [...new Set(ids.flatMap((id) => state.regions[id].micro || []))].sort((a, b) => a - b);
  kept.sourceMacros = [...new Set(ids.flatMap((id) => state.regions[id].sourceMacros || []))].sort((a, b) => a - b);
  kept.controllers = [...new Set(ids.flatMap((id) => state.regions[id].controllers || []))].sort();
  kept.color = start.color;
  kept.isPending = false;
  for (const id of droppedIds) delete state.regions[id];
  if (droppedIds.includes(state.pending)) state.pending = keptId;
  return Object.freeze({ keptId, droppedIds: Object.freeze(droppedIds) });
}

function validateLegalRecolorTarget(state, actor, regionId) {
  assertRule(actor === "A" || actor === "B", "NOT_A_PLAYER", "Actor must occupy a seat");
  assertRule(state.mode === "standard", "WRONG_MODE", "Legal recolor is standard-mode only");
  assertRule(state.phase === "WORK", "WRONG_PHASE", "Legal recolor is a work-phase skill");
  assertRule(state.active === actor, "NOT_YOUR_TURN", "It is not this player's turn");
  assertRule(!state.winner, "MATCH_FINISHED", "Match is already finished");
  assertRule(!state.interferenceLock, "INTERFERENCE_CHAINED", "Existing-region interference is locked until COLOR");
  assertRule((state.hands?.[actor]?.legalRecolor || 0) > 0, "SKILL_UNAVAILABLE", "Legal recolor is unavailable");
  const region = state.regions?.[regionId];
  assertRule(region, "INVALID_TARGET", "Target region does not exist");
  assertRule(Boolean(region.color), "INVALID_TARGET", "Target must already be colored");
  assertRule(state.pending !== regionId && state.reserved !== regionId && !region.isPending, "INVALID_TARGET", "Pending or reserved region cannot be recolored");
  assertRule(!region.deleted && !region.delayed && !region.delayState, "INVALID_TARGET", "Deleted or delayed region cannot be recolored");
  return region;
}

function applyLegalRecolor(currentState, actor, regionId, options = {}) {
  validateLegalRecolorTarget(currentState, actor, regionId);
  const sameColorBefore = sameColorAdjacentCount(currentState, regionId);
  const candidates = legalRecolorCandidates(currentState, regionId);
  if (!candidates.length) return Object.freeze({ ok: false, code: "NO_LEGAL_RECOLOR", state: currentState, candidates });
  const effectRandom = options.effectRandom;
  assertRule(typeof effectRandom === "function", "RNG_REQUIRED", "Effect RNG is required");
  const draw = Number(effectRandom());
  assertRule(Number.isFinite(draw) && draw >= 0 && draw < 1, "INVALID_RANDOM", "Effect RNG must return [0, 1)");
  const color = candidates[Math.floor(draw * candidates.length)];
  const state = clone(currentState);
  state.regions[regionId].color = color;
  const sameColorAfter = sameColorAdjacentCount(state, regionId);
  assertRule(sameColorAfter === 0 && sameColorAfter <= sameColorBefore, "RECOLOR_ADJACENCY_INVARIANT", "Legal recolor created same-color adjacency");
  state.hands[actor].legalRecolor -= 1;
  state.skillsUsed = state.skillsUsed || { A: 0, B: 0 };
  state.skillsUsed[actor] = (state.skillsUsed[actor] || 0) + 1;
  const merge = Object.freeze({ keptId: regionId, droppedIds: Object.freeze([]) });
  state.active = other(actor);
  state.phase = "WORK";
  state.interferenceLock = true;
  state.version += 1;
  const logKey = Array.isArray(state.publicLog) ? "publicLog" : "log";
  state[logKey] = Array.isArray(state[logKey]) ? state[logKey] : [];
  state[logKey].push(`T${state.turn}  Player ${actor} legally recolored ${regionId} ${color}; WORK passed to Player ${state.active}.`);
  return Object.freeze({ ok: true, code: "OK", state, color, candidates, merge });
}

function onEnterColor(currentState) {
  if (!currentState.interferenceLock) return currentState;
  const state = clone(currentState);
  state.interferenceLock = false;
  return state;
}

function hashSeed(seed, name) {
  let value = (Number(seed) >>> 0) ^ 0x811c9dc5;
  for (const char of String(name)) {
    value ^= char.codePointAt(0);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value || 0x6d2b79f5;
}

function createStream(seed) {
  let state = seed >>> 0;
  return Object.freeze({
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    snapshot() {
      return state >>> 0;
    },
  });
}

function createRngDomains(seed, names = ["setup", "roll", "effect", "quizContent", "quizPlacement", "cpuDecision"]) {
  const streams = {};
  for (const name of names) streams[name] = createStream(hashSeed(seed, name));
  return Object.freeze(streams);
}

function createRngDomainsFromSnapshot(snapshot, names) {
  assertRule(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot), "INVALID_RNG_SNAPSHOT", "RNG snapshot must be an object");
  const streams = {};
  for (const name of names) {
    assertRule(Number.isSafeInteger(snapshot[name]) && snapshot[name] >= 0 && snapshot[name] <= 0xffffffff, "INVALID_RNG_SNAPSHOT", `Missing RNG stream: ${name}`);
    streams[name] = createStream(snapshot[name]);
  }
  return Object.freeze(streams);
}

function snapshotRngDomains(streams, names) {
  const snapshot = {};
  for (const name of names) {
    const value = streams?.[name]?.snapshot?.();
    assertRule(Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff, "INVALID_RNG_STREAM", `RNG stream cannot be snapshotted: ${name}`);
    snapshot[name] = value;
  }
  return Object.freeze(snapshot);
}

module.exports = {
  COLORS,
  StandardRuleError,
  adjacentRegionIds,
  applyLegalRecolor,
  compareRegionIds,
  createRngDomains,
  createRngDomainsFromSnapshot,
  createStream,
  hashSeed,
  legalRecolorCandidates,
  mergeSameColorComponent,
  onEnterColor,
  sameColorAdjacentCount,
  snapshotRngDomains,
};
