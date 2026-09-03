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
