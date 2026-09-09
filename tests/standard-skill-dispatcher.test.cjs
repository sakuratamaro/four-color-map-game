"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { COLORS, createRngDomains } = require("../standard/standard-engine.js");
const match = require("../standard/standard-match.js");
const save = require("../standard/standard-save.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("../standard/standard-skill-registry.js");
const { SKILL_RESULT, cancelStandardSkillSelection, dispatchStandardSkillAction } = require("../standard/standard-skill-dispatcher.js");
const { dispatchStandardSkillTransaction, snapshotRngStreams } = require("../standard/standard-skill-transaction.js");

function streams(seed = 1200) {
  return createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
}

function workState(seed = 1200, blocked = false) {
  const state = match.createStandardMatch({
    matchId: `skill-match-${seed}`,
    firstSeat: "A",
    loadouts: { A: { experimental: ["legalRecolor"] }, B: { experimental: ["legalRecolor"] } },
  }, streams(seed));
  state.phase = "WORK";
  state.regions = {
    R1: { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: "red", isPending: false },
    R2: { id: "R2", micro: [48], sourceMacros: [], controllers: ["B"], color: "blue", isPending: false },
  };
  if (blocked) {
    state.regions.R3 = { id: "R3", micro: [50], sourceMacros: [], controllers: ["B"], color: "yellow", isPending: false };
    state.regions.R4 = { id: "R4", micro: [1], sourceMacros: [], controllers: ["B"], color: "green", isPending: false };
  }
  return state;
}

function dispatch(state, action, rngStreams = streams(1300)) {
  return dispatchStandardSkillAction({
    state,
    actor: "A",
    action,
    expectedVersion: state.version,
    rngStreams,
    validateState: match.validateStandardState,
    projectPublic: match.projectStandardPublicState,
    projectPrivate: match.projectStandardPrivateState,
  });
}

test("registry fixes 19 v4.9 cards plus two separately identified experimental cards", () => {
  assert.equal(V49_SKILL_IDS.length, 19);
  assert.equal(Object.keys(STANDARD_SKILLS).length, 21);
  const required = ["id", "displayName", "category", "usageCategory", "rarity", "timing", "targetSchema", "implemented", "alphaUiEnabled", "standardUiEnabled", "gachaEnabled", "experimental", "privateInformationEffect", "rngStream", "expectedRngDraws", "consumptionPolicy", "handlerVersion"];
  for (const definition of Object.values(STANDARD_SKILLS)) for (const key of required) assert.equal(Object.hasOwn(definition, key), true, `${definition.id}.${key}`);
  for (const id of V49_SKILL_IDS) assert.equal(STANDARD_SKILLS[id].standardUiEnabled, true, `${id}.standardUiEnabled`);
  assert.equal(STANDARD_SKILLS.legalRecolor.implemented, true);
  assert.equal(STANDARD_SKILLS.legalRecolor.standardUiEnabled, false);
  assert.equal(STANDARD_SKILLS.legalRecolor.gachaEnabled, false);
  assert.equal(STANDARD_SKILLS.legalRecolor.experimental, true);
  assert.equal(STANDARD_SKILLS.colorBonusRefill.usageCategory, "color");
  assert.equal(STANDARD_SKILLS.colorBonusRefill.gachaEnabled, false);
});

test("bonus color refill adds two uses up to four and a full meter rejects atomically", () => {
  const state = workState(1188);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.hands.A.colorBonusRefill = 3;
  state.bonusUsesRemaining.A = 1;
  const first = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorBonusRefill" } });
  assert.deepEqual([first.ok, first.state.bonusUsesRemaining.A, first.state.hands.A.colorBonusRefill, first.cardConsumed], [true, 3, 2, true]);
  const secondState = JSON.parse(JSON.stringify(first.state));
  secondState.skillCategoryWindow.categories = [];
  const second = dispatch(secondState, { type: "USE_SKILL", payload: { skill: "colorBonusRefill" } });
  assert.equal(second.state.bonusUsesRemaining.A, 4);
  const fullState = JSON.parse(JSON.stringify(second.state));
  fullState.skillCategoryWindow.categories = [];
  const before = JSON.stringify(fullState);
  const rejected = dispatch(fullState, { type: "USE_SKILL", payload: { skill: "colorBonusRefill" } });
  assert.deepEqual([rejected.ok, rejected.code, JSON.stringify(fullState)], [false, "BONUS_USES_ALREADY_FULL", before]);
});

test("alpha.3 and alpha.4 limit each usage category to once per same-seat control window", () => {
  for (const [index, engineVersion] of [match.CATEGORY_WINDOW_ENGINE_VERSION, match.ENGINE_VERSION].entries()) {
    const state = workState(1189 + index);
    state.engineVersion = engineVersion;
    state.phase = "COLOR";
    state.pending = "R1";
    state.regions.R1.color = null;
    state.regions.R1.isPending = true;
    state.hands.A.colorPrism = 1;
    state.hands.A.colorBonusRefill = 1;
    state.bonusUsesRemaining.A = 1;
    const prism = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPrism" } });
    assert.deepEqual(prism.state.skillCategoryWindow, { actor: "A", categories: ["color"] }, engineVersion);
    const snapshot = JSON.stringify(prism.state);
    const blocked = dispatch(prism.state, { type: "USE_SKILL", payload: { skill: "colorBonusRefill" } });
    assert.deepEqual([blocked.ok, blocked.code, JSON.stringify(blocked.state)], [false, "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW", snapshot], engineVersion);

    const work = workState(1191 + index);
    work.engineVersion = engineVersion;
    work.skillCategoryWindow.categories = ["area"];
    work.hands.A.disruptChoiceOne = 1;
    const distinct = dispatch(work, { type: "USE_SKILL", payload: { skill: "disruptChoiceOne", color: "red" } });
    assert.deepEqual(distinct.state.skillCategoryWindow, { actor: "A", categories: ["area", "disrupt"] }, engineVersion);
  }
});

test("accepted palette-injection miss advances RNG, version, and category without consuming its card", () => {
  const state = workState(1191);
  state.hands.A.disruptPaletteChoice = 1;
  state.hands.A.disruptChoiceOne = 1;
  state.basicPalettes.B = ["red", "red"];
  state.bonusColors.B = "red";
  const privateBefore = JSON.stringify(state.privateEffects.B);
  const rng = streams(1291);
  const rngBefore = snapshotRngStreams(rng);
  const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color: "red" } }, rng);
  assert.deepEqual([result.ok, result.noOp, result.cardConsumed, result.rngDraws], [true, true, false, 1]);
  assert.deepEqual([result.state.version, result.state.skillsUsed.A, result.state.hands.A.disruptPaletteChoice], [state.version + 1, state.skillsUsed.A + 1, 1]);
  assert.deepEqual(result.state.skillCategoryWindow, { actor: "A", categories: ["disrupt"] });
  assert.equal(JSON.stringify(result.state.privateEffects.B), privateBefore);
  assert.notDeepEqual(snapshotRngStreams(rng), rngBefore);
  const afterMissRng = snapshotRngStreams(rng);
  const blocked = dispatch(result.state, { type: "USE_SKILL", payload: { skill: "disruptChoiceOne", color: "blue" } }, rng);
  assert.equal(blocked.code, "SKILL_CATEGORY_ALREADY_USED_IN_WINDOW");
  assert.deepEqual(snapshotRngStreams(rng), afterMissRng);
});

