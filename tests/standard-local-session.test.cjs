"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const { createStandardLocalSession } = require("../standard/standard-local-session.js");
const matchStart = require("../standard/standard-match-start.js");

const STANDARD_LOADOUT = Object.freeze({
  color: Object.freeze(["colorPrism", "colorChoiceBorrow"]),
  area: Object.freeze(["areaHalfShift", "areaResize"]),
  disrupt: Object.freeze(["disruptChoiceOne", "disruptRandomOne"]),
});

function memoryStorage(initialPayload = null) {
  const values = new Map(initialPayload === null ? [] : [[match.SAVE_KEY, initialPayload]]);
  const writes = [];
  let failNext = false;
  return {
    writes,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    failNextWrite() { failNext = true; },
    setItem(key, value) {
      if (failNext) { failNext = false; throw new Error("injected persistence failure"); }
      writes.push([key, value]); values.set(key, value);
    },
  };
}

function rootFixture() {
  const streams = engine.createRngDomains(9901, match.REQUIRED_RNG_STREAMS);
  return save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "Alice", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
      playerB: save.createProfile({ name: "Bob", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
    },
    rngSnapshot: engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS),
  });
}

function makeSession(storage, prefix = "session") {
  let nextId = 0;
  let clockTick = 0;
  return createStandardLocalSession({
    storageAdapter: storage,
    clock: { now: () => new Date(Date.UTC(2026, 7, 30, 5, clockTick++)).toISOString() },
    idFactory: (scope) => `${prefix}-${scope}-${++nextId}`,
  });
}

test("setup projection exposes only profile availability and the explicit experimental loan", () => {
  const root = rootFixture();
  const session = makeSession(memoryStorage(save.encodeStandardSave(root)));
  const setup = session.getSetupProjection();
  assert.equal(setup.stage, "SETUP");
  assert.equal(setup.ruleLabel, "標準α・機能検証用");
  assert.deepEqual(setup.profiles.map((profile) => profile.displayName), ["Alice", "Bob"]);
  assert.equal(setup.profiles[0].cards.colorPrism.ownedCount, 1);
  assert.equal(setup.profiles[0].cards.colorPrism.reservedCount, 0);
  assert.equal(setup.profiles[0].cards.colorPrism.availableCount, 1);
  assert.deepEqual(setup.experimentalLoan, { skillId: "legalRecolor", count: 1, inventoryBacked: false, reserved: 0 });
  assert.equal(JSON.stringify(setup).includes("basicPalettes"), false);
  assert.equal(JSON.stringify(setup).includes("rngSnapshot"), false);
});

test("formal Standard setup projects all 19 canonical inventories without the experimental loan or secrets", () => {
  const root = rootFixture();
  const session = makeSession(memoryStorage(save.encodeStandardSave(root)));
  const setup = session.getSetupProjection(matchStart.RULE_SET_IDS.STANDARD);
  assert.equal(setup.ruleSetId, matchStart.RULE_SET_IDS.STANDARD);
  assert.equal(setup.ruleLabel, "標準・熟考モード");
  assert.equal(Object.keys(setup.profiles[0].cards).length, 19);
  assert.equal(Object.hasOwn(setup.profiles[0].cards, "legalRecolor"), false);
  assert.equal(Object.hasOwn(setup, "experimentalLoan"), false);
  assert.equal(JSON.stringify(setup).includes("basicPalettes"), false);
  assert.equal(JSON.stringify(setup).includes("rngSnapshot"), false);
});

