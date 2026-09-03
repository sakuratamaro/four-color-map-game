"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");

function fixture() {
  const streams = createRngDomains(901, match.REQUIRED_RNG_STREAMS);
  const state = match.createStandardMatch({
    matchId: "save-match-901",
    firstSeat: "A",
    loadouts: { A: { experimental: ["legalRecolor"] }, B: { experimental: ["legalRecolor"] } },
  }, streams);
  const profiles = {
    playerA: save.createProfile({ name: "Player A", inventory: { legalRecolor: 2 }, gachaTickets: { 1: 3 } }),
    playerB: save.createProfile({ name: "Player B", inventory: { legalRecolor: 1 } }),
  };
  const root = save.createStandardSave({ profiles, activeMatch: {
    state,
    rngSnapshot: {},
    participants: {
      A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "Player A" },
      B: { type: "PROFILE", profileId: "playerB", displayNameSnapshot: "Player B" },
    },
    startedAt: "2026-08-30T00:00:00.000Z",
    finishedAt: null,
    settlement: { settled: false },
  }, reservations: { playerA: { legalRecolor: 1 }, playerB: { legalRecolor: 1 } } });
  return { root, state };
}

test("standard save has an isolated versioned root and round-trips", () => {
  const { root } = fixture();
  const payload = save.encodeStandardSave(root);
  assert.deepEqual(save.decodeStandardSave(payload), root);
  assert.equal(match.SAVE_KEY, "fourColorMapGame.standard.v5.save");
  assert.equal(payload.includes("four-color-map-game-solo-v5-save"), false);
});

test("accepted card consumption updates match, inventory, and ledger once", () => {
  const { root, state } = fixture();
  state.phase = "WORK";
  state.regions = {
    R1: { id: "R1", micro: [0], sourceMacros: [], controllers: ["A"], color: "red", isPending: false },
    R2: { id: "R2", micro: [1], sourceMacros: [], controllers: ["B"], color: "blue", isPending: false },
  };
  root.activeMatch.state = state;
  const streams = createRngDomains(902, match.REQUIRED_RNG_STREAMS);
  const result = match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } },
    expectedVersion: state.version,
    rngStreams: streams,
  });
  assert.equal(result.ok, true);
  const committed = save.commitAcceptedCardAction({ root, beforeState: state, result, actor: "A", actionId: "action-1", rngSnapshot: { effect: 9 } });
  assert.equal(committed.profiles.playerA.inventory.legalRecolor, 1);
  assert.equal(committed.reservations.playerA.legalRecolor, 0);
  assert.equal(committed.activeMatch.state.version, state.version + 1);
  assert.equal(committed.rootRevision, root.rootRevision + 1);
  assert.deepEqual(Object.values(committed.receipts.matchConsumption), [{ matchId: state.matchId, actionId: "action-1", profileId: "playerA", skill: "legalRecolor", version: state.version + 1 }]);
  assert.equal(save.commitAcceptedCardAction({ root: committed, beforeState: state, result, actor: "A", actionId: "action-1", rngSnapshot: {} }), committed);
});

test("rejected, non-consuming, mismatched, and empty-inventory card commits fail closed", () => {
  const { root, state } = fixture();
  assert.throws(() => save.commitAcceptedCardAction({ root, beforeState: state, result: { ok: false, state }, actor: "A", actionId: "bad", rngSnapshot: {} }), /ACTION_NOT_ACCEPTED/);
  const noCardResult = { ok: true, state: JSON.parse(JSON.stringify(state)) };
  noCardResult.state.version += 1;
  assert.throws(() => save.commitAcceptedCardAction({ root, beforeState: state, result: noCardResult, actor: "A", actionId: "bad2", rngSnapshot: {} }), /CARD_NOT_CONSUMED_ONCE/);

  const empty = JSON.parse(JSON.stringify(root));
  empty.profiles.playerA.inventory.legalRecolor = 0;
  empty.reservations.playerA.legalRecolor = 0;
  const consumed = JSON.parse(JSON.stringify(state));
  consumed.version += 1;
  consumed.hands.A.legalRecolor -= 1;
  assert.throws(() => save.commitAcceptedCardAction({ root: empty, beforeState: state, result: { ok: true, state: consumed }, actor: "A", actionId: "bad3", rngSnapshot: {} }), /INVENTORY_EMPTY/);
});

test("persistence performs one storage write and exposes failures without partial fallback", () => {
  const { root } = fixture();
  const writes = [];
  const payload = save.persistStandardSave({ setItem(key, value) { writes.push([key, value]); } }, root);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], match.SAVE_KEY);
  assert.equal(writes[0][1], payload);
  assert.throws(() => save.persistStandardSave({ setItem() { throw new Error("quota"); } }, root), /quota/);
});

test("malformed, oversized, and unknown-profile saves are rejected", () => {
  const { root } = fixture();
  assert.throws(() => save.decodeStandardSave("{"), /INVALID_SAVE_JSON/);
  assert.throws(() => save.decodeStandardSave("x".repeat(save.MAX_SAVE_BYTES + 1)), /SAVE_TOO_LARGE/);
  const unknown = JSON.parse(JSON.stringify(root));
  unknown.activeMatch.participants.B.profileId = "missing";
  assert.throws(() => save.validateStandardSave(unknown), /UNKNOWN_MATCH_PROFILE/);
});
