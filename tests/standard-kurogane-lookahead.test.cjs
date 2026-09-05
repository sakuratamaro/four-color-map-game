"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const cpu = require("../standard/standard-cpu.js");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const roster = require("../standard/standard-cpu-roster.js");

function streams(seed) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

const FIXED_TRACES = Object.freeze({
  yuzu: { type: "USE_SKILL", payload: { skill: "disruptRandomOne" }, metrics: { skillPriority: 17 } },
  ren: { type: "USE_SKILL", payload: { skill: "areaDiePlus" }, metrics: { skillPriority: 16 } },
  minato: { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color: "yellow" }, metrics: { skillPriority: 19 } },
  koharu: { type: "USE_SKILL", payload: { skill: "areaResize", mode: "expand", side: "right" }, metrics: { skillPriority: 10 } },
  aoi: { type: "USE_SKILL", payload: { skill: "disruptChoiceOne", color: "yellow" }, metrics: { skillPriority: 19 } },
  kai: { type: "CREATE_REGION", payload: { sourceMacros: [61] }, metrics: { contacts: 0, colorPressure: 0 } },
  tsubasa: { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color: "green" }, metrics: { skillPriority: 19 } },
  shion: { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color: "blue" }, metrics: { skillPriority: 19 } },
  rei: { type: "USE_SKILL", payload: { skill: "disruptChoiceTwo", color: "yellow" }, metrics: { skillPriority: 19 } },
  kurogane: { type: "USE_SKILL", payload: { skill: "disruptChoiceThree", color: "green" }, metrics: { skillPriority: 19 } },
});

test("the nine unchanged policies and legacy Kurogane retain their fixed traces", () => {
  for (const [index, character] of Object.values(roster.CPU_CHARACTERS).entries()) {
    const rng = streams(1000 + index);
    const current = match.createStandardMatch({
      matchId: `character-${character.id}`,
      firstSeat: "A",
      loadouts: { A: character.loadout, B: character.loadout },
    }, rng);
    const policyVersion = character.id === "kurogane"
      ? roster.KUROGANE_LEGACY_POLICY_VERSION
      : character.policyVersion;
    const action = roster.chooseCharacterAction({
      publicState: match.projectStandardPublicState(current),
      ownPrivateState: match.projectStandardPrivateState(current, "A"),
      characterId: character.id,
      policyVersion,
      random: () => ((index * 17) % 97) / 97,
      tieBreakRandom: () => ((index * 29) % 89) / 89,
    });
    assert.deepEqual(action, FIXED_TRACES[character.id], character.id);
  }
});

function region(id, macro, color) {
  return { id, micro: [macro], sourceMacros: [macro], controllers: ["A"], color, isPending: false };
}

function trapFixture() {
  return {
    publicState: {
      status: "PLAYING",
      active: "A",
      phase: "WORK",
      requiredSize: 1,
      preparedOutgoing: null,
      playableBounds: { minRow: 0, maxRow: 2, minCol: 0, maxCol: 4, macroWidth: 5, microScale: 1 },
      regions: {
        R1: region("R1", 1, "red"),
        R2: region("R2", 5, "blue"),
        R3: region("R3", 7, "yellow"),
        R4: region("R4", 3, "red"),
        R5: region("R5", 9, "green"),
      },
      publicEffects: { A: { seals: {} }, B: { seals: { green: 1 } } },
    },
    ownPrivateState: {
      seat: "A",
      basicPalette: ["red", "blue", "yellow"],
      bonusColor: "green",
      bonusUsesRemaining: 1,
      hand: {},
      privateEffects: {},
    },
  };
}

test("new Kurogane deterministically chooses a public guaranteed color trap from existing candidates", () => {
  const fixture = trapFixture();
  const observation = cpu.makeObservation({ ...fixture, difficulty: "hard" });
  const legalActions = cpu.enumerateCpuActions(observation);
  const choose = () => roster.chooseCharacterAction({
    ...fixture,
    characterId: "kurogane",
    policyVersion: roster.KUROGANE_POLICY_VERSION,
    random: () => 0,
    tieBreakRandom: () => .99,
  });
  const first = choose();
  const second = choose();
  assert.deepEqual(first, second);
  assert.equal(legalActions.some((action) => JSON.stringify(action) === JSON.stringify(first)), true);
  assert.deepEqual(first.payload.sourceMacros, [6]);
  assert.deepEqual(cpu.immediateOpponentColorOptions(observation, first), []);
  const legacy = roster.chooseCharacterAction({
    ...fixture,
    characterId: "kurogane",
    policyVersion: roster.KUROGANE_LEGACY_POLICY_VERSION,
    random: () => 0,
    tieBreakRandom: () => .99,
  });
  assert.deepEqual(legacy.payload.sourceMacros, [8]);
  assert.deepEqual(cpu.immediateOpponentColorOptions(observation, legacy), ["blue"]);
});