test("local session quotes, atomically starts, retries, and reloads a caller-supplied six-card Standard match", () => {
  const root = rootFixture();
  for (const profile of Object.values(root.profiles)) for (const skillId of Object.values(STANDARD_LOADOUT).flat()) profile.inventory[skillId] = 1;
  const storage = memoryStorage(save.encodeStandardSave(root));
  const session = makeSession(storage, "standard");
  const args = {
    profileAId: "playerA",
    profileBId: "playerB",
    matchId: "standard-session",
    operationId: "standard-start",
    firstSeat: "B",
    ruleSetId: matchStart.RULE_SET_IDS.STANDARD,
    loadouts: { A: STANDARD_LOADOUT, B: STANDARD_LOADOUT },
  };
  const quoted = session.quoteStart(args);
  assert.equal(quoted.code, "READY");
  assert.notEqual(quoted.quoteIds.A, quoted.quoteIds.B);
  args.quoteIds = quoted.quoteIds;
  storage.failNextWrite();
  const failed = session.startMatch(args);
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(failed.projection.stage, "SETUP");
  assert.equal(failed.projection.ruleSetId, matchStart.RULE_SET_IDS.STANDARD);
  assert.equal(storage.writes.length, 0);
  const started = session.startMatch(args);
  assert.equal(started.code, "STARTED");
  assert.equal(started.matchId, "standard-session");
  assert.equal(started.operationId, "standard-start");
  assert.equal(started.projection.stage, "HANDOVER");
  assert.equal(started.projection.seat, "B");
  assert.equal(storage.writes.length, 1);
  const persisted = save.decodeStandardSave(storage.getItem(match.SAVE_KEY));
  assert.equal(persisted.activeMatch.ruleSetId, matchStart.RULE_SET_IDS.STANDARD);
  assert.deepEqual(Object.keys(persisted.activeMatch.state.hands.A).sort(), Object.values(STANDARD_LOADOUT).flat().sort());
  assert.deepEqual(Object.keys(persisted.reservations.playerA).sort(), Object.values(STANDARD_LOADOUT).flat().sort());
  assert.deepEqual(Object.keys(persisted.reservations.playerB).sort(), Object.values(STANDARD_LOADOUT).flat().sort());
  assert.equal(Object.hasOwn(persisted.activeMatch.state.hands.A, "legalRecolor"), false);
  const reloaded = makeSession(storage, "standard-reload");
  assert.equal(reloaded.getStageProjection().stage, "HANDOVER");
  assert.equal(reloaded.getStageProjection().seat, "B");
});

test("formal Standard session rejects missing loadouts and duplicate profiles before persistence", () => {
  const root = rootFixture();
  const storage = memoryStorage(save.encodeStandardSave(root));
  const session = makeSession(storage, "invalid-standard");
  const base = { profileAId: "playerA", profileBId: "playerB", matchId: "standard-invalid", operationId: "standard-invalid-start", ruleSetId: matchStart.RULE_SET_IDS.STANDARD };
  assert.equal(session.quoteStart(base).code, "INVALID_LOADOUT");
  assert.equal(session.quoteStart({ ...base, profileBId: "playerA", loadouts: { A: STANDARD_LOADOUT, B: STANDARD_LOADOUT } }).code, "DUPLICATE_OR_MISSING_PROFILE_PARTICIPANT");
  assert.equal(storage.writes.length, 0);
});

test("formal Standard start requires two owned live quotes and consumes them once", () => {
  const root = rootFixture();
  for (const profile of Object.values(root.profiles)) for (const skillId of Object.values(STANDARD_LOADOUT).flat()) profile.inventory[skillId] = 1;
  const storage = memoryStorage(save.encodeStandardSave(root));
  const session = makeSession(storage, "quote-contract");
  const base = { profileAId: "playerA", profileBId: "playerB", matchId: "quote-match", operationId: "quote-start", firstSeat: "A", ruleSetId: matchStart.RULE_SET_IDS.STANDARD };
  assert.equal(session.startMatch({ ...base, loadouts: { A: STANDARD_LOADOUT, B: STANDARD_LOADOUT } }).code, "LOADOUT_QUOTES_REQUIRED");
  const quoted = session.quoteStart({ ...base, loadouts: { A: STANDARD_LOADOUT, B: STANDARD_LOADOUT } });
  assert.equal(quoted.code, "READY");
  assert.equal(quoted.quotes.A.actorId, "playerA");
  assert.equal(quoted.quotes.B.actorId, "playerB");
  assert.equal(session.startMatch({ ...base, profileAId: "playerB", profileBId: "playerA", quoteIds: quoted.quoteIds }).code, "QUOTE_OWNER_MISMATCH");
  const started = session.startMatch({ ...base, quoteIds: quoted.quoteIds });
  assert.equal(started.code, "STARTED");
  const persisted = save.decodeStandardSave(storage.getItem(match.SAVE_KEY));
  assert.deepEqual(persisted.receipts.matchStart.byMatchId[base.matchId].quoteIds, quoted.quoteIds);
  const replay = session.startMatch({ ...base, quoteIds: quoted.quoteIds });
  assert.equal(replay.code, "ALREADY_STARTED");
  assert.equal(replay.projection.stage, "HANDOVER");
  assert.equal(session.startMatch({ ...base, operationId: "quote-start-other", quoteIds: quoted.quoteIds }).code, "QUOTE_ALREADY_USED");
  assert.equal(storage.writes.length, 1);
});

