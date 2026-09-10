"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const roster = require("../standard/standard-cpu-roster.js");

function streams(seed) { return createRngDomains(seed, match.REQUIRED_RNG_STREAMS); }

test("the versioned roster contains exactly ten immutable named characters, never difficulty labels", () => {
  assert.equal(roster.ROSTER_VERSION, "standard-character-roster-v1");
  assert.equal(roster.validateRoster(), true);
  assert.equal(Object.keys(roster.CPU_CHARACTERS).length, 10);
  assert.equal(Object.isFrozen(roster.CPU_CHARACTERS), true);
  for (const character of Object.values(roster.CPU_CHARACTERS)) {
    assert.equal(Object.isFrozen(character), true);
    assert.equal(Object.isFrozen(character.parameters), true);
    assert.equal(Object.values(character.loadout).flat().length, 6);
    assert.equal(new Set(Object.values(character.loadout).flat()).size, 6);
    assert.doesNotMatch(`${character.name} ${character.strength} ${character.weakness}`, /easy|normal|hard|弱い|ふつう|強い/i);
  }
});

test("public roster exposes identity and favorite skills but not numeric policy parameters", () => {
  const publicRows = roster.publicRoster();
  assert.equal(publicRows.length, 10);
  for (const row of publicRows) {
    assert.deepEqual(Object.keys(row).sort(), ["favorites", "id", "line", "name", "policyVersion", "strength", "weakness"]);
    assert.equal(Object.hasOwn(row, "parameters"), false);
    assert.equal(row.favorites.length, 2);
  }
});

test("all ten personalities choose only authoritative accepted actions from public plus own-private state", () => {
  const fingerprints = new Set();
  for (const [index, character] of Object.values(roster.CPU_CHARACTERS).entries()) {
    const rng = streams(1000 + index);
    const current = match.createStandardMatch({
      matchId: `character-${character.id}`,
      firstSeat: "A",
      loadouts: { A: character.loadout, B: character.loadout },
    }, rng);
    current.privateEffects.B.unreadableSecret = `secret-${index}`;
    const publicState = match.projectStandardPublicState(current);
    const ownPrivateState = match.projectStandardPrivateState(current, "A");
    const action = roster.chooseCharacterAction({
      publicState, ownPrivateState, characterId: character.id,
      random: () => ((index * 17) % 97) / 97,
      tieBreakRandom: () => ((index * 29) % 89) / 89,
    });
    const applied = match.applyStandardAction({ state: current, actor: "A", action, expectedVersion: 0, rngStreams: rng });
    assert.equal(applied.ok, true, `${character.id}: ${applied.code}`);
    fingerprints.add(JSON.stringify(action));
  }
  assert.ok(fingerprints.size >= 3, `expected at least three visible play styles, got ${fingerprints.size}`);
});

test("changing the opponent private state cannot alter a character decision", () => {
  const character = roster.CPU_CHARACTERS.shion;
  const current = match.createStandardMatch({ matchId: "privacy-a", firstSeat: "A", loadouts: { A: character.loadout, B: character.loadout } }, streams(77));
  const changed = JSON.parse(JSON.stringify(current));
  changed.hands.B = { colorPrism: 999 };
  changed.privateEffects.B = { answer: "forbidden" };
  const choose = (state) => roster.chooseCharacterAction({
    publicState: match.projectStandardPublicState(state),
    ownPrivateState: match.projectStandardPrivateState(state, "A"),
    characterId: "shion", random: () => .31, tieBreakRandom: () => .73,
  });
  assert.deepEqual(choose(current), choose(changed));
});

function macroMicroCells(macro) {
  const row = Math.floor(macro / 12);
  const col = macro % 12;
  const cells = [];
  for (let dy = 0; dy < 4; dy += 1) for (let dx = 0; dx < 4; dx += 1) cells.push((row * 4 + dy) * 48 + col * 4 + dx);
  return cells;
}

