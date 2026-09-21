import { createHash } from "node:crypto";

const APP_GACHA_ODDS_MARKERS = Object.freeze([
  "1: Object.freeze({ 1: 65, 2: 29, 3: 5, 4: 0.9, 5: 0.1 })",
  "2: Object.freeze({ 1: 40, 2: 35, 3: 19, 4: 5.5, 5: 0.5 })",
  "3: Object.freeze({ 1: 25, 2: 35, 3: 28, 4: 10, 5: 2 })",
  "4: Object.freeze({ 1: 0, 2: 35, 3: 35, 4: 24, 5: 6 })",
  "5: Object.freeze({ 1: 0, 2: 0, 3: 40, 4: 40, 5: 20 })",
]);

const EDGE_GACHA_ODDS_MARKER = 'const gachaOdds = {"1":{"1":65,"2":29,"3":5,"4":0.9,"5":0.1},"2":{"1":40,"2":35,"3":19,"4":5.5,"5":0.5},"3":{"1":25,"2":35,"3":28,"4":10,"5":2},"4":{"1":0,"2":35,"3":35,"4":24,"5":6},"5":{"1":0,"2":0,"3":40,"4":40,"5":20}};';
const LOCAL_STANDARD_BUNDLE_SHA256 = "63d4f2b526f172d6eb2388c0f669beb1c6aee1b04cdd4053e623b705b2ff8d74";
const LOCAL_STANDARD_BUNDLE_MARKER = `app.bundle.js?v=20260914-11-${LOCAL_STANDARD_BUNDLE_SHA256.slice(0, 12)}`;

function includesAll(source, markers) {
  return typeof source === "string" && markers.every((marker) => source.includes(marker));
}

export function hasDirectQuizEntry(pageText, appText) {
  if (typeof pageText !== "string" || typeof appText !== "string") return false;
  const levels = [...pageText.matchAll(/data-quiz-start-level="(\d)"/g)].map(match => match[1]).join(",");
  const help = pageText.match(/<details id="quizRewardHelp"[^>]*>[\s\S]*?<\/details>/)?.[0] || "";
  return levels === "1,2,3,4,5"
    && !/id="quiz(?:Level|Start)"/.test(pageText)
    && !/\bopen\b/.test(help.split(">")[0])
    && includesAll(help, ["もらえる券", "10問すべて正解</th><td>10枚", "5問以上を連続正解</th><td>5枚", "合計7問以上を正解</th><td>3枚", "それ以外</th><td>1枚", "1つ下のLv（最低Lv.1）"])
    && includesAll(appText, ["async function startOnlineQuiz(selectedLevel)", "Number.isInteger(selectedLevel)", "selectedLevel < 1 || selectedLevel > 5", "!profile() || pendingQuiz || hasMatchedRoomHandoff()", "startOnlineQuiz(Number(button.dataset.quizStartLevel))"]);
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
    "0マス選択時の明るい灰色は、既存ルールで選択を開始して必要数まで完成できる全候補です。自動選択ではありません。",
    "1マス以上選択した後の明るい灰色は次に辺でつなげて選べる候補",
  ]) && includesAll(appText, [
    "function outgoingSelectionCanComplete(state, selectedInput)",
    "function startCandidateMacros(state)",
    "if (!boardSelectionAvailable(state) || !outgoingSelectionGuidanceActive() || selectedMacros.size) return result;",
    'canvas.dataset.selectionGuidance = guidanceMode;',
    'canvas.dataset.startCandidateMacros = [...startGuidedMacros].sort((left, right) => left - right).join(",");',
    'candidate: "#707070", selected: "#f2f2f2"',
    'paintFreeMacroAffordance(ctx, state, startGuidedMacros.size ? startGuidedMacros : connectedGuidedMacros, cell, BOARD_AFFORDANCE.candidate);',
    'paintFreeMacroAffordance(ctx, state, visibleOutgoingMacros(state), cell, BOARD_AFFORDANCE.selected);',
    'firstSelected ?? firstStartCandidate',
    "明るい灰色は選択を開始できる全候補です",
    'title = ready ? "選択したエリアを渡してください" : "相手に渡すエリアを選択してください"',
  ]) && /id="turnGuide"[\s\S]*?id="regionControls"[\s\S]*?id="submitRegion"[\s\S]*?<\/section>[\s\S]*?id="boardViewport"/.test(pageText)
    && !/id="(?:phaseText|turnGuideStep|turnGuideDetail|toggleBoardZoom|playViewportHint|matchSetupDetails)"/.test(pageText)
    && !/boardZoomed|setBoardZoom/.test(appText);
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

