"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const cpu = require("../standard/standard-cpu.js");
const { STANDARD_SKILLS } = require("../standard/standard-skill-registry.js");

function streams(seed) { return createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }

function state(seed = 1) {
  return match.createStandardMatch({ matchId: `cpu-${seed}`, firstSeat: "A", loadouts: { A: {}, B: {} } }, streams(seed));
}

function observation(current, difficulty = "normal") {
  return cpu.makeObservation({
    publicState: match.projectStandardPublicState(current),
    ownPrivateState: match.projectStandardPrivateState(current, current.active),
    difficulty,
  });
}

test("CPU observation is a frozen defensive public plus own-private copy", () => {
  const current = state(1);
  current.privateEffects.B.secret = "OPPONENT-ONLY";
  const seen = observation(current, "hard");
  assert.equal(Object.isFrozen(seen), true);
  assert.equal(Object.isFrozen(seen.publicState.regions), true);
  assert.equal(JSON.stringify(seen).includes("OPPONENT-ONLY"), false);
  assert.equal(Object.hasOwn(seen.publicState, "hands"), false);
});

test("all strengths choose an accepted opening intent without authoritative access", () => {
  for (const [index, difficulty] of cpu.LEVELS.entries()) {
    const current = state(10 + index);
    const rng = streams(100 + index);
    const action = cpu.chooseCpuAction({ observation: observation(current, difficulty), random: () => rng[`cpu-${current.active}`].next(), tieBreakRandom: () => rng["cpu-tie-break"].next() });
    const result = match.applyStandardAction({ state: current, actor: current.active, action, expectedVersion: current.version, rngStreams: rng });
    assert.equal(result.ok, true, `${difficulty}: ${result.code}`);
    assert.equal(result.state.phase, "COLOR");
  }
});

test("CPU color choices use only rule-safe colors and declare when all are blocked", () => {
  const current = state(20);
  const macros = Array.from({ length: current.requiredSize }, (_, index) => 13 + index);
  const created = match.applyStandardAction({ state: current, actor: "A", action: { type: "CREATE_REGION", payload: { sourceMacros: macros } }, expectedVersion: 0 });
  const actions = cpu.enumerateCpuActions(observation(created.state));
  assert.ok(actions.length >= 1);
  assert.ok(actions.every((action) => action.type === "COLOR_REGION"));
  for (const action of actions) {
    const applied = match.applyStandardAction({ state: created.state, actor: "B", action, expectedVersion: 1, rngStreams: streams(21) });
    assert.equal(applied.ok, true);
    assert.equal(applied.code, "OK");
  }

  const blocked = state(22);
  const usable = [...blocked.basicPalettes.A, blocked.bonusColors.A];
  blocked.phase = "COLOR";
  blocked.pending = "R4";
  blocked.regions = {
    R1: { id: "R1", micro: [48], sourceMacros: [], controllers: ["B"], color: usable[0], isPending: false },
    R2: { id: "R2", micro: [50], sourceMacros: [], controllers: ["B"], color: usable[1], isPending: false },
    R3: { id: "R3", micro: [1], sourceMacros: [], controllers: ["B"], color: usable[2], isPending: false },
    R4: { id: "R4", micro: [49], sourceMacros: [], controllers: ["B"], color: null, isPending: true },
  };
  assert.deepEqual(cpu.enumerateCpuActions(observation(blocked)), [{ type: "DECLARE_NO_COLOR", payload: {}, metrics: { blockedCount: 3 } }]);
});

test("opponent secret changes cannot influence any CPU difficulty", () => {
  const baseline = state(30);
  const changed = JSON.parse(JSON.stringify(baseline));
  changed.hands.B = { legalRecolor: 999 };
  changed.privateEffects.B = { secret: "changed" };
  for (const difficulty of cpu.LEVELS) {
    const pick = (current) => cpu.chooseCpuAction({ observation: observation(current, difficulty), random: () => 0.25, tieBreakRandom: () => 0.75 });
    assert.deepEqual(pick(baseline), pick(changed));
  }
});

