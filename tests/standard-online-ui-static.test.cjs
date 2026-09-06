"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { STANDARD_SKILLS } = require("../standard/standard-skill-registry.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");
const clientSource = fs.readFileSync(path.join(root, "standard-online-v5", "standard-online-client.js"), "utf8");
const css = fs.readFileSync(path.join(root, "standard-online-v5", "style.css"), "utf8");
const progressionCss = fs.readFileSync(path.join(root, "standard-online-v5", "progression.css"), "utf8");

test("missing room snapshots return to the lobby without discarding rooms on network errors", () => {
  const refresh = app.slice(app.indexOf("async function refreshRoom"), app.indexOf("const roomSync"));
  const terminalGate = refresh.indexOf('if (error?.code !== "P0002") throw error');
  const clearRoom = refresh.indexOf("client.clearRoom()");
  assert.ok(terminalGate >= 0);
  assert.ok(clearRoom > terminalGate);
  assert.match(refresh, /roomSync\.stop\(\)/);
  assert.match(refresh, /roomModel = null/);
  assert.match(refresh, /対戦は終了または失効しました/);
});

test("Standard online setup UI exposes the complete reconnect path", () => {
  for (const id of [
    "connectionCard", "connectionStatus", "connectionBadge", "connectionMessage", "matchedRoomHandoff", "matchedRoomAnnouncement", "roomLifecycleAnnouncement", "matchedRoomHandoffTitle", "matchedRoomHandoffDetail", "returnToMatchedRoom", "waitingOpponentNotice", "waitingOpponentAnnouncement", "openWaitingOpponent",
    "profileSelect", "starterCreator", "starterName", "createStarterProfile", "syncProfile", "createRoom", "roomCode", "joinRoom",
    "shownCode", "cpuCommentaryStage", "cpuCommentaryBubble", "cpuCommentaryName", "cpuCommentaryText", "cpuCommentaryAnnouncement", "members", "editNextLoadout", "setupTitle", "setupDescription", "cpuStartReview", "loadoutSummary", "loadoutGrid", "setupCommitBar", "setupCommitTitle", "submitSetup", "cancelCpuDraft", "setupStatus", "matchCard",
    "publicProjection", "privateProjection", "leaveRoom", "leaveRoomDescription", "abandonRoom", "abandonRoomHint", "abandonRoomDialog", "abandonRoomTitle", "abandonRoomDescription", "abandonRoomStatus", "cancelAbandonRoom", "confirmAbandonRoom", "lobbyTitle",
    "turnGuide", "turnGuideStep", "turnGuideTitle", "turnGuideDetail", "boardViewport", "board", "boardKeyboardHelp", "boardKeyboardStatus", "toggleBoardZoom", "regionControls", "selectionCount", "submitRegion", "paletteControls", "skillControls", "skillTargetControls",
    "surrender", "retryAction", "actionStatus", "rematchControls", "rematchStatus", "requestRematch",
    "gachaPanel", "gachaTitle", "gachaTickets", "gachaLevel", "gachaDrawOne", "gachaDrawAll", "gachaRetry", "gachaStatus", "gachaResults",
    "gachaResultSummary", "gachaResultTitle", "gachaResultAnnouncement", "gachaCpuRematch", "gachaCpuRematchNote",
    "quizAnswerFeedback", "quizRewardSummary", "quizGoGacha", "quizReview", "quizReviewList",
    "progressionPanel", "profileCoins", "profileStats", "cpuProfileStats", "cpuCharacterRecords", "trophyList", "matchHistory",
    "cardSaleSkill", "cardSaleCount", "cardSaleQuote", "cardSaleCommit", "cardSaleRetry", "cardSaleReset", "cardSaleStatus",
    "cosmeticPanel", "cosmeticCoins", "collectionIdentity", "refreshCosmetics", "cosmeticCatalog", "cosmeticConfirmation", "cosmeticConfirmationText", "cosmeticCommit", "cosmeticCancel", "cosmeticRetry", "cosmeticStatus",
    "matchmakingPanel", "recruitOpponent", "findOpponent", "cancelMatchmaking", "matchmakingWait", "matchmakingElapsed", "matchmakingStatus", "roomIdentityLabel",
    "cpuOpponentOffer", "cpuOfferMessage", "chooseCpuOpponent", "keepWaitingForHuman", "cpuRosterDialog", "cpuRosterGrid", "cpuRosterStatus", "closeCpuRoster",
    "terminalOverlay", "terminalIcon", "terminalEyebrow", "terminalTitle", "terminalMessage", "terminalReasonText", "cpuTerminalCommentarySummary", "cpuTerminalCommentaryOverlay", "terminalProgressText", "terminalGoGacha", "terminalClose",
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(html, /standard-online-client\.js/);
  assert.match(html, /standard-online-skill-intents\.js/);
  assert.match(html, /cpu-commentary\.js\?v=20260906-2/);
  assert.match(html, /type="module" src="app\.js(?:\?v=[0-9-]+)?"/);
});

test("CPU commentary is public-event-only, bounded, non-blocking, and terminal-persistent", () => {
  assert.match(html, /style\.css\?v=20260906-38/);
  assert.match(html, /app\.js\?v=20260906-39/);
  assert.match(app, /cpuCommentary\?\.VERSION !== "standard-cpu-commentary-v2"/);
  assert.ok(html.indexOf("cpu-commentary.js") < html.indexOf('type="module" src="app.js'));
  assert.match(html, /id="cpuCommentaryStage"[^>]+aria-hidden="true"/);
  assert.match(html, /id="cpuCommentaryAnnouncement"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(html, /aria-describedby="terminalMessage terminalReasonText cpuTerminalCommentaryOverlay terminalProgressText"/);
  assert.doesNotMatch(html, /id="cpuTerminalCommentaryOverlay"[^>]+aria-hidden/);
  const terminalPresentation = app.slice(app.indexOf("if (item.priority === \"terminal\")"), app.indexOf("clearCpuTerminalCommentary();", app.indexOf("if (item.priority === \"terminal\")")));
  assert.doesNotMatch(terminalPresentation, /announceCpuCommentary/);
  assert.match(app, /const cpuCommentary = globalThis\.FourColorStandardCpuCommentary/);
  assert.match(app, /CPU_COMMENTARY_PRESENTATION_LIMIT = 32/);
  assert.match(app, /sessionStorage\.setItem\(CPU_COMMENTARY_PRESENTATION_KEY/);
  assert.match(app, /presented: cpuCommentaryPresentation\.presented\.slice\(-CPU_COMMENTARY_PRESENTATION_LIMIT\)/);
  assert.match(app, /characterId: context\.characterId,[\s\S]+cpuSeat: context\.cpuSeat,[\s\S]+publicState: context\.publicState/);
  assert.doesNotMatch(app.slice(app.indexOf("function chooseCpuCommentary"), app.indexOf("function clearCpuCommentaryBubble")), /private_state|privateState/);
  assert.match(app, /document\.visibilityState !== "visible"/);
  assert.match(app, /clearContactReveal\(\);[\s\S]+show\("randomReveal", false\)/);
  assert.match(css, /\.cpu-commentary-stage\{[^}]*position:fixed[^}]*pointer-events:none/);
  assert.match(app, /if \(tab !== "battle"\) clearCpuCommentaryBubble\(\)/);
  assert.match(app, /activeAppTab !== "battle"/);
  assert.match(app, /focusedQuizOptionIndex[\s\S]+restoredQuizOption\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /body\[data-active-tab="battle"\]:has\(#cpuCommentaryBubble:not\(\.is-silent\)\) #waitingOpponentNotice\{visibility:hidden\}/);
  assert.match(css, /\.cpu-commentary-bubble\{[^}]*pointer-events:none/);
  assert.match(css, /@media\(max-width:390px\)\{\.cpu-commentary-stage\{[^}]*height:48px\}\.cpu-commentary-bubble/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.cpu-commentary-bubble\{[^}]*transition:none!important[^}]*transform:none!important/);
});

test("waiting-opponent notice is global, privacy-finite, and non-interrupting", () => {
  assert.match(html, /id="waitingOpponentNotice"[^>]+class="waiting-opponent-notice hidden"/);
  assert.match(html, /対戦相手を募集中のプレイヤーがいます/);
  assert.match(html, /id="waitingOpponentAnnouncement"[^>]+class="visually-hidden"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.doesNotMatch(html, /id="waitingOpponentNotice"[^>]+aria-live/);
  assert.match(clientSource, /fcg_standard_matchmaking_availability/);
  assert.match(clientSource, /return Object\.freeze\(\{\s*hasWaitingOpponent: row\.has_waiting_opponent,\s*observedAt: row\.observed_at/);
  assert.match(app, /const MATCHMAKING_AVAILABILITY_POLL_MS = 30000/);
  assert.match(app, /const MATCHMAKING_AVAILABILITY_MAX_BACKOFF_MS = 300000/);
  assert.match(app, /function renderWaitingOpponentNotice\(\)/);
  assert.match(app, /loadedRoom\?\.opponent_kind === "cpu"/);
  assert.match(app, /!snapshot\.matchmakingTicketId && !snapshot\.matchmakingFindActionId/);
  assert.match(app, /function matchmakingAvailabilityPollAllowed\(\)[\s\S]+snapshot\.matchmakingTicketId \|\| snapshot\.matchmakingFindActionId[\s\S]+roomModel\?\.room\?\.id === snapshot\.roomId && roomModel\.room\.opponent_kind === "cpu"/);
  assert.match(app, /gachaBusy \|\| pendingGacha \|\| quizBusy \|\| quizInProgress \|\| pendingQuiz\?\.pendingAnswer/);
  assert.match(app, /document\.visibilityState === "hidden" \|\| !navigator\.onLine/);
  assert.match(app, /stopMatchmakingAvailabilityWatch\(\{ hide: true \}\)/);
  assert.match(app, /matchmakingAvailabilityFailures \+= 1[\s\S]+setWaitingOpponentAvailability\(false, \{ authoritative: false \}\)/);
  assert.match(app, /MATCHMAKING_AVAILABILITY_POLL_MS \* \(2 \*\* matchmakingAvailabilityFailures\)/);
  assert.match(app, /loadedRoom\?\.opponent_kind === "cpu"[\s\S]+quizInProgress[\s\S]+quizFeedbackUntil[\s\S]+quizHintActive/);
  assert.match(app, /activateAppTab\("battle"\)[\s\S]+matchmakingStatus/);
  assert.doesNotMatch(app, /waitingOpponent[\s\S]{0,120}(?:findPublicOpponent|recruitPublicOpponent)\(/);
  assert.match(css, /\.waiting-opponent-notice\{position:fixed/);
  assert.match(css, /pointer-events:none/);
  assert.match(css, /\.waiting-opponent-notice button\{[^}]*min-height:44px[^}]*pointer-events:auto/);
  assert.match(css, /white-space:nowrap/);
  assert.match(css, /@media\(max-width:700px\)\{\.waiting-opponent-notice\{top:calc\(4px \+ env\(safe-area-inset-top\)\);right:8px;bottom:auto;left:auto;width:calc\(100% - 16px\);height:44px;min-height:44px;box-sizing:border-box/);
  assert.match(css, /@media\(max-width:700px\)\{#matchCard\{scroll-margin-block-start:calc\(80px \+ env\(safe-area-inset-top\)\)\}\}/);
  assert.match(css, /@media\(max-width:700px\)\{body\[data-active-tab="battle"\]\{padding-bottom:calc\(168px \+ env\(safe-area-inset-bottom\)\)\}\}/);
});

test("fresh players can finish profile setup inside the battle tab without automatic matchmaking", () => {
  assert.match(html, /id="profileCard"[^>]+data-app-tab-panel="[^"]*\bbattle\b[^"]*"/);
  assert.match(app, /function renderProfileCardVisibility\(\) \{ show\("profileCard", activeAppTab !== "battle" \|\| !synced\); \}/);
  assert.match(app, /document\.body\.dataset\.activeTab = tab;\s*renderProfileCardVisibility\(\);/);
  assert.match(app, /function render\(\) \{\s*renderProfileCardVisibility\(\);/);
  assert.match(app, /synced = true; badge\("プロフィール同期済み", "good"\); renderProfile\(\); render\(\);/);
  const syncProfile = app.slice(app.indexOf("async function syncSelectedProfile()"), app.indexOf("function matchmakingWaitSeconds()"));
  assert.doesNotMatch(syncProfile, /(?:createRoom|joinRoom|recruitPublicOpponent|findPublicOpponent|acceptCpuCharacter)\s*\(/);
});

test("fresh players create their starter and prepare online play with one clear action", () => {
  assert.match(html, /id="createStarterProfile"[^>]*>この名前で対戦準備へ<\/button>/);
  assert.match(html, /id="syncProfile"[^>]*>オンライン対戦の準備をする<\/button>/);
  const createStarter = app.slice(app.indexOf("async function createStarterProfile()"), app.indexOf("function renderLoadout()"));
  assert.match(createStarter, /localStorage\.setItem\(STARTER_PROFILE_KEY/);
  assert.match(createStarter, /if \(!connected\) return toast/);
  assert.match(createStarter, /await syncSelectedProfile\(\)/);
  assert.match(createStarter, /if \(synced\) toast\("対戦準備ができました。遊び方を選んでください。"\)/);
  assert.doesNotMatch(createStarter, /(?:createRoom|joinRoom|recruitPublicOpponent|findPublicOpponent|acceptCpuCharacter)\s*\(/);
  assert.match(app, /if \(!remoteProfile && starterProfile[^\n]+profiles\.push\(\[STARTER_PROFILE_ID, starterProfile\]\)/);
  assert.match(app, /const value = profile\(\); if \(!value \|\| profileSyncBusy\) return;\s*profileSyncBusy = true;\s*renderProfile\(\);/);
  assert.match(app, /finally \{ profileSyncBusy = false; renderProfile\(\); \}/);
});

test("connection status stays singular, live, and visible across every app tab", () => {
  assert.match(html, /class="card connection-card"[^>]+data-app-tab-panel="home battle quiz cards profile"/);
  assert.match(html, /id="connectionStatus"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.equal((html.match(/id="connectionBadge"/g) || []).length, 1);
  assert.equal((html.match(/id="connectionMessage"/g) || []).length, 1);
  assert.match(css, /body\[data-active-tab\]:not\(\[data-active-tab="home"\]\) \.connection-card\{position:fixed/);
  assert.match(css, /pointer-events:none/);
  assert.match(css, /bottom:calc\(88px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(app, /function reflectBrowserConnectivity\(\) \{\s*if \(!navigator\.onLine\) badge\("オフライン（復帰待ち）", "warn"\);\s*else if \(!roomSync\.snapshot\(\)\.active && connected\) badge\("匿名ログイン済み", "good"\);\s*\}/);
  assert.match(app, /addEventListener\("online", \(\) => \{ roomSync\.handleConnectivityChange\(\); reflectBrowserConnectivity\(\);/);
  assert.match(app, /addEventListener\("offline", \(\) => \{ roomSync\.handleConnectivityChange\(\); reflectBrowserConnectivity\(\);/);
});

test("server-hydrated progression renders stats, three trophies, and recent history as text", () => {
  assert.match(app, /function renderProgression\(\)/);
  assert.match(app, /show\("progressionPanel", synced && Boolean\(profile\(\)\)\)/);
  for (const trophyId of ["fullPaint", "fullPaint3", "noSkillFullPaint"]) assert.match(app, new RegExp(`${trophyId}:`));
  assert.match(app, /value\.matchHistory\.slice\(0, 10\)/);
  assert.match(app, /item\.append\(result, detail\)/);
  assert.doesNotMatch(app, /matchHistory[^\n]+innerHTML/);
  assert.match(progressionCss, /\.trophy\.unlocked/);
  assert.match(progressionCss, /\.history-win/);
});

test("card sale persists an immutable action before commit and hydrates only the server result", () => {
  assert.match(app, /const CARD_SALE_PENDING_KEY = "fourColorMapGame\.standard\.online\.v5\.pending-card-sale"/);
  assert.match(app, /client\.quoteCardSale\(\{ skillId, count \}\)/);
  const persisted = app.indexOf("localStorage.setItem(CARD_SALE_PENDING_KEY, JSON.stringify(pendingCardSale))");
  const sent = app.indexOf("client.sellCards(pendingCardSale)");
  assert.ok(persisted >= 0 && sent > persisted);
  assert.match(app, /persistRemoteProfile\(result\.profileState, displayName\(\), Number\(result\.revision\)\)/);
  assert.match(app, /cardSaleQuote\.requiresConfirmation === true/);
  assert.match(app, /client\.snapshot\(\)\.setupRevision > 0/);
});

test("online cosmetics require confirmation, persist retry identity, and allowlist visual classes", () => {
  assert.match(app, /const COSMETIC_PENDING_KEY = "fourColorMapGame\.standard\.online\.v5\.pending-cosmetic"/);
  assert.match(app, /client\.readCosmetics\(\)/);
  assert.match(app, /client\.quoteCosmetic\(\{ cosmeticId \}\)/);
  const persisted = app.indexOf("localStorage.setItem(COSMETIC_PENDING_KEY, JSON.stringify(pendingCosmeticAction))");
  const sent = app.indexOf("client.applyCosmetic(pendingCosmeticAction)");
  assert.ok(persisted >= 0 && sent > persisted);
  assert.match(app, /persistRemoteProfile\(result\.profileState, displayName\(\), Number\(result\.revision\)\)/);
  assert.match(app, /COSMETIC_STYLE_CLASS\[cosmeticId\]/);
  assert.doesNotMatch(app, /classList\.add\(item\.cssClass\)|innerHTML/);
  assert.match(css, /\.skin-board-aurora #board/);
  assert.match(css, /\.member-nameplate-gold/);
});

test("public matchmaking stays code-free, recoverable, cancellable, and separate from invitation rooms", () => {
  assert.match(html, /友だちと遊ぶ/);
  assert.match(html, /だれかと遊ぶ/);
  assert.match(app, /client\.recruitOpponent\(\{ displayName: displayName\(\) \}\)/);
  assert.match(app, /client\.findOpponent\(\{ displayName: displayName\(\) \}\)/);
  assert.match(app, /client\.readMatchmakingStatus\(\)/);
  assert.match(app, /client\.cancelMatchmaking\(\)/);
  assert.match(app, /accessMode === "public_queue" \? "野良対戦"/);
  assert.match(app, /document\.visibilityState === "hidden"/);
  assert.match(progressionCss, /prefers-reduced-motion: reduce/);
});

test("Standard lobby reflows before desktop side panels crush its actions", () => {
  assert.match(css, /@media\(max-width:1080px\) and \(min-width:761px\)\{/);
  assert.match(css, /#lobby \.lobby-choice-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /#lobby \.public-matchmaking\{grid-column:1\/-1\}/);
  assert.match(css, /#lobby \.lobby-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /#lobby \.lobby-choice button,#lobby \.lobby-choice input\{max-width:100%;overflow-wrap:anywhere\}/);
  assert.match(css, /@media\(max-width:760px\)\{#lobby \.public-matchmaking\{grid-column:auto\}\}/);
});

test("CPU fallback is consent-only after 90 seconds, reoffers at 3 minutes, and names all ten choices", () => {
  assert.match(app, /const CPU_FIRST_OFFER_SECONDS = 90/);
  assert.match(app, /const CPU_SECOND_OFFER_SECONDS = 180/);
  assert.match(app, /offerStage > cpuOfferDismissedStage/);
  assert.match(app, /選ばない限りCPU戦は始まりません/);
  assert.match(app, /client\.readCpuRoster\(\)/);
  assert.match(app, /result\.characters\.length !== 10/);
  assert.match(app, /client\.acceptCpuOpponent\(\{ characterId: character\.id \}\)/);
  assert.match(app, /client\.readMatchmakingStatus\(\)\.catch/);
  assert.match(app, /同時に人間の対戦相手が見つかりました/);
  assert.match(app, /member\.is_cpu/);
  for (const name of ["うっかりユズ", "せっかちレン", "見習いミナト", "読み違いコハル", "慎重派アオイ", "勝負師カイ", "仕掛け屋ツバサ", "観察役シオン", "カード博士レイ", "四色のクロガネ"]) assert.match(app, new RegExp(name));
  assert.doesNotMatch(app, /CPU.{0,20}(人間|プレイヤー).{0,20}(装う|偽る|見せかけ)/);
});

test("CPU turns are server-chosen one action at a time and stop while hidden or offline", () => {
  assert.match(app, /state\.active === "B"/);
  assert.match(app, /client\.takeCpuTurn\(\{ expectedVersion \}\)/);
  assert.match(app, /cpuActionTimer = setTimeout\(runCpuTurn, delay\)/);
  assert.match(app, /document\.visibilityState === "hidden"/);
  assert.match(app, /!navigator\.onLine/);
  assert.match(app, /function closeDisplayedRoom\(\)[\s\S]+roomModel\?\.room\?\.status !== "finished"[\s\S]+activateAppTab\("home"\)/);
  assert.match(app, /function closeDisplayedRoom\(\)[\s\S]+stopCpuTurnWatch\(\);[\s\S]+roomSync\.stop\(\);[\s\S]+client\.clearRoom\(\)/);
  assert.doesNotMatch(app, /takeCpuTurn\([^)]*(?:type|payload|action|privateState|publicState)/);
});

test("pregame abandon is distinct from screen-only close, surrender, and finished-result close", () => {
  assert.match(html, /id="leaveRoom"[^>]*>画面だけ閉じる</);
  assert.match(html, /id="leaveRoomDescription"[^>]*>ルーム・待機は継続します。/);
  assert.match(html, /id="abandonRoom"[^>]+aria-describedby="abandonRoomHint"[^>]*>開始前の対戦を取りやめる</);
  assert.match(html, /id="surrender"[^>]*>敗北として投了する</);
  assert.match(app, /\["waiting", "ready"\]\.includes\(roomModel\?\.room\?\.status\)/);
  assert.match(app, /\$\("leaveRoom"\)\.textContent = roomFinished \? "結果を閉じてロビーへ" : "画面だけ閉じる"/);
  assert.match(app, /\$\("abandonRoom"\)\.onclick = \(event\) => openRoomAbandonDialog/);
  assert.match(app, /\$\("surrender"\)\.onclick = \(\) => sendAction\("SURRENDER"\)/);
  const abandon = app.slice(app.indexOf("async function confirmRoomAbandon"), app.indexOf("function closeDisplayedRoom"));
  assert.match(abandon, /client\.abandonRoom\(\{ expectedVersion \}\)/);
  assert.doesNotMatch(abandon, /sendAction|SURRENDER|requestRematch|drawGacha|clearCpuRewardGachaResult/);
});

test("pregame abandon confirmation is safe-first, retryable, responsive, and singly announced", () => {
  const dialog = html.slice(html.indexOf('id="abandonRoomDialog"'), html.indexOf('id="cpuRosterDialog"'));
  assert.match(dialog, /aria-labelledby="abandonRoomTitle"[^>]+aria-describedby="abandonRoomDescription"/);
  assert.ok(dialog.indexOf('id="cancelAbandonRoom"') < dialog.indexOf('id="confirmAbandonRoom"'));
  assert.match(dialog, /戻る（対戦を続ける）/);
  assert.match(dialog, /無報酬で対戦を取りやめる/);
  assert.match(dialog, /戦績・報酬は発生せず[^<]+6枚や所持カードも消費されません[^<]+元に戻せません/);
  assert.match(html, /id="roomLifecycleAnnouncement"[^>]+room-lifecycle-announcement[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.doesNotMatch(html, /id="roomLifecycleAnnouncement"[^>]+visually-hidden/);
  assert.match(html, /id="abandonRoomStatus"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.doesNotMatch(dialog, /id="(?:abandonRoomDescription|abandonRoomHint)"[^>]+aria-live/);
  const abandon = app.slice(app.indexOf("function completeAbandonedRoom"), app.indexOf("function closeDisplayedRoom"));
  assert.match(abandon, /同じ取りやめ処理を再確認/);
  assert.match(abandon, /roomSync\.stop\(\)[\s\S]+client\.clearRoom\(\)[\s\S]+activateAppTab\("battle"\)/);
  assert.match(abandon, /\$\("abandonRoomTitle"\)\.focus/);
  assert.match(app, /abandonRoomDialog"\)\.addEventListener\("close"[\s\S]+trigger\.focus/);
  assert.match(app, /pendingLifecycleLobbyFocus[\s\S]+document\.visibilityState !== "visible"/);
  assert.doesNotMatch(abandon, /toast\(/);
  assert.match(css, /\.room-lifecycle-actions button\{min-height:44px\}/);
  assert.match(css, /\.room-abandon-dialog-actions button\{min-height:48px/);
  assert.match(css, /@media\(max-width:620px\)\{\.room-lifecycle-actions,\.room-abandon-dialog-actions\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.room-abandon-dialog/);
});

test("PvP and CPU records are visibly separate and CPU rematch uses its dedicated boundary", () => {
  assert.match(app, /value\.cpuStats \|\| \{\}/);
  assert.match(app, /value\.cpuCharacterStats \|\| \{\}/);
  assert.match(app, /対人戦 勝利/);
  assert.match(app, /CPU戦 勝利/);
  assert.match(app, /完了報酬：Lv\.1ガチャ券 \+1/);
  assert.match(app, /opponentKind === "cpu"/);
  assert.match(css, /\.terminal-progress\{[^}]*white-space:pre-line/);
  assert.match(app, /entry\.onlineOpponentKind === "cpu"/);
  assert.match(app, /roomModel\?\.room\?\.status === "finished"[\s\S]+?settledMatch\?\.matchId === state\.matchId[\s\S]+?Number\.isSafeInteger\(resultCount\)/);
  assert.match(app, /const cpuRewardWasSaved = progressWasSaved && opponentKind === "cpu" && !experimentalMatch/);
  assert.match(app, /show\("terminalGoGacha", cpuRewardWasSaved\)/);
  const terminalGachaHandler = app.slice(app.indexOf('$("terminalGoGacha").onclick'), app.indexOf('$("terminalClose").onclick'));
  assert.match(terminalGachaHandler, /dismissTerminalResult\(\);\s*goToGacha\(1\)/);
  assert.doesNotMatch(terminalGachaHandler, /runGacha|drawGacha|clearRoom|requestCpuRematch|beginImmediateCpuEntry/);
  assert.match(app, /\$\("gachaTitle"\)\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /\.gacha-panel h2:focus,\.gacha-result-summary h3:focus\{[^}]*outline:3px solid #fde047/);
  assert.match(css, /\.terminal-confetti\{[^}]*overflow:hidden/);
  assert.match(app, /client\.requestCpuRematch\(\{ expectedVersion: roomModel\.room\.version \}\)/);
  assert.match(app, /同じCPUと再戦する/);
});

test("palette-change help explains permanent scope and bonus-use carryover", () => {
  assert.match(app, /持ち色の3枠から1枠を、対戦終了まで好きな色に変えます/);
  assert.match(app, /基本色2枠は回数無制限/);
  assert.match(app, /おまけ色枠を変えても回数は増えず、今の残り回数を新しい色が引き継ぎます/);
});

test("every finished match presents a local-seat victory or defeat overlay, including surrender", () => {
  assert.match(app, /function renderTerminalResult\(state\)/);
  assert.match(app, /state\?\.status !== "FINISHED"/);
  assert.match(app, /const won = state\.winner === mySeat/);
  assert.match(app, /\$\("terminalTitle"\)\.textContent = won \? "勝利！" : "敗北"/);
  assert.match(app, /state\.terminalReason === "SURRENDER" && won \? "相手が投了しました"/);
  assert.match(app, /SURRENDER: `\$\{loser\} が投了しました。`/);
  assert.match(app, /requestAnimationFrame\(\(\) => \$\("terminalClose"\)\.focus/);
  assert.match(app, /alreadyPresented && shownTerminalEventKey !== eventKey/);
  assert.match(app, /dismissedTerminalEventKey = shownTerminalEventKey/);
  assert.doesNotMatch(app, /terminal(?:Title|Message|ReasonText)"\)\.innerHTML/);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[^{]*\{[^}]*\.terminal-overlay/);
});

test("gacha persists its action identity before sending and hydrates the committed server profile", () => {
  assert.match(app, /const GACHA_PENDING_KEY = "fourColorMapGame\.standard\.online\.v5\.pending-gacha"/);
  assert.match(app, /pendingGacha = \{ actionId: crypto\.randomUUID\(\), ticketLevel: level, count, \.\.\.\(continuation \? \{ continuation \} : \{\}\) \}/);
  const persisted = app.indexOf("localStorage.setItem(GACHA_PENDING_KEY, JSON.stringify(pendingGacha))");
  const sent = app.indexOf("client.drawGacha(pendingGacha)");
  assert.ok(persisted >= 0 && sent > persisted);
  assert.match(app, /persistRemoteProfile\(result\.profileState, displayName\(\), Number\(result\.revision\)\)/);
  assert.match(app, /localStorage\.removeItem\(GACHA_PENDING_KEY\)/);
  assert.match(app, /runGacha\(1, true\)/);
});

test("CPU completion gacha offers one explicit loadout rematch without crossing progression boundaries", () => {
  assert.match(html, /id="gachaResultTitle"[^>]*>次の対戦へ<\/h3>/);
  assert.match(html, /id="gachaResultAnnouncement"[^>]+visually-hidden[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(html, /id="gachaResults"[^>]+role="list"[^>]+aria-label="獲得カード一覧"[^>]+tabindex="-1"/);
  assert.match(html, /id="gachaCpuRematch"[^>]+type="button"[^>]*>6枚を選び直して同じCPUと再戦<\/button>/);
  assert.match(html, /カードは自動で6枚には入りません/);
  assert.match(app, /source: "cpu-completion-reward"/);
  assert.match(app, /value\.roomId === roomModel\?\.room\?\.id[\s\S]+value\.roomVersion === Number\(roomModel\?\.room\?\.version\)[\s\S]+value\.matchId === state\?\.matchId/);
  assert.match(app, /roomModel\?\.room\?\.opponent_kind === "cpu"/);
  assert.match(app, /state\?\.debugUnlimitedSkills !== true/);
  assert.match(app, /const distinctCardCount = new Set\(lastGachaDraws\.map\(\(draw\) => draw\.skillId\)\)\.size/);
  assert.match(app, /最高レアリティ星\$\{highestRarity\}。詳しくは獲得カード一覧で確認できます/);
  assert.match(app, /\$\("gachaDrawOne"\)\.disabled = gachaBusy \|\| Boolean\(pendingGacha\)/);
  assert.match(app, /\$\("gachaDrawAll"\)\.disabled = gachaBusy \|\| Boolean\(pendingGacha\)/);
  assert.match(app, /const canContinueCpuReward = hasResults && !pendingGacha && !gachaBusy && isCurrentCpuRewardGachaContinuation/);
  assert.match(app, /sessionStorage\.setItem\(CPU_REWARD_GACHA_RESULT_KEY/);
  assert.match(app, /function restoreCpuRewardGachaResult\(\)/);
  assert.match(app, /stored\.draws\.slice\(0, 100\)\.flatMap/);
  assert.match(app, /draw\.rarity < 1 \|\| draw\.rarity > 5/);
  assert.match(app, /\$\("gachaResults"\)\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /\$\("gachaResults"\)\.scrollIntoView/);
  assert.match(app, /show\("gachaResultSummary", canContinueCpuReward\)/);
  const continuation = app.slice(app.indexOf("async function continueCpuRewardRematch()"), app.indexOf("function dismissTerminalResult()"));
  assert.match(continuation, /if \(!isCurrentCpuRewardGachaContinuation\(lastGachaContinuation\) \|\| rematchBusy\) return/);
  assert.match(continuation, /await requestRematch\(\)/);
  assert.match(continuation, /roomModel\?\.room\?\.status !== "ready"/);
  assert.match(continuation, /activateAppTab\("battle"\)/);
  assert.doesNotMatch(continuation, /drawGacha|submitSetup|beginImmediateCpuEntry|inventory\[[^\]]+\]\s*=|\.checked\s*=/);
  assert.match(app, /\$\("gachaCpuRematch"\)\.onclick = continueCpuRewardRematch/);
  assert.match(css, /\.gacha-result-summary\{[^}]*scroll-margin-block-end:104px/);
});

test("existing online progression is hydrated from the server rather than re-uploaded", () => {
  assert.match(app, /const REMOTE_PROFILE_KEY = "fourColorMapGame\.standard\.online\.v5\.remote-profile"/);
  assert.match(app, /function hydrateProfileRow\(row\)/);
  assert.match(app, /if \(!row\?\.profile_state \|\| Number\(row\.revision\) === hydratedProfileRevision\) return/);
  const sync = app.slice(app.indexOf("async function syncSelectedProfile()"), app.indexOf("async function leaveRoom()"));
  assert.match(sync, /const remote = await client\.readProfile\(\)/);
  assert.match(sync, /if \(remote\) hydrateProfileRow\(remote\)/);
  assert.match(sync, /else \{[\s\S]+client\.syncProfile\(\{ displayName: displayName\(\), profileState: value \}\)/);
});

test("UI enumerates exactly the 19 canonical Standard cards by category", () => {
  const catalog = app.slice(app.indexOf("const SKILLS = ["), app.indexOf("];", app.indexOf("const SKILLS = [")) + 2);
  const ids = [...catalog.matchAll(/\["([A-Za-z][A-Za-z0-9]+)", "[^"]+", "(color|area|disrupt)"\]/g)].map((match) => match[1]);
  const canonical = Object.values(STANDARD_SKILLS).filter((skill) => skill.v49Catalogued).map((skill) => skill.id);
  assert.equal(ids.length, 19);
  assert.deepEqual([...ids].sort(), [...canonical].sort());
  assert.equal(new Set(ids).size, 19);
  assert.doesNotMatch(catalog, /legalRecolor/);
  assert.match(app, /const EXPERIMENTAL_SKILLS = Object\.freeze\(\{[\s\S]+legalRecolor/);
});

test("profile, room, setup, initialize, and reconnect flow only through the client boundary", () => {
  for (const method of ["ensureSession", "readProfile", "syncProfile", "createRoom", "joinRoom", "recruitOpponent", "findOpponent", "readMatchmakingStatus", "cancelMatchmaking", "submitSetup", "initialize", "readRoom", "clearRoom"]) {
    assert.match(app, new RegExp(`client\\.${method}\\(`));
  }
  assert.doesNotMatch(app, /supabase\.rpc\(|supabase\.functions\.invoke\(/);
  assert.match(app, /fourColorMapGame\.standard\.v5\.save/);
  assert.match(app, /if \(client\.snapshot\(\)\.roomId\)/);
  assert.match(app, /function hasStandardPublicState\(value\)/);
  assert.match(app, /!hasStandardPublicState\(roomModel\.room\.public_state\)/);
  assert.match(app, /if \(hasStandardPublicState\(roomModel\?\.room\?\.public_state\)\)/);
});

test("setup enforces two cards per category and makes unowned cards debug-only", () => {
  assert.match(app, /value\?\.inventory\?\.\[id\]/);
  assert.match(app, /debugMode \|\| \(value\?\.inventory\?\.\[id\] \|\| 0\) > 0/);
  assert.match(app, /if \(checked\.length > 2\)[\s\S]+?changed\.checked = false/);
  assert.match(app, /every\(\(category\) => loadout\[category\]\.length === 2\)/);
  assert.match(app, /renderLoadoutSelectionState\(`\$\{CATEGORY_LABEL\[category\]\}は2枚までです/);
  assert.match(app, /\$\("submitSetup"\)\.disabled = actionPending \|\| !ready/);
  assert.match(app, /client\.submitSetup\(\{\s*roomId: pendingSetup\?\.roomId,\s*expectedSetupRevision: pendingSetup\?\.expectedSetupRevision,\s*setupActionId: pendingSetup\?\.setupActionId,\s*loadout,\s*debugMode,\s*labMode,\s*\}\)/);
  assert.match(html, /id="debugUnlimitedMode"/);
  assert.match(html, /id="legalRecolorLabMode"/);
  assert.doesNotMatch(html, /id="(?:cpuStartReview|loadoutSummary)"[^>]+aria-live=/);
  assert.match(html, /id="setupCommitBar"[^>]+setup-commit-bar/);
  assert.match(app, /6枚を選択済み・準備OK/);
  assert.match(html, /id="submitSetup"[^>]+aria-describedby="cpuStartReview loadoutSummary setupStatus"[^>]+disabled/);
  assert.match(css, /body\.setup-active:is\(\[data-active-tab="battle"\],\[data-active-tab="cards"\]\) \.setup-commit-bar\{position:fixed/);
  assert.match(css, /body\.setup-active:is\(\[data-active-tab="battle"\],\[data-active-tab="cards"\]\) #setupCard\{padding-bottom:190px\}/);
  assert.match(css, /body\.setup-active:is\(\[data-active-tab="battle"\],\[data-active-tab="cards"\]\) \.connection-card\{bottom:calc\(222px/);
});

test("roomless loadout review defers CPU creation and persists one immutable two-step start", () => {
  assert.match(html, /id="editNextLoadout"/);
  assert.doesNotMatch(html, /id="editNextLoadout"[^>]+data-tab-jump/);
  assert.match(html, /id="setupCard"[^>]+data-app-tab-panel="battle cards"/);
  const directChoice = app.slice(app.indexOf("async function acceptCpuCharacter"), app.indexOf("async function beginImmediateCpuEntry"));
  assert.match(directChoice, /cpuEntryDraft = \{ characterId: character\.id, replaceRoomId: cpuRosterReplaceRoomId \}/);
  assert.doesNotMatch(directChoice.slice(0, directChoice.indexOf("cpuAcceptBusy = true")), /startCpuOpponent|acceptCpuOpponent/);
  assert.match(app, /CPU_START_SAGA_KEY/);
  assert.match(app, /stage: "start"[\s\S]+roomId: null[\s\S]+replaceRoomId: cpuEntryDraft\.replaceRoomId \|\| null[\s\S]+cpuStartActionId: crypto\.randomUUID\(\)[\s\S]+setupActionId: crypto\.randomUUID\(\)[\s\S]+canonicalLoadout/);
  assert.match(app, /replaceRoomId === false[\s\S]+stage === "setup" && !roomId[\s\S]+stage === "start" && value\.roomId != null/);
  assert.match(app, /persistCpuStartSaga\(saga\)[\s\S]+runPendingCpuStartSaga\(\)/);
  assert.match(app, /result\.startStatus === "recovered_existing"[\s\S]+persistCpuStartSaga\(null\)[\s\S]+新しい6枚は送信していません/);
  assert.match(app, /!\["created", "duplicate"\]\.includes\(result\.startStatus\)[\s\S]+INVALID_CPU_START_STATUS/);
  assert.match(app, /client\.submitSetup\(\{[\s\S]+setupActionId: saga\.setupActionId[\s\S]+loadout: saga\.canonicalLoadout/);
  assert.match(app, /saga = \{ \.\.\.saga, stage: "setup", roomId: result\.roomId \}[\s\S]+persistCpuStartSaga\(saga\)[\s\S]+client\.submitSetup/);
  assert.match(app, /pendingCpuStartSaga[\s\S]+await runPendingCpuStartSaga\(\)/);
  assert.match(app, /function focusStartedCpuMatch\(expectedInteractionRevision\) \{\s*alignPlayingViewport\(\{ expectedInteractionRevision, focusHeading: true \}\)/);
  assert.match(app, /async function commitCpuStartDraft\(\) \{\s*const interactionRevision = userInteractionRevision;[\s\S]+runPendingCpuStartSaga\(\{ focusOnSuccess: true, expectedInteractionRevision: interactionRevision \}\)/);
  assert.match(app, /addEventListener\("wheel",[\s\S]+\{ capture: true, passive: true \}/);
  assert.match(app, /const roomStatePending = Boolean\(snapshot\.roomId && !authoritativeRoomLoaded\)[\s\S]+!roomStatePending[\s\S]+対戦状態を確認しています。操作せず/);
});

test("every new-match handler shares the central local exclusivity guard", () => {
  assert.match(app, /function newMatchEntryBlock\([\s\S]+snapshot\.roomId[\s\S]+pendingCpuStartSaga \|\| cpuEntryDraft[\s\S]+snapshot\.matchmakingTicketId[\s\S]+snapshot\.matchmakingFindActionId/);
  assert.match(app, /async function recruitPublicOpponent\(\) \{\s*if \(guardNewMatchEntry\(\)/);
  assert.match(app, /async function findPublicOpponent\([^)]*\) \{\s*if \(guardNewMatchEntry/);
  assert.match(app, /async function createRoom\(\) \{\s*if \(guardNewMatchEntry\(\)\) return/);
  assert.match(app, /async function joinRoom\(\) \{\s*if \(guardNewMatchEntry\(\)\) return/);
  assert.match(app, /\$\("createRoom"\)\.disabled = newMatchBlocked[\s\S]+\$\("joinRoom"\)\.disabled = newMatchBlocked/);
  const directChoice = app.slice(app.indexOf("async function acceptCpuCharacter"), app.indexOf("async function beginImmediateCpuEntry"));
  assert.match(directChoice, /cpuRosterOrigin === "direct"[\s\S]+guardNewMatchEntry\(\{ replaceRoomId: cpuRosterReplaceRoomId \}\)[\s\S]+cpuEntryDraft =/);
  const sagaRunner = app.slice(app.indexOf("async function runPendingCpuStartSaga"), app.indexOf("async function commitCpuStartDraft"));
  assert.match(sagaRunner, /guardNewMatchEntry\(\{ allowCpuOwner: true, allowOwnedSagaRoom: true, replaceRoomId: pendingCpuStartSaga\.replaceRoomId \}\)[\s\S]+client\.startCpuOpponent/);
  const sagaCommit = app.slice(app.indexOf("async function commitCpuStartDraft"), app.indexOf("async function resumePendingCpuStart"));
  assert.match(sagaCommit, /const replaceRoomId = pendingCpuStartSaga\?\.replaceRoomId \|\| cpuEntryDraft\?\.replaceRoomId \|\| null[\s\S]+guardNewMatchEntry\(\{ allowCpuOwner: true, replaceRoomId, allowOwnedSagaRoom: true \}\)[\s\S]+if \(pendingCpuStartSaga\)/);
  const guard = app.slice(app.indexOf("function guardNewMatchEntry"), app.indexOf("function renderCpuRoster"));
  assert.match(guard, /cpuRosterDialog"\)\.open[\s\S]+cpuRosterDialog"\)\.close\(\)[\s\S]+activateAppTab\("battle"\)/);
  assert.match(guard, /matchmakingStatus"\)\.focus/);
  assert.match(html, /id="matchmakingStatus"[^>]+tabindex="-1"/);
});

test("server-only active rooms recover through one read-only path without consuming a pending CPU setup saga", () => {
  assert.match(app, /async function recoverServerActiveRoom[\s\S]+client\.recoverActiveRoom\(\)[\s\S]+enterPublicMatch\(message\)/);
  for (const handler of ["recruitPublicOpponent", "findPublicOpponent", "createRoom", "joinRoom"]) {
    const start = app.indexOf(`async function ${handler}`);
    assert.ok(start >= 0, `${handler} exists`);
    assert.match(app.slice(start, start + 1800), /recoverServerActiveRoom/);
  }
  const saga = app.slice(app.indexOf("async function runPendingCpuStartSaga"), app.indexOf("async function commitCpuStartDraft"));
  assert.doesNotMatch(saga, /recoverServerActiveRoom/);
  assert.match(app, /else if \(pendingCpuStartSaga\) await runPendingCpuStartSaga\(\)[\s\S]+else \{\s*const recoveredAtBoot = await recoverServerActiveRoom/);
  assert.match(app, /続きの合言葉対戦が見つかりました[\s\S]+この端末では合言葉を再表示できません/);
  assert.match(app, /queueMatchedRoomHandoff\(message, \{ autoWhenIdle: false \}\)/);
});

test("server rule errors are safe, persistent, and never offered as an idempotent retry", () => {
  assert.match(clientSource, /context\?\.clone/);
  assert.match(clientSource, /typeof readable\?\.json === "function"/);
  assert.match(clientSource, /Object\.hasOwn\(PUBLIC_FUNCTION_ERRORS, rawCode\)/);
  assert.match(clientSource, /NO_COLOR_DECLARATION_RETIRED: "「塗れる色なし」の申告は廃止されました/);
  assert.match(clientSource, /RETRYABLE_FUNCTION_ERROR_CODES\.has\(code\)/);
  assert.match(clientSource, /httpStatus === 0 && !knownCode/);
  const action = app.slice(app.indexOf("async function sendAction"), app.indexOf("async function syncSelectedProfile"));
  assert.match(action, /if \(error\?\.retryable === false\) \{\s*pendingAction = null/);
  assert.match(action, /同じ操作を再送/);
  assert.match(html, /id="setupStatus"[^>]+operation-feedback[^>]+aria-atomic="true"/);
  assert.match(html, /id="actionStatus"[^>]+operation-feedback[^>]+aria-atomic="true"/);
  assert.match(css, /\.operation-feedback\[data-tone="error"\]/);
  assert.match(css, /scroll-margin-bottom:calc\(100px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /@media\(max-width:700px\)\{#toast\{bottom:calc\(104px \+ env\(safe-area-inset-bottom\)\);z-index:70\}body\[data-active-tab\]:not\(\[data-active-tab="home"\]\) #toast\{top:calc\(64px \+ env\(safe-area-inset-top\)\);bottom:auto\}\}/);
  const reveal = app.slice(app.indexOf("function revealOperationFeedback"), app.indexOf("function setupFailureMessage"));
  assert.match(reveal, /requestAnimationFrame\(\(\) => \{[^]*?scrollIntoView\(\{ block: "center", inline: "nearest" \}\)/);
  assert.doesNotMatch(reveal, /\.focus\(/);
  assert.match(app, /setupFailure = \{ roomId: client\.snapshot\(\)\.roomId, message \}/);
  assert.match(app, /setupFailure\.roomId !== roomId/);
  assert.match(action, /pendingAction\.roomId !== roomId \|\| pendingAction\.matchId !== matchId/);
  assert.match(action, /pendingAction = \{ roomId, matchId, id: crypto\.randomUUID\(\)/);
  assert.match(app, /client\.clearRoom\(\);\s*roomModel = null;\s*setupFailure = null;\s*pendingAction = null/);
});

test("turn guide moves from selection to handoff without exposing a legality oracle", () => {
  assert.match(html, /id="turnGuide"[^>]*>\s*<span[^>]+id="turnGuideStep"[\s\S]{0,180}<div role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(app, /function renderTurnGuide\(state\)/);
  assert.match(app, /if \(state\.status !== "ACTIVE" \|\| targetDraft\) return show\("turnGuide", false\)/);
  assert.match(app, /盤面をタップ／クリックして、あと\$\{remaining\}マス選ぶ/);
  assert.match(app, /選んだエリアは相手が塗ります。相手が困る形や接し方を考えてみましょう。/);
  assert.match(app, /makerIsMe \? `あなたが作る → \$\{opponent\}が塗る` : `\$\{opponent\}が作る → あなたが塗る`/);
  assert.match(app, /\["CREATE_FIRST", "WORK"\]\.includes\(state\.phase\) \? myTurn : state\.phase === "COLOR" && !myTurn/);
  assert.match(app, /\${opponent}があなたへ渡すエリアを作っています/);
  assert.match(app, /あなたが作った灰色エリアの彩色を待っています/);
  assert.match(app, /選べました。「このエリアを渡す」へ/);
  assert.match(app, /受け取った灰色エリアを塗る/);
  assert.match(app, /if \(actionBusy\) return present\("wait", "送信中"/);
  assert.match(app, /if \(pendingAction\) return present\("ready", "再送"/);
  assert.match(app, /function phaseLabelFor\(state, seat, cpuRoom\)/);
  assert.match(app, /WORK: `\$\{actor\}が渡すエリアを選んでいます`/);
  assert.match(app, /submitRegion"\)\.disabled = !canCreate \|\| actionBusy/);
  assert.match(app, /roomModel\?\.room\?\.status !== "playing" \|\| state\.status !== "ACTIVE"/);
  assert.match(app, /if \(\$\(id\)\.textContent !== value\) \$\(id\)\.textContent = value/);
  assert.doesNotMatch(app, /turnGuide[^\n]+(?:legalColors|adjacentColors|使用可能な色)/);
  assert.match(css, /\.turn-guide\{display:grid/);
});

test("board omits historical region spotlights while keeping current selection and a local one-shot turn beat", () => {
  const observer = app.slice(app.indexOf("function clearTurnArrivalBeat"), app.indexOf("function observeCommittedContact"));
  assert.doesNotMatch(app, /boardSpotlightModel|renderBoardSpotlightLegend|strokeRegionBoundary/);
  assert.doesNotMatch(app, /#facc15[^\n]+cssDash: \[8, 5\]|#22d3ee[^\n]+cssWidth: 3\.5/);
  assert.doesNotMatch(html, /boardSpotlightLegend|lastMoveSpotlightLegend|pendingSpotlightLegend|金破線：直前|水色実線：今回/);
  assert.doesNotMatch(css, /board-spotlight-legend|board-spotlight-line|padding-bottom:34px/);
  assert.match(app, /for \(const macro of selectedMacros\)[\s\S]+ctx\.strokeRect/);
  assert.match(app, /connectedCandidateMacros\(state\)[\s\S]+color: "#86efac"/);
  assert.match(app, /targetDraft\?\.kind === "corner-bloom"[\s\S]+color: "#f0abfc"[\s\S]+color: "#fdf4ff"/);
  assert.match(app, /const cssScale = displayedWidth > 0 \? ctx\.canvas\.width \/ displayedWidth : 1/);
  assert.match(app, /if \(hasStandardPublicState\(publicState\)\) renderBoard\(publicState\)/);
  assert.match(observer, /previousStatus === "ACTIVE" && previousActive !== seat && active === seat/);
  assert.match(observer, /if \(version === observedTurnVersion\) return/);
  assert.match(app, /async function refreshRoom[\s\S]+if \(turnArrivalBackgrounded && document\.visibilityState === "visible"\) turnArrivalBackgrounded = false/);
  assert.match(observer, /competingPresentation[\s\S]+contactReveal[\s\S]+randomReveal/);
  assert.match(app, /turnArrivalBackgrounded = true;\s*clearTurnArrivalBeat\(\)/);
  assert.doesNotMatch(observer, /localStorage|sessionStorage|client\.|submitAction|Math\.random|crypto/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.turn-guide\.turn-arrival-beat,#board\.turn-arrival-beat\{animation:none!important;transition:none!important\}\}/);
});

test("board selection assist enlarges targets and supports connected keyboard selection without becoming a legality oracle", () => {
  assert.match(html, /id="boardViewport" class="board-viewport"/);
  assert.match(html, /id="board"[^>]+tabindex="-1"[^>]+aria-describedby="boardKeyboardHelp boardKeyboardStatus"/);
  assert.match(html, /id="boardKeyboardStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /id="toggleBoardZoom"[^>]+aria-pressed="false"[^>]*>盤面を拡大<\/button>/);
  assert.match(html, /id="turnGuide"[\s\S]{0,450}<button id="toggleBoardZoom"/);
  assert.doesNotMatch(html, /id="regionControls"[\s\S]{0,180}id="toggleBoardZoom"/);
  assert.match(css, /body\[data-active-tab="battle"\] \.board-viewport\.is-zoomed #board\{width:200%;max-width:none\}/);
  assert.match(css, /\.board-viewport #board\{[^}]*touch-action:pan-x pan-y/);
  assert.match(css, /\.board-viewport:focus-within\{outline:3px solid #f0abfc/);
  assert.match(css, /\.board-zoom-toggle\{min-width:64px;min-height:44px/);
  assert.doesNotMatch(css, /\.board-zoom-toggle\{[^}]*position:absolute/);
  assert.match(css, /\.turn-guide-step\{grid-column:1;grid-row:1;[^}]*\}\.turn-guide>\.board-zoom-toggle\{grid-column:2;grid-row:1\}\.turn-guide>div\{grid-column:1\/-1;grid-row:2\}/);
  const assist = app.slice(app.indexOf("function boardSelectionAvailable"), app.indexOf("function strokeMacroFrame"));
  assert.match(assist, /function connectedMacros\(macros, width\)/);
  assert.match(assist, /function macroHasFreeMicro\(state, macro\)/);
  assert.match(assist, /function connectedCandidateMacros\(state\)/);
  assert.match(assist, /白い枠と辺でつながる隣のマスを選んでください/);
  assert.match(assist, /次に辺でつなげて選べる候補/);
  assert.match(assist, /空きあり、現在の選択とは非接続/);
  assert.match(assist, /resetBoardSelectionAssist\(\{ clearSelection: true \}\)/);
  assert.match(assist, /if \(clearSelection\) \{\s*selectedMacros\.clear\(\);\s*announceBoardSelection\(""\)/);
  assert.match(assist, /\["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"\]/);
  assert.match(assist, /\[" ", "Enter"\]\.includes\(event\.key\)/);
  assert.match(assist, /event\.key === "Escape"/);
  assert.match(app, /moved <= 10 && scrolled <= 4\) boardPointer\(event\)/);
  assert.match(app, /strokeMacroFrame\(ctx, macro[\s\S]+color: "#f0abfc"/);
  assert.match(app, /strokeMacroFrame\(ctx, macro[\s\S]+color: "#86efac"/);
  assert.match(app, /color: "#fdf4ff", cssWidth: 1\.5, cssDash: \[\], cssInset: 8/);
  assert.match(html, /緑の破線は次に辺でつなげて選べる位置の目印、紫と白の二重線は現在のキーボード位置/);
  assert.match(app, /if \(tab !== "battle"\) resetBoardSelectionAssist\(\)/);
  assert.match(assist, /toggle\.classList\.toggle\("hidden", !interactive\)/);
  assert.match(app, /ensureMoveControlsVisible = false/);
  assert.match(app, /const overlap = controls\.getBoundingClientRect\(\)\.bottom - connection\.getBoundingClientRect\(\)\.top/);
  assert.match(app, /const adjustment = Math\.min\(Math\.max\(0, Math\.ceil\(overlap \+ 8\)\), available\)/);
  assert.match(app, /behavior: "auto", ensureMoveControlsVisible: true/);
  assert.match(app, /緑の破線は辺でつなげて選べる位置の目印です。確定できるかはサーバーが判定します。/);
  assert.match(css, /\.skin-board-aurora \.board-viewport\{outline:3px solid #22d3ee/);
  assert.match(css, /\.skin-board-aurora \.board-viewport #board,[^}]+\{outline:none;box-shadow:none\}/);
  assert.match(css, /\.board-viewport:has\(#board\.turn-arrival-beat\)\{animation:turn-arrival-board-frame/);
  assert.doesNotMatch(css, /body\[data-active-tab="battle"\]\{padding-bottom:132px\}/);
  assert.doesNotMatch(assist, /sendAction|submitAction|availableColorChoices|legalColors|adjacentRegionIds|contactColor/);
  assert.match(app, /sendAction\("CREATE_REGION", \{ sourceMacros: \[\.\.\.selectedMacros\]\.sort/);
});

test("a fresh device can create a six-card online-only starter without overwriting the Standard save", () => {
  assert.match(app, /fourColorMapGame\.standard\.online\.v5\.starter-profile/);
  assert.match(app, /const STARTER_INVENTORY = Object\.freeze\(\{/);
  for (const id of ["colorRandomBorrow", "colorChoiceBorrow", "areaMicroBloom", "areaDiePlus", "disruptRandomOne", "disruptChoiceOne"]) {
    assert.match(app, new RegExp(`${id}: 3`));
  }
  assert.match(app, /localStorage\.setItem\(STARTER_PROFILE_KEY/);
  assert.doesNotMatch(app, /localStorage\.setItem\(SAVE_KEY/);
  assert.match(app, /syncSetupModeControls\(client\.snapshot\(\), \{ force: true \}\);\s*loadProfiles\(\);\s*activateAppTab\(activeAppTab\);\s*render\(\);\s*try \{/);
  assert.match(app, /syncProfile"\)\.disabled = !value \|\| !connected/);
});

test("remote labels and projections are rendered as text, not HTML", () => {
  assert.match(app, /node\.textContent = `Player \$\{member\.seat\}: \$\{cosmeticIdentity\(member\.display_name, member\.appearance\)\}`/);
  assert.match(app, /\$\("publicProjection"\)\.textContent = safeJson\(publicState\)/);
  assert.match(app, /\$\("privateProjection"\)\.textContent = safeJson\(privateState\)/);
  assert.doesNotMatch(app, /innerHTML/);
  assert.doesNotMatch(app, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service_role/i);
});

test("UI does not expose an adjacency or legal-color oracle", () => {
  assert.doesNotMatch(html + app, /legal colors?|legalColors|adjacent colors?|adjacentColors|使用可能な色[:：]/i);
});

test("public color seals disable only paint intents before an action identity is allocated", () => {
  assert.match(app, /function isColorSealed\(state, seat, color\)/);
  assert.match(app, /state\?\.publicEffects\?\.\[seat\]\?\.seals\?\.\[color\]/);
  assert.match(app, /sealed \? `🔒 \$\{COLOR_JA\[color\] \|\| color\}（封印中）`/);
  assert.match(app, /button\.disabled = actionBusy \|\| sealed/);
  assert.match(app, /button\.className = `color-button\$\{sealed \? " is-sealed" : ""\}`/);
  const sendAction = app.slice(app.indexOf("async function sendAction"), app.indexOf("async function syncSelectedProfile"));
  assert.ok(sendAction.indexOf('type === "COLOR_REGION" && isColorSealed') < sendAction.indexOf("const signature = actionSignature"));
  assert.ok(sendAction.indexOf('type === "COLOR_REGION" && isColorSealed') < sendAction.indexOf("crypto.randomUUID()"));
  assert.ok(sendAction.indexOf('type === "COLOR_REGION" && isColorSealed') < sendAction.indexOf("client.submitAction"));
  assert.match(sendAction, /return;[\s\S]+const signature = actionSignature/);
  assert.match(app, /if \(\["color", "slot-color"\]\.includes\(targetDraft\.kind\)\) \{\s*for \(const color of skillIntents\.COLORS\)/);
  const sealGuard = sendAction.slice(0, sendAction.indexOf("const signature = actionSignature"));
  assert.doesNotMatch(sealGuard, /regions|adjacent|legal/i);
  assert.match(css, /\.color-button\.is-sealed:disabled/);
});

test("private basic colors keep a readable text separator between visual swatches", () => {
  assert.match(app, /for \(const \[index, color\] of \(privateState\.basicPalette \|\| \[\]\)\.entries\(\)\) \{\s*if \(index\) \$\("basicPaletteValue"\)\.append\("・"\);\s*appendColorValue\(\$\("basicPaletteValue"\), color\);\s*\}/);
});

test("basic board actions keep blocked COLOR voluntary and projection-bounded", () => {
  assert.match(app, /roomModel\.room\.public_state/);
  assert.match(app, /roomModel\.view\?\.private_state/);
  assert.match(app, /sendAction\("CREATE_REGION", \{ sourceMacros:/);
  assert.match(app, /sendAction\("COLOR_REGION", \{ color \}\)/);
  assert.match(app, /sendAction\("SURRENDER"\)/);
  assert.match(html, /id="colorResponse"[\s\S]+id="colorRescueGuide"[\s\S]+自動では敗北せず[\s\S]+id="showColorSkills"[\s\S]+id="colorSurrender"[^>]+aria-describedby="colorRescueExplanation"/);
  assert.doesNotMatch(html, /id="declareNoColor"|サーバーに「塗れる色なし」と申告/);
  assert.match(app, /canRespondToColor = myTurn && state\.phase === "COLOR" && !targetDraft/);
  assert.match(app, /showColorSkills[\s\S]+button\[data-skill\]:not\(:disabled\)[\s\S]+category === "color"[\s\S]+scrollIntoView/);
  assert.match(app, /if \(!initialHydrationPending\) requestAnimationFrame/);
  assert.match(app, /持ち色を再確認し、それでも塗れなければ自分で投了/);
  assert.match(app, /colorSurrender[\s\S]+sendAction\("SURRENDER"\)/);
  assert.doesNotMatch(app, /onclick = \(\) => sendAction\("DECLARE_NO_COLOR"/);
  assert.match(app, /NO_COLOR_DECLARATION_RETIRED[\s\S]+申告は廃止されました[\s\S]+手番・カードは減っていません/);
  assert.doesNotMatch(app, /client\.submitAction\([^)]*(?:state|publicState|privateState)/);
});

test("failed actions retain the exact identity and retry only the same intent", () => {
  assert.match(app, /pendingAction = \{ roomId, matchId, id: crypto\.randomUUID\(\), expectedVersion: roomModel\.room\.version, type, payload, signature \}/);
  assert.match(app, /if \(retry && \(!pendingAction \|\| pendingAction\.roomId !== roomId \|\| pendingAction\.matchId !== matchId \|\| pendingAction\.signature !== signature\)\)/);
  assert.match(app, /await client\.submitAction\(pendingAction\)/);
  assert.match(app, /sendAction\(pendingAction\.type, pendingAction\.payload, true\)/);
  assert.match(app, /pendingAction = null; selectedMacros\.clear\(\)/);
});

test("all 19 skill target kinds route through the reviewed intent builder", () => {
  assert.match(app, /Object\.entries\(privateState\.hand \|\| \{\}\)/);
  assert.match(app, /skillIntents\.isImmediate\(skill\)/);
  assert.match(app, /skillIntents\.buildSkillPayload\(skill\)/);
  assert.match(app, /skillIntents\.buildSkillPayload\(targetDraft\.skill, input\)/);
  for (const kind of ["color", "slot-color", "region-split", "source-macros", "corner-bloom", "resize", "band-shift"]) {
    assert.match(app, new RegExp(kind));
  }
  assert.match(app, /sendAction\("USE_SKILL", payload\)/);
});

test("corner bloom uses a board-first two-stage target flow without raw macro input", () => {
  const target = app.slice(app.indexOf("function cornerBloomTargetReady"), app.indexOf("function boardSelectionAvailable"));
  assert.match(target, /相手に渡すエリアを盤面であと\$\{state\.requiredSize - selectedMacros\.size\}マス/);
  assert.match(target, /盤面で渡すエリアを選ぶ[\s\S]+board\.focus\(\{ preventScroll: true \}\)[\s\S]+board\.scrollIntoView/);
  assert.match(target, /白い枠で選んだエリアの中から基準にする1マスをタップ/);
  assert.match(target, /boardMacroCoordinateLabel\(state, macro\)/);
  assert.match(target, /aria-label", "角を広げる基準マス"/);
  assert.match(target, /useTarget\.disabled = !cornerBloomTargetReady\(state\)/);
  assert.match(target, /skill-target-feedback/);
  assert.doesNotMatch(target, /input\.type = "number"[\s\S]+角の基準マス/);
  assert.match(app, /targetDraft\?\.kind === "corner-bloom"\) return selectCornerBloomMacro\(state, macro\)/);
  assert.match(app, /selectedMacros\.has\(targetDraft\.input\.macro\)/);
  assert.match(css, /\.corner-bloom-board-focus,\.corner-bloom-targets button\{min-height:44px\}/);
  assert.match(app, /targetDraft\?\.kind !== "corner-bloom" \|\| selectedMacros\.size < state\.requiredSize/);
  assert.match(css, /\.skill-target-feedback\[data-tone="error"\]/);
});

test("half shift and triple shift select their bands on the board without raw position controls", () => {
  const target = app.slice(app.indexOf("function bandShiftAxisBounds"), app.indexOf("function submitSkillTarget"));
  const board = app.slice(app.indexOf("function boardMacroDescription"), app.indexOf("async function sendAction"));
  assert.match(target, /\[\["ROW", "横の行を選ぶ"\], \["COLUMN", "縦の列を選ぶ"\]\]/);
  assert.match(target, /盤面で三層の中央をタップ/);
  assert.match(target, /function selectBandShiftMacro\(state, macro\)/);
  assert.match(target, /targetDraft\.input\.axis === "ROW" \? Math\.floor\(macro \/ width\) : macro % width/);
  assert.match(target, /index > min && index < max/);
  assert.match(target, /\[\["minus", "← 左へ"\], \["plus", "右へ →"\]\]/);
  assert.match(target, /\[\["minus", "↑ 上へ"\], \["plus", "下へ ↓"\]\]/);
  assert.match(target, /useTarget\.disabled = !bandShiftTargetReady\(state\)/);
  assert.doesNotMatch(target, /input\.type = "number"|createElement\("select"\)|正方向|負方向/);
  assert.match(board, /targetDraft\?\.kind === "band-shift"\) selectBandShiftMacro\(state, macro\)/);
  assert.match(board, /color: center \? "#fde047" : "#d8b4fe"/);
  assert.match(app, /\["corner-bloom", "band-shift"\]\.includes\(targetDraft\.kind\)/);
  assert.match(css, /@media\(max-width:390px\)\{\.shift-axis-controls button,[^}]*min-height:48px/);
});

test("skill target cancel is write-free and clears only transient selection", () => {
  const cancelTarget = app.slice(app.indexOf("function cancelSkillTarget"), app.indexOf("function renderSkillTarget"));
  assert.match(app, /"キャンセル", cancelSkillTarget/);
  assert.match(cancelTarget, /preserveBoardSelection = targetDraft\?\.kind === "corner-bloom"[\s\S]+if \(!preserveBoardSelection\) selectedMacros\.clear\(\);[\s\S]+render\(\);/);
  assert.match(cancelTarget, /candidate\.dataset\.skill === skill[\s\S]+source\?\.focus/);
  assert.doesNotMatch(cancelTarget, /sendAction|submitAction/);
  assert.match(app, /盤面選択を解除/);
  assert.doesNotMatch(app, /キャンセル[^\n]+submitAction/);
});

test("finished rooms expose a reconnect-safe rematch request", () => {
  assert.match(app, /show\("rematchControls", !cpuDraftOwnsRoomlessEntry && roomModel\?\.room\?\.status === "finished"\)/);
  assert.match(app, /client\.requestRematch\(\{ expectedVersion: roomModel\.room\.version \}\)/);
  assert.match(app, /rematchPending \? "同じ再戦申請を再送"/);
  assert.match(app, /await roomSync\.refreshNow\(\)/);
  assert.match(app, /roomModel\.room\.status === "ready" && client\.snapshot\(\)\.setupRevision > 0/);
});