test("alpha.1 and alpha.2 retain the accepted all-same palette injection with card consumption", () => {
  for (const [index, engineVersion] of [match.LEGACY_ENGINE_VERSION, match.PREVIOUS_ENGINE_VERSION].entries()) {
    const state = workState(1170 + index);
    state.engineVersion = engineVersion;
    delete state.skillCategoryWindow;
    state.hands.A.disruptPaletteChoice = 1;
    state.basicPalettes.B = ["green", "green"];
    state.bonusColors.B = "green";
    const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "disruptPaletteChoice", color: "green" } }, streams(1270 + index));
    assert.deepEqual([result.ok, result.cardConsumed, result.state.hands.A.disruptPaletteChoice, result.rngDraws], [true, true, 0, 1], engineVersion);
    assert.equal(result.state.engineVersion, engineVersion);
    assert.equal(result.state.skillCategoryWindow, undefined);
  }
});

test("alpha.1 and alpha.2 can resolve two color-category cards in one continuous control window", () => {
  for (const [index, engineVersion] of [match.LEGACY_ENGINE_VERSION, match.PREVIOUS_ENGINE_VERSION].entries()) {
    const state = workState(1175 + index);
    state.engineVersion = engineVersion;
    delete state.skillCategoryWindow;
    state.phase = "COLOR";
    state.pending = "R1";
    state.regions.R1.color = null;
    state.regions.R1.isPending = true;
    state.hands.A.colorPrism = 1;
    state.hands.A.colorBonusRefill = 1;
    state.bonusUsesRemaining.A = 1;
    const prism = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPrism" } }, streams(1275 + index));
    assert.equal(prism.ok, true, engineVersion);
    const refill = dispatch(prism.state, { type: "USE_SKILL", payload: { skill: "colorBonusRefill" } }, streams(1285 + index));
    assert.deepEqual([refill.ok, refill.state.bonusUsesRemaining.A, refill.state.skillCategoryWindow], [true, 3, undefined], engineVersion);
  }
});

