"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { loadEngine, fixture, plain } = require("./helpers/public-skill-fixture.cjs");
const match = require("../standard/standard-match.js");
const engine = require("../standard/standard-engine.js");
const cutin = require("../standard-online-v5/skill-cutin.js");
const registry = require("../standard-online-v5/standard-skill-registry.generated.js");

for (const actor of ["A", "B"]) for (const scenario of ["work", "palette", "miss", "recolor"]) {
  test(`public skill annotation is resolved, canonical and projection-only: ${actor}/${scenario}`, () => {
    const api = loadEngine(), input = fixture(api, { actor, scenario }), before = plain(input);
    // Poison unused payload fields; none may enter the public annotation.
    input.action.payload.unusedHand = ["private-sentinel"];
    input.action.payload.displayName = "forged-name";
    const streams = engine.createRngDomainsFromSnapshot(input.rngSnapshot, match.REQUIRED_RNG_STREAMS);
    const direct = match.applyStandardAction({ ...input, rngStreams: streams });
    const applied = plain(api.apply(input));
    assert.equal(applied.ok, true, applied.code);
    assert.equal(direct.ok, true, direct.code);
    assert.deepEqual(applied.publicState.lastPublicSkill, {
      eventId: `${input.state.matchId}:1`, version: 1, actor, skillId: input.action.payload.skill,
    });
    assert.deepEqual(applied.publicState.lastPublicTrace, plain(direct.state.lastPublicTrace));
    const publicWithoutName = { ...applied.publicState }; delete publicWithoutName.lastPublicSkill;
    if (input.labMode) delete publicWithoutName.labRuleSetId;
    assert.deepEqual(publicWithoutName, plain(direct.publicState));
    assert.deepEqual(applied.state, plain(direct.state));
    assert.deepEqual(applied.privateA, plain(match.projectStandardPrivateState(direct.state, "A")));
    assert.deepEqual(applied.privateB, plain(match.projectStandardPrivateState(direct.state, "B")));
    assert.deepEqual(applied.rngSnapshot, engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS));
    assert.equal(Object.hasOwn(applied.state, "lastPublicSkill"), false);
    assert.equal(Object.hasOwn(api.project(applied.state, false, input.labMode).publicState, "lastPublicSkill"), false);
    assert.deepEqual(input.state, before.state); assert.deepEqual(input.rngSnapshot, before.rngSnapshot);
    assert.doesNotMatch(JSON.stringify(applied.publicState.lastPublicSkill), /private-sentinel|forged-name|slot|color":|noOp|hands|payload/);
    assert.equal(cutin.publicSkillName(applied.publicState, registry), registry.skills[input.action.payload.skill].displayName);
    if (scenario === "miss") {
      assert.equal(applied.noOp, true); assert.equal(applied.cardConsumed, false);
      assert.equal(applied.state.hands[actor].disruptPaletteChoice, input.state.hands[actor].disruptPaletteChoice);
    }
  });
}

test("rejection, stale retry and ordinary terminal action emit no new skill identity", () => {
  const api = loadEngine(), input = fixture(api, { scenario: "borrow-reject" }), before = plain(input);
  const rejected = plain(api.apply(input));
  assert.deepEqual(rejected, { ok: false, code: "NO_BOARD_COLORS" });
  assert.deepEqual(input, before);
  const skill = fixture(api), applied = api.apply(skill);
  const retry = plain(api.apply({ ...skill, state: applied.state }));
  assert.deepEqual(retry, { ok: false, code: "VERSION_CONFLICT" });
  const terminal = api.apply({ ...skill, state: applied.state, rngSnapshot: applied.rngSnapshot, expectedVersion: 1,
    action: { type: "SURRENDER", payload: { skill: "areaDiePlus" } } });
  assert.equal(terminal.ok, true);
  assert.equal(Object.hasOwn(terminal.publicState, "lastPublicSkill"), false);
  assert.equal(Object.hasOwn(api.create({ matchId: "new", loadouts: skill.state.loadouts, seed: 1 }).publicState, "lastPublicSkill"), false);
});

