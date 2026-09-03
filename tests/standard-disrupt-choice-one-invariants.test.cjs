"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const engine = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const start = require("../standard/standard-match-start.js");
const transaction = require("../standard/standard-match-transaction.js");

function loadout() {
  return { color: ["colorPrism"], area: ["areaHalfShift"], disrupt: ["disruptChoiceOne"], experimental: ["legalRecolor"] };
}

function sha(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function initialRoot() {
  const streams = engine.createRngDomains(9901, match.REQUIRED_RNG_STREAMS);
  const root = save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "Alice", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
      playerB: save.createProfile({ name: "Bob", inventory: { colorPrism: 1, areaHalfShift: 1, disruptChoiceOne: 1 } }),
    },
    rngSnapshot: engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS),
  });
  return start.startStandardMatch({
    root,
    expectedRootRevision: 0,
    operationId: "disrupt-start",
    matchId: "disrupt-match",
    ruleSetId: start.RULE_SET_IDS.ALPHA_SLICE,
    participants: {
      A: { type: "PROFILE", profileId: "playerA" },
      B: { type: "PROFILE", profileId: "playerB" },
    },
    loadouts: { A: loadout(), B: loadout() },
    firstSeat: "A",
    clock: { now: () => "2026-08-30T09:00:00.000Z" },
    storageAdapter: { setItem() {} },
  }).root;
}

function dispatch(root, actorSeat, id, type, payload, writes = []) {
  return transaction.dispatchStandardMatchAction({
    root,
    expectedRootRevision: root.rootRevision,
    expectedMatchVersion: root.activeMatch.state.version,
    matchId: root.activeMatch.state.matchId,
    actorSeat,
    action: { id, type, payload },
    storageAdapter: { setItem(key, value) { writes.push([key, value]); } },
  });
}

function preDisruptRoot() {
  const created = dispatch(initialRoot(), "A", "disrupt-create-1", "CREATE_REGION", { sourceMacros: [13, 14] });
  assert.equal(created.ok, true);
  const colored = dispatch(created.root, "B", "disrupt-color-1", "COLOR_REGION", { color: "green" });
  assert.equal(colored.ok, true);
  assert.equal(colored.root.activeMatch.state.active, "B");
  assert.equal(colored.root.activeMatch.state.phase, "WORK");
  assert.equal(colored.root.activeMatch.state.requiredSize, 1);
  return colored.root;
}

function snapshot(root, actor = "B") {
  const state = root.activeMatch.state;
  const participant = root.activeMatch.participants[actor];
  const profileId = participant.profileId;
  return {
    rootRevision: root.rootRevision,
    matchVersion: state.version,
    rootHash: sha(root),
    matchHash: sha(state),
    storageHash: sha(save.encodeStandardSave(root)),
    rngHash: sha(root.activeMatch.rngSnapshot),
    rng: structuredClone(root.activeMatch.rngSnapshot),
    hand: state.hands[actor].disruptChoiceOne,
    inventory: root.profiles[profileId].inventory.disruptChoiceOne,
    reservation: root.reservations[profileId].disruptChoiceOne,
    actionReceipts: Object.keys(root.receipts.matchAction).length,
    consumptionReceipts: Object.keys(root.receipts.matchConsumption).length,
    active: state.active,
    phase: state.phase,
    privateA: sha(state.privateEffects.A),
    privateB: sha(state.privateEffects.B),
    sealsA: sha(state.publicEffects.A.seals),
    sealsB: sha(state.publicEffects.B.seals),
    curseA: state.privateEffects.A.curseBacklash || 0,
    curseB: state.privateEffects.B.curseBacklash || 0,
    logLength: state.publicLog.length,
  };
}

function reloadCheckpoint(root) {
  const before = snapshot(root);
  const payload = save.encodeStandardSave(root);
  const decoded = save.decodeStandardSave(payload);
  assert.deepEqual(decoded, root);
  assert.deepEqual(snapshot(decoded), before);
  return decoded;
}

