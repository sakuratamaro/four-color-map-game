"use strict";

// UDL-051 / REG-CPU-F3-SPLIT-ORIENTATION. Authored valid states, not historical
// match replay or a claim that all ten stock loadouts contain a split card.
const assert = require("node:assert/strict");
const test = require("node:test");
const { performance } = require("node:perf_hooks");
const cpu = require("../standard/standard-cpu.js");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const roster = require("../standard/standard-cpu-roster.js");

const streams = seed => engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
const otherSeat = seat => seat === "A" ? "B" : "A";
function macroMicro(macro, bounds) {
  const { macroWidth: width, microScale: scale } = bounds;
  return Array.from({ length: scale * scale }, (_, i) =>
    (Math.floor(macro / width) * scale + Math.floor(i / scale)) * width * scale
      + (macro % width) * scale + i % scale);
}
function fixture(seat = "A", mirrored = false) {
  const character = roster.CPU_CHARACTERS.rei, other = otherSeat(seat);
  const state = match.createStandardMatch({ matchId: "cpu-split-rescue-42054", firstSeat: seat,
    loadouts: { A: character.loadout, B: character.loadout } }, streams(42054));
  Object.assign(state, { phase: "COLOR", turn: 1, pending: "R3", reserved: null });
  state.basicPalettes[seat] = ["red", "blue"];
  state.bonusColors[seat] = "yellow";
  state.bonusUsesRemaining[seat] = 0;
  state.hands[seat] = { colorRegionSplit: 1 };
  const bounds = state.playableBounds, width = bounds.macroWidth;
  const left = width + 1, right = width + 2;
  const region = (id, macro, color) => ({ id, micro: macroMicro(macro, bounds),
    sourceMacros: [macro], controllers: [other], color, isPending: false });
  state.regions = {
    R1: region("R1", mirrored ? 2 : 1, "red"),
    R2: region("R2", mirrored ? width + 3 : width, "blue"),
    R3: { id: "R3", micro: [...macroMicro(left, bounds), ...macroMicro(right, bounds)],
      sourceMacros: [left, right], controllers: [other], color: null, isPending: true },
  };
  match.validateStandardState(state);
  return { state, safeMacro: mirrored ? left : right };
}
function project(state, seat) {
  return { publicState: match.projectStandardPublicState(state),
    ownPrivateState: match.projectStandardPrivateState(state, seat) };
}
function candidates(state, seat, orderedSplits = true) {
  return cpu.enumerateCpuActions(cpu.makeObservation({ ...project(state, seat), difficulty: "hard" }), { orderedSplits });
}
function choose(state, seat, characterId, seed = 42, policyVersion) {
  const rng = streams(seed);
  return roster.chooseCharacterAction({ ...project(state, seat), characterId, policyVersion,
    random: () => rng["cpu-B"].next(), tieBreakRandom: () => rng["cpu-tie-break"].next() });
}
function apply(state, seat, action) {
  const result = match.applyStandardAction({ state, actor: seat, action, expectedVersion: state.version, rngStreams: streams(42054) });
  assert.equal(result.ok, true, action.type + "/" + result.code);
  return result.state;
}

for (const seat of ["A", "B"]) for (const mirrored of [false, true]) {
  test("UDL051 all ten policies split, color and return the omitted/symmetric half: " + seat + "/" + mirrored, () => {
    const { state, safeMacro } = fixture(seat, mirrored), before = structuredClone(state);
    for (const id of Object.keys(roster.CPU_CHARACTERS)) for (const seed of [0, 42054, 0xffffffff]) {
      const action = choose(state, seat, id, seed);
      assert.equal(action.type, "USE_SKILL", id);
      assert.equal(action.payload.skill, "colorRegionSplit", id);
      assert.deepEqual(action.payload.sourceMacros, [safeMacro], id);
      const split = apply(state, seat, action);
      assert.equal(split.hands[seat].colorRegionSplit, 0);
      const selectedColor = candidates(split, seat).find(a => a.type === "COLOR_REGION");
      assert.ok(selectedColor, id);
      const returnedId = split.reserved;
      const returned = apply(split, seat, selectedColor);
      assert.equal(returned.active, otherSeat(seat));
      assert.equal(returned.phase, "COLOR");
      assert.equal(returned.pending, returnedId);
      assert.equal(returned.reserved, null);
      assert.deepEqual(state, before, "selection/application must not mutate source");
    }
  });
}