test("new Kurogane minimizes nonzero public color options before CREATE base-score tie breaking", () => {
  const fixture = trapFixture();
  fixture.publicState.publicEffects.B.seals = {};
  const observation = cpu.makeObservation({ ...fixture, difficulty: "hard" });
  const createActions = cpu.enumerateCpuActions(observation).filter((action) => action.type === "CREATE_REGION");
  const optionCounts = createActions.map((action) => cpu.immediateOpponentColorOptions(observation, action).length);
  const minimum = Math.min(...optionCounts);
  assert.equal(minimum > 0, true);
  const chosen = roster.chooseCharacterAction({
    ...fixture,
    characterId: "kurogane",
    policyVersion: roster.KUROGANE_POLICY_VERSION,
    random: () => 0,
    tieBreakRandom: () => .99,
  });
  assert.equal(cpu.immediateOpponentColorOptions(observation, chosen).length, minimum);
});

test("new Kurogane ignores poisoned human private state", () => {
  const character = roster.CPU_CHARACTERS.kurogane;
  const current = match.createStandardMatch({
    matchId: "kurogane-private-poison",
    firstSeat: "A",
    loadouts: { A: character.loadout, B: character.loadout },
  }, streams(4455));
  const poisoned = JSON.parse(JSON.stringify(current));
  poisoned.hands.B = { colorPrism: 999 };
  poisoned.basicPalettes.B.reverse();
  poisoned.bonusUsesRemaining.B = 0;
  poisoned.privateEffects.B = { hiddenAnswer: "forbidden" };
  const choose = (state) => roster.chooseCharacterAction({
    publicState: match.projectStandardPublicState(state),
    ownPrivateState: match.projectStandardPrivateState(state, "A"),
    characterId: "kurogane",
    policyVersion: roster.KUROGANE_POLICY_VERSION,
    random: () => .17,
    tieBreakRandom: () => .83,
  });
  assert.deepEqual(choose(current), choose(poisoned));
});

test("new Kurogane prefers a basic color over consuming its final bonus use", () => {
  const publicState = {
    status: "PLAYING",
    active: "A",
    phase: "COLOR",
    pending: "R1",
    microWidth: 3,
    regions: { R1: { id: "R1", micro: [4], sourceMacros: [4], controllers: ["B"], color: null, isPending: true } },
    publicEffects: { A: { seals: {} }, B: { seals: {} } },
  };
  const ownPrivateState = {
    seat: "A",
    basicPalette: ["red", "blue", "yellow"],
    bonusColor: "green",
    bonusUsesRemaining: 1,
    hand: {},
    privateEffects: {},
  };
  const current = roster.chooseCharacterAction({
    publicState,
    ownPrivateState,
    characterId: "kurogane",
    policyVersion: roster.KUROGANE_POLICY_VERSION,
    random: () => 0,
    tieBreakRandom: () => .99,
  });
  const legacy = roster.chooseCharacterAction({
    publicState,
    ownPrivateState,
    characterId: "kurogane",
    policyVersion: roster.KUROGANE_LEGACY_POLICY_VERSION,
    random: () => 0,
    tieBreakRandom: () => .99,
  });
  assert.notEqual(current.payload.color, "green");
  assert.equal(legacy.payload.color, "green");
});

test("policy dispatch rejects cross-character and invented policies", () => {
  const fixture = trapFixture();
  assert.throws(() => roster.chooseCharacterAction({
    ...fixture,
    characterId: "rei",
    policyVersion: roster.KUROGANE_POLICY_VERSION,
    random: () => 0,
  }), /UNKNOWN_CPU_POLICY_VERSION/);
  assert.throws(() => roster.chooseCharacterAction({
    ...fixture,
    characterId: "kurogane",
    policyVersion: "standard-character-roster-v1:kurogane-lookahead-v999",
    random: () => 0,
  }), /UNKNOWN_CPU_POLICY_VERSION/);
});
