"use strict";

const { clearPrivateDom } = require("../standard/local-two-player-controller.js");
const { createRngDomains } = require("../standard/standard-engine.js");
const { createQuizQuestions } = require("../standard/quiz-session.js");
const { createStandardQuizController } = require("../standard/standard-quiz-controller.js");
const { createStandardLocalSession } = require("../standard/standard-local-session.js");
const { RULE_SET_IDS } = require("../standard/standard-match-start.js");
const { STANDARD_SKILLS, V49_SKILL_IDS } = require("../standard/standard-skill-registry.js");
const { ALL_COSMETIC_CLASSES, COSMETIC_CATALOG, COSMETIC_TYPE_LABELS } = require("../standard/standard-cosmetics.js");
const { buildTerminalPresentation } = require("./terminal-presentation.js");
const { createStaticTerminalResultRenderer } = require("./static-terminal-result.js");
const { createTerminalRevealController } = require("./terminal-reveal.js");

const COLOR_NAMES = Object.freeze({ red: "赤", blue: "青", yellow: "黄", green: "緑" });
const PRESENTATION_KEY = "fourColorMapGame.standard.v5.presentation";
const LOADOUT_CATEGORIES = Object.freeze(["color", "area", "disrupt"]);
const LOADOUT_CATEGORY_NAMES = Object.freeze({ color: "色操作", area: "エリア操作", disrupt: "相手妨害" });
const TROPHY_PRESENTATION = Object.freeze({
  fullPaint: Object.freeze({ name: "完塗り", icon: "🏆", description: "トロフィー対象面積を100％実彩色して勝利", reward: "地図職人の盤面" }),
  fullPaint3: Object.freeze({ name: "地図職人", icon: "🗺️", description: "完塗りを累計3回達成", reward: "完成地図の輝き" }),
  noSkillFullPaint: Object.freeze({ name: "四色の匠", icon: "✨", description: "スキルを使わず完塗りして勝利", reward: "称号・四色の匠" }),
});

