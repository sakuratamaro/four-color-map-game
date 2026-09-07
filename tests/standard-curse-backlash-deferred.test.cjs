"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const cpu = require("../standard/standard-cpu.js");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");

function streams(seed) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function snapshot(rng) {
  return engine.snapshotRngDomains(rng, match.REQUIRED_RNG_STREAMS);
}

function createState(seed, engineVersion = match.ENGINE_VERSION) {
  const rng = streams(seed);
  const state = match.createStandardMatch({
    matchId: `curse-deferred-${seed}-${engineVersion}`,
    firstSeat: "A",
    engineVersion,
    loadouts: { A: {}, B: { color: ["colorPrism"] } },
  }, rng);
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.privateEffects.B.curseBacklash = 1;
  return { rng, state };
}

function sealCurrentPalette(state, actor = "B") {
  state.publicEffects[actor].seals = Object.fromEntries(
    [...new Set([...state.basicPalettes[actor], state.bonusColors[actor]])].map((color) => [color, 1]),
  );
}

function createFirstForB(state, rng) {
  return match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "CREATE_REGION", payload: { sourceMacros: [13] } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
}

test("zero-candidate backlash survives COLOR entry and rescue, then consumes only after legal coloring", () => {
  const { rng, state } = createState(7101);
  sealCurrentPalette(state);
  const beforeEntry = snapshot(rng);
  const entered = createFirstForB(state, rng);
  assert.equal(entered.ok, true);
  assert.deepEqual([entered.state.active, entered.state.phase], ["B", "COLOR"]);
  assert.equal(entered.state.privateEffects.B.curseBacklash, 1);
  assert.deepEqual(snapshot(rng), beforeEntry, "zero candidates must draw no RNG");
  assert.equal(entered.state.publicLog.some((line) => line.includes("resolved empty")), false);

  const failed = match.applyStandardAction({
    state: entered.state,
    actor: "B",
    action: { type: "COLOR_REGION", payload: { color: entered.state.basicPalettes.B[0] } },
    expectedVersion: entered.state.version,
    rngStreams: rng,
  });
  assert.deepEqual([failed.ok, failed.code, failed.state], [false, "COLOR_UNAVAILABLE", entered.state]);
  assert.equal(failed.state.privateEffects.B.curseBacklash, 1);

  const rescued = match.applyStandardAction({
    state: entered.state,
    actor: "B",
    action: { type: "USE_SKILL", payload: { skill: "colorPrism" } },
    expectedVersion: entered.state.version,
    rngStreams: rng,
  });
  assert.equal(rescued.ok, true);
  assert.equal(rescued.state.privateEffects.B.curseBacklash, 1, "rescue alone is not a coloring");
  const rescueColor = engine.COLORS.find((color) => !state.basicPalettes.B.includes(color) && color !== state.bonusColors.B);
  assert.ok(rescueColor);
  const beforeColor = snapshot(rng)["skill-effect"];
  const colored = match.applyStandardAction({
    state: rescued.state,
    actor: "B",
    action: { type: "COLOR_REGION", payload: { color: rescueColor } },
    expectedVersion: rescued.state.version,
    rngStreams: rng,
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.code, "OK");
  assert.equal(colored.state.regions.R1.color, rescueColor);
  assert.equal(colored.state.privateEffects.B.curseBacklash, undefined);
  assert.equal(snapshot(rng)["skill-effect"], beforeColor, "deferred consumption must not invent a late random seal");
  assert.equal(colored.state.publicLog.at(-2), "Curse backlash resolved after Player B completed coloring.");
});

test("normal COLOR entry still resolves a candidate backlash immediately with one skill-effect draw", () => {
  const { rng, state } = createState(7102);
  const before = snapshot(rng);
  const entered = createFirstForB(state, rng);
  assert.equal(entered.ok, true);
  assert.equal(entered.state.privateEffects.B.curseBacklash, undefined);
  assert.equal(Object.values(entered.state.publicEffects.B.seals).filter((duration) => duration > 0).length, 1);
  const after = snapshot(rng);
  for (const name of match.REQUIRED_RNG_STREAMS) assert.equal(after[name] === before[name], name !== "skill-effect", name);
});

test("rejected and illegal COLOR actions never consume a deferred backlash", () => {
  const { rng, state } = createState(7103);
  state.active = "B";
  state.phase = "COLOR";
  state.pending = "R1";
  state.turn = 2;
  state.skillCategoryWindow = { actor: "B", categories: [] };
  sealCurrentPalette(state);
  const rescueColor = engine.COLORS.find((color) => !state.basicPalettes.B.includes(color) && color !== state.bonusColors.B);
  state.regions = {
    R1: { id: "R1", micro: [49], sourceMacros: [13], controllers: ["A"], color: null, isPending: true },
    R2: { id: "R2", micro: [48], sourceMacros: [], controllers: ["A"], color: rescueColor, isPending: false },
  };
  match.validateStandardState(state);

  const stale = match.applyStandardAction({
    state,
    actor: "B",
    action: { type: "COLOR_REGION", payload: { color: rescueColor } },
    expectedVersion: state.version + 1,
    rngStreams: rng,
  });
  assert.deepEqual([stale.ok, stale.code, stale.state], [false, "VERSION_CONFLICT", state]);
  assert.equal(stale.state.privateEffects.B.curseBacklash, 1);

  const rescued = match.applyStandardAction({
    state,
    actor: "B",
    action: { type: "USE_SKILL", payload: { skill: "colorPrism" } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
  const illegal = match.applyStandardAction({
    state: rescued.state,
    actor: "B",
    action: { type: "COLOR_REGION", payload: { color: rescueColor } },
    expectedVersion: rescued.state.version,
    rngStreams: rng,
  });
  assert.deepEqual([illegal.ok, illegal.code, illegal.state.status, illegal.state.terminalReason], [true, "ILLEGAL_COLOR", "FINISHED", "ILLEGAL_COLOR"]);
  assert.equal(illegal.state.privateEffects.B.curseBacklash, 1);
});

test("CPU keeps deferred backlash through its rescue action and consumes it on its next legal color", () => {
  const { rng, state } = createState(7104);
  sealCurrentPalette(state);
  const entered = createFirstForB(state, rng);
  const firstObservation = cpu.makeObservation({
    publicState: match.projectStandardPublicState(entered.state),
    ownPrivateState: match.projectStandardPrivateState(entered.state, "B"),
    difficulty: "hard",
  });
  const rescue = cpu.chooseCpuAction({ observation: firstObservation, random: () => 0, tieBreakRandom: () => 0 });
  assert.deepEqual(rescue, { type: "USE_SKILL", payload: { skill: "colorPrism" }, metrics: { skillPriority: 24, rescue: 1 } });
  const rescued = match.applyStandardAction({
    state: entered.state,
    actor: "B",
    action: rescue,
    expectedVersion: entered.state.version,
    rngStreams: rng,
  });
  assert.equal(rescued.state.privateEffects.B.curseBacklash, 1);

  const secondObservation = cpu.makeObservation({
    publicState: match.projectStandardPublicState(rescued.state),
    ownPrivateState: match.projectStandardPrivateState(rescued.state, "B"),
    difficulty: "hard",
  });
  const color = cpu.chooseCpuAction({ observation: secondObservation, random: () => 0, tieBreakRandom: () => 0 });
  assert.equal(color.type, "COLOR_REGION");
  const colored = match.applyStandardAction({
    state: rescued.state,
    actor: "B",
    action: color,
    expectedVersion: rescued.state.version,
    rngStreams: rng,
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.privateEffects.B.curseBacklash, undefined);
});

test("all supported versions retain zero-candidate backlash without a schema bump", () => {
  for (const [index, engineVersion] of match.SUPPORTED_ENGINE_VERSIONS.entries()) {
    const { rng, state } = createState(7200 + index, engineVersion);
    sealCurrentPalette(state);
    const entered = createFirstForB(state, rng);
    assert.equal(entered.ok, true, engineVersion);
    assert.equal(entered.state.engineVersion, engineVersion);
    assert.equal(entered.state.privateEffects.B.curseBacklash, 1, engineVersion);
    if (engineVersion === match.LEGACY_ENGINE_VERSION) {
      assert.deepEqual([entered.state.status, entered.state.phase, entered.state.terminalReason], ["FINISHED", "GAME_OVER", "SEALED_OUT"]);
    } else {
      assert.deepEqual([entered.state.status, entered.state.phase], ["ACTIVE", "COLOR"]);
    }
    const roundTrip = match.decodeStandardMatch(match.encodeStandardMatch(entered.state, snapshot(rng)));
    assert.equal(roundTrip.state.privateEffects.B.curseBacklash, 1, `${engineVersion} save`);
  }
});