function shionSealFixture(colors) {
  const character = roster.CPU_CHARACTERS.shion;
  const current = match.createStandardMatch({ matchId: `shion-seal-${colors.length}`, firstSeat: "A", loadouts: { A: character.loadout, B: character.loadout } }, streams(780 + colors.length));
  current.phase = "WORK";
  current.turn = 1;
  current.requiredSize = 1;
  current.rolledSize = 1;
  current.baseRequiredSize = 1;
  current.hands.A = { disruptChoiceOne: 1 };
  current.regions = {
    R1: { id: "R1", micro: macroMicroCells(13), sourceMacros: [13], controllers: ["B"], color: colors[0], isPending: false },
    ...(colors[1] ? { R2: { id: "R2", micro: macroMicroCells(15), sourceMacros: [15], controllers: ["B"], color: colors[1], isPending: false } } : {}),
  };
  return current;
}

test("character policy holds a favorite seal in a weak position but may use it on turn one when public replies are constrained", () => {
  const choose = (current) => roster.chooseCharacterAction({
    publicState: match.projectStandardPublicState(current),
    ownPrivateState: match.projectStandardPrivateState(current, "A"),
    characterId: "shion",
    policyVersion: roster.CPU_CHARACTERS.shion.policyVersion,
    random: () => 0,
    tieBreakRandom: () => 0,
  });
  const held = choose(shionSealFixture(["red"]));
  assert.equal(held.type, "CREATE_REGION");

  const spent = choose(shionSealFixture(["red", "blue"]));
  assert.equal(spent.type, "USE_SKILL");
  assert.equal(spent.payload.skill, "disruptChoiceOne");
  assert.ok(["green", "yellow"].includes(spent.payload.color));
  assert.equal(spent.metrics.sealResponseOptionsAfterPotential, 1);
  const pressured = shionSealFixture(["red", "blue"]);
  const applied = match.applyStandardAction({ state: pressured, actor: "A", action: spent, expectedVersion: pressured.version, rngStreams: streams(790) });
  assert.equal(applied.ok, true);
  assert.equal(applied.state.publicEffects.B.seals[spent.payload.color], 1);
});

test("character CPU rescue behavior is partitioned by the match engine version", () => {
  const character = roster.CPU_CHARACTERS.ren;
  const current = match.createStandardMatch({ matchId: "rescue-policy", firstSeat: "A", loadouts: { A: character.loadout, B: character.loadout } }, streams(88));
  const usable = [...current.basicPalettes.A, current.bonusColors.A];
  current.phase = "COLOR";
  current.pending = "R4";
  current.regions = {
    R1: { id: "R1", micro: [48], sourceMacros: [], controllers: ["B"], color: usable[0], isPending: false },
    R2: { id: "R2", micro: [50], sourceMacros: [], controllers: ["B"], color: usable[1], isPending: false },
    R3: { id: "R3", micro: [1], sourceMacros: [], controllers: ["B"], color: usable[2], isPending: false },
    R4: { id: "R4", micro: [49], sourceMacros: [], controllers: ["B"], color: null, isPending: true },
  };
  const choose = (candidate) => roster.chooseCharacterAction({
    publicState: match.projectStandardPublicState(candidate),
    ownPrivateState: match.projectStandardPrivateState(candidate, "A"),
    characterId: character.id,
    policyVersion: character.policyVersion,
    random: () => 0,
    tieBreakRandom: () => 0,
  });
  assert.equal(choose(current).type, "USE_SKILL", "alpha.2 CPU tries a private rescue card first");
  current.hands.A = {};
  assert.equal(choose(current).type, "SURRENDER", "alpha.2 CPU voluntarily surrenders only after no rescue remains");
  const legacy = JSON.parse(JSON.stringify(current));
  legacy.engineVersion = match.LEGACY_ENGINE_VERSION;
  delete legacy.skillCategoryWindow;
  assert.equal(choose(legacy).type, "DECLARE_NO_COLOR", "alpha.1 replay retains the old deterministic decision");
});