test("dispatcher distinguishes rejected, cancelled, and resolved without exposing authoritative state", () => {
  const state = workState(1201);
  const unimplemented = dispatch(state, { type: "USE_SKILL", payload: { skill: "unknownFutureSkill", color: "red" } });
  assert.equal(unimplemented.status, SKILL_RESULT.REJECTED);
  assert.equal(unimplemented.code, "UNKNOWN_SKILL");
  assert.equal(unimplemented.state, state);

  const cancelled = cancelStandardSkillSelection();
  assert.equal(cancelled.status, SKILL_RESULT.CANCELLED);
  assert.equal(cancelled.dispatched, false);
  assert.equal(cancelled.actionIdIssued, false);

  state.privateEffects.B.secretToken = "OPPONENT-SECRET";
  const resolved = dispatch(state, { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } });
  assert.equal(resolved.status, SKILL_RESULT.RESOLVED);
  assert.equal(resolved.rngDraws, 1);
  assert.equal(JSON.stringify(resolved.publicState).includes("OPPONENT-SECRET"), false);
  assert.equal(JSON.stringify(resolved.privateState).includes("OPPONENT-SECRET"), false);
});

test("representative v4.9 handlers are registered behind the common dispatcher", () => {
  for (const id of ["colorRandomBorrow", "colorChoiceBorrow", "colorPaletteChange", "colorRegionSplit", "colorPrism", "colorBonusRefill", "areaMicroBloom", "areaDiePlus", "areaResize", "areaCornerBloom", "areaHalfShift", "areaTripleShift", "disruptRandomOne", "disruptChoiceOne", "disruptRandomTwo", "disruptPaletteRandom", "disruptChoiceTwo", "disruptPaletteChoice", "disruptChoiceThree", "disruptForcedPalette", "legalRecolor"]) {
    assert.equal(STANDARD_SKILLS[id].implemented, true, id);
    assert.equal(typeof STANDARD_SKILLS[id].handlerVersion, "string", id);
  }
});

test("palette change replaces one private basic slot, allows duplicates, and consumes once without RNG", () => {
  const state = workState(1196);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.hands.A.colorPaletteChange = 1;
  const replacement = state.basicPalettes.A[1];
  const bonusBefore = state.bonusColors.A;
  const rng = streams(1296);
  const beforeRng = snapshotRngStreams(rng);
  const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: 0, color: replacement } }, rng);
  assert.equal(result.status, SKILL_RESULT.RESOLVED);
  assert.equal(result.rngDraws, 0);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.colorPaletteChange, 0);
  assert.deepEqual(result.state.basicPalettes.A, [replacement, replacement]);
  assert.equal(result.state.bonusColors.A, bonusBefore);
  assert.deepEqual(result.state.initialPalettes.A, state.initialPalettes.A);
  assert.equal(result.publicState.basicPalettes, undefined);
  assert.equal(result.publicState.initialPalettes, undefined);
  assert.deepEqual(result.privateState.basicPalette, [replacement, replacement]);
  assert.deepEqual(result.privateState.privateEffects.paletteImpactEvent, {
    eventId: `${state.matchId}:${result.state.version}:palette-impact:A`, version: result.state.version,
    actor: "A", skill: "colorPaletteChange", kind: "self", slot: 0,
    previousColor: state.basicPalettes.A[0], injectedColor: replacement, remaining: 0,
  });
  assert.deepEqual(result.privateState.privateEffects.paletteImpactHistory, [result.privateState.privateEffects.paletteImpactEvent]);
  assert.equal(result.state.publicLog.at(-1).includes(replacement), false);
  assert.deepEqual(snapshotRngStreams(rng), beforeRng);
});

