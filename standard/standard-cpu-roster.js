"use strict";

const cpu = require("./standard-cpu.js");
const { COLORS } = require("./standard-engine.js");
const { STANDARD_SKILLS } = require("./standard-skill-registry.js");

const ROSTER_VERSION = "standard-character-roster-v1";
const KUROGANE_LEGACY_POLICY_VERSION = `${ROSTER_VERSION}:kurogane`;
const KUROGANE_POLICY_VERSION = `${ROSTER_VERSION}:kurogane-lookahead-v2`;
const CREATE_COLOR_OPTION_STRIDE = 1000000;
const GUARANTEED_TRAP_BONUS = 1000000000;
const RANDOM_SKILLS = new Set(["colorRandomBorrow", "areaMicroBloom", "disruptRandomOne", "disruptRandomTwo", "disruptPaletteRandom", "disruptPaletteChoice", "disruptForcedPalette"]);

const definitions = [
  ["yuzu", "うっかりユズ", "あっ、こっちも塗れそう！", "小さなエリアをテンポよく作る", "終盤の色不足とスキル機会を見落としがち", ["colorRandomBorrow", "areaMicroBloom"], ["colorRandomBorrow", "colorChoiceBorrow", "areaMicroBloom", "areaDiePlus", "disruptRandomOne", "disruptChoiceOne"], [1, .92, .28, .34, .10, .68, .18, .12, .90]],
  ["ren", "せっかちレン", "先に広げた者勝ちだ！", "序盤の面積争い", "広げすぎて後から塗りづらくする", ["areaDiePlus", "colorPrism"], ["colorPrism", "colorRandomBorrow", "areaDiePlus", "areaResize", "disruptRandomTwo", "disruptChoiceOne"], [2, .48, .58, .55, .28, .90, .38, .35, .82]],
  ["minato", "見習いミナト", "この技、試してみます！", "意外性のある仕掛け", "対象選択や使う順番がまだ甘い", ["colorRegionSplit", "colorPaletteChange"], ["colorRegionSplit", "colorPaletteChange", "areaHalfShift", "areaCornerBloom", "disruptPaletteChoice", "disruptChoiceTwo"], [2, .62, .82, .42, .30, .62, .40, .48, .88]],
  ["koharu", "読み違いコハル", "次の色は……たぶん、これ！", "妨害をためらわない", "公開情報からの色予測を外しやすい", ["disruptRandomOne", "disruptPaletteRandom"], ["colorRandomBorrow", "colorChoiceBorrow", "areaMicroBloom", "areaResize", "disruptRandomOne", "disruptPaletteRandom"], [2, .52, .78, .50, .12, .60, .42, .30, .86]],
  ["aoi", "慎重派アオイ", "一手ずつ、確かめましょう。", "自滅しにくい盤面作り", "好機でも攻めず面積で遅れやすい", ["colorChoiceBorrow", "areaMicroBloom"], ["colorChoiceBorrow", "colorPaletteChange", "areaMicroBloom", "areaCornerBloom", "disruptChoiceOne", "disruptChoiceTwo"], [2, .18, .68, .78, .48, .18, .82, .52, .68]],
  ["kai", "勝負師カイ", "ここは一発、賭けるぜ！", "劣勢からのランダム逆転", "有利でも賭けて流れを失う", ["colorPrism", "disruptRandomTwo"], ["colorPrism", "colorRandomBorrow", "areaDiePlus", "areaTripleShift", "disruptRandomTwo", "disruptPaletteRandom"], [2, .55, .76, .62, .34, .98, .45, .42, .92]],
  ["tsubasa", "仕掛け屋ツバサ", "地図は動かしてこそ面白い！", "エリア形状の操作", "形に夢中で色と残り手数を軽視する", ["areaHalfShift", "areaTripleShift"], ["colorRegionSplit", "colorPaletteChange", "areaHalfShift", "areaTripleShift", "disruptChoiceOne", "disruptPaletteChoice"], [3, .34, .90, .86, .38, .76, .36, .50, .96]],
  ["shion", "観察役シオン", "その手、覚えておきます。", "公開行動からの色の確率予測", "読みを重ねて素直な面積勝負が遅い", ["disruptChoiceOne", "disruptPaletteChoice"], ["colorChoiceBorrow", "colorPaletteChange", "areaMicroBloom", "areaResize", "disruptChoiceOne", "disruptPaletteChoice"], [3, .16, .82, .88, .92, .32, .76, .88, .80]],
  ["rei", "カード博士レイ", "組み合わせには理由があるんだ。", "スキルの使用順と組み合わせ", "カードを封じられると通常手が単調", ["colorRegionSplit", "disruptChoiceTwo"], ["colorRegionSplit", "colorPrism", "areaCornerBloom", "areaHalfShift", "disruptChoiceTwo", "disruptChoiceThree"], [3, .12, .96, .94, .74, .48, .86, .76, .94]],
  ["kurogane", "四色のクロガネ", "盤面も色も、すべて読んでみせよう。", "終盤管理と公開情報への適応", "大胆な奇策への反応が少し遅い", ["colorPaletteChange", "disruptChoiceThree"], ["colorPaletteChange", "colorChoiceBorrow", "areaResize", "areaTripleShift", "disruptChoiceThree", "disruptForcedPalette"], [4, .05, .94, .98, .90, .26, .98, .94, .84]],
];