test("disruptChoiceOne consumes once without RNG and survives four exact lifecycle reload checkpoints", () => {
  const root = preDisruptRoot();
  const before = snapshot(root);
  const writes = [];
  const sealed = dispatch(root, "B", "disrupt-use", "USE_SKILL", { skill: "disruptChoiceOne", color: "red" }, writes);
  assert.equal(sealed.ok, true);
  assert.equal(sealed.status, "RESOLVED");
  assert.equal(writes.length, 1);
  const after = snapshot(sealed.root);
  assert.equal(after.rootRevision, before.rootRevision + 1);
  assert.equal(after.matchVersion, before.matchVersion + 1);
  assert.equal(after.hand, before.hand - 1);
  assert.equal(after.inventory, before.inventory - 1);
  assert.equal(after.reservation, before.reservation - 1);
  assert.equal(after.actionReceipts, before.actionReceipts + 1);
  assert.equal(after.consumptionReceipts, before.consumptionReceipts + 1);
  assert.deepEqual(after.rng, before.rng);
  assert.equal(after.active, "B");
  assert.equal(after.phase, "WORK");
  assert.equal(after.logLength, before.logLength + 1);
  assert.equal(sealed.root.activeMatch.state.publicEffects.A.seals.red, 1);
  assert.equal(sealed.root.activeMatch.state.privateEffects.B.curseBacklash, 1);
  assert.equal(JSON.stringify(sealed.publicState).includes("curseBacklash"), false);
  let current = reloadCheckpoint(sealed.root); // checkpoint 1

  const duplicateWrites = [];
  const duplicate = transaction.dispatchStandardMatchAction({
    root: current,
    expectedRootRevision: before.rootRevision,
    expectedMatchVersion: before.matchVersion,
    matchId: current.activeMatch.state.matchId,
    actorSeat: "B",
    action: { id: "disrupt-use", type: "USE_SKILL", payload: { skill: "disruptChoiceOne", color: "red" } },
    storageAdapter: { setItem(key, value) { duplicateWrites.push([key, value]); } },
  });
  assert.equal(duplicate.code, "IDEMPOTENT_REPLAY");
  assert.equal(duplicateWrites.length, 0);
  assert.equal(duplicate.root, current);

  const createdForA = dispatch(current, "B", "disrupt-create-2", "CREATE_REGION", { sourceMacros: [26] });
  assert.equal(createdForA.ok, true);
  assert.equal(createdForA.root.activeMatch.state.active, "A");
  assert.equal(createdForA.root.activeMatch.state.phase, "COLOR");
  assert.equal(createdForA.root.activeMatch.state.publicEffects.A.seals.red, 1);
  current = reloadCheckpoint(createdForA.root); // checkpoint 2

  const coloredByA = dispatch(current, "A", "disrupt-color-2", "COLOR_REGION", { color: "blue" });
  assert.equal(coloredByA.ok, true);
  assert.equal(coloredByA.root.activeMatch.state.publicEffects.A.seals.red, 0);
  assert.equal(coloredByA.root.activeMatch.state.privateEffects.B.curseBacklash, 1);
  current = reloadCheckpoint(coloredByA.root); // checkpoint 3

  const rngBeforeBacklash = structuredClone(current.activeMatch.rngSnapshot);
  const createdForB = dispatch(current, "A", "disrupt-create-3", "CREATE_REGION", { sourceMacros: [25, 37] });
  assert.equal(createdForB.ok, true);
  assert.equal(createdForB.root.activeMatch.state.active, "B");
  assert.equal(createdForB.root.activeMatch.state.phase, "COLOR");
  assert.equal(createdForB.root.activeMatch.state.privateEffects.B.curseBacklash, undefined);
  const sealedColors = Object.entries(createdForB.root.activeMatch.state.publicEffects.B.seals)
    .filter(([, count]) => count > 0).map(([color]) => color);
  assert.deepEqual(sealedColors, ["yellow"]);
  for (const name of match.REQUIRED_RNG_STREAMS) {
    assert.equal(createdForB.root.activeMatch.rngSnapshot[name] === rngBeforeBacklash[name], name !== "skill-effect", name);
  }
  const oneDraw = engine.createRngDomainsFromSnapshot(rngBeforeBacklash, match.REQUIRED_RNG_STREAMS);
  oneDraw["skill-effect"].next();
  assert.equal(createdForB.root.activeMatch.rngSnapshot["skill-effect"], oneDraw["skill-effect"].snapshot());
  current = reloadCheckpoint(createdForB.root); // checkpoint 4

  const coloredByB = dispatch(current, "B", "disrupt-color-3", "COLOR_REGION", { color: "red" });
  assert.equal(coloredByB.ok, true);
  assert.equal(coloredByB.root.activeMatch.state.publicEffects.B.seals.yellow, 0);
  assert.equal(coloredByB.root.activeMatch.state.privateEffects.B.curseBacklash, undefined);
});

