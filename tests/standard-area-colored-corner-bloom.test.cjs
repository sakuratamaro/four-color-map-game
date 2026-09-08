"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const handlers = require("../standard/standard-skill-handlers.js");
const { dispatchStandardSkillTransaction, snapshotRngStreams } = require("../standard/standard-skill-transaction.js");

function streams(seed = 9101) {
  return engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function microForMacro(macro) {
  const row = Math.floor(macro / 12);
  const col = macro % 12;
  const cells = [];
  for (let dy = 0; dy < 4; dy += 1) for (let dx = 0; dx < 4; dx += 1) cells.push((row * 4 + dy) * 48 + col * 4 + dx);
  return cells;
}

function fixture({ engineVersion = match.ENGINE_VERSION, controllers = ["B"] } = {}) {
  const rng = streams();
  const state = match.createStandardMatch({
    matchId: `colored-corner-${engineVersion.replaceAll(".", "-")}`,
    firstSeat: "A",
    engineVersion,
    hands: { A: { areaCornerBloom: 1, areaDiePlus: 1 }, B: {} },
  }, rng);
  state.phase = "WORK";
  state.requiredSize = 1;
  state.rolledSize = 1;
  state.baseRequiredSize = 1;
  state.regions = {
    R1: { id: "R1", micro: microForMacro(26), sourceMacros: [26], controllers, color: "red", isPending: false },
  };
  match.validateStandardState(state);
  return { state, rng };
}

function useColored(state, rng, regionId = "R1", macro = 26) {
  return match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaCornerBloom", regionId, macro } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
}

function useOutgoing(state, rng, macro = 26) {
  return match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaCornerBloom", sourceMacros: [macro], macro } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
}

function useMacro(state, rng, macro = 26) {
  return match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaCornerBloom", macro } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
}

test("alpha.4 resolves one normal board square authoritatively without a client region id", () => {
  const { state, rng } = fixture();
  const before = JSON.stringify(state);
  const result = useMacro(state, rng);
  assert.deepEqual([result.ok, result.regionId, result.macro, result.addedCount], [true, "R1", 26, 12]);
  assert.equal(result.state.regions.R1.micro.length, 28);
  assert.deepEqual([result.state.version, result.state.hands.A.areaCornerBloom], [1, 0]);
  assert.equal(JSON.stringify(state), before, "authoritative resolution must not mutate caller state");
});

test("macro-only corner bloom is alpha.4-only and illegal targets remain byte-stable and unconsumed", () => {
  for (const engineVersion of [match.LEGACY_ENGINE_VERSION, match.PREVIOUS_ENGINE_VERSION, match.CATEGORY_WINDOW_ENGINE_VERSION]) {
    const { state, rng } = fixture({ engineVersion });
    const before = JSON.stringify(state);
    const rejected = useMacro(state, rng);
    assert.deepEqual([rejected.ok, rejected.code, JSON.stringify(state)], [false, "INVALID_TARGET_SCHEMA", before], engineVersion);
    assert.equal(state.hands.A.areaCornerBloom, 1, engineVersion);
  }
  const { state, rng } = fixture();
  const before = JSON.stringify(state);
  const rejected = useMacro(state, rng, 27);
  assert.deepEqual([rejected.ok, rejected.code, JSON.stringify(state)], [false, "INVALID_COLORED_CORNER_BLOOM_TARGET", before]);
  assert.equal(state.hands.A.areaCornerBloom, 1);
});

test("alpha.4 colored corner bloom expands the current colored shape without controller ownership", () => {
  for (const controllers of [["A"], ["B"], ["A", "B"], []]) {
    const { state, rng } = fixture({ controllers });
    const rngBefore = rng["skill-effect"].snapshot();
    const plan = handlers.coloredCornerBloomPlan(state, "R1", 26);
    assert.deepEqual([plan.ok, plan.plan.length, plan.micro.length], [true, 12, 28]);
    const result = useColored(state, rng);
    assert.deepEqual([result.ok, result.rngDraws, result.addedCount], [true, 0, 12]);
    assert.deepEqual([result.state.version, result.state.hands.A.areaCornerBloom, result.state.skillsUsed.A], [1, 0, 1]);
    assert.deepEqual(result.state.skillCategoryWindow, { actor: "A", categories: ["area"] });
    assert.equal(result.state.regions.R1.micro.length, 28);
    assert.deepEqual(result.state.regions.R1.controllers, controllers);
    assert.equal(result.state.preparedOutgoing, null);
    assert.equal(rng["skill-effect"].snapshot(), rngBefore);
    match.validateStandardState(result.state);
  }
});

test("alpha.1, alpha.2, and alpha.3 reject the colored payload byte-stably while preserving the outgoing payload", () => {
  const versions = [match.LEGACY_ENGINE_VERSION, match.PREVIOUS_ENGINE_VERSION, match.CATEGORY_WINDOW_ENGINE_VERSION];
  for (const [index, engineVersion] of versions.entries()) {
    const { state, rng } = fixture({ engineVersion });
    const before = JSON.stringify(state);
    const rejected = useColored(state, rng);
    assert.deepEqual([rejected.ok, rejected.code, rejected.state, JSON.stringify(state)], [false, "INVALID_TARGET_SCHEMA", state, before], engineVersion);

    const outgoingState = JSON.parse(before);
    outgoingState.regions = {};
    const outgoing = useOutgoing(outgoingState, streams(9200 + index));
    assert.equal(outgoing.ok, true, engineVersion);
    assert.deepEqual([outgoing.state.preparedOutgoing.micro.length, outgoing.state.hands.A.areaCornerBloom], [28, 0], engineVersion);
    assert.equal(outgoing.state.engineVersion, engineVersion);
    assert.equal(Object.hasOwn(outgoing.state, "skillCategoryWindow"), engineVersion === match.CATEGORY_WINDOW_ENGINE_VERSION);
  }
});

test("alpha.4 keeps the original outgoing corner-bloom payload unchanged", () => {
  const { state, rng } = fixture();
  state.regions = {};
  const result = useOutgoing(state, rng);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.regions, {});
  assert.equal(result.state.preparedOutgoing.micro.length, 28);
  assert.deepEqual(result.state.preparedOutgoing.skills, ["areaCornerBloom"]);
  assert.deepEqual(result.state.skillCategoryWindow, { actor: "A", categories: ["area"] });
});