const PARAMETER_NAMES = ["lookaheadDepth", "legalChoiceNoise", "skillWindowRecall", "skillTargetAccuracy", "hiddenInference", "riskTolerance", "endgameDiscipline", "adaptationRate", "favoriteSkillBias"];

function splitLoadout(ids) {
  return Object.fromEntries(["color", "area", "disrupt"].map((category) => [category, Object.freeze(ids.filter((id) => STANDARD_SKILLS[id]?.category === category))]));
}

const CPU_CHARACTERS = Object.freeze(Object.fromEntries(definitions.map(([id, name, line, strength, weakness, favorites, ids, values]) => [id, Object.freeze({
  id, name, line, strength, weakness, favorites: Object.freeze([...favorites]), loadout: Object.freeze(splitLoadout(ids)),
  parameters: Object.freeze(Object.fromEntries(PARAMETER_NAMES.map((key, index) => [key, values[index]]))),
  policyVersion: id === "kurogane" ? KUROGANE_POLICY_VERSION : `${ROSTER_VERSION}:${id}`,
})])));

function validateRoster() {
  if (Object.keys(CPU_CHARACTERS).length !== 10) throw new TypeError("INVALID_CPU_ROSTER_SIZE");
  for (const character of Object.values(CPU_CHARACTERS)) {
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(character.id) || !character.name || !character.line) throw new TypeError("INVALID_CPU_CHARACTER");
    for (const category of ["color", "area", "disrupt"]) {
      if (character.loadout[category].length !== 2) throw new TypeError("INVALID_CPU_LOADOUT");
      for (const skillId of character.loadout[category]) if (!STANDARD_SKILLS[skillId]?.v49Catalogued || STANDARD_SKILLS[skillId].category !== category) throw new TypeError("INVALID_CPU_LOADOUT");
    }
    for (const [key, value] of Object.entries(character.parameters)) {
      if (key === "lookaheadDepth" ? !Number.isSafeInteger(value) || value < 1 || value > 4 : !Number.isFinite(value) || value < 0 || value > 1) throw new TypeError("INVALID_CPU_PARAMETER");
    }
  }
  return true;
}

function publicRoster() {
  return Object.values(CPU_CHARACTERS).map(({ id, name, line, strength, weakness, favorites, policyVersion }) => ({ id, name, line, strength, weakness, favorites: [...favorites], policyVersion }));
}