export function hasCompactProfile(pageText, appText, cssText) {
  if (![pageText, appText, cssText].every(value => typeof value === "string")) return false;
  const ids = ["profileStatsDetails", "cpuRecordsDetails", "quizAccuracyDetails", "profileTrophiesDetails", "cosmeticPanel"];
  return ids.every(id => {
    const tag = pageText.match(new RegExp('<details id="' + id + '"[^>]*>'))?.[0] || "";
    return tag.length > 0 && !/\bopen(?:\s|=|>)/.test(tag);
  })
    && !pageText.includes("この端末のStandardセーブから選べます")
    && includesAll(pageText, ['id="toggleProfileOptions"', 'aria-controls="profileOptions"',
      'aria-describedby="profilePublicNameHelp"', 'id="profileHumanOverview"', 'id="profileCpuOverview"',
      'id="profileSaveStatus"', 'id="profileSelect"', 'id="syncProfile"', 'id="matchHistory"'])
    && includesAll(appText, ['let profilePickerOpen = false;', 'const optionsOpen = !synced || profilePickerOpen || profileSyncBusy;',
      'show("profileOptions", optionsOpen)', 'この名前は対戦相手に表示されます。',
      'if (pending) $("cosmeticPanel").open = true;', 'profileSyncError = "";'])
    && /initialHydrationPending = false;\s*renderProfile\(\);/.test(appText)
    && includesAll(cssText, ['.profile-record-overview', '.profile-disclosure > summary', 'min-height: 48px', 'min-height: 44px']);
}

export function hasHomeRules(pageText, appText, cssText) {
  if (![pageText, appText, cssText].every(value => typeof value === "string")) return false;
  const actions = pageText.match(/<div class="home-actions">([\s\S]*?)<\/div>/)?.[1] || "";
  const dialog = pageText.match(/<dialog id="tutorialDialog"[^>]*>/)?.[0] || "";
  return (actions.match(/<button\b/g) || []).length === 2
    && !actions.includes("data-tab-jump")
    && includesAll(actions, ['id="openHomeSettings"', 'aria-expanded="false"', 'aria-controls="feedbackSettings"',
      'id="openTutorial"', 'aria-haspopup="dialog"', 'aria-controls="tutorialDialog"'])
    && dialog.length > 0 && !/\bopen(?:\s|=|>)/.test(dialog)
    && includesAll(pageText, ['id="feedbackSettings" class="feedback-settings hidden"',
      'id="homeSessionRecovery"', 'id="startStandardCpuHome"', 'id="tutorialTitle"', 'id="closeTutorial"', 'method="dialog"'])
    && ["soundEffectsEnabled", "vibrationEnabled"].every(id => pageText.split('id="' + id + '"').length === 2)
    && includesAll(appText, ['$("tutorialDialog").showModal()', '$("tutorialTitle").focus({ preventScroll: true })',
      '$("tutorialDialog").close()', 'show("feedbackSettings", false)',
      'cpuDraftOwnsRoomlessEntry || Boolean(snapshot.roomId) || hasCpuEntryIntent()',
      'activeAppTab === "home" && !hasMatchedRoomHandoff()',
      '!snapshot.roomId && !cpuDraftOwnsRoomlessEntry && synced'])
    && includesAll(cssText, ['body[data-active-tab="home"] .connection-card.connection-ready:not(.has-matched-room) { display: none; }',
      '.home-hero .feedback-settings.hidden { display: none; }', 'max-height: calc(100dvh - 24px)', 'overflow: auto;', '.tutorial-header { position: sticky;']);
}

