const APP_GACHA_ODDS_MARKERS = Object.freeze([
  "1: Object.freeze({ 1: 65, 2: 29, 3: 5, 4: 0.9, 5: 0.1 })",
  "2: Object.freeze({ 1: 40, 2: 35, 3: 19, 4: 5.5, 5: 0.5 })",
  "3: Object.freeze({ 1: 25, 2: 35, 3: 28, 4: 10, 5: 2 })",
  "4: Object.freeze({ 1: 0, 2: 35, 3: 35, 4: 24, 5: 6 })",
  "5: Object.freeze({ 1: 0, 2: 0, 3: 40, 4: 40, 5: 20 })",
]);

const EDGE_GACHA_ODDS_MARKER = 'const gachaOdds = {"1":{"1":65,"2":29,"3":5,"4":0.9,"5":0.1},"2":{"1":40,"2":35,"3":19,"4":5.5,"5":0.5},"3":{"1":25,"2":35,"3":28,"4":10,"5":2},"4":{"1":0,"2":35,"3":35,"4":24,"5":6},"5":{"1":0,"2":0,"3":40,"4":40,"5":20}};';

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

export const APPROVED_GACHA_ODDS = Object.freeze({
  appMarkers: APP_GACHA_ODDS_MARKERS,
  edgeMarker: EDGE_GACHA_ODDS_MARKER,
});