function actionScore(action, character) {
  const p = character.parameters;
  if (action.type === "DECLARE_NO_COLOR") return 10000;
  if (action.type === "SURRENDER") return -10000;
  if (action.type === "COLOR_REGION") return 40 + p.endgameDiscipline * 30;
  if (action.type === "CREATE_REGION") return 20
    + (action.metrics.contacts || 0) * (5 + p.endgameDiscipline * 10)
    + (action.metrics.colorPressure || 0) * (4 + p.hiddenInference * 16)
    + p.riskTolerance * 5;
  const skillId = action.payload?.skill;
  const favorite = character.favorites.includes(skillId) ? 1 : 0;
  const random = RANDOM_SKILLS.has(skillId) ? 1 : 0;
  return (action.metrics.skillPriority || 0) * (2 + p.skillWindowRecall * 4)
    + favorite * p.favoriteSkillBias * 90
    + random * p.riskTolerance * 24
    + (action.metrics.candidates || action.metrics.movedCount || action.metrics.splitSize || 0) * p.skillTargetAccuracy;
}

function kuroganeLookaheadScore(action, character, observation) {
  let score = actionScore(action, character);
  if (action.type === "CREATE_REGION") {
    const possibleColors = cpu.immediateOpponentColorOptions(observation, action);
    // CPU-generated CREATE metrics are board-bounded and remain far below this
    // stride, so one fewer public color dominates every CREATE base-score gap.
    score += (COLORS.length - possibleColors.length) * CREATE_COLOR_OPTION_STRIDE;
    if (possibleColors.length === 0) score += GUARANTEED_TRAP_BONUS;
  } else if (action.type === "COLOR_REGION") {
    const color = action.payload?.color;
    const own = observation.ownPrivateState;
    if ((own.basicPalette || []).includes(color)) score += 18;
    const temporary = (own.privateEffects?.temporaryColors || []).includes(color);
    const consumesLastBonus = color === own.bonusColor
      && own.bonusUsesRemaining === 1
      && !(own.basicPalette || []).includes(color)
      && !own.privateEffects?.prism
      && !temporary;
    if (consumesLastBonus) score -= 18;
  }
  return score;
}

function chooseCharacterAction({ publicState, ownPrivateState, characterId, policyVersion, random, tieBreakRandom = random }) {
  validateRoster();
  const character = CPU_CHARACTERS[characterId];
  if (!character) throw new TypeError("UNKNOWN_CPU_CHARACTER");
  const selectedPolicyVersion = policyVersion || character.policyVersion;
  const legacyKurogane = characterId === "kurogane" && selectedPolicyVersion === KUROGANE_LEGACY_POLICY_VERSION;
  if (selectedPolicyVersion !== character.policyVersion && !legacyKurogane) throw new TypeError("UNKNOWN_CPU_POLICY_VERSION");
  const observation = cpu.makeObservation({ publicState, ownPrivateState, difficulty: "hard" });
  const actions = cpu.enumerateCpuActions(observation);
  if (!actions.length) return null;
  const useLookahead = selectedPolicyVersion === KUROGANE_POLICY_VERSION;
  const ranked = actions.map((action, index) => ({
    action,
    index,
    score: useLookahead ? kuroganeLookaheadScore(action, character, observation) : actionScore(action, character),
  }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const noiseWindow = Math.min(ranked.length, 1 + Math.floor(character.parameters.legalChoiceNoise * Math.min(9, ranked.length - 1)));
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError("INVALID_CPU_RANDOM");
  const noisy = ranked[Math.min(noiseWindow - 1, Math.floor(value * noiseWindow))];
  const tied = ranked.filter((entry) => entry.score === noisy.score);
  if (tied.length === 1) return noisy.action;
  const tie = tieBreakRandom();
  if (!Number.isFinite(tie) || tie < 0 || tie >= 1) throw new TypeError("INVALID_CPU_RANDOM");
  return tied[Math.min(tied.length - 1, Math.floor(tie * tied.length))].action;
}

validateRoster();

module.exports = {
  CPU_CHARACTERS,
  KUROGANE_LEGACY_POLICY_VERSION,
  KUROGANE_POLICY_VERSION,
  ROSTER_VERSION,
  chooseCharacterAction,
  publicRoster,
  validateRoster,
};
