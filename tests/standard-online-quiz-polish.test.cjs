"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..", "standard-online-v5");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const edge = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "standard-game-action", "index.ts"), "utf8");

function loadProgressRuntime() {
  const start = app.indexOf("function quizConfirmedProgress(");
  const end = app.indexOf("function renderQuizOutlook(");
  assert.ok(start >= 0 && end > start, "quiz progress helpers must remain extractable");
  const context = vm.createContext({});
  new vm.Script(`${app.slice(start, end)}\nglobalThis.runtime = { quizConfirmedProgress, quizRewardEstimate, quizNextRewardTarget, quizProgressCopy };`).runInContext(context);
  return context.runtime;
}

function acknowledgedQuiz(pattern, selectedLevel = 4) {
  const answers = [...pattern].map((_, index) => `answer-${index}`);
  return {
    answerMode: "per-question-v1",
    selectedLevel,
    answers,
    answerResults: [...pattern].map((value, index) => ({ questionIndex: index, selectedOptionId: answers[index], isCorrect: value === "C" })),
  };
}

test("online quiz shows a persisted per-question timer and pauses it for one short hint", () => {
  for (const id of ["quizTimer", "quizTimerAnnouncement", "quizTimeBar", "quizHint", "quizHintText"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="quizTimer"[^>]+aria-live="off"/);
  assert.match(html, /id="quizTimerAnnouncement"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(app, /function settleQuizClock/);
  assert.match(app, /hintActiveUntil > now/);
  assert.match(app, /state\.hintUsed = true/);
  assert.match(app, /hintDurationMs \|\| 3500/);
  assert.match(app, /QUIZ_TIMEOUT_ANSWER/);
  assert.match(app, /remainingSeconds === 10 \? "残り10秒です"/);
  assert.match(app, /announcement\.dataset\.announceKey !== announceKey/);
});

test("hints mix one useful formula with decoys without identifying the useful one", () => {
  assert.match(edge, /function quizHintOptions\(correctHint: string\)/);
  assert.match(edge, /slice\(0, 2\)/);
  assert.match(edge, /shuffled\(\[correctHint, \.\.\.decoys\]\)/);
  assert.match(app, /使うものと使わないものが混ざっています/);
});

test("question choices use one whole-button physics arena with safe pause contracts", () => {
  assert.match(html, /id="quizOptions"[^>]+aria-describedby="quizMotionHelp"/);
  assert.match(html, /id="quizMotionHelp"/);
  assert.match(css, /\.quiz-options\.is-physics\{position:relative;display:block;height:310px/);
  assert.match(css, /button\[data-quiz-option\]\{position:absolute/);
  assert.match(css, /button\[data-quiz-option\][^}]+transform:translate3d\(0,0,0\)/);
  assert.match(css, /button\[data-quiz-option\]\.is-orb\{[^}]*border-radius:50%/);
  assert.match(css, /button\[data-quiz-option\]\.is-capsule\{border-radius:999px/);
  assert.doesNotMatch(css, /quiz-option-drift|quiz-option-float/);
  assert.match(css, /@media\(max-width:620px\)\{\.quiz-options\.is-physics\{height:290px/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.quiz-options\.is-physics button\[data-quiz-option\]/);
  const render = app.slice(app.indexOf("function renderQuiz()"), app.indexOf("async function startOnlineQuiz()"));
  assert.match(render, /button\.dataset\.quizOption = option\.id/);
  assert.match(render, /button\.textContent = option\.label/);
  assert.match(render, /initializeQuizOptionPhysics\(optionButtons/);
  assert.doesNotMatch(render, /quiz-option-float|appendChild\(label\)/);
  assert.match(app, /function advanceQuizOptionPhysics\(/);
  assert.match(app, /function quizOptionUsesOrbShape\(/);
  assert.match(app, /const size = measureQuizOption\(item\.element, maximumButtonWidth\)/);
  assert.match(app, /requestAnimationFrame\(animateQuizOptionPhysics\)/);
  assert.match(app, /overlapX <= 0 \|\| overlapY <= 0/);
  for (const pauseContract of [
    /document\.visibilityState !== "visible"/,
    /quizWindowBlurred/,
    /quizReducedMotion\.matches/,
    /activeAppTab !== "quiz"/,
    /Boolean\(pendingQuiz\.pendingAnswer\)/,
    /hintActiveUntil/,
    /remainingMs/,
    /arena\?\.querySelector\('button\[data-quiz-option\]:hover'\)/,
    /arena\?\.contains\(document\.activeElement\)/,
    /interaction\?\.pointerDown/,
    /interaction\?\.touchActive/,
    /interaction\?\.focusInside/,
  ]) assert.match(app, pauseContract);
  for (const eventName of ["pointerenter", "pointerleave", "pointerdown", "pointerup", "pointercancel", "touchstart", "touchend", "touchcancel", "focusin", "focusout"]) {
    assert.match(app, new RegExp(`addEventListener\\(\"${eventName}\"`));
  }
  assert.match(app, /motion\.resizeObserver = new ResizeObserver/);
  assert.match(app, /motion\.resizeObserver\?\.disconnect\(\)/);
  assert.match(app, /const motionResumeDelay = Math\.max\(0, quizFeedbackUntil - Date\.now\(\)\) \+ 10/);
});

test("question catalog includes formatted higher math, geometry, solids, and Japanese word problems", () => {
  for (const template of [
    "sigma", "derivative-monomial", "integral-linear", "integral-polynomial",
    "rectangle-area", "triangle-area", "cylinder-volume", "cylinder-minus-cone",
    "crane-turtle", "work-rate", "newton-flow", "catch-up", "matrix-trace",
    "sigma-quadratic", "system-three", "determinant-three", "derivative-product",
    "committee-roles", "paired-selection", "recurrence",
  ]) assert.match(edge, new RegExp(`"${template}"`));
  for (const kind of ["sum", "integral", "derivative", "matrix-determinant"]) assert.match(app, new RegExp(`descriptor\\.kind === "${kind}"`));
  assert.match(app, /MATHML_NS/);
});

test("quadratic exposes the smaller-root instruction in source and legacy-compatible rendering", () => {
  assert.match(edge, /"quadratic"[^\n]+小さい方の解 x = \?[^\n]+value: `[^`]+小さい方の解 x = \?`/);
  assert.match(edge, /question\.templateId === "quadratic"\) mission = "式を整理して、小さい方の解を求めよう"/);
  assert.match(app, /function quizVisibleMathCopy\(question, descriptor\)/);
  assert.match(app, /question\?\.templateId !== "quadratic"/);
  assert.match(app, /suffix: "小さい方の解 x = \?"/);
  assert.doesNotMatch(app, /quizVisibleMathCopy[\s\S]{0,900}(?:correctOption|answerId|isCorrect)/);
});

test("quiz outlook uses only contiguous server-acknowledged answers and mirrors every reward tier as unconfirmed", () => {
  const runtime = loadProgressRuntime();
  assert.deepEqual({ ...runtime.quizConfirmedProgress(acknowledgedQuiz("CCWC")) }, { answered: 4, correct: 3, wrong: 1, streak: 1, bestStreak: 2 });
  assert.equal(runtime.quizConfirmedProgress({ ...acknowledgedQuiz("CC"), answerResults: acknowledgedQuiz("C").answerResults }), null);
  assert.equal(runtime.quizConfirmedProgress({ ...acknowledgedQuiz("CC"), pendingAnswer: { answerId: "unconfirmed" }, answers: [], answerResults: [] }).answered, 0);
  assert.equal(runtime.quizConfirmedProgress({ answerMode: "batch-v1", answers: [], answerResults: [] }), null);

  const cases = [
    ["CCCCCCCCCC", 5, { draws: 10, ticketLevel: 5, reason: "全問正解" }],
    ["CCCCCW", 4, { draws: 5, ticketLevel: 4, reason: "5連続正解" }],
    ["CCWCCWCCC", 3, { draws: 3, ticketLevel: 3, reason: "累計7正解" }],
    ["WWW", 4, { draws: 1, ticketLevel: 3, reason: "3ミス時の救済" }],
    ["WWW", 1, { draws: 1, ticketLevel: 1, reason: "3ミス時の救済" }],
  ];
  for (const [pattern, level, expected] of cases) {
    const quiz = acknowledgedQuiz(pattern, level);
    assert.deepEqual({ ...runtime.quizRewardEstimate(runtime.quizConfirmedProgress(quiz), level) }, expected, pattern);
    const copy = runtime.quizProgressCopy(quiz);
    assert.match(copy.summary, /採点済み履歴/);
    assert.match(copy.summary, /見込み/);
    assert.match(copy.summary, /未確定/);
    assert.doesNotMatch(`${copy.summary}${copy.target}`, /獲得|付与済み|保存済み/);
  }
  assert.match(runtime.quizProgressCopy(acknowledgedQuiz("", 4)).target, /5連続まであと5/);
  assert.match(runtime.quizProgressCopy(acknowledgedQuiz("CCCCC", 4)).target, /全問正解まであと5/);
  assert.match(runtime.quizProgressCopy(acknowledgedQuiz("WWWWWWWWW", 4)).target, /残り問題では上位条件に届きません/);
  assert.match(runtime.quizProgressCopy(acknowledgedQuiz("WWW", 4)).summary, /Lv\.3券1枚（未確定・3ミス時の救済）/);
  assert.match(runtime.quizProgressCopy({ answerMode: "batch-v1", answers: [], answerResults: [] }).summary, /採点後/);
});

test("word problems keep their calculation hidden until the explicit hint", () => {
  const storyLines = edge.split("\n").filter((line) => /kind: "story"/.test(line));
  assert.equal(storyLines.length, 9);
  for (const line of storyLines) {
    assert.doesNotMatch(line, /kind: "story",\s*value:/);
  }
  assert.match(app, /descriptor\.kind === "story"[\s\S]+prompt\.textContent = question\?\.prompt/);
  assert.match(app, /function openQuizHint\(/);
});

test("area and volume questions use allowlisted dimension diagrams without formulas", () => {
  assert.match(html, /<div id="quizQuestion" class="quiz-question"><\/div>/);
  for (const shape of ["rectangle", "cube", "triangle", "cuboid", "circle", "trapezoid", "cylinder"]) {
    assert.match(edge, new RegExp(`shape: "${shape}"`));
    assert.match(app, new RegExp(`descriptor\\.shape === "${shape}"`));
  }
  assert.doesNotMatch(edge, /shape: "cone"/);
  assert.match(edge, /"cylinder-minus-cone"/);
  assert.match(app, /descriptor\.shape === "cone"/, "legacy finished questions remain renderable");
  const diagramLines = edge.split("\n").filter((line) => /kind: "geometry", shape:/.test(line));
  assert.equal(diagramLines.length, 8);
  for (const line of diagramLines) assert.doesNotMatch(line, /\bvalue:|\bsuffix:/);
  assert.match(app, /document\.createElementNS\(SVG_NS/);
  assert.match(app, /class: "quiz-geometry-cutout"/);
  assert.match(app, /dimensions\.innerRadius/);
  assert.match(app, /dimensions\.cutoutBase/);
  assert.match(css, /\.quiz-geometry-cutout\{[^}]*stroke-dasharray/);
  assert.doesNotMatch(app, /quiz-geometry[\s\S]{0,300}innerHTML/);
});

test("calculus, arbitrary sequence indices, and sigma bounds have structured rendering", () => {
  assert.match(edge, /function inclusiveIntegerSum\(/);
  assert.equal((edge.match(/inclusiveIntegerSum\(lower, end/g) || []).length, 3);
  assert.equal((edge.match(/kind: "sum", index: "k", lower, upper: end/g) || []).length, 3);
  assert.match(edge, /kind: "sum", index: "n", lower: 1, upper: position,.*sequence: \{ first, difference, position \}/);
  assert.match(app, /descriptor\.kind === "integral"[\s\S]+mathNode\("msubsup"\)/);
  assert.match(app, /descriptor\.kind === "derivative"[\s\S]+const evaluation = mathNode\("msub"\)/);
  assert.match(app, /descriptor\.kind === "determinant-product"[\s\S]+mathNode\("mi", "det"\)[\s\S]+mathMatrix\(descriptor\.right\)/);
  assert.match(app, /descriptor\.grouped[\s\S]+mathNode\("mo", "\("\)/);
});

test("only overflowing quiz math receives a persistent horizontal position bar", () => {
  assert.match(app, /viewport\.scrollWidth > viewport\.clientWidth \+ 1/);
  assert.match(app, /track\.hidden = !overflow/);
  assert.match(app, /viewport\.tabIndex = overflow \? 0 : -1/);
  assert.match(app, /quizMathResizeObserver = new ResizeObserver\(sync\)/);
  assert.match(app, /quizMathResizeObserver\?\.disconnect\(\);\s*quizMathResizeObserver = null;\s*host\.replaceChildren\(\)/);
  assert.match(css, /\.quiz-math-scroll\{[^}]*overflow-x:auto/);
  assert.match(css, /\.quiz-question \.quiz-math-scroll math\{[^}]*white-space:nowrap/);
  assert.match(css, /\.quiz-overflow-scrollbar\[hidden\]\{display:none\}/);
  assert.match(html, /style\.css\?v=20260910-12/);
  assert.match(html, /standard-online-client\.js\?v=20260910-1/);
  assert.match(html, /app\.js\?v=20260912-35/);
});

test("per-question feedback is server-acknowledged, retryable, brief in motion, and followed by an optional review", () => {
  for (const id of ["quizAnswerFeedback", "quizOutlook", "quizConfirmedProgress", "quizRewardPreview", "quizRewardTarget", "quizRewardSummary", "quizGoGacha", "quizReview", "quizReviewList"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="quizAnswerFeedback"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(html, /id="quizOutlook"[^>]+role="group"[^>]+aria-live="off"/);
  assert.doesNotMatch(html, /id="quiz(?:ConfirmedProgress|RewardPreview|RewardTarget)"[^>]+aria-live=/);
  assert.match(css, /\.quiz-outlook\{[^}]*height:96px[^}]*min-height:96px[^}]*overflow-wrap:anywhere/);
  assert.match(css, /@media\(max-width:420px\)\{\.quiz-outlook\{height:112px;min-height:112px/);
  assert.match(css, /@media\(max-width:260px\)\{\.quiz-outlook\{height:auto\}\}/);
  assert.match(app, /answerMode === "per-question-v1"/);
  assert.match(app, /pendingQuiz\.pendingAnswer = \{[\s\S]+actionId: crypto\.randomUUID\(\)/);
  assert.match(app, /await client\.answerQuiz\(/);
  assert.match(app, /pendingQuiz\.answers\.push\(pending\.answerId\)/);
  assert.ok(app.indexOf("await client.answerQuiz(") < app.indexOf("pendingQuiz.answers.push(pending.answerId)"));
  assert.match(app, /retry\.textContent = quizBusy \? "回答を送信中…" : "前回の回答を確認"/);
  assert.match(app, /前問 Q\$\{Number\(feedback\.questionIndex\) \+ 1\}：/);
  assert.match(app, /正解：\$\{feedback\.correctOptionLabel\}/);
  assert.match(app, /setTimeout\([\s\S]{0,180}\}, 600\)/);
  assert.match(css, /\.quiz-answer-feedback\.emphasize\{animation:quiz-feedback-pop \.6s ease-out\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.quiz-answer-feedback\.emphasize\{animation:none\}\}/);
  assert.match(app, /Array\.isArray\(lastQuizResult\.answerReview\)/);
  assert.doesNotMatch(app, /lastQuizResult[^\n]+localStorage\.setItem/);
});

test("five-tab navigation separates the app into focused screens", () => {
  for (const tab of ["home", "battle", "quiz", "cards", "profile"]) assert.match(html, new RegExp(`data-app-tab="${tab}"`));
  assert.match(app, /function activateAppTab/);
  assert.match(css, /\.tab-panel-hidden\{display:none!important\}/);
  assert.match(html, /id="cardLibraryPanel"/);
});

test("terminal presentation is remembered and four-color setup uses color-aware DOM", () => {
  assert.match(app, /TERMINAL_PRESENTED_KEY/);
  assert.match(app, /localStorage\.getItem\(TERMINAL_PRESENTED_KEY\) === eventKey/);
  assert.match(app, /localStorage\.setItem\(TERMINAL_PRESENTED_KEY, eventKey\)/);
  assert.match(app, /全4色（赤・青・黄・緑）/);
  assert.match(app, /appendColorValue\(detail, color\)/);
  assert.match(css, /\.inline-color-value\.red/);
});
