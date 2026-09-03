"use strict";

const match = require("./standard-match.js");
const matchStart = require("./standard-match-start.js");
const matchTransaction = require("./standard-match-transaction.js");
const rootTransaction = require("./standard-root-transaction.js");
const save = require("./standard-save.js");
const profileModel = require("./standard-profile.js");
const loadoutQuote = require("./standard-loadout-quote.js");
const quizTransaction = require("./standard-quiz-transaction.js");
const gachaTransaction = require("./standard-gacha-transaction.js");
const cosmetics = require("./standard-cosmetics.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("./standard-skill-registry.js");

const ALPHA_INVENTORY_SKILLS = Object.freeze(["colorPrism", "areaHalfShift", "disruptChoiceOne"]);
const STANDARD_INVENTORY_SKILLS = Object.freeze(V49_SKILL_IDS.filter((skillId) => STANDARD_SKILLS[skillId].standardUiEnabled));
const ALPHA_LOADOUT = Object.freeze({
  color: Object.freeze(["colorPrism"]),
  area: Object.freeze(["areaHalfShift"]),
  disrupt: Object.freeze(["disruptChoiceOne"]),
  experimental: Object.freeze(["legalRecolor"]),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function invalidSettlementSummary() {
  return deepFreeze({ status: "FAILED", code: "INVALID_SETTLEMENT_SUMMARY" });
}

function projectPublicSettlementSummary({ root, matchId, failureCode = null } = {}) {
  try {
    save.validateStandardSave(root);
    const activeMatch = root.activeMatch;
    if (!activeMatch || activeMatch.state.matchId !== matchId || activeMatch.state.status !== "FINISHED") return invalidSettlementSummary();
    const receipt = root.receipts.matchSettlement.byMatchId[matchId];
    if (!receipt) {
      if (failureCode) return deepFreeze({ status: "FAILED", code: failureCode === "PERSISTENCE_FAILED" ? failureCode : "SETTLEMENT_FAILED" });
      return deepFreeze({ status: "PENDING" });
    }
    if (!activeMatch.settlement?.settled || receipt.matchId !== matchId || receipt.winnerSeat !== activeMatch.state.winner || receipt.terminalReason !== activeMatch.state.terminalReason) return invalidSettlementSummary();
    const bySeat = {};
    const unlockedTrophies = [];
    for (const seat of ["A", "B"]) {
      const participant = activeMatch.participants[seat];
      const result = receipt.winnerSeat === seat ? "WIN" : "LOSS";
      if (participant.type === "CPU") {
        bySeat[seat] = { result };
        continue;
      }
      const profileResult = receipt.profileResults[participant.profileId];
      const stats = profileResult?.stats;
      const fields = ["wins", "losses", "currentWinStreak", "bestWinStreak"];
      if (profileResult?.result !== result || !stats || fields.some((field) => !Number.isSafeInteger(stats[field]) || stats[field] < 0)) return invalidSettlementSummary();
      bySeat[seat] = { result, ...Object.fromEntries(fields.map((field) => [field, stats[field]])) };
      const profile = root.profiles[participant.profileId];
      for (const trophyId of profileModel.TROPHY_IDS) {
        if (profileResult.trophies?.[trophyId] === true && profile?.trophyDates?.[trophyId] === receipt.settledAt) unlockedTrophies.push({ seat, trophyId });
      }
    }
    return deepFreeze({ status: "SETTLED", bySeat, unlockedTrophies });
  } catch {
    return invalidSettlementSummary();
  }
}

function loadRoot(storageAdapter) {
  const payload = storageAdapter.getItem(match.SAVE_KEY);
  return payload === null ? null : save.decodeStandardSave(payload);
}

function profileSetupProjection(root, profileId, skillIds = ALPHA_INVENTORY_SKILLS) {
  const profile = root.profiles[profileId];
  if (!profile) return null;
  const cards = Object.fromEntries(skillIds.map((skillId) => {
    const owned = profile.inventory[skillId] || 0;
    const reserved = root.reservations[profileId]?.[skillId] || 0;
    const definition = STANDARD_SKILLS[skillId];
    return [skillId, Object.freeze({
      skillId,
      category: definition.category,
      rarity: definition.rarity,
      ownedCount: owned,
      reservedCount: reserved,
      availableCount: owned - reserved,
      standardUiEnabled: Boolean(definition.standardUiEnabled),
      owned,
      reserved,
      available: owned - reserved,
    })];
  }));
  return Object.freeze({ profileId, displayName: profile.displayName, cards: Object.freeze(cards) });
}

function setupProjection(root, ruleSetId = matchStart.RULE_SET_IDS.ALPHA_SLICE) {
  if (!root) return Object.freeze({ stage: "SETUP", profiles: Object.freeze([]), canStart: false, code: "NO_LOCAL_SAVE" });
  const standard = ruleSetId === matchStart.RULE_SET_IDS.STANDARD;
  const skillIds = standard ? STANDARD_INVENTORY_SKILLS : ALPHA_INVENTORY_SKILLS;
  const profiles = Object.keys(root.profiles).sort().map((profileId) => profileSetupProjection(root, profileId, skillIds));
  const projection = {
    stage: "SETUP",
    ruleSetId,
    ruleLabel: standard ? "標準・熟考モード" : "標準α・機能検証用",
    profiles: Object.freeze(profiles),
  };
  if (!standard) projection.experimentalLoan = Object.freeze({ skillId: "legalRecolor", count: 1, inventoryBacked: false, reserved: 0 });
  return Object.freeze(projection);
}

function gachaProjection(root, profileId) {
  const profile = root?.profiles?.[profileId];
  if (!profile) return Object.freeze({ ok: false, code: "UNKNOWN_PROFILE" });
  return Object.freeze({
    ok: true,
    profileId,
    displayName: profile.displayName,
    tickets: Object.freeze(Object.fromEntries([1, 2, 3, 4, 5].map((level) => [level, profile.gachaTickets[String(level)] || 0]))),
  });
}

function cardSaleProjection(root, profileId) {
  const profile = root?.profiles?.[profileId];
  if (!profile) return Object.freeze({ ok: false, code: "UNKNOWN_PROFILE" });
  const items = STANDARD_INVENTORY_SKILLS.map((skillId) => {
    const definition = STANDARD_SKILLS[skillId];
    const ownedCount = profile.inventory[skillId] || 0;
    const reservedCount = root.reservations[profileId]?.[skillId] || 0;
    const protectedCard = profile.protectedSkills[skillId] === true;
    return Object.freeze({
      skillId,
      category: definition.category,
      rarity: definition.rarity,
      ownedCount,
      reservedCount,
      sellableCount: protectedCard ? 0 : Math.max(0, ownedCount - Math.max(1, reservedCount)),
      protected: protectedCard,
      valuePerCard: profileModel.coinValueForSkill(skillId),
    });
  });
  return deepFreeze({ ok: true, profileId, displayName: profile.displayName, coins: profile.coins, items });
}

function cosmeticProjection(root, profileId) {
  const profile = root?.profiles?.[profileId];
  if (!profile) return Object.freeze({ ok: false, code: "UNKNOWN_PROFILE" });
  const projected = cosmetics.projectCosmetics(profile);
  return deepFreeze({ ok: true, profileId, displayName: profile.displayName, trophies: clone(profile.trophies), trophyDates: clone(profile.trophyDates), stats: clone(profile.stats), ...projected });
}

function resultProjection(root) {
  const activeMatch = root?.activeMatch;
  if (!activeMatch?.settlement?.settled) return null;
  const receipt = root.receipts.matchSettlement.byMatchId[activeMatch.state.matchId];
  if (!receipt) return null;
  return Object.freeze({
    stage: "RESULT",
    matchId: activeMatch.state.matchId,
    winnerSeat: receipt.winnerSeat,
    terminalReason: receipt.terminalReason,
    mapCompleteWin: match.isMapCompleteWin(activeMatch.state),
    participants: Object.freeze(clone(activeMatch.participants)),
    settlementSummary: projectPublicSettlementSummary({ root, matchId: activeMatch.state.matchId }),
    settledAt: receipt.settledAt,
  });
}

function stageProjection(root, settlementFailureCode = null) {
  if (!root?.activeMatch) return setupProjection(root);
  if (root.activeMatch.settlement.settled) return resultProjection(root);
  const publicState = match.projectStandardPublicState(root.activeMatch.state);
  if (publicState.status === "FINISHED") return Object.freeze({
    stage: "SETTLEMENT_PENDING",
    publicState,
    participants: Object.freeze(clone(root.activeMatch.participants)),
    publicResult: Object.freeze({
      matchId: publicState.matchId,
      finalMatchVersion: publicState.version,
      winnerSeat: publicState.winner,
      terminalReason: publicState.terminalReason,
      mapCompleteWin: match.isMapCompleteWin(root.activeMatch.state),
    }),
    settlementSummary: projectPublicSettlementSummary({ root, matchId: publicState.matchId, failureCode: settlementFailureCode }),
  });
  return Object.freeze({ stage: "HANDOVER", seat: publicState.active, publicState });
}

function createStandardLocalSession({ storageAdapter, clock, idFactory }) {
  if (!storageAdapter || typeof storageAdapter.getItem !== "function" || typeof storageAdapter.setItem !== "function") throw new TypeError("STORAGE_ADAPTER_REQUIRED");
  if (!clock || typeof clock.now !== "function") throw new TypeError("CLOCK_REQUIRED");
  if (typeof idFactory !== "function") throw new TypeError("ID_FACTORY_REQUIRED");
  let root = loadRoot(storageAdapter);
  // Ephemeral only: a failed persistence attempt may be retried with the same
  // identity, but that identity must never survive a changed intent or reload.
  let pendingActionRetry = null;
  let settlementFailureCode = null;
  const loadoutQuotes = new Map();
  const usedLoadoutQuotes = new Map();

  function reload() {
    pendingActionRetry = null;
    settlementFailureCode = null;
    loadoutQuotes.clear();
    usedLoadoutQuotes.clear();
    root = loadRoot(storageAdapter);
    return stageProjection(root, settlementFailureCode);
  }

  function requestedLoadouts(ruleSetId, loadouts) {
    if (loadouts !== undefined && loadouts !== null) return clone(loadouts);
    return ruleSetId === matchStart.RULE_SET_IDS.ALPHA_SLICE ? { A: clone(ALPHA_LOADOUT), B: clone(ALPHA_LOADOUT) } : null;
  }

  function getInventoryProjection(actorId) {
    if (!root) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE" });
    return loadoutQuote.projectStandardInventory({ root, actorId });
  }

  function quoteLoadout({ actorId, seat, roomId, loadout, quoteId = idFactory("quote"), ttlMs = loadoutQuote.DEFAULT_QUOTE_TTL_MS }) {
    if (!root) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE" });
    if (loadoutQuotes.has(quoteId) || usedLoadoutQuotes.has(quoteId)) return Object.freeze({ ok: false, status: "REJECTED", code: "QUOTE_ID_REUSE" });
    const result = loadoutQuote.createStandardLoadoutQuote({
      root,
      expectedRootRevision: root.rootRevision,
      quoteId,
      actorId,
      seat,
      roomId,
      loadout,
      now: clock.now(),
      ttlMs,
    });
    if (result.ok) loadoutQuotes.set(quoteId, result.quote);
    return result;
  }

  function verifySeatQuotes({ profileAId, profileBId, matchId, operationId, quoteIds }) {
    if (!quoteIds || typeof quoteIds !== "object" || Array.isArray(quoteIds)) return Object.freeze({ ok: false, status: "REJECTED", code: "LOADOUT_QUOTES_REQUIRED" });
    const verified = {};
    const now = clock.now();
    for (const [seat, actorId] of [["A", profileAId], ["B", profileBId]]) {
      const quoteId = quoteIds[seat];
      const used = usedLoadoutQuotes.get(quoteId);
      if (used) {
        if (used.operationId !== operationId || used.matchId !== matchId) return Object.freeze({ ok: false, status: "REJECTED", code: "QUOTE_ALREADY_USED", used });
        verified[seat] = loadoutQuotes.get(quoteId);
        continue;
      }
      const result = loadoutQuote.verifyStandardLoadoutQuote({ root, quote: loadoutQuotes.get(quoteId), quoteId, actorId, seat, roomId: matchId, now });
      if (!result.ok) return result;
      verified[seat] = result.quote;
    }
    if (quoteIds.A === quoteIds.B) return Object.freeze({ ok: false, status: "REJECTED", code: "QUOTE_ID_REUSE" });
    return Object.freeze({ ok: true, status: "VERIFIED", code: "VERIFIED", quotes: Object.freeze(verified) });
  }

  function quoteStart({ profileAId, profileBId, matchId, operationId, firstSeat = null, ruleSetId = matchStart.RULE_SET_IDS.ALPHA_SLICE, loadouts = null }) {
    if (!root) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE", setup: setupProjection(root) });
    let quoteIds = null;
    let effectiveLoadouts = requestedLoadouts(ruleSetId, loadouts);
    if (ruleSetId === matchStart.RULE_SET_IDS.STANDARD) {
      if (profileAId === profileBId) return Object.freeze({ ok: false, status: "REJECTED", code: "DUPLICATE_OR_MISSING_PROFILE_PARTICIPANT", setup: setupProjection(root, ruleSetId) });
      const now = clock.now();
      const candidates = {};
      for (const [seat, actorId] of [["A", profileAId], ["B", profileBId]]) {
        const quoteId = idFactory("quote");
        const result = loadoutQuote.createStandardLoadoutQuote({ root, expectedRootRevision: root.rootRevision, quoteId, actorId, seat, roomId: matchId, loadout: effectiveLoadouts?.[seat], now });
        if (!result.ok) return Object.freeze({ ...result, setup: setupProjection(root, ruleSetId) });
        candidates[seat] = result.quote;
      }
      quoteIds = Object.freeze(Object.fromEntries(["A", "B"].map((seat) => [seat, candidates[seat].quoteId])));
      effectiveLoadouts = Object.fromEntries(["A", "B"].map((seat) => [seat, candidates[seat].normalizedLoadout]));
      const result = matchStart.quoteStandardMatchStart({
        root,
        expectedRootRevision: root.rootRevision,
        operationId,
        matchId,
        ruleSetId,
        participants: { A: { type: "PROFILE", profileId: profileAId }, B: { type: "PROFILE", profileId: profileBId } },
        loadouts: effectiveLoadouts,
        firstSeat,
      });
      if (!result.ok) return Object.freeze({ ok: result.ok, status: result.status, code: result.code, setup: setupProjection(root, ruleSetId) });
      for (const seat of ["A", "B"]) loadoutQuotes.set(candidates[seat].quoteId, candidates[seat]);
      return Object.freeze({ ok: true, status: "READY", code: "READY", quoteIds, quotes: Object.freeze(clone(candidates)), setup: setupProjection(root, ruleSetId) });
    }
    const result = matchStart.quoteStandardMatchStart({
      root,
      expectedRootRevision: root.rootRevision,
      operationId,
      matchId,
      ruleSetId,
      participants: {
        A: { type: "PROFILE", profileId: profileAId },
        B: { type: "PROFILE", profileId: profileBId },
      },
      loadouts: effectiveLoadouts,
      firstSeat,
    });
    return Object.freeze({ ok: result.ok, status: result.status, code: result.code, quoteIds, setup: setupProjection(root, ruleSetId) });
  }

  function startMatch({ profileAId, profileBId, firstSeat = null, ruleSetId = matchStart.RULE_SET_IDS.ALPHA_SLICE, loadouts = null, quoteIds = null, matchId = idFactory("match"), operationId = idFactory("start") }) {
    pendingActionRetry = null;
    settlementFailureCode = null;
    if (!root) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE", stage: "SETUP" });
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE", stage: "SETUP" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, status: "REJECTED", code: error.code || "PERSISTENCE_FAILED", matchId, operationId, projection: root.activeMatch ? stageProjection(root, settlementFailureCode) : setupProjection(root, ruleSetId) });
    }
    let effectiveLoadouts = requestedLoadouts(ruleSetId, loadouts);
    if (ruleSetId === matchStart.RULE_SET_IDS.STANDARD) {
      const verified = verifySeatQuotes({ profileAId, profileBId, matchId, operationId, quoteIds });
      if (!verified.ok) return Object.freeze({ ok: false, status: verified.status, code: verified.code, matchId, operationId, projection: root.activeMatch ? stageProjection(root, settlementFailureCode) : setupProjection(root, ruleSetId) });
      effectiveLoadouts = Object.fromEntries(["A", "B"].map((seat) => [seat, verified.quotes[seat].normalizedLoadout]));
    }
    const result = matchStart.startStandardMatch({
      root,
      expectedRootRevision: root.rootRevision,
      operationId,
      matchId,
      ruleSetId,
      participants: {
        A: { type: "PROFILE", profileId: profileAId },
        B: { type: "PROFILE", profileId: profileBId },
      },
      loadouts: effectiveLoadouts,
      quoteIds: ruleSetId === matchStart.RULE_SET_IDS.STANDARD ? quoteIds : null,
      firstSeat,
      clock,
      storageAdapter,
    });
    if (result.ok && result.root !== root) root = result.root;
    if (result.ok && ruleSetId === matchStart.RULE_SET_IDS.STANDARD) for (const seat of ["A", "B"]) {
      const quoteId = quoteIds[seat];
      usedLoadoutQuotes.set(quoteId, Object.freeze({ operationId, matchId }));
    }
    const projection = root.activeMatch ? stageProjection(root, settlementFailureCode) : setupProjection(root, ruleSetId);
    return Object.freeze({ ok: result.ok, status: result.status, code: result.code, matchId, operationId, projection });
  }

  function revealPrivate(seat) {
    if (!root?.activeMatch || root.activeMatch.state.status === "FINISHED") return Object.freeze({ ok: false, code: "PRIVATE_VIEW_UNAVAILABLE" });
    if (root.activeMatch.state.active !== seat) return Object.freeze({ ok: false, code: "NOT_ACTIVE_SEAT" });
    return Object.freeze({ ok: true, seat, privateState: match.projectStandardPrivateState(root.activeMatch.state, seat) });
  }

  function cancelPendingActionRetry() {
    const cancelled = pendingActionRetry !== null;
    pendingActionRetry = null;
    return cancelled;
  }

  function dispatchAction({ actorSeat, type, payload = {}, actionId = null }) {
    if (!root?.activeMatch) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_ACTIVE_MATCH", saved: false });
    const previousSeat = root.activeMatch.state.active;
    const matchId = root.activeMatch.state.matchId;
    const actionFingerprint = matchTransaction.fingerprint({ matchId, actorSeat, action: { type, payload } });
    const retryFingerprint = JSON.stringify({
      actionFingerprint,
      expectedRootRevision: root.rootRevision,
      expectedMatchVersion: root.activeMatch.state.version,
    });
    if (pendingActionRetry && pendingActionRetry.fingerprint !== retryFingerprint && actionId !== pendingActionRetry.actionId) pendingActionRetry = null;
    if (pendingActionRetry && actionId === pendingActionRetry.actionId && retryFingerprint !== pendingActionRetry.fingerprint) {
      return Object.freeze({
        ok: false,
        status: "REJECTED",
        code: "ACTION_ID_PAYLOAD_MISMATCH",
        actionId,
        saved: false,
        appliedNow: false,
        replayedReceipt: false,
        actionType: type,
        activeChanged: false,
        finished: root.activeMatch.state.status === "FINISHED",
        contactColorCount: null,
        projection: null,
      });
    }
    let resolvedActionId = actionId;
    if (!resolvedActionId) {
      if (pendingActionRetry?.fingerprint === retryFingerprint) resolvedActionId = pendingActionRetry.actionId;
      else {
        pendingActionRetry = null;
        resolvedActionId = idFactory("action");
      }
    } else if (pendingActionRetry && resolvedActionId !== pendingActionRetry.actionId) {
      pendingActionRetry = null;
    }
    const result = matchTransaction.dispatchStandardMatchAction({
      root,
      expectedRootRevision: root.rootRevision,
      expectedMatchVersion: root.activeMatch.state.version,
      matchId,
      actorSeat,
      action: { id: resolvedActionId, type, payload },
      storageAdapter,
    });
    if (result.code === "PERSISTENCE_FAILED") pendingActionRetry = { actionId: resolvedActionId, fingerprint: retryFingerprint };
    else if (pendingActionRetry?.actionId === resolvedActionId) pendingActionRetry = null;
    if (result.ok && result.root !== root) root = result.root;
    if (result.ok && root.activeMatch.state.status === "FINISHED") settlementFailureCode = null;
    const currentSeat = root.activeMatch.state.active;
    return Object.freeze({
      ok: result.ok,
      status: result.status,
      code: result.code,
      actionId: resolvedActionId,
      saved: result.saved,
      appliedNow: result.appliedNow === true,
      replayedReceipt: result.replayedReceipt === true,
      actionType: type,
      activeChanged: result.ok && previousSeat !== currentSeat,
      finished: root.activeMatch.state.status === "FINISHED",
      contactColorCount: result.ok && Number.isInteger(result.contactColorCount) ? result.contactColorCount : null,
      projection: result.ok ? stageProjection(root, settlementFailureCode) : null,
    });
  }

  function settle() {
    pendingActionRetry = null;
    if (!root?.activeMatch) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_ACTIVE_MATCH" });
    const matchId = root.activeMatch.state.matchId;
    const result = rootTransaction.settleCompletedMatch({
      root,
      expectedRootRevision: root.rootRevision,
      operationId: matchId,
      matchId,
      clock,
      storageAdapter,
    });
    if (result.ok && result.root !== root) root = result.root;
    settlementFailureCode = result.ok ? null : result.code;
    return Object.freeze({ ok: result.ok, status: result.status, code: result.code, projection: result.ok ? resultProjection(root) : stageProjection(root, settlementFailureCode) });
  }

  function settleQuizReward({ operationId, quizSessionId, profileId, result }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, status: "REJECTED", code: error.code || "PERSISTENCE_FAILED" });
    }
    const settled = quizTransaction.settleQuizReward({ root, expectedRootRevision: root.rootRevision, operationId, quizSessionId, profileId, result, clock, storageAdapter });
    if (settled.ok && settled.root !== root) root = settled.root;
    return Object.freeze({ ok: settled.ok, status: settled.status, code: settled.code, saved: settled.saved, receipt: settled.receipt, reward: settled.reward, setup: setupProjection(root, matchStart.RULE_SET_IDS.STANDARD) });
  }

  function drawGacha({ operationId, profileId, ticketLevel, count }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, status: "REJECTED", code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, status: "REJECTED", code: error.code || "PERSISTENCE_FAILED" });
    }
    const drawn = gachaTransaction.drawGacha({ root, expectedRootRevision: root.rootRevision, operationId, profileId, ticketLevel, count, clock, storageAdapter });
    if (drawn.ok && drawn.root !== root) root = drawn.root;
    return Object.freeze({ ok: drawn.ok, status: drawn.status, code: drawn.code, saved: drawn.saved, receipt: drawn.receipt, draws: drawn.draws, gacha: gachaProjection(root, profileId), setup: setupProjection(root, matchStart.RULE_SET_IDS.STANDARD) });
  }

  function quoteCardSale({ profileId, skillId, quantity }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, code: error.code || "PERSISTENCE_FAILED" });
    }
    return rootTransaction.quoteCardSale({ root, profileId, skillId, quantity });
  }

  function commitCardSale({ operationId, profileId, skillId, quantity, acceptedConfirmationReasons = [] }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, code: error.code || "PERSISTENCE_FAILED" });
    }
    const committed = rootTransaction.commitCardSale({ root, expectedRootRevision: root.rootRevision, operationId, profileId, skillId, quantity, acceptedConfirmationReasons, storage: storageAdapter });
    if (committed.ok && committed.root !== root) root = committed.root;
    return Object.freeze({ ok: committed.ok, code: committed.code, saved: committed.saved, receipt: committed.receipt, quote: committed.quote, sale: cardSaleProjection(root, profileId), setup: setupProjection(root, matchStart.RULE_SET_IDS.STANDARD) });
  }

  function quoteCosmeticAction({ profileId, cosmeticId }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, code: error.code || "PERSISTENCE_FAILED" });
    }
    return rootTransaction.quoteCosmeticAction({ root, profileId, cosmeticId });
  }

  function commitCosmeticAction({ operationId, profileId, cosmeticId }) {
    try {
      const persistedRoot = loadRoot(storageAdapter);
      if (!persistedRoot) return Object.freeze({ ok: false, code: "NO_LOCAL_SAVE" });
      if (JSON.stringify(persistedRoot) !== JSON.stringify(root)) root = persistedRoot;
    } catch (error) {
      return Object.freeze({ ok: false, code: error.code || "PERSISTENCE_FAILED" });
    }
    const committed = rootTransaction.commitCosmeticAction({ root, expectedRootRevision: root.rootRevision, operationId, profileId, cosmeticId, storage: storageAdapter });
    if (committed.ok && committed.root !== root) root = committed.root;
    return Object.freeze({ ok: committed.ok, code: committed.code, saved: committed.saved, receipt: committed.receipt, quote: committed.quote, cosmetics: cosmeticProjection(root, profileId), setup: setupProjection(root, matchStart.RULE_SET_IDS.STANDARD) });
  }

  return Object.freeze({
    cancelPendingActionRetry,
    commitCardSale,
    commitCosmeticAction,
    dispatchAction,
    drawGacha,
    getCardSaleProjection: (profileId) => cardSaleProjection(root, profileId),
    getCosmeticProjection: (profileId) => cosmeticProjection(root, profileId),
    getGachaProjection: (profileId) => gachaProjection(root, profileId),
    getPublicProjection: () => root?.activeMatch ? match.projectStandardPublicState(root.activeMatch.state) : null,
    getPublicSettlementSummary: () => root?.activeMatch ? projectPublicSettlementSummary({ root, matchId: root.activeMatch.state.matchId, failureCode: settlementFailureCode }) : null,
    getResultProjection: () => resultProjection(root),
    getSetupProjection: (ruleSetId = matchStart.RULE_SET_IDS.ALPHA_SLICE) => setupProjection(root, ruleSetId),
    getStageProjection: () => stageProjection(root, settlementFailureCode),
    quoteStart,
    quoteLoadout,
    quoteCardSale,
    quoteCosmeticAction,
    reload,
    revealPrivate,
    settle,
    settleQuizReward,
    startMatch,
    getInventoryProjection,
  });
}

module.exports = { ALPHA_INVENTORY_SKILLS, ALPHA_LOADOUT, STANDARD_INVENTORY_SKILLS, cardSaleProjection, cosmeticProjection, createStandardLocalSession, gachaProjection, projectPublicSettlementSummary, resultProjection, setupProjection, stageProjection };
