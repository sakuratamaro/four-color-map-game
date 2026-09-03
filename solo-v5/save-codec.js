(function initSoloSaveCodec(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorSoloSaveCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function soloSaveCodecFactory() {
  "use strict";

  const SAVE_SCHEMA_VERSION = 1;
  const ENGINE_VERSION = "quick-engine-v1";
  const RNG_VERSION = 1;
  const MAX_SAVE_BYTES = 1024 * 1024;
  const STREAM_NAMES = Object.freeze(["palette", "roll", "effect", "cpu"]);
  const SEATS = Object.freeze(["A", "B"]);
  const PHASES = Object.freeze(["CREATE_FIRST", "WORK", "COLOR", "GAME_OVER"]);
  const COLORS = Object.freeze(["red", "blue", "yellow", "green"]);
  const SKILLS = Object.freeze(["colorPrism", "areaHalfShift", "disruptChoiceOne"]);
  const TERMINAL_REASONS = Object.freeze(["BOARD_LOCK", "ILLEGAL_COLOR", "NO_LEGAL_COLOR", "SEALED_OUT", "SURRENDER"]);
  const MAX_MACRO = 12 * 12;
  const MAX_MICRO = 48 * 48;

  function fail(message) { throw new Error(message); }
  function plain(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function seat(value) { return SEATS.includes(value); }
  function uint32(value) { return Number.isInteger(value) && value >= 0 && value <= 0xffffffff; }
  function exactKeys(value, keys) {
    return plain(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
  }
  function nonnegativeMap(value, keys) {
    return exactKeys(value, keys) && keys.every((key) => Number.isInteger(value[key]) && value[key] >= 0);
  }
  function uniqueIntegers(values, minimum, maximum) {
    return Array.isArray(values)
      && values.length > 0
      && values.every((value) => Number.isInteger(value) && value >= minimum && value < maximum)
      && new Set(values).size === values.length;
  }
  function macroInBounds(macro, bounds) {
    const x = macro % 12;
    const y = Math.floor(macro / 12);
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  }

  function validateState(state, engine) {
    if (!plain(state) || state.schemaVersion !== 1 || state.mode !== "quick" || state.status !== "playing") fail("invalid state envelope");
    if (!Number.isInteger(state.version) || state.version < 0 || !Number.isInteger(state.turn) || state.turn < 1) fail("invalid state counters");
    if (!Number.isInteger(state.nextRegion) || state.nextRegion < 1 || !seat(state.active) || !PHASES.includes(state.phase)) fail("invalid state phase");
    if (state.winner !== null && !seat(state.winner)) fail("invalid winner");
    if ((state.phase === "GAME_OVER") !== (state.winner !== null)) fail("winner phase contradiction");
    if (state.phase === "GAME_OVER") {
      if (!TERMINAL_REASONS.includes(state.reason)) fail("invalid terminal reason");
    } else if (state.reason !== null) fail("unexpected terminal reason");

    const bounds = state.playableBounds;
    if (!exactKeys(bounds, ["left", "top", "right", "bottom"])) fail("invalid playable bounds");
    if (![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isInteger)
      || bounds.left < 0 || bounds.top < 0 || bounds.right >= 12 || bounds.bottom >= 12
      || bounds.left > bounds.right || bounds.top > bounds.bottom) fail("invalid playable bounds");

    if (!plain(state.regions)) fail("invalid regions");
    const regionIds = new Set();
    const occupiedMicro = new Set();
    let pendingCount = 0;
    for (const [key, region] of Object.entries(state.regions)) {
      if (!plain(region) || typeof region.id !== "string" || !region.id || key !== region.id || regionIds.has(region.id)) fail("duplicate or invalid region");
      regionIds.add(region.id);
      if (!uniqueIntegers(region.sourceMacros, 0, MAX_MACRO) || !region.sourceMacros.every((macro) => macroInBounds(macro, bounds))) fail("invalid region macros");
      if (!uniqueIntegers(region.micro, 0, MAX_MICRO)) fail("invalid region geometry");
      for (const micro of region.micro) {
        if (occupiedMicro.has(micro)) fail("duplicate micro cell");
        occupiedMicro.add(micro);
      }
      if (region.color !== null && !COLORS.includes(region.color)) fail("unknown region color");
      if (!seat(region.createdBy) || !Array.isArray(region.controllers)
        || region.controllers.some((value) => !seat(value)) || new Set(region.controllers).size !== region.controllers.length
        || typeof region.isPending !== "boolean") fail("invalid region ownership");
      if (region.isPending) {
        pendingCount += 1;
        if (region.color !== null) fail("colored region cannot be pending");
      }
    }
    if (state.pending !== null && (typeof state.pending !== "string" || !state.regions[state.pending] || !state.regions[state.pending].isPending)) fail("unknown pending region");
    if (state.pending === null ? pendingCount !== 0 : pendingCount !== 1) fail("invalid pending region count");
    if (state.phase === "COLOR" && state.pending === null) fail("color phase requires pending region");
    if (["CREATE_FIRST", "WORK"].includes(state.phase) && state.pending !== null) fail("selection phase cannot have pending region");

    if (!exactKeys(state.palettes, SEATS) || !exactKeys(state.hands, SEATS) || !exactKeys(state.seals, SEATS)
      || !exactKeys(state.prismActive, SEATS) || !exactKeys(state.curseBacklash, SEATS) || !exactKeys(state.skillsUsed, SEATS)) fail("invalid player state");
    for (const player of SEATS) {
      const palette = state.palettes[player];
      if (!Array.isArray(palette) || palette.length !== 2 || palette.some((color) => !COLORS.includes(color)) || new Set(palette).size !== palette.length) fail("invalid palette");
      if (!nonnegativeMap(state.hands[player], SKILLS) || !nonnegativeMap(state.seals[player], COLORS)) fail("invalid hand or seals");
      if (typeof state.prismActive[player] !== "boolean" || !Number.isInteger(state.curseBacklash[player]) || state.curseBacklash[player] < 0
        || !Number.isInteger(state.skillsUsed[player]) || state.skillsUsed[player] < 0) fail("invalid player counters");
    }
    if (![state.rolledSize, state.baseRequired, state.requiredSize, state.sizeBonus].every(Number.isInteger)) fail("invalid size state");
    if (state.rolledSize < 1 || state.rolledSize > 4 || state.baseRequired < 0 || state.baseRequired > 4 || state.sizeBonus !== 0) fail("invalid size state");
    const boardLock = state.phase === "GAME_OVER" && state.reason === "BOARD_LOCK";
    if (boardLock ? state.requiredSize !== 0 : state.requiredSize < 1 || state.requiredSize > 4) fail("invalid required size");

    if (!plain(state.actionReceipts)) fail("invalid action receipts");
    for (const [id, receipt] of Object.entries(state.actionReceipts)) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
        || !plain(receipt) || !Number.isInteger(receipt.version) || receipt.version < 1
        || (receipt.winner !== null && !seat(receipt.winner))
        || (receipt.reason !== null && !TERMINAL_REASONS.includes(receipt.reason))) fail("invalid action receipt");
    }
    if (!Array.isArray(state.log) || state.log.some((entry) => typeof entry !== "string")) fail("invalid log");
    try {
      engine.publicState(state);
      engine.privateState(state, "A");
      engine.privateState(state, "B");
    } catch { fail("state projection failed"); }
  }

  function validateRng(snapshot) {
    if (!exactKeys(snapshot, ["version", "streams"]) || snapshot.version !== RNG_VERSION || !Array.isArray(snapshot.streams)
      || snapshot.streams.length !== STREAM_NAMES.length) fail("invalid RNG snapshot");
    const names = new Set();
    const states = {};
    for (const stream of snapshot.streams) {
      if (!exactKeys(stream, ["name", "state"]) || !STREAM_NAMES.includes(stream.name) || names.has(stream.name) || !uint32(stream.state)) fail("invalid RNG stream");
      names.add(stream.name);
      states[stream.name] = stream.state;
    }
    if (STREAM_NAMES.some((name) => !names.has(name))) fail("missing RNG stream");
    return states;
  }

  function decode(text, engine, cpu) {
    if (typeof text !== "string" || text.length === 0 || new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES) fail("invalid save payload");
    let record;
    try { record = JSON.parse(text); } catch { fail("invalid save JSON"); }
    if (!plain(record) || record.schemaVersion !== SAVE_SCHEMA_VERSION || record.engineVersion !== ENGINE_VERSION) fail("unsupported save version");
    if (!seat(record.humanSeat) || record.cpuSeat !== (record.humanSeat === "A" ? "B" : "A") || !cpu.LEVELS.includes(record.difficulty)) fail("invalid save configuration");
    if (record.policyVersion !== cpu.POLICY_VERSIONS[record.difficulty]) fail("unsupported CPU policy");
    validateState(record.state, engine);
    const rngStates = validateRng(record.rngSnapshot);
    return { ...record, rngStates };
  }

  function encode(record) { return JSON.stringify(record); }

  return Object.freeze({
    SAVE_SCHEMA_VERSION,
    ENGINE_VERSION,
    RNG_VERSION,
    MAX_SAVE_BYTES,
    STREAM_NAMES,
    decode,
    encode,
    validateState,
  });
});
