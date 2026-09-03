(function initQuickCpu(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorQuickCpu = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function quickCpuFactory() {
  "use strict";

  const COLORS = Object.freeze(["red", "blue", "yellow", "green"]);
  const WIDTH = 12;
  const HEIGHT = 12;
  const SCALE = 4;
  const MICRO_WIDTH = WIDTH * SCALE;
  const MICRO_HEIGHT = HEIGHT * SCALE;
  const DIRECTIONS = Object.freeze(["left", "right", "up", "down"]);
  const LEVELS = Object.freeze(["easy", "normal", "hard"]);
  const SHIFT_RANKINGS = Object.freeze(["tactical", "moved-count"]);
  const POLICY_VERSIONS = Object.freeze({
    easy: "easy-v1-random-safe",
    normal: "normal-v1-cells-contacts",
    hard: "hard-v1-cells-contacts-band4",
  });

  function other(seat) { return seat === "A" ? "B" : "A"; }
  function mIndex(column, row) { return row * WIDTH + column; }
  function mXY(index) { return [index % WIDTH, Math.floor(index / WIDTH)]; }
  function uIndex(x, y) { return y * MICRO_WIDTH + x; }
  function uXY(index) { return [index % MICRO_WIDTH, Math.floor(index / MICRO_WIDTH)]; }

  function neighbors(index, width, height) {
    const x = index % width;
    const y = Math.floor(index / width);
    const result = [];
    if (x > 0) result.push(index - 1);
    if (x < width - 1) result.push(index + 1);
    if (y > 0) result.push(index - width);
    if (y < height - 1) result.push(index + width);
    return result;
  }

  function connected(values, width, height) {
    const set = values instanceof Set ? values : new Set(values);
    if (!set.size) return false;
    const first = set.values().next().value;
    const seen = new Set([first]);
    const queue = [first];
    while (queue.length) {
      const current = queue.shift();
      for (const next of neighbors(current, width, height)) {
        if (set.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen.size === set.size;
  }

  function microForMacro(index) {
    const [column, row] = mXY(index);
    const result = [];
    for (let y = row * SCALE; y < (row + 1) * SCALE; y += 1) {
      for (let x = column * SCALE; x < (column + 1) * SCALE; x += 1) result.push(uIndex(x, y));
    }
    return result;
  }

  function ownerMap(state) {
    const owner = Array(MICRO_WIDTH * MICRO_HEIGHT).fill(null);
    for (const region of Object.values(state.regions || {})) {
      for (const micro of region.micro || []) owner[micro] = region.id;
    }
    return owner;
  }

  function playableMacros(bounds) {
    const result = [];
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      for (let column = bounds.left; column <= bounds.right; column += 1) result.push(mIndex(column, row));
    }
    return result;
  }

  function candidateShape(state, macros, owner = ownerMap(state)) {
    const shape = new Set();
    for (const macro of macros) {
      for (const micro of microForMacro(macro)) if (!owner[micro]) shape.add(micro);
    }
    return shape;
  }

  function touchesExisting(shape, owner) {
    for (const micro of shape) {
      for (const next of neighbors(micro, MICRO_WIDTH, MICRO_HEIGHT)) if (owner[next]) return true;
    }
    return false;
  }

  function analyzeRegionCandidates(state, { candidateLimit = 32, explorationLimit = 1000 } = {}) {
    const size = state.requiredSize;
    if (!Number.isInteger(size) || size <= 0) return { candidates: [], explored: 0, complete: true };
    const owner = ownerMap(state);
    const free = playableMacros(state.playableBounds).filter((macro) => microForMacro(macro).some((micro) => !owner[micro]));
    const freeSet = new Set(free);
    const results = [];
    const visited = new Set();
    const first = Object.keys(state.regions || {}).length === 0;
    const starts = first
      ? free
      : free.filter((macro) => touchesExisting(candidateShape(state, [macro], owner), owner));
    let explored = 0;
    let truncated = false;

    function visit(selected, frontier) {
      if (results.length >= candidateLimit || explored >= explorationLimit) {
        truncated = true;
        return;
      }
      explored += 1;
      const signature = [...selected].sort((a, b) => a - b).join(",");
      if (visited.has(signature)) return;
      visited.add(signature);
      if (selected.size === size) {
        const shape = candidateShape(state, selected, owner);
        if (connected(shape, MICRO_WIDTH, MICRO_HEIGHT) && (first || touchesExisting(shape, owner))) {
          let contacts = 0;
          for (const micro of shape) {
            for (const next of neighbors(micro, MICRO_WIDTH, MICRO_HEIGHT)) if (owner[next]) contacts += 1;
          }
          results.push({ macros: [...selected].sort((a, b) => a - b), cells: shape.size, contacts });
        }
        return;
      }
      for (const next of [...frontier].sort((a, b) => a - b)) {
        const nextSelected = new Set(selected).add(next);
        const nextFrontier = new Set(frontier);
        nextFrontier.delete(next);
        for (const neighbor of neighbors(next, WIDTH, HEIGHT)) {
          if (freeSet.has(neighbor) && !nextSelected.has(neighbor)) nextFrontier.add(neighbor);
        }
        visit(nextSelected, nextFrontier);
        if (results.length >= candidateLimit || explored >= explorationLimit) {
          truncated = true;
          return;
        }
      }
    }

    for (const start of starts) {
      visit(new Set([start]), new Set(neighbors(start, WIDTH, HEIGHT).filter((value) => freeSet.has(value))));
      if (results.length >= candidateLimit || explored >= explorationLimit) {
        truncated = true;
        break;
      }
    }
    return { candidates: results, explored, complete: !truncated };
  }

  function regionCandidates(state, limit = 32) {
    return analyzeRegionCandidates(state, { candidateLimit: limit, explorationLimit: 1000 }).candidates;
  }

  function adjacentColors(state, regionId) {
    const region = state.regions?.[regionId];
    if (!region) return new Set();
    const owner = ownerMap(state);
    const colors = new Set();
    for (const micro of region.micro || []) {
      for (const next of neighbors(micro, MICRO_WIDTH, MICRO_HEIGHT)) {
        const nextId = owner[next];
        const color = nextId && nextId !== regionId ? state.regions[nextId]?.color : null;
        if (color) colors.add(color);
      }
    }
    return colors;
  }

  function geometryOpportunityMetrics(regions, bounds) {
    const owner = Array(MICRO_WIDTH * MICRO_HEIGHT).fill(null);
    for (const region of Object.values(regions || {})) {
      for (const micro of region.micro || []) owner[micro] = region.id;
    }
    let frontierCells = 0;
    let colorPressureSum = 0;
    let maxColorPressure = 0;
    const minX = bounds.left * SCALE;
    const maxX = (bounds.right + 1) * SCALE;
    const minY = bounds.top * SCALE;
    const maxY = (bounds.bottom + 1) * SCALE;
    for (let y = minY; y < maxY; y += 1) {
      for (let x = minX; x < maxX; x += 1) {
        const micro = uIndex(x, y);
        if (owner[micro]) continue;
        const colors = new Set();
        let touches = false;
        for (const next of neighbors(micro, MICRO_WIDTH, MICRO_HEIGHT)) {
          const regionId = owner[next];
          if (!regionId) continue;
          touches = true;
          const color = regions[regionId]?.color;
          if (color) colors.add(color);
        }
        if (!touches) continue;
        frontierCells += 1;
        colorPressureSum += colors.size;
        maxColorPressure = Math.max(maxColorPressure, colors.size);
      }
    }
    return { frontierCells, colorPressureSum, maxColorPressure };
  }

  function shiftCandidates(state, { withTacticalMetrics = false } = {}) {
    const candidates = [];
    const beforeMetrics = withTacticalMetrics ? geometryOpportunityMetrics(state.regions, state.playableBounds) : null;
    const populated = new Set();
    for (const region of Object.values(state.regions || {})) {
      for (const micro of region.micro || []) {
        const [x, y] = uXY(micro);
        populated.add(mIndex(Math.floor(x / SCALE), Math.floor(y / SCALE)));
      }
    }
    const macros = [...populated];
    for (const macro of macros) {
      const [column, row] = mXY(macro);
      for (const direction of DIRECTIONS) {
        const horizontal = direction === "left" || direction === "right";
        const delta = direction === "left" || direction === "up" ? -2 : 2;
        const occupied = new Set();
        const movedRegions = withTacticalMetrics ? {} : null;
        let movedCount = 0;
        let valid = true;
        for (const region of Object.values(state.regions || {})) {
          const moved = [];
          for (const micro of region.micro || []) {
            let [x, y] = uXY(micro);
            const inBand = horizontal
              ? y >= row * SCALE && y < (row + 1) * SCALE
              : x >= column * SCALE && x < (column + 1) * SCALE;
            if (inBand) {
              if (horizontal) x += delta;
              else y += delta;
              movedCount += 1;
            }
            if (x < 0 || y < 0 || x >= MICRO_WIDTH || y >= MICRO_HEIGHT) { valid = false; break; }
            const next = uIndex(x, y);
            if (occupied.has(next)) { valid = false; break; }
            occupied.add(next);
            moved.push(next);
          }
          if (!valid || !connected(moved, MICRO_WIDTH, MICRO_HEIGHT)) { valid = false; break; }
          if (withTacticalMetrics) movedRegions[region.id] = { ...region, micro: moved };
        }
        if (valid && movedCount > 0) {
          const result = { macro, direction, movedCount };
          if (withTacticalMetrics) {
            const afterMetrics = geometryOpportunityMetrics(movedRegions, state.playableBounds);
            result.frontierDelta = afterMetrics.frontierCells - beforeMetrics.frontierCells;
            result.colorPressureDelta = afterMetrics.colorPressureSum - beforeMetrics.colorPressureSum;
            result.maxColorPressureDelta = afterMetrics.maxColorPressure - beforeMetrics.maxColorPressure;
          }
          candidates.push(result);
        }
        if (candidates.length >= 32) return candidates;
      }
    }
    return candidates;
  }

  function randomItem(values, random) {
    return values[Math.floor(random() * values.length)];
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function makeObservation({ publicState, privateState, ownPrivateState, level = "normal", shiftRanking = "moved-count" }) {
    const own = ownPrivateState || privateState;
    if (!publicState || !own) throw new Error("CPU public and own-private projections are required");
    return deepFreeze(clone({
      publicState,
      ownPrivateState: own,
      seat: own.seat,
      difficulty: level,
      policyVersion: POLICY_VERSIONS[level],
      shiftRanking,
    }));
  }

  function candidate(type, payload = {}, metadata = {}) {
    return { type, payload, metadata };
  }

  function enumerateRuleSafeActions(observation) {
    const { publicState, ownPrivateState, seat } = observation;
    if (publicState.active !== seat) throw new Error("CPU cannot act out of turn");
    const actions = [];

    if (publicState.phase === "COLOR") {
      const blocked = adjacentColors(publicState, publicState.pending);
      const palette = ownPrivateState.prismActive ? COLORS : ownPrivateState.palette;
      const legal = palette.filter((color) => (ownPrivateState.seals[color] || 0) <= 0 && !blocked.has(color));
      const counts = Object.fromEntries(COLORS.map((color) => [color, 0]));
      for (const region of Object.values(publicState.regions || {})) if (region.color) counts[region.color] += 1;
      for (const color of legal) actions.push(candidate("COLOR_REGION", { color }, { colorCount: counts[color] }));
      if (actions.length) return actions;

      const prismLegal = COLORS.filter((color) => (ownPrivateState.seals[color] || 0) <= 0 && !blocked.has(color));
      if (!ownPrivateState.prismActive && ownPrivateState.hand.colorPrism > 0 && prismLegal.length) {
        return [candidate("USE_SKILL", { skill: "colorPrism" }, { rescue: true })];
      }
      return [candidate("DECLARE_NO_COLOR", {}, { terminal: true })];
    }

    if (publicState.phase === "WORK" || publicState.phase === "CREATE_FIRST") {
      for (const region of regionCandidates(publicState)) {
        actions.push(candidate("CREATE_REGION", { macros: region.macros }, { cells: region.cells, contacts: region.contacts }));
      }
      if (ownPrivateState.hand.disruptChoiceOne > 0) {
        const colorCounts = Object.fromEntries(COLORS.map((color) => [color, 0]));
        for (const region of Object.values(publicState.regions || {})) if (region.color) colorCounts[region.color] += 1;
        for (const color of COLORS) actions.push(candidate("USE_SKILL", { skill: "disruptChoiceOne", color }, { colorCount: colorCounts[color] }));
      }
      if (ownPrivateState.hand.areaHalfShift > 0) {
        for (const shift of shiftCandidates(publicState, { withTacticalMetrics: observation.shiftRanking === "tactical" })) {
          actions.push(candidate(
            "USE_SKILL",
            { skill: "areaHalfShift", macro: shift.macro, direction: shift.direction },
            {
              movedCount: shift.movedCount,
              frontierDelta: shift.frontierDelta || 0,
              colorPressureDelta: shift.colorPressureDelta || 0,
              maxColorPressureDelta: shift.maxColorPressureDelta || 0,
            },
          ));
        }
      }
      if (!actions.length) throw new Error("CPU found no rule-safe action");
      return actions;
    }

    throw new Error(`CPU cannot act during phase ${publicState.phase}`);
  }

  function scoreActions(observation, actions, random, { shiftRanking = "moved-count" } = {}) {
    const level = observation.difficulty;
    if (observation.publicState.phase === "COLOR") {
      const colors = actions.filter((entry) => entry.type === "COLOR_REGION");
      if (!colors.length) return actions[0];
      if (level === "hard") {
        const ranked = [...colors].sort((a, b) => a.metadata.colorCount - b.metadata.colorCount || COLORS.indexOf(a.payload.color) - COLORS.indexOf(b.payload.color));
        return ranked[0];
      }
      return randomItem(colors, random);
    }

    const creates = actions.filter((entry) => entry.type === "CREATE_REGION");
    const seals = actions.filter((entry) => entry.payload.skill === "disruptChoiceOne");
    const shifts = actions.filter((entry) => entry.payload.skill === "areaHalfShift");
    const skillRate = level === "hard" ? 0.12 : level === "normal" ? 0.05 : 0;
    if (seals.length && random() < skillRate) {
      if (level === "hard") return [...seals].sort((a, b) => b.metadata.colorCount - a.metadata.colorCount || COLORS.indexOf(a.payload.color) - COLORS.indexOf(b.payload.color))[0];
      return randomItem(seals, random);
    }
    if (shifts.length && random() < skillRate / 3) {
      if (level === "hard") {
        if (shiftRanking === "moved-count") {
          return [...shifts].sort((a, b) => b.metadata.movedCount - a.metadata.movedCount)[0];
        }
        return [...shifts].sort((a, b) => (
          b.metadata.colorPressureDelta - a.metadata.colorPressureDelta
          || b.metadata.maxColorPressureDelta - a.metadata.maxColorPressureDelta
          || b.metadata.frontierDelta - a.metadata.frontierDelta
          || b.metadata.movedCount - a.metadata.movedCount
        ))[0];
      }
      return randomItem(shifts, random);
    }
    if (!creates.length) return randomItem(actions, random);
    if (level === "easy") return randomItem(creates, random);
    const ranked = [...creates].sort((a, b) => (b.metadata.cells * 10 + b.metadata.contacts) - (a.metadata.cells * 10 + a.metadata.contacts));
    const band = level === "hard" ? ranked.slice(0, Math.min(4, ranked.length)) : ranked.slice(0, Math.min(12, ranked.length));
    return randomItem(band, random);
  }

  function chooseActionFromObservation({ observation, choices, shiftRanking = observation?.shiftRanking || "moved-count", random = Math.random, idFactory }) {
    if (!observation) throw new Error("CPU observation is required");
    if (!SHIFT_RANKINGS.includes(shiftRanking)) throw new Error(`Unknown Half Shift ranking: ${shiftRanking}`);
    if (typeof idFactory !== "function") throw new Error("CPU idFactory is required");
    const available = choices || enumerateRuleSafeActions(observation);
    const selected = scoreActions(observation, available, random, { shiftRanking });
    return {
      id: idFactory(),
      expectedVersion: observation.publicState.version,
      type: selected.type,
      payload: clone(selected.payload),
    };
  }

  function chooseAction({ publicState, privateState, ownPrivateState, level = "normal", shiftRanking = "moved-count", random = Math.random, idFactory }) {
    if (!LEVELS.includes(level)) throw new Error(`Unknown CPU level: ${level}`);
    const observation = makeObservation({ publicState, privateState, ownPrivateState, level, shiftRanking });
    return chooseActionFromObservation({ observation, shiftRanking, random, idFactory });
  }

  return Object.freeze({
    LEVELS,
    SHIFT_RANKINGS,
    POLICY_VERSIONS,
    makeObservation,
    enumerateRuleSafeActions,
    scoreActions,
    chooseActionFromObservation,
    chooseAction,
    internals: Object.freeze({ regionCandidates, analyzeRegionCandidates, shiftCandidates, adjacentColors, geometryOpportunityMetrics }),
  });
});