test("colored corner bloom transfers colored donor cells and deterministically splits the remaining current shape", () => {
  const { state, rng } = fixture();
  state.regions.R2 = { id: "R2", micro: [295, 342, 343], sourceMacros: [13], controllers: ["B"], color: "blue", isPending: false };
  match.validateStandardState(state);
  const occupiedBefore = new Set(Object.values(state.regions).flatMap((region) => region.micro));
  const result = useColored(state, rng);
  assert.equal(result.ok, true);
  assert.deepEqual({
    donorCount: result.intrusion.donorCount,
    transferredCount: result.intrusion.transferredCount,
    emptyAddedCount: result.intrusion.emptyAddedCount,
    splitCount: result.intrusion.splitCount,
    removedCount: result.intrusion.removedCount,
  }, { donorCount: 1, transferredCount: 1, emptyAddedCount: 11, splitCount: 1, removedCount: 0 });
  assert.equal(result.state.regions.R1.micro.includes(343), true);
  assert.deepEqual(result.state.regions.R2.micro, [295]);
  assert.deepEqual(result.state.regions.R3.micro, [342]);
  assert.deepEqual(result.state.regions.R2.controllers, ["B"]);
  assert.deepEqual(result.state.regions.R3.controllers, ["B"]);
  const occupiedAfter = new Set(Object.values(result.state.regions).flatMap((region) => region.micro));
  assert.equal(occupiedAfter.size, occupiedBefore.size + 11);
  assert.equal(Object.values(result.state.regions).flatMap((region) => region.micro).length, occupiedAfter.size);
  match.validateStandardState(result.state);
});