test("palette change rejects malformed slots, invalid colors, and unchanged colors atomically", () => {
  const state = workState(1195);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.hands.A.colorPaletteChange = 1;
  const beforeState = JSON.stringify(state);
  const rng = streams(1295);
  const beforeRng = snapshotRngStreams(rng);
  for (const payload of [
    { slot: -1, color: "red" },
    { slot: 3, color: "red" },
    { slot: 0.5, color: "red" },
    { slot: 0, color: "purple" },
  ]) {
    const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPaletteChange", ...payload } }, rng);
    assert.equal(result.code, "INVALID_TARGET_SCHEMA");
  }
  const unchanged = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: 2, color: state.bonusColors.A } }, rng);
  assert.equal(unchanged.code, "PALETTE_COLOR_UNCHANGED");
  assert.equal(unchanged.state, state);
  assert.equal(JSON.stringify(state), beforeState);
  assert.deepEqual(snapshotRngStreams(rng), beforeRng);
});

test("palette change keeps bonus uses on slot 2 and consumes the renamed limited color normally", () => {
  const state = workState(1194);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.regions.R2.micro = [0];
  state.hands.A.colorPaletteChange = 1;
  const replacement = COLORS.find((color) => ![...state.basicPalettes.A, state.bonusColors.A].includes(color));
  const usesBefore = state.bonusUsesRemaining.A;
  const changed = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: 2, color: replacement } });
  assert.equal(changed.state.bonusColors.A, replacement);
  assert.equal(changed.state.bonusUsesRemaining.A, usesBefore);
  const colored = match.applyStandardAction({
    state: changed.state, actor: "A", action: { type: "COLOR_REGION", payload: { color: replacement } },
    expectedVersion: changed.state.version, rngStreams: streams(1294),
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.bonusUsesRemaining.A, usesBefore - 1);
});

test("a bonus slot changed to a duplicate basic color remains unlimited while seals still apply by color", () => {
  const state = workState(1193);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.regions.R2.micro = [0];
  state.hands.A.colorPaletteChange = 1;
  const replacement = state.basicPalettes.A[0];
  const usesBefore = state.bonusUsesRemaining.A;
  const changed = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: 2, color: replacement } });
  const colored = match.applyStandardAction({
    state: changed.state, actor: "A", action: { type: "COLOR_REGION", payload: { color: replacement } },
    expectedVersion: changed.state.version, rngStreams: streams(1293),
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.bonusUsesRemaining.A, usesBefore);

  const sealedState = workState(1183);
  sealedState.phase = "COLOR";
  sealedState.pending = "R1";
  sealedState.regions.R1.color = null;
  sealedState.regions.R1.isPending = true;
  sealedState.hands.A.colorPaletteChange = 1;
  const sealedColor = COLORS.find((color) => color !== sealedState.basicPalettes.A[0]);
  sealedState.publicEffects.A.seals[sealedColor] = 1;
  sealedState.privateEffects.A.curseBacklash = 1;
  const sealedChange = dispatch(sealedState, { type: "USE_SKILL", payload: { skill: "colorPaletteChange", slot: 0, color: sealedColor } });
  assert.equal(sealedChange.state.privateEffects.A.curseBacklash, 1);
  const unavailable = match.applyStandardAction({
    state: sealedChange.state, actor: "A", action: { type: "COLOR_REGION", payload: { color: sealedColor } },
    expectedVersion: sealedChange.state.version, rngStreams: streams(1283),
  });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.code, "COLOR_UNAVAILABLE");
});

test("chosen color borrow accepts only a board-used color, consumes once, and uses no RNG", () => {
  const state = workState(1199);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.hands.A.colorChoiceBorrow = 1;
  const chosen = state.regions.R2.color;
  const rng = streams(1299);
  const beforeRng = snapshotRngStreams(rng);
  const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorChoiceBorrow", color: chosen } }, rng);
  assert.equal(result.status, SKILL_RESULT.RESOLVED);
  assert.equal(result.rngDraws, 0);
  assert.equal(result.state.version, state.version + 1);
  assert.equal(result.state.hands.A.colorChoiceBorrow, 0);
  assert.equal(result.state.skillsUsed.A, state.skillsUsed.A + 1);
  assert.deepEqual(result.state.privateEffects.A.temporaryColors, [chosen]);
  assert.equal(result.publicState.privateEffects, undefined);
  assert.equal(result.state.publicLog.at(-1).includes(chosen), false);
  assert.deepEqual(snapshotRngStreams(rng), beforeRng);
});

