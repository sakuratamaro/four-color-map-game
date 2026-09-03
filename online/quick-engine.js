(function initQuickEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorQuickEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function quickEngineFactory() {
  "use strict";

  const COLORS = Object.freeze(["red", "blue", "yellow", "green"]);
  const QUICK_SKILLS = Object.freeze(["colorPrism", "areaHalfShift", "disruptChoiceOne"]);
  const TERMINAL_REASONS = Object.freeze({
    BOARD_LOCK: "BOARD_LOCK",
    ILLEGAL_COLOR: "ILLEGAL_COLOR",
    NO_LEGAL_COLOR: "NO_LEGAL_COLOR",
    SEALED_OUT: "SEALED_OUT",
    SURRENDER: "SURRENDER",
  });
  const DIE_FACE_POOL = Object.freeze([1, 1, 2, 2, 3, 4]);
  const WIDTH = 12;
  const HEIGHT = 12;
  const SCALE = 4;
  const MICRO_WIDTH = WIDTH * SCALE;
  const MICRO_HEIGHT = HEIGHT * SCALE;
  const START_BOUNDS = Object.freeze({ left: 1, top: 1, right: 10, bottom: 10 });

  class RuleError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "RuleError";
      this.code = code;
    }
  }

  function assertRule(condition, code, message) {
    if (!condition) throw new RuleError(code, message);
  }

  function other(player) {
    return player === "A" ? "B" : "A";
  }

  function mIndex(column, row) {
    return row * WIDTH + column;
  }

  function mXY(index) {
    return [index % WIDTH, Math.floor(index / WIDTH)];
  }

  function uIndex(x, y) {
    return y * MICRO_WIDTH + x;
  }

  function uXY(index) {
    return [index % MICRO_WIDTH, Math.floor(index / MICRO_WIDTH)];
  }

  function macroOfMicro(index) {
    const [x, y] = uXY(index);
    return mIndex(Math.floor(x / SCALE), Math.floor(y / SCALE));
  }

  function macroInWorld(index) {
    return Number.isInteger(index) && index >= 0 && index < WIDTH * HEIGHT;
  }

  function macroInPlayable(index, bounds) {
    if (!macroInWorld(index)) return false;
    const [column, row] = mXY(index);
    return column >= bounds.left && column <= bounds.right && row >= bounds.top && row <= bounds.bottom;
  }

  function playableMacros(bounds) {
    const result = [];
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      for (let column = bounds.left; column <= bounds.right; column += 1) {
        result.push(mIndex(column, row));
      }
    }
    return result;
  }

  function macroNeighbors(index) {
    const [column, row] = mXY(index);
    const result = [];
    if (column > 0) result.push(index - 1);
    if (column < WIDTH - 1) result.push(index + 1);
    if (row > 0) result.push(index - WIDTH);
    if (row < HEIGHT - 1) result.push(index + WIDTH);
    return result;
  }

  function microNeighbors(index) {
    const [x, y] = uXY(index);
    const result = [];
    if (x > 0) result.push(index - 1);
    if (x < MICRO_WIDTH - 1) result.push(index + 1);
    if (y > 0) result.push(index - MICRO_WIDTH);
    if (y < MICRO_HEIGHT - 1) result.push(index + MICRO_WIDTH);
    return result;
  }

  function microForMacro(index) {
    const [column, row] = mXY(index);
    const result = [];
    const x0 = column * SCALE;
    const y0 = row * SCALE;
    for (let y = y0; y < y0 + SCALE; y += 1) {
      for (let x = x0; x < x0 + SCALE; x += 1) result.push(uIndex(x, y));
    }
    return result;
  }

  function connected(values, neighborFn) {
    const set = values instanceof Set ? values : new Set(values);
    if (!set.size) return false;
    const first = set.values().next().value;
    const seen = new Set([first]);
    const queue = [first];
    while (queue.length) {
      const current = queue.shift();
      for (const next of neighborFn(current)) {
        if (set.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen.size === set.size;
  }

  function randomIndex(length, random) {
    const value = Number(random());
    assertRule(Number.isFinite(value) && value >= 0 && value < 1, "INVALID_RANDOM", "Random source must return [0, 1)");
    return Math.floor(value * length);
  }

  function shuffle(values, random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = randomIndex(index + 1, random);
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function drawPalettes(random) {
    const A = shuffle(COLORS, random).slice(0, 2);
    let B;
    do B = shuffle(COLORS, random).slice(0, 2);
    while ([...A].sort().join("|") === [...B].sort().join("|"));
    return { A, B };
  }

  function emptySeals() {
    return { red: 0, blue: 0, yellow: 0, green: 0 };
  }

  function quickHand() {
    return Object.fromEntries(QUICK_SKILLS.map((key) => [key, 1]));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ownerMap(state) {
    const owner = Array(MICRO_WIDTH * MICRO_HEIGHT).fill(null);
    for (const region of Object.values(state.regions)) {
      for (const micro of region.micro) {
        assertRule(Number.isInteger(micro) && micro >= 0 && micro < owner.length, "INVALID_STATE", "Region extends beyond the world");
        assertRule(!owner[micro] || owner[micro] === region.id, "INVALID_STATE", "Regions overlap");
        owner[micro] = region.id;
      }
    }
    return owner;
  }

  function freeMacros(state) {
    const owner = ownerMap(state);
    return playableMacros(state.playableBounds).filter((macro) => microForMacro(macro).some((micro) => !owner[micro]));
  }

  function candidateMicro(state, macros) {
    const owner = ownerMap(state);
    const result = new Set();
    for (const macro of macros) for (const micro of microForMacro(macro)) if (!owner[micro]) result.add(micro);
    return result;
  }

  function candidateTouchesExisting(state, macros) {
    const owner = ownerMap(state);
    const shape = candidateMicro(state, macros);
    for (const micro of shape) for (const next of microNeighbors(micro)) if (owner[next]) return true;
    return false;
  }

  function hasLegalRegionOfSize(state, size) {
    if (size <= 0) return false;
    const free = freeMacros(state);
    const freeSet = new Set(free);
    if (free.length < size) return false;
    const firstRegion = Object.keys(state.regions).length === 0;
    const visited = new Set();

    function search(selected, frontier) {
      const signature = [...selected].sort((a, b) => a - b).join(",");
      if (visited.has(signature)) return false;
      visited.add(signature);
      if (selected.size === size) {
        const shape = candidateMicro(state, selected);
        return shape.size > 0 && connected(shape, microNeighbors) && (firstRegion || candidateTouchesExisting(state, selected));
      }
      for (const next of frontier) {
        const nextSelected = new Set(selected).add(next);
        const nextFrontier = new Set(frontier);
        nextFrontier.delete(next);
        for (const neighbor of macroNeighbors(next)) {
          if (freeSet.has(neighbor) && !nextSelected.has(neighbor)) nextFrontier.add(neighbor);
        }
        if (search(nextSelected, nextFrontier)) return true;
      }
      return false;
    }

    for (const start of free) {
      if (search(new Set([start]), new Set(macroNeighbors(start).filter((value) => freeSet.has(value))))) return true;
    }
    return false;
  }

  function bestLegalSize(state, maximum) {
    for (let size = maximum; size >= 1; size -= 1) if (hasLegalRegionOfSize(state, size)) return size;
    return 0;
  }

  function appendLog(state, text) {
    state.log.push(`T${state.turn}  ${text}`);
  }

  function finish(state, winner, reason) {
    state.winner = winner;
    state.reason = reason;
    state.phase = "GAME_OVER";
    appendLog(state, `Player ${winner} wins (${reason}).`);
  }

  function beginSelection(state, player, random, opening) {
    state.active = player;
    state.phase = opening ? "CREATE_FIRST" : "WORK";
    const rolled = DIE_FACE_POOL[randomIndex(DIE_FACE_POOL.length, random)];
    const required = bestLegalSize(state, rolled);
    state.rolledSize = rolled;
    state.baseRequired = required;
    state.requiredSize = required;
    state.sizeBonus = 0;
    if (required <= 0) finish(state, player, TERMINAL_REASONS.BOARD_LOCK);
  }

  function applyPendingCurse(state, player, random) {
    let remaining = Math.max(0, state.curseBacklash[player] || 0);
    while (remaining > 0) {
      const candidates = state.palettes[player].filter((color) => (state.seals[player][color] || 0) <= 0);
      if (!candidates.length) break;
      const color = candidates[randomIndex(candidates.length, random)];
      state.seals[player][color] = Math.max(state.seals[player][color] || 0, 1);
      remaining -= 1;
    }
    state.curseBacklash[player] = 0;
  }

  function passToColor(state, player, random) {
    state.active = player;
    state.phase = "COLOR";
    state.turn += 1;
    applyPendingCurse(state, player, random);
  }

  function validateMacros(state, macros) {
    assertRule(Array.isArray(macros), "INVALID_ACTION", "macros must be an array");
    const selected = new Set(macros);
    assertRule(selected.size === macros.length, "INVALID_SELECTION", "Duplicate macro index");
    assertRule(selected.size === state.requiredSize, "INVALID_SELECTION", `Exactly ${state.requiredSize} macros are required`);
    assertRule([...selected].every((value) => macroInPlayable(value, state.playableBounds)), "INVALID_SELECTION", "Macro is outside playable bounds");
    assertRule(connected(selected, macroNeighbors), "INVALID_SELECTION", "Selected macros are not connected");
    const free = new Set(freeMacros(state));
    assertRule([...selected].every((value) => free.has(value)), "INVALID_SELECTION", "Selected macro has no free cells");
    const shape = candidateMicro(state, selected);
    assertRule(shape.size > 0 && connected(shape, microNeighbors), "INVALID_SELECTION", "Selected free geometry is not connected");
    if (Object.keys(state.regions).length) {
      assertRule(candidateTouchesExisting(state, selected), "INVALID_SELECTION", "Selection must touch an existing region by an edge");
    }
    return { selected, shape };
  }

  function adjacentColors(state, regionId) {
    const region = state.regions[regionId];
    const owner = ownerMap(state);
    const colors = new Set();
    for (const micro of region.micro) {
      for (const next of microNeighbors(micro)) {
        const nextId = owner[next];
        if (nextId && nextId !== regionId && state.regions[nextId].color) colors.add(state.regions[nextId].color);
      }
    }
    return colors;
  }

  function mergeSameColorRegions(state) {
    while (true) {
      let pair = null;
      for (const region of Object.values(state.regions)) {
        if (!region.color) continue;
        const owner = ownerMap(state);
        for (const micro of region.micro) {
          for (const next of microNeighbors(micro)) {
            const nextId = owner[next];
            if (nextId && nextId !== region.id && state.regions[nextId].color === region.color) {
              pair = [region.id, nextId];
              break;
            }
          }
          if (pair) break;
        }
        if (pair) break;
      }
      if (!pair) return;
      const [keepId, dropId] = pair;
      const keep = state.regions[keepId];
      const drop = state.regions[dropId];
      keep.micro = [...new Set([...keep.micro, ...drop.micro])];
      keep.sourceMacros = [...new Set([...keep.sourceMacros, ...drop.sourceMacros])];
      keep.controllers = [...new Set([...keep.controllers, ...drop.controllers])];
      if (state.pending === dropId) state.pending = keepId;
      delete state.regions[dropId];
    }
  }

  function consumeSkill(state, actor, key) {
    assertRule((state.hands[actor][key] || 0) > 0, "SKILL_UNAVAILABLE", "Skill is unavailable");
    state.hands[actor][key] -= 1;
    state.skillsUsed[actor] += 1;
  }

  function applyCreateRegion(state, actor, payload, random) {
    assertRule(state.phase === "WORK" || state.phase === "CREATE_FIRST", "WRONG_PHASE", "Region creation is unavailable now");
    const { selected, shape } = validateMacros(state, payload.macros);
    const id = `R${state.nextRegion}`;
    state.nextRegion += 1;
    state.regions[id] = {
      id,
      sourceMacros: [...selected],
      micro: [...shape],
      color: null,
      createdBy: actor,
      controllers: [],
      isPending: true,
    };
    state.pending = id;
    appendLog(state, `Player ${actor} created ${id} (${selected.size} macros).`);
    passToColor(state, other(actor), random);
  }

  function applyColorRegion(state, actor, payload, random) {
    assertRule(state.phase === "COLOR" && state.pending, "WRONG_PHASE", "No region is waiting for color");
    const color = payload.color;
    assertRule(COLORS.includes(color), "INVALID_COLOR", "Unknown color");
    const palette = state.prismActive[actor] ? COLORS : state.palettes[actor];
    assertRule(palette.includes(color), "COLOR_UNAVAILABLE", "Color is not in the active palette");
    assertRule((state.seals[actor][color] || 0) <= 0, "COLOR_SEALED", "Color is sealed");

    if (adjacentColors(state, state.pending).has(color)) {
      state.prismActive[actor] = false;
      finish(state, other(actor), TERMINAL_REASONS.ILLEGAL_COLOR);
      return;
    }

    const region = state.regions[state.pending];
    region.color = color;
    region.controllers = [...new Set([...region.controllers, actor])];
    region.isPending = false;
    appendLog(state, `Player ${actor} colored ${region.id} ${color}.`);
    state.pending = null;
    state.prismActive[actor] = false;
    for (const candidate of COLORS) {
      if (state.seals[actor][candidate] > 0) state.seals[actor][candidate] -= 1;
    }
    mergeSameColorRegions(state);
    beginSelection(state, actor, random, false);
  }

  function applyHalfShift(state, actor, payload) {
    assertRule(state.phase === "WORK" || state.phase === "CREATE_FIRST", "WRONG_PHASE", "Half Shift is unavailable now");
    const macro = payload.macro;
    const direction = payload.direction;
    assertRule(macroInWorld(macro), "INVALID_TARGET", "Unknown macro index");
    assertRule(["left", "right", "up", "down"].includes(direction), "INVALID_TARGET", "Unknown shift direction");
    const [column, row] = mXY(macro);
    const horizontal = direction === "left" || direction === "right";
    const delta = direction === "left" || direction === "up" ? -2 : 2;
    const moved = {};
    const occupied = new Set();
    let movedCount = 0;

    for (const region of Object.values(state.regions)) {
      const nextMicro = [];
      for (const micro of region.micro) {
        let [x, y] = uXY(micro);
        const inBand = horizontal
          ? y >= row * SCALE && y < (row + 1) * SCALE
          : x >= column * SCALE && x < (column + 1) * SCALE;
        if (inBand) {
          if (horizontal) x += delta;
          else y += delta;
          movedCount += 1;
        }
        assertRule(x >= 0 && y >= 0 && x < MICRO_WIDTH && y < MICRO_HEIGHT, "INVALID_SHIFT", "Shift leaves the world");
        const next = uIndex(x, y);
        assertRule(!occupied.has(next), "INVALID_SHIFT", "Shift causes overlap");
        occupied.add(next);
        nextMicro.push(next);
      }
      assertRule(connected(nextMicro, microNeighbors), "INVALID_SHIFT", "Shift disconnects a region");
      moved[region.id] = nextMicro;
    }
    assertRule(movedCount > 0, "INVALID_SHIFT", "Selected band contains no geometry");
    consumeSkill(state, actor, "areaHalfShift");
    for (const [id, micro] of Object.entries(moved)) state.regions[id].micro = micro;
    mergeSameColorRegions(state);
    const adjusted = bestLegalSize(state, state.requiredSize);
    if (adjusted <= 0) finish(state, actor, TERMINAL_REASONS.BOARD_LOCK);
    else state.requiredSize = adjusted;
  }

  function applySkill(state, actor, payload, random) {
    const key = payload.skill;
    if (key === "colorPrism") {
      assertRule(state.phase === "COLOR", "WRONG_PHASE", "Four Color Release is a color-phase skill");
      consumeSkill(state, actor, key);
      state.prismActive[actor] = true;
      return;
    }
    if (key === "disruptChoiceOne") {
      assertRule(state.phase === "WORK" || state.phase === "CREATE_FIRST", "WRONG_PHASE", "Color Seal is a work-phase skill");
      assertRule(COLORS.includes(payload.color), "INVALID_COLOR", "Unknown seal color");
      consumeSkill(state, actor, key);
      const target = other(actor);
      state.seals[target][payload.color] = Math.max(state.seals[target][payload.color], 1);
      state.curseBacklash[actor] += 1;
      return;
    }
    if (key === "areaHalfShift") {
      applyHalfShift(state, actor, payload);
      return;
    }
    throw new RuleError("UNKNOWN_SKILL", "Skill is not supported in quick mode");
  }

  function createQuickGame(options = {}) {
    const random = options.random || Math.random;
    const paletteRandom = options.paletteRandom || random;
    const rollRandom = options.rollRandom || random;
    const configuredHands = options.hands || {};
    const state = {
      schemaVersion: 1,
      mode: "quick",
      version: 0,
      status: "playing",
      active: "A",
      phase: "CREATE_FIRST",
      turn: 1,
      nextRegion: 1,
      regions: {},
      pending: null,
      winner: null,
      reason: null,
      playableBounds: { ...START_BOUNDS },
      palettes: drawPalettes(paletteRandom),
      hands: {
        A: { ...quickHand(), ...(configuredHands.A || {}) },
        B: { ...quickHand(), ...(configuredHands.B || {}) },
      },
      prismActive: { A: false, B: false },
      seals: { A: emptySeals(), B: emptySeals() },
      curseBacklash: { A: 0, B: 0 },
      skillsUsed: { A: 0, B: 0 },
      rolledSize: null,
      baseRequired: 0,
      requiredSize: 0,
      sizeBonus: 0,
      actionReceipts: {},
      log: [],
    };
    beginSelection(state, "A", rollRandom, true);
    return state;
  }

  function applyAction(currentState, actor, action, options = {}) {
    const random = options.random || Math.random;
    const rollRandom = options.rollRandom || random;
    const effectRandom = options.effectRandom || random;
    assertRule(actor === "A" || actor === "B", "NOT_A_PLAYER", "Actor must occupy a seat");
    assertRule(action && typeof action === "object", "INVALID_ACTION", "Action is required");
    assertRule(
      typeof action.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(action.id),
      "INVALID_ACTION_ID",
      "Action id must be a UUID",
    );
    if (currentState.actionReceipts[action.id]) {
      return { state: currentState, duplicate: true, result: currentState.actionReceipts[action.id] };
    }
    assertRule(action.expectedVersion === currentState.version, "STALE_VERSION", "Match version is stale");
    assertRule(!currentState.winner, "MATCH_FINISHED", "Match is already finished");
    assertRule(currentState.active === actor || action.type === "SURRENDER", "NOT_YOUR_TURN", "It is not this player's turn");

    const state = clone(currentState);
    const payload = action.payload || {};
    if (action.type === "CREATE_REGION") applyCreateRegion(state, actor, payload, effectRandom);
    else if (action.type === "COLOR_REGION") applyColorRegion(state, actor, payload, rollRandom);
    else if (action.type === "USE_SKILL") applySkill(state, actor, payload, effectRandom);
    else if (action.type === "DECLARE_NO_COLOR") {
      assertRule(state.phase === "COLOR", "WRONG_PHASE", "No-color loss applies only during color phase");
      const palette = state.prismActive[actor] ? COLORS : state.palettes[actor];
      const blocked = adjacentColors(state, state.pending);
      const legal = palette.filter((color) => state.seals[actor][color] <= 0 && !blocked.has(color));
      assertRule(legal.length === 0, "COLORS_REMAIN", "At least one rule-safe color remains");
      const allSealed = palette.every((color) => state.seals[actor][color] > 0);
      finish(state, other(actor), allSealed ? TERMINAL_REASONS.SEALED_OUT : TERMINAL_REASONS.NO_LEGAL_COLOR);
    } else if (action.type === "SURRENDER") finish(state, other(actor), TERMINAL_REASONS.SURRENDER);
    else throw new RuleError("UNKNOWN_ACTION", "Unknown action type");

    state.version += 1;
    const result = { version: state.version, winner: state.winner, reason: state.reason };
    state.actionReceipts[action.id] = result;
    return { state, duplicate: false, result };
  }

  function publicState(state) {
    const projection = clone(state);
    delete projection.palettes;
    delete projection.hands;
    delete projection.actionReceipts;
    return projection;
  }

  function privateState(state, seat) {
    assertRule(seat === "A" || seat === "B", "NOT_A_PLAYER", "Seat is required");
    return {
      seat,
      palette: [...state.palettes[seat]],
      hand: { ...state.hands[seat] },
      prismActive: state.prismActive[seat],
      seals: { ...state.seals[seat] },
    };
  }

  return Object.freeze({
    COLORS,
    QUICK_SKILLS,
    TERMINAL_REASONS,
    RuleError,
    createQuickGame,
    applyAction,
    publicState,
    privateState,
    internals: Object.freeze({ mIndex, microForMacro, macroOfMicro, bestLegalSize }),
  });
});
