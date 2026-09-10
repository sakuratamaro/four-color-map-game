import { createHash } from "node:crypto";

const APP_GACHA_ODDS_MARKERS = Object.freeze([
  "1: Object.freeze({ 1: 65, 2: 29, 3: 5, 4: 0.9, 5: 0.1 })",
  "2: Object.freeze({ 1: 40, 2: 35, 3: 19, 4: 5.5, 5: 0.5 })",
  "3: Object.freeze({ 1: 25, 2: 35, 3: 28, 4: 10, 5: 2 })",
  "4: Object.freeze({ 1: 0, 2: 35, 3: 35, 4: 24, 5: 6 })",
  "5: Object.freeze({ 1: 0, 2: 0, 3: 40, 4: 40, 5: 20 })",
]);

const EDGE_GACHA_ODDS_MARKER = 'const gachaOdds = {"1":{"1":65,"2":29,"3":5,"4":0.9,"5":0.1},"2":{"1":40,"2":35,"3":19,"4":5.5,"5":0.5},"3":{"1":25,"2":35,"3":28,"4":10,"5":2},"4":{"1":0,"2":35,"3":35,"4":24,"5":6},"5":{"1":0,"2":0,"3":40,"4":40,"5":20}};';
const LOCAL_STANDARD_BUNDLE_SHA256 = "e2eaa264973b6bcedc8a4b4a810395e4072c174617b2047073b11faedd14d960";
const LOCAL_STANDARD_BUNDLE_MARKER = `app.bundle.js?v=20260910-5-${LOCAL_STANDARD_BUNDLE_SHA256.slice(0, 12)}`;

function includesAll(source, markers) {
  return typeof source === "string" && markers.every((marker) => source.includes(marker));
}

export function hasWholeButtonQuizPhysics(pageText, appText) {
  return includesAll(pageText, [
    'id="quizOptions"',
    'id="quizMotionHelp"',
    "選択肢はボタン全体が大きく漂い、位置が入れ替わります。",
  ]) && includesAll(appText, [
    "const QUIZ_OPTION_VELOCITY_ANGLES = Object.freeze([0.9, 2.2, -0.7, 2.5, -0.8, -2.3]);",
    "const speed = 56 + index % 3 * 5;",
    "function quizOptionUsesOrbShape(element)",
    'element.classList.toggle("is-orb", orb);',
    "const size = measureQuizOption(item.element, maximumButtonWidth);",
    "function advanceQuizOptionPhysics(items, arenaWidth, arenaHeight, dt)",
    "const overlapX = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);",
    "const overlapY = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);",
    "if (overlapX <= 0 || overlapY <= 0) continue;",
    "function initializeQuizOptionPhysics(buttons, { reserveRetry = false } = {})",
    "button.dataset.quizOption = option.id;",
    "listenerController: new AbortController(),",
    "const listenerOptions = { signal: motion.listenerController.signal };",
    "motion.listenerController?.abort();",
    "arena?.querySelector('button[data-quiz-option]:hover')",
    "initializeQuizOptionPhysics(optionButtons, { reserveRetry: Boolean(pendingQuiz.pendingAnswer) });",
  ]);
}

export function hasBoardFirstCandidateGuidance(pageText, appText) {
  return includesAll(pageText, [
    'aria-describedby="boardKeyboardHelp boardKeyboardStatus"',
    "0マス選択時の水色の破線は、既存ルールで選択を開始して必要数まで完成できる全候補です。自動選択ではありません。",
    "1マス以上選択した後の緑の破線は次に辺でつなげて選べる候補",
  ]) && includesAll(appText, [
    "function outgoingSelectionCanComplete(state, selectedInput)",
    "function startCandidateMacros(state)",
    "if (!boardSelectionAvailable(state) || !outgoingSelectionGuidanceActive() || selectedMacros.size) return result;",
    'canvas.dataset.selectionGuidance = guidanceMode;',
    'canvas.dataset.startCandidateMacros = [...startGuidedMacros].sort((left, right) => left - right).join(",");',
    'color: "#38bdf8", cssWidth: 3, cssDash: [3, 3]',
    'color: "#86efac", cssWidth: 2.5, cssDash: [5, 4]',
    'firstSelected ?? firstStartCandidate',
    "水色の破線は選択を開始できる全候補です",
  ]);
}

