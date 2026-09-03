"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "standard-v5", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "standard-v5", "app.js"), "utf8");

test("formal Number Rush UI exposes level, profile, score, timer, hint, six-choice arena, and result regions", () => {
  for (const id of ["quizPanel", "quizProfile", "quizLevel", "startQuiz", "quizStatus", "quizPlay", "quizCounter", "quizScore", "quizTimeBar", "quizQuestion", "quizOptions", "quizHint", "quizNext", "quizHintText", "quizResult", "quizSaveReward"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /ヒント表示中は解答時間が完全に停止/);
});

test("formal gacha UI exposes profile, level, one/all draw, retry, ticket, status, and result regions", () => {
  for (const id of ["gachaPanel", "gachaProfile", "gachaLevel", "gachaDrawOne", "gachaDrawAll", "gachaTickets", "gachaStatus", "gachaRetry", "gachaResults"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /session\.drawGacha/);
  assert.match(app, /session\.getGachaProjection/);
});

test("formal card-sale UI exposes profile, card, quantity, quote, explicit confirmation, retry, and coin regions", () => {
  for (const id of ["cardSalePanel", "cardSaleProfile", "cardSaleSkill", "cardSaleQuantity", "cardSaleQuote", "cardSaleCoins", "cardSaleStatus", "cardSaleConfirmation", "cardSaleConfirmationText", "cardSaleCommit", "cardSaleCancel", "cardSaleRetry"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /session\.quoteCardSale/);
  assert.match(app, /session\.commitCardSale/);
  assert.match(app, /session\.getCardSaleProjection/);
});

test("formal cosmetic UI exposes profile, catalog, explicit confirmation, retry, identity, and trophies", () => {
  for (const id of ["cosmeticPanel", "cosmeticProfile", "cosmeticCoins", "collectionIdentity", "cosmeticStatus", "cosmeticCatalog", "cosmeticConfirmation", "cosmeticConfirmationText", "cosmeticCommit", "cosmeticCancel", "cosmeticRetry", "trophyCatalog"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /session\.quoteCosmeticAction/);
  assert.match(app, /session\.commitCosmeticAction/);
  assert.match(app, /session\.getCosmeticProjection/);
  assert.match(html, /対戦能力は増えません/);
});

test("quiz UI consumes the secret-safe controller projection and does not inspect correctness fields", () => {
  const renderQuiz = app.match(/function renderQuiz\([\s\S]*?\n  }\n\n  function renderGachaProfiles/)?.[0] || "";
  assert.match(app, /createStandardQuizController/);
  assert.match(renderQuiz, /projection\.question\.options/);
  assert.doesNotMatch(renderQuiz, /correctId|isCorrect|option\.value/);
  assert.match(renderQuiz, /textContent = option\.label/);
  assert.match(app, /quizController\.openHint/);
  assert.match(app, /quizController\.tick/);
});
