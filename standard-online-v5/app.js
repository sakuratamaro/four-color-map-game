import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import "../online/supabase-config.js";

const cfg = globalThis.FourColorSupabaseConfig;
const supabase = createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
const client = globalThis.FourColorStandardOnlineClient.createStandardOnlineClient({ supabase, storage: localStorage, idFactory: () => crypto.randomUUID() });
const onlineSyncFactory = globalThis.FourColorStandardOnlineSync;
const skillIntents = globalThis.FourColorStandardOnlineSkillIntents;
const $ = (id) => document.getElementById(id);
const SAVE_KEY = "fourColorMapGame.standard.v5.save";
const PROFILE_CHOICE_KEY = "fourColorMapGame.standard.online.v5.profile";
const STARTER_PROFILE_KEY = "fourColorMapGame.standard.online.v5.starter-profile";
const STARTER_PROFILE_ID = "online-starter";
const REMOTE_PROFILE_KEY = "fourColorMapGame.standard.online.v5.remote-profile";
const REMOTE_PROFILE_ID = "online-server";
const GACHA_PENDING_KEY = "fourColorMapGame.standard.online.v5.pending-gacha";
const CPU_REWARD_GACHA_RESULT_KEY = "fourColorMapGame.standard.online.v5.cpu-reward-gacha-result";
const QUIZ_PENDING_KEY = "fourColorMapGame.standard.online.v5.pending-quiz";
const TERMINAL_PRESENTED_KEY = "fourColorMapGame.standard.online.v5.last-terminal-presentation";
const APP_TAB_KEY = "fourColorMapGame.standard.online.v5.active-tab";
const CPU_ENTRY_INTENT_KEY = "fourColorMapGame.standard.online.v5.cpu-entry-intent";
const LOADOUT_DRAFT_KEY = "fourColorMapGame.standard.online.v5.loadout-draft";
const CPU_START_SAGA_KEY = "fourColorMapGame.standard.online.v5.cpu-start-saga";
const QUIZ_TIMEOUT_ANSWER = "__timeout__";
const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
const SVG_NS = "http://www.w3.org/2000/svg";
const CARD_SALE_PENDING_KEY = "fourColorMapGame.standard.online.v5.pending-card-sale";
const COSMETIC_PENDING_KEY = "fourColorMapGame.standard.online.v5.pending-cosmetic";
const STARTER_INVENTORY = Object.freeze({
  colorRandomBorrow: 3, colorChoiceBorrow: 3,
  areaMicroBloom: 3, areaDiePlus: 3,
  disruptRandomOne: 3, disruptChoiceOne: 3,
});
const SKILLS = [
  ["colorRandomBorrow", "色拾い・乱", "color"], ["colorChoiceBorrow", "色借り", "color"], ["colorPrism", "四色解放", "color"],
  ["colorRegionSplit", "エリア二分", "color"], ["colorPaletteChange", "持ち色変更", "color"],
  ["areaMicroBloom", "ひとふくらみ", "area"], ["areaDiePlus", "エリア拡張", "area"], ["areaResize", "拡大縮小", "area"],
  ["areaCornerBloom", "角膨張", "area"], ["areaHalfShift", "半マスシフト", "area"], ["areaTripleShift", "三層断層", "area"],
  ["disruptRandomOne", "色封じ・乱", "disrupt"], ["disruptChoiceOne", "色封じ", "disrupt"], ["disruptRandomTwo", "二重封じ・乱", "disrupt"],
  ["disruptPaletteRandom", "持ち色汚染・乱", "disrupt"], ["disruptChoiceTwo", "追封", "disrupt"], ["disruptPaletteChoice", "持ち色汚染", "disrupt"],
  ["disruptChoiceThree", "長封", "disrupt"], ["disruptForcedPalette", "強制持ち替え", "disrupt"],
];
const CATEGORY_LABEL = { color: "色カード", area: "エリアカード", disrupt: "妨害カード" };
const PHASE_LABEL = {
  CREATE_FIRST: "最初に渡すエリアを選んでください",
  WORK: "相手に渡すエリアを選んでください",
  COLOR: "受け取ったエリアを塗ってください",
  GAME_OVER: "対戦終了",
};
const ROOM_STATUS_LABEL = { waiting: "相手を待っています", ready: "6枚セット選択中", playing: "対戦中", finished: "対戦終了", abandoned: "開始前に取りやめ済み" };
const CPU_NAMES = Object.freeze({
  yuzu: "うっかりユズ", ren: "せっかちレン", minato: "見習いミナト", koharu: "読み違いコハル", aoi: "慎重派アオイ",
  kai: "勝負師カイ", tsubasa: "仕掛け屋ツバサ", shion: "観察役シオン", rei: "カード博士レイ", kurogane: "四色のクロガネ",
});
const LOADOUT_CATEGORIES = Object.freeze(["color", "area", "disrupt"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CPU_FIRST_OFFER_SECONDS = 90;
const CPU_SECOND_OFFER_SECONDS = 180;
const RANDOM_REVEAL_DURATION_MS = 2600;
const MATCHED_ROOM_FEEDBACK_MS = 650;
const QUIZ_ROOM_CHECK_STATUS = "保存済みの対戦状態を確認しています。クイズの時計は確認完了まで止まります。";
const TROPHY_META = Object.freeze({
  fullPaint: { icon: "🗺️", name: "完塗り達成", condition: "盤面をすべて塗り切って勝利" },
  fullPaint3: { icon: "🏆", name: "完塗り三冠", condition: "完塗り勝利を3回達成" },
  noSkillFullPaint: { icon: "✨", name: "四色の匠", condition: "スキルを使わず完塗り勝利" },
});
const COSMETIC_TYPE_LABEL = Object.freeze({ board: "盤面枠", effect: "発動演出", nameplate: "名札", title: "称号" });
const COSMETIC_STYLE_CLASS = Object.freeze({
  boardAurora: "skin-board-aurora", boardGold: "skin-board-gold", boardCartographer: "skin-board-cartographer",
  effectSakura: "skin-effect-sakura", effectPrism: "skin-effect-prism", effectMasterpiece: "skin-effect-masterpiece",
  nameplateGold: "skin-nameplate-gold",
});
const COSMETIC_PREVIEW_CLASS = new Set(["aurora", "gold", "sakura", "prism", "cartographer"]);
const COSMETIC_TITLE_LABEL = Object.freeze({ titleArtisan: "四色の匠" });
const TERMINAL_REASON_LABEL = Object.freeze({
  SURRENDER: "投了", BOARD_LOCK: "完塗り", ILLEGAL_COLOR: "接色禁止違反",
  SEALED_OUT: "色封じ", NO_LEGAL_COLOR: "使用可能色なし",
});
const SKILL_DESCRIPTION = Object.freeze({
  colorRandomBorrow: "盤面ですでに使われている色から、1色をランダムでこの彩色中だけ借ります。抽選された色は自分だけに表示されます。",
  colorChoiceBorrow: "盤面ですでに使われている色を1色選び、この彩色中だけ借ります。借りた色は色ボタンに追加されます。",
  colorPrism: "この彩色中だけ、赤・青・黄・緑の4色を使えるようにします。",
  colorRegionSplit: "いま塗る相手のエリアを、つながった2つのエリアに分けます。分けた片方を先に塗ります。",
  colorPaletteChange: "持ち色の3枠から1枠を、対戦終了まで好きな色に変えます。基本色2枠は回数無制限。おまけ色枠を変えても回数は増えず、今の残り回数を新しい色が引き継ぎます。",
  areaMicroBloom: "これから渡すエリアの角をランダムに少しふくらませ、斜めのエリアと接触させます。",
  areaDiePlus: "この手番で相手に渡すエリアを1マス増やします。置ける場所がある時だけ使えます。",
  areaResize: "盤面の上下左右を1列ぶん拡大、または縮小します。すでに塗られた形はそのまま残ります。",
  areaCornerBloom: "選んだ基準マスの使える角をすべて少しふくらませます。",
  areaHalfShift: "指定した行または列を、半マスぶんずらします。エリアが分かれる場合があります。",
  areaTripleShift: "指定した行または列と、その両隣を段差状にずらします。中央は1マス、両隣は半マス動きます。",
  disruptRandomOne: "相手の色をランダムに1色選び、次の彩色1回だけ封じます。空振りになる場合もあります。",
  disruptChoiceOne: "選んだ1色を相手の次の彩色1回だけ封じます。使用後、自分にもランダムな色封じが1回返ってきます。",
  disruptRandomTwo: "相手の色をランダムに異なる2色選び、次の彩色1回だけ封じます。",
  disruptPaletteRandom: "色と相手の持ち色枠をランダムに選び、その枠を次の彩色1回だけ入れ替えます。",
  disruptChoiceTwo: "選んだ1色を、相手の次の彩色2回ぶん封じます。",
  disruptPaletteChoice: "入れ替える色を選び、相手のどの持ち色枠に入るかはランダムで決まります。効果は彩色2回ぶんです。",
  disruptChoiceThree: "選んだ1色を、相手の次の彩色3回ぶん封じます。",
  disruptForcedPalette: "入れ替える色を選び、相手のランダムな持ち色枠を対戦終了まで変更します。",
});
const RANDOM_SKILLS = new Set(["colorRandomBorrow", "areaMicroBloom", "disruptRandomOne", "disruptRandomTwo", "disruptPaletteRandom", "disruptPaletteChoice", "disruptForcedPalette"]);
const RANDOM_REVEAL_PREFIX = "fourColorMapGame.standard.online.v5.random-reveal.";
let localRoot = null;
let availableProfiles = {};
let selectedProfileId = null;
let synced = false;
let connected = false;
let profileSyncBusy = false;
let hydratedProfileRevision = -1;
let roomModel = null;
let initializeBusy = false;
let setupBusy = false;
let actionBusy = false;
let abandonBusy = false;
let abandonRetryRoomId = null;
let abandonRetryExpectedVersion = null;
let abandonDialogTrigger = null;
let restoreAbandonDialogFocus = true;
let pendingLifecycleLobbyFocus = false;
let roomLifecycleAnnouncementToken = 0;
let setupFailure = null;
let rematchBusy = false;
let gachaBusy = false;
let quizBusy = false;
let cardSaleBusy = false;
let cosmeticBusy = false;
let cosmeticProjection = null;
let cosmeticCatalogLoaded = false;
let matchmakingBusy = false;
let matchmakingStatusTimer = null;
let matchmakingDisplayTimer = null;
let cpuRosterCache = null;
let cpuAcceptBusy = false;
let cpuRosterOrigin = "fallback";
let cpuRosterTrigger = null;
let cpuRosterReplaceRoomId = null;
let cpuOfferTicketId = null;
let cpuOfferDismissedStage = 0;
let cpuOfferAnnouncedStage = 0;
let cpuActionTimer = null;
let cpuActionBusy = false;
let loadoutWorkshopOpen = false;
let cpuEntryDraft = null;
let cpuStartSagaBusy = false;

function normalizeLoadout(value, { requireComplete = false, checkOwned = false } = {}) {
  const result = Object.fromEntries(LOADOUT_CATEGORIES.map((category) => [category, []]));
  if (!value || typeof value !== "object" || Array.isArray(value)) return requireComplete ? null : result;
  const currentProfile = profile();
  for (const category of LOADOUT_CATEGORIES) {
    if (!Array.isArray(value[category])) return requireComplete ? null : result;
    const seen = new Set();
    for (const skillId of value[category]) {
      const skill = SKILLS.find(([id, , kind]) => id === skillId && kind === category);
      if (!skill || seen.has(skillId) || (checkOwned && Number(currentProfile?.inventory?.[skillId] || 0) < 1)) continue;
      seen.add(skillId);
      result[category].push(skillId);
    }
    result[category].sort((left, right) => SKILLS.findIndex(([id]) => id === left) - SKILLS.findIndex(([id]) => id === right));
    if (requireComplete && result[category].length !== 2) return null;
    result[category] = result[category].slice(0, 2);
  }
  return result;
}

function restoreLoadoutDraft() {
  try { return normalizeLoadout(JSON.parse(localStorage.getItem(LOADOUT_DRAFT_KEY) || "null")); }
  catch { return normalizeLoadout(null); }
}

function restoreCpuStartSaga() {
  try {
    const value = JSON.parse(localStorage.getItem(CPU_START_SAGA_KEY) || "null");
    const loadout = normalizeLoadout(value?.canonicalLoadout, { requireComplete: true });
    const stage = value?.stage;
    const roomId = stage === "setup" && UUID_PATTERN.test(String(value?.roomId)) ? value.roomId : null;
    const replaceRoomId = value?.replaceRoomId == null ? null : UUID_PATTERN.test(String(value.replaceRoomId)) ? value.replaceRoomId : false;
    if (!value || !UUID_PATTERN.test(String(value.cpuStartActionId)) || !UUID_PATTERN.test(String(value.setupActionId))
      || !Object.hasOwn(CPU_NAMES, value.characterId) || !loadout || !["start", "setup"].includes(stage)
      || replaceRoomId === false || (stage === "setup" && !roomId) || (stage === "start" && value.roomId != null)) return null;
    return { stage, roomId, replaceRoomId, cpuStartActionId: value.cpuStartActionId, setupActionId: value.setupActionId, characterId: value.characterId, canonicalLoadout: loadout };
  } catch { return null; }
}

let nextLoadoutDraft = restoreLoadoutDraft();
let pendingCpuStartSaga = restoreCpuStartSaga();
if (pendingCpuStartSaga) nextLoadoutDraft = pendingCpuStartSaga.canonicalLoadout;
function restoreCpuRewardGachaResult() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CPU_REWARD_GACHA_RESULT_KEY) || "null");
    const continuation = stored?.continuation;
    const normalizedContinuation = continuation?.source === "cpu-completion-reward"
      && typeof continuation.roomId === "string" && continuation.roomId.length <= 100
      && Number.isSafeInteger(continuation.roomVersion) && continuation.roomVersion >= 0
      && typeof continuation.matchId === "string" && continuation.matchId.length <= 100
      && continuation.ticketLevel === 1
      ? {
          source: "cpu-completion-reward",
          roomId: continuation.roomId,
          roomVersion: continuation.roomVersion,
          matchId: continuation.matchId,
          ticketLevel: 1,
        }
      : null;
    const draws = Array.isArray(stored?.draws) ? stored.draws.slice(0, 100).flatMap((draw) => {
      const skill = SKILLS.find(([skillId, , category]) => skillId === draw?.skillId && category === draw?.category);
      if (!skill || !Number.isSafeInteger(draw.ticketLevel) || draw.ticketLevel < 1 || draw.ticketLevel > 5
        || !Number.isSafeInteger(draw.rarity) || draw.rarity < 1 || draw.rarity > 5) return [];
      return [{ ticketLevel: draw.ticketLevel, rarity: draw.rarity, category: skill[2], skillId: skill[0], displayName: skill[1] }];
    }) : [];
    return { continuation: normalizedContinuation, draws };
  } catch {
    return { continuation: null, draws: [] };
  }
}
const restoredCpuRewardGachaResult = restoreCpuRewardGachaResult();
let lastGachaDraws = restoredCpuRewardGachaResult.draws;
let terminalCpuRewardGachaCandidate = null;
let armedCpuRewardGachaOrigin = null;
let lastGachaContinuation = restoredCpuRewardGachaResult.continuation;
let pendingGacha = (() => { try { return JSON.parse(localStorage.getItem(GACHA_PENDING_KEY) || "null"); } catch { return null; } })();
let pendingQuiz = (() => { try { return JSON.parse(localStorage.getItem(QUIZ_PENDING_KEY) || "null"); } catch { return null; } })();
let lastQuizResult = null;
let cardSaleQuote = null;
let pendingCardSale = (() => { try { return JSON.parse(localStorage.getItem(CARD_SALE_PENDING_KEY) || "null"); } catch { return null; } })();
let pendingCosmeticAction = (() => { try { return JSON.parse(localStorage.getItem(COSMETIC_PENDING_KEY) || "null"); } catch { return null; } })();
let pendingAction = null;
let targetDraft = null;
let randomRevealTimer = null;
let contactRevealTimer = null;
let contactPresentationGeneration = 0;
let observedTraceScope = null;
let observedTraceEventId = null;
let quizClockTimer = null;
let quizMathResizeObserver = null;
let quizTimeoutQueued = false;
let quizFeedbackGeneration = 0;
let quizFeedbackUntil = 0;
let quizPausedForMatchedRoom = false;
let quizRoomClassificationPending = Boolean(client.snapshot().roomId && pendingQuiz);
let matchedRoomHandoff = null;
let matchedRoomHandoffTimer = null;
let announcedMatchedRoomId = null;
let shownTerminalEventKey = null;
let dismissedTerminalEventKey = null;
let userInteractionRevision = 0;
const selectedMacros = new Set();
const COLOR_HEX = { red: "#ef4444", blue: "#3b82f6", yellow: "#eab308", green: "#22c55e" };
const COLOR_JA = { red: "赤", blue: "青", yellow: "黄", green: "緑" };
const APP_TABS = new Set(["home", "battle", "quiz", "cards", "profile"]);
let activeAppTab = APP_TABS.has(location.hash.slice(1)) ? location.hash.slice(1) : localStorage.getItem(APP_TAB_KEY) || "home";
const SKILL_META = Object.fromEntries(SKILLS.map(([id, name, category]) => [id, { name, category }]));