export function hasPerCellContactFeedback(appText) {
  return includesAll(appText, [
    "function presentSelectedContactChange(state, previousMacros, nextMacros = selectedMacros)",
    "const previousContactColorCount = selectedContactColorCount(state, previousSourceMacros);",
    "if (contactColorCount < previousContactColorCount)",
    "if (contactColorCount < 2 || contactColorCount <= previousContactColorCount) return;",
    "{ minimumStage: previousContactColorCount + 1 }",
    "if (!targetDraft) presentSelectedContactChange(state, previousMacros);",
  ]);
}

export function hasApprovedGachaOddsUi(pageText, appText) {
  return includesAll(pageText, [
    'id="gachaOdds"',
    "Lv.1 排出率：★1 65% / ★2 29% / ★3 5% / ★4 0.9% / ★5 0.1%",
  ]) && includesAll(appText, [
    "const GACHA_ODDS = Object.freeze({",
    ...APP_GACHA_ODDS_MARKERS,
    "const odds = GACHA_ODDS[level];",
    '$("gachaOdds").textContent = `Lv.${level} 排出率：${[1, 2, 3, 4, 5].map((rarity) => `★${rarity} ${odds[rarity]}%`).join(" / ")}　${guarantee}`;',
  ]);
}

export function hasApprovedEdgeGachaOdds(bundleText) {
  return includesAll(bundleText, [
    EDGE_GACHA_ODDS_MARKER,
    "cumulative+=gachaOdds[ticketLevel][rarity]/100",
    "GACHA_ODDS:gachaOdds",
  ]);
}

export function hasDeferredCurseLocalBundle(pageText, bundleText) {
  return includesAll(pageText, [LOCAL_STANDARD_BUNDLE_MARKER])
    && typeof bundleText === "string"
    && createHash("sha256").update(bundleText).digest("hex") === LOCAL_STANDARD_BUNDLE_SHA256
    && includesAll(bundleText, [
      "function consumeDeferredCurseBacklashAfterColor(state, actor)",
      "if (remaining > 0) state.privateEffects[actor].curseBacklash = remaining;",
      "consumeDeferredCurseBacklashAfterColor(next, actor);",
      "Curse backlash resolved after Player ${actor} completed coloring.",
    ]);
}

export function hasRegionSplitDirectTarget(appText, localBundleText) {
  return includesAll(appText, [
    "function regionSplitTargetMacros(state)",
    "function activateRegionSplitMacro(state, macro)",
    "skillIntents.buildSkillPayload(targetDraft.skill, { regionId: state.pending, sourceMacros: [macro] })",
    'sendAction("USE_SKILL", payload)',
    "盤面の1マスだけで選べます。",
  ])
    && !appText.includes('targetChoice(id, "regionId", id)')
    && includesAll(localBundleText, [
      'const regionSplitTarget = targetMode?.kind === "colorRegionSplit";',
      'dispatch("USE_SKILL", { skill: "colorRegionSplit", regionId: publicState.pending, sourceMacros: [macro] });',
      "盤面の1マスだけで選べます。",
    ])
    && !localBundleText.includes("エリア二分を確定");
}

export const APPROVED_GACHA_ODDS = Object.freeze({
  appMarkers: APP_GACHA_ODDS_MARKERS,
  edgeMarker: EDGE_GACHA_ODDS_MARKER,
});

export { LOCAL_STANDARD_BUNDLE_MARKER, LOCAL_STANDARD_BUNDLE_SHA256 };