test("all current and saved old policies remain opponent-private poison invariant", () => {
  for (const seat of ["A", "B"]) {
    const { state } = fixture(seat), other = otherSeat(seat), poisoned = structuredClone(state);
    poisoned.hands[other] = { colorPrism: 999, colorRegionSplit: 999 };
    poisoned.basicPalettes[other].reverse();
    poisoned.privateEffects[other] = { hiddenAnswer: "must-not-be-observed" };
    for (const id of Object.keys(roster.CPU_CHARACTERS)) {
      for (const policy of [roster.CPU_CHARACTERS[id].policyVersion, roster.PRE_SPLIT_POLICY_VERSIONS[id]]) {
        assert.deepEqual(choose(state, seat, id, 73, policy), choose(poisoned, seat, id, 73, policy), id);
      }
    }
  }
});

test("all saved pre-split policies including both Kurogane versions retain original F3 and mirror behavior", () => {
  for (const id of Object.keys(roster.CPU_CHARACTERS)) {
    const policies = [roster.PRE_SPLIT_POLICY_VERSIONS[id]];
    if (id === "kurogane") policies.push(roster.KUROGANE_LEGACY_POLICY_VERSION);
    for (const policy of policies) {
      assert.equal(choose(fixture().state, "A", id, 0, policy).type, "SURRENDER");
      const { state, safeMacro } = fixture("A", true);
      assert.deepEqual(choose(state, "A", id, 0, policy).payload.sourceMacros, [safeMacro]);
    }
  }
});

test("Quick/default enumeration remains legacy unless explicitly versioned; alpha.1 dispatch is unchanged", () => {
  const { state } = fixture();
  const observation = cpu.makeObservation({ ...project(state, "A"), difficulty: "hard" });
  assert.deepEqual(cpu.enumerateCpuActions(observation), cpu.enumerateCpuActions(observation, { orderedSplits: false }));
  assert.equal(cpu.chooseCpuAction({ observation, random: () => 0 }).type, "SURRENDER");
  const legacy = structuredClone(state);
  legacy.engineVersion = "5.0.0-alpha.1";
  delete legacy.skillCategoryWindow;
  for (const id of Object.keys(roster.CPU_CHARACTERS)) {
    assert.deepEqual(choose(legacy, "A", id, 5), choose(legacy, "A", id, 5, roster.PRE_SPLIT_POLICY_VERSIONS[id]));
  }
});

test("new policy changes only split enumeration, retaining WORK choices and Kurogane lookahead-v2 scoring", () => {
  for (const id of Object.keys(roster.CPU_CHARACTERS)) {
    const character = roster.CPU_CHARACTERS[id];
    const state = match.createStandardMatch({ matchId: "cpu-work-compat-" + id, firstSeat: "A",
      loadouts: { A: character.loadout, B: character.loadout } }, streams(71));
    for (const seed of [0, 19, 123]) {
      assert.deepEqual(choose(state, "A", id, seed),
        choose(state, "A", id, seed, roster.PRE_SPLIT_POLICY_VERSIONS[id]), id);
    }
  }
});

test("missing, empty or non-owned split hand and used color category cannot manufacture a rescue", () => {
  for (const change of [
    state => { state.hands.A = {}; },
    state => { state.hands.A = { colorRegionSplit: 0 }; },
    state => { state.hands.A = { disruptChoiceOne: 1 }; },
    state => { state.skillCategoryWindow.categories = ["color"]; },
    state => { state.regions.R3.controllers = ["A"]; },
    state => { state.publicEffects.A.seals = { red: 1, blue: 1, yellow: 1, green: 1 }; },
  ]) {
    const { state } = fixture();
    change(state);
    assert.equal(candidates(state, "A").some(a => a.payload?.skill === "colorRegionSplit"), false);
    assert.equal(choose(state, "A", "rei").type, "SURRENDER");
  }
});