test("expired and stale seat quotes reject before match creation without writes", () => {
  const root = rootFixture();
  for (const profile of Object.values(root.profiles)) for (const skillId of Object.values(STANDARD_LOADOUT).flat()) profile.inventory[skillId] = 1;
  const storage = memoryStorage(save.encodeStandardSave(root));
  let nextId = 0;
  let tick = 0;
  const session = createStandardLocalSession({
    storageAdapter: storage,
    clock: { now: () => new Date(Date.UTC(2026, 8, 1, 0, 0, tick++)).toISOString() },
    idFactory: (scope) => `expiry-${scope}-${++nextId}`,
  });
  const quoteA = session.quoteLoadout({ actorId: "playerA", seat: "A", roomId: "expiry-match", loadout: STANDARD_LOADOUT, ttlMs: 1 });
  const quoteB = session.quoteLoadout({ actorId: "playerB", seat: "B", roomId: "expiry-match", loadout: STANDARD_LOADOUT, ttlMs: 60_000 });
  const expired = session.startMatch({ profileAId: "playerA", profileBId: "playerB", matchId: "expiry-match", operationId: "expiry-start", ruleSetId: matchStart.RULE_SET_IDS.STANDARD, quoteIds: { A: quoteA.quote.quoteId, B: quoteB.quote.quoteId } });
  assert.equal(expired.code, "QUOTE_EXPIRED");
  assert.equal(storage.writes.length, 0);
  assert.equal(expired.projection.stage, "SETUP");
});

test("a second local session reloads the persisted root and cannot overbook stale quotes", () => {
  const root = rootFixture();
  for (const profile of Object.values(root.profiles)) for (const skillId of Object.values(STANDARD_LOADOUT).flat()) profile.inventory[skillId] = 1;
  const storage = memoryStorage(save.encodeStandardSave(root));
  const first = makeSession(storage, "tab-one");
  const second = makeSession(storage, "tab-two");
  const firstArgs = { profileAId: "playerA", profileBId: "playerB", matchId: "tab-one-match", operationId: "tab-one-start", ruleSetId: matchStart.RULE_SET_IDS.STANDARD, loadouts: { A: STANDARD_LOADOUT, B: STANDARD_LOADOUT } };
  const secondArgs = { ...firstArgs, matchId: "tab-two-match", operationId: "tab-two-start" };
  const firstQuote = first.quoteStart(firstArgs);
  const secondQuote = second.quoteStart(secondArgs);
  assert.equal(first.startMatch({ ...firstArgs, quoteIds: firstQuote.quoteIds }).code, "STARTED");
  const rejected = second.startMatch({ ...secondArgs, quoteIds: secondQuote.quoteIds });
  assert.equal(rejected.code, "STALE_INVENTORY_REVISION");
  assert.equal(rejected.projection.stage, "HANDOVER");
  assert.equal(storage.writes.length, 1);
  const persisted = save.decodeStandardSave(storage.getItem(match.SAVE_KEY));
  assert.equal(persisted.activeMatch.state.matchId, "tab-one-match");
  assert.equal(persisted.rootRevision, 1);
});