export function hasGachaEntryDiet(pageText, appText) {
  if (typeof pageText !== "string" || typeof appText !== "string") return false;
  const levels = [...pageText.matchAll(/data-gacha-level="(\d)"/g)].map(match => match[1]).join(",");
  const odds = pageText.match(/<details id="gachaOdds"[^>]*>[\s\S]*?<\/details>/)?.[0] || "";
  return levels === "1,2,3,4,5" && !/<select[^>]*id="gachaLevel"/.test(pageText)
    && !/\bopen\b/.test(odds.split(">")[0])
    && includesAll(odds, ['id="gachaOddsRows"', 'scope="col">★5', '<summary>排出率</summary>'])
    && includesAll(pageText, ['id="gachaLevels"', 'id="gachaDrawOne"', 'id="gachaDrawAll"', 'id="gachaHelp"'])
    && includesAll(appText, ["pendingGacha?.ticketLevel ?? selectedGachaLevel", "(!retry && pendingGacha)",
      "selectGachaLevel(Number(button.dataset.gachaLevel))", "GACHA_ODDS[ticketLevel][rarity]",
      'if (origin && !pendingGacha && !gachaBusy) $("gachaStatus").textContent =']);
}

export function hasApprovedGachaOddsUi(pageText, appText, registryText = "") {
  if (hasGachaEntryDiet(pageText, appText)
    && includesAll(appText, ["const GACHA_ODDS = globalThis.FourColorStandardSkillRegistry.gachaOdds;"])) {
    try {
      const encoded = registryText.match(/const gachaOdds = (\{[\s\S]*?\});/)?.[1];
      const expected = JSON.parse(EDGE_GACHA_ODDS_MARKER.slice("const gachaOdds = ".length, -1));
      return JSON.stringify(JSON.parse(encoded)) === JSON.stringify(expected)
        && includesAll(registryText, ["gachaOdds: Object.freeze(gachaOdds)", "Object.freeze(odds)"]);
    } catch { return false; }
  }
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

export function hasCardActionRecovery(pageText, appText) {
  return includesAll(pageText, [
    'progression.css?v=20260914-1', 'id="cardSaleRecovery" type="button"',
    'id="loadoutRecoveryStatus"', 'id="cardSaleRestriction"',
    'id="cardSaleCommit"', 'この内容で売る', '前回の売却結果を確認',
  ]) && includesAll(appText, [
    'from "./action-recovery.js?v=20260914-1"',
    'function currentCardActionRecovery()', 'function navigateCardRecovery(action)',
    'currentCardActionRecovery()[action]', 'refreshRoom: false',
    'navigateCardRecovery("sale")', 'navigateCardRecovery("loadout")',
  ]);
}

export function hasCompactCpuRecords(pageText, appText, progressionCssText) {
  return includesAll(pageText, [
    'progression.css?v=20260914-1',
    'id="cpuCharacterRecords" class="cpu-character-records" role="list"',
    "10人全員の勝敗です。まだ対戦していないCPUも0戦で表示します。",
  ])
    && includesAll(appText, [
      "function clearCpuCharacterRecordPortraits()",
      "function cpuCharacterRecordCount(value)",
      "function appendCpuCharacterRecord(characterId, record)",
      'item.setAttribute("aria-label", `${nameText}、${wins}勝 ${losses}敗、合計${matches}戦`)',
      "cpuPortraits.showCpuPortrait({ frame: portrait, art, fallback, characterId })",
      "for (const characterId of Object.keys(CPU_NAMES)) appendCpuCharacterRecord(characterId, characterStats[characterId]);",
    ])
    && !appText.includes("Object.entries(value.cpuCharacterStats || {}).filter")
    && includesAll(progressionCssText, [
      ".cpu-character-records { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));",
      ".cpu-character-record-copy strong { min-width: 0; color: #f8fafc; font-size: 13px; line-height: 1.25; overflow-wrap: anywhere; }",
      ".cpu-character-records { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    ]);
}

export function hasQuizAccuracyRecords(pageText, appText, progressionCssText) {
  return includesAll(pageText, [
'app.js?v=20260921-1',
    'progression.css?v=20260914-1',
    'id="quizAccuracyRecords" class="quiz-accuracy-records" role="list"',
    "記録開始以降に、サーバーで採点が確定した回答だけを集計します。",
  ])
    && includesAll(appText, [
      "function quizAccuracyCounts(record)",
      "record?.trackedAnswered",
      "record?.trackedCorrect",
      "for (let level = 1; level <= 5; level += 1)",
      'appendQuizAccuracyRecord("全体", overall)',
    ])
    && includesAll(progressionCssText, [
      ".quiz-accuracy-records { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));",
      ".quiz-accuracy-records { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    ]);
}

export function hasCpuSealTimingPolicy(bundleText) {
  return includesAll(bundleText, [
    "const SEAL_SKILL_EFFECTS = Object.freeze({",
    "function sealResponseProfiles(publicState, ownPrivateState)",
    "const opportunity = best.before <= 2 && best.reduction > 0;",
    "sealResponseOptionsAfterPotential: best.afterPotential",
    "if (applySealTiming && action.metrics.sealOpportunity === 0) return -1000;",
    "const sealOpportunityBonus = applySealTiming && action.metrics.sealOpportunity === 1",
    "const applySealTiming = !legacyKurogane;",
  ]);
}

export function hasMatchRewardEconomy(pageText, appText, bundleText, resultModelText = "") {
  const legacyResultUi = includesAll(appText, [
    "const matchReward = settledMatch?.matchReward;",
    "matchReward?.reason === \"PVP_REWARD_LIMIT\"",
    "完了報酬：Lv.${rewardTicketLevel}ガチャ券 +${rewardTicketCount}",
    "直近60分の付与済み10試合に達したため、今回はありません。",
  ]);
  const compactResultUi = appText.includes("terminalRewardPresentation(roomModel?.room, mySeat, profile())")
    && includesAll(resultModelText, ["const reward = savedResultReward(room, seat, profile);",
      "reward?.awarded !== true", "Number.isSafeInteger(reward.ticketLevel)", "Number.isSafeInteger(reward.ticketCount)",
      "PVP_REWARD_LIMIT", "完了報酬\\nLv.${reward.ticketLevel}ガチャ券 ×${reward.ticketCount}", "報酬を確認中です。"]);
  return includesAll(pageText, [
    "対人勝利はLv.2、敗北はLv.1（直近60分で10試合まで）",
    "CPU勝利は強さに応じLv.1〜3、敗北はLv.1",
  ]) && (legacyResultUi || compactResultUi) && includesAll(bundleText, [
    'const ECONOMY_VERSION = "standard-match-reward-v2";',
    "const PVP_REWARD_WINDOW_MS = 60 * 60 * 1000;",
    "const PVP_REWARD_LIMIT = 10;",
    "yuzu: Object.freeze({ ticketLevel: 1, ticketCount: 2, band: \"BEGINNER\" })",
    "kurogane: Object.freeze({ ticketLevel: 3, ticketCount: 2, band: \"MASTER\" })",
    "ticketLevel: awarded ? (won ? 2 : 1) : null",
    "Date.parse(entry.endedAt) > cutoff",
  ]);
}

export const APPROVED_GACHA_ODDS = Object.freeze({
  appMarkers: APP_GACHA_ODDS_MARKERS,
  edgeMarker: EDGE_GACHA_ODDS_MARKER,
});

export { LOCAL_STANDARD_BUNDLE_MARKER, LOCAL_STANDARD_BUNDLE_SHA256 };