test("disruptChoiceOne legal miss has the same public result and transaction shape", () => {
  const hitRoot = preDisruptRoot();
  assert.equal([...hitRoot.activeMatch.state.basicPalettes.A, hitRoot.activeMatch.state.bonusColors.A].includes("yellow"), false);
  const hit = dispatch(hitRoot, "B", "disrupt-hit", "USE_SKILL", { skill: "disruptChoiceOne", color: "red" });
  const miss = dispatch(preDisruptRoot(), "B", "disrupt-miss", "USE_SKILL", { skill: "disruptChoiceOne", color: "yellow" });
  assert.equal(hit.ok, true);
  assert.equal(miss.ok, true);
  assert.equal(hit.status, miss.status);
  assert.equal(hit.code, miss.code);
  assert.deepEqual(Object.keys(hit.publicState).sort(), Object.keys(miss.publicState).sort());
  assert.equal(hit.rootRevision, miss.rootRevision);
  assert.equal(hit.matchVersion, miss.matchVersion);
  assert.equal(hit.root.activeMatch.state.hands.B.disruptChoiceOne, miss.root.activeMatch.state.hands.B.disruptChoiceOne);
  assert.deepEqual(hit.root.activeMatch.rngSnapshot, miss.root.activeMatch.rngSnapshot);
  assert.equal(hit.root.activeMatch.state.publicLog.at(-1).replace("red", "COLOR"), miss.root.activeMatch.state.publicLog.at(-1).replace("yellow", "COLOR"));
  assert.equal(miss.root.activeMatch.state.publicEffects.A.seals.yellow, 1);
  assert.equal(JSON.stringify(miss.publicState).includes("bonusColors"), false);
  assert.equal(JSON.stringify(miss.publicState).includes("basicPalettes"), false);
});