test("chosen color borrow rejects malformed and board-unused colors without consuming anything", () => {
  const state = workState(1198);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.hands.A.colorChoiceBorrow = 1;
  const unused = COLORS.find((color) => !Object.values(state.regions).some((region) => region.color === color));
  const rng = streams(1298);
  const beforeState = JSON.stringify(state);
  const beforeRng = snapshotRngStreams(rng);
  const malformed = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorChoiceBorrow", color: "purple" } }, rng);
  assert.equal(malformed.code, "INVALID_TARGET_SCHEMA");
  const forged = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorChoiceBorrow", color: unused } }, rng);
  assert.equal(forged.code, "COLOR_NOT_USED_ON_BOARD");
  assert.equal(forged.state, state);
  assert.equal(JSON.stringify(state), beforeState);
  assert.deepEqual(snapshotRngStreams(rng), beforeRng);
});

test("chosen color borrow uses the shared one-color-attempt cleanup boundary", () => {
  const state = workState(1197);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.regions.R2.micro = [0];
  state.hands.A.colorChoiceBorrow = 1;
  const chosen = state.regions.R2.color;
  const borrowed = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorChoiceBorrow", color: chosen } });
  const colored = match.applyStandardAction({
    state: borrowed.state, actor: "A", action: { type: "COLOR_REGION", payload: { color: chosen } },
    expectedVersion: borrowed.state.version, rngStreams: streams(1297),
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.privateEffects.A.temporaryColors, undefined);
});

test("random color borrow draws once from board-used colors and keeps the result seat-private", () => {
  const state = workState(1209);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  const borrowed = COLORS.find((color) => ![...state.basicPalettes.A, state.bonusColors.A].includes(color));
  state.regions.R2.color = borrowed;
  state.hands.A.colorRandomBorrow = 1;
  let draws = 0;
  const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorRandomBorrow" } }, {
    "skill-effect": () => { draws += 1; return 0; },
  });
  assert.equal(result.status, SKILL_RESULT.RESOLVED);
  assert.equal(result.rngDraws, 1);
  assert.equal(draws, 1);
  assert.equal(result.state.hands.A.colorRandomBorrow, 0);
  assert.equal(result.state.skillsUsed.A, state.skillsUsed.A + 1);
  assert.deepEqual(result.state.privateEffects.A.temporaryColors, [borrowed]);
  assert.equal(result.publicState.privateEffects, undefined);
  assert.equal(JSON.stringify(result.privateState).includes(borrowed), true);
  assert.equal(result.state.publicLog.at(-1).includes(borrowed), false);
});

test("random color borrow rejects an empty board without state, card, version, or RNG consumption", () => {
  const state = workState(1208);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions = {
    R1: { id: "R1", micro: [49], sourceMacros: [], controllers: ["A"], color: null, isPending: true },
  };
  state.hands.A.colorRandomBorrow = 1;
  const rng = streams(1308);
  const beforeState = JSON.stringify(state);
  const beforeRng = snapshotRngStreams(rng);
  const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorRandomBorrow" } }, rng);
  assert.equal(result.status, SKILL_RESULT.REJECTED);
  assert.equal(result.code, "NO_BOARD_COLORS");
  assert.equal(result.state, state);
  assert.equal(JSON.stringify(state), beforeState);
  assert.deepEqual(snapshotRngStreams(rng), beforeRng);
});