test("hard CPU prioritizes distinct public color pressure over equal contact count", () => {
  const current = state(31);
  current.phase = "WORK";
  current.requiredSize = 1;
  current.rolledSize = 1;
  current.baseRequiredSize = 1;
  current.regions = {
    R1: { id: "R1", micro: macroMicroCells(13), sourceMacros: [13], controllers: ["A"], color: "red", isPending: false },
    R2: { id: "R2", micro: macroMicroCells(15), sourceMacros: [15], controllers: ["B"], color: "blue", isPending: false },
    R3: { id: "R3", micro: macroMicroCells(25), sourceMacros: [25], controllers: ["A"], color: "green", isPending: false },
    R4: { id: "R4", micro: macroMicroCells(27), sourceMacros: [27], controllers: ["B"], color: "green", isPending: false },
  };
  const action = cpu.chooseCpuAction({ observation: observation(current, "hard"), random: () => 0, tieBreakRandom: () => 0 });
  assert.equal(action.type, "CREATE_REGION");
  assert.deepEqual(action.payload.sourceMacros, [14]);
  assert.equal(action.metrics.contacts, 2);
  assert.equal(action.metrics.colorPressure, 2);
});

function macroMicroCells(macro) {
  const row = Math.floor(macro / 12);
  const col = macro % 12;
  const cells = [];
  for (let dy = 0; dy < 4; dy += 1) for (let dx = 0; dx < 4; dx += 1) cells.push((row * 4 + dy) * 48 + col * 4 + dx);
  return cells;
}

function canonicalHand() {
  return Object.fromEntries(cpu.V49_SKILL_IDS.map((skill) => [skill, 1]));
}

function canonicalLoadout() {
  return Object.fromEntries(["color", "area", "disrupt"].map((category) => [category,
    Object.values(STANDARD_SKILLS).filter((entry) => entry.v49Catalogued && entry.category === category).map((entry) => entry.id),
  ]));
}

function cpuSkillFixture(phase, seed) {
  const rng = streams(seed);
  const loadout = canonicalLoadout();
  const current = match.createStandardMatch({
    matchId: `cpu-skills-${phase}-${seed}`,
    firstSeat: "A",
    loadouts: { A: loadout, B: {} },
    hands: { A: canonicalHand(), B: {} },
  }, rng);
  current.active = "A";
  current.requiredSize = 1;
  current.rolledSize = 1;
  current.baseRequiredSize = 1;
  current.phase = phase;
  if (phase === "COLOR") {
    current.regions = {
      R1: { id: "R1", micro: macroMicroCells(13), sourceMacros: [13], controllers: ["B"], color: "red", isPending: false },
      R2: { id: "R2", micro: [26, 27, 28].flatMap(macroMicroCells), sourceMacros: [26, 27, 28], controllers: ["B"], color: null, isPending: true },
    };
    current.pending = "R2";
  } else {
    current.regions = {
      R1: { id: "R1", micro: macroMicroCells(13), sourceMacros: [13], controllers: ["B"], color: "red", isPending: false },
    };
    current.pending = null;
  }
  match.validateStandardState(current);
  return { current, rng };
}

test("CPU enumerates every canonical v4.9 skill from public plus own-private observations", () => {
  const color = cpuSkillFixture("COLOR", 40);
  const work = cpuSkillFixture("WORK", 41);
  const actions = [
    ...cpu.enumerateCpuActions(observation(color.current, "hard")),
    ...cpu.enumerateCpuActions(observation(work.current, "hard")),
  ];
  const enumerated = new Set(actions.filter((action) => action.type === "USE_SKILL").map((action) => action.payload.skill));
  assert.equal(cpu.V49_SKILL_IDS.length, 19);
  assert.deepEqual([...enumerated].filter((id) => cpu.V49_SKILL_IDS.includes(id)).sort(), [...cpu.V49_SKILL_IDS].sort());
});

test("one CPU-generated candidate for each canonical skill is accepted by the authoritative engine", () => {
  for (const [index, skill] of cpu.V49_SKILL_IDS.entries()) {
    const phase = STANDARD_SKILLS[skill].timing === "COLOR" ? "COLOR" : "WORK";
    const { current, rng } = cpuSkillFixture(phase, 100 + index);
    const action = cpu.enumerateCpuActions(observation(current, "hard")).find((entry) => entry.type === "USE_SKILL" && entry.payload.skill === skill);
    assert.ok(action, `${skill}: missing candidate`);
    const result = match.applyStandardAction({ state: current, actor: "A", action, expectedVersion: current.version, rngStreams: rng });
    assert.equal(result.ok, true, `${skill}: ${result.code}`);
    assert.equal(result.state.hands.A[skill], 0, skill);
  }
});
