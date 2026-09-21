"use strict";

const engine = require("./standard-engine.js");
const match = require("./standard-match.js");
const roster = require("./standard-cpu-roster.js");
const technique = require("./standard-technique-state.js");
const { LEARNED_TECHNIQUE_ENGINE_VERSION } = require("./standard-skill-registry.js");

const TRIAL_ID = "ren-unseal";
const TRIAL_VERSION = 1;
const TRIAL_POLICY_VERSION = "ren-unseal-trial-v1";
const TRIAL_LOADOUT = Object.freeze({
  color: Object.freeze(["colorPrism", "colorRandomBorrow"]),
  area: Object.freeze(["areaDiePlus", "areaResize"]),
  disrupt: Object.freeze(["disruptChoiceOne", "disruptRandomTwo"]),
});
const clone = value => JSON.parse(JSON.stringify(value));
const requireTrial = (ok, code) => { if (!ok) throw new TypeError(code); };

// Read adapter only. Online authority/eligibility must still be checked by SQL.
function projectRenProgression(profile) {
  const record = profile?.cpuCharacterStats?.ren;
  const wins = Number.isSafeInteger(record?.wins) && record.wins >= 0 ? record.wins : 0;
  const matches = Number.isSafeInteger(record?.matches) && record.matches >= 0 ? record.matches : 0;
  const learned = Array.isArray(profile?.learnedTechniques) && profile.learnedTechniques.includes(technique.TECHNIQUE_ID);
  const stage = learned ? "learned" : wins >= 1 ? "trial_unlocked" : matches >= 1 ? "returning" : "first_meeting";
  const lines = {
    learned: "教えた解封、使いこなしてるか？ また試してみようぜ！",
    trial_unlocked: "俺に勝ったな！ 今度は特別な盤面で勝負だ。",
    returning: "また来たな。今度も先に広げてみせるぜ！",
    first_meeting: "せっかちレンだ。先に広げた者勝ちだぜ！",
  };
  return { characterId: "ren", stage, line: lines[stage], trialUnlocked: wins >= 1,
    learnedTechniqueId: learned ? technique.TECHNIQUE_ID : null,
    equippedTechniqueId: learned && profile.equippedTechniqueId === technique.TECHNIQUE_ID ? technique.TECHNIQUE_ID : null };
}

function trialDescriptor() {
  return { trialId: TRIAL_ID, trialVersion: TRIAL_VERSION, characterId: "ren", policyVersion: TRIAL_POLICY_VERSION,
    title: "レンの試練・封印をほどけ", techniqueId: technique.TECHNIQUE_ID,
    conditions: ["あなたの持ち色は赤・青、おまけ色は黄色1回。赤は2回分の封印中です。",
      "両者に解封を1回ずつ、通常スキル6種類を1回ずつ貸し出します。所持カードは減りません。",
      "解封で赤を使うか、黄色で塗って解封を残すか選べます。解封を使わず勝っても合格です。",
      "初勝利で解封を習得。通常戦績・通常対局の券やコインには加算しません。"],
    loanLoadout: clone(TRIAL_LOADOUT), loanUses: 1 };
}