test("colored corner bloom deletes a fully transferred donor without losing or overlapping occupied cells", () => {
  const { state, rng } = fixture();
  const basePlan = handlers.coloredCornerBloomPlan(state, "R1", 26);
  state.regions.R2 = { id: "R2", micro: [basePlan.plan[0]], sourceMacros: [], controllers: ["B"], color: "blue", isPending: false };
  match.validateStandardState(state);
  const occupiedBefore = new Set(Object.values(state.regions).flatMap((region) => region.micro));
  const expectedOccupied = [...new Set([...occupiedBefore, ...basePlan.plan])].sort((a, b) => a - b);

  const result = useColored(state, rng);
  assert.equal(result.ok, true);
  assert.deepEqual({
    donorCount: result.intrusion.donorCount,
    transferredCount: result.intrusion.transferredCount,
    emptyAddedCount: result.intrusion.emptyAddedCount,
    splitCount: result.intrusion.splitCount,
    removedCount: result.intrusion.removedCount,
  }, { donorCount: 1, transferredCount: 1, emptyAddedCount: 11, splitCount: 0, removedCount: 1 });
  assert.equal(result.state.regions.R2, undefined);
  const occupiedEntries = Object.values(result.state.regions).flatMap((region) => region.micro);
  assert.equal(occupiedEntries.length, new Set(occupiedEntries).size);
  assert.deepEqual([...new Set(occupiedEntries)].sort((a, b) => a - b), expectedOccupied);
  match.validateStandardState(result.state);
});

test("colored corner bloom clips every corner candidate at the playable outer bounds", () => {
  const { state } = fixture();
  state.regions.R1.micro = microForMacro(13);
  state.regions.R1.sourceMacros = [13];
  match.validateStandardState(state);

  const plan = handlers.coloredCornerBloomPlan(state, "R1", 13);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.plan, [200, 344, 388, 391, 392]);
  assert.equal(plan.plan.every((cell) => {
    const x = cell % state.microWidth;
    const y = Math.floor(cell / state.microWidth);
    const macroCol = Math.floor(x / state.playableBounds.microScale);
    const macroRow = Math.floor(y / state.playableBounds.microScale);
    return macroCol >= state.playableBounds.minCol && macroCol <= state.playableBounds.maxCol
      && macroRow >= state.playableBounds.minRow && macroRow <= state.playableBounds.maxRow;
  }), true);
  assert.equal(plan.micro.length, state.regions.R1.micro.length + plan.plan.length);
});

test("same-color donor fragments merge into the expanded component independent of controllers", () => {
  const { state, rng } = fixture({ controllers: ["B"] });
  state.regions.R2 = { id: "R2", micro: [295, 342, 343], sourceMacros: [13], controllers: ["A"], color: "red", isPending: false };
  const result = useColored(state, rng);
  assert.equal(result.ok, true);
  assert.equal(result.intrusion.splitCount, 1);
  assert.deepEqual(result.merge, { keptId: "R1", droppedIds: ["R2", "R3"] });
  assert.deepEqual(Object.keys(result.state.regions), ["R1"]);
  assert.equal(result.state.regions.R1.micro.length, 30);
  assert.deepEqual(result.state.regions.R1.controllers, ["A", "B"]);
  match.validateStandardState(result.state);
});

test("invalid, pending, disconnected, and zero-candidate colored targets reject without writes or category use", () => {
  const { state, rng } = fixture();
  const basePlan = handlers.coloredCornerBloomPlan(state, "R1", 26);
  state.regions.R2 = { id: "R2", micro: [...basePlan.plan], sourceMacros: [], controllers: [], color: null, isPending: false, isReserved: true };
  state.reserved = "R2";
  match.validateStandardState(state);
  const before = JSON.stringify(state);
  const rngBefore = rng["skill-effect"].snapshot();
  const blocked = useColored(state, rng);
  assert.deepEqual([blocked.ok, blocked.code, blocked.state, JSON.stringify(state)], [false, "NO_COLORED_CORNER_BLOOM_CANDIDATE", state, before]);
  assert.equal(rng["skill-effect"].snapshot(), rngBefore);

  for (const [regionId, macro, code] of [["R404", 26, "INVALID_COLORED_CORNER_BLOOM_TARGET"], ["R1", 27, "INVALID_COLORED_CORNER_BLOOM_MACRO"]]) {
    const rejected = useColored(state, rng, regionId, macro);
    assert.deepEqual([rejected.ok, rejected.code, rejected.state, JSON.stringify(state)], [false, code, state, before]);
  }

  const disconnected = JSON.parse(before);
  disconnected.regions.R1.micro = [392, 394];
  const disconnectedBefore = JSON.stringify(disconnected);
  const rejected = useColored(disconnected, rng);
  assert.deepEqual([rejected.ok, rejected.code, JSON.stringify(disconnected)], [false, "INVALID_COLORED_CORNER_BLOOM_TARGET", disconnectedBefore]);
});