test("the public annotation leaves every supported saved engine version valid", () => {
  const api = loadEngine();
  for (const engineVersion of match.SUPPORTED_ENGINE_VERSIONS) {
    const input = fixture(api, { engineVersion }), applied = api.apply(input);
    assert.equal(applied.ok, true, engineVersion);
    assert.equal(api.validateState(applied.state), true);
    assert.equal(applied.state.engineVersion, engineVersion);
    assert.equal(applied.publicState.lastPublicSkill.skillId, "areaDiePlus");
    const restored = match.decodeStandardMatch(match.encodeStandardMatch(applied.state, applied.rngSnapshot));
    assert.deepEqual(restored.state, plain(applied.state));
  }
});

function view(version, { actor = "B", skillId = "areaDiePlus", annotation = true } = {}) {
  const lastPublicTrace = { eventId: `m:${version}`, version, type: skillId === "legalRecolor" ? "LEGAL_RECOLOR" : "USE_SKILL", actor,
    ...(skillId === "legalRecolor" ? { regionId: "R1", color: "green" } : {}) };
  return { roomId: "room", seat: "A", visible: true, ownColors: ["red"], skillRegistry: registry,
    state: { matchId: "m", version, status: "ACTIVE", regions: {}, requiredSize: 1, lastPublicTrace,
      ...(annotation ? { lastPublicSkill: { eventId: `m:${version}`, version, actor, skillId } } : {}) } };
}
function describe(after, before = view(1, { annotation: false })) { return cutin.describe(cutin.snapshot(before), cutin.snapshot(after), after); }

test("self and opponent names use only implemented catalog IDs, not own ACK for the opponent", () => {
  for (const actor of ["A", "B"]) for (const definition of Object.values(registry.skills).filter(s => s.standardEngineImplemented)) {
    const after = view(2, { actor, skillId: definition.id });
    after.ack = { scope: "room:m:A", eventId: "m:2", name: "forged-name" };
    const result = describe(after);
    assert.equal(result.title, definition.displayName, definition.id);
    assert.equal(result.detail, "スキルを使用"); assert.equal(result.destination, null);
  }
});

test("malformed, extra-key, stale, mismatched and unknown annotations preserve neutral legacy output", () => {
  for (const patch of [{ secret: true }, { eventId: "other:2" }, { version: 1 }, { actor: "A" },
    { skillId: "unknown" }, { skillId: "toString" }, { skillId: "__proto__" }, { skillId: "legalRecolor" }, { skillId: 2 }]) {
    const after = view(2); Object.assign(after.state.lastPublicSkill, patch);
    assert.equal(describe(after).title, "スキルを使用", JSON.stringify(patch));
  }
  for (const annotation of [null, [], "areaDiePlus", undefined]) {
    const after = view(2); after.state.lastPublicSkill = annotation;
    assert.equal(describe(after).title, "スキルを使用");
  }
  const after = view(2); delete after.skillRegistry;
  assert.equal(describe(after).title, "スキルを使用");
  after.skillRegistry = { skills: Object.create({ areaDiePlus: registry.skills.areaDiePlus }) };
  assert.equal(describe(after).title, "スキルを使用");
});

test("named accepted no-op still needs the matching own ACK before claiming a failed effect", () => {
  for (const actor of ["A", "B"]) {
    const after = view(2, { actor, skillId: "disruptPaletteChoice" });
    after.ack = { scope: "room:m:A", eventId: "m:2", name: "irrelevant", noOp: true };
    assert.equal(describe(after).title, registry.skills.disruptPaletteChoice.displayName);
    assert.equal(describe(after).detail, actor === "A" ? "空振り" : "スキルを使用");
    assert.equal(describe(after).destination, null);
  }
});

test("named events keep the same locked identity across retries, reloads and changed annotation", async () => {
  const data = new Map(), storage = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  const locks = { request: async (_key, _opts, fn) => fn() }, shown = [];
  const observer = cutin.createObserver({ storage, locks, show: e => shown.push(e), clear() {} });
  await observer.observe(view(1)); await observer.observe(view(2));
  await observer.observe(view(2, { skillId: "colorPrism" }));
  assert.equal(shown.length, 1); assert.equal(shown[0].title, registry.skills.areaDiePlus.displayName);
  const reloaded = cutin.createObserver({ storage, locks, show: e => shown.push(e), clear() {} });
  await reloaded.observe(view(1)); await reloaded.observe(view(2));
  assert.equal(shown.length, 1);
  assert.equal(cutin.DISPLAY_MS, 1800);
});