test("random color borrow rejects wrong phase, wrong seat, and an unavailable card before RNG", () => {
  const base = workState(1207);
  base.hands.A.colorRandomBorrow = 1;
  const action = { type: "USE_SKILL", payload: { skill: "colorRandomBorrow" } };
  let draws = 0;
  const rngStreams = { "skill-effect": () => { draws += 1; return 0; } };
  const wrongPhase = dispatch(base, action, rngStreams);
  assert.equal(wrongPhase.code, "WRONG_PHASE");
  const wrongSeat = dispatchStandardSkillAction({
    state: { ...base, phase: "COLOR", active: "B", skillCategoryWindow: { actor: "B", categories: [] } }, actor: "A", action, expectedVersion: base.version, rngStreams,
    validateState: match.validateStandardState, projectPublic: match.projectStandardPublicState, projectPrivate: match.projectStandardPrivateState,
  });
  assert.equal(wrongSeat.code, "NOT_YOUR_TURN");
  const unavailableState = { ...base, phase: "COLOR", hands: { ...base.hands, A: { ...base.hands.A, colorRandomBorrow: 0 } } };
  const unavailable = dispatch(unavailableState, action, rngStreams);
  assert.equal(unavailable.code, "SKILL_UNAVAILABLE");
  assert.equal(draws, 0);
});

test("random color borrow clears after successful coloring and the illegal-color terminal path", () => {
  for (const illegal of [false, true]) {
    const state = workState(illegal ? 1206 : 1205);
    state.phase = "COLOR";
    state.pending = "R1";
    state.regions.R1.color = null;
    state.regions.R1.isPending = true;
    const borrowed = COLORS.find((color) => ![...state.basicPalettes.A, state.bonusColors.A].includes(color));
    state.regions.R2.color = borrowed;
    if (!illegal) state.regions.R2.micro = [0];
    state.hands.A.colorRandomBorrow = 1;
    const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorRandomBorrow" } }, { "skill-effect": () => 0 });
    const colored = match.applyStandardAction({
      state: result.state, actor: "A", action: { type: "COLOR_REGION", payload: { color: borrowed } },
      expectedVersion: result.state.version, rngStreams: streams(illegal ? 1306 : 1305),
    });
    assert.equal(colored.ok, true);
    assert.equal(colored.state.privateEffects.A.temporaryColors, undefined);
    assert.equal(colored.code, illegal ? "ILLEGAL_COLOR" : "OK");
  }
});

