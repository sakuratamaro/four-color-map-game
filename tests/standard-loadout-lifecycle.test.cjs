"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const matchStart = require("../standard/standard-match-start.js");
const rootTransaction = require("../standard/standard-root-transaction.js");
const save = require("../standard/standard-save.js");

const LOADOUT = Object.freeze({
  color: Object.freeze(["colorPrism", "colorChoiceBorrow"]),
  area: Object.freeze(["areaHalfShift", "areaResize"]),
  disrupt: Object.freeze(["disruptChoiceOne", "disruptRandomOne"]),
});
const SKILLS = Object.freeze(Object.values(LOADOUT).flat());

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture() {
  const inventory = Object.fromEntries(SKILLS.map((skillId) => [skillId, 1]));
  const streams = engine.createRngDomains(7719, match.REQUIRED_RNG_STREAMS);
  return save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "Alice", inventory }),
      playerB: save.createProfile({ name: "Bob", inventory }),
    },
    rngSnapshot: engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS),
  });
}

function startedRoot(suffix) {
  const result = matchStart.startStandardMatch({
    root: fixture(),
    expectedRootRevision: 0,
    operationId: `lifecycle-start-${suffix}`,
    matchId: `lifecycle-match-${suffix}`,
    ruleSetId: matchStart.RULE_SET_IDS.STANDARD,
    participants: { A: { type: "PROFILE", profileId: "playerA" }, B: { type: "PROFILE", profileId: "playerB" } },
    loadouts: { A: LOADOUT, B: LOADOUT },
    firstSeat: "A",
    clock: { now: () => "2026-09-01T09:00:00.000Z" },
    storageAdapter: { setItem() {} },
  });
  assert.equal(result.code, "STARTED");
  return result.root;
}

function consumeAcceptedCard(root, skillId, index) {
  const beforeState = root.activeMatch.state;
  const state = clone(beforeState);
  assert.equal(state.hands.A[skillId], 1);
  delete state.hands.A[skillId];
  state.skillsUsed.A += 1;
  state.version += 1;
  state.publicLog.push(`Lifecycle fixture consumed ${skillId}.`);
  return save.commitAcceptedCardAction({
    root,
    beforeState,
    result: { ok: true, state },
    actor: "A",
    actionId: `lifecycle-use-${index}`,
    actionFingerprint: `fixture:${skillId}`,
    rngSnapshot: root.activeMatch.rngSnapshot,
  });
}

function finishBySurrender(root, suffix) {
  const finished = clone(root);
  finished.activeMatch.state.status = "FINISHED";
  finished.activeMatch.state.phase = "GAME_OVER";
  finished.activeMatch.state.winner = "B";
  finished.activeMatch.state.terminalReason = "SURRENDER";
  finished.activeMatch.state.version += 1;
  finished.activeMatch.state.publicLog.push("Player A surrendered.");
  return rootTransaction.settleCompletedMatch({
    root: finished,
    expectedRootRevision: finished.rootRevision,
    operationId: `lifecycle-settle-${suffix}`,
    matchId: finished.activeMatch.state.matchId,
    clock: { now: () => "2026-09-01T09:10:00.000Z" },
    storageAdapter: { setItem() {} },
  });
}

test("zero, one, multiple, and all-six uses decrement only used inventory and release every remaining reservation", async (t) => {
  for (const usedCount of [0, 1, 3, 6]) await t.test(`${usedCount} of 6 used`, () => {
    let root = startedRoot(String(usedCount));
    assert.deepEqual(Object.fromEntries(SKILLS.map((skillId) => [skillId, root.reservations.playerA[skillId]])), Object.fromEntries(SKILLS.map((skillId) => [skillId, 1])));
    for (const [index, skillId] of SKILLS.slice(0, usedCount).entries()) root = consumeAcceptedCard(root, skillId, index);
    const beforeSettlementRevision = root.rootRevision;
    const settled = finishBySurrender(root, String(usedCount));
    assert.equal(settled.code, "SETTLED");
    assert.equal(settled.root.rootRevision, beforeSettlementRevision + 1);
    assert.equal(Object.hasOwn(settled.root.reservations, "playerA"), false);
    assert.equal(Object.hasOwn(settled.root.reservations, "playerB"), false);
    assert.equal(Object.keys(settled.root.receipts.matchConsumption).length, usedCount);
    for (const [index, skillId] of SKILLS.entries()) {
      assert.equal(settled.root.profiles.playerA.inventory[skillId], index < usedCount ? 0 : 1, skillId);
      assert.equal(settled.root.profiles.playerB.inventory[skillId], 1, skillId);
    }
    const replay = rootTransaction.settleCompletedMatch({
      root: settled.root,
      expectedRootRevision: beforeSettlementRevision,
      operationId: `lifecycle-replay-${usedCount}`,
      matchId: settled.root.activeMatch.state.matchId,
      clock: { now() { throw new Error("clock must not run"); } },
      storageAdapter: { setItem() { throw new Error("storage must not run"); } },
    });
    assert.equal(replay.code, "ALREADY_SETTLED");
    assert.equal(replay.root, settled.root);
  });
});