test("settled formal match rematches with fresh quotes and reservations only", () => {
  const root = rootFixture();
  for (const profile of Object.values(root.profiles)) for (const skillId of Object.values(STANDARD_LOADOUT).flat()) profile.inventory[skillId] = 1;
  const storage = memoryStorage(save.encodeStandardSave(root));
  const session = makeSession(storage, "rematch");
  const firstArgs = { profileAId: "playerA", profileBId: "playerB", matchId: "rematch-one", operationId: "rematch-start-one", firstSeat: "A", ruleSetId: matchStart.RULE_SET_IDS.STANDARD, loadouts: { A: STANDARD_LOADOUT, B: STANDARD_LOADOUT } };
  const firstQuote = session.quoteStart(firstArgs);
  assert.equal(session.startMatch({ ...firstArgs, quoteIds: firstQuote.quoteIds }).code, "STARTED");
  assert.equal(session.dispatchAction({ actorSeat: "A", type: "SURRENDER" }).code, "OK");
  assert.equal(session.settle().code, "SETTLED");
  assert.equal(session.getStageProjection().stage, "RESULT");

  const secondArgs = { ...firstArgs, matchId: "rematch-two", operationId: "rematch-start-two", firstSeat: "B" };
  const secondQuote = session.quoteStart(secondArgs);
  assert.equal(secondQuote.code, "READY");
  assert.notDeepEqual(secondQuote.quoteIds, firstQuote.quoteIds);
  const rematch = session.startMatch({ ...secondArgs, quoteIds: secondQuote.quoteIds });
  assert.equal(rematch.code, "STARTED");
  assert.equal(rematch.projection.stage, "HANDOVER");
  assert.equal(rematch.projection.seat, "B");
  const persisted = save.decodeStandardSave(storage.getItem(match.SAVE_KEY));
  assert.equal(persisted.activeMatch.state.matchId, "rematch-two");
  assert.equal(Object.keys(persisted.receipts.matchStart.byMatchId).length, 2);
  assert.equal(Object.keys(persisted.receipts.matchSettlement.byMatchId).length, 1);
  assert.equal(Object.keys(persisted.reservations.playerA).length, 6);
  assert.equal(Object.keys(persisted.reservations.playerB).length, 6);
});

test("local PvP session walks start, handover, normal turn, loan skill, reload, surrender, settlement, and result", () => {
  const root = rootFixture();
  const storage = memoryStorage(save.encodeStandardSave(root));
  const session = makeSession(storage);
  const quote = session.quoteStart({ profileAId: "playerA", profileBId: "playerB", matchId: "alpha-session", operationId: "alpha-start", firstSeat: "A" });
  assert.equal(quote.status, "READY");
  const started = session.startMatch({ profileAId: "playerA", profileBId: "playerB", matchId: "alpha-session", operationId: "alpha-start", firstSeat: "A" });
  assert.equal(started.projection.stage, "HANDOVER");
  assert.equal(started.projection.seat, "A");
  assert.equal(session.revealPrivate("A").privateState.hand.legalRecolor, 1);

  const first = session.getPublicProjection();
  const created = session.dispatchAction({
    actorSeat: "A",
    type: "CREATE_REGION",
    payload: { sourceMacros: Array.from({ length: first.requiredSize }, (_, index) => 13 + index) },
  });
  assert.equal(created.contactColorCount, 0);
  assert.equal(created.appliedNow, true);
  assert.equal(created.replayedReceipt, false);
  assert.equal(created.actionType, "CREATE_REGION");
  assert.equal(created.ok, true);
  assert.equal(created.activeChanged, true);
  assert.equal(created.projection.stage, "HANDOVER");
  assert.equal(created.projection.seat, "B");

  const ownB = session.revealPrivate("B").privateState;
  const colored = session.dispatchAction({ actorSeat: "B", type: "COLOR_REGION", payload: { color: ownB.basicPalette[0] } });
  assert.equal(colored.ok, true);
  assert.equal(colored.activeChanged, false);
  assert.equal(session.getPublicProjection().phase, "WORK");

  const recolored = session.dispatchAction({ actorSeat: "B", type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } });
  assert.equal(recolored.ok, true);
  assert.equal(recolored.activeChanged, true);
  assert.equal(recolored.projection.stage, "HANDOVER");
  assert.equal(recolored.projection.seat, "A");
  const afterLoan = save.decodeStandardSave(storage.getItem(match.SAVE_KEY));
  const loanReceipts = Object.values(afterLoan.receipts.matchConsumption).filter((receipt) => receipt.skill === "legalRecolor");
  assert.equal(loanReceipts.length, 1);
  assert.equal(loanReceipts[0].source, "EXPERIMENTAL_LOAN");
  assert.equal(loanReceipts[0].profileId, "playerB");
  assert.equal(afterLoan.profiles.playerB.inventory.legalRecolor, undefined);
  assert.equal(afterLoan.reservations.playerB.legalRecolor, undefined);

  const reloaded = makeSession(storage, "reloaded");
  assert.equal(reloaded.getStageProjection().stage, "HANDOVER");
  assert.equal(reloaded.getStageProjection().seat, "A");
  assert.equal(reloaded.revealPrivate("A").ok, true);
  const surrendered = reloaded.dispatchAction({ actorSeat: "A", type: "SURRENDER" });
  assert.equal(surrendered.finished, true);
  assert.equal(surrendered.projection.stage, "SETTLEMENT_PENDING");
  const settled = reloaded.settle();
  assert.equal(settled.status, "SETTLED");
  assert.equal(settled.projection.stage, "RESULT");
  assert.equal(settled.projection.winnerSeat, "B");

  const afterResultReload = makeSession(storage, "result-reload");
  assert.equal(afterResultReload.getStageProjection().stage, "RESULT");
  assert.equal(afterResultReload.settle().status, "ALREADY_SETTLED");
  const decoded = save.decodeStandardSave(storage.getItem(match.SAVE_KEY));
  assert.deepEqual(decoded.reservations, {});
  assert.equal(decoded.profiles.playerA.inventory.colorPrism, 1);
  assert.equal(decoded.profiles.playerB.inventory.colorPrism, 1);
  assert.equal(decoded.profiles.playerB.inventory.legalRecolor, undefined);
  assert.equal(decoded.receipts.matchSettlement.byMatchId["alpha-session"].matchId, "alpha-session");
  assert.equal(Object.values(decoded.receipts.matchConsumption).filter((receipt) => receipt.skill === "legalRecolor").length, 1);
  assert.equal(Object.keys(decoded.receipts.matchAction).length, 4);
});