test("a borrowed exhausted bonus color is usable once without consuming a bonus charge", () => {
  const state = workState(1204);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.regions.R2.color = state.bonusColors.A;
  state.regions.R2.micro = [0];
  state.bonusUsesRemaining.A = 0;
  state.hands.A.colorRandomBorrow = 1;
  const borrowed = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorRandomBorrow" } }, { "skill-effect": () => 0 });
  const colored = match.applyStandardAction({
    state: borrowed.state, actor: "A", action: { type: "COLOR_REGION", payload: { color: state.bonusColors.A } },
    expectedVersion: borrowed.state.version, rngStreams: streams(1304),
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.bonusUsesRemaining.A, 0);
  assert.equal(colored.state.privateEffects.A.temporaryColors, undefined);
});

test("color prism resolves privately, enables all colors, and clears after coloring", () => {
  const state = workState(1210);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.hands.A.colorPrism = 1;
  const prism = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPrism" } });
  assert.equal(prism.status, SKILL_RESULT.RESOLVED);
  assert.equal(prism.state.hands.A.colorPrism, 0);
  assert.equal(prism.state.privateEffects.A.prism, true);
  assert.equal(prism.publicState.privateEffects, undefined);
  const outsidePalette = ["red", "blue", "yellow", "green"].find((color) => ![...prism.state.basicPalettes.A, prism.state.bonusColors.A].includes(color));
  const colored = match.applyStandardAction({
    state: prism.state,
    actor: "A",
    action: { type: "COLOR_REGION", payload: { color: outsidePalette } },
    expectedVersion: prism.state.version,
    rngStreams: streams(1310),
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.regions.R1.color, outsidePalette);
  assert.equal(colored.state.privateEffects.A.prism, undefined);
});

test("color prism also clears on the v4.9 illegal-color terminal path", () => {
  const state = workState(1215);
  state.phase = "COLOR";
  state.pending = "R1";
  state.regions.R1.color = null;
  state.regions.R1.isPending = true;
  state.hands.A.colorPrism = 1;
  const prism = dispatch(state, { type: "USE_SKILL", payload: { skill: "colorPrism" } });
  const illegal = match.applyStandardAction({
    state: prism.state,
    actor: "A",
    action: { type: "COLOR_REGION", payload: { color: "blue" } },
    expectedVersion: prism.state.version,
    rngStreams: streams(1315),
  });
  assert.equal(illegal.code, "ILLEGAL_COLOR");
  assert.equal(illegal.state.privateEffects.A.prism, undefined);
});

test("half shift moves one macro band and splits disconnected geometry into separate regions", () => {
  const state = workState(1211);
  state.hands.A.areaHalfShift = 1;
  state.regions = {
    R1: { id: "R1", micro: [196, 197, 244, 245], sourceMacros: [13], controllers: ["A"], color: "red", isPending: false },
  };
  const shifted = dispatch(state, { type: "USE_SKILL", payload: { skill: "areaHalfShift", axis: "COLUMN", index: 1, direction: "plus" } });
  assert.equal(shifted.status, SKILL_RESULT.RESOLVED);
  assert.deepEqual(shifted.state.regions.R1.micro, [292, 293, 340, 341]);
  assert.equal(shifted.movedCount, 4);
  assert.equal(shifted.state.hands.A.areaHalfShift, 0);

  const broken = workState(1212);
  broken.hands.A.areaHalfShift = 1;
  broken.regions = {
    R1: { id: "R1", micro: [3, 4], sourceMacros: [0, 1], controllers: ["A"], color: "red", isPending: false },
  };
  const split = dispatch(broken, { type: "USE_SKILL", payload: { skill: "areaHalfShift", axis: "COLUMN", index: 1, direction: "plus" } });
  assert.equal(split.status, SKILL_RESULT.RESOLVED);
  assert.equal(split.splitCount, 1);
  assert.deepEqual(split.state.regions.R1.micro, [3]);
  assert.deepEqual(split.state.regions.R2.micro, [100]);
  assert.equal(split.state.regions.R1.color, "red");
  assert.equal(split.state.regions.R2.color, "red");
  assert.deepEqual(split.state.regions.R2.controllers, ["A"]);
  assert.equal(split.state.hands.A.areaHalfShift, 0);
});

test("chosen seal is public while curse backlash remains seat-private until next COLOR", () => {
  const state = workState(1213);
  state.hands.A.disruptChoiceOne = 1;
  const sealed = dispatch(state, { type: "USE_SKILL", payload: { skill: "disruptChoiceOne", color: "red" } });
  assert.equal(sealed.status, SKILL_RESULT.RESOLVED);
  assert.equal(sealed.state.publicEffects.B.seals.red, 1);
  assert.equal(sealed.state.privateEffects.A.curseBacklash, 1);
  assert.equal(JSON.stringify(sealed.publicState).includes("curseBacklash"), false);
  assert.equal(JSON.stringify(sealed.privateState).includes("curseBacklash"), true);
});

test("curse backlash consumes only skill-effect RNG on the affected next COLOR and one-turn seals expire after coloring", () => {
  const rng = streams(1314);
  const state = match.createStandardMatch({ matchId: "curse-lifecycle", firstSeat: "A" }, rng);
  state.requiredSize = 1;
  state.privateEffects.B.curseBacklash = 1;
  const before = snapshotRngStreams(rng);
  const created = match.applyStandardAction({
    state,
    actor: "A",
    action: { type: "CREATE_REGION", payload: { sourceMacros: [13] } },
    expectedVersion: state.version,
    rngStreams: rng,
  });
  assert.equal(created.ok, true);
  assert.equal(created.state.active, "B");
  assert.equal(created.state.phase, "COLOR");
  assert.equal(created.state.privateEffects.B.curseBacklash, undefined);
  const sealedColors = Object.entries(created.state.publicEffects.B.seals).filter(([, duration]) => duration > 0).map(([color]) => color);
  assert.equal(sealedColors.length, 1);
  const after = snapshotRngStreams(rng);
  for (const name of match.REQUIRED_RNG_STREAMS) assert.equal(after[name] === before[name], name !== "skill-effect", name);

  const usable = [...created.state.basicPalettes.B, created.state.bonusColors.B].find((color) => !sealedColors.includes(color));
  const colored = match.applyStandardAction({
    state: created.state,
    actor: "B",
    action: { type: "COLOR_REGION", payload: { color: usable } },
    expectedVersion: created.state.version,
    rngStreams: rng,
  });
  assert.equal(colored.ok, true);
  assert.equal(colored.state.publicEffects.B.seals[sealedColors[0]], 0);
});

test("no-candidate rejection preserves state and named RNG bytes", () => {
  const state = workState(1202, true);
  const rng = streams(1302);
  const beforeState = JSON.stringify(state);
  const beforeRng = snapshotRngStreams(rng);
  const result = dispatch(state, { type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } }, rng);
  assert.equal(result.status, SKILL_RESULT.REJECTED);
  assert.equal(result.code, "NO_LEGAL_RECOLOR");
  assert.equal(result.state, state);
  assert.equal(JSON.stringify(state), beforeState);
  assert.deepEqual(snapshotRngStreams(rng), beforeRng);
});

test("transaction saves state, inventory, receipt, and cloned RNG once; replay is idempotent", () => {
  const state = workState(1203);
  const rng = streams(1303);
  const beforeRng = snapshotRngStreams(rng);
  const profiles = {
    playerA: save.createProfile({ name: "A", inventory: { legalRecolor: 2 } }),
    playerB: save.createProfile({ name: "B", inventory: { legalRecolor: 1 } }),
  };
  const root = save.createStandardSave({ profiles, activeMatch: { state, rngSnapshot: beforeRng, participants: {
    A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "A" },
    B: { type: "PROFILE", profileId: "playerB", displayNameSnapshot: "B" },
  }, startedAt: "2026-08-30T00:00:00.000Z", finishedAt: null, settlement: { settled: false } }, reservations: { playerA: { legalRecolor: 1 }, playerB: { legalRecolor: 1 } } });
  const writes = [];
  const action = { id: "skill-action-1", expectedVersion: state.version, type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } };
  const committed = dispatchStandardSkillTransaction({ root, actor: "A", action, rngStreams: rng, storage: { setItem(key, value) { writes.push([key, value]); } } });
  assert.equal(committed.ok, true);
  assert.equal(committed.saved, true);
  assert.equal(writes.length, 1);
  assert.equal(committed.root.profiles.playerA.inventory.legalRecolor, 1);
  assert.equal(Object.keys(committed.root.receipts.matchConsumption).length, 1);
  assert.equal(committed.root.rootRevision, root.rootRevision + 1);
  assert.deepEqual(snapshotRngStreams(rng), beforeRng, "caller RNG remains unchanged until it adopts the committed clone");
  assert.notDeepEqual(snapshotRngStreams(committed.rngStreams), beforeRng);

  const replay = dispatchStandardSkillTransaction({ root: committed.root, actor: "A", action, rngStreams: committed.rngStreams, storage: { setItem() { throw new Error("replay must not write"); } } });
  assert.equal(replay.code, "IDEMPOTENT_REPLAY");
  assert.equal(replay.root, committed.root);
  assert.equal(replay.saved, false);

  const collision = dispatchStandardSkillTransaction({ root: committed.root, actor: "A", action: { ...action, payload: { skill: "legalRecolor", regionId: "R2" } }, rngStreams: committed.rngStreams, storage: { setItem() {} } });
  assert.equal(collision.code, "ACTION_ID_COLLISION");
  assert.equal(collision.root, committed.root);
});