test("accepted colored corner bloom consumes the area window and blocks a second area skill", () => {
  const { state, rng } = fixture();
  const result = useColored(state, rng);
  const beforeSecond = JSON.stringify(result.state);
  const rejected = match.applyStandardAction({
    state: result.state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "areaDiePlus" } },
    expectedVersion: result.state.version,
    rngStreams: rng,
  });
  assert.deepEqual([rejected.ok, rejected.code, rejected.state, JSON.stringify(result.state)], [false, "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW", result.state, beforeSecond]);
});

test("alpha.3 and alpha.4 both keep the authoritative same-category window", () => {
  for (const [index, engineVersion] of [match.CATEGORY_WINDOW_ENGINE_VERSION, match.ENGINE_VERSION].entries()) {
    const { state, rng } = fixture({ engineVersion });
    state.regions = {};
    const first = useOutgoing(state, rng);
    assert.equal(first.ok, true, engineVersion);
    assert.deepEqual(first.state.skillCategoryWindow, { actor: "A", categories: ["area"] }, engineVersion);
    const beforeSecond = JSON.stringify(first.state);
    const rejected = match.applyStandardAction({
      state: first.state,
      actor: "A",
      action: { type: "USE_SKILL", payload: { skill: "areaDiePlus" } },
      expectedVersion: first.state.version,
      rngStreams: streams(9300 + index),
    });
    assert.deepEqual([rejected.ok, rejected.code, JSON.stringify(rejected.state)], [false, "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW", beforeSecond], engineVersion);
  }
});

test("colored corner bloom persists and replays exactly once while storage failure leaves caller inputs unchanged", () => {
  const makeRoot = (state, rngSnapshot) => save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "A", inventory: { areaCornerBloom: 2 } }),
      playerB: save.createProfile({ name: "B", inventory: {} }),
    },
    activeMatch: {
      state,
      rngSnapshot,
      participants: {
        A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "A" },
        B: { type: "PROFILE", profileId: "playerB", displayNameSnapshot: "B" },
      },
      startedAt: "2026-09-07T00:00:00.000Z",
      finishedAt: null,
      settlement: { settled: false },
    },
    reservations: { playerA: { areaCornerBloom: 1 }, playerB: {} },
  });
  const { state, rng } = fixture();
  const beforeRng = snapshotRngStreams(rng);
  const root = makeRoot(state, beforeRng);
  const action = { id: "colored-corner-action", expectedVersion: 0, type: "USE_SKILL", payload: { skill: "areaCornerBloom", regionId: "R1", macro: 26 } };
  const writes = [];
  const committed = dispatchStandardSkillTransaction({ root, actor: "A", action, rngStreams: rng, storage: { setItem(key, value) { writes.push([key, value]); } } });
  assert.deepEqual([committed.ok, committed.saved, writes.length], [true, true, 1]);
  assert.deepEqual([committed.root.rootRevision, committed.root.activeMatch.state.version], [root.rootRevision + 1, 1]);
  assert.deepEqual([committed.root.profiles.playerA.inventory.areaCornerBloom, committed.root.reservations.playerA.areaCornerBloom], [1, 0]);
  assert.equal(Object.keys(committed.root.receipts.matchConsumption).length, 1);
  const replay = dispatchStandardSkillTransaction({
    root: committed.root,
    actor: "A",
    action,
    rngStreams: committed.rngStreams,
    storage: { setItem() { throw new Error("replay must not persist"); } },
  });
  assert.deepEqual([replay.ok, replay.code, replay.saved, replay.root === committed.root], [true, "IDEMPOTENT_REPLAY", false, true]);

  const { state: failureState, rng: failureRng } = fixture();
  const failureRoot = makeRoot(failureState, snapshotRngStreams(failureRng));
  const failureRootBefore = JSON.stringify(failureRoot);
  const failureRngBefore = snapshotRngStreams(failureRng);
  assert.throws(() => dispatchStandardSkillTransaction({
    root: failureRoot,
    actor: "A",
    action: { ...action, id: "colored-corner-storage-failure" },
    rngStreams: failureRng,
    storage: { setItem() { throw new Error("quota"); } },
  }), /quota/);
  assert.equal(JSON.stringify(failureRoot), failureRootBefore);
  assert.deepEqual(snapshotRngStreams(failureRng), failureRngBefore);
});