test("macro and micro disconnected halves, one-cell region and existing reservation remain rejected", () => {
  for (const change of [
    state => {
      const w = state.playableBounds.macroWidth;
      const macros = [w + 1, w + 3, w + 5];
      state.regions.R3.sourceMacros = macros;
      state.regions.R3.micro = macros.flatMap(m => macroMicro(m, state.playableBounds));
    },
    state => {
      const all = state.regions.R3.micro;
      const selected = new Set(macroMicro(state.regions.R3.sourceMacros[0], state.playableBounds));
      state.regions.R3.micro = all.filter(cell => selected.has(cell));
    },
    state => {
      state.regions.R3.sourceMacros = [state.regions.R3.sourceMacros[0]];
      state.regions.R3.micro = macroMicro(state.regions.R3.sourceMacros[0], state.playableBounds);
    },
    state => {
      const macro = 4 * state.playableBounds.macroWidth + 4;
      state.reserved = "R4";
      state.regions.R4 = { id: "R4", sourceMacros: [macro], micro: macroMicro(macro, state.playableBounds),
        controllers: [], color: null, isPending: false, isReserved: true };
    },
  ]) {
    const { state } = fixture();
    change(state);
    assert.equal(candidates(state, "A").some(a => a.payload?.skill === "colorRegionSplit"), false);
  }
});

test("maximum five-source pending region remains finite and includes every connected complement", () => {
  const { state } = fixture(), bounds = state.playableBounds, w = bounds.macroWidth;
  const macros = [w + 1, w + 2, w + 3, 2 * w + 1, 2 * w + 2];
  state.regions = { R3: { id: "R3", sourceMacros: macros, micro: macros.flatMap(m => macroMicro(m, bounds)),
    controllers: ["B"], color: null, isPending: true } };
  match.validateStandardState(state);
  const started = performance.now();
  const current = candidates(state, "A").filter(a => a.payload?.skill === "colorRegionSplit");
  const old = candidates(state, "A", false).filter(a => a.payload?.skill === "colorRegionSplit");
  assert.equal(current.length, 2 * old.length);
  assert.ok(current.length > 0 && current.length <= 30);
  const keys = new Set(current.map(a => a.payload.sourceMacros.join(",")));
  assert.equal(keys.size, current.length);
  for (const action of current) {
    assert.ok(keys.has(macros.filter(m => !action.payload.sourceMacros.includes(m)).join(",")));
    apply(state, "A", action);
  }
  assert.ok(performance.now() - started < 3000, "bounded offline check, not a benchmark claim");
  // Out-of-domain input must not reach a large or wrapped bit mask for new policies.
  state.regions.R3.sourceMacros = Array.from({ length: 32 }, (_, i) => i);
  assert.equal(candidates(state, "A").some(a => a.payload?.skill === "colorRegionSplit"), false);
});

test("new policy versions are exact, character-bound and do not silently accept invented revisions", () => {
  const { state } = fixture();
  for (const id of Object.keys(roster.CPU_CHARACTERS)) {
    assert.equal(roster.CPU_CHARACTERS[id].policyVersion, "standard-character-split-rescue-v1:" + id);
    const other = id === "rei" ? "yuzu" : "rei";
    for (const invalid of [roster.CPU_CHARACTERS[other].policyVersion, roster.PRE_SPLIT_POLICY_VERSIONS[other],
      "standard-character-split-rescue-v2:" + id, roster.CPU_CHARACTERS[id].policyVersion + ":extra"]) {
      assert.throws(() => choose(state, "A", id, 42, invalid), /UNKNOWN_CPU_POLICY_VERSION/);
    }
  }
});
test("generated Edge engine activates new profiles while dispatching exact saved room policies", () => {
  const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,
    "../supabase/functions/standard-game-action/standard-engine.bundle.js"), "utf8"), sandbox);
  const api = sandbox.FourColorStandardServerEngine, { state, safeMacro } = fixture("B");
  const observation = project(state, "B");
  for (const id of Object.keys(roster.CPU_CHARACTERS)) {
    const profile = api.createCpuProfile(id);
    assert.equal(profile.policyVersion, roster.CPU_CHARACTERS[id].policyVersion);
    const current = api.chooseCpuAction({ ...observation, characterId: id, policyVersion: profile.policyVersion, seed: 11 });
    assert.equal(current.type, "USE_SKILL");
    assert.deepEqual(Array.from(current.payload.sourceMacros), [safeMacro]);
    const saved = api.chooseCpuAction({ ...observation, characterId: id,
      policyVersion: roster.PRE_SPLIT_POLICY_VERSIONS[id], seed: 11 });
    assert.equal(saved.type, "SURRENDER");
  }
});