test("storage failure leaves caller root and RNG unadvanced", () => {
  const state = workState(1204);
  const rng = streams(1304);
  const beforeRng = snapshotRngStreams(rng);
  const root = save.createStandardSave({
    profiles: {
      playerA: save.createProfile({ name: "A", inventory: { legalRecolor: 1 } }),
      playerB: save.createProfile({ name: "B", inventory: { legalRecolor: 1 } }),
    },
    activeMatch: { state, rngSnapshot: beforeRng, participants: {
      A: { type: "PROFILE", profileId: "playerA", displayNameSnapshot: "A" },
      B: { type: "PROFILE", profileId: "playerB", displayNameSnapshot: "B" },
    }, startedAt: "2026-08-30T00:00:00.000Z", finishedAt: null, settlement: { settled: false } },
    reservations: { playerA: { legalRecolor: 1 }, playerB: { legalRecolor: 1 } },
  });
  assert.throws(() => dispatchStandardSkillTransaction({
    root,
    actor: "A",
    action: { id: "skill-action-fail", expectedVersion: state.version, type: "USE_SKILL", payload: { skill: "legalRecolor", regionId: "R1" } },
    rngStreams: rng,
    storage: { setItem() { throw new Error("quota"); } },
  }), /quota/);
  assert.equal(root.activeMatch.state.version, state.version);
  assert.equal(root.profiles.playerA.inventory.legalRecolor, 1);
  assert.deepEqual(snapshotRngStreams(rng), beforeRng);
});
