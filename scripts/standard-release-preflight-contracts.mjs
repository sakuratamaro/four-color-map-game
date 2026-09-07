import { createHash } from "node:crypto";

const APP_GACHA_ODDS_MARKERS = Object.freeze([
  "1: Object.freeze({ 1: 65, 2: 29, 3: 5, 4: 0.9, 5: 0.1 })",
  "2: Object.freeze({ 1: 40, 2: 35, 3: 19, 4: 5.5, 5: 0.5 })",
  "3: Object.freeze({ 1: 25, 2: 35, 3: 28, 4: 10, 5: 2 })",
  "4: Object.freeze({ 1: 0, 2: 35, 3: 35, 4: 24, 5: 6 })",
  "5: Object.freeze({ 1: 0, 2: 0, 3: 40, 4: 40, 5: 20 })",
]);

const EDGE_GACHA_ODDS_MARKER = 'const gachaOdds = {"1":{"1":65,"2":29,"3":5,"4":0.9,"5":0.1},"2":{"1":40,"2":35,"3":19,"4":5.5,"5":0.5},"3":{"1":25,"2":35,"3":28,"4":10,"5":2},"4":{"1":0,"2":35,"3":35,"4":24,"5":6},"5":{"1":0,"2":0,"3":40,"4":40,"5":20}};';
const LOCAL_STANDARD_BUNDLE_SHA256 = "87f722259e50b407d99ef1bd877f3d13687c1ad82e9a9c2d017cc2d62c40daee";
const LOCAL_STANDARD_BUNDLE_MARKER = `app.bundle.js?v=20260908-2-${LOCAL_STANDARD_BUNDLE_SHA256.slice(0, 12)}`;

function includesAll(source, markers) {
  return typeof source === "string" && markers.every((marker) => source.includes(marker));
}

export function hasWholeButtonQuizPhysics(pageText, appText) {
  return includesAll(pageText, [
    'id="quizOptions"',
    'id="quizMotionHelp"',
    "選択肢はボタン全体がゆっくり漂います。",
  ]) && includesAll(appText, [
    "function advanceQuizOptionPhysics(items, arenaWidth, arenaHeight, dt)",
    "const overlapX = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);",
    "const overlapY = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);",
    "if (overlapX <= 0 || overlapY <= 0) continue;",
    "function initializeQuizOptionPhysics(buttons, { reserveRetry = false } = {})",
    "button.dataset.quizOption = option.id;",
    "listenerController: new AbortController(),",
    "const listenerOptions = { signal: motion.listenerController.signal };",
    "motion.listenerController?.abort();",
    "initializeQuizOptionPhysics(optionButtons, { reserveRetry: Boolean(pendingQuiz.pendingAnswer) });",
  ]);
}

export function hasBoardFirstCandidateGuidance(pageText, appText) {
  return includesAll(pageText, [
    'aria-describedby="boardKeyboardHelp boardKeyboardStatus"',
    "0マス選択時の水色の破線は最初のおすすめ選択候補で、自動選択ではありません。",
    "1マス以上選択した後の緑の破線は次に辺でつなげて選べる候補",
  ]) && includesAll(appText, [
    "function outgoingSelectionCanComplete(state, selectedInput)",
    "function firstGuidedMacro(state)",
    "if (!boardSelectionAvailable(state) || !outgoingSelectionGuidanceActive() || selectedMacros.size) return null;",
    'canvas.dataset.selectionGuidance = guidanceMode;',
    'color: "#38bdf8", cssWidth: 3, cssDash: [3, 3]',
    'color: "#86efac", cssWidth: 2.5, cssDash: [5, 4]',
    'firstSelected ?? firstGuidedMacro(state)',
    "水色の破線は最初のおすすめ選択候補です。自動選択ではないので、盤面を見て選んでください。",
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

export const APPROVED_GACHA_ODDS = Object.freeze({
  appMarkers: APP_GACHA_ODDS_MARKERS,
  edgeMarker: EDGE_GACHA_ODDS_MARKER,
});

export { LOCAL_STANDARD_BUNDLE_MARKER, LOCAL_STANDARD_BUNDLE_SHA256 };