test("missing product save does not synthesize profiles or hidden card grants", () => {
  const session = makeSession(memoryStorage());
  assert.deepEqual(session.getSetupProjection(), { stage: "SETUP", profiles: [], canStart: false, code: "NO_LOCAL_SAVE" });
});

test("failed action identity is reused only for the same intent and is cleared by changed payload or cancel", () => {
  function started(prefix) {
    const storage = memoryStorage(save.encodeStandardSave(rootFixture()));
    const session = makeSession(storage, prefix);
    session.startMatch({ profileAId: "playerA", profileBId: "playerB", matchId: `${prefix}-match`, operationId: `${prefix}-start`, firstSeat: "A" });
    const size = session.getPublicProjection().requiredSize;
    return { storage, session, first: Array.from({ length: size }, (_, index) => 13 + index), second: Array.from({ length: size }, (_, index) => 25 + index) };
  }

  const retry = started("retry");
  retry.storage.failNextWrite();
  const failed = retry.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: retry.first } });
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(retry.storage.getItem(match.SAVE_KEY).includes(failed.actionId), false);
  assert.equal(JSON.stringify(retry.session.getPublicProjection()).includes(failed.actionId), false);
  assert.equal(JSON.stringify(retry.session.revealPrivate("A")).includes(failed.actionId), false);
  const writesAfterFailure = retry.storage.writes.length;
  const mismatch = retry.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: retry.second }, actionId: failed.actionId });
  assert.equal(mismatch.code, "ACTION_ID_PAYLOAD_MISMATCH");
  assert.equal(mismatch.contactColorCount, null);
  assert.equal(retry.storage.writes.length, writesAfterFailure);
  const succeeded = retry.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: retry.first } });
  assert.equal(succeeded.ok, true);
  assert.equal(succeeded.actionId, failed.actionId);
  assert.equal(retry.session.cancelPendingActionRetry(), false);
  const samePayloadAfterSuccess = retry.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: retry.first } });
  assert.notEqual(samePayloadAfterSuccess.actionId, failed.actionId);
  assert.equal(samePayloadAfterSuccess.code, "NOT_YOUR_TURN");
  const nextPrivate = retry.session.revealPrivate("B");
  assert.equal(nextPrivate.ok, true);
  const nextNormal = retry.session.dispatchAction({ actorSeat: "B", type: "COLOR_REGION", payload: { color: nextPrivate.privateState.basicPalette[0] } });
  assert.equal(nextNormal.ok, true);
  assert.notEqual(nextNormal.actionId, failed.actionId);
  assert.notEqual(nextNormal.actionId, samePayloadAfterSuccess.actionId);

  const changed = started("changed");
  changed.storage.failNextWrite();
  const changedFailure = changed.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: changed.first } });
  const changedSuccess = changed.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: changed.second } });
  assert.equal(changedSuccess.ok, true);
  assert.notEqual(changedSuccess.actionId, changedFailure.actionId);
  assert.notEqual(changedSuccess.code, "IDEMPOTENCY_KEY_REUSE");

  const cancelled = started("cancelled");
  cancelled.storage.failNextWrite();
  const cancelledFailure = cancelled.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: cancelled.first } });
  assert.equal(cancelled.session.cancelPendingActionRetry(), true);
  assert.equal(cancelled.session.cancelPendingActionRetry(), false);
  const afterCancel = cancelled.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: cancelled.first } });
  assert.equal(afterCancel.ok, true);
  assert.notEqual(afterCancel.actionId, cancelledFailure.actionId);

  const resynced = started("resynced");
  resynced.storage.failNextWrite();
  resynced.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: resynced.first } });
  const external = makeSession(resynced.storage, "external");
  assert.equal(external.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: resynced.first } }).ok, true);
  resynced.session.reload();
  assert.equal(resynced.session.cancelPendingActionRetry(), false);
  assert.equal(resynced.session.getPublicProjection().active, "B");
  assert.equal(resynced.session.getPublicProjection().phase, "COLOR");

  const replaced = started("replaced");
  replaced.storage.failNextWrite();
  replaced.session.dispatchAction({ actorSeat: "A", type: "CREATE_REGION", payload: { sourceMacros: replaced.first } });
  const otherMatch = started("other");
  replaced.storage.setItem(match.SAVE_KEY, otherMatch.storage.getItem(match.SAVE_KEY));
  replaced.session.reload();
  assert.equal(replaced.session.cancelPendingActionRetry(), false);
  assert.equal(replaced.session.getPublicProjection().matchId, "other-match");
});