test("colorPrism cannot bypass a seal and a sealed bonus color is not consumed", () => {
  let root = preDisruptRoot();
  const sealedRed = dispatch(root, "B", "disrupt-prism-seal", "USE_SKILL", { skill: "disruptChoiceOne", color: "red" });
  assert.equal(sealedRed.ok, true);
  const createdForA = dispatch(sealedRed.root, "B", "disrupt-prism-create", "CREATE_REGION", { sourceMacros: [26] });
  assert.equal(createdForA.ok, true);
  const prism = dispatch(createdForA.root, "A", "disrupt-prism-use", "USE_SKILL", { skill: "colorPrism" });
  assert.equal(prism.ok, true);
  assert.equal(prism.root.activeMatch.state.privateEffects.A.prism, true);
  assert.equal(prism.root.activeMatch.state.publicEffects.A.seals.red, 1);
  const unavailableWrites = [];
  const unavailable = dispatch(prism.root, "A", "disrupt-prism-red", "COLOR_REGION", { color: "red" }, unavailableWrites);
  assert.equal(unavailable.code, "COLOR_UNAVAILABLE");
  assert.equal(unavailable.root, prism.root);
  assert.equal(unavailableWrites.length, 0);
  const blue = dispatch(prism.root, "A", "disrupt-prism-blue", "COLOR_REGION", { color: "blue" });
  assert.equal(blue.ok, true);
  assert.equal(blue.root.activeMatch.state.privateEffects.A.prism, undefined);

  root = preDisruptRoot();
  assert.equal(root.activeMatch.state.bonusColors.A, "green");
  const bonusBefore = root.activeMatch.state.bonusUsesRemaining.A;
  const sealedBonus = dispatch(root, "B", "disrupt-bonus-seal", "USE_SKILL", { skill: "disruptChoiceOne", color: "green" });
  const bonusColorPhase = dispatch(sealedBonus.root, "B", "disrupt-bonus-create", "CREATE_REGION", { sourceMacros: [26] });
  assert.equal(bonusColorPhase.ok, true);
  const bonusWrites = [];
  const blockedBonus = dispatch(bonusColorPhase.root, "A", "disrupt-bonus-green", "COLOR_REGION", { color: "green" }, bonusWrites);
  assert.equal(blockedBonus.code, "COLOR_UNAVAILABLE");
  assert.equal(blockedBonus.root, bonusColorPhase.root);
  assert.equal(bonusWrites.length, 0);
  assert.equal(blockedBonus.root.activeMatch.state.bonusUsesRemaining.A, bonusBefore);
  const legal = dispatch(blockedBonus.root, "A", "disrupt-bonus-blue", "COLOR_REGION", { color: "blue" });
  assert.equal(legal.ok, true);
  assert.equal(legal.root.activeMatch.state.bonusUsesRemaining.A, bonusBefore);
  assert.equal(legal.root.activeMatch.state.publicEffects.A.seals.green, 0);
});

test("disruptChoiceOne stale and persistence failures are byte-stable, and zero-candidate backlash draws nothing", () => {
  const root = preDisruptRoot();
  const before = snapshot(root);
  for (const [field, code] of [["expectedRootRevision", "STALE_ROOT_REVISION"], ["expectedMatchVersion", "STALE_MATCH_VERSION"]]) {
    const writes = [];
    const args = {
      root,
      expectedRootRevision: root.rootRevision,
      expectedMatchVersion: root.activeMatch.state.version,
      matchId: root.activeMatch.state.matchId,
      actorSeat: "B",
      action: { id: `disrupt-${field}`, type: "USE_SKILL", payload: { skill: "disruptChoiceOne", color: "red" } },
      storageAdapter: { setItem(key, value) { writes.push([key, value]); } },
    };
    args[field] += 1;
    const result = transaction.dispatchStandardMatchAction(args);
    assert.equal(result.code, code);
    assert.equal(result.root, root);
    assert.equal(writes.length, 0);
    assert.deepEqual(snapshot(root), before);
  }
  const failed = transaction.dispatchStandardMatchAction({
    root,
    expectedRootRevision: root.rootRevision,
    expectedMatchVersion: root.activeMatch.state.version,
    matchId: root.activeMatch.state.matchId,
    actorSeat: "B",
    action: { id: "disrupt-persist-fail", type: "USE_SKILL", payload: { skill: "disruptChoiceOne", color: "red" } },
    storageAdapter: { setItem() { throw new Error("quota"); } },
  });
  assert.equal(failed.code, "PERSISTENCE_FAILED");
  assert.equal(failed.root, root);
  assert.deepEqual(snapshot(root), before);

  const zero = structuredClone(root);
  zero.activeMatch.state.privateEffects.A.curseBacklash = 1;
  zero.activeMatch.state.publicEffects.A.seals = { red: 1, blue: 1, yellow: 1, green: 1 };
  save.validateStandardSave(zero);
  const rngBefore = structuredClone(zero.activeMatch.rngSnapshot);
  const created = dispatch(zero, "B", "disrupt-zero-candidate", "CREATE_REGION", { sourceMacros: [26] });
  assert.equal(created.ok, true);
  assert.deepEqual(created.root.activeMatch.rngSnapshot, rngBefore);
  assert.equal(created.root.activeMatch.state.privateEffects.A.curseBacklash, undefined);
  assert.deepEqual(created.root.activeMatch.state.publicEffects.A.seals, { red: 1, blue: 1, yellow: 1, green: 1 });
});
