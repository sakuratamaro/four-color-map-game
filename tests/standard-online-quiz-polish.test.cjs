"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "standard-online-v5");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const edge = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "standard-game-action", "index.ts"), "utf8");

test("online quiz shows a persisted per-question timer and pauses it for one short hint", () => {
  for (const id of ["quizTimer", "quizTimeBar", "quizHint", "quizHintText"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /function settleQuizClock/);
  assert.match(app, /hintActiveUntil > now/);
  assert.match(app, /state\.hintUsed = true/);
  assert.match(app, /hintDurationMs \|\| 3500/);
  assert.match(app, /QUIZ_TIMEOUT_ANSWER/);
});

test("hints mix one useful formula with decoys without identifying the useful one", () => {
  assert.match(edge, /function quizHintOptions\(correctHint: string\)/);
  assert.match(edge, /slice\(0, 2\)/);
  assert.match(edge, /shuffled\(\[correctHint, \.\.\.decoys\]\)/);
  assert.match(app, /使うものと使わないものが混ざっています/);
});

test("question choices glow without moving their click targets and honor reduced motion", () => {
  assert.match(css, /\.quiz-options button\{animation:quiz-option-glow/);
  const glow = css.match(/@keyframes quiz-option-glow\{[^}]+\}[^}]+\}/)?.[0] || "";
  assert.match(glow, /box-shadow/);
  assert.doesNotMatch(glow, /transform|translate|rotate/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.quiz-options button\{animation:none\}\}/);
});

test("question catalog includes formatted higher math, geometry, solids, and Japanese word problems", () => {
  for (const template of [
    "sigma", "derivative-monomial", "integral-linear", "integral-quadratic",
    "rectangle-area", "triangle-area", "cylinder-volume", "cone-volume",
    "crane-turtle", "work-rate", "newton-flow", "newton-workers", "catch-up",
  ]) assert.match(edge, new RegExp(`"${template}"`));
  for (const kind of ["sum", "integral", "derivative", "matrix-determinant"]) assert.match(app, new RegExp(`descriptor\\.kind === "${kind}"`));
  assert.match(app, /MATHML_NS/);
});

test("word problems keep their calculation hidden until the explicit hint", () => {
  const storyLines = edge.split("\n").filter((line) => /kind: "story"/.test(line));
  assert.equal(storyLines.length, 8);
  for (const line of storyLines) {
    assert.doesNotMatch(line, /kind: "story",\s*value:/);
  }
  assert.match(app, /descriptor\.kind === "story"[\s\S]+prompt\.textContent = question\?\.prompt/);
  assert.match(app, /function openQuizHint\(/);
});

test("area and volume questions use allowlisted dimension diagrams without formulas", () => {
  assert.match(html, /<div id="quizQuestion" class="quiz-question"><\/div>/);
  for (const shape of ["rectangle", "cube", "triangle", "cuboid", "circle", "trapezoid", "cylinder", "cone"]) {
    assert.match(edge, new RegExp(`shape: "${shape}"`));
    assert.match(app, new RegExp(`descriptor\\.shape === "${shape}"`));
  }
  const diagramLines = edge.split("\n").filter((line) => /kind: "geometry", shape:/.test(line));
  assert.equal(diagramLines.length, 8);
  for (const line of diagramLines) assert.doesNotMatch(line, /\bvalue:|\bsuffix:/);
  assert.match(app, /document\.createElementNS\(SVG_NS/);
  assert.doesNotMatch(app, /quiz-geometry[\s\S]{0,300}innerHTML/);
});

test("calculus, arbitrary sequence indices, and sigma bounds have structured rendering", () => {
  assert.match(edge, /function inclusiveIntegerSum\(/);
  assert.equal((edge.match(/inclusiveIntegerSum\(lower, end/g) || []).length, 3);
  assert.equal((edge.match(/kind: "sum", index: "k", lower, upper: end/g) || []).length, 3);
  assert.match(edge, /kind: "sequence", first, difference, position/);
  assert.match(app, /descriptor\.kind === "integral"[\s\S]+mathNode\("msubsup"\)/);
  assert.match(app, /descriptor\.kind === "derivative"[\s\S]+const evaluation = mathNode\("msub"\)/);
  assert.match(app, /descriptor\.kind === "sequence"[\s\S]+mathNode\("mn", descriptor\.position\)/);
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
  assert.match(html, /style\.css\?v=20260905-9/);
  assert.match(html, /app\.js\?v=20260905-9/);
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