test("local card sale quotes, fails atomically, retries once, and projects coins plus keep-one inventory", () => {
  const root = rootFixture();
  root.profiles.playerA.inventory.colorPrism = 4;
  const storage = memoryStorage(save.encodeStandardSave(root));
  const session = makeSession(storage, "sale-session");
  const before = session.getCardSaleProjection("playerA");
  const beforeCard = before.items.find((item) => item.skillId === "colorPrism");
  assert.equal(before.coins, 0);
  assert.equal(beforeCard.sellableCount, 3);
  const quote = session.quoteCardSale({ profileId: "playerA", skillId: "colorPrism", quantity: 3 });
  assert.equal(quote.ok, true);
  assert.deepEqual(quote.quote.confirmationReasons, ["LAST_SELLABLE_COPY"]);
  const request = { operationId: "sale-session-1", profileId: "playerA", skillId: "colorPrism", quantity: 3, acceptedConfirmationReasons: quote.quote.confirmationReasons };
  storage.failNextWrite();
  const failed = session.commitCardSale(request);
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(session.getCardSaleProjection("playerA").coins, 0);
  const writesAfterFailure = storage.writes.length;
  const committed = session.commitCardSale(request);
  assert.equal(committed.code, "COMMITTED");
  assert.equal(committed.sale.coins, 240);
  assert.equal(committed.sale.items.find((item) => item.skillId === "colorPrism").ownedCount, 1);
  assert.equal(storage.writes.length, writesAfterFailure + 1);
  const replay = session.commitCardSale(request);
  assert.equal(replay.code, "IDEMPOTENT_REPLAY");
  assert.equal(storage.writes.length, writesAfterFailure + 1);
});

test("local cosmetic purchase retries the same operation and projects purchase/equip state", () => {
  const root = rootFixture();
  root.profiles.playerA.coins = 900;
  const storage = memoryStorage(save.encodeStandardSave(root));
  const session = makeSession(storage, "cosmetic-session");
  const before = session.getCosmeticProjection("playerA");
  assert.equal(before.coins, 900);
  assert.equal(before.items.find((item) => item.cosmeticId === "boardGold").owned, false);
  const quote = session.quoteCosmeticAction({ profileId: "playerA", cosmeticId: "boardGold" });
  assert.equal(quote.quote.price, 900);
  const request = { operationId: "cosmetic-session-1", profileId: "playerA", cosmeticId: "boardGold" };
  storage.failNextWrite();
  assert.equal(session.commitCosmeticAction(request).code, "PERSISTENCE_FAILED");
  assert.equal(session.getCosmeticProjection("playerA").coins, 900);
  const committed = session.commitCosmeticAction(request);
  assert.equal(committed.code, "COMMITTED");
  assert.equal(committed.cosmetics.coins, 0);
  assert.equal(committed.cosmetics.equipped.board, "boardGold");
  assert.equal(session.commitCosmeticAction(request).code, "IDEMPOTENT_REPLAY");
});