function show(id, value) { $(id).classList.toggle("hidden", !value); }
function badge(text, tone = "warn") { $("connectionBadge").textContent = text; $("connectionBadge").className = `badge ${tone}`; }
function toast(message) { const node = $("toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2400); }
function operationFeedback(id, message, tone = "") {
  const node = $(id);
  node.textContent = String(message || "").slice(0, 240);
  node.dataset.tone = tone;
}
function persistedAbandonExpectedVersion(roomId = client.snapshot().roomId) {
  const snapshot = client.snapshot();
  const version = Number(snapshot.abandonExpectedVersion);
  return snapshot.roomId === roomId && snapshot.abandonRoomId === roomId && UUID_PATTERN.test(String(snapshot.abandonActionId))
    && Number.isSafeInteger(version) && version >= 0 ? version : null;
}
function abandonExpectedVersion(roomId = client.snapshot().roomId) {
  const persisted = persistedAbandonExpectedVersion(roomId);
  if (persisted !== null) return persisted;
  return abandonRetryRoomId === roomId && Number.isSafeInteger(abandonRetryExpectedVersion) ? abandonRetryExpectedVersion : null;
}
function hasPendingAbandon(roomId = client.snapshot().roomId) {
  return abandonBusy || abandonExpectedVersion(roomId) !== null;
}
function announceRoomLifecycle(message) {
  const node = $("roomLifecycleAnnouncement");
  const token = ++roomLifecycleAnnouncementToken;
  node.textContent = "";
  show("roomLifecycleAnnouncement", true);
  requestAnimationFrame(() => {
    if (token === roomLifecycleAnnouncementToken) node.textContent = message;
  });
}
function clearRoomLifecycleAnnouncement() {
  roomLifecycleAnnouncementToken += 1;
  $("roomLifecycleAnnouncement").textContent = "";
  show("roomLifecycleAnnouncement", false);
}
function focusBattleLobby() {
  pendingLifecycleLobbyFocus = document.visibilityState !== "visible";
  if (pendingLifecycleLobbyFocus) return;
  requestAnimationFrame(() => {
    if (activeAppTab === "battle" && !client.snapshot().roomId && !$("lobby").classList.contains("hidden")) {
      $("lobbyTitle").focus({ preventScroll: true });
      $("lobby").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  });
}
function revealOperationFeedback(id) {
  requestAnimationFrame(() => {
    const node = $(id);
    if (!node?.textContent) return;
    node.scrollIntoView({ block: "center", inline: "nearest" });
  });
}
function setupFailureMessage() {
  const roomId = client.snapshot().roomId;
  if (!setupFailure || setupFailure.roomId !== roomId) {
    setupFailure = null;
    return "";
  }
  return setupFailure.message;
}
function profile() { return availableProfiles[selectedProfileId] || null; }
function displayName() { return String(profile()?.displayName || "").trim().slice(0, 20); }
function persistLoadoutDraft(value) {
  const normalized = normalizeLoadout(value, { checkOwned: true });
  nextLoadoutDraft = normalized;
  try { localStorage.setItem(LOADOUT_DRAFT_KEY, JSON.stringify(normalized)); } catch { /* in-memory draft remains usable */ }
  return normalized;
}
function editorLoadout() {
  const result = normalizeLoadout(nextLoadoutDraft, { checkOwned: true });
  for (const category of LOADOUT_CATEGORIES) {
    for (const [skillId, , kind] of SKILLS) {
      if (kind === category && Number(profile()?.inventory?.[skillId] || 0) > 0 && !result[category].includes(skillId) && result[category].length < 2) {
        result[category].push(skillId);
      }
    }
  }
  return result;
}
function persistCpuStartSaga(value) {
  if (value) localStorage.setItem(CPU_START_SAGA_KEY, JSON.stringify(value));
  else localStorage.removeItem(CPU_START_SAGA_KEY);
  pendingCpuStartSaga = value;
}
function hasCpuEntryIntent() { return sessionStorage.getItem(CPU_ENTRY_INTENT_KEY) === "direct"; }
function setCpuEntryIntent(active) { if (active) sessionStorage.setItem(CPU_ENTRY_INTENT_KEY, "direct"); else sessionStorage.removeItem(CPU_ENTRY_INTENT_KEY); }
function renderProfileCardVisibility() { show("profileCard", activeAppTab !== "battle" || !synced); }
function safeJson(value) { return JSON.stringify(value, null, 2); }
function actionSignature(type, payload) { return JSON.stringify({ type, payload }); }
function hasStandardPublicState(value) {
  return Boolean(value && typeof value === "object" && value.playableBounds && Number.isSafeInteger(value.version));
}

for (const eventName of ["pointerdown", "keydown", "click"]) {
  document.addEventListener(eventName, () => { userInteractionRevision += 1; }, true);
}

function handoffFromSetupToMatch(expectedInteractionRevision) {
  if (roomModel?.room?.status !== "playing" || !hasStandardPublicState(roomModel.room.public_state)) return;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    const matchTitle = $("matchTitle");
    if (userInteractionRevision !== expectedInteractionRevision
      || activeAppTab !== "battle"
      || document.visibilityState !== "visible"
      || roomModel?.room?.status !== "playing"
      || matchTitle.closest(".hidden, .tab-panel-hidden")) return;
    matchTitle.focus({ preventScroll: true });
    $("matchCard").scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
  }, reducedMotion ? 0 : RANDOM_REVEAL_DURATION_MS);
}

function activateAppTab(requestedTab, { updateHash = true, scrollTop = true } = {}) {
  const tab = APP_TABS.has(requestedTab) ? requestedTab : "home";
  if (requestedTab === "battle" && hasMatchedRoomHandoff() && matchedRoomHandoffBlockReason()) {
    renderMatchedRoomHandoff();
    requestAnimationFrame(() => {
      $("matchedRoomHandoffTitle").focus({ preventScroll: true });
      $("matchedRoomHandoff").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    return;
  }
  const resumePausedQuiz = tab === "quiz" && quizPausedForMatchedRoom && !hasMatchedRoomHandoff()
    && (!client.snapshot().roomId || roomModel);
  if (resumePausedQuiz) resumeQuizClockOnQuizTab();
  activeAppTab = tab;
  localStorage.setItem(APP_TAB_KEY, tab);
  if (updateHash && location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
  for (const button of document.querySelectorAll("[data-app-tab]")) {
    const active = button.dataset.appTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  }
  for (const panel of document.querySelectorAll("[data-app-tab-panel]")) {
    const active = String(panel.dataset.appTabPanel || "").split(/\s+/).includes(tab);
    panel.classList.toggle("tab-panel-hidden", !active);
  }
  document.body.dataset.activeTab = tab;
  renderProfileCardVisibility();
  if (tab === "battle" && hasMatchedRoomHandoff()) pauseQuizClockForMatchedRoom();
  renderMatchedRoomHandoff();
  if (resumePausedQuiz) renderQuiz();
  if (tab === "battle") roomSync?.invalidate?.();
  if (scrollTop) window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function hasMatchedRoomHandoff() {
  return Boolean(matchedRoomHandoff?.roomId && client.snapshot().roomId === matchedRoomHandoff.roomId);
}

function quizLockedByMatchedRoom() {
  return Boolean(quizRoomClassificationPending || quizPausedForMatchedRoom
    || (hasMatchedRoomHandoff() && matchedRoomHandoff.quizBoundaryReached));
}

function pauseQuizClockForMatchedRoom() {
  if (pendingQuiz && pendingQuiz.answers.length < 10) {
    const state = quizPausedForMatchedRoom ? ensureQuizQuestionState() : settleQuizClock();
    quizPausedForMatchedRoom = true;
    if (state) state.lastTickAt = Date.now();
    savePendingQuiz();
  }
  stopQuizClock();
}

function resumeQuizClockOnQuizTab() {
  quizPausedForMatchedRoom = false;
  if (pendingQuiz?.questionState) {
    pendingQuiz.questionState.lastTickAt = Date.now();
    savePendingQuiz();
  }
}

function resolveQuizRoomClassification({ activePublicRoom = false } = {}) {
  quizRoomClassificationPending = false;
  if (activePublicRoom) return;
  if ($("quizStatus").textContent === QUIZ_ROOM_CHECK_STATUS) {
    $("quizStatus").textContent = pendingQuiz?.answerMode === "per-question-v1"
      ? "答えを選ぶと、その場で○×が分かります。"
      : "答えを選んでください。10問後にまとめてサーバー採点します。";
  }
  if (activeAppTab === "quiz") resumeQuizClockOnQuizTab();
}

function matchedRoomHandoffBlockReason() {
  if (!hasMatchedRoomHandoff()) return "";
  if (gachaBusy) return "抽選結果、または同じ抽選IDで再送できる状態を確認してから対戦へ移ります。";
  if (quizBusy) return "選んだ回答を同じ回答IDで確定してから対戦へ移ります。";
  if (Date.now() < quizFeedbackUntil) return "前問の○×を短く表示してから対戦へ移ります。";
  if (matchedRoomHandoff.waitForQuizBoundary && !matchedRoomHandoff.quizBoundaryReached) {
    if (pendingQuiz?.pendingAnswer) return "選んだ回答を同じ回答IDで再送・確定してから対戦へ移ります。";
    if (pendingQuiz && pendingQuiz.answers.length < 10) return "いまの問題に回答したところで対戦へ移ります。次の問題の時計は開始しません。";
  }
  return "";
}

function renderMatchedRoomHandoff() {
  if (!$('matchedRoomHandoff')) return;
  if (matchedRoomHandoff && client.snapshot().roomId !== matchedRoomHandoff.roomId) matchedRoomHandoff = null;
  if (matchedRoomHandoff && roomModel?.room?.id === matchedRoomHandoff.roomId && roomModel.room.status === "finished") {
    matchedRoomHandoff = null;
  }
  const visible = hasMatchedRoomHandoff() && activeAppTab !== "battle";
  show("matchedRoomHandoff", visible);
  $("connectionCard").classList.toggle("has-matched-room", visible);
  if (!visible) return;
  const blockReason = matchedRoomHandoffBlockReason();
  $("matchedRoomHandoffDetail").textContent = blockReason || "成立済みの対戦があります。ボタンで安全に対戦画面へ戻れます。";
  $("returnToMatchedRoom").disabled = Boolean(blockReason);
}

function focusMatchedRoom() {
  requestAnimationFrame(() => {
    const target = !$('setupCard').classList.contains("hidden") ? $("setupTitle") : $("matchTitle");
    if (target && !target.closest(".hidden, .tab-panel-hidden")) target.focus({ preventScroll: true });
  });
}

function focusStartedCpuMatch() {
  requestAnimationFrame(() => {
    if (activeAppTab !== "battle" || roomModel?.room?.status !== "playing") return;
    const target = $("matchTitle");
    if (!target.closest(".hidden, .tab-panel-hidden")) {
      target.focus({ preventScroll: true });
      $("matchCard").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  });
}

function goToMatchedRoom() {
  if (!hasMatchedRoomHandoff() || matchedRoomHandoffBlockReason()) return renderMatchedRoomHandoff();
  clearTimeout(matchedRoomHandoffTimer);
  matchedRoomHandoffTimer = null;
  pauseQuizClockForMatchedRoom();
  matchedRoomHandoff.arrived = true;
  activateAppTab("battle");
  renderMatchedRoomHandoff();
  focusMatchedRoom();
}

function flushMatchedRoomHandoff() {
  if (!hasMatchedRoomHandoff() || !matchedRoomHandoff.autoWhenIdle) return renderMatchedRoomHandoff();
  const blockReason = matchedRoomHandoffBlockReason();
  renderMatchedRoomHandoff();
  clearTimeout(matchedRoomHandoffTimer);
  matchedRoomHandoffTimer = null;
  if (!blockReason) return goToMatchedRoom();
  const feedbackDelay = Math.max(0, quizFeedbackUntil - Date.now());
  if (feedbackDelay > 0) matchedRoomHandoffTimer = setTimeout(flushMatchedRoomHandoff, feedbackDelay + 10);
}

function queueMatchedRoomHandoff(message, { autoWhenIdle = true } = {}) {
  const authoritativeRoomId = client.snapshot().roomId;
  if (!authoritativeRoomId) return false;
  const quizInProgress = Boolean(pendingQuiz) && pendingQuiz.answers.length < 10;
  const quizOperationInProgress = quizBusy;
  const feedbackInProgress = Date.now() < quizFeedbackUntil;
  if (matchedRoomHandoff?.roomId !== authoritativeRoomId) {
    matchedRoomHandoff = {
      roomId: authoritativeRoomId,
      autoWhenIdle,
      waitForQuizBoundary: quizInProgress || quizOperationInProgress,
      quizBoundaryReached: (!quizInProgress && !quizOperationInProgress) || feedbackInProgress,
      arrived: false,
    };
  } else {
    matchedRoomHandoff.autoWhenIdle ||= autoWhenIdle;
  }
  const shouldAnnounce = announcedMatchedRoomId !== authoritativeRoomId;
  if (shouldAnnounce) {
    announcedMatchedRoomId = authoritativeRoomId;
  }
  $("matchedRoomHandoffTitle").textContent = message;
  renderMatchedRoomHandoff();
  if (shouldAnnounce) requestAnimationFrame(() => {
    if (hasMatchedRoomHandoff() && announcedMatchedRoomId === authoritativeRoomId) $("matchedRoomAnnouncement").textContent = message;
  });
  requestAnimationFrame(flushMatchedRoomHandoff);
  return true;
}

function markQuizBoundaryForMatchedRoom({ feedback = false } = {}) {
  if (feedback) quizFeedbackUntil = Math.max(quizFeedbackUntil, Date.now() + MATCHED_ROOM_FEEDBACK_MS);
  if (!hasMatchedRoomHandoff()) return;
  matchedRoomHandoff.quizBoundaryReached = true;
  pauseQuizClockForMatchedRoom();
  renderMatchedRoomHandoff();
  flushMatchedRoomHandoff();
}

function playerName(seat) {
  return roomModel?.members?.find((member) => member.seat === seat)?.display_name || `Player ${seat}`;
}

function publicActorLabel(seat) {
  if (seat === roomModel?.view?.seat) return "あなた";
  if (roomModel?.room?.opponent_kind === "cpu" && seat === "B") return CPU_NAMES[roomModel.room.cpu_character_id] || "CPU";
  return "相手";
}

function validPublicTrace(state) {
  const trace = state?.lastPublicTrace;
  if (!trace || !["CREATE_REGION", "COLOR_REGION", "USE_SKILL"].includes(trace.type)
    || !["A", "B"].includes(trace.actor) || !Number.isSafeInteger(trace.version) || trace.version !== state.version
    || trace.eventId !== `${state.matchId}:${trace.version}`) return null;
  if (trace.type === "CREATE_REGION") {
    return typeof trace.regionId === "string"
      && Number.isSafeInteger(trace.sourceMacroCount) && trace.sourceMacroCount >= 1 && trace.sourceMacroCount <= 5
      && Number.isSafeInteger(trace.contactColorCount) && trace.contactColorCount >= 0 && trace.contactColorCount <= 4 ? trace : null;
  }
  if (trace.type === "COLOR_REGION") return typeof trace.regionId === "string" && skillIntents.COLORS.includes(trace.color) ? trace : null;
  return trace;
}

function nextPublicJudgment(state) {
  const actor = publicActorLabel(state.active);
  if (state.phase === "COLOR") return `${actor}が、隣接色と違う持ち色を選ぶ`;
  if (["CREATE_FIRST", "WORK"].includes(state.phase)) return `${actor}が、次に渡すエリアを作る`;
  return "対戦結果を確認する";
}

function renderTacticalTrace(state) {
  const trace = validPublicTrace(state);
  const visible = state?.status === "ACTIVE" && Boolean(trace);
  show("tacticalTrace", visible);
  if (!visible) return;
  const actor = publicActorLabel(trace.actor);
  if (trace.type === "CREATE_REGION") {
    $("tacticalTraceAction").textContent = `${actor}が${trace.sourceMacroCount}マスを渡した`;
    $("tacticalTraceChange").textContent = trace.contactColorCount === 0
      ? "受け取る灰色エリアは、色のついた領域と接していない"
      : `受け取る灰色エリアは、${trace.contactColorCount}色に接している`;
  } else if (trace.type === "COLOR_REGION") {
    const color = COLOR_JA[trace.color] || trace.color;
    $("tacticalTraceAction").textContent = `${actor}が${color}で塗った`;
    $("tacticalTraceChange").textContent = `受け取ったエリアが${color}の領域になった`;
  } else {
    $("tacticalTraceAction").textContent = `${actor}がスキルを使った`;
    $("tacticalTraceChange").textContent = "スキルの公開結果が盤面と対戦状態に反映された";
  }
  $("tacticalTraceNext").textContent = nextPublicJudgment(state);
}

function observeCommittedContact(state) {
  if (!state || !roomModel?.room?.id) {
    if (observedTraceScope !== null) clearContactReveal();
    observedTraceScope = null;
    observedTraceEventId = null;
    return;
  }
  const scope = `${roomModel.room.id}:${state.matchId}`;
  const trace = validPublicTrace(state);
  if (scope !== observedTraceScope) {
    clearContactReveal();
    observedTraceScope = scope;
    observedTraceEventId = trace?.eventId || null;
    return;
  }
  if (!trace || trace.eventId === observedTraceEventId) return;
  observedTraceEventId = trace.eventId;
  if (state.status === "ACTIVE" && trace.type === "CREATE_REGION" && trace.contactColorCount >= 2) showContactReveal(trace.contactColorCount);
}

function terminalReasonText(reason, winnerSeat) {
  const loserSeat = winnerSeat === "A" ? "B" : "A";
  const winner = playerName(winnerSeat);
  const loser = playerName(loserSeat);
  return {
    SURRENDER: `${loser} が投了しました。`,
    BOARD_LOCK: `${winner} が盤面をすべて塗り切りました。`,
    ILLEGAL_COLOR: `${loser} が接色禁止に違反しました。`,
    SEALED_OUT: `${loser} は色封じで使える色がなくなりました。`,
    NO_LEGAL_COLOR: `${loser} は塗れる色がなくなりました。`,
  }[reason] || "対戦結果が確定しました。";
}

function pendingContactPalette(state) {
  const pending = state?.regions?.[state?.pending];
  if (!pending || !Array.isArray(pending.micro)) return [];
  const derivedWidth = Number(state?.playableBounds?.macroWidth) * Number(state?.playableBounds?.microScale);
  const width = Number.isSafeInteger(state.microWidth) && state.microWidth > 0
    ? state.microWidth : Number.isSafeInteger(derivedWidth) && derivedWidth > 0 ? derivedWidth : 48;
  const owners = new Map();
  for (const region of Object.values(state.regions || {})) {
    for (const micro of region?.micro || []) owners.set(micro, region.id);
  }
  const contacts = new Set();
  for (const micro of pending.micro) {
    const col = micro % width;
    const neighbors = [micro - width, micro + width];
    if (col > 0) neighbors.push(micro - 1);
    if (col < width - 1) neighbors.push(micro + 1);
    for (const neighbor of neighbors) {
      const regionId = owners.get(neighbor);
      const color = regionId && regionId !== pending.id ? state.regions?.[regionId]?.color : null;
      if (color) contacts.add(color);
    }
  }
  return skillIntents.COLORS.filter((color) => contacts.has(color));
}

function colorList(colors) {
  return colors.map((color) => COLOR_JA[color] || color).join("・") || "なし";
}

function terminalReasonDetail(state, privateState) {
  const mySeat = roomModel?.view?.seat;
  const loserSeat = state?.winner === "A" ? "B" : "A";
  const terminalText = terminalReasonText(state?.terminalReason, state?.winner);
  const contact = state?.lastPublicTrace;
  const base = contact?.type === "CREATE_REGION" && contact.contactColorCount === 4
    ? `四色包囲（2 → 3 → 4色接触）\n${terminalText}` : terminalText;
  if (mySeat !== loserSeat || !["NO_LEGAL_COLOR", "SEALED_OUT"].includes(state?.terminalReason)) return base;
  const choices = skillIntents.availableColorChoices(privateState);
  const sealed = choices.filter((color) => isColorSealed(state, mySeat, color));
  if (state.terminalReason === "SEALED_OUT") {
    if (!choices.length || sealed.length !== choices.length) return base;
    return `${base}\n敗因の内訳：持ち色 ${colorList(choices)} がすべて封印され、使える色が0色でした。`;
  }
  const usable = choices.filter((color) => !isColorSealed(state, mySeat, color));
  const contacts = pendingContactPalette(state);
  if (!usable.length || !contacts.length || !usable.every((color) => contacts.includes(color))) return base;
  const sealedText = sealed.length ? ` 封印中：${colorList(sealed)}。` : "";
  return `${base}\n敗因の内訳：残っていた色 ${colorList(usable)} は、受け取った灰色エリアの隣接色 ${colorList(contacts)} と重なるため置けませんでした。${sealedText}`.trim();
}

function renderPersistentTerminalResult(state, privateState) {
  const finished = state?.status === "FINISHED" && ["A", "B"].includes(state.winner);
  show("terminalSummary", finished);
  if (!finished) return;
  const won = state.winner === roomModel?.view?.seat;
  $("terminalSummary").classList.toggle("is-defeat", !won);
  const title = won ? "勝利：決着理由" : "敗北：敗因";
  const reason = terminalReasonDetail(state, privateState);
  if ($("terminalOutcomeTitle").textContent !== title) $("terminalOutcomeTitle").textContent = title;
  if ($("terminalOutcomeReason").textContent !== reason) $("terminalOutcomeReason").textContent = reason;
}

function clearContactReveal({ clearAnnouncement = true } = {}) {
  contactPresentationGeneration += 1;
  clearTimeout(contactRevealTimer);
  contactRevealTimer = null;
  show("contactReveal", false);
  $("contactRevealCard").className = "contact-reveal-card";
  $("contactRevealSteps").replaceChildren();
  $("contactRevealTitle").textContent = "";
  $("contactRevealDetail").textContent = "";
  if (clearAnnouncement) $("contactRevealAnnouncement").textContent = "";
}

function showContactReveal(contactColorCount) {
  const reveals = {
    2: { title: "二色接触！", detail: "2色に接する灰色エリア", tone: "contact-pressure-2" },
    3: { title: "三色圧力!!", detail: "3色に接する強いエリア", tone: "contact-pressure-3" },
    4: { title: "四色包囲!!!", detail: "全色が一点へ集中", tone: "contact-pressure-4 epic" },
  };
  if (!reveals[contactColorCount]) return;
  const generation = ++contactPresentationGeneration;
  clearTimeout(contactRevealTimer);
  $("contactRevealAnnouncement").textContent = "";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stages = reducedMotion ? [contactColorCount] : Array.from({ length: contactColorCount - 1 }, (_, index) => index + 2);
  const presentStage = (stageIndex) => {
    if (generation !== contactPresentationGeneration) return;
    const stage = stages[stageIndex];
    const reveal = reveals[stage];
    const steps = [];
    for (let value = 2; value <= stage; value += 1) {
      if (steps.length) { const arrow = document.createElement("span"); arrow.className = "contact-reveal-arrow"; arrow.textContent = "→"; steps.push(arrow); }
      const badge = document.createElement("strong"); badge.className = `contact-reveal-step contact-step-${value}`; badge.textContent = String(value); steps.push(badge);
    }
    $("contactRevealSteps").replaceChildren(...steps);
    $("contactRevealCard").className = `contact-reveal-card ${reveal.tone}`;
    $("contactRevealTitle").textContent = reveal.title;
    $("contactRevealDetail").textContent = reveal.detail;
    show("contactReveal", true);
    if (stageIndex < stages.length - 1) {
      contactRevealTimer = setTimeout(() => presentStage(stageIndex + 1), 200);
      return;
    }
    requestAnimationFrame(() => {
      if (generation === contactPresentationGeneration) $("contactRevealAnnouncement").textContent = `${reveal.title} ${reveal.detail}`;
    });
    contactRevealTimer = setTimeout(() => {
      if (generation !== contactPresentationGeneration) return;
      contactRevealTimer = null;
      show("contactReveal", false);
      $("contactRevealCard").className = "contact-reveal-card";
      $("contactRevealSteps").replaceChildren();
      $("contactRevealTitle").textContent = "";
      $("contactRevealDetail").textContent = "";
    }, 700);
  };
  presentStage(0);
}

function renderTerminalResult(state) {
  const overlay = $("terminalOverlay");
  if (state?.status !== "FINISHED" || !["A", "B"].includes(state.winner)) {
    show("terminalOverlay", false);
    terminalCpuRewardGachaCandidate = null;
    shownTerminalEventKey = null;
    dismissedTerminalEventKey = null;
    return;
  }
  const eventKey = `${state.matchId || roomModel?.room?.id || client.snapshot().roomId}:${roomModel?.room?.version}:${state.winner}:${state.terminalReason || "FINISHED"}`;
  let alreadyPresented = false;
  try { alreadyPresented = localStorage.getItem(TERMINAL_PRESENTED_KEY) === eventKey; } catch { alreadyPresented = false; }
  if (alreadyPresented && shownTerminalEventKey !== eventKey) return show("terminalOverlay", false);
  if (dismissedTerminalEventKey === eventKey) return show("terminalOverlay", false);
  clearContactReveal();
  const mySeat = roomModel?.view?.seat;
  const won = state.winner === mySeat;
  overlay.classList.toggle("is-victory", won);
  overlay.classList.toggle("is-defeat", !won);
  $("terminalIcon").textContent = won ? "🏆" : "🗺️";
  $("terminalEyebrow").textContent = state.terminalReason === "SURRENDER" && won ? "相手が投了しました" : "対戦結果";
  $("terminalTitle").textContent = won ? "勝利！" : "敗北";
  $("terminalMessage").textContent = won ? `${playerName(mySeat)} の勝利です！` : `${playerName(state.winner)} の勝利です`;
  $("terminalReasonText").textContent = terminalReasonDetail(state, roomModel?.view?.private_state || {});
  const opponentKind = roomModel?.room?.opponent_kind;
  const stats = opponentKind === "cpu" ? profile()?.cpuStats : profile()?.stats;
  const resultCount = Number(stats?.[won ? "wins" : "losses"]);
  const resultLabel = opponentKind === "cpu" ? "CPU戦" : "対人戦";
  const settledMatch = profile()?.matchHistory?.find((entry) => entry?.matchId === state.matchId);
  const resultWasSaved = settledMatch?.result === (won ? "WIN" : "LOSS")
    && (opponentKind !== "cpu" || settledMatch.onlineOpponentKind === "cpu");
  const progressWasSaved = roomModel?.room?.status === "finished"
    && ["A", "B"].includes(mySeat)
    && settledMatch?.matchId === state.matchId
    && resultWasSaved
    && Number.isSafeInteger(resultCount)
    && resultCount >= 0;
  const cpuRewardWasSaved = progressWasSaved && opponentKind === "cpu" && state.debugUnlimitedSkills !== true;
  terminalCpuRewardGachaCandidate = cpuRewardWasSaved ? {
    source: "cpu-completion-reward",
    roomId: roomModel.room.id,
    roomVersion: Number(roomModel.room.version),
    matchId: state.matchId,
    ticketLevel: 1,
  } : null;
  $("terminalProgressText").textContent = progressWasSaved
    ? `戦績を保存しました：${resultLabel} ${won ? "勝利" : "敗北"} ${resultCount}${cpuRewardWasSaved ? "\n完了報酬：Lv.1ガチャ券 +1" : ""}`
    : "戦績を同期しています。マイページで確認できます。";
  show("terminalGoGacha", cpuRewardWasSaved);
  try { localStorage.setItem(TERMINAL_PRESENTED_KEY, eventKey); } catch { /* presentation still works when storage is unavailable */ }
  show("terminalOverlay", true);
  if (shownTerminalEventKey !== eventKey) {
    shownTerminalEventKey = eventKey;
    requestAnimationFrame(() => $("terminalClose").focus({ preventScroll: true }));
  }
}

function colorName(color) { return COLOR_JA[color] || "不明"; }

function renderColorValue(id, color, suffix = "") {
  const node = $(id); node.replaceChildren();
  const chip = document.createElement("span"); chip.className = `color-chip ${color || "unknown"}`; chip.setAttribute("aria-hidden", "true"); node.appendChild(chip);
  const label = document.createElement("span"); label.textContent = `${colorName(color)}${suffix}`; node.appendChild(label);
}

function appendColorValue(node, color, suffix = "") {
  const value = document.createElement("span");
  value.className = `inline-color-value ${color || "unknown"}`;
  const chip = document.createElement("span");
  chip.className = `color-chip ${color || "unknown"}`;
  chip.setAttribute("aria-hidden", "true");
  const label = document.createElement("strong");
  label.textContent = `${colorName(color)}${suffix}`;
  value.append(chip, label);
  node.appendChild(value);
}

function renderRandomSummary(publicState, privateState) {
  const changedSize = publicState.requiredSize !== publicState.rolledSize;
  $("rolledSizeValue").textContent = `${publicState.rolledSize}マス${changedSize ? `（スキル効果で現在${publicState.requiredSize}マス）` : ""}`;
  $("basicPaletteValue").replaceChildren();
  for (const [index, color] of (privateState.basicPalette || []).entries()) {
    if (index) $("basicPaletteValue").append("・");
    appendColorValue($("basicPaletteValue"), color);
  }
  if (!(privateState.basicPalette || []).length) $("basicPaletteValue").textContent = "確認中";
  renderColorValue("bonusColorValue", privateState.bonusColor, `（残り${privateState.bonusUsesRemaining || 0}回）`);
}

function revealRandomSetup(publicState, privateState) {
  const key = `${RANDOM_REVEAL_PREFIX}${publicState.matchId}`;
  if (!publicState.matchId || sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "shown");
  $("randomRevealTitle").textContent = `サイコロは ${publicState.rolledSize}マス！`;
  const detail = $("randomRevealDetail");
  detail.replaceChildren("全4色（赤・青・黄・緑）から、あなたの持ち色は ");
  (privateState.basicPalette || []).forEach((color, index) => {
    if (index) detail.append("・");
    appendColorValue(detail, color);
  });
  detail.append("。おまけ色は ");
  appendColorValue(detail, privateState.bonusColor, `（残り${privateState.bonusUsesRemaining || 0}回）`);
  detail.append("。すべてサーバーのランダム抽選です。");
  show("randomReveal", true);
  clearTimeout(randomRevealTimer);
  randomRevealTimer = setTimeout(() => show("randomReveal", false), RANDOM_REVEAL_DURATION_MS);
}

function openSkillInfo(skill) {
  const meta = SKILL_META[skill]; if (!meta) return;
  $("skillInfoTitle").textContent = meta.name;
  $("skillInfoTiming").textContent = meta.category === "color" ? "使えるタイミング：エリアを塗る前" : "使えるタイミング：エリアを渡す前";
  $("skillInfoBody").textContent = SKILL_DESCRIPTION[skill] || "説明を準備中です。";
  show("skillInfoRandom", RANDOM_SKILLS.has(skill));
  const dialog = $("skillInfoDialog");
  if (!dialog.open) dialog.showModal();
}

function loadProfiles() {
  try { localRoot = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch { localRoot = null; }
  let starterProfile = null;
  try { starterProfile = JSON.parse(localStorage.getItem(STARTER_PROFILE_KEY) || "null"); } catch { starterProfile = null; }
  let remoteProfile = null;
  try { remoteProfile = JSON.parse(localStorage.getItem(REMOTE_PROFILE_KEY) || "null"); } catch { remoteProfile = null; }
  const profiles = Object.entries(localRoot?.profiles || {});
  if (!remoteProfile && starterProfile && typeof starterProfile === "object" && !Array.isArray(starterProfile)) profiles.push([STARTER_PROFILE_ID, starterProfile]);
  if (remoteProfile && typeof remoteProfile === "object" && !Array.isArray(remoteProfile)) profiles.push([REMOTE_PROFILE_ID, remoteProfile]);
  availableProfiles = Object.fromEntries(profiles);
  $("profileSelect").replaceChildren();
  for (const [id, value] of profiles) {
    const option = document.createElement("option"); option.value = id; option.textContent = value.displayName || id; $("profileSelect").appendChild(option);
  }
  const saved = localStorage.getItem(PROFILE_CHOICE_KEY);
  selectedProfileId = profiles.some(([id]) => id === saved) ? saved : profiles[0]?.[0] || null;
  if (selectedProfileId) $("profileSelect").value = selectedProfileId;
  renderProfile();
}

function persistRemoteProfile(profileState, remoteName = null, revision = null) {
  if (!profileState || typeof profileState !== "object" || Array.isArray(profileState)) return;
  const next = JSON.parse(JSON.stringify(profileState));
  if (remoteName) next.displayName = String(remoteName).trim().slice(0, 20);
  localStorage.setItem(REMOTE_PROFILE_KEY, JSON.stringify(next));
  localStorage.setItem(PROFILE_CHOICE_KEY, REMOTE_PROFILE_ID);
  if (revision !== null && Number.isSafeInteger(Number(revision))) hydratedProfileRevision = Number(revision);
  loadProfiles();
}

function hydrateProfileRow(row) {
  if (!row?.profile_state || Number(row.revision) === hydratedProfileRevision) return;
  persistRemoteProfile(row.profile_state, row.display_name, Number(row.revision));
}

function renderProfile() {
  const value = profile();
  renderProfileCardVisibility();
  show("starterCreator", !value);
  $("syncProfile").disabled = !value || !connected || profileSyncBusy;
  $("profileSummary").textContent = value ? `${value.displayName} — 所持カード ${Object.values(value.inventory || {}).reduce((sum, count) => sum + count, 0)}枚` : "名前を入力して、はじめて用プロフィールを作成してください。";
  if (value) { renderLoadout(); renderGacha(); renderProgression(); renderCosmetics(); }
}

function displayDate(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(timestamp);
}

function appendStat(label, value, targetId = "profileStats") {
  const item = document.createElement("div");
  const number = document.createElement("strong"); number.textContent = String(value);
  const caption = document.createElement("span"); caption.textContent = label;
  item.append(number, caption); $(targetId).appendChild(item);
}

function renderProgression() {
  const value = profile();
  if (!value || !$("progressionPanel")) return;
  const stats = value.stats || {};
  $("profileCoins").textContent = `🪙 ${Number(value.coins || 0)}コイン`;
  $("profileStats").replaceChildren();
  appendStat("対人戦 勝利", Number(stats.wins || 0));
  appendStat("対人戦 敗北", Number(stats.losses || 0));
  appendStat("対人戦 連勝中", Number(stats.currentWinStreak || 0));
  appendStat("対人戦 最高連勝", Number(stats.bestWinStreak || 0));
  appendStat("総合 完塗り", Number(stats.fullPaints || 0));

  const cpuStats = value.cpuStats || {};
  $("cpuProfileStats").replaceChildren();
  appendStat("CPU戦 勝利", Number(cpuStats.wins || 0), "cpuProfileStats");
  appendStat("CPU戦 敗北", Number(cpuStats.losses || 0), "cpuProfileStats");
  appendStat("CPU戦 連勝中", Number(cpuStats.currentWinStreak || 0), "cpuProfileStats");
  appendStat("CPU戦 最高連勝", Number(cpuStats.bestWinStreak || 0), "cpuProfileStats");
  appendStat("CPU戦 完塗り", Number(cpuStats.fullPaints || 0), "cpuProfileStats");
  $("cpuCharacterRecords").replaceChildren();
  const characterStats = Object.entries(value.cpuCharacterStats || {}).filter(([, record]) => Number(record?.matches || 0) > 0);
  if (!characterStats.length) {
    const empty = document.createElement("p"); empty.className = "muted small"; empty.textContent = "CPUとの対戦記録はまだありません。";
    $("cpuCharacterRecords").appendChild(empty);
  } else {
    for (const [characterId, record] of characterStats.sort((a, b) => Number(b[1].matches) - Number(a[1].matches))) {
      const item = document.createElement("div"); item.className = "cpu-character-record";
      const name = document.createElement("strong"); name.textContent = CPU_NAMES[characterId] || characterId;
      const score = document.createElement("span"); score.textContent = `${Number(record.wins || 0)}勝 ${Number(record.losses || 0)}敗（${Number(record.matches || 0)}戦）`;
      item.append(name, score); $("cpuCharacterRecords").appendChild(item);
    }
  }

  $("trophyList").replaceChildren();
  for (const [id, meta] of Object.entries(TROPHY_META)) {
    const unlocked = value.trophies?.[id] === true;
    const item = document.createElement("article"); item.className = `trophy ${unlocked ? "unlocked" : "locked"}`;
    const icon = document.createElement("span"); icon.className = "trophy-icon"; icon.textContent = unlocked ? meta.icon : "🔒";
    const copy = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = meta.name;
    const condition = document.createElement("small"); condition.textContent = meta.condition;
    const status = document.createElement("span"); status.className = "trophy-status";
    status.textContent = unlocked ? `解除済み ${displayDate(value.trophyDates?.[id])}` : "未解除";
    copy.append(name, condition, status); item.append(icon, copy); $("trophyList").appendChild(item);
  }

  const history = Array.isArray(value.matchHistory) ? value.matchHistory.slice(0, 10) : [];
  $("matchHistory").replaceChildren();
  if (!history.length) {
    const empty = document.createElement("li"); empty.className = "empty-history"; empty.textContent = "オンライン対戦の記録はまだありません。";
    $("matchHistory").appendChild(empty);
  } else {
    for (const entry of history) {
      const item = document.createElement("li"); item.className = entry.result === "WIN" ? "history-win" : "history-loss";
      const result = document.createElement("strong"); result.textContent = entry.result === "WIN" ? "勝利" : "敗北";
      const detail = document.createElement("span");
      const reason = TERMINAL_REASON_LABEL[entry.terminalReason] || "対戦終了";
      const opponent = entry.onlineOpponentKind === "cpu" ? ` · CPU ${CPU_NAMES[entry.cpuCharacterId] || entry.cpuCharacterId}` : " · 対人戦";
      detail.textContent = `${displayDate(entry.endedAt)}${opponent} · ${reason}${entry.fullPaint ? " · 完塗り" : ""} · スキル${Number(entry.skillsUsed || 0)}回`;
      item.append(result, detail); $("matchHistory").appendChild(item);
    }
  }
  renderCardSale();
}

function applyCosmeticClasses() {
  for (const cssClass of Object.values(COSMETIC_STYLE_CLASS)) document.body.classList.remove(cssClass);
  for (const cosmeticId of Object.values(cosmeticProjection?.equipped || {})) {
    const cssClass = COSMETIC_STYLE_CLASS[cosmeticId];
    if (cssClass) document.body.classList.add(cssClass);
  }
}

function cosmeticIdentity(name, equipped) {
  const title = COSMETIC_TITLE_LABEL[equipped?.title];
  return title ? `${name}｜${title}` : name;
}

function renderCosmetics() {
  if (!$("cosmeticPanel")) return;
  const value = profile();
  const projection = cosmeticProjection;
  applyCosmeticClasses();
  $("cosmeticCatalog").replaceChildren();
  $("refreshCosmetics").disabled = cosmeticBusy || !synced;
  if (!value || !projection) {
    $("collectionIdentity").textContent = value?.displayName || "PLAYER";
    $("cosmeticCoins").textContent = `🪙 ${Number(value?.coins || 0)}コイン`;
    if (!cosmeticBusy) $("cosmeticStatus").textContent = synced ? "見た目一覧を読み込めませんでした。更新してください。" : "プロフィール同期後に利用できます。";
    show("cosmeticConfirmation", Boolean(pendingCosmeticAction));
    return;
  }
  $("collectionIdentity").textContent = cosmeticIdentity(value.displayName || "PLAYER", projection.equipped);
  $("cosmeticCoins").textContent = `🪙 ${Number(projection.coins || 0)}コイン`;
  const locked = cosmeticBusy || Boolean(pendingCosmeticAction);
  for (const item of Array.isArray(projection.items) ? projection.items : []) {
    const card = document.createElement("article");
    card.className = `collection-card${item.equipped ? " equipped" : ""}${!item.trophyUnlocked ? " locked" : ""}`;
    const type = document.createElement("strong"); type.textContent = COSMETIC_TYPE_LABEL[item.type] || "見た目";
    const preview = document.createElement("div");
    const previewClass = COSMETIC_PREVIEW_CLASS.has(item.previewClass) ? ` ${item.previewClass}` : "";
    preview.className = `collection-preview${previewClass}`; preview.textContent = String(item.preview || item.name || "PREVIEW");
    const name = document.createElement("h3"); name.textContent = String(item.name || item.cosmeticId || "見た目");
    const detail = document.createElement("p");
    detail.textContent = item.trophyId ? `トロフィー「${TROPHY_META[item.trophyId]?.name || "実績"}」で解放`
      : Number(item.price) > 0 ? `${Number(item.price)}コイン・対戦能力への効果なし` : "無料・対戦能力への効果なし";
    const select = button(item.equipped ? "装備中" : !item.trophyUnlocked ? "未解放" : item.owned ? "装備する" : "購入して装備", () => prepareOnlineCosmetic(item.cosmeticId));
    select.disabled = locked || item.equipped || !item.trophyUnlocked;
    card.append(type, preview, name, detail, select); $("cosmeticCatalog").appendChild(card);
  }
  const pending = pendingCosmeticAction;
  show("cosmeticConfirmation", Boolean(pending));
  show("cosmeticCommit", Boolean(pending) && !pending?.failed);
  show("cosmeticRetry", Boolean(pending?.failed));
  $("cosmeticCancel").disabled = cosmeticBusy;
  if (pending?.quote) {
    $("cosmeticConfirmationText").textContent = pending.quote.purchaseRequired
      ? `${pending.quote.name}を${Number(pending.quote.price)}コインで購入して装備します。残高は${Number(pending.quote.coinsAfter)}コインになります。`
      : `${pending.quote.name}を装備します。コインは消費しません。`;
  }
}

async function refreshOnlineCosmetics({ quiet = false } = {}) {
  if (cosmeticBusy || !synced || !profile()) return;
  cosmeticBusy = true;
  if (!quiet) $("cosmeticStatus").textContent = "サーバーから見た目一覧を読み込んでいます…";
  renderCosmetics();
  try {
    const result = await client.readCosmetics();
    cosmeticProjection = result.cosmetics;
    cosmeticCatalogLoaded = true;
    $("cosmeticStatus").textContent = "購入・装備した見た目は、次の端末でも復元されます。";
  } catch (error) {
    if (!quiet) $("cosmeticStatus").textContent = "見た目一覧を読み込めませんでした。通信後に更新してください。";
    toast(error.message || "見た目一覧を取得できませんでした。");
  } finally { cosmeticBusy = false; renderCosmetics(); }
}

async function prepareOnlineCosmetic(cosmeticId) {
  if (cosmeticBusy || pendingCosmeticAction) return;
  cosmeticBusy = true; $("cosmeticStatus").textContent = "サーバーで購入・装備内容を確認中…"; renderCosmetics();
  try {
    const result = await client.quoteCosmetic({ cosmeticId });
    pendingCosmeticAction = { actionId: crypto.randomUUID(), expectedRevision: Number(result.revision), cosmeticId, quote: result.quote, failed: false };
    localStorage.setItem(COSMETIC_PENDING_KEY, JSON.stringify(pendingCosmeticAction));
    $("cosmeticStatus").textContent = "内容を確認してから保存してください。キャンセル時は何も変更されません。";
  } catch (error) {
    $("cosmeticStatus").textContent = "この見た目は現在購入・装備できません。残高や解除条件を確認してください。";
    toast(error.message || "見た目を確認できませんでした。");
  } finally { cosmeticBusy = false; renderCosmetics(); }
}

async function commitOnlineCosmetic() {
  if (cosmeticBusy || !pendingCosmeticAction) return;
  cosmeticBusy = true; $("cosmeticStatus").textContent = "サーバーへ一度だけ保存しています…"; renderCosmetics();
  try {
    const result = await client.applyCosmetic(pendingCosmeticAction);
    persistRemoteProfile(result.profileState, displayName(), Number(result.revision));
    cosmeticProjection = result.cosmetics;
    const name = pendingCosmeticAction.quote?.name || "見た目";
    pendingCosmeticAction = null; localStorage.removeItem(COSMETIC_PENDING_KEY);
    $("cosmeticStatus").textContent = `${name}を一度だけ保存して装備しました。対戦能力は変わりません。`;
  } catch (error) {
    pendingCosmeticAction.failed = true;
    localStorage.setItem(COSMETIC_PENDING_KEY, JSON.stringify(pendingCosmeticAction));
    const remote = await client.readProfile().catch(() => null);
    if (remote) hydrateProfileRow(remote);
    $("cosmeticStatus").textContent = "結果を確認できませんでした。同じ処理IDで安全に再送するか、キャンセルして一覧を更新してください。";
    toast(error.message || "見た目を保存できませんでした。");
  } finally { cosmeticBusy = false; renderProgression(); renderCosmetics(); render(); }
}

function cancelOnlineCosmetic() {
  if (cosmeticBusy) return;
  pendingCosmeticAction = null; localStorage.removeItem(COSMETIC_PENDING_KEY);
  $("cosmeticStatus").textContent = "購入・装備をキャンセルしました。サーバーのデータは変更していません。";
  renderCosmetics();
}

function renderCardSale() {
  const value = profile();
  if (!value || !$("cardSaleSkill")) return;
  const select = $("cardSaleSkill");
  const previous = select.value;
  const sellable = SKILLS.filter(([id]) => (value.inventory?.[id] || 0) > 1 && value.protectedSkills?.[id] !== true);
  select.replaceChildren();
  for (const [id, name] of sellable) {
    const option = document.createElement("option"); option.value = id; option.textContent = `${name}（所持${value.inventory[id]}枚）`; select.appendChild(option);
  }
  if (sellable.some(([id]) => id === previous)) select.value = previous;
  const selectedOwned = Number(value.inventory?.[select.value] || 0);
  $("cardSaleCount").max = String(Math.max(1, Math.min(100, selectedOwned - 1)));
  const roomLocked = Boolean(client.snapshot().roomId
    && (client.snapshot().setupRevision > 0 || ["ready", "playing"].includes(roomModel?.room?.status)));
  select.disabled = cardSaleBusy || roomLocked || !sellable.length;
  $("cardSaleCount").disabled = select.disabled;
  $("cardSaleQuote").disabled = select.disabled;
  $("cardSaleCommit").disabled = cardSaleBusy || roomLocked || !cardSaleQuote;
  show("cardSaleCommit", Boolean(cardSaleQuote) && !pendingCardSale);
  show("cardSaleRetry", Boolean(pendingCardSale) && !cardSaleBusy);
  show("cardSaleReset", Boolean(pendingCardSale) && !cardSaleBusy);
  if (roomLocked && !pendingCardSale) $("cardSaleStatus").textContent = "6枚セット確認後または対戦中は売却できません。対戦終了後に利用できます。";
  else if (!sellable.length && !pendingCardSale) $("cardSaleStatus").textContent = "いま売れる余剰カードはありません（各カードを1枚残します）。";
}

function clearCardSaleDraft() {
  cardSaleQuote = null;
  pendingCardSale = null;
  localStorage.removeItem(CARD_SALE_PENDING_KEY);
  $("cardSaleStatus").textContent = "カードと枚数を選んでください。";
  renderCardSale();
}

async function quoteOnlineCardSale() {
  if (cardSaleBusy || !profile()) return;
  const skillId = $("cardSaleSkill").value;
  const count = Number($("cardSaleCount").value);
  if (!skillId || !Number.isSafeInteger(count) || count < 1) return toast("売るカードと枚数を確認してください。");
  cardSaleBusy = true; cardSaleQuote = null; $("cardSaleStatus").textContent = "サーバーで売却内容を確認中…"; renderCardSale();
  try {
    const result = await client.quoteCardSale({ skillId, count });
    cardSaleQuote = { ...result.quote, expectedRevision: Number(result.revision) };
    const reasons = [];
    if (cardSaleQuote.confirmationReasons?.includes("HIGH_RARITY")) reasons.push("高レアカード");
    if (cardSaleQuote.confirmationReasons?.includes("LAST_SELLABLE_COPY")) reasons.push("売れる最後の余剰分");
    $("cardSaleStatus").textContent = `${cardSaleQuote.count}枚 → ${cardSaleQuote.earnedCoins}コイン（売却後${cardSaleQuote.remaining}枚）${reasons.length ? `。注意：${reasons.join("・")}` : ""}`;
  } catch (error) {
    $("cardSaleStatus").textContent = "この内容では売却できません。所持枚数や保護設定を確認してください。";
    toast(error.message || "売却内容を確認できませんでした。");
  } finally { cardSaleBusy = false; renderCardSale(); }
}

async function commitOnlineCardSale(retry = false) {
  if (cardSaleBusy || (!retry && !cardSaleQuote)) return;
  if (!retry) {
    pendingCardSale = {
      actionId: crypto.randomUUID(), expectedRevision: cardSaleQuote.expectedRevision,
      skillId: cardSaleQuote.skillId, count: cardSaleQuote.count,
      confirmed: cardSaleQuote.requiresConfirmation === true,
    };
    localStorage.setItem(CARD_SALE_PENDING_KEY, JSON.stringify(pendingCardSale));
  }
  if (!pendingCardSale) return;
  cardSaleBusy = true; $("cardSaleStatus").textContent = "サーバーで売却を保存中…"; renderCardSale();
  try {
    const result = await client.sellCards(pendingCardSale);
    persistRemoteProfile(result.profileState, displayName(), Number(result.revision));
    const earned = Number(result.quote?.earnedCoins || 0);
    pendingCardSale = null; cardSaleQuote = null; localStorage.removeItem(CARD_SALE_PENDING_KEY);
    $("cardSaleStatus").textContent = `${earned}コインを獲得しました。カード減算とコイン加算は一度だけ保存済みです。`;
  } catch (error) {
    const remote = await client.readProfile().catch(() => null);
    if (remote) hydrateProfileRow(remote);
    $("cardSaleStatus").textContent = "売却結果を確認できませんでした。同じ売却IDで安全に再送するか、やり直してください。";
    toast(error.message || "カード売却に失敗しました。");
  } finally { cardSaleBusy = false; renderProgression(); render(); }
}

function starterProfile(displayName) {
  return {
    displayName,
    quizRecords: {},
    gachaTickets: { "1": 3 },
    inventory: { ...STARTER_INVENTORY },
    coins: 0,
    achievements: [],
    protectedSkills: { areaHalfShift: true },
    cosmeticsOwned: ["boardDefault", "effectDefault", "nameplateDefault", "titleNone"],
    equipped: { board: "boardDefault", effect: "effectDefault", nameplate: "nameplateDefault", title: "titleNone" },
    trophies: { fullPaint: false, fullPaint3: false, noSkillFullPaint: false },
    trophyDates: {},
    stats: { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 },
    cpuStats: { wins: 0, losses: 0, currentWinStreak: 0, bestWinStreak: 0, fullPaints: 0 },
    cpuCharacterStats: {},
    matchHistory: [],
  };
}

function renderGacha() {
  const value = profile();
  if (!value || !$("gachaPanel")) return;
  const tickets = value.gachaTickets || {};
  const level = Number($("gachaLevel").value || 1);
  const available = Number(tickets[String(level)] || 0);
  $("gachaTickets").textContent = [1, 2, 3, 4, 5].map((item) => `Lv.${item} ×${tickets[String(item)] || 0}`).join(" / ");
  $("gachaDrawOne").disabled = gachaBusy || Boolean(pendingGacha) || hasMatchedRoomHandoff() || available < 1;
  $("gachaDrawAll").disabled = gachaBusy || Boolean(pendingGacha) || hasMatchedRoomHandoff() || available < 1;
  $("gachaRetry").classList.toggle("hidden", !pendingGacha);
  $("gachaRetry").disabled = gachaBusy || hasMatchedRoomHandoff();
  $("gachaResults").replaceChildren();
  for (const draw of lastGachaDraws) {
    const card = document.createElement("article"); card.className = `gacha-card r${draw.rarity}`; card.setAttribute("role", "listitem");
    const stars = document.createElement("div"); stars.className = "gacha-stars"; stars.textContent = "★".repeat(draw.rarity); card.appendChild(stars);
    const title = document.createElement("strong"); title.textContent = draw.displayName || SKILL_META[draw.skillId]?.name || draw.skillId; card.appendChild(title);
    const detail = document.createElement("small"); detail.textContent = `${CATEGORY_LABEL[draw.category] || draw.category} / Lv.${draw.ticketLevel}`; card.appendChild(detail);
    const effect = document.createElement("small"); effect.className = "gacha-card-effect"; effect.textContent = SKILL_DESCRIPTION[draw.skillId] || "対戦で使えるカードです。"; card.appendChild(effect);
    $("gachaResults").appendChild(card);
  }
  const hasResults = lastGachaDraws.length > 0;
  const distinctCardCount = new Set(lastGachaDraws.map((draw) => draw.skillId)).size;
  const highestRarity = hasResults ? Math.max(...lastGachaDraws.map((draw) => Number(draw.rarity) || 1)) : 0;
  $("gachaResultAnnouncement").textContent = hasResults
    ? `${lastGachaDraws.length}枚獲得。${distinctCardCount}種類、最高レアリティ星${highestRarity}。詳しくは獲得カード一覧で確認できます。`
    : "";
  if (lastGachaContinuation && roomModel && !isCurrentCpuRewardGachaContinuation(lastGachaContinuation)) clearCpuRewardGachaResult();
  const canContinueCpuReward = hasResults && !pendingGacha && !gachaBusy && isCurrentCpuRewardGachaContinuation(lastGachaContinuation);
  show("gachaResultSummary", canContinueCpuReward);
  show("gachaCpuRematch", canContinueCpuReward);
  show("gachaCpuRematchNote", canContinueCpuReward);
  $("gachaCpuRematch").disabled = rematchBusy;
}

function clearCpuRewardGachaResult({ clearDraws = false } = {}) {
  lastGachaContinuation = null;
  if (clearDraws) lastGachaDraws = [];
  try { sessionStorage.removeItem(CPU_REWARD_GACHA_RESULT_KEY); } catch { /* in-memory result remains usable */ }
}

function persistCpuRewardGachaResult() {
  if (!isCurrentCpuRewardGachaContinuation(lastGachaContinuation) || !lastGachaDraws.length) return clearCpuRewardGachaResult();
  try { sessionStorage.setItem(CPU_REWARD_GACHA_RESULT_KEY, JSON.stringify({ continuation: lastGachaContinuation, draws: lastGachaDraws.slice(0, 100) })); } catch { /* in-memory result remains usable */ }
}

function isCurrentCpuRewardGachaContinuation(value) {
  const state = roomModel?.room?.public_state;
  return value?.source === "cpu-completion-reward"
    && value.ticketLevel === 1
    && value.roomId === roomModel?.room?.id
    && value.roomVersion === Number(roomModel?.room?.version)
    && value.matchId === state?.matchId
    && roomModel?.room?.status === "finished"
    && roomModel?.room?.opponent_kind === "cpu"
    && state?.status === "FINISHED"
    && state?.debugUnlimitedSkills !== true;
}

function renderCardLibrary() {
  if (!$("cardInventory")) return;
  const value = profile();
  $("cardInventory").replaceChildren();
  if (!value) return;
  for (const [skillId, name, category] of SKILLS) {
    const card = document.createElement("article");
    card.className = `inventory-card category-${category}`;
    const mark = document.createElement("span");
    mark.className = "inventory-card-mark";
    mark.textContent = category === "color" ? "●" : category === "area" ? "⬡" : "✦";
    const copy = document.createElement("div");
    const title = document.createElement("strong"); title.textContent = name;
    const type = document.createElement("small"); type.textContent = CATEGORY_LABEL[category] || category;
    copy.append(title, type);
    const count = document.createElement("b");
    count.className = "inventory-count";
    count.textContent = `×${Number(value.inventory?.[skillId] || 0)}`;
    card.append(mark, copy, count);
    card.onclick = () => openSkillInfo(skillId);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.onkeydown = (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); openSkillInfo(skillId); } };
    $("cardInventory").appendChild(card);
  }
}

function mathNode(tag, text = null) {
  const node = document.createElementNS(MATHML_NS, tag);
  if (text !== null) node.textContent = String(text);
  return node;
}

function mathMatrix(rows) {
  const fenced = mathNode("mfenced");
  const table = mathNode("mtable");
  for (const row of rows || []) {
    const tr = mathNode("mtr");
    for (const value of row || []) {
      const td = mathNode("mtd");
      td.appendChild(mathNode("mn", value));
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  fenced.appendChild(table);
  return fenced;
}

function mathLimit(symbol, lower, upper) {
  const limits = mathNode("munderover");
  limits.append(mathNode("mo", symbol), lower, upper);
  return limits;
}

function quizCategoryNode(category) {
  const node = document.createElement("small");
  node.className = "quiz-category";
  node.textContent = category;
  return node;
}

function renderQuizExperience(question) {
  const steps = Math.max(1, Math.min(3, Number(question?.thinkingSteps || 1)));
  $("quizFormatLabel").textContent = `🎯 ${String(question?.formatLabel || "ひらめき計算")}`;
  $("quizMission").textContent = String(question?.mission || "問題を読み、答えを1つ選ぼう");
  $("quizThinkingSteps").textContent = `考え方 ${steps}段階`;
  $("quizThinkingSteps").dataset.steps = String(steps);
}

function svgNode(tag, attributes = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== null) node.textContent = String(text);
  return node;
}

function svgGuide(svg, { x1, y1, x2, y2, label, labelX, labelY, anchor = "middle", dashed = false }) {
  svg.appendChild(svgNode("line", { x1, y1, x2, y2, class: dashed ? "quiz-geometry-guide dashed" : "quiz-geometry-guide" }));
  svg.appendChild(svgNode("text", { x: labelX, y: labelY, class: "quiz-geometry-label", "text-anchor": anchor }, label));
}

function renderQuizGeometry(question, descriptor) {
  const shapes = new Set(["rectangle", "cube", "triangle", "cuboid", "circle", "trapezoid", "cylinder", "cone"]);
  if (!shapes.has(descriptor.shape) || !descriptor.dimensions || typeof descriptor.dimensions !== "object") return null;
  const dimensions = descriptor.dimensions;
  const figure = document.createElement("figure");
  figure.className = "quiz-geometry";
  const prompt = document.createElement("figcaption");
  prompt.className = "quiz-visible-prompt";
  prompt.textContent = question?.prompt || "図の寸法から答えてください。";
  const svg = svgNode("svg", { viewBox: "0 0 320 190", role: "img", "aria-label": question?.prompt || "寸法付きの図形" });
  const shapeClass = "quiz-geometry-shape";
  if (descriptor.shape === "rectangle") {
    svg.appendChild(svgNode("rect", { x: 75, y: 32, width: 175, height: 110, rx: 3, class: shapeClass }));
    svgGuide(svg, { x1: 75, y1: 158, x2: 250, y2: 158, label: `よこ ${dimensions.width}`, labelX: 162, labelY: 180 });
    svgGuide(svg, { x1: 57, y1: 32, x2: 57, y2: 142, label: `たて ${dimensions.height}`, labelX: 49, labelY: 92, anchor: "end" });
  } else if (descriptor.shape === "triangle") {
    svg.appendChild(svgNode("polygon", { points: "48,145 272,145 166,28", class: shapeClass }));
    svgGuide(svg, { x1: 48, y1: 162, x2: 272, y2: 162, label: `底辺 ${dimensions.base}`, labelX: 160, labelY: 183 });
    svgGuide(svg, { x1: 166, y1: 28, x2: 166, y2: 145, label: `高さ ${dimensions.height}`, labelX: 177, labelY: 89, anchor: "start", dashed: true });
  } else if (descriptor.shape === "trapezoid") {
    svg.appendChild(svgNode("polygon", { points: "98,35 222,35 274,145 46,145", class: shapeClass }));
    svgGuide(svg, { x1: 98, y1: 20, x2: 222, y2: 20, label: `上底 ${dimensions.top}`, labelX: 160, labelY: 14 });
    svgGuide(svg, { x1: 46, y1: 163, x2: 274, y2: 163, label: `下底 ${dimensions.bottom}`, labelX: 160, labelY: 184 });
    svgGuide(svg, { x1: 98, y1: 35, x2: 98, y2: 145, label: `高さ ${dimensions.height}`, labelX: 109, labelY: 93, anchor: "start", dashed: true });
  } else if (descriptor.shape === "circle") {
    svg.appendChild(svgNode("circle", { cx: 160, cy: 94, r: 62, class: shapeClass }));
    svgGuide(svg, { x1: 160, y1: 94, x2: 222, y2: 94, label: `半径 ${dimensions.radius}`, labelX: 191, labelY: 86 });
    svg.appendChild(svgNode("circle", { cx: 160, cy: 94, r: 3, class: "quiz-geometry-point" }));
  } else if (descriptor.shape === "cube" || descriptor.shape === "cuboid") {
    const frontWidth = descriptor.shape === "cube" ? 105 : 145;
    const frontHeight = descriptor.shape === "cube" ? 105 : 88;
    const x = descriptor.shape === "cube" ? 82 : 55;
    const y = descriptor.shape === "cube" ? 58 : 72;
    const offsetX = 58; const offsetY = -34;
    svg.append(svgNode("rect", { x, y, width: frontWidth, height: frontHeight, class: shapeClass }), svgNode("rect", { x: x + offsetX, y: y + offsetY, width: frontWidth, height: frontHeight, class: shapeClass }));
    for (const [x1, y1] of [[x, y], [x + frontWidth, y], [x, y + frontHeight], [x + frontWidth, y + frontHeight]]) {
      svg.appendChild(svgNode("line", { x1, y1, x2: x1 + offsetX, y2: y1 + offsetY, class: shapeClass }));
    }
    if (descriptor.shape === "cube") {
      svgGuide(svg, { x1: x, y1: 176, x2: x + frontWidth, y2: 176, label: `一辺 ${dimensions.side}`, labelX: x + frontWidth / 2, labelY: 188 });
    } else {
      svgGuide(svg, { x1: x, y1: 174, x2: x + frontWidth, y2: 174, label: `底面 ${dimensions.length}`, labelX: x + frontWidth / 2, labelY: 188 });
      svgGuide(svg, { x1: x + frontWidth + 5, y1: y + frontHeight, x2: x + frontWidth + offsetX, y2: y + frontHeight + offsetY, label: `奥行 ${dimensions.width}`, labelX: 254, labelY: 137 });
      svgGuide(svg, { x1: 39, y1: y, x2: 39, y2: y + frontHeight, label: `高さ ${dimensions.height}`, labelX: 31, labelY: y + frontHeight / 2, anchor: "end" });
    }
  } else if (descriptor.shape === "cylinder") {
    svg.append(svgNode("ellipse", { cx: 160, cy: 42, rx: 68, ry: 21, class: shapeClass }), svgNode("line", { x1: 92, y1: 42, x2: 92, y2: 145, class: shapeClass }), svgNode("line", { x1: 228, y1: 42, x2: 228, y2: 145, class: shapeClass }), svgNode("ellipse", { cx: 160, cy: 145, rx: 68, ry: 21, class: shapeClass }));
    svgGuide(svg, { x1: 160, y1: 42, x2: 228, y2: 42, label: `半径 ${dimensions.radius}`, labelX: 193, labelY: 34 });
    svgGuide(svg, { x1: 72, y1: 42, x2: 72, y2: 145, label: `高さ ${dimensions.height}`, labelX: 64, labelY: 98, anchor: "end" });
  } else if (descriptor.shape === "cone") {
    svg.append(svgNode("ellipse", { cx: 160, cy: 145, rx: 73, ry: 22, class: shapeClass }), svgNode("line", { x1: 160, y1: 24, x2: 87, y2: 145, class: shapeClass }), svgNode("line", { x1: 160, y1: 24, x2: 233, y2: 145, class: shapeClass }));
    svgGuide(svg, { x1: 160, y1: 145, x2: 233, y2: 145, label: `半径 ${dimensions.radius}`, labelX: 196, labelY: 137 });
    svgGuide(svg, { x1: 160, y1: 24, x2: 160, y2: 145, label: `高さ ${dimensions.height}`, labelX: 149, labelY: 89, anchor: "end", dashed: true });
  }
  figure.append(prompt, svg);
  return figure;
}

function scrollableQuizMath(math, label) {
  const shell = document.createElement("div");
  shell.className = "quiz-math-shell";
  const viewport = document.createElement("div");
  viewport.className = "quiz-math-scroll";
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", `${label || "数式"}。横に長い場合は左右へスクロールできます。`);
  viewport.appendChild(math);
  const track = document.createElement("div");
  track.className = "quiz-overflow-scrollbar";
  track.hidden = true;
  track.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("span");
  track.appendChild(thumb);
  const sync = () => {
    const overflow = viewport.scrollWidth > viewport.clientWidth + 1;
    shell.classList.toggle("is-overflowing", overflow);
    track.hidden = !overflow;
    viewport.tabIndex = overflow ? 0 : -1;
    if (!overflow) return;
    const ratio = viewport.clientWidth / viewport.scrollWidth;
    const travel = 100 - ratio * 100;
    const progress = viewport.scrollLeft / Math.max(1, viewport.scrollWidth - viewport.clientWidth);
    thumb.style.width = `${ratio * 100}%`;
    thumb.style.transform = `translateX(${progress * travel / ratio}%)`;
  };
  viewport.addEventListener("scroll", sync, { passive: true });
  requestAnimationFrame(sync);
  if (typeof ResizeObserver === "function") {
    quizMathResizeObserver = new ResizeObserver(sync);
    quizMathResizeObserver.observe(viewport);
  }
  shell.append(viewport, track);
  return shell;
}

function renderQuizQuestion(question) {
  const host = $("quizQuestion");
  quizMathResizeObserver?.disconnect();
  quizMathResizeObserver = null;
  host.replaceChildren();
  const descriptor = question?.math;
  if (!descriptor || typeof descriptor !== "object") {
    host.textContent = question?.prompt || "問題を読み込んでいます。";
    return;
  }
  if (descriptor.kind === "story") {
    const prompt = document.createElement("span");
    prompt.className = "quiz-visible-prompt";
    prompt.textContent = question?.prompt || descriptor.value || "文章を読んで答えてください。";
    host.append(prompt);
    if (question.category) host.prepend(quizCategoryNode(question.category));
    return;
  }
  if (descriptor.kind === "geometry" && descriptor.shape) {
    const figure = renderQuizGeometry(question, descriptor);
    if (figure) {
      host.append(figure);
      if (question.category) host.prepend(quizCategoryNode(question.category));
      return;
    }
  }
  const math = mathNode("math");
  math.setAttribute("display", "block");
  math.setAttribute("aria-label", question.prompt || "数式問題");
  if (descriptor.kind === "sum") {
    const lower = descriptor.index
      ? (() => { const row = mathNode("mrow"); row.append(mathNode("mi", descriptor.index), mathNode("mo", "="), mathNode("mn", descriptor.lower)); return row; })()
      : mathNode("mtext", descriptor.lower);
    const body = mathNode("mrow");
    if (descriptor.grouped) body.append(mathNode("mo", "("), mathNode("mtext", descriptor.body || ""), mathNode("mo", ")"));
    else body.appendChild(mathNode("mtext", descriptor.body || ""));
    math.append(mathLimit("∑", lower, mathNode("mn", descriptor.upper)), mathNode("mspace"), body);
  } else if (descriptor.kind === "integral") {
    const limits = mathNode("msubsup");
    limits.append(mathNode("mo", "∫"), mathNode("mn", descriptor.lower), mathNode("mn", descriptor.upper));
    const differential = mathNode("mrow");
    const d = mathNode("mi", "d"); d.setAttribute("mathvariant", "normal");
    differential.append(d, mathNode("mi", descriptor.variable || "x"));
    math.append(limits, mathNode("mspace"), mathNode("mtext", descriptor.body || ""), mathNode("mspace"), differential);
  } else if (descriptor.kind === "fraction") {
    const fraction = mathNode("mfrac");
    fraction.append(mathNode("mtext", descriptor.numerator), mathNode("mtext", descriptor.denominator));
    math.appendChild(fraction);
  } else if (descriptor.kind === "power") {
    const power = mathNode("msup");
    power.append(mathNode("mn", descriptor.base), mathNode("mn", descriptor.exponent));
    math.appendChild(power);
  } else if (descriptor.kind === "root") {
    const root = mathNode("msqrt");
    root.appendChild(mathNode("mn", descriptor.value));
    math.appendChild(root);
  } else if (descriptor.kind === "derivative") {
    const fraction = mathNode("mfrac");
    fraction.append(mathNode("mrow"), mathNode("mrow"));
    fraction.firstChild.append(mathNode("mi", "d"), mathNode("mi", "y"));
    fraction.lastChild.append(mathNode("mi", "d"), mathNode("mi", "x"));
    const evaluation = mathNode("msub");
    const at = mathNode("mrow"); at.append(mathNode("mi", "x"), mathNode("mo", "="), mathNode("mn", descriptor.at));
    evaluation.append(mathNode("mo", "|"), at);
    math.append(mathNode("mtext", `y = ${descriptor.function}`), mathNode("mo", ","), mathNode("mspace"), fraction, evaluation);
  } else if (descriptor.kind === "sequence") {
    const first = mathNode("msub"); first.append(mathNode("mi", "a"), mathNode("mn", "1"));
    const target = mathNode("msub"); target.append(mathNode("mi", "a"), mathNode("mn", descriptor.position));
    math.append(first, mathNode("mo", "="), mathNode("mn", descriptor.first), mathNode("mo", ","), mathNode("mspace"), mathNode("mi", "d"), mathNode("mo", "="), mathNode("mn", descriptor.difference), mathNode("mo", ","), mathNode("mspace"), target);
  } else if (descriptor.kind === "matrix-determinant") {
    math.append(mathNode("mi", "det"), mathMatrix(descriptor.rows));
  } else if (descriptor.kind === "matrix-product") {
    if (descriptor.prefix) math.append(mathNode("mtext", descriptor.prefix), mathNode("mspace"));
    math.append(mathMatrix(descriptor.left), mathNode("mo", "×"), mathMatrix(descriptor.right));
  } else if (descriptor.kind === "system") {
    const table = mathNode("mtable");
    for (const line of descriptor.lines || []) {
      const row = mathNode("mtr"); const cell = mathNode("mtd"); cell.appendChild(mathNode("mtext", line)); row.appendChild(cell); table.appendChild(row);
    }
    math.appendChild(table);
  } else {
    math.appendChild(mathNode("mtext", descriptor.value || question.prompt));
  }
  if (descriptor.suffix) math.append(mathNode("mspace"), mathNode("mtext", descriptor.suffix));
  host.appendChild(scrollableQuizMath(math, question.prompt));
  if (question.category) host.prepend(quizCategoryNode(question.category));
}

function savePendingQuiz() {
  if (pendingQuiz) localStorage.setItem(QUIZ_PENDING_KEY, JSON.stringify(pendingQuiz));
  else localStorage.removeItem(QUIZ_PENDING_KEY);
}

function quizQuestionLimitMs(question) {
  return Math.max(10, Number(question?.timeLimitSeconds || 45)) * 1000;
}

function ensureQuizQuestionState(now = Date.now()) {
  if (!pendingQuiz || pendingQuiz.answers.length >= 10) return null;
  const index = pendingQuiz.answers.length;
  if (!pendingQuiz.questionState || pendingQuiz.questionState.index !== index) {
    pendingQuiz.questionState = {
      index,
      remainingMs: quizQuestionLimitMs(pendingQuiz.questions[index]),
      lastTickAt: now,
      hintUsed: false,
      hintActiveUntil: 0,
    };
    savePendingQuiz();
  }
  return pendingQuiz.questionState;
}

function settleQuizClock(now = Date.now()) {
  const state = ensureQuizQuestionState(now);
  if (!state) return null;
  if (state.hintActiveUntil > now) {
    state.lastTickAt = now;
    return state;
  }
  if (state.hintActiveUntil) {
    state.lastTickAt = Math.max(Number(state.lastTickAt || 0), Number(state.hintActiveUntil));
    state.hintActiveUntil = 0;
  }
  const elapsed = Math.max(0, now - Number(state.lastTickAt || now));
  state.remainingMs = Math.max(0, Number(state.remainingMs || 0) - elapsed);
  state.lastTickAt = now;
  return state;
}

function stopQuizClock() {
  clearInterval(quizClockTimer);
  quizClockTimer = null;
}

function updateQuizClock() {
  if (quizLockedByMatchedRoom() || !pendingQuiz || pendingQuiz.answers.length >= 10 || !$("quizTimer")) return stopQuizClock();
  const now = Date.now();
  const previousState = ensureQuizQuestionState(now);
  const hintWasActive = Number(previousState?.hintActiveUntil || 0) > 0;
  const state = settleQuizClock(now);
  const question = pendingQuiz.questions[pendingQuiz.answers.length];
  const total = quizQuestionLimitMs(question);
  const hintRemaining = Math.max(0, Number(state?.hintActiveUntil || 0) - now);
  const remaining = Math.max(0, Number(state?.remainingMs || 0));
  $("quizTimer").textContent = hintRemaining > 0 ? `ヒント ${Math.ceil(hintRemaining / 1000)}秒` : `残り ${Math.ceil(remaining / 1000)}秒`;
  $("quizTimer").classList.toggle("urgent", hintRemaining === 0 && remaining <= 10_000);
  const percent = Math.max(0, Math.min(100, remaining / total * 100));
  $("quizTimeBar").style.width = `${percent}%`;
  $("quizTimeBar").parentElement.setAttribute("aria-valuenow", String(Math.round(percent)));
  if (hintWasActive && !hintRemaining) {
    savePendingQuiz();
    renderQuizHint(question, state);
    for (const option of $("quizOptions").querySelectorAll("button")) option.disabled = quizBusy || remaining <= 0;
  }
  if (!remaining && !hintRemaining && !quizTimeoutQueued) {
    quizTimeoutQueued = true;
    setTimeout(() => {
      quizTimeoutQueued = false;
      if (pendingQuiz && settleQuizClock()?.remainingMs === 0) answerOnlineQuiz(pendingQuiz.timeoutAnswerId || QUIZ_TIMEOUT_ANSWER, { timedOut: true });
    }, 0);
  }
}

function startQuizClock() {
  if (quizLockedByMatchedRoom()) return stopQuizClock();
  if (!quizClockTimer) quizClockTimer = setInterval(updateQuizClock, 200);
  updateQuizClock();
}

function renderQuizHint(question, state) {
  const visible = Number(state?.hintActiveUntil || 0) > Date.now();
  show("quizHintText", visible);
  $("quizHint").disabled = quizBusy || quizLockedByMatchedRoom() || Boolean(state?.hintUsed);
  $("quizHint").textContent = state?.hintUsed ? "ヒント使用済み" : "💡 ヒントを見る";
  if (!visible) return $("quizHintText").replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = "公式メモ：使うものと使わないものが混ざっています";
  const list = document.createElement("ul");
  for (const hint of question?.hintOptions || ["式の関係を整理してみよう"]) {
    const item = document.createElement("li"); item.textContent = hint; list.appendChild(item);
  }
  $("quizHintText").replaceChildren(heading, list);
}

function openQuizHint() {
  if (!pendingQuiz || quizBusy || quizLockedByMatchedRoom()) return;
  const now = Date.now();
  const state = settleQuizClock(now);
  if (!state || state.hintUsed || state.remainingMs <= 0) return;
  const question = pendingQuiz.questions[pendingQuiz.answers.length];
  state.hintUsed = true;
  state.hintActiveUntil = now + Math.max(2500, Number(question?.hintDurationMs || 3500));
  state.lastTickAt = now;
  savePendingQuiz();
  renderQuiz();
}

function quizOptionLabel(question, optionId) {
  if (optionId === (pendingQuiz?.timeoutAnswerId || QUIZ_TIMEOUT_ANSWER)) return "時間切れ";
  return String((question?.options || []).find((option) => option.id === optionId)?.label || optionId || "未回答");
}

function quizCorrectStreak(results = pendingQuiz?.answerResults || []) {
  let streak = 0;
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (result?.isCorrect !== true || result?.timedOut) break;
    streak += 1;
  }
  return streak;
}

function renderQuizStreak() {
  const host = $("quizStreak");
  const streak = quizCorrectStreak();
  show("quizStreak", streak >= 2);
  const tier = streak >= 6 ? 3 : streak >= 4 ? 2 : streak >= 2 ? 1 : 0;
  host.dataset.tier = String(tier);
  host.textContent = tier === 3
    ? `🔥 神がかり！ ${streak}連続正解`
    : tier === 2
      ? `✨ 絶好調！ ${streak}連続正解`
      : tier === 1
        ? `いい流れ！ ${streak}連続正解`
        : "";
}

function quizLearningLine(feedback) {
  const explanation = String(feedback?.explanation || "").trim();
  if (explanation) return explanation.slice(0, 180);
  return feedback?.isCorrect ? "その考え方でOK。次の問題でも条件を先に整理しよう" : "正解の値から式を逆にたどってみよう";
}

function renderQuizAnswerFeedback() {
  const feedback = pendingQuiz?.answerResults?.at?.(-1) || null;
  const host = $("quizAnswerFeedback");
  show("quizAnswerFeedback", Boolean(feedback));
  host.classList.toggle("correct", feedback?.isCorrect === true);
  host.classList.toggle("incorrect", Boolean(feedback) && feedback?.isCorrect !== true);
  if (!feedback) { host.replaceChildren(); return; }
  const prefix = `前問 Q${Number(feedback.questionIndex) + 1}：`;
  const result = document.createElement("span");
  result.className = "quiz-feedback-result";
  if (feedback.timedOut) result.textContent = `${prefix}× 時間切れ　正解：${feedback.correctOptionLabel}`;
  else if (feedback.isCorrect) result.textContent = `${prefix}○ 正解！`;
  else result.textContent = `${prefix}× おしい　正解：${feedback.correctOptionLabel}`;
  const learning = document.createElement("span");
  learning.className = "quiz-feedback-learning";
  learning.textContent = `なるほど：${quizLearningLine(feedback)}`;
  host.replaceChildren(result, learning);
}

function emphasizeQuizFeedback() {
  const host = $("quizAnswerFeedback");
  const generation = ++quizFeedbackGeneration;
  host.classList.remove("emphasize");
  requestAnimationFrame(() => host.classList.add("emphasize"));
  setTimeout(() => {
    if (generation === quizFeedbackGeneration) host.classList.remove("emphasize");
  }, 600);
}

function renderQuizResult() {
  if (!lastQuizResult) return;
  const reward = lastQuizResult.reward || {};
  $("quizRewardSummary").textContent = `${lastQuizResult.correct}問正解！ Lv.${reward.ticketLevel}ガチャ券を${reward.draws}枚獲得（${reward.reason}）`;
  const review = Array.isArray(lastQuizResult.answerReview) ? lastQuizResult.answerReview : [];
  show("quizReview", review.length > 0);
  const list = $("quizReviewList");
  list.className = "quiz-review-list";
  list.replaceChildren();
  for (const item of review) {
    const entry = document.createElement("li");
    entry.className = `quiz-review-item ${item?.isCorrect ? "correct" : "incorrect"}`;
    const question = document.createElement("p");
    question.textContent = `Q${Number(item?.questionIndex) + 1}　${item?.question?.prompt || item?.prompt || "問題"}`;
    const answer = document.createElement("p");
    answer.textContent = `あなた：${item?.selectedOptionLabel || "時間切れ"}　／　正解：${item?.correctOptionLabel || "—"}　${item?.isCorrect ? "○" : "×"}`;
    entry.append(question, answer);
    if (item?.explanation) {
      const explanation = document.createElement("p");
      explanation.className = "quiz-review-explanation";
      explanation.textContent = String(item.explanation);
      entry.appendChild(explanation);
    }
    list.appendChild(entry);
  }
}

function renderQuiz() {
  if (!$('quizPanel')) return;
  const validPending = pendingQuiz && typeof pendingQuiz.sessionId === "string"
    && Array.isArray(pendingQuiz.questions) && pendingQuiz.questions.length === 10
    && Array.isArray(pendingQuiz.answers) && pendingQuiz.answers.length <= 10;
  if (pendingQuiz && !validPending) { pendingQuiz = null; savePendingQuiz(); }
  const expired = pendingQuiz && Number.isFinite(Date.parse(pendingQuiz.expiresAt)) && Date.parse(pendingQuiz.expiresAt) <= Date.now();
  if (expired) {
    pendingQuiz = null;
    savePendingQuiz();
    stopQuizClock();
    $('quizStatus').textContent = "前回のクイズは期限切れです。新しく開始してください。";
  }
  show("quizSetup", !pendingQuiz);
  show("quizPlay", Boolean(pendingQuiz));
  show("quizResult", Boolean(lastQuizResult));
  $("quizStart").disabled = quizBusy || hasMatchedRoomHandoff() || !synced;
  $("quizLevel").disabled = quizBusy;
  if (lastQuizResult) renderQuizResult();
  renderQuizAnswerFeedback();
  renderQuizStreak();
  if (!pendingQuiz) { stopQuizClock(); return; }
  const lockedByMatch = quizLockedByMatchedRoom();
  if (lockedByMatch) $("quizStatus").textContent = quizRoomClassificationPending
    ? QUIZ_ROOM_CHECK_STATUS
    : "対戦が成立したため、このクイズはここで一時停止しました。対戦終了後に同じ状態から再開できます。";
  const index = pendingQuiz.answers.length;
  $("quizProgress").textContent = `${Math.min(index + 1, 10)} / 10`;
  $("quizLevelBadge").textContent = `Lv.${pendingQuiz.selectedLevel}`;
  $("quizOptions").replaceChildren();
  if (index >= 10) {
    stopQuizClock();
    $("quizQuestion").textContent = "10問回答済みです。サーバーで採点します。";
    const retry = document.createElement("button");
    retry.className = "primary";
    retry.textContent = quizBusy ? "採点中…" : "採点を再試行";
    retry.disabled = quizBusy || lockedByMatch;
    retry.onclick = finishOnlineQuiz;
    $("quizOptions").appendChild(retry);
    return;
  }
  const question = pendingQuiz.questions[index];
  const questionState = lockedByMatch ? ensureQuizQuestionState() : settleQuizClock();
  if (lockedByMatch && questionState) {
    questionState.lastTickAt = Date.now();
    savePendingQuiz();
  }
  renderQuizExperience(question);
  renderQuizQuestion(question);
  renderQuizHint(question, questionState);
  for (const [optionIndex, option] of (question.options || []).entries()) {
    const button = document.createElement("button");
    button.textContent = option.label;
    button.style.setProperty("--float-order", String(optionIndex));
    button.disabled = quizBusy || lockedByMatch || Boolean(pendingQuiz.pendingAnswer) || Number(questionState?.hintActiveUntil || 0) > Date.now();
    button.onclick = () => answerOnlineQuiz(option.id);
    $("quizOptions").appendChild(button);
  }
  if (pendingQuiz.pendingAnswer) {
    stopQuizClock();
    const retry = document.createElement("button");
    retry.className = "primary";
    retry.textContent = quizBusy ? "回答を送信中…" : "同じ回答を再送";
    retry.disabled = quizBusy || lockedByMatch;
    retry.onclick = submitPendingQuizAnswer;
    $("quizOptions").appendChild(retry);
  } else if (lockedByMatch) stopQuizClock();
  else startQuizClock();
}

async function startOnlineQuiz() {
  if (quizBusy || !synced || !profile()) return;
  quizBusy = true;
  lastQuizResult = null;
  $("quizStatus").textContent = "サーバーで10問を用意しています…";
  renderQuiz();
  try {
    const selectedLevel = Number($("quizLevel").value || 1);
    const result = await client.startQuiz({ actionId: crypto.randomUUID(), selectedLevel });
    pendingQuiz = {
      sessionId: result.sessionId,
      finishActionId: crypto.randomUUID(),
      selectedLevel: Number(result.selectedLevel),
      expiresAt: result.expiresAt,
      questions: result.questions,
      answers: [],
      answerResults: [],
      answerMode: result.answerMode === "per-question-v1" ? result.answerMode : "batch-v1",
      pendingAnswer: null,
      questionState: null,
      timeoutAnswerId: typeof result.timeoutAnswerId === "string" ? result.timeoutAnswerId : QUIZ_TIMEOUT_ANSWER,
    };
    savePendingQuiz();
    $("quizStatus").textContent = pendingQuiz.answerMode === "per-question-v1"
      ? "答えを選ぶと、その場で○×が分かります。"
      : "答えを選んでください。10問後にまとめてサーバー採点します。";
  } catch (error) {
    $("quizStatus").textContent = "クイズを開始できませんでした。少し待って再試行してください。";
    toast(error.message || "クイズ開始に失敗しました。");
  } finally { quizBusy = false; markQuizBoundaryForMatchedRoom(); renderQuiz(); flushMatchedRoomHandoff(); }
}

async function answerOnlineQuiz(optionId, { timedOut = false } = {}) {
  if (quizBusy || quizLockedByMatchedRoom() || !pendingQuiz || pendingQuiz.answers.length >= 10) return;
  const questionState = settleQuizClock();
  if (!timedOut && Number(questionState?.hintActiveUntil || 0) > Date.now()) return;
  if (!timedOut && Number(questionState?.remainingMs || 0) <= 0) return;
  if (pendingQuiz.answerMode === "per-question-v1") {
    if (!pendingQuiz.pendingAnswer) {
      pendingQuiz.pendingAnswer = {
        actionId: crypto.randomUUID(),
        questionIndex: pendingQuiz.answers.length,
        answerId: String(optionId),
        timedOut: Boolean(timedOut),
      };
      savePendingQuiz();
    }
    await submitPendingQuizAnswer();
    return;
  }
  pendingQuiz.answers.push(String(optionId));
  pendingQuiz.questionState = null;
  savePendingQuiz();
  markQuizBoundaryForMatchedRoom();
  if (timedOut) $("quizStatus").textContent = "時間切れ。次の問題へ進みます。";
  if (pendingQuiz.answers.length === 10) finishOnlineQuiz();
  else renderQuiz();
}

async function submitPendingQuizAnswer() {
  if (quizBusy || !pendingQuiz?.pendingAnswer || pendingQuiz.answerMode !== "per-question-v1") return;
  const pending = { ...pendingQuiz.pendingAnswer };
  if (pending.questionIndex !== pendingQuiz.answers.length) return;
  const question = pendingQuiz.questions[pending.questionIndex];
  quizBusy = true;
  stopQuizClock();
  $("quizStatus").textContent = "回答をサーバーへ保存しています…";
  renderQuiz();
  let shouldFinish = false;
  try {
    const result = await client.answerQuiz({
      sessionId: pendingQuiz.sessionId,
      actionId: pending.actionId,
      questionIndex: pending.questionIndex,
      answerId: pending.answerId,
    });
    if (Number(result.questionIndex) !== pending.questionIndex || Number(result.answeredCount) !== pending.questionIndex + 1) {
      throw new Error("QUIZ_ANSWER_SEQUENCE_MISMATCH");
    }
    const feedback = {
      questionIndex: pending.questionIndex,
      selectedOptionId: pending.answerId,
      selectedOptionLabel: quizOptionLabel(question, pending.answerId),
      correctOptionId: String(result.correctOptionId || ""),
      correctOptionLabel: String(result.correctOptionLabel || "—"),
      explanation: String(result.explanation || ""),
      isCorrect: result.isCorrect === true,
      timedOut: Boolean(pending.timedOut),
    };
    pendingQuiz.answers.push(pending.answerId);
    if (!Array.isArray(pendingQuiz.answerResults)) pendingQuiz.answerResults = [];
    pendingQuiz.answerResults.push(feedback);
    pendingQuiz.pendingAnswer = null;
    pendingQuiz.questionState = null;
    savePendingQuiz();
    markQuizBoundaryForMatchedRoom({ feedback: true });
    $("quizStatus").textContent = result.duplicate ? "保存済みの回答を復元しました。" : "回答を保存しました。次の問題へ進みます。";
    shouldFinish = pendingQuiz.answers.length === 10;
  } catch (error) {
    $("quizStatus").textContent = "回答を保存できませんでした。同じ回答で安全に再送できます。";
    toast(error.message || "クイズ回答の送信に失敗しました。");
  } finally {
    quizBusy = false;
    renderQuiz();
    if (!pendingQuiz?.pendingAnswer) emphasizeQuizFeedback();
  }
  if (shouldFinish) await finishOnlineQuiz();
}

async function finishOnlineQuiz() {
  if (quizBusy || !pendingQuiz || pendingQuiz.answers.length !== 10) return;
  quizBusy = true;
  $("quizStatus").textContent = "サーバーで採点し、ガチャ券を保存しています…";
  renderQuiz();
  try {
    const result = await client.finishQuiz({
      sessionId: pendingQuiz.sessionId,
      actionId: pendingQuiz.finishActionId,
      answers: pendingQuiz.answers,
    });
    pendingQuiz = null;
    savePendingQuiz();
    lastQuizResult = result;
    persistRemoteProfile(result.profileState, displayName(), Number(result.revision));
    $("quizStatus").textContent = result.duplicate ? "採点済みの結果を復元しました。" : "採点とガチャ券の保存が完了しました。";
  } catch (error) {
    $("quizStatus").textContent = "採点結果を保存できませんでした。同じ回答で安全に再試行できます。";
    toast(error.message || "クイズ採点に失敗しました。");
  } finally { quizBusy = false; markQuizBoundaryForMatchedRoom(); renderQuiz(); renderGacha(); render(); flushMatchedRoomHandoff(); }
}

async function runGacha(requestedCount = 1, retry = false) {
  if (gachaBusy || !profile()) return;
  const level = Number($("gachaLevel").value || 1);
  const available = Number(profile().gachaTickets?.[String(level)] || 0);
  if (!retry) {
    const count = requestedCount === null ? Math.min(available, 100) : requestedCount;
    if (count < 1) return toast("このレベルのガチャ券がありません。");
    const continuation = armedCpuRewardGachaOrigin?.ticketLevel === level
      && isCurrentCpuRewardGachaContinuation(armedCpuRewardGachaOrigin)
      ? { ...armedCpuRewardGachaOrigin }
      : null;
    pendingGacha = { actionId: crypto.randomUUID(), ticketLevel: level, count, ...(continuation ? { continuation } : {}) };
    armedCpuRewardGachaOrigin = null;
    localStorage.setItem(GACHA_PENDING_KEY, JSON.stringify(pendingGacha));
  }
  if (!pendingGacha) return;
  gachaBusy = true; $("gachaStatus").textContent = "サーバーで抽選中…"; renderGacha();
  try {
    const completedContinuation = pendingGacha.continuation || null;
    const result = await client.drawGacha(pendingGacha);
    persistRemoteProfile(result.profileState, displayName(), Number(result.revision));
    lastGachaDraws = result.draws || [];
    lastGachaContinuation = isCurrentCpuRewardGachaContinuation(completedContinuation) ? completedContinuation : null;
    persistCpuRewardGachaResult();
    pendingGacha = null; localStorage.removeItem(GACHA_PENDING_KEY);
    $("gachaStatus").textContent = `${lastGachaDraws.length}枚を獲得しました。券消費とカード付与は一度だけ保存済みです。`;
    requestAnimationFrame(() => {
      $("gachaResults").focus({ preventScroll: true });
      $("gachaResults").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  } catch (error) {
    const remote = await client.readProfile().catch(() => null);
    if (remote) hydrateProfileRow(remote);
    $("gachaStatus").textContent = "抽選結果を確認できませんでした。同じ抽選IDで安全に再試行できます。";
    toast(error.message || "ガチャに失敗しました。");
  } finally { gachaBusy = false; renderGacha(); render(); flushMatchedRoomHandoff(); }
}

async function createStarterProfile() {
  const name = String($("starterName").value || "").trim().slice(0, 20);
  if (!name) return toast("名前を入力してください。");
  localStorage.setItem(STARTER_PROFILE_KEY, JSON.stringify(starterProfile(name)));
  localStorage.setItem(PROFILE_CHOICE_KEY, STARTER_PROFILE_ID);
  loadProfiles();
  if (!connected) return toast("名前とスターター6枚を保存しました。接続後にオンライン対戦の準備をしてください。");
  await syncSelectedProfile();
  if (synced) toast("対戦準備ができました。遊び方を選んでください。");
}

function renderLoadout() {
  const value = profile();
  const debugMode = $("debugUnlimitedMode")?.checked === true;
  const grid = $("loadoutGrid");
  const previous = Object.fromEntries(["color", "area", "disrupt"].map((category) => [category, new Set([...document.querySelectorAll(`input[name="loadout-${category}"]:checked`)].map((input) => input.value))]));
  const hadSelection = grid.childElementCount > 0;
  const initial = hadSelection ? previous : Object.fromEntries(Object.entries(editorLoadout()).map(([category, ids]) => [category, new Set(ids)]));
  grid.replaceChildren();
  for (const category of ["color", "area", "disrupt"]) {
    const section = document.createElement("fieldset"); section.className = "loadout-category";
    const title = document.createElement("legend"); title.textContent = `${CATEGORY_LABEL[category]}（2枚）`; section.appendChild(title);
    const available = SKILLS.filter(([id, , kind]) => kind === category && (debugMode || (value?.inventory?.[id] || 0) > 0));
    for (const [index, [id, name]] of available.entries()) {
      const label = document.createElement("label"); label.className = "loadout-option";
      const input = document.createElement("input"); input.type = "checkbox"; input.name = `loadout-${category}`; input.value = id; input.checked = initial[category].has(id);
      input.setAttribute("aria-label", `${name}を持ち込む`);
      const copy = document.createElement("span"); copy.className = "loadout-option-copy";
      const cardName = document.createElement("strong"); cardName.textContent = name;
      const state = document.createElement("small"); state.className = "loadout-choice-state"; state.setAttribute("aria-hidden", "true");
      copy.append(cardName, state);
      const count = document.createElement("span"); count.className = "loadout-owned"; count.textContent = debugMode ? "所持 ∞" : `所持 ×${value.inventory[id]}`;
      input.onchange = () => enforceTwo(category, input); label.append(input, copy, count); section.appendChild(label);
    }
    if (!available.length) { const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "所持カードなし"; section.appendChild(empty); }
    grid.appendChild(section);
  }
  renderLoadoutSelectionState();
}

function enforceTwo(category, changed) {
  const checked = [...document.querySelectorAll(`input[name="loadout-${category}"]:checked`)];
  if (checked.length > 2) {
    changed.checked = false;
    return renderLoadoutSelectionState(`${CATEGORY_LABEL[category]}は2枚までです。入れ替えるカードを先に外してください。`);
  }
  persistLoadoutDraft(selectedLoadout());
  renderLoadoutSelectionState();
}
function selectedLoadout() {
  return Object.fromEntries(["color", "area", "disrupt"].map((category) => [category, [...document.querySelectorAll(`input[name="loadout-${category}"]:checked`)].map((input) => input.value)]));
}
function validLoadout(loadout) { return ["color", "area", "disrupt"].every((category) => loadout[category].length === 2); }

function renderLoadoutSelectionState(message = "") {
  const loadout = selectedLoadout();
  const counts = Object.fromEntries(Object.entries(loadout).map(([category, ids]) => [category, ids.length]));
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const remaining = Math.max(0, 6 - total);
  const ready = validLoadout(loadout);
  const snapshot = client.snapshot();
  const cpuDraft = pendingCpuStartSaga || cpuEntryDraft;
  const roomlessWorkshop = !snapshot.roomId && loadoutWorkshopOpen && !cpuDraft;
  const cpuName = cpuDraft ? CPU_NAMES[cpuDraft.characterId] || "CPU" : "";
  const actionPending = setupBusy || cpuStartSagaBusy || abandonBusy || hasPendingAbandon(snapshot.roomId);
  const inputFrozen = actionPending || Boolean(pendingCpuStartSaga);
  $("loadoutSummary").textContent = message || `選択 ${total}/6｜色 ${counts.color}/2｜エリア ${counts.area}/2｜妨害 ${counts.disrupt}/2${remaining ? `｜あと${remaining}枚` : "｜準備OK"}`;
  $("loadoutSummary").classList.toggle("is-complete", ready);
  $("setupTitle").textContent = cpuDraft ? `${cpuName}戦で使う6枚を確認` : roomlessWorkshop ? "次の対戦で使う6枚" : "対戦で使う6枚";
  $("setupDescription").textContent = roomlessWorkshop
    ? "ここで選んだ6枚を、この端末の次の対戦候補として保存します。まだ対戦やルームは始まりません。"
    : cpuDraft
      ? "各カテゴリ2枚・合計6枚を確認し、最後のボタンを押した時だけCPU対戦を作成します。"
      : "色は塗り方、エリアは形や大きさ、妨害は相手への働きかけを担当します。3つの役割を使えるよう、各2枚・合計6枚を選びます。";
  show("cpuStartReview", Boolean(cpuDraft));
  if (cpuDraft) $("cpuStartReview").textContent = pendingCpuStartSaga
    ? `CPU「${cpuName}」とこの6枚で開始処理を再確認しています。選択内容は完了まで変更されません。`
    : `対戦相手：CPU「${cpuName}」。この画面ではまだ対戦は始まっていません。`;
  $("setupCommitTitle").textContent = actionPending ? "開始結果を安全に確認しています…" : ready ? "6枚を選択済み・準備OK" : `あと${remaining}枚を選ぶと準備できます`;
  $("setupCommitBar").classList.toggle("is-ready", ready);
  for (const input of document.querySelectorAll('#loadoutGrid input[type="checkbox"]')) {
    const label = input.closest(".loadout-option");
    label?.classList.toggle("is-selected", input.checked);
    label?.querySelector(".loadout-choice-state")?.replaceChildren(document.createTextNode(input.checked ? "✓ 持ち込む" : "持ち込まない"));
    input.disabled = inputFrozen;
  }
  $("submitSetup").textContent = cpuDraft
    ? pendingCpuStartSaga ? "同じ開始処理を再確認" : `このCPU・6枚で対戦開始`
    : roomlessWorkshop ? "この6枚を次戦候補に保存" : snapshot.setupRevision > 0 ? "変更した6枚で準備し直す" : "この6枚で準備完了";
  $("submitSetup").disabled = actionPending || !ready;
  show("cancelCpuDraft", Boolean(cpuEntryDraft) && !pendingCpuStartSaga);
  const debugOption = $("debugUnlimitedMode")?.closest("label");
  if (debugOption) debugOption.classList.toggle("hidden", Boolean(cpuDraft) || roomlessWorkshop);
}

async function refreshRoom(_reason, expectedRoomId = client.snapshot().roomId) {
  if (!expectedRoomId) { stopCpuTurnWatch(); return render(); }
  let nextRoomModel;
  try {
    nextRoomModel = await client.readRoom(expectedRoomId);
  } catch (error) {
    if (error?.code !== "P0002") throw error;
    if (client.snapshot().roomId !== expectedRoomId) return null;
    clearContactReveal();
    stopCpuTurnWatch();
    roomSync.stop();
    client.clearRoom();
    roomModel = null;
    resolveQuizRoomClassification();
    render();
    toast("対戦は終了または失効しました。ロビーへ戻ります。");
    return null;
  }
  if (client.snapshot().roomId !== expectedRoomId) return null;
  if (nextRoomModel?.room?.status === "abandoned") {
    const initiatedHere = hasPendingAbandon(expectedRoomId) || $("abandonRoomDialog")?.open;
    completeAbandonedRoom({
      focusLobby: initiatedHere || activeAppTab === "battle",
      message: initiatedHere
        ? "開始前の対戦を取りやめました。戦績・報酬はありません。"
        : "相手が開始前の対戦を取りやめました。戦績・報酬はありません。",
    });
    return nextRoomModel;
  }
  if (roomModel?.room?.id === expectedRoomId && Number(nextRoomModel.room.version) < Number(roomModel.room.version)) return null;
  roomModel = nextRoomModel;
  hydrateProfileRow(roomModel.profile);
  if ($("abandonRoomDialog").open && !["waiting", "ready"].includes(roomModel.room.status)) resolveAbandonStateConflict(roomModel.room.status);
  else render();
  if (roomModel.room.status === "ready" && client.snapshot().setupRevision > 0 && !hasStandardPublicState(roomModel.room.public_state) && !initializeBusy && !hasPendingAbandon(expectedRoomId)) {
    initializeBusy = true;
    try {
      await client.initialize();
      const initializedRoom = await client.readRoom(expectedRoomId);
      if (client.snapshot().roomId === expectedRoomId) roomModel = initializedRoom;
    } catch (error) {
      if (error?.code === "DEBUG_MODE_MISMATCH") toast("デバッグ設定が相手と違います。2人とも同じ設定にして、もう一度6枚を確認してください。");
      else if (!String(error.message).includes("setup")) console.warn(error);
    }
    finally { initializeBusy = false; render(); }
  }
  scheduleCpuTurn();
}

const roomSync = onlineSyncFactory.createStandardOnlineSync({
  refreshRoom,
  subscribeRoom: (roomId, handlers) => client.subscribeToRoom({ roomId, ...handlers }),
  getRoomStatus: () => roomModel?.room?.status,
  isVisible: () => document.visibilityState !== "hidden",
  isOnline: () => navigator.onLine,
  onConnectionState: (state) => {
    if (state === "connected" || state === "realtime") badge("オンライン同期中", "good");
    else if (state === "offline") badge("オフライン（復帰待ち）", "warn");
    else badge("再接続中（自動再試行）", "warn");
  },
});

function reflectBrowserConnectivity() {
  if (!navigator.onLine) badge("オフライン（復帰待ち）", "warn");
  else if (!roomSync.snapshot().active && connected) badge("匿名ログイン済み", "good");
}

function stopCpuTurnWatch() {
  clearTimeout(cpuActionTimer);
  cpuActionTimer = null;
}

function cpuTurnIsReady() {
  const state = roomModel?.room?.public_state;
  return Boolean(client.snapshot().roomId && roomModel?.room?.opponent_kind === "cpu"
    && roomModel?.room?.status === "playing" && state?.status === "ACTIVE" && state.active === "B");
}

function scheduleCpuTurn(delay = 700) {
  stopCpuTurnWatch();
  if (cpuActionBusy || !cpuTurnIsReady() || document.visibilityState === "hidden" || !navigator.onLine) return;
  cpuActionTimer = setTimeout(runCpuTurn, delay);
}

async function runCpuTurn() {
  stopCpuTurnWatch();
  if (cpuActionBusy || !cpuTurnIsReady()) return;
  const expectedVersion = Number(roomModel.room.version);
  cpuActionBusy = true;
  $("actionStatus").textContent = `${CPU_NAMES[roomModel.room.cpu_character_id] || "CPU"}が考えています…`;
  render();
  try {
    await client.takeCpuTurn({ expectedVersion });
    await roomSync.refreshNow();
  } catch (error) {
    await roomSync.refreshNow().catch(() => {});
    if (!String(error?.message || "").match(/CPU_(TURN_CHANGED|NOT_ACTIVE)/)) console.warn(error);
  } finally {
    cpuActionBusy = false;
    render();
    scheduleCpuTurn();
  }
}

function render() {
  renderProfileCardVisibility();
  renderMatchedRoomHandoff();
  const snapshot = client.snapshot();
  const cpuDraft = pendingCpuStartSaga || cpuEntryDraft;
  const matchmakingEntryActive = Boolean(snapshot.matchmakingTicketId || snapshot.matchmakingFindActionId);
  const authoritativeRoomLoaded = Boolean(snapshot.roomId && roomModel?.room?.id === snapshot.roomId);
  const roomStatePending = Boolean(snapshot.roomId && !authoritativeRoomLoaded);
  const roomFinished = roomModel?.room?.status === "finished";
  const replacesShownFinishedCpu = Boolean(roomFinished && roomModel?.room?.opponent_kind === "cpu" && (
    (pendingCpuStartSaga?.stage === "start" && pendingCpuStartSaga.replaceRoomId === snapshot.roomId)
    || cpuEntryDraft?.replaceRoomId === snapshot.roomId
  ));
  const cpuDraftOwnsRoomlessEntry = Boolean(cpuDraft && !matchmakingEntryActive && (
    !snapshot.roomId
    || (pendingCpuStartSaga?.stage === "setup" && pendingCpuStartSaga.roomId === snapshot.roomId)
    || replacesShownFinishedCpu
  ));
  const activeRoom = Boolean(snapshot.roomId && !roomFinished);
  if (snapshot.roomId && roomModel?.room?.status !== "abandoned") clearRoomLifecycleAnnouncement();
  $("startStandardCpuHome").textContent = cpuDraftOwnsRoomlessEntry
    ? "CPU戦の開始確認へ戻る"
    : !snapshot.roomId
    ? "CPUとすぐStandard対戦"
    : roomFinished ? "対戦結果を見る" : "進行中の対戦へ戻る";
  $("editNextLoadout").textContent = cpuDraftOwnsRoomlessEntry
    ? "CPU戦の開始確認へ戻る"
    : activeRoom ? "進行中の対戦へ戻る" : roomFinished ? "対戦結果を見る" : "次の対戦用6枚を編集";
  document.querySelector('.home-actions [data-tab-jump="battle"]')?.classList.toggle("hidden", cpuDraftOwnsRoomlessEntry);
  document.querySelector(".mode-callout")?.classList.toggle("hidden", cpuDraftOwnsRoomlessEntry);
  show("quizPanel", synced && Boolean(profile()));
  renderQuiz();
  show("gachaPanel", synced && Boolean(profile()));
  renderGacha();
  show("cardLibraryPanel", synced && Boolean(profile()));
  renderCardLibrary();
  show("progressionPanel", synced && Boolean(profile()));
  show("cosmeticPanel", synced && Boolean(profile()));
  renderCosmetics();
  show("lobby", synced && !snapshot.roomId && !cpuDraftOwnsRoomlessEntry);
  renderMatchmaking();
  show("room", Boolean(snapshot.roomId));
  const setupVisible = Boolean(profile()) && !roomStatePending && ((Boolean(snapshot.roomId) && !["playing", "finished"].includes(roomModel?.room?.status))
    || cpuDraftOwnsRoomlessEntry || (!snapshot.roomId && loadoutWorkshopOpen && !matchmakingEntryActive));
  show("setupCard", setupVisible);
  document.body.classList.toggle("setup-active", setupVisible);
  show("matchCard", !cpuDraftOwnsRoomlessEntry && ["playing", "finished"].includes(roomModel?.room?.status));
  show("rematchControls", !cpuDraftOwnsRoomlessEntry && roomModel?.room?.status === "finished");
  if (!snapshot.roomId) {
    observeCommittedContact(null);
    show("tacticalTrace", false);
    show("abandonRoom", false);
    show("abandonRoomHint", false);
    if (setupVisible) renderLoadoutSelectionState();
    renderTerminalResult(null);
    return;
  }
  if (roomStatePending) {
    observeCommittedContact(null);
    show("tacticalTrace", false);
    $("shownCode").textContent = "確認中";
    $("roomStatus").textContent = "対戦状態を確認中";
    $("members").replaceChildren();
    $("waitingMessage").textContent = "対戦状態を確認しています。操作せず、そのままお待ちください。";
    $("leaveRoom").textContent = "画面だけ閉じる";
    $("leaveRoomDescription").textContent = "対戦状態の確認は継続します。";
    $("leaveRoom").disabled = abandonBusy;
    show("abandonRoom", false);
    show("abandonRoomHint", false);
    $("requestRematch").disabled = true;
    operationFeedback("setupStatus", "");
    renderTerminalResult(null);
    return;
  }
  const cpuRoom = roomModel?.room?.opponent_kind === "cpu";
  show("chooseDifferentCpu", cpuRoom && roomModel?.room?.status === "finished");
  const accessMode = roomModel?.room?.access_mode || (snapshot.roomCode ? "private_code" : "public_queue");
  const debugAllowed = accessMode === "private_code" && !cpuRoom;
  const debugToggle = $("debugUnlimitedMode");
  if (debugToggle) {
    debugToggle.disabled = !debugAllowed;
    if (!debugAllowed && debugToggle.checked) { debugToggle.checked = false; renderLoadout(); }
  }
  $("roomIdentityLabel").textContent = accessMode === "public_queue" ? "対戦形式" : accessMode === "cpu" ? "対戦相手" : "合言葉";
  $("shownCode").textContent = accessMode === "public_queue" ? "野良対戦" : accessMode === "cpu" ? `CPU：${CPU_NAMES[roomModel?.room?.cpu_character_id] || playerName("B")}` : snapshot.roomCode || "復帰済";
  $("seatBadge").textContent = roomModel?.view?.seat ? `Player ${roomModel.view.seat}` : "席確認中";
  const debugMatch = roomModel?.room?.public_state?.debugUnlimitedSkills === true;
  $("roomStatus").textContent = `${ROOM_STATUS_LABEL[roomModel?.room?.status] || "読み込み中"}${debugMatch ? "・デバッグ∞" : ""}`;
  const roomAbandonable = ["waiting", "ready"].includes(roomModel?.room?.status);
  const pendingAbandon = roomAbandonable && hasPendingAbandon(snapshot.roomId);
  $("leaveRoom").textContent = roomFinished ? "結果を閉じてロビーへ" : "画面だけ閉じる";
  $("leaveRoomDescription").textContent = roomFinished ? "対戦結果と戦績は保存されています。" : "ルーム・待機・対戦は継続します。";
  $("leaveRoom").disabled = abandonBusy;
  show("abandonRoom", roomAbandonable);
  show("abandonRoomHint", roomAbandonable);
  $("abandonRoom").textContent = pendingAbandon ? "取りやめ結果を再確認" : "開始前の対戦を取りやめる";
  $("abandonRoom").disabled = abandonBusy;
  const rematchPending = snapshot.rematchExpectedVersion === roomModel?.room?.version;
  $("requestRematch").textContent = rematchPending ? "同じ再戦申請を再送" : cpuRoom ? "同じCPUと再戦する" : "再戦を申し込む";
  $("requestRematch").disabled = rematchBusy || roomModel?.room?.status !== "finished";
  $("rematchStatus").textContent = cpuRoom ? "CPUの状態だけを初期化し、あなたは6枚セットを選び直します。" : rematchPending ? "再戦を申請済みです。相手の申請を待っています。" : "両プレイヤーの申請後、6枚セットを選び直します。";
  $("members").replaceChildren(...(roomModel?.members || []).map((member) => {
    const node = document.createElement("span");
    const gold = member.appearance?.nameplate === "nameplateGold";
    node.className = `member${gold ? " member-nameplate-gold" : ""}`;
    node.textContent = `Player ${member.seat}: ${cosmeticIdentity(member.display_name, member.appearance)}`;
    if (member.is_cpu) node.append("（CPU）");
    return node;
  }));
  const setupReady = client.snapshot().setupRevision > 0;
  $("waitingMessage").textContent = roomFinished
    ? "対戦は終了しました。下の勝敗理由と再戦メニューを確認してください。"
    : roomModel?.room?.status === "playing"
      ? cpuRoom ? "CPUとの対戦中です。盤面と手番案内を確認してください。" : "対戦中です。盤面と手番案内を確認してください。"
      : setupReady ? "あなたは準備完了です。相手の準備を待っています。" : "対戦で使う6枚を決めて、準備完了にしてください。";
  const currentSetupFailure = setupFailureMessage();
  operationFeedback("setupStatus", roomFinished ? "" : currentSetupFailure || (setupReady
    ? "準備完了。相手を待っています。開始前なら6枚を変更できます。"
    : "選択済みの6枚でよければ、準備完了にしてください。"), currentSetupFailure ? "error" : "");
  $("submitSetup").textContent = setupReady ? "変更した6枚で準備し直す" : "この6枚で準備完了";
  renderLoadoutSelectionState();
  if (hasStandardPublicState(roomModel?.room?.public_state)) {
    const publicState = roomModel.room.public_state;
    const privateState = roomModel.view?.private_state || {};
    $("versionText").textContent = publicState.turn;
    $("turnBadge").textContent = publicState.status === "FINISHED"
      ? `勝者 Player ${publicState.winner}`
      : publicState.active === roomModel?.view?.seat ? "あなたの手番" : cpuRoom && publicState.active === "B" ? "CPUの手番" : `Player ${publicState.active} の手番`;
    $("phaseText").textContent = phaseLabelFor(publicState, roomModel?.view?.seat, cpuRoom);
    $("publicProjection").textContent = safeJson(publicState);
    $("privateProjection").textContent = safeJson(privateState);
    renderRandomSummary(publicState, privateState);
    revealRandomSetup(publicState, privateState);
    observeCommittedContact(publicState);
    renderTacticalTrace(publicState);
    renderBoard(publicState);
    renderBasicActions(publicState, privateState);
    renderSkills(publicState, privateState);
    renderPersistentTerminalResult(publicState, privateState);
    renderTerminalResult(publicState);
  } else {
    observeCommittedContact(null);
    show("tacticalTrace", false);
    show("terminalSummary", false);
    renderTerminalResult(null);
  }
}

function button(text, onClick, className = "") {
  const node = document.createElement("button"); node.textContent = text; node.className = className; node.onclick = onClick; return node;
}

function renderSkills(state, privateState) {
  const box = $("skillControls"); box.replaceChildren();
  const myTurn = state.status === "ACTIVE" && state.active === roomModel?.view?.seat;
  for (const [skill, count] of Object.entries(privateState.hand || {})) {
    if (!(count > 0) || !SKILL_META[skill]) continue;
    const meta = SKILL_META[skill];
    const item = document.createElement("div"); item.className = "skill-entry";
    const node = button(`${meta.name} ${state.debugUnlimitedSkills ? "∞" : `×${count}`}`, () => beginSkill(skill), "skill");
    const timingOkay = meta.category === "color" ? state.phase === "COLOR" : ["CREATE_FIRST", "WORK"].includes(state.phase);
    node.disabled = actionBusy || !myTurn || !timingOkay;
    const info = button("ⓘ", () => openSkillInfo(skill), "skill-info-button");
    info.type = "button"; info.setAttribute("aria-label", `${meta.name}の説明`); info.title = `${meta.name}の説明`;
    item.append(node, info); box.appendChild(item);
  }
  renderSkillTarget(state);
}

function beginSkill(skill) {
  if (skillIntents.isImmediate(skill)) {
    return sendAction("USE_SKILL", skillIntents.buildSkillPayload(skill));
  }
  targetDraft = { skill, kind: skillIntents.TARGET_KIND[skill], input: {} };
  selectedMacros.clear(); render();
}

function targetChoice(label, key, value) {
  const selected = targetDraft?.input?.[key] === value;
  const node = button(label, () => { targetDraft.input[key] = value; render(); }, selected ? "primary" : "ghost");
  return node;
}

function renderSkillTarget(state) {
  const panel = $("skillTargetControls"); panel.replaceChildren(); show("skillTargetControls", Boolean(targetDraft));
  if (!targetDraft) return;
  const title = document.createElement("strong"); title.textContent = `${SKILL_META[targetDraft.skill].name} — 対象を指定`; panel.appendChild(title);
  const controls = document.createElement("div"); controls.className = "controls";
  if (["color", "slot-color"].includes(targetDraft.kind)) {
    for (const color of skillIntents.COLORS) controls.appendChild(targetChoice(COLOR_JA[color], "color", color));
  }
  if (targetDraft.kind === "slot-color") for (const slot of [0, 1, 2]) controls.appendChild(targetChoice(`持ち色${slot + 1}`, "slot", slot));
  if (targetDraft.kind === "region-split") {
    for (const id of Object.keys(state.regions || {})) controls.appendChild(targetChoice(id, "regionId", id));
  }
  if (["source-macros", "region-split", "corner-bloom"].includes(targetDraft.kind)) {
    const note = document.createElement("span"); note.className = "selected-macro-note"; note.textContent = `盤面選択 ${selectedMacros.size}マス`; controls.appendChild(note);
  }
  if (targetDraft.kind === "corner-bloom") {
    const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.placeholder = "角の基準マス";
    input.value = targetDraft.input.macro ?? ""; input.oninput = () => { targetDraft.input.macro = Number(input.value); }; controls.appendChild(input);
  }
  if (targetDraft.kind === "resize") {
    for (const mode of ["expand", "shrink"]) controls.appendChild(targetChoice(mode === "expand" ? "拡大" : "縮小", "mode", mode));
    for (const [side, label] of [["top", "上"], ["right", "右"], ["bottom", "下"], ["left", "左"]]) controls.appendChild(targetChoice(label, "side", side));
  }
  if (targetDraft.kind === "band-shift") {
    for (const axis of ["ROW", "COLUMN"]) controls.appendChild(targetChoice(axis === "ROW" ? "行" : "列", "axis", axis));
    const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = String(state.playableBounds.macroWidth - 1); input.placeholder = "番号";
    input.value = targetDraft.input.index ?? ""; input.oninput = () => { targetDraft.input.index = Number(input.value); }; controls.appendChild(input);
    for (const direction of ["minus", "plus"]) controls.appendChild(targetChoice(direction === "minus" ? "負方向" : "正方向", "direction", direction));
  }
  panel.appendChild(controls);
  const actions = document.createElement("div"); actions.className = "controls";
  if (["source-macros", "region-split", "corner-bloom"].includes(targetDraft.kind)) {
    actions.appendChild(button("盤面選択を解除", () => { selectedMacros.clear(); render(); }, "ghost"));
  }
  actions.appendChild(button("この対象で使う", submitSkillTarget, "primary"));
  actions.appendChild(button("キャンセル", () => { targetDraft = null; selectedMacros.clear(); render(); }, "ghost")); panel.appendChild(actions);
}

function submitSkillTarget() {
  if (!targetDraft) return;
  const input = { ...targetDraft.input };
  if (["source-macros", "region-split", "corner-bloom"].includes(targetDraft.kind)) input.sourceMacros = [...selectedMacros];
  try {
    const payload = skillIntents.buildSkillPayload(targetDraft.skill, input);
    targetDraft = null; selectedMacros.clear(); sendAction("USE_SKILL", payload);
  } catch { toast("対象の指定が不足しています。"); }
}

function renderBoard(state) {
  const canvas = $("board"); const ctx = canvas.getContext("2d");
  const macroWidth = state.playableBounds.macroWidth; const microScale = state.playableBounds.microScale;
  const microWidth = macroWidth * microScale; const cell = canvas.width / microWidth;
  ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bounds = state.playableBounds;
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(bounds.minCol * microScale * cell, bounds.minRow * microScale * cell,
    (bounds.maxCol - bounds.minCol + 1) * microScale * cell, (bounds.maxRow - bounds.minRow + 1) * microScale * cell);
  for (const region of Object.values(state.regions || {})) {
    ctx.fillStyle = region.color ? COLOR_HEX[region.color] : "#94a3b8";
    for (const micro of region.micro || []) {
      const x = micro % microWidth; const y = Math.floor(micro / microWidth);
      ctx.fillRect(x * cell, y * cell, cell + .2, cell + .2);
    }
  }
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
  for (let index = 0; index <= macroWidth; index += 1) {
    const offset = index * microScale * cell;
    ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, offset); ctx.lineTo(canvas.width, offset); ctx.stroke();
  }
  ctx.fillStyle = "#ffffff38"; ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 3;
  for (const macro of selectedMacros) {
    const col = macro % macroWidth; const row = Math.floor(macro / macroWidth);
    ctx.fillRect(col * microScale * cell, row * microScale * cell, microScale * cell, microScale * cell);
    ctx.strokeRect(col * microScale * cell + 1, row * microScale * cell + 1, microScale * cell - 2, microScale * cell - 2);
  }
}

function phaseLabelFor(state, seat, cpuRoom) {
  if (state.status === "FINISHED" || state.phase === "GAME_OVER") return "対戦終了";
  if (state.active === seat) return PHASE_LABEL[state.phase] || "あなたの手番です";
  const actor = cpuRoom && state.active === "B" ? "CPU" : "相手";
  return {
    CREATE_FIRST: `${actor}が最初のエリアを選んでいます`,
    WORK: `${actor}が渡すエリアを選んでいます`,
    COLOR: `${actor}が受け取ったエリアを塗っています`,
  }[state.phase] || `${actor}の手番です`;
}

function renderTurnGuide(state) {
  const guide = $("turnGuide");
  const seat = roomModel?.view?.seat;
  const cpuRoom = roomModel?.room?.opponent_kind === "cpu";
  const myTurn = state.status === "ACTIVE" && state.active === seat;
  const opponent = cpuRoom ? "CPU" : "相手";
  const makerIsMe = ["CREATE_FIRST", "WORK"].includes(state.phase) ? myTurn : state.phase === "COLOR" && !myTurn;
  const rolePath = makerIsMe ? `あなたが作る → ${opponent}が塗る` : `${opponent}が作る → あなたが塗る`;
  const setText = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
  const present = (kind, step, title, detail) => {
    guide.dataset.state = kind;
    setText("turnGuideStep", step);
    setText("turnGuideTitle", title);
    setText("turnGuideDetail", detail);
    show("turnGuide", true);
  };
  if (state.status !== "ACTIVE" || targetDraft) return show("turnGuide", false);
  if (actionBusy) return present("wait", "送信中", "サーバーで操作を確認しています", "結果が返るまで、そのままお待ちください。");
  if (pendingAction) return present("ready", "再送", "前の操作の結果を確認します", "下の「同じ操作を再送」で、同じ操作IDのまま安全に確認できます。");
  if (!myTurn && cpuRoom && state.active === "B" && state.phase === "CREATE_FIRST") {
    return present("wait", rolePath, "CPUが最初のエリアを選んでいます", "次は、受け取った灰色エリアを盤面の下にある持ち色から塗ります。");
  }
  if (!myTurn && ["CREATE_FIRST", "WORK"].includes(state.phase)) return present("wait", rolePath, `${opponent}があなたへ渡すエリアを作っています`, "次に受け取るエリアを、どの色で塗るか考えながら待ちましょう。");
  if (!myTurn && state.phase === "COLOR") return present("wait", rolePath, `${opponent}が受け取ったエリアを塗っています`, "あなたが作った灰色エリアの彩色を待っています。");
  if (state.phase === "CREATE_FIRST") {
    const remaining = Math.max(0, state.requiredSize - selectedMacros.size);
    if (remaining > 0) return present("select", rolePath, `白い盤面をタップして、あと${remaining}マス選ぶ`, "選べたら「このエリアを渡す」を押します。選んだエリアは相手が塗ります。");
    return present("ready", rolePath, "選べました。「このエリアを渡す」へ", "選んだマスは白い枠で表示されています。下のボタンで相手へ渡します。");
  }
  if (state.phase === "WORK") {
    const remaining = Math.max(0, state.requiredSize - selectedMacros.size);
    if (remaining > 0) return present("select", rolePath, `盤面をタップ／クリックして、あと${remaining}マス選ぶ`, "選んだエリアは相手が塗ります。相手が困る形や接し方を考えてみましょう。");
    return present("ready", rolePath, "選べました。「このエリアを渡す」へ", "選んだマスは白い枠で表示されています。下のボタンで相手へ渡します。");
  }
  if (state.phase === "COLOR") return present("color", rolePath, "受け取った灰色エリアを塗る", "盤面の下にある持ち色から選びます。同じ色が辺で接しないように塗りましょう。");
  show("turnGuide", false);
}

function isColorSealed(state, seat, color) {
  return ["A", "B"].includes(seat)
    && skillIntents.COLORS.includes(color)
    && Number(state?.publicEffects?.[seat]?.seals?.[color] || 0) > 0;
}

function renderBasicActions(state, privateState) {
  const seat = roomModel?.view?.seat;
  const myTurn = state.status === "ACTIVE" && state.active === seat;
  const canCreate = myTurn && !targetDraft && ["CREATE_FIRST", "WORK"].includes(state.phase);
  renderTurnGuide(state);
  show("regionControls", canCreate);
  $("selectionCount").textContent = `${selectedMacros.size} / ${state.requiredSize}マス`;
  $("submitRegion").disabled = !canCreate || actionBusy || selectedMacros.size !== state.requiredSize;
  const palette = $("paletteControls"); palette.replaceChildren();
  if (myTurn && state.phase === "COLOR") {
    const colors = skillIntents.availableColorChoices(privateState);
    for (const color of colors) {
      const sealed = isColorSealed(state, seat, color);
      const button = document.createElement("button"); button.className = `color-button${sealed ? " is-sealed" : ""}`; button.dataset.color = color;
      button.textContent = sealed ? `🔒 ${COLOR_JA[color] || color}（封印中）` : COLOR_JA[color] || color;
      button.disabled = actionBusy || sealed; button.onclick = () => sendAction("COLOR_REGION", { color }); palette.appendChild(button);
    }
  }
  $("surrender").disabled = actionBusy || !myTurn;
  if (state.status === "FINISHED") {
    stopCpuTurnWatch();
    pendingAction = null;
    targetDraft = null;
    selectedMacros.clear();
    operationFeedback("actionStatus", "");
  }
  if (pendingAction && (pendingAction.roomId !== roomModel?.room?.id || pendingAction.matchId !== state.matchId)) pendingAction = null;
  show("retryAction", Boolean(pendingAction) && !actionBusy);
}

function boardPointer(event) {
  const state = roomModel?.room?.public_state; const seat = roomModel?.view?.seat;
  const skillGeometry = targetDraft && ["source-macros", "region-split", "corner-bloom"].includes(targetDraft.kind);
  if (!state || roomModel?.room?.status !== "playing" || state.status !== "ACTIVE" || actionBusy || state.active !== seat || (!skillGeometry && !["CREATE_FIRST", "WORK"].includes(state.phase))) return;
  const rect = event.currentTarget.getBoundingClientRect(); const width = state.playableBounds.macroWidth;
  const col = Math.max(0, Math.min(width - 1, Math.floor((event.clientX - rect.left) / rect.width * width)));
  const row = Math.max(0, Math.min(width - 1, Math.floor((event.clientY - rect.top) / rect.height * width)));
  const macro = row * width + col;
  if (selectedMacros.has(macro)) {
    selectedMacros.delete(macro);
  } else if (selectedMacros.size < state.requiredSize) {
    selectedMacros.add(macro);
  }
  render();
}

async function sendAction(type, payload = {}, retry = false) {
  const state = roomModel?.room?.public_state; if (!state || actionBusy) return;
  if (type === "COLOR_REGION" && isColorSealed(state, roomModel?.view?.seat, payload?.color)) {
    const color = COLOR_JA[payload?.color] || "この色";
    $("actionStatus").textContent = `🔒 ${color}は封印中です。別の色を選んでください。`;
    toast(`${color}は封印中です。`);
    render();
    return;
  }
  const signature = actionSignature(type, payload);
  const roomId = roomModel.room.id;
  const matchId = state.matchId;
  if (retry && (!pendingAction || pendingAction.roomId !== roomId || pendingAction.matchId !== matchId || pendingAction.signature !== signature)) {
    pendingAction = null;
    operationFeedback("actionStatus", "対戦が切り替わったため、前の操作は再送しません。最新の盤面で選び直してください。", "error");
    revealOperationFeedback("actionStatus");
    render();
    return;
  }
  if (!retry) {
    pendingAction = { roomId, matchId, id: crypto.randomUUID(), expectedVersion: roomModel.room.version, type, payload, signature };
  }
  actionBusy = true; operationFeedback("actionStatus", "サーバーで確認中…"); render();
  try {
    const response = await client.submitAction(pendingAction);
    pendingAction = null; selectedMacros.clear(); operationFeedback("actionStatus", "操作を保存しました。", "success");
    await roomSync.refreshNow();
  } catch (error) {
    const safeMessage = error?.message || "操作を完了できませんでした。";
    if (error?.retryable === false) {
      pendingAction = null;
      operationFeedback("actionStatus", `${safeMessage} 最新の盤面を確認し、操作を選び直してください。`, "error");
    } else {
      operationFeedback("actionStatus", `${safeMessage} 下の「同じ操作を再送」で結果を確認してください。`, "retry");
    }
    revealOperationFeedback("actionStatus");
    toast(safeMessage);
    await roomSync.refreshNow().catch(() => {});
  } finally { actionBusy = false; render(); }
}

async function syncSelectedProfile() {
  const value = profile(); if (!value || profileSyncBusy) return;
  profileSyncBusy = true;
  renderProfile();
  try {
    const remote = await client.readProfile();
    if (remote) hydrateProfileRow(remote);
    else {
      const created = await client.syncProfile({ displayName: displayName(), profileState: value });
      persistRemoteProfile(created.profileState || value, created.displayName || displayName(), Number(created.revision));
    }
    synced = true; badge("プロフィール同期済み", "good"); renderProfile(); render();
    await refreshOnlineCosmetics({ quiet: true });
    if (hasCpuEntryIntent()) await openCpuRoster("direct", $("startStandardCpuHome"));
  } catch (error) { toast(error.message || "同期に失敗しました。"); }
  finally { profileSyncBusy = false; renderProfile(); }
}

function matchmakingWaitSeconds() {
  const startedAt = Date.parse(client.snapshot().matchmakingStartedAt || "");
  return Number.isFinite(startedAt) ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
}

function updateMatchmakingElapsed() {
  const snapshot = client.snapshot();
  const seconds = matchmakingWaitSeconds();
  $("matchmakingElapsed").textContent = `待機 ${seconds}秒`;
  if (cpuOfferTicketId !== snapshot.matchmakingTicketId) {
    cpuOfferTicketId = snapshot.matchmakingTicketId;
    cpuOfferDismissedStage = 0;
    cpuOfferAnnouncedStage = 0;
  }
  const offerStage = seconds >= CPU_SECOND_OFFER_SECONDS ? 2 : seconds >= CPU_FIRST_OFFER_SECONDS ? 1 : 0;
  const offerVisible = Boolean(snapshot.matchmakingTicketId) && offerStage > cpuOfferDismissedStage;
  show("cpuOpponentOffer", offerVisible);
  if (offerVisible) {
    $("cpuOfferMessage").textContent = offerStage === 2
      ? "3分待ちました。人間を待ち続けるか、好きなCPUと対戦するかを選べます。"
      : "90秒待ちました。人間を待ち続けるか、好きなCPUと対戦するかを選べます。";
  }
  if (offerStage > cpuOfferAnnouncedStage && !matchmakingBusy) {
    cpuOfferAnnouncedStage = offerStage;
    $("matchmakingStatus").textContent = offerStage === 2
      ? "もう3分待っています。CPUを選ぶことも、このまま人を待つこともできます。"
      : "CPUとの対戦も選べるようになりました。選ばない限りCPU戦は始まりません。";
  }
}

function stopMatchmakingWatch() {
  clearTimeout(matchmakingStatusTimer); matchmakingStatusTimer = null;
  clearInterval(matchmakingDisplayTimer); matchmakingDisplayTimer = null;
}

function scheduleMatchmakingStatus(delay = 15000) {
  clearTimeout(matchmakingStatusTimer);
  if (!client.snapshot().matchmakingTicketId || client.snapshot().roomId || document.visibilityState === "hidden" || !navigator.onLine) return;
  matchmakingStatusTimer = setTimeout(pollMatchmakingStatus, delay);
  if (!matchmakingDisplayTimer) matchmakingDisplayTimer = setInterval(updateMatchmakingElapsed, 1000);
}

async function enterPublicMatch(message = "対戦相手が見つかりました。6枚セットを選んでください。") {
  const authoritativeRoomId = client.snapshot().roomId;
  if (!authoritativeRoomId) throw new Error("MATCHED_ROOM_NOT_CONFIRMED");
  stopMatchmakingWatch();
  stopCpuTurnWatch();
  if ($("cpuRosterDialog").open) $("cpuRosterDialog").close();
  await roomSync.start(authoritativeRoomId);
  render();
  if (client.snapshot().roomId !== authoritativeRoomId) return;
  if (roomModel?.room?.opponent_kind === "cpu") {
    $("matchmakingStatus").textContent = message;
    activateAppTab("battle");
    return;
  }
  queueMatchedRoomHandoff(message);
}

async function pollMatchmakingStatus() {
  if (matchmakingBusy || !client.snapshot().matchmakingTicketId) return scheduleMatchmakingStatus();
  matchmakingBusy = true;
  try {
    const result = await client.readMatchmakingStatus();
    if (result?.matchmaking_status === "matched") return await enterPublicMatch();
    if (result?.matchmaking_status === "expired") {
      stopMatchmakingWatch();
      $("matchmakingStatus").textContent = "接続が切れたため募集を終了しました。もう一度募集できます。";
    }
  } catch (error) {
    $("matchmakingStatus").textContent = "募集状態を確認できません。自動で再試行します。";
  } finally {
    matchmakingBusy = false;
    render();
    scheduleMatchmakingStatus();
  }
}

function renderMatchmaking() {
  if (!$("matchmakingPanel")) return;
  const snapshot = client.snapshot();
  const searching = Boolean(snapshot.matchmakingTicketId) && !snapshot.roomId;
  const cpuStartPending = Boolean(snapshot.cpuStartActionId && snapshot.cpuStartCharacterId) || Boolean(cpuEntryDraft || pendingCpuStartSaga);
  const newMatchBlocked = Boolean(snapshot.roomId || searching || snapshot.matchmakingFindActionId || cpuStartPending);
  $("startStandardCpuLobby").disabled = matchmakingBusy || cpuAcceptBusy || searching || Boolean(snapshot.matchmakingFindActionId);
  $("startStandardCpuLobby").title = searching ? "募集を取り消すか、90秒後のCPU提案を選んでください。" : "";
  $("createRoom").disabled = newMatchBlocked;
  $("joinRoom").disabled = newMatchBlocked;
  $("recruitOpponent").disabled = matchmakingBusy || newMatchBlocked;
  $("findOpponent").disabled = matchmakingBusy || newMatchBlocked;
  show("cancelMatchmaking", searching);
  $("cancelMatchmaking").disabled = matchmakingBusy;
  show("matchmakingWait", searching);
  if (searching) updateMatchmakingElapsed();
  else show("cpuOpponentOffer", false);
}

function newMatchEntryBlock({ allowFindResume = false, allowCpuOwner = false, replaceRoomId = null, allowOwnedSagaRoom = false } = {}) {
  const snapshot = client.snapshot();
  if (replaceRoomId && replaceRoomId !== snapshot.roomId) return { kind: "cpu" };
  const ownsSagaRoom = allowOwnedSagaRoom && pendingCpuStartSaga?.stage === "setup" && pendingCpuStartSaga.roomId === snapshot.roomId;
  const replaceableFinishedRoom = UUID_PATTERN.test(String(replaceRoomId)) && replaceRoomId === snapshot.roomId
    && roomModel?.room?.id === snapshot.roomId
    && roomModel.room.status === "finished" && roomModel.room.opponent_kind === "cpu";
  if (snapshot.roomId && !ownsSagaRoom && !replaceableFinishedRoom) return { kind: "room" };
  if (!allowCpuOwner && (pendingCpuStartSaga || cpuEntryDraft || (snapshot.cpuStartActionId && snapshot.cpuStartCharacterId))) return { kind: "cpu" };
  if (snapshot.matchmakingTicketId) return { kind: "ticket" };
  if (snapshot.matchmakingFindActionId && !allowFindResume) return { kind: "find" };
  return null;
}

function guardNewMatchEntry(options = {}) {
  const block = newMatchEntryBlock(options);
  if (!block) return false;
  if ($("cpuRosterDialog").open) $("cpuRosterDialog").close();
  activateAppTab("battle");
  render();
  if (block.kind === "room" || block.kind === "cpu") {
    focusMatchedRoom();
    toast(block.kind === "room" ? "新しい対戦は作らず、保存済みの対戦へ戻りました。" : "新しい対戦は作らず、CPU戦の開始確認へ戻りました。");
  } else if (block.kind === "ticket") {
    operationFeedback("matchmakingStatus", "対戦相手を募集中です。新しい対戦を始めるには、先に募集を取り消してください。");
    revealOperationFeedback("matchmakingStatus");
    requestAnimationFrame(() => $("matchmakingStatus").focus({ preventScroll: true }));
  } else {
    operationFeedback("matchmakingStatus", "直前の検索結果を同じ検索IDで確認中です。新しい検索は開始しません。");
    revealOperationFeedback("matchmakingStatus");
    requestAnimationFrame(() => $("matchmakingStatus").focus({ preventScroll: true }));
  }
  return true;
}

function renderCpuRoster(characters) {
  const grid = $("cpuRosterGrid"); grid.replaceChildren();
  const pendingCharacter = cpuRosterOrigin === "direct" ? pendingCpuStartSaga?.characterId || client.snapshot().cpuStartCharacterId : null;
  for (const character of characters) {
    const item = document.createElement("article"); item.className = "cpu-character-card";
    const title = document.createElement("h3"); title.textContent = character.name;
    const line = document.createElement("p"); line.className = "cpu-character-line"; line.textContent = `「${character.line}」`;
    const strength = document.createElement("p"); strength.textContent = `得意：${character.strength}`;
    const weakness = document.createElement("p"); weakness.textContent = `苦手：${character.weakness}`;
    const favorites = document.createElement("p"); favorites.className = "muted small";
    favorites.textContent = `よく使う：${(character.favorites || []).map((id) => SKILL_META[id]?.name || id).join("・")}`;
    const retrying = pendingCharacter === character.id;
    const choose = button(retrying ? `${character.name}との開始を再確認` : cpuRosterOrigin === "direct" ? `${character.name}を選んで6枚を確認` : `${character.name}と対戦`, () => acceptCpuCharacter(character), "primary");
    choose.type = "button"; choose.disabled = cpuAcceptBusy || Boolean(pendingCharacter && !retrying);
    item.append(title, line, strength, weakness, favorites, choose); grid.appendChild(item);
  }
}

async function openCpuRoster(origin = "fallback", trigger = document.activeElement) {
  const snapshot = client.snapshot();
  const replacingFinishedCpu = snapshot.roomId
    && roomModel?.room?.id === snapshot.roomId
    && roomModel?.room?.status === "finished"
    && roomModel?.room?.opponent_kind === "cpu";
  if (cpuAcceptBusy) return;
  if (origin === "fallback" && !snapshot.matchmakingTicketId) return;
  if (origin === "direct" && (!synced || (snapshot.roomId && !replacingFinishedCpu))) return;
  if (origin === "direct" && snapshot.matchmakingTicketId) {
    setCpuEntryIntent(false);
    return toast("いまは人間の対戦相手を募集中です。募集を取り消すか、90秒後のCPU提案を選んでください。");
  }
  cpuRosterOrigin = origin;
  cpuRosterTrigger = trigger instanceof HTMLElement ? trigger : null;
  cpuRosterReplaceRoomId = replacingFinishedCpu ? snapshot.roomId : null;
  $("cpuRosterTitle").textContent = origin === "direct" ? "Standard CPU対戦 — 相手を選ぶ" : "待ち時間をCPU戦へ切り替える";
  $("cpuRosterDescription").textContent = origin === "direct"
    ? "正式6枚のStandardルールで対戦します。CPUを選ぶまで対戦は始まりません。"
    : "人間の募集を終了し、選んだCPUと正式6枚のStandardルールで対戦します。";
  $("closeCpuRoster").textContent = replacingFinishedCpu ? "対戦結果に戻る" : origin === "direct" ? "ロビーに戻る" : "人を待ち続ける";
  if (!$("cpuRosterDialog").open) $("cpuRosterDialog").showModal();
  requestAnimationFrame(() => $("cpuRosterTitle").focus());
  $("cpuRosterStatus").textContent = "CPU一覧を読み込んでいます…";
  try {
    const result = cpuRosterCache || await client.readCpuRoster();
    if (!Array.isArray(result?.characters) || result.characters.length !== 10) throw new Error("INVALID_CPU_ROSTER");
    cpuRosterCache = result;
    renderCpuRoster(result.characters);
    $("cpuRosterStatus").textContent = pendingCpuStartSaga || client.snapshot().cpuStartCharacterId
      ? "前回選んだ同じCPUで、開始結果を安全に再確認できます。"
      : origin === "direct"
        ? "CPUを選んだ後に6枚を確認します。この画面の選択だけでは対戦は始まりません。"
        : "選択したCPUだけが対戦相手になります。人間として表示されることはありません。";
  } catch (error) {
    $("cpuRosterStatus").textContent = "CPU一覧を読み込めませんでした。閉じてからもう一度お試しください。";
    toast(error.message || "CPU一覧を読み込めませんでした。");
  }
}

async function acceptCpuCharacter(character) {
  if (cpuAcceptBusy || (cpuRosterOrigin === "fallback" && !client.snapshot().matchmakingTicketId)) return;
  if (cpuRosterOrigin === "direct") {
    if (guardNewMatchEntry({ replaceRoomId: cpuRosterReplaceRoomId })) return;
    cpuEntryDraft = { characterId: character.id, replaceRoomId: cpuRosterReplaceRoomId };
    loadoutWorkshopOpen = false;
    setCpuEntryIntent(false);
    if ($("cpuRosterDialog").open) $("cpuRosterDialog").close();
    activateAppTab("battle");
    renderLoadout();
    render();
    requestAnimationFrame(() => { $("setupTitle").focus({ preventScroll: true }); $("setupCard").scrollIntoView({ block: "start" }); });
    return;
  }
  cpuAcceptBusy = true; renderCpuRoster(cpuRosterCache?.characters || []);
  $("cpuRosterStatus").textContent = `${character.name}との対戦をサーバーで準備しています…`;
  try {
    const result = await client.acceptCpuOpponent({ characterId: character.id });
    setCpuEntryIntent(false);
    const actualCpuName = CPU_NAMES[result.characterId] || character.name;
    const message = result.opponentKind === "human"
      ? "先に成立していた対人戦へ戻りました。6枚セットを選んでください。"
      : `CPU「${actualCpuName}」との対戦を始めます。6枚セットを選んでください。`;
    return await enterPublicMatch(message);
  } catch (error) {
    if (cpuRosterOrigin === "fallback") {
      const status = await client.readMatchmakingStatus().catch(() => null);
      if (status?.matchmaking_status === "matched") return await enterPublicMatch("同時に人間の対戦相手が見つかりました。6枚セットを選んでください。");
    }
    $("cpuRosterStatus").textContent = "CPU対戦を開始できませんでした。募集状態を確認しながら安全に再試行できます。";
    toast(error.message || "CPU対戦を開始できませんでした。");
  } finally {
    cpuAcceptBusy = false;
    if ($("cpuRosterDialog").open && cpuRosterCache) renderCpuRoster(cpuRosterCache.characters);
    render();
  }
}

async function beginImmediateCpuEntry(trigger = document.activeElement, { replaceFinished = false } = {}) {
  if (pendingCpuStartSaga || cpuEntryDraft) {
    activateAppTab("battle");
    render();
    focusMatchedRoom();
    return;
  }
  const entryBlock = newMatchEntryBlock();
  if (entryBlock?.kind === "ticket" || entryBlock?.kind === "find") {
    guardNewMatchEntry();
    return;
  }
  setCpuEntryIntent(true);
  activateAppTab("battle");
  if (client.snapshot().roomId && (!replaceFinished || roomModel?.room?.status !== "finished")) {
    setCpuEntryIntent(false);
    focusMatchedRoom();
    return toast(roomModel?.room?.status === "finished" ? "対戦結果へ戻りました。" : "進行中の対戦へ戻りました。");
  }
  if (!connected) return toast("接続を準備しています。接続後にもう一度お試しください。");
  if (!profile()) {
    $("starterName").focus();
    return toast("名前を決めると、10人のCPU選択へ進みます。CPUを選ぶまで対戦は始まりません。");
  }
  if (!synced) return syncSelectedProfile();
  return openCpuRoster("direct", trigger);
}

async function runPendingCpuStartSaga({ focusOnSuccess = false } = {}) {
  if (cpuStartSagaBusy || !pendingCpuStartSaga) return false;
  if (guardNewMatchEntry({ allowCpuOwner: true, allowOwnedSagaRoom: true, replaceRoomId: pendingCpuStartSaga.replaceRoomId })) return false;
  let saga = pendingCpuStartSaga;
  cpuStartSagaBusy = true;
  operationFeedback("setupStatus", saga.stage === "setup"
    ? "作成済みCPU戦へ、同じ6枚確認IDだけを再送しています…"
    : "CPU対戦の開始結果を同じ処理IDで確認しています…");
  renderLoadoutSelectionState();
  try {
    if (saga.stage === "start") {
      const result = await client.startCpuOpponent({ actionId: saga.cpuStartActionId, characterId: saga.characterId });
      if (result.startStatus === "recovered_existing") {
        persistCpuStartSaga(null);
        cpuEntryDraft = null;
        loadoutWorkshopOpen = false;
        setCpuEntryIntent(false);
        const actualName = CPU_NAMES[result.characterId] || "対戦相手";
        await enterPublicMatch(result.opponentKind === "cpu"
          ? `新しい対戦は作らず、進行中のCPU「${actualName}」戦へ戻りました。`
          : "新しいCPU戦は作らず、先に成立していた対人戦へ戻りました。");
        if (focusOnSuccess) focusMatchedRoom();
        toast("進行中の対戦を復元しました。新しい6枚は送信していません。");
        return true;
      }
      if (!["created", "duplicate"].includes(result.startStatus)) throw new Error("INVALID_CPU_START_STATUS");
      saga = { ...saga, stage: "setup", roomId: result.roomId };
      persistCpuStartSaga(saga);
    }
    await roomSync.start(saga.roomId);
    await client.submitSetup({
      roomId: saga.roomId,
      expectedSetupRevision: 0,
      setupActionId: saga.setupActionId,
      loadout: saga.canonicalLoadout,
      debugMode: false,
    });
    nextLoadoutDraft = saga.canonicalLoadout;
    try { localStorage.setItem(LOADOUT_DRAFT_KEY, JSON.stringify(nextLoadoutDraft)); } catch { /* confirmed setup remains authoritative */ }
    persistCpuStartSaga(null);
    cpuEntryDraft = null;
    loadoutWorkshopOpen = false;
    setCpuEntryIntent(false);
    const actualName = CPU_NAMES[saga.characterId] || "CPU";
    await enterPublicMatch(`CPU「${actualName}」と確認した6枚で対戦を開始します。`);
    await roomSync.refreshNow();
    if (focusOnSuccess) focusStartedCpuMatch();
    toast("CPUと6枚を確認し、対戦を一度だけ開始しました。");
    return true;
  } catch (error) {
    const message = error?.message || "CPU対戦の開始結果を確認できませんでした。同じ開始処理を再送できます。";
    const roomId = client.snapshot().roomId;
    if (roomId) setupFailure = { roomId, message };
    operationFeedback("setupStatus", message, "error");
    revealOperationFeedback("setupStatus");
    toast(message);
    return false;
  } finally {
    cpuStartSagaBusy = false;
    render();
  }
}

async function commitCpuStartDraft() {
  const replaceRoomId = pendingCpuStartSaga?.replaceRoomId || cpuEntryDraft?.replaceRoomId || null;
  if (guardNewMatchEntry({ allowCpuOwner: true, replaceRoomId, allowOwnedSagaRoom: true })) return;
  if (pendingCpuStartSaga) return runPendingCpuStartSaga({ focusOnSuccess: true });
  if (!cpuEntryDraft || client.snapshot().roomId && roomModel?.room?.status !== "finished") return;
  const canonicalLoadout = normalizeLoadout(selectedLoadout(), { requireComplete: true, checkOwned: true });
  if (!canonicalLoadout) return toast("各カテゴリから所持カードを2枚ずつ選んでください。");
  persistLoadoutDraft(canonicalLoadout);
  const saga = {
    stage: "start",
    roomId: null,
    replaceRoomId: cpuEntryDraft.replaceRoomId || null,
    cpuStartActionId: crypto.randomUUID(),
    setupActionId: crypto.randomUUID(),
    characterId: cpuEntryDraft.characterId,
    canonicalLoadout,
  };
  try { persistCpuStartSaga(saga); }
  catch {
    return toast("開始内容をこの端末へ保存できないため、対戦はまだ始めていません。空き容量やブラウザー設定を確認してください。");
  }
  return runPendingCpuStartSaga({ focusOnSuccess: true });
}

async function resumePendingCpuStart() {
  const snapshot = client.snapshot();
  if (!snapshot.cpuStartActionId || !snapshot.cpuStartCharacterId || snapshot.roomId) return false;
  cpuAcceptBusy = true;
  try {
    const result = await client.startCpuOpponent({ characterId: snapshot.cpuStartCharacterId });
    setCpuEntryIntent(false);
    const name = CPU_NAMES[result.characterId || snapshot.cpuStartCharacterId] || "CPU";
    await enterPublicMatch(result.opponentKind === "human"
      ? "先に成立していた対人戦へ戻りました。6枚セットを選んでください。"
      : `CPU「${name}」との開始結果を確認しました。6枚セットを選んでください。`);
    return true;
  } catch (error) {
    setCpuEntryIntent(true);
    toast(error.message || "CPU対戦の開始結果を確認できませんでした。");
    return false;
  } finally { cpuAcceptBusy = false; render(); }
}

function keepWaitingForHuman() {
  cpuOfferDismissedStage = matchmakingWaitSeconds() >= CPU_SECOND_OFFER_SECONDS ? 2 : 1;
  show("cpuOpponentOffer", false);
  $("matchmakingStatus").textContent = cpuOfferDismissedStage === 2
    ? "このまま人間の対戦相手を待ちます。CPU戦は自動では始まりません。"
    : "人間の対戦相手を待ち続けます。3分経ったら、CPUの選択肢を一度だけ再表示します。";
}

async function recruitPublicOpponent() {
  if (guardNewMatchEntry() || matchmakingBusy || !profile()) return;
  matchmakingBusy = true; $("matchmakingStatus").textContent = "募集をサーバーへ登録しています…"; renderMatchmaking();
  try {
    const result = await client.recruitOpponent({ displayName: displayName() });
    if (result?.matchmaking_status === "matched") return await enterPublicMatch();
    $("matchmakingStatus").textContent = "対戦相手を探しています。待っている間もクイズやガチャで遊べます。";
    scheduleMatchmakingStatus();
  } catch (error) {
    $("matchmakingStatus").textContent = "募集を開始できませんでした。同じ募集票で再試行できます。";
    scheduleMatchmakingStatus(1000);
    toast(error.message || "対戦相手を募集できませんでした。");
  } finally { matchmakingBusy = false; render(); }
}

async function findPublicOpponent({ resumePending = false } = {}) {
  if (guardNewMatchEntry({ allowFindResume: resumePending }) || matchmakingBusy || !profile()) return;
  matchmakingBusy = true; $("matchmakingStatus").textContent = "今入れる試合を探しています…"; renderMatchmaking();
  try {
    const result = await client.findOpponent({ displayName: displayName() });
    if (result?.matchmaking_status === "matched") return await enterPublicMatch();
    $("matchmakingStatus").textContent = "今すぐ入れる試合はありません。『対戦相手を募集』なら待機を始められます。";
  } catch (error) {
    $("matchmakingStatus").textContent = "検索結果を確認できませんでした。同じ検索IDで再試行します。";
    toast(error.message || "今入れる試合を探せませんでした。");
  } finally { matchmakingBusy = false; render(); }
}

async function cancelPublicMatchmaking() {
  if (matchmakingBusy || !client.snapshot().matchmakingTicketId) return;
  matchmakingBusy = true; renderMatchmaking();
  try {
    const result = await client.cancelMatchmaking();
    if (result?.matchmaking_status === "matched") return await enterPublicMatch("取消の直前に対戦相手が見つかりました。6枚セットを選んでください。");
    stopMatchmakingWatch();
    $("matchmakingStatus").textContent = "募集を取り消しました。";
  } catch (error) {
    $("matchmakingStatus").textContent = "募集を取り消せませんでした。状態を再確認します。";
    scheduleMatchmakingStatus(1000);
    toast(error.message || "募集を取り消せませんでした。");
  } finally { matchmakingBusy = false; render(); }
}

async function createRoom() {
  if (guardNewMatchEntry()) return;
  try { await client.createRoom(displayName()); await roomSync.start(client.snapshot().roomId); } catch (error) { toast(error.message); }
}
async function joinRoom() {
  if (guardNewMatchEntry()) return;
  try { await client.joinRoom({ roomCode: $("roomCode").value, displayName: displayName() }); await roomSync.start(client.snapshot().roomId); } catch (error) { toast(error.message); }
}
function openLoadoutWorkshop() {
  if (client.snapshot().roomId) {
    activateAppTab("battle");
    focusMatchedRoom();
    return toast(roomModel?.room?.status === "finished" ? "対戦結果へ戻りました。結果を閉じると次戦用6枚を編集できます。" : "進行中の対戦へ戻りました。");
  }
  cpuEntryDraft = null;
  loadoutWorkshopOpen = true;
  activateAppTab("cards", { scrollTop: false });
  renderLoadout();
  render();
  requestAnimationFrame(() => { $("setupTitle").focus({ preventScroll: true }); $("setupCard").scrollIntoView({ block: "start" }); });
}

function saveLoadoutWorkshopDraft() {
  const loadout = normalizeLoadout(selectedLoadout(), { requireComplete: true, checkOwned: true });
  if (!loadout) return toast("各カテゴリから所持カードを2枚ずつ選んでください。");
  persistLoadoutDraft(loadout);
  operationFeedback("setupStatus", "この端末の次戦候補として6枚を保存しました。対戦やルームはまだ始まっていません。");
  toast("次の対戦用6枚を保存しました。");
  renderLoadoutSelectionState();
}

async function submitSetup() {
  const loadout = selectedLoadout(); if (!validLoadout(loadout)) return toast("各カテゴリから2枚ずつ選んでください。");
  const startingRoomStatus = roomModel?.room?.status;
  const interactionRevision = userInteractionRevision;
  setupBusy = true; setupFailure = null; operationFeedback("setupStatus", "6枚セットをサーバーで確認中…"); renderLoadoutSelectionState();
  const debugMode = $("debugUnlimitedMode")?.checked === true;
  try {
    await client.submitSetup({ loadout, debugMode });
    await roomSync.refreshNow();
    setupFailure = null;
    toast(debugMode ? "デバッグ用6枚で準備完了しました。相手もデバッグをONにしてください。" : "この6枚で準備完了しました。");
    if (startingRoomStatus === "ready" && roomModel?.room?.status === "playing") handoffFromSetupToMatch(interactionRevision);
  }
  catch (error) {
    const message = error?.message || "対戦準備を完了できませんでした。接続を確認して、もう一度お試しください。";
    setupFailure = { roomId: client.snapshot().roomId, message };
    operationFeedback("setupStatus", message, "error");
    revealOperationFeedback("setupStatus");
    toast(message);
  }
  finally { setupBusy = false; renderLoadoutSelectionState(); }
}

function submitCurrentLoadoutContext() {
  if (pendingCpuStartSaga || cpuEntryDraft) return commitCpuStartDraft();
  if (!client.snapshot().roomId && loadoutWorkshopOpen) return saveLoadoutWorkshopDraft();
  return submitSetup();
}

function cancelCpuDraft() {
  if (pendingCpuStartSaga || cpuStartSagaBusy) return;
  cpuEntryDraft = null;
  render();
  openCpuRoster("direct", $("startStandardCpuLobby"));
}

function completeAbandonedRoom({ message, focusLobby = false }) {
  const abandonedRoomId = client.snapshot().roomId;
  const ownsPendingCpuSetup = pendingCpuStartSaga?.stage === "setup"
    && pendingCpuStartSaga.roomId === abandonedRoomId;
  restoreAbandonDialogFocus = false;
  if ($("abandonRoomDialog").open) $("abandonRoomDialog").close();
  abandonDialogTrigger = null;
  abandonBusy = false;
  abandonRetryRoomId = null;
  abandonRetryExpectedVersion = null;
  clearContactReveal();
  stopCpuTurnWatch();
  roomSync.stop();
  client.clearRoom();
  roomModel = null;
  setupFailure = null;
  pendingAction = null;
  matchedRoomHandoff = null;
  announcedMatchedRoomId = null;
  $("matchedRoomAnnouncement").textContent = "";
  clearTimeout(matchedRoomHandoffTimer);
  matchedRoomHandoffTimer = null;
  if (ownsPendingCpuSetup) {
    persistCpuStartSaga(null);
    cpuEntryDraft = null;
    loadoutWorkshopOpen = false;
    setCpuEntryIntent(false);
  }
  operationFeedback("setupStatus", "");
  operationFeedback("actionStatus", "");
  operationFeedback("abandonRoomStatus", "");
  resolveQuizRoomClassification();
  if (focusLobby) activateAppTab("battle");
  render();
  announceRoomLifecycle(message);
  if (focusLobby || activeAppTab === "battle") focusBattleLobby();
}

function openRoomAbandonDialog(trigger = document.activeElement) {
  const snapshot = client.snapshot();
  if (!snapshot.roomId || roomModel?.room?.id !== snapshot.roomId || !["waiting", "ready"].includes(roomModel?.room?.status) || abandonBusy) return;
  abandonDialogTrigger = trigger instanceof HTMLElement ? trigger : $("abandonRoom");
  restoreAbandonDialogFocus = true;
  const retrying = abandonExpectedVersion(snapshot.roomId) !== null;
  $("confirmAbandonRoom").textContent = retrying ? "同じ取りやめ処理を再確認" : "無報酬で対戦を取りやめる";
  operationFeedback("abandonRoomStatus", retrying
    ? "前回の応答を確認できませんでした。同じ処理を再送して結果を確認できます。"
    : "");
  if (!$("abandonRoomDialog").open) $("abandonRoomDialog").showModal();
  requestAnimationFrame(() => $("abandonRoomTitle").focus({ preventScroll: true }));
}

function resolveAbandonStateConflict(status) {
  abandonBusy = false;
  abandonRetryRoomId = null;
  abandonRetryExpectedVersion = null;
  restoreAbandonDialogFocus = false;
  if ($("abandonRoomDialog").open) $("abandonRoomDialog").close();
  abandonDialogTrigger = null;
  render();
  if (status === "playing") {
    announceRoomLifecycle("対戦が開始したため、開始前の取りやめは行いませんでした。投了する場合は対戦画面の操作を使ってください。");
    if (document.visibilityState === "visible" && activeAppTab === "battle") requestAnimationFrame(() => $("matchTitle").focus({ preventScroll: true }));
  } else if (status === "finished") {
    announceRoomLifecycle("対戦はすでに終了しているため、開始前の取りやめは行いませんでした。結果を確認してください。");
  }
}

async function confirmRoomAbandon() {
  const snapshot = client.snapshot();
  const roomId = snapshot.roomId;
  const status = roomModel?.room?.id === roomId ? roomModel.room.status : null;
  if (abandonBusy || !roomId) return;
  if (!["waiting", "ready"].includes(status)) return resolveAbandonStateConflict(status);
  const expectedVersion = abandonExpectedVersion(roomId) ?? Number(roomModel.room.version);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || typeof client.abandonRoom !== "function") {
    return operationFeedback("abandonRoomStatus", "取りやめ処理を準備できませんでした。ページを再読み込みしてください。", "error");
  }
  abandonRetryRoomId = roomId;
  abandonRetryExpectedVersion = expectedVersion;
  abandonBusy = true;
  operationFeedback("abandonRoomStatus", "開始前の対戦をサーバーで取りやめています…");
  renderLoadoutSelectionState();
  render();
  try {
    const result = await client.abandonRoom({ expectedVersion });
    if (client.snapshot().roomId !== roomId) return;
    if (result?.room_status !== "abandoned") {
      await roomSync.refreshNow();
      if (!client.snapshot().roomId) return;
      if (!["waiting", "ready"].includes(roomModel?.room?.status)) return resolveAbandonStateConflict(roomModel?.room?.status);
      throw new Error("ABANDON_RESULT_NOT_CONFIRMED");
    }
    completeAbandonedRoom({ message: "開始前の対戦を取りやめました。戦績・報酬はありません。", focusLobby: true });
  } catch {
    await roomSync.refreshNow().catch(() => {});
    if (client.snapshot().roomId !== roomId) return;
    if (!["waiting", "ready"].includes(roomModel?.room?.status)) return resolveAbandonStateConflict(roomModel?.room?.status);
    const authoritativeVersion = Number(roomModel?.room?.version);
    if (persistedAbandonExpectedVersion(roomId) === null && Number.isSafeInteger(authoritativeVersion) && authoritativeVersion !== expectedVersion) {
      abandonBusy = false;
      abandonRetryRoomId = null;
      abandonRetryExpectedVersion = null;
      $("confirmAbandonRoom").textContent = "更新後の状態で無報酬のまま取りやめる";
      operationFeedback("abandonRoomStatus", "対戦準備が更新されたため、前の処理は再送しません。現在の状態を確認し、取りやめる場合はもう一度確定してください。", "error");
      revealOperationFeedback("abandonRoomStatus");
      return;
    }
    abandonBusy = false;
    $("confirmAbandonRoom").textContent = "同じ取りやめ処理を再確認";
    operationFeedback("abandonRoomStatus", "サーバーの応答を確認できませんでした。同じ取りやめ処理を再確認してください。", "retry");
    revealOperationFeedback("abandonRoomStatus");
  } finally {
    abandonBusy = false;
    if (client.snapshot().roomId === roomId) render();
  }
}

function closeDisplayedRoom() {
  if (!client.snapshot().roomId) return;
  if (roomModel?.room?.status !== "finished") {
    activateAppTab("home");
    render();
    $("startStandardCpuHome").focus({ preventScroll: true });
    return toast("対戦は継続しています。『進行中の対戦へ戻る』から再開できます。");
  }
  clearContactReveal();
  clearCpuRewardGachaResult();
  stopCpuTurnWatch();
  roomSync.stop();
  client.clearRoom();
  roomModel = null;
  setupFailure = null;
  pendingAction = null;
  matchedRoomHandoff = null;
  announcedMatchedRoomId = null;
  $("matchedRoomAnnouncement").textContent = "";
  clearTimeout(matchedRoomHandoffTimer);
  matchedRoomHandoffTimer = null;
  operationFeedback("setupStatus", "");
  operationFeedback("actionStatus", "");
  render();
  focusBattleLobby();
}
async function requestRematch() {
  if (rematchBusy || roomModel?.room?.status !== "finished") return;
  rematchBusy = true; render();
  try {
    const cpuRoom = roomModel.room.opponent_kind === "cpu";
    const result = cpuRoom
      ? await client.requestCpuRematch({ expectedVersion: roomModel.room.version })
      : await client.requestRematch({ expectedVersion: roomModel.room.version });
    toast(cpuRoom || result.ready_to_setup ? "再戦用の6枚セットを選んでください。" : "再戦を申請しました。相手を待っています。");
    await roomSync.refreshNow();
  } catch (error) {
    toast(error.message || "再戦を申請できませんでした。同じIDで再送できます。");
    await roomSync.refreshNow().catch(() => {});
  } finally { rematchBusy = false; render(); }
}

async function continueCpuRewardRematch() {
  if (!isCurrentCpuRewardGachaContinuation(lastGachaContinuation) || rematchBusy) return;
  const expectedRoomId = lastGachaContinuation.roomId;
  await requestRematch();
  if (client.snapshot().roomId !== expectedRoomId || roomModel?.room?.status !== "ready") return renderGacha();
  clearCpuRewardGachaResult();
  activateAppTab("battle");
  render();
  focusMatchedRoom();
}

function dismissTerminalResult() {
  dismissedTerminalEventKey = shownTerminalEventKey;
  show("terminalOverlay", false);
}

function goToGacha(ticketLevel = null) {
  const destinationLevel = pendingGacha?.ticketLevel ?? ticketLevel;
  if (destinationLevel !== null) {
    $("gachaLevel").value = String(destinationLevel);
  }
  if (!pendingGacha && ticketLevel !== null) {
    clearCpuRewardGachaResult({ clearDraws: true });
  }
  activateAppTab("quiz", { scrollTop: false });
  renderGacha();
  requestAnimationFrame(() => {
    $("gachaPanel").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    $("gachaTitle").focus({ preventScroll: true });
  });
}
$("profileSelect").onchange = () => { selectedProfileId = $("profileSelect").value; synced = false; renderProfile(); render(); };
$("createStarterProfile").onclick = createStarterProfile;
$("syncProfile").onclick = syncSelectedProfile;
$("quizStart").onclick = startOnlineQuiz;
$("quizHint").onclick = openQuizHint;
$("quizGoGacha").onclick = () => goToGacha();
$("gachaLevel").onchange = () => { armedCpuRewardGachaOrigin = null; clearCpuRewardGachaResult({ clearDraws: true }); renderGacha(); };
$("gachaDrawOne").onclick = () => runGacha(1);
$("gachaDrawAll").onclick = () => runGacha(null);
$("gachaRetry").onclick = () => runGacha(1, true);
$("gachaCpuRematch").onclick = continueCpuRewardRematch;
$("returnToMatchedRoom").onclick = goToMatchedRoom;
$("cardSaleSkill").onchange = () => { cardSaleQuote = null; $("cardSaleStatus").textContent = "枚数を選び、売却内容を確認してください。"; renderCardSale(); };
$("cardSaleCount").oninput = () => { cardSaleQuote = null; $("cardSaleStatus").textContent = "売却内容をもう一度確認してください。"; renderCardSale(); };
$("cardSaleQuote").onclick = quoteOnlineCardSale;
$("cardSaleCommit").onclick = () => commitOnlineCardSale(false);
$("cardSaleRetry").onclick = () => commitOnlineCardSale(true);
$("cardSaleReset").onclick = clearCardSaleDraft;
$("editNextLoadout").onclick = openLoadoutWorkshop;
$("refreshCosmetics").onclick = () => refreshOnlineCosmetics();
$("cosmeticCommit").onclick = commitOnlineCosmetic;
$("cosmeticRetry").onclick = commitOnlineCosmetic;
$("cosmeticCancel").onclick = cancelOnlineCosmetic;
$("createRoom").onclick = createRoom;
$("joinRoom").onclick = joinRoom;
$("recruitOpponent").onclick = recruitPublicOpponent;
$("findOpponent").onclick = findPublicOpponent;
$("cancelMatchmaking").onclick = cancelPublicMatchmaking;
$("startStandardCpuHome").onclick = (event) => beginImmediateCpuEntry(event.currentTarget);
$("startStandardCpuLobby").onclick = (event) => beginImmediateCpuEntry(event.currentTarget);
$("chooseCpuOpponent").onclick = (event) => openCpuRoster("fallback", event.currentTarget);
$("keepWaitingForHuman").onclick = keepWaitingForHuman;
$("closeCpuRoster").onclick = () => $("cpuRosterDialog").close();
$("cpuRosterDialog").addEventListener("close", () => {
  if (cpuRosterOrigin === "direct") setCpuEntryIntent(false);
  const trigger = cpuRosterTrigger;
  cpuRosterTrigger = null;
  trigger?.focus?.();
});
$("roomCode").oninput = () => { $("roomCode").value = $("roomCode").value.replace(/\s/g, "").toUpperCase().slice(0, 6); };
$("debugUnlimitedMode").onchange = renderLoadout;
$("submitSetup").onclick = submitCurrentLoadoutContext;
$("cancelCpuDraft").onclick = cancelCpuDraft;
$("board").addEventListener("pointerdown", boardPointer);
$("clearSelection").onclick = () => { selectedMacros.clear(); render(); };
$("submitRegion").onclick = () => sendAction("CREATE_REGION", { sourceMacros: [...selectedMacros].sort((a, b) => a - b) });
$("surrender").onclick = () => sendAction("SURRENDER");
$("retryAction").onclick = () => pendingAction && sendAction(pendingAction.type, pendingAction.payload, true);
$("requestRematch").onclick = requestRematch;
$("chooseDifferentCpu").onclick = (event) => beginImmediateCpuEntry(event.currentTarget, { replaceFinished: true });
$("closeSkillInfo").onclick = () => $("skillInfoDialog").close();
$("terminalGoGacha").onclick = () => {
  const origin = terminalCpuRewardGachaCandidate ? { ...terminalCpuRewardGachaCandidate } : null;
  dismissTerminalResult();
  goToGacha(1);
  armedCpuRewardGachaOrigin = origin;
};
$("terminalClose").onclick = () => {
  dismissTerminalResult();
  $("requestRematch").focus({ preventScroll: false });
};
$("leaveRoom").onclick = closeDisplayedRoom;
$("abandonRoom").onclick = (event) => openRoomAbandonDialog(event.currentTarget);
$("confirmAbandonRoom").onclick = confirmRoomAbandon;
$("abandonRoomDialog").addEventListener("close", () => {
  const trigger = abandonDialogTrigger;
  abandonDialogTrigger = null;
  if (restoreAbandonDialogFocus && trigger?.isConnected && !trigger.classList.contains("hidden") && !trigger.disabled) trigger.focus({ preventScroll: true });
  restoreAbandonDialogFocus = true;
});
document.addEventListener("visibilitychange", () => {
  roomSync.handleVisibilityChange();
  if (document.visibilityState === "hidden") { stopMatchmakingWatch(); stopCpuTurnWatch(); }
  else {
    scheduleMatchmakingStatus(250);
    scheduleCpuTurn(250);
    if (pendingLifecycleLobbyFocus) focusBattleLobby();
  }
});
window.addEventListener("focus", () => { roomSync.invalidate(); scheduleCpuTurn(250); });
window.addEventListener("online", () => { roomSync.handleConnectivityChange(); reflectBrowserConnectivity(); scheduleMatchmakingStatus(250); scheduleCpuTurn(250); });
window.addEventListener("offline", () => { roomSync.handleConnectivityChange(); reflectBrowserConnectivity(); stopMatchmakingWatch(); stopCpuTurnWatch(); });

for (const button of document.querySelectorAll("[data-app-tab]")) button.onclick = () => activateAppTab(button.dataset.appTab);
for (const button of document.querySelectorAll("[data-tab-jump]")) button.onclick = () => activateAppTab(button.dataset.tabJump);
window.addEventListener("hashchange", () => activateAppTab(location.hash.slice(1), { updateHash: false }));

loadProfiles();
activateAppTab(activeAppTab);
render();
try {
  const session = await client.ensureSession();
  connected = true;
  $("connectionMessage").textContent = `端末ユーザー ${session.user.id.slice(0, 8)}…`;
  badge("匿名ログイン済み", "good");
  reflectBrowserConnectivity();
  const remote = await client.readProfile();
  if (remote) { hydrateProfileRow(remote); synced = true; }
  else loadProfiles();
  if (client.snapshot().roomId) {
    synced = true;
    await roomSync.start(client.snapshot().roomId);
    const activePublicRoom = roomModel?.room?.access_mode === "public_queue" && roomModel.room.status !== "finished";
    resolveQuizRoomClassification({ activePublicRoom });
    if (activePublicRoom) {
      queueMatchedRoomHandoff("成立済みの野良対戦があります。");
      if (pendingQuiz && !pendingQuiz.pendingAnswer) markQuizBoundaryForMatchedRoom();
    }
    if (pendingCpuStartSaga) {
      if (client.snapshot().setupRevision > 0 && ["ready", "playing"].includes(roomModel?.room?.status)) {
        persistCpuStartSaga(null);
        cpuEntryDraft = null;
      } else await runPendingCpuStartSaga();
    }
  }
  else if (pendingCpuStartSaga) await runPendingCpuStartSaga();
  else if (client.snapshot().cpuStartActionId && client.snapshot().cpuStartCharacterId) await resumePendingCpuStart();
  else if (client.snapshot().matchmakingFindActionId) await findPublicOpponent({ resumePending: true });
  else if (client.snapshot().matchmakingTicketId) scheduleMatchmakingStatus(250);
  else if (synced && hasCpuEntryIntent()) await openCpuRoster("direct", $("startStandardCpuHome"));
  render();
  if (synced && !cosmeticCatalogLoaded) await refreshOnlineCosmetics({ quiet: true });
  if (pendingQuiz?.pendingAnswer && pendingQuiz?.answerMode === "per-question-v1") submitPendingQuizAnswer();
  else if (pendingQuiz?.answers?.length === 10) finishOnlineQuiz();
} catch (error) {
  badge("接続失敗", "bad"); reflectBrowserConnectivity(); $("connectionMessage").textContent = "Supabaseへ接続できません。匿名ログイン設定を確認してください。"; console.error(error);
}