function trialTechnique() {
  return { id: technique.TECHNIQUE_ID, definitionVersion: technique.TECHNIQUE_VERSION, source: "TRIAL_LOAN",
    usesRemaining: 1, trialId: TRIAL_ID, trialVersion: TRIAL_VERSION };
}
function createRenTrial({ matchId, seed }) {
  requireTrial(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff, "INVALID_SEED");
  const streams = engine.createRngDomains(seed, match.REQUIRED_RNG_STREAMS);
  // The diagram occupies a corner of a normal six-by-six playable area.
  // Retain the standard world's 12-wide grid / 48-wide micro coordinates;
  // existing public CPU projections rely on that normal coordinate system.
  const bounds = { minCol: 1, maxCol: 6, minRow: 1, maxRow: 6, macroWidth: 12, microScale: 4 };
  const state = match.createStandardMatch({ matchId, firstSeat: "A", engineVersion: LEARNED_TECHNIQUE_ENGINE_VERSION,
    playableBounds: bounds, microWidth: 48, loadouts: { A: clone(TRIAL_LOADOUT), B: clone(TRIAL_LOADOUT) },
    techniqueRule: { id: technique.TECHNIQUE_RULES.REN_TRIAL, playerSeat: "A" },
    techniques: { A: trialTechnique(), B: trialTechnique() } }, streams);
  const cells = macros => macros.flatMap(macro => {
    const x = (macro % 12) * 4, y = Math.floor(macro / 12) * 4;
    return Array.from({ length: 16 }, (_, i) => (y + Math.floor(i / 4)) * 48 + x + (i % 4));
  });
  state.regions = {
    R1: { id: "R1", micro: cells([13, 25]), sourceMacros: [13, 25], controllers: ["B"], color: "green", isPending: false },
    R2: { id: "R2", micro: cells([14, 15]), sourceMacros: [14, 15], controllers: ["B"], color: "blue", isPending: false },
    R3: { id: "R3", micro: cells([26, 27]), sourceMacros: [26, 27], controllers: ["B"], color: null, isPending: true },
  };
  state.basicPalettes = { A: ["red", "blue"], B: ["yellow", "green"] };
  state.bonusColors = { A: "yellow", B: "blue" };
  state.initialPalettes = { A: { basic: ["red", "blue"], bonus: "yellow" }, B: { basic: ["yellow", "green"], bonus: "blue" } };
  state.bonusUsesRemaining = { A: 1, B: 1 };
  state.publicEffects = { A: { seals: { red: 2 } }, B: { seals: {} } };
  state.pending = "R3"; state.phase = "COLOR";
  state.requiredSize = 2; state.rolledSize = 2; state.baseRequiredSize = 2;
  state.ruleSetId = "STANDARD_V5";
  state.publicLog = ["Ren trial template v1 loaded."];
  match.validateStandardState(state);
  return { state, rngSnapshot: engine.snapshotRngDomains(streams, match.REQUIRED_RNG_STREAMS),
    publicState: match.projectStandardPublicState(state), privateA: match.projectStandardPrivateState(state, "A"), privateB: match.projectStandardPrivateState(state, "B") };
}

function isRenTrialState(state) {
  return state?.engineVersion === LEARNED_TECHNIQUE_ENGINE_VERSION && state?.techniqueRule?.id === technique.TECHNIQUE_RULES.REN_TRIAL;
}
function usefulUnsealActions(publicState, ownPrivateState) {
  const seat = ownPrivateState?.seat;
  if (!isRenTrialState(publicState) || publicState.status === "FINISHED" || publicState.active !== seat || publicState.phase !== "COLOR"
      || ownPrivateState.technique?.id !== technique.TECHNIQUE_ID || ownPrivateState.technique.usesRemaining !== 1
      || publicState.skillCategoryWindow?.categories?.includes("color")) return [];
  const blocked = new Set(engine.adjacentRegionIds(publicState, publicState.pending).map(id => publicState.regions[id]?.color));
  const owned = [...ownPrivateState.basicPalette, ...(ownPrivateState.bonusUsesRemaining > 0 ? [ownPrivateState.bonusColor] : [])];
  return [...new Set(owned)].filter(color => !blocked.has(color) && publicState.publicEffects?.[seat]?.seals?.[color] > 0)
    .map(color => ({ type: "USE_SKILL", payload: { skill: technique.TECHNIQUE_ID, color }, metrics: { addedLegalColor: true } }));
}
function chooseRenTrialAction({ publicState, ownPrivateState, policyVersion, random, tieBreakRandom = random }) {
  requireTrial(policyVersion === TRIAL_POLICY_VERSION && isRenTrialState(publicState), "UNKNOWN_TRIAL_POLICY_VERSION");
  requireTrial(ownPrivateState?.seat === "B" && publicState.active === "B", "INVALID_TRIAL_CPU_OBSERVATION");
  const useful = usefulUnsealActions(publicState, ownPrivateState);
  if (useful.length) return useful[0];
  // Reuse the frozen pre-split Ren ranking for ordinary moves only. The trial
  // policy has its own exact identity; no ordinary character definition changes.
  return roster.chooseCharacterAction({ publicState, ownPrivateState, characterId: "ren",
    policyVersion: roster.PRE_SPLIT_POLICY_VERSIONS.ren, random, tieBreakRandom });
}

module.exports = { TRIAL_ID, TRIAL_VERSION, TRIAL_POLICY_VERSION, TRIAL_LOADOUT,
  projectRenProgression, trialDescriptor, createRenTrial, isRenTrialState, usefulUnsealActions, chooseRenTrialAction };