function boot() {
  const byId = (id) => document.getElementById(id);
  const board = byId("board");
  const privatePanel = byId("privatePanel");
  const status = byId("status");
  const notice = byId("notice");
  const handover = byId("handover");
  const handoverSeat = byId("handoverSeat");
  const ruleSet = byId("ruleSet");
  const profileA = byId("profileA");
  const profileB = byId("profileB");
  const firstPlayer = byId("firstPlayer");
  const startMatch = byId("startMatch");
  const setupDetails = byId("setupDetails");
  const loadoutBuilder = byId("loadoutBuilder");
  const loadoutA = byId("loadoutA");
  const loadoutB = byId("loadoutB");
  const loadoutAStatus = byId("loadoutAStatus");
  const loadoutBStatus = byId("loadoutBStatus");
  const quizSetup = byId("quizSetup");
  const quizProfile = byId("quizProfile");
  const quizLevel = byId("quizLevel");
  const startQuiz = byId("startQuiz");
  const quizStatus = byId("quizStatus");
  const quizPlay = byId("quizPlay");
  const quizCounter = byId("quizCounter");
  const quizScore = byId("quizScore");
  const quizTimeBar = byId("quizTimeBar");
  const quizQuestion = byId("quizQuestion");
  const quizOptions = byId("quizOptions");
  const quizHint = byId("quizHint");
  const quizNext = byId("quizNext");
  const quizHintText = byId("quizHintText");
  const quizResult = byId("quizResult");
  const quizSaveReward = byId("quizSaveReward");
  const gachaProfile = byId("gachaProfile");
  const gachaLevel = byId("gachaLevel");
  const gachaDrawOne = byId("gachaDrawOne");
  const gachaDrawAll = byId("gachaDrawAll");
  const gachaTickets = byId("gachaTickets");
  const gachaStatus = byId("gachaStatus");
  const gachaRetry = byId("gachaRetry");
  const gachaResults = byId("gachaResults");
  const cardSaleProfile = byId("cardSaleProfile");
  const cardSaleSkill = byId("cardSaleSkill");
  const cardSaleQuantity = byId("cardSaleQuantity");
  const cardSaleQuote = byId("cardSaleQuote");
  const cardSaleCoins = byId("cardSaleCoins");
  const cardSaleStatus = byId("cardSaleStatus");
  const cardSaleConfirmation = byId("cardSaleConfirmation");
  const cardSaleConfirmationText = byId("cardSaleConfirmationText");
  const cardSaleCommit = byId("cardSaleCommit");
  const cardSaleCancel = byId("cardSaleCancel");
  const cardSaleRetry = byId("cardSaleRetry");
  const cosmeticProfile = byId("cosmeticProfile");
  const cosmeticCoins = byId("cosmeticCoins");
  const collectionIdentity = byId("collectionIdentity");
  const cosmeticStatus = byId("cosmeticStatus");
  const cosmeticCatalog = byId("cosmeticCatalog");
  const cosmeticConfirmation = byId("cosmeticConfirmation");
  const cosmeticConfirmationText = byId("cosmeticConfirmationText");
  const cosmeticCommit = byId("cosmeticCommit");
  const cosmeticCancel = byId("cosmeticCancel");
  const cosmeticRetry = byId("cosmeticRetry");
  const trophyCatalog = byId("trophyCatalog");
  const resultPanel = byId("resultPanel");
  const commitRegion = byId("commitRegion");
  const surrender = byId("surrender");
  const sizeRevealEnabled = byId("sizeRevealEnabled");
  const paletteRevealEnabled = byId("paletteRevealEnabled");
  const eventReveal = byId("eventReveal");
  const eventRevealCard = byId("eventRevealCard");
  const eventRevealKicker = byId("eventRevealKicker");
  const eventRevealVisual = byId("eventRevealVisual");
  const eventRevealTitle = byId("eventRevealTitle");
  const eventRevealDetail = byId("eventRevealDetail");
  let contactReveal = null;
  let contactRevealTimer = null;
  // UI-only effect generation. It is independent from action/control generations and is never persisted.
  let contactPresentationGeneration = 0;
  const selected = new Set();
  const initialPaletteShown = new Set();
  let presentationState = {};
  let revealedSeat = null;
  let targetMode = null;
  let pendingStart = null;
  let quizController = null;
  let quizActorId = null;
  let quizActorName = null;
  let activeQuizHint = null;
  let pendingQuizSettlement = null;
  let quizRewardSaved = false;
  let pendingGacha = null;
  let lastGachaResults = [];
  let pendingCardSale = null;
  let pendingCosmeticAction = null;
  const selectedLoadouts = Object.fromEntries(["A", "B"].map((seat) => [seat, Object.fromEntries(LOADOUT_CATEGORIES.map((category) => [category, new Set()]))]));
  let idCounter = 0;
  // UI-only render generation. It scopes every action-bearing control and is never persisted.
  let interactionGeneration = 0;
  const inFlightGestures = new Set();
  const recentGestureUntil = new Map();

  const makeId = (scope) => {
    if (globalThis.crypto?.randomUUID) return `${scope}-${globalThis.crypto.randomUUID()}`;
    idCounter += 1;
    return `${scope}-${Date.now().toString(36)}-${idCounter}`;
  };
  const session = createStandardLocalSession({ storageAdapter: localStorage, clock: { now: () => new Date().toISOString() }, idFactory: makeId });
  const terminalResultRenderer = createStaticTerminalResultRenderer({ document, container: resultPanel, retrySettlement: () => runGesture("settlement-retry", settleAndRender) });
  const terminalRevealController = createTerminalRevealController({ document, clearContactReveal });

  function quizNow() { return performance.now(); }

  function createQuestions() {
    const seedBuffer = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(seedBuffer);
    else seedBuffer[0] = Date.now() >>> 0;
    const rng = createRngDomains(seedBuffer[0], ["quiz-structure", "quiz-content", "quiz-choice-rank", "quiz-choice-order"]);
    return createQuizQuestions({
      structureRandom: () => rng["quiz-structure"].next(),
      contentRandom: () => rng["quiz-content"].next(),
      rankRandom: () => rng["quiz-choice-rank"].next(),
      placementRandom: () => rng["quiz-choice-order"].next(),
    });
  }

  function renderQuizProfiles(projection) {
    if (quizController?.projection(quizNow()).stage === "QUESTION") return;
    const previous = quizProfile.value;
    quizProfile.replaceChildren();
    for (const profile of projection.profiles) {
      const option = document.createElement("option");
      option.value = profile.profileId;
      option.textContent = profile.displayName;
      quizProfile.appendChild(option);
    }
    if ([...quizProfile.options].some((option) => option.value === previous)) quizProfile.value = previous;
  }

  function quizIsBlockedByMatch() {
    return session.getPublicProjection()?.status === "ACTIVE";
  }

  function renderQuiz(projection = quizController?.projection(quizNow()) || null) {
    const playing = projection?.stage === "QUESTION";
    const finished = projection?.stage === "RESULT";
    quizSetup.hidden = playing;
    quizPlay.hidden = !playing;
    quizResult.hidden = !finished;
    quizSaveReward.hidden = !finished || quizRewardSaved || !pendingQuizSettlement;
    quizProfile.disabled = playing;
    quizLevel.disabled = playing;
    startQuiz.disabled = playing || quizIsBlockedByMatch() || !quizProfile.value || (finished && !quizRewardSaved);
    startQuiz.textContent = finished ? "もう一度挑戦" : "10問チャレンジ開始";
    if (!projection) {
      quizStatus.textContent = quizIsBlockedByMatch() ? "対戦中は数字ラッシュを開始できません。" : "レベルを選んで開始してください。";
      return;
    }
    if (finished) {
      quizStatus.textContent = "チャレンジ終了";
      quizResult.textContent = `${quizActorName || "プレイヤー"}：${projection.correct}問正解・${projection.wrong}ミス。${quizRewardSaved ? "獲得" : "獲得予定"}：Lv.${projection.reward.ticketLevel} ガチャ券 ${projection.reward.draws}枚（${projection.reward.reason}）。${quizRewardSaved ? "報酬を保存しました。" : "報酬はまだ保存されていません。"}`;
      return;
    }
    quizCounter.textContent = `${projection.questionNumber} / ${projection.questionCount}`;
    quizScore.textContent = `正解 ${projection.correct} / ミス ${projection.wrong} / 連続 ${projection.streak}`;
    quizQuestion.textContent = projection.question.prompt;
    quizTimeBar.style.width = `${Math.max(0, Math.min(100, projection.remainingMs / projection.question.timeMs * 100))}%`;
    quizOptions.replaceChildren();
    for (const option of projection.question.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      button.disabled = projection.resolved || projection.hintActive;
      suppressRepeatedActivation(button);
      button.onclick = () => runGesture(`quiz-answer:${projection.questionNumber}`, () => {
        const result = quizController.answer(option.id, quizNow());
        renderQuiz(result.projection);
      });
      quizOptions.appendChild(button);
    }
    quizHint.disabled = projection.hintUsed || projection.resolved;
    quizNext.hidden = !projection.resolved;
    quizHintText.hidden = !projection.hintActive || !activeQuizHint;
    quizHintText.textContent = projection.hintActive ? activeQuizHint || "" : "";
    if (projection.resolution) quizStatus.textContent = projection.resolution.timedOut ? `時間切れ。正解は ${projection.resolution.answerLabel}` : projection.resolution.correct ? "正解！" : `不正解。正解は ${projection.resolution.answerLabel}`;
    else quizStatus.textContent = projection.hintActive ? "ヒント表示中：解答時間は停止しています。" : "答えを選んでください。";
  }

  function renderGachaProfiles(projection) {
    if (pendingGacha) return;
    const previous = gachaProfile.value;
    gachaProfile.replaceChildren();
    for (const profile of projection.profiles) {
      const option = document.createElement("option");
      option.value = profile.profileId;
      option.textContent = profile.displayName;
      gachaProfile.appendChild(option);
    }
    if ([...gachaProfile.options].some((option) => option.value === previous)) gachaProfile.value = previous;
  }

  function renderGacha() {
    const projection = session.getGachaProjection(gachaProfile.value);
    if (!projection.ok) {
      gachaTickets.textContent = "利用できるプロフィールがありません。";
      gachaDrawOne.disabled = true;
      gachaDrawAll.disabled = true;
      return;
    }
    for (const option of gachaLevel.options) option.textContent = `Lv.${option.value}（${projection.tickets[option.value]}枚）`;
    const available = projection.tickets[gachaLevel.value] || 0;
    gachaTickets.textContent = [1, 2, 3, 4, 5].map((level) => `Lv.${level} ×${projection.tickets[level]}`).join(" / ");
    gachaProfile.disabled = Boolean(pendingGacha);
    gachaLevel.disabled = Boolean(pendingGacha);
    gachaDrawOne.disabled = Boolean(pendingGacha) || available < 1;
    gachaDrawAll.disabled = Boolean(pendingGacha) || available < 1;
    gachaRetry.hidden = !pendingGacha;
    gachaResults.replaceChildren();
    for (const draw of lastGachaResults) {
      const card = document.createElement("article");
      card.className = `gacha-card r${draw.rarity}`;
      const stars = document.createElement("div");
      stars.className = "gacha-stars";
      stars.textContent = "★".repeat(draw.rarity);
      const heading = document.createElement("h3");
      heading.textContent = STANDARD_SKILLS[draw.skillId].displayName;
      const detail = document.createElement("p");
      detail.textContent = `${LOADOUT_CATEGORY_NAMES[draw.category]} / Lv.${draw.ticketLevel}券`;
      card.append(stars, heading, detail);
      gachaResults.appendChild(card);
    }
  }

  function runGachaDraw(count = null) {
    if (!pendingGacha) {
      const projection = session.getGachaProjection(gachaProfile.value);
      const available = projection.ok ? projection.tickets[gachaLevel.value] || 0 : 0;
      const requested = count === null ? available : count;
      if (requested < 1) { gachaStatus.textContent = "このレベルのガチャ券がありません。"; return; }
      pendingGacha = { operationId: makeId("gacha"), profileId: gachaProfile.value, ticketLevel: Number(gachaLevel.value), count: requested };
    }
    const result = session.drawGacha(pendingGacha);
    if (!result.ok) {
      gachaStatus.textContent = `抽選を保存できません（${result.code}）。同じ抽選IDで再試行できます。`;
      renderGacha();
      return;
    }
    lastGachaResults = [...result.draws];
    pendingGacha = null;
    gachaStatus.textContent = `${result.draws.length}枚を獲得し、券と在庫を一度だけ保存しました。`;
    renderGachaProfiles(result.setup);
    renderCardSaleProfiles(result.setup);
    renderCosmeticProfiles(result.setup);
    renderLoadoutBuilder(result.setup);
    renderGacha();
    renderCardSale();
    renderCosmetics();
  }

  function renderCardSaleProfiles(projection) {
    if (pendingCardSale) return;
    const previous = cardSaleProfile.value;
    cardSaleProfile.replaceChildren();
    for (const profile of projection.profiles) {
      const option = document.createElement("option");
      option.value = profile.profileId;
      option.textContent = profile.displayName;
      cardSaleProfile.appendChild(option);
    }
    if ([...cardSaleProfile.options].some((option) => option.value === previous)) cardSaleProfile.value = previous;
  }

  function renderCardSale() {
    const projection = session.getCardSaleProjection(cardSaleProfile.value);
    if (!projection.ok) {
      cardSaleCoins.textContent = "利用できるプロフィールがありません。";
      cardSaleQuote.disabled = true;
      return;
    }
    const previousSkill = pendingCardSale?.skillId || cardSaleSkill.value;
    cardSaleSkill.replaceChildren();
    for (const item of projection.items) {
      const option = document.createElement("option");
      option.value = item.skillId;
      option.disabled = item.sellableCount < 1;
      option.textContent = `${STANDARD_SKILLS[item.skillId].displayName} ★${item.rarity}（所持${item.ownedCount}・売却可${item.sellableCount}${item.protected ? "・保護中" : ""}）`;
      cardSaleSkill.appendChild(option);
    }
    if ([...cardSaleSkill.options].some((option) => option.value === previousSkill && !option.disabled)) cardSaleSkill.value = previousSkill;
    else {
      const firstSellable = [...cardSaleSkill.options].find((option) => !option.disabled);
      if (firstSellable) cardSaleSkill.value = firstSellable.value;
    }
    const item = projection.items.find((entry) => entry.skillId === cardSaleSkill.value);
    const max = item?.sellableCount || 0;
    cardSaleQuantity.max = String(Math.max(1, max));
    if (!pendingCardSale && (!Number.isSafeInteger(Number(cardSaleQuantity.value)) || Number(cardSaleQuantity.value) < 1 || Number(cardSaleQuantity.value) > max)) cardSaleQuantity.value = max > 0 ? "1" : "0";
    cardSaleCoins.textContent = `${projection.displayName}のコイン：${projection.coins}`;
    const locked = Boolean(pendingCardSale);
    cardSaleProfile.disabled = locked;
    cardSaleSkill.disabled = locked || max < 1;
    cardSaleQuantity.disabled = locked || max < 1;
    cardSaleQuote.disabled = locked || max < 1;
    cardSaleConfirmation.hidden = !locked || pendingCardSale.failed;
    cardSaleRetry.hidden = !locked || !pendingCardSale.failed;
  }

  function prepareCardSale() {
    const quantity = Number(cardSaleQuantity.value);
    const quoted = session.quoteCardSale({ profileId: cardSaleProfile.value, skillId: cardSaleSkill.value, quantity });
    if (!quoted.ok) { cardSaleStatus.textContent = `売却できません（${quoted.code}）。`; return; }
    pendingCardSale = {
      operationId: makeId("sale"),
      profileId: cardSaleProfile.value,
      skillId: cardSaleSkill.value,
      quantity,
      acceptedConfirmationReasons: [...quoted.quote.confirmationReasons],
      quote: quoted.quote,
      failed: false,
    };
    const warnings = quoted.quote.confirmationReasons.map((reason) => reason === "HIGH_RARITY" ? "高レアカードを含みます" : "売却可能な最後の余剰分です");
    cardSaleConfirmationText.textContent = `${STANDARD_SKILLS[pendingCardSale.skillId].displayName}を${quantity}枚売却し、${quoted.quote.earnedCoins}コインを獲得します。売却後は${quoted.quote.remaining}枚です。${warnings.length ? `注意：${warnings.join("、")}。` : ""}`;
    cardSaleStatus.textContent = "内容を確認して売却を確定してください。";
    renderCardSale();
  }

  function commitPreparedCardSale() {
    if (!pendingCardSale) return;
    const result = session.commitCardSale(pendingCardSale);
    if (!result.ok) {
      pendingCardSale.failed = true;
      cardSaleStatus.textContent = `売却を保存できません（${result.code}）。同じ売却IDで再試行できます。`;
      renderCardSale();
      return;
    }
    const sold = pendingCardSale;
    pendingCardSale = null;
    cardSaleStatus.textContent = `${STANDARD_SKILLS[sold.skillId].displayName}を${sold.quantity}枚売却し、${result.receipt.totalCoins}コインを一度だけ保存しました。`;
    renderQuizProfiles(result.setup);
    renderGachaProfiles(result.setup);
    renderCardSaleProfiles(result.setup);
    renderCosmeticProfiles(result.setup);
    renderLoadoutBuilder(result.setup);
    renderGacha();
    renderCardSale();
    renderCosmetics();
  }

  function cancelCardSale() {
    pendingCardSale = null;
    cardSaleStatus.textContent = "売却をキャンセルしました。";
    renderCardSale();
  }

  function renderCosmeticProfiles(projection) {
    if (pendingCosmeticAction) return;
    const previous = cosmeticProfile.value;
    cosmeticProfile.replaceChildren();
    for (const profile of projection.profiles) {
      const option = document.createElement("option");
      option.value = profile.profileId;
      option.textContent = profile.displayName;
      cosmeticProfile.appendChild(option);
    }
    if ([...cosmeticProfile.options].some((option) => option.value === previous)) cosmeticProfile.value = previous;
  }

  function applyCosmeticClasses(projection) {
    document.body.classList.remove(...ALL_COSMETIC_CLASSES);
    for (const cosmeticId of Object.values(projection.equipped)) {
      const cssClass = COSMETIC_CATALOG[cosmeticId]?.cssClass;
      if (cssClass) document.body.classList.add(cssClass);
    }
  }

  function renderCosmetics() {
    const projection = session.getCosmeticProjection(cosmeticProfile.value);
    if (!projection.ok) {
      cosmeticCoins.textContent = "利用できるプロフィールがありません。";
      cosmeticCatalog.replaceChildren();
      trophyCatalog.replaceChildren();
      return;
    }
    applyCosmeticClasses(projection);
    const title = COSMETIC_CATALOG[projection.equipped.title]?.name;
    collectionIdentity.textContent = title && projection.equipped.title !== "titleNone" ? `${projection.displayName}｜${title}` : projection.displayName;
    cosmeticCoins.textContent = `コイン：${projection.coins}`;
    const locked = Boolean(pendingCosmeticAction);
    cosmeticProfile.disabled = locked;
    cosmeticCatalog.replaceChildren();
    for (const item of projection.items) {
      const card = document.createElement("article");
      card.className = `collection-card${item.equipped ? " equipped" : ""}${!item.trophyUnlocked ? " locked" : ""}`;
      const type = document.createElement("strong");
      type.textContent = COSMETIC_TYPE_LABELS[item.type];
      const preview = document.createElement("div");
      preview.className = `collection-preview${item.previewClass ? ` ${item.previewClass}` : ""}`;
      preview.textContent = item.preview;
      const name = document.createElement("h3");
      name.textContent = item.name;
      const detail = document.createElement("p");
      detail.textContent = item.trophyId ? `トロフィー「${TROPHY_PRESENTATION[item.trophyId].name}」で解放` : item.price > 0 ? `${item.price}コイン・対戦能力への効果なし` : "無料・対戦能力への効果なし";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.equipped ? "装備中" : !item.trophyUnlocked ? "未解放" : item.owned ? "装備する" : "購入して装備";
      button.disabled = locked || item.equipped || !item.trophyUnlocked;
      suppressRepeatedActivation(button);
      button.onclick = () => runGesture("cosmetic-quote", () => prepareCosmeticAction(item.cosmeticId));
      card.append(type, preview, name, detail, button);
      cosmeticCatalog.appendChild(card);
    }
    cosmeticConfirmation.hidden = !locked || pendingCosmeticAction.failed;
    cosmeticRetry.hidden = !locked || !pendingCosmeticAction.failed;
    trophyCatalog.replaceChildren();
    for (const [trophyId, presentation] of Object.entries(TROPHY_PRESENTATION)) {
      const unlocked = projection.trophies[trophyId] === true;
      const card = document.createElement("article");
      card.className = `collection-card${unlocked ? "" : " locked"}`;
      const heading = document.createElement("h3");
      heading.textContent = `${presentation.icon} ${presentation.name}`;
      const description = document.createElement("p");
      description.textContent = presentation.description;
      const state = document.createElement("p");
      state.textContent = unlocked ? `解除済み${projection.trophyDates[trophyId] ? `：${projection.trophyDates[trophyId]}` : ""}｜報酬：${presentation.reward}` : `未解除｜報酬：${presentation.reward}`;
      card.append(heading, description, state);
      trophyCatalog.appendChild(card);
    }
  }

  function prepareCosmeticAction(cosmeticId) {
    const quoted = session.quoteCosmeticAction({ profileId: cosmeticProfile.value, cosmeticId });
    if (!quoted.ok) { cosmeticStatus.textContent = `購入・装備できません（${quoted.code}）。`; return; }
    pendingCosmeticAction = { operationId: makeId("cosmetic"), profileId: cosmeticProfile.value, cosmeticId, quote: quoted.quote, failed: false };
    cosmeticConfirmationText.textContent = quoted.quote.purchaseRequired
      ? `${quoted.quote.name}を${quoted.quote.price}コインで購入して装備します。残高は${quoted.quote.coinsAfter}コインになります。`
      : `${quoted.quote.name}を装備します。コインは消費しません。`;
    cosmeticStatus.textContent = "内容を確認して確定してください。";
    renderCosmetics();
  }

  function commitPreparedCosmeticAction() {
    if (!pendingCosmeticAction) return;
    const result = session.commitCosmeticAction(pendingCosmeticAction);
    if (!result.ok) {
      pendingCosmeticAction.failed = true;
      cosmeticStatus.textContent = `購入・装備を保存できません（${result.code}）。同じ処理IDで再試行できます。`;
      renderCosmetics();
      return;
    }
    const completed = pendingCosmeticAction;
    pendingCosmeticAction = null;
    cosmeticStatus.textContent = `${COSMETIC_CATALOG[completed.cosmeticId].name}を一度だけ保存して装備しました。`;
    renderQuizProfiles(result.setup);
    renderGachaProfiles(result.setup);
    renderCardSaleProfiles(result.setup);
    renderCosmeticProfiles(result.setup);
    renderLoadoutBuilder(result.setup);
    renderCardSale();
    renderCosmetics();
  }

  function cancelCosmeticAction() {
    pendingCosmeticAction = null;
    cosmeticStatus.textContent = "購入・装備をキャンセルしました。";
    renderCosmetics();
  }

  function say(text) { notice.textContent = text; }

  function runGesture(group, action) {
    const now = Date.now();
    if (inFlightGestures.has(group) || now < (recentGestureUntil.get(group) || 0)) return;
    inFlightGestures.add(group);
    recentGestureUntil.set(group, now + 300);
    let result;
    try {
      result = action();
    } catch (error) {
      inFlightGestures.delete(group);
      throw error;
    }
    if (result && typeof result.finally === "function") return result.finally(() => inFlightGestures.delete(group));
    inFlightGestures.delete(group);
    return result;
  }

  function suppressRepeatedActivation(control) {
    control.onkeydown = (event) => {
      if (event.repeat && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
  }

  function actionGestureGroup(type, payload) {
    if (type === "USE_SKILL") return `skill:${payload.skill}:${interactionGeneration}`;
    return `action:${type}:${interactionGeneration}`;
  }

  function loadPresentationPreferences() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PRESENTATION_KEY) || "{}"); } catch { saved = {}; }
    presentationState = saved && typeof saved === "object" ? saved : {};
    sizeRevealEnabled.checked = saved.sizeReveal !== false;
    paletteRevealEnabled.checked = saved.paletteReveal !== false;
    for (const key of Array.isArray(saved.paletteShown) ? saved.paletteShown.slice(-32) : []) {
      if (typeof key === "string") initialPaletteShown.add(key);
    }
  }

  function savePresentationPreferences() {
    const paletteShown = [...initialPaletteShown].slice(-32);
    presentationState = { ...presentationState, sizeReveal: sizeRevealEnabled.checked, paletteReveal: paletteRevealEnabled.checked, paletteShown };
    try { localStorage.setItem(PRESENTATION_KEY, JSON.stringify(presentationState)); } catch { /* cosmetic preference only */ }
  }

  function showReveal({ kicker = "", icon = "", title, detail = "", tone = "" }) {
    eventRevealCard.className = `event-reveal-card ${tone}`.trim();
    eventRevealKicker.textContent = kicker;
    eventRevealVisual.replaceChildren();
    eventRevealVisual.textContent = icon;
    eventRevealTitle.textContent = title;
    eventRevealDetail.textContent = detail;
    eventReveal.hidden = false;
  }

  function clearPrivate() {
    interactionGeneration += 1;
    revealedSeat = null;
    targetMode = null;
    selected.clear();
    clearPrivateDom(privatePanel);
  }

  function regionAt(publicState, macro) {
    return Object.values(publicState.regions).find((region) => (region.sourceMacros || []).includes(macro));
  }

  function showContactReveal(contactColorCount) {
    const reveals = {
      2: { title: "二色接触！", detail: "相手の選択肢へ圧力", tone: "warn" },
      3: { title: "三色圧力!!", detail: "強いエリア工作", tone: "warn" },
      4: { title: "四色包囲!!!", detail: "全色が一点へ集中", tone: "epic" },
    };
    const reveal = reveals[contactColorCount];
    if (!reveal) return;
    const presentationGeneration = ++contactPresentationGeneration;
    if (contactRevealTimer) clearTimeout(contactRevealTimer);
    if (!contactReveal) {
      contactReveal = document.createElement("div");
      contactReveal.id = "contactReveal";
      contactReveal.className = "contact-reveal";
      contactReveal.setAttribute("role", "status");
      contactReveal.setAttribute("aria-live", "polite");
      contactReveal.setAttribute("aria-atomic", "true");
      document.body.appendChild(contactReveal);
    }
    const card = document.createElement("div");
    const title = document.createElement("p");
    const detail = document.createElement("p");
    card.className = `contact-reveal-card contact-pressure-${contactColorCount} ${reveal.tone === "epic" ? "epic" : ""}`.trim();
    title.textContent = reveal.title;
    detail.textContent = reveal.detail;
    card.append(title, detail);
    contactReveal.replaceChildren(card);
    const presentationNode = contactReveal;
    contactRevealTimer = setTimeout(() => {
      if (presentationGeneration !== contactPresentationGeneration || contactReveal !== presentationNode) return;
      contactReveal?.remove();
      contactReveal = null;
      contactRevealTimer = null;
    }, 900);
  }

  function clearContactReveal() {
    contactPresentationGeneration += 1;
    if (contactRevealTimer) clearTimeout(contactRevealTimer);
    contactRevealTimer = null;
    contactReveal?.remove();
    contactReveal = null;
  }

  function handleResolved(result, actorSeat, terminalSessionContext) {
    if (!result.ok) {
      say(result.code === "NO_LEGAL_RECOLOR" ? "変更先がありません。カードは消費されませんでした。" : `操作できません（${result.code}）。`);
      const privateResult = session.revealPrivate(actorSeat);
      if (privateResult.ok) renderPrivate(privateResult.privateState);
      return;
    }
    targetMode = null;
    selected.clear();
    if (result.finished) {
      clearPrivate();
      renderPublic(session.getPublicProjection());
      const terminalPresentation = renderResult(result.projection);
      const publicResult = result.projection?.publicResult;
      if (result.status === "RESOLVED" && result.saved && result.appliedNow && !result.replayedReceipt
        && result.projection?.publicState?.status === "FINISHED" && terminalPresentation?.ok === true
        && typeof publicResult?.matchId === "string" && Number.isSafeInteger(publicResult?.finalMatchVersion)) {
        terminalRevealController.showTerminalReveal({
          eventId: `${publicResult.matchId}:${publicResult.finalMatchVersion}`,
          matchId: publicResult.matchId,
          sessionGeneration: terminalSessionContext.sessionGeneration,
          headline: terminalPresentation.headline,
          resultText: terminalPresentation.resultText,
        });
      }
      settleAndRender();
      return;
    }
    if (result.activeChanged) {
      clearPrivate();
      renderStage(result.projection);
      if (result.status === "RESOLVED" && result.saved && result.appliedNow && !result.replayedReceipt && result.actionType === "CREATE_REGION") {
        showContactReveal(result.contactColorCount);
      }
      return;
    }
    renderPublic(session.getPublicProjection());
    const privateResult = session.revealPrivate(actorSeat);
    if (privateResult.ok) renderPrivate(privateResult.privateState);
  }

  function dispatch(type, payload = {}) {
    if (!revealedSeat) return;
    return runGesture(actionGestureGroup(type, payload), async () => {
      const actorSeat = revealedSeat;
      if (!actorSeat) return;
      const terminalSessionContext = terminalRevealController.getSessionContext();
      const activeControl = type === "CREATE_REGION" ? commitRegion : null;
      if (activeControl) {
        activeControl.disabled = true;
        activeControl.setAttribute("aria-busy", "true");
      }
      try {
        const result = await session.dispatchAction({ actorSeat, type, payload });
        say(result.ok ? "操作を保存しました。" : `操作できません（${result.code}）。`);
        handleResolved(result, actorSeat, terminalSessionContext);
        return result;
      } finally {
        if (activeControl?.isConnected) {
          activeControl.removeAttribute("aria-busy");
          const publicState = session.getPublicProjection();
          activeControl.disabled = !revealedSeat || !publicState || !["CREATE_FIRST", "WORK"].includes(publicState.phase);
        }
      }
    });
  }

  function renderPublic(publicState) {
    if (!publicState) {
      status.textContent = "対戦データがありません。";
      board.replaceChildren();
      return;
    }
    status.textContent = publicState.status === "FINISHED"
      ? "対戦終了。公開結果をご確認ください。"
      : `Turn ${publicState.turn}・Player ${publicState.active}・${publicState.phase}・指定 ${publicState.requiredSize}マス`;
    board.replaceChildren();
    const bounds = publicState.playableBounds;
    const preparedMacros = new Set(publicState.preparedOutgoing?.sourceMacros || []);
    for (let macro = 0; macro < 144; macro += 1) {
      const col = macro % 12;
      const row = Math.floor(macro / 12);
      const region = regionAt(publicState, macro);
      const cell = document.createElement("button");
      cell.type = "button";
      suppressRepeatedActivation(cell);
      cell.className = `cell${region?.color ? ` ${region.color}` : ""}${region?.isPending ? " pending" : ""}`;
      const inside = col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
      if (!inside) cell.classList.add("outside");
      const cornerTargets = targetMode?.kind === "areaCornerBloom" ? new Set(targetMode.sourceMacros) : null;
      if (!inside || publicState.status === "FINISHED" || (cornerTargets ? !cornerTargets.has(macro) : Boolean(publicState.preparedOutgoing))) cell.disabled = true;
      if (selected.has(macro) || preparedMacros.has(macro)) cell.classList.add("selected");
      cell.onclick = () => {
        if (!cell.isConnected) return;
        if (!revealedSeat) return;
        if (targetMode?.kind === "areaCornerBloom") {
          if (!targetMode.sourceMacros.includes(macro)) return;
          const sourceMacros = [...targetMode.sourceMacros];
          targetMode = null;
          dispatch("USE_SKILL", { skill: "areaCornerBloom", sourceMacros, macro });
          return;
        }
        if (publicState.preparedOutgoing) return;
        if (targetMode?.kind === "areaResize") return;
        if (targetMode?.kind === "colorRegionSplit") {
          if (publicState.phase !== "COLOR" || region?.id !== publicState.pending) return;
          session.cancelPendingActionRetry();
          selected.has(macro) ? selected.delete(macro) : selected.add(macro);
          renderPublic(session.getPublicProjection());
          const privateResult = session.revealPrivate(revealedSeat);
          if (privateResult.ok) renderPrivate(privateResult.privateState);
          return;
        }
        if (targetMode === "legalRecolor" && region?.color) {
          targetMode = null;
          dispatch("USE_SKILL", { skill: "legalRecolor", regionId: region.id });
          return;
        }
        if (!["CREATE_FIRST", "WORK"].includes(publicState.phase) || region || !inside) return;
        session.cancelPendingActionRetry();
        selected.has(macro) ? selected.delete(macro) : selected.add(macro);
        renderPublic(session.getPublicProjection());
        const privateResult = session.revealPrivate(revealedSeat);
        if (privateResult.ok) renderPrivate(privateResult.privateState);
      };
      board.appendChild(cell);
    }
    commitRegion.disabled = !revealedSeat || targetMode?.kind === "colorRegionSplit" || targetMode?.kind === "areaResize" || targetMode?.kind === "areaCornerBloom" || !["CREATE_FIRST", "WORK"].includes(publicState.phase);
    surrender.disabled = !revealedSeat || publicState.status === "FINISHED";
  }

  function appendButton(text, disabled, onClick, className = "skill") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.disabled = disabled;
    suppressRepeatedActivation(button);
    const controlGeneration = interactionGeneration;
    button.onclick = () => {
      if (controlGeneration !== interactionGeneration || !button.isConnected) return;
      onClick();
    };
    privatePanel.appendChild(button);
  }

  function renderPrivate(own) {
    interactionGeneration += 1;
    const controlGeneration = interactionGeneration;
    clearPrivateDom(privatePanel);
    const heading = document.createElement("h2");
    heading.className = "private-title";
    heading.textContent = `Player ${own.seat} の情報`;
    privatePanel.appendChild(heading);
    const palette = document.createElement("div");
    palette.className = "palette";
    const prism = Boolean(own.privateEffects?.prism);
    const temporaryColors = own.privateEffects?.temporaryColors || [];
    const ownedColors = prism ? Object.keys(COLOR_NAMES) : own.basicPalette.concat(own.bonusColor, temporaryColors);
    for (const color of [...new Set(ownedColors)]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `color ${color}`;
      const isBonus = color === own.bonusColor && !prism && !temporaryColors.includes(color) && !own.basicPalette.includes(color);
      button.textContent = isBonus ? `${COLOR_NAMES[color]}（残${own.bonusUsesRemaining}）` : COLOR_NAMES[color];
      const publicState = session.getPublicProjection();
      button.disabled = publicState.phase !== "COLOR" || (isBonus && own.bonusUsesRemaining <= 0) || (publicState.publicEffects?.[own.seat]?.seals?.[color] || 0) > 0 || targetMode !== null;
      suppressRepeatedActivation(button);
      button.onclick = () => {
        if (controlGeneration !== interactionGeneration || !button.isConnected) return;
        dispatch("COLOR_REGION", { color });
      };
      palette.appendChild(button);
    }
    privatePanel.appendChild(palette);
    const publicState = session.getPublicProjection();
    const phase = publicState.phase;
    const usedBoardColors = [...new Set(Object.values(publicState.regions).map((region) => region.color).filter((color) => Object.hasOwn(COLOR_NAMES, color)))];
    if (own.hand.colorRandomBorrow > 0) appendButton("色拾い・乱", targetMode !== null || phase !== "COLOR", () => dispatch("USE_SKILL", { skill: "colorRandomBorrow" }));
    if (own.hand.colorChoiceBorrow > 0) appendButton("色借り", targetMode !== null || phase !== "COLOR" || usedBoardColors.length === 0, () => {
      targetMode = "colorChoiceBorrow";
      say("盤面ですでに使用されている色から1色選んでください。");
      renderPrivate(own);
    });
    if (targetMode === "colorChoiceBorrow") {
      const label = document.createElement("p");
      label.textContent = "借りる色（盤面で使用済み）";
      privatePanel.appendChild(label);
      for (const color of usedBoardColors) appendButton(`借りる：${COLOR_NAMES[color]}`, false, () => {
        targetMode = null;
        dispatch("USE_SKILL", { skill: "colorChoiceBorrow", color });
      });
      appendButton("色借りをキャンセル", false, () => {
        targetMode = null;
        say("色借りの選択を解除しました。");
        renderPrivate(own);
      });
    }
    if (own.hand.colorPaletteChange > 0) appendButton("持ち色変更", targetMode !== null || phase !== "COLOR", () => {
      targetMode = { kind: "colorPaletteChange", slot: null };
      say("変更する持ち色枠を選んでください。おまけ色の残り回数は枠に残ります。");
      renderPrivate(own);
    });
    if (targetMode?.kind === "colorPaletteChange") {
      const slots = [...own.basicPalette, own.bonusColor];
      if (targetMode.slot === null) {
        const label = document.createElement("p");
        label.textContent = "変更する持ち色枠";
        privatePanel.appendChild(label);
        for (const [slot, color] of slots.entries()) appendButton(`変更枠${slot + 1}：${COLOR_NAMES[color]}${slot === 2 ? `（おまけ・残${own.bonusUsesRemaining}）` : ""}`, false, () => {
          targetMode = { kind: "colorPaletteChange", slot };
          say(`枠${slot + 1}の変更先を選んでください。重複色も選べます。`);
          renderPrivate(own);
        });
      } else {
        const currentColor = slots[targetMode.slot];
        const label = document.createElement("p");
        label.textContent = `枠${targetMode.slot + 1}の変更先（現在：${COLOR_NAMES[currentColor]}）`;
        privatePanel.appendChild(label);
        for (const color of Object.keys(COLOR_NAMES).filter((candidate) => candidate !== currentColor)) appendButton(`変更先：${COLOR_NAMES[color]}`, false, () => {
          const slot = targetMode.slot;
          targetMode = null;
          dispatch("USE_SKILL", { skill: "colorPaletteChange", slot, color });
        });
      }
      appendButton("持ち色変更をキャンセル", false, () => {
        targetMode = null;
        say("持ち色変更の選択を解除しました。");
        renderPrivate(own);
      });
    }
    if (own.hand.colorRegionSplit > 0) {
      const pendingRegion = publicState.regions[publicState.pending];
      appendButton("エリア二分", targetMode !== null || phase !== "COLOR" || !pendingRegion || (pendingRegion.sourceMacros || []).length < 2, () => {
        selected.clear();
        targetMode = { kind: "colorRegionSplit" };
        say("受取エリア上で、先に自分が彩色する側を選んでください。両側とも連結が必要です。");
        renderPublic(publicState);
        renderPrivate(own);
      });
    }
    if (targetMode?.kind === "colorRegionSplit") {
      const label = document.createElement("p");
      label.textContent = `先に彩色する側：${selected.size}マス選択中`;
      privatePanel.appendChild(label);
      appendButton("エリア二分を確定", selected.size === 0, () => {
        const regionId = publicState.pending;
        const sourceMacros = [...selected].sort((a, b) => a - b);
        dispatch("USE_SKILL", { skill: "colorRegionSplit", regionId, sourceMacros });
      });
      appendButton("エリア二分をキャンセル", false, () => {
        targetMode = null;
        selected.clear();
        session.cancelPendingActionRetry();
        say("エリア二分の選択を解除しました。");
        renderPublic(publicState);
        renderPrivate(own);
      });
    }
    appendButton("四色解放", targetMode !== null || phase !== "COLOR" || !(own.hand.colorPrism > 0), () => dispatch("USE_SKILL", { skill: "colorPrism" }));
    if (own.hand.areaMicroBloom > 0) {
      const sourceMacros = publicState.preparedOutgoing?.sourceMacros || [...selected].sort((a, b) => a - b);
      appendButton("ひとふくらみ", targetMode !== null || !["CREATE_FIRST", "WORK"].includes(phase) || sourceMacros.length !== publicState.requiredSize, () => {
        dispatch("USE_SKILL", { skill: "areaMicroBloom", sourceMacros });
      });
    }
    if (own.hand.areaCornerBloom > 0) {
      const sourceMacros = publicState.preparedOutgoing?.sourceMacros || [...selected].sort((a, b) => a - b);
      appendButton("角膨張", targetMode !== null || !["CREATE_FIRST", "WORK"].includes(phase) || sourceMacros.length !== publicState.requiredSize, () => {
        targetMode = { kind: "areaCornerBloom", sourceMacros: [...sourceMacros] };
        say("選択エリア内で、四隅を膨張させる1マスを選んでください。");
        renderPublic(publicState);
        renderPrivate(own);
      });
    }
    if (targetMode?.kind === "areaCornerBloom") appendButton("角膨張をキャンセル", false, () => {
      targetMode = null;
      session.cancelPendingActionRetry();
      say("角膨張の対象選択を解除しました。");
      renderPublic(publicState);
      renderPrivate(own);
    });
    if (own.hand.areaDiePlus > 0) {
      appendButton("エリア拡張", targetMode !== null || !["CREATE_FIRST", "WORK"].includes(phase) || Boolean(publicState.preparedOutgoing), () => {
        dispatch("USE_SKILL", { skill: "areaDiePlus" });
      });
    }
    if (own.hand.areaResize > 0 && targetMode?.kind !== "areaResize") {
      appendButton("拡大縮小", targetMode !== null || !["CREATE_FIRST", "WORK"].includes(phase) || Boolean(publicState.preparedOutgoing), () => {
        targetMode = { kind: "areaResize", mode: null };
        say("盤面を拡大するか縮小するか選んでください。");
        renderPrivate(own);
      });
    }
    if (targetMode?.kind === "areaResize") {
      if (!targetMode.mode) {
        appendButton("盤面を拡大", false, () => { targetMode = { kind: "areaResize", mode: "expand" }; renderPrivate(own); });
        appendButton("盤面を縮小", false, () => { targetMode = { kind: "areaResize", mode: "shrink" }; renderPrivate(own); });
      } else {
        const bounds = publicState.playableBounds;
        const boardWidth = bounds.maxCol - bounds.minCol + 1;
        const boardHeight = bounds.maxRow - bounds.minRow + 1;
        for (const [side, label] of [["top", "上"], ["bottom", "下"], ["left", "左"], ["right", "右"]]) {
          const vertical = side === "top" || side === "bottom";
          const unavailable = targetMode.mode === "expand"
            ? (side === "top" ? bounds.minRow === 0 : side === "bottom" ? bounds.maxRow === bounds.macroWidth - 1 : side === "left" ? bounds.minCol === 0 : bounds.maxCol === bounds.macroWidth - 1)
            : (vertical ? boardHeight <= 6 : boardWidth <= 6);
          appendButton(`${label}側を${targetMode.mode === "expand" ? "拡大" : "縮小"}`, unavailable, () => {
            dispatch("USE_SKILL", { skill: "areaResize", mode: targetMode.mode, side });
          });
        }
      }
      appendButton("拡大縮小をキャンセル", false, () => {
        targetMode = null;
        session.cancelPendingActionRetry();
        say("拡大縮小の選択を解除しました。");
        renderPrivate(own);
      });
    }
    appendButton("合法リカラー（実験貸与）", phase !== "WORK" || !(own.hand.legalRecolor > 0) || targetMode === "legalRecolor", () => {
      targetMode = "legalRecolor";
      say("彩色済みエリアを1つ選んでください。");
      renderPrivate(own);
    });
    if (targetMode === "legalRecolor") appendButton("対象選択をキャンセル", false, () => {
      targetMode = null;
      say("対象選択を解除しました。");
      renderPrivate(own);
    });
    if (own.hand.disruptChoiceOne > 0) {
      const label = document.createElement("p");
      label.textContent = "色封じ（全4色から選択）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(COLOR_NAMES[color], phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptChoiceOne", color }));
    }
    if (own.hand.disruptChoiceTwo > 0) {
      const label = document.createElement("p");
      label.textContent = "追封（全4色から選択・2彩色）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(`追封：${COLOR_NAMES[color]}`, phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptChoiceTwo", color }));
    }
    if (own.hand.disruptChoiceThree > 0) {
      const label = document.createElement("p");
      label.textContent = "長封（全4色から選択・3彩色）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(`長封：${COLOR_NAMES[color]}`, phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptChoiceThree", color }));
    }
    if (own.hand.disruptRandomOne > 0) appendButton("色封じ・乱", targetMode !== null || phase !== "WORK", () => {
      dispatch("USE_SKILL", { skill: "disruptRandomOne" });
    });
    if (own.hand.disruptRandomTwo > 0) appendButton("二重封じ・乱", targetMode !== null || phase !== "WORK", () => {
      dispatch("USE_SKILL", { skill: "disruptRandomTwo" });
    });
    if (own.hand.disruptPaletteRandom > 0) appendButton("持ち色汚染・乱", targetMode !== null || phase !== "WORK", () => {
      dispatch("USE_SKILL", { skill: "disruptPaletteRandom" });
    });
    if (own.hand.disruptPaletteChoice > 0) {
      const label = document.createElement("p");
      label.textContent = "持ち色汚染（注入色を選択・2彩色）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(`汚染：${COLOR_NAMES[color]}`, phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptPaletteChoice", color }));
    }
    if (own.hand.disruptForcedPalette > 0) {
      const label = document.createElement("p");
      label.textContent = "強制持ち替え（恒久注入色を選択）";
      privatePanel.appendChild(label);
      for (const color of Object.keys(COLOR_NAMES)) appendButton(`強制：${COLOR_NAMES[color]}`, phase !== "WORK", () => dispatch("USE_SKILL", { skill: "disruptForcedPalette", color }));
    }
    if ((own.privateEffects?.paletteDebuffs || []).length) {
      const notice = document.createElement("p");
      notice.textContent = `持ち色汚染中：残り${Math.max(...own.privateEffects.paletteDebuffs.map((effect) => effect.remaining))}彩色`;
      privatePanel.appendChild(notice);
    }
    if (own.hand.areaHalfShift > 0) {
      const controls = document.createElement("div");
      const axis = document.createElement("select");
      for (const value of ["COLUMN", "ROW"]) { const option = document.createElement("option"); option.value = value; option.textContent = value === "COLUMN" ? "縦帯" : "横帯"; axis.appendChild(option); }
      const index = document.createElement("input");
      index.type = "number"; index.min = "0"; index.max = "47"; index.value = "1"; index.setAttribute("aria-label", "基準位置");
      const direction = document.createElement("select");
      for (const value of ["plus", "minus"]) { const option = document.createElement("option"); option.value = value; option.textContent = value === "plus" ? "正方向" : "逆方向"; direction.appendChild(option); }
      const apply = document.createElement("button");
      apply.type = "button"; apply.textContent = "半マスシフトを確定"; apply.disabled = phase !== "WORK";
      suppressRepeatedActivation(apply);
      apply.onclick = () => {
        if (controlGeneration !== interactionGeneration || !apply.isConnected) return;
        dispatch("USE_SKILL", { skill: "areaHalfShift", axis: axis.value, index: Number(index.value), direction: direction.value });
      };
      controls.append(axis, index, direction, apply);
      privatePanel.appendChild(controls);
    }
    if (own.hand.areaTripleShift > 0) {
      const controls = document.createElement("div");
      const axis = document.createElement("select");
      for (const value of ["COLUMN", "ROW"]) { const option = document.createElement("option"); option.value = value; option.textContent = value === "COLUMN" ? "縦の三層" : "横の三層"; axis.appendChild(option); }
      const index = document.createElement("input");
      index.type = "number"; index.min = "1"; index.max = "10"; index.value = "2"; index.setAttribute("aria-label", "中央帯");
      const direction = document.createElement("select");
      for (const value of ["plus", "minus"]) { const option = document.createElement("option"); option.value = value; option.textContent = value === "plus" ? "正方向" : "逆方向"; direction.appendChild(option); }
      const apply = document.createElement("button");
      apply.type = "button"; apply.textContent = "三層断層を確定"; apply.disabled = phase !== "WORK" || Boolean(publicState.preparedOutgoing);
      suppressRepeatedActivation(apply);
      apply.onclick = () => {
        if (controlGeneration !== interactionGeneration || !apply.isConnected) return;
        dispatch("USE_SKILL", { skill: "areaTripleShift", axis: axis.value, index: Number(index.value), direction: direction.value });
      };
      controls.append(axis, index, direction, apply);
      privatePanel.appendChild(controls);
    }
  }

  function showHandover(projection) {
    terminalRevealController.clear();
    clearPrivate();
    renderPublic(projection.publicState);
    handoverSeat.textContent = `Player ${projection.seat}・${projection.publicState.phase}`;
    handover.hidden = false;
  }

  function renderResult(projection) {
    clearContactReveal();
    clearPrivate();
    handover.hidden = true;
    eventReveal.hidden = true;
    notice.textContent = "";
    commitRegion.disabled = true;
    surrender.disabled = true;
    const publicResult = projection.publicResult || {
      matchId: projection.matchId,
      winnerSeat: projection.winnerSeat,
      terminalReason: projection.terminalReason,
      mapCompleteWin: projection.mapCompleteWin,
    };
    const settlementSummary = projection.settlementSummary;
    const terminalPresentation = buildTerminalPresentation({
      publicResult,
      participantSnapshots: projection.participants,
      settlementStatus: settlementSummary?.status,
      settlementSummary,
    });
    terminalResultRenderer.renderStaticTerminalResult({ terminalPresentation, settlementSummary });
    return terminalPresentation;
  }

  async function settleAndRender() {
    terminalResultRenderer.setRetryBusy(true);
    const settled = await session.settle();
    renderResult(settled.projection);
  }

  function clearLoadoutSelection(seat = null) {
    for (const targetSeat of seat ? [seat] : ["A", "B"]) for (const category of LOADOUT_CATEGORIES) selectedLoadouts[targetSeat][category].clear();
  }

  function selectedStandardLoadouts() {
    return Object.fromEntries(["A", "B"].map((seat) => [seat, Object.fromEntries(LOADOUT_CATEGORIES.map((category) => [
      category,
      V49_SKILL_IDS.filter((skillId) => STANDARD_SKILLS[skillId].category === category && selectedLoadouts[seat][category].has(skillId)),
    ]))]));
  }

  function standardLoadoutComplete() {
    return ["A", "B"].every((seat) => LOADOUT_CATEGORIES.every((category) => selectedLoadouts[seat][category].size === 2));
  }

  function renderLoadoutSeat(seat, projection) {
    const select = seat === "A" ? profileA : profileB;
    const container = seat === "A" ? loadoutA : loadoutB;
    const statusNode = seat === "A" ? loadoutAStatus : loadoutBStatus;
    const profile = projection.profiles.find((entry) => entry.profileId === select.value) || null;
    container.replaceChildren();
    for (const category of LOADOUT_CATEGORIES) {
      const selected = selectedLoadouts[seat][category];
      for (const skillId of [...selected]) if (!profile?.cards[skillId] || profile.cards[skillId].available < 1 || STANDARD_SKILLS[skillId].category !== category) selected.delete(skillId);
      const fieldset = document.createElement("fieldset");
      fieldset.className = "loadout-category";
      const legend = document.createElement("legend");
      legend.textContent = `${LOADOUT_CATEGORY_NAMES[category]}（${selected.size}/2）`;
      fieldset.appendChild(legend);
      for (const skillId of V49_SKILL_IDS.filter((id) => STANDARD_SKILLS[id].category === category)) {
        const count = profile?.cards[skillId] || { owned: 0, available: 0 };
        const checked = selected.has(skillId);
        const label = document.createElement("label");
        label.className = `loadout-card${count.available < 1 ? " unavailable" : ""}`;
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = checked;
        input.disabled = count.available < 1 || (!checked && selected.size >= 2);
        input.dataset.seat = seat;
        input.dataset.category = category;
        input.dataset.skill = skillId;
        input.onchange = () => {
          if (input.checked) selected.add(skillId);
          else selected.delete(skillId);
          pendingStart = null;
          renderLoadoutBuilder(projection);
        };
        label.append(input, document.createTextNode(`${STANDARD_SKILLS[skillId].displayName}（${count.available}/${count.owned}）`));
        fieldset.appendChild(label);
      }
      container.appendChild(fieldset);
    }
    const total = LOADOUT_CATEGORIES.reduce((sum, category) => sum + selectedLoadouts[seat][category].size, 0);
    statusNode.textContent = total === 6 ? "6枚の持込を選択済み" : `各カテゴリ2枚ずつ選んでください（現在${total}/6枚）`;
  }

  function renderLoadoutBuilder(projection) {
    const standard = ruleSet.value === RULE_SET_IDS.STANDARD;
    loadoutBuilder.hidden = !standard;
    if (standard) {
      renderLoadoutSeat("A", projection);
      renderLoadoutSeat("B", projection);
    }
    const profilesReady = projection.profiles.length >= 2 && profileA.value !== profileB.value;
    startMatch.disabled = !profilesReady || (standard && !standardLoadoutComplete());
  }

  function renderSetup() {
    terminalRevealController.clear();
    const projection = session.getSetupProjection(ruleSet.value);
    handover.hidden = true;
    terminalResultRenderer.hide();
    clearPrivate();
    renderPublic(null);
    profileA.replaceChildren();
    profileB.replaceChildren();
    for (const profile of projection.profiles) {
      for (const select of [profileA, profileB]) {
        const option = document.createElement("option");
        option.value = profile.profileId;
        option.textContent = profile.displayName;
        select.appendChild(option);
      }
    }
    if (projection.profiles.length > 1) profileB.selectedIndex = 1;
    renderQuizProfiles(projection);
    renderGachaProfiles(projection);
    renderCardSaleProfiles(projection);
    renderCosmeticProfiles(projection);
    const standard = ruleSet.value === RULE_SET_IDS.STANDARD;
    const details = projection.profiles.map((profile) => standard
      ? `${profile.displayName}: 使用可能 ${Object.values(profile.cards).filter((count) => count.available > 0).length}/19枚`
      : `${profile.displayName}: ${Object.entries(profile.cards).map(([id, count]) => `${id} ${count.available}/${count.owned}`).join("・")}`).join(" / ");
    setupDetails.textContent = projection.code === "NO_LOCAL_SAVE" ? "標準モードのローカルプロフィールがありません。テストでは起動前fixtureを使用します。" : `${projection.ruleLabel} / ${details}${standard ? "" : " / legalRecolorは実験貸与"}`;
    startMatch.textContent = standard ? "熟考モード対戦を開始" : "標準α対戦を開始";
    renderLoadoutBuilder(projection);
    pendingStart = null;
  }

  function renderStage(projection) {
    const matchId = projection?.publicState?.matchId || projection?.publicResult?.matchId || projection?.matchId || null;
    terminalRevealController.activateSession(matchId);
    terminalResultRenderer.hide();
    if (projection.stage === "SETUP") renderSetup();
    else if (projection.stage === "HANDOVER") showHandover(projection);
    else if (projection.stage === "SETTLEMENT_PENDING") { renderPublic(projection.publicState); renderResult(projection); settleAndRender(); }
    else if (projection.stage === "RESULT") renderResult(projection);
    renderQuiz();
    renderGacha();
    renderCardSale();
    renderCosmetics();
  }

  suppressRepeatedActivation(startMatch);
  suppressRepeatedActivation(startQuiz);
  suppressRepeatedActivation(quizHint);
  suppressRepeatedActivation(quizNext);
  suppressRepeatedActivation(quizSaveReward);
  function settleQuizAndRender() {
    if (!quizController || !pendingQuizSettlement) return;
    const facts = quizController.settlementFacts();
    if (!facts.ok) return;
    const result = session.settleQuizReward({ ...pendingQuizSettlement, profileId: quizActorId, result: facts });
    quizRewardSaved = result.ok;
    let message;
    if (result.ok) {
      renderQuizProfiles(result.setup);
      renderGachaProfiles(result.setup);
      renderCardSaleProfiles(result.setup);
      renderGacha();
      renderCardSale();
      pendingQuizSettlement = null;
      message = result.code === "ALREADY_SETTLED" ? "報酬はすでに保存済みです。" : "報酬を保存しました。";
    } else message = `報酬を保存できません（${result.code}）。同じ処理IDで再試行できます。`;
    renderQuiz();
    quizStatus.textContent = message;
  }
  startQuiz.onclick = () => runGesture("quiz-start", () => {
    if (quizIsBlockedByMatch()) { quizStatus.textContent = "対戦中は数字ラッシュを開始できません。"; return; }
    quizActorId = quizProfile.value;
    quizActorName = quizProfile.selectedOptions[0]?.textContent || quizActorId;
    activeQuizHint = null;
    quizRewardSaved = false;
    pendingQuizSettlement = { quizSessionId: makeId("quiz"), operationId: makeId("quiz-settle") };
    quizController = createStandardQuizController({ questions: createQuestions(), selectedLevel: Number(quizLevel.value) });
    renderQuiz(quizController.begin(quizNow()).projection);
  });
  quizHint.onclick = () => runGesture(`quiz-hint:${quizController?.projection(quizNow()).questionNumber || 0}`, () => {
    if (!quizController) return;
    const result = quizController.openHint(quizNow());
    if (result.ok) activeQuizHint = result.text;
    renderQuiz(result.projection);
  });
  quizNext.onclick = () => runGesture(`quiz-next:${quizController?.projection(quizNow()).questionNumber || 0}`, () => {
    if (!quizController) return;
    activeQuizHint = null;
    const advanced = quizController.advance(quizNow());
    renderQuiz(advanced.projection);
    if (advanced.finished) settleQuizAndRender();
  });
  quizSaveReward.onclick = () => runGesture("quiz-settlement-retry", settleQuizAndRender);
  suppressRepeatedActivation(gachaDrawOne);
  suppressRepeatedActivation(gachaDrawAll);
  suppressRepeatedActivation(gachaRetry);
  gachaProfile.onchange = () => { lastGachaResults = []; renderGacha(); };
  gachaLevel.onchange = () => { lastGachaResults = []; renderGacha(); };
  gachaDrawOne.onclick = () => runGesture("gacha-draw", () => runGachaDraw(1));
  gachaDrawAll.onclick = () => runGesture("gacha-draw", () => runGachaDraw(null));
  gachaRetry.onclick = () => runGesture("gacha-retry", () => runGachaDraw());
  for (const control of [cardSaleQuote, cardSaleCommit, cardSaleCancel, cardSaleRetry]) suppressRepeatedActivation(control);
  cardSaleProfile.onchange = () => { pendingCardSale = null; cardSaleStatus.textContent = ""; renderCardSale(); };
  cardSaleSkill.onchange = () => { pendingCardSale = null; cardSaleQuantity.value = "1"; cardSaleStatus.textContent = ""; renderCardSale(); };
  cardSaleQuantity.oninput = () => { pendingCardSale = null; cardSaleStatus.textContent = ""; renderCardSale(); };
  cardSaleQuote.onclick = () => runGesture("sale-quote", prepareCardSale);
  cardSaleCommit.onclick = () => runGesture("sale-commit", commitPreparedCardSale);
  cardSaleCancel.onclick = () => runGesture("sale-cancel", cancelCardSale);
  cardSaleRetry.onclick = () => runGesture("sale-retry", commitPreparedCardSale);
  for (const control of [cosmeticCommit, cosmeticCancel, cosmeticRetry]) suppressRepeatedActivation(control);
  cosmeticProfile.onchange = () => { pendingCosmeticAction = null; cosmeticStatus.textContent = ""; renderCosmetics(); };
  cosmeticCommit.onclick = () => runGesture("cosmetic-commit", commitPreparedCosmeticAction);
  cosmeticCancel.onclick = () => runGesture("cosmetic-cancel", cancelCosmeticAction);
  cosmeticRetry.onclick = () => runGesture("cosmetic-retry", commitPreparedCosmeticAction);
  setInterval(() => {
    if (quizController?.projection(quizNow()).stage !== "QUESTION") return;
    const before = quizController.projection(quizNow());
    const after = quizController.tick(quizNow()).projection;
    if (before.resolved !== after.resolved || before.hintActive !== after.hintActive) renderQuiz(after);
    else quizTimeBar.style.width = `${Math.max(0, Math.min(100, after.remainingMs / after.question.timeMs * 100))}%`;
  }, 100);
  ruleSet.onchange = () => {
    pendingStart = null;
    clearLoadoutSelection();
    renderSetup();
  };
  profileA.onchange = () => {
    pendingStart = null;
    clearLoadoutSelection("A");
    renderLoadoutBuilder(session.getSetupProjection(ruleSet.value));
  };
  profileB.onchange = () => {
    pendingStart = null;
    clearLoadoutSelection("B");
    renderLoadoutBuilder(session.getSetupProjection(ruleSet.value));
  };
  startMatch.onclick = () => runGesture("match-start", () => {
    clearContactReveal();
    terminalRevealController.clear();
    if (profileA.value === profileB.value) { say("Player AとPlayer Bには別のプロフィールを選んでください。"); return; }
    const standard = ruleSet.value === RULE_SET_IDS.STANDARD;
    if (standard && !standardLoadoutComplete()) { say("各Playerで、色操作・エリア操作・相手妨害を2枚ずつ選んでください。"); return; }
    pendingStart ||= { matchId: makeId("match"), operationId: makeId("start") };
    const args = { profileAId: profileA.value, profileBId: profileB.value, firstSeat: firstPlayer.value, ruleSetId: ruleSet.value, ...pendingStart };
    if (standard) args.loadouts = selectedStandardLoadouts();
    const quote = standard && pendingStart.quoteIds
      ? { ok: true, quoteIds: pendingStart.quoteIds }
      : session.quoteStart(args);
    if (!quote.ok) { say(`開始できません（${quote.code}）。`); return; }
    if (standard) {
      pendingStart.quoteIds = quote.quoteIds;
      args.quoteIds = quote.quoteIds;
    }
    const result = session.startMatch(args);
    if (!result.ok) {
      if (["QUOTE_EXPIRED", "STALE_INVENTORY_REVISION", "UNKNOWN_QUOTE"].includes(result.code)) delete pendingStart.quoteIds;
      say(`開始を保存できません（${result.code}）。`);
      return;
    }
    pendingStart = null;
    renderStage(result.projection);
  });
  const revealTurn = byId("revealTurn");
  suppressRepeatedActivation(revealTurn);
  revealTurn.onclick = () => {
    if (handover.hidden) return;
    runGesture(`handover-reveal:${interactionGeneration}`, () => {
      const projection = session.getStageProjection();
      const result = session.revealPrivate(projection.seat);
      if (!result.ok) return;
      handover.hidden = true;
      revealedSeat = result.seat;
      renderPublic(session.getPublicProjection());
      renderPrivate(result.privateState);
      const paletteRevealKey = `${session.getPublicProjection().matchId}:${result.seat}`;
      if (paletteRevealEnabled.checked && !initialPaletteShown.has(paletteRevealKey)) {
        initialPaletteShown.add(paletteRevealKey);
        savePresentationPreferences();
        showReveal({ kicker: `PLAYER ${result.seat} / SECRET`, icon: "🎨", title: "最初の持ち色", detail: "基本2色＋使用回数ランダムのおまけ色", tone: "epic" });
      } else if (sizeRevealEnabled.checked && ["CREATE_FIRST", "WORK"].includes(session.getPublicProjection().phase)) {
        const current = session.getPublicProjection();
        showReveal({ kicker: "NEXT AREA", icon: "🎲", title: `${current.requiredSize}マス！`, detail: `サイコロの出目 ${current.rolledSize}`, tone: "warn" });
      }
    });
  };
  commitRegion.onclick = () => {
    const publicState = session.getPublicProjection();
    dispatch("CREATE_REGION", { sourceMacros: publicState.preparedOutgoing?.sourceMacros || [...selected] });
  };
  surrender.onclick = () => dispatch("SURRENDER");
  suppressRepeatedActivation(commitRegion);
  suppressRepeatedActivation(surrender);
  byId("eventRevealSkip").onclick = () => { eventReveal.hidden = true; };
  sizeRevealEnabled.onchange = savePresentationPreferences;
  paletteRevealEnabled.onchange = savePresentationPreferences;
  firstPlayer.onchange = () => { pendingStart = null; };
  loadPresentationPreferences();
  renderStage(session.getStageProjection());
}

module.exports = { boot };
