"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const fs = require("node:fs");
const load = (name) => import(pathToFileURL(path.join(__dirname, "../standard-online-v5", name)));

for (const [expression, expected] of [["1+2*3", 7], ["(1+2)×3", 9], ["8÷2÷2", 2], ["8-3-2", 3],
  ["-.5 + +2", 1.5], ["2*-3", -6], ["-(2+3)/2", -2.5], ["0.1+0.2", 0.30000000000000004], ["−0", 0]]) {
  test(`UDL-048 calculator precedence: ${expression}`, async () => {
    const { calculateExpression } = await load("quiz-calculator.js");
    const result = calculateExpression(expression);
    assert.equal(result.ok, true);
    assert.ok(Math.abs(result.value - expected) < 1e-12);
    if (expression === "0.1+0.2") assert.equal(result.display, "0.3");
    if (expression === "−0") assert.equal(result.display, "0");
  });
}

for (const [expression, code] of [["", "EMPTY"], ["2+", "INCOMPLETE"], ["(2+3", "INCOMPLETE"],
  ["2+3)", "INCOMPLETE"], ["()", "INCOMPLETE"], ["1 2", "INCOMPLETE"], ["2(3)", "INCOMPLETE"],
  ["1..2", "INCOMPLETE"], ["1/0", "ZERO_DIVISION"], ["1/-0", "ZERO_DIVISION"], ["0/0", "ZERO_DIVISION"],
  ["2**3", "INCOMPLETE"], ["2^3", "INVALID"], ["1e3", "INVALID"], ["Math.random()", "INVALID"],
  ["globalThis.pwned=1", "INVALID"], ["<script>", "INVALID"], ["NaN", "INVALID"], [null, "INVALID"],
  ["1".repeat(97), "LIMIT"], ["(".repeat(13) + "1" + ")".repeat(13), "LIMIT"], ["1+".repeat(32) + "1", "LIMIT"],
  ["9".repeat(40) + "*" + "9".repeat(40), null]]) {
  test(`UDL-048 calculator rejects unsafe/incomplete input: ${String(expression).slice(0, 30)}`, async () => {
    const { calculateExpression } = await load("quiz-calculator.js");
    const result = calculateExpression(expression);
    assert.equal(result.ok, code === null);
    if (code) assert.equal(result.code, code);
    assert.equal(globalThis.pwned, undefined);
  });
}

function memoryStorage() {
  const map = new Map([["unrelated", "keep"]]);
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key), map };
}
const stroke = (tool = "pen") => ({ kind: "stroke", tool, width: tool === "pen" ? 3 : 20, points: [[0.1, 0.2], [0.5, 0.8]] });

test("UDL-048 same-question storage restores normalized ink and calculator; next scope clears only scratch", async () => {
  const m = await load("quiz-scratch-state.js");
  const storage = memoryStorage(), adapter = m.createScratchStorage(storage);
  const scope = m.scratchScope("session-one", 0);
  let state = m.appendScratchOperation(m.emptyScratch(scope), stroke());
  state.calculator = { expression: "2+3", result: "5", history: [{ expression: "2+3", result: "5" }] };
  assert.equal(adapter.save(state), true);
  assert.deepEqual(adapter.load(scope), state);
  assert.deepEqual(adapter.load(m.scratchScope("session-one", 1)), m.emptyScratch(m.scratchScope("session-one", 1)));
  assert.equal(storage.map.has(m.SCRATCH_KEY), false);
  assert.equal(storage.map.get("unrelated"), "keep");
  adapter.save(state);
  assert.equal(adapter.load(m.scratchScope("session-two", 0)).operations.length, 0);
});

test("UDL-048 eraser and Clear are independently undoable, including Clear then Undo", async () => {
  const m = await load("quiz-scratch-state.js");
  const first = m.appendScratchOperation(m.emptyScratch(m.scratchScope("s", 0)), stroke());
  const erased = m.appendScratchOperation(first, stroke("eraser"));
  const cleared = m.appendScratchOperation(erased, { kind: "clear" });
  assert.deepEqual(m.undoScratch(cleared), erased);
  assert.deepEqual(m.undoScratch(erased), first);
  assert.equal(m.undoScratch(first).operations.length, 0);
});

test("UDL-048 malformed/oversized storage fails locally without throwing or deleting other keys", async () => {
  const m = await load("quiz-scratch-state.js");
  const scope = m.scratchScope("s", 0), storage = memoryStorage();
  let failures = 0;
  const adapter = m.createScratchStorage(storage, () => { failures += 1; });
  for (const raw of ["{oops", "x".repeat(m.SCRATCH_LIMITS.bytes), JSON.stringify({ ...m.emptyScratch(scope), operations: [stroke(), { kind: "stroke", points: [[Infinity, 0]] }] })]) {
    storage.setItem(m.SCRATCH_KEY, raw);
    assert.deepEqual(adapter.load(scope), m.emptyScratch(scope));
    assert.equal(storage.getItem("unrelated"), "keep");
  }
  assert.ok(failures > 0);
  const broken = m.createScratchStorage({ getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); }, removeItem() { throw Error("blocked"); } });
  assert.deepEqual(broken.load(scope), m.emptyScratch(scope));
  assert.equal(broken.save(m.emptyScratch(scope)), false);
});

test("UDL-048 bounds points, undo and metadata; data objects cannot become execution or game payloads", async () => {
  const m = await load("quiz-scratch-state.js");
  let state = m.emptyScratch(m.scratchScope("s", 0));
  for (let i = 0; i < 110; i += 1) state = m.appendScratchOperation(state, stroke());
  for (let i = 0; i < 110; i += 1) state = m.undoScratch(state);
  assert.equal(state.operations.length, 10);
  assert.equal(m.appendScratchOperation(state, { ...stroke(), points: Array.from({ length: 12001 }, () => [0, 0]) }), null);
  assert.equal(m.scratchScope("s", -1), null);
  assert.equal(m.scratchScope("s", 10), null);
  assert.equal(m.scratchScope("", 1), null);
  const safe = m.sanitizeScratch({ ...state, answerKey: "secret", calculator: { expression: "alert(1)", result: "", history: [] } }, state.scope);
  assert.equal(Object.hasOwn(safe, "answerKey"), false);
  assert.equal(safe.calculator.expression, "alert(1)"); // inert text, parser rejects it
});

test("UDL-048 canvas reprojects normalized coordinates and uses destructive compositing only for eraser", async () => {
  const { renderMemoOperations } = await load("quiz-memo-canvas.js");
  const calls = [];
  const context = new Proxy({}, { set(target, key, value) { calls.push([key, value]); target[key] = value; return true; },
    get(target, key) { return target[key] ?? ((...args) => calls.push([key, ...args])); } });
  renderMemoOperations(context, [stroke(), stroke("eraser"), { kind: "clear" }], 390, 844);
  assert.ok(calls.some((call) => call[0] === "moveTo" && call[1] === 39 && call[2] === 168.8));
  assert.ok(calls.some((call) => call[0] === "globalCompositeOperation" && call[1] === "destination-out"));
  assert.equal(calls.filter((call) => call[0] === "clearRect").length, 2);
  assert.equal(context.globalCompositeOperation, "source-over");
});

test("UDL-048 optional scratch modules have no network, grading or pending-quiz persistence access", () => {
  for (const name of ["quiz-calculator.js", "quiz-scratch-state.js", "quiz-memo-canvas.js", "quiz-memo.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "../standard-online-v5", name), "utf8");
    assert.doesNotMatch(source, /\beval\s*\(|\bFunction\s*\(|\bfetch\s*\(|XMLHttpRequest|\blocalStorage\b|\bsupabase\b|\bclient\.|correctOption|\.questions\b|\.answerResults\b/, name);
  }
  const app = fs.readFileSync(path.join(__dirname, "../standard-online-v5/app.js"), "utf8");
  const hook = app.slice(app.indexOf("function syncQuizMemoContext()"), app.indexOf("function renderQuiz()"));
  assert.doesNotMatch(hook, /questions|answerResults|correctOption|grader/);
  assert.match(hook, /pendingQuiz\?\.selectedLevel === 5/);
  assert.match(app, /if \(timedOut\) quizMemo\.deactivate\(\{ lockAnswers: false, restoreFocus: false \}\);\s*if \(!timedOut && quizMemo\.answerLocked\) return;/);
  const clock = app.slice(app.indexOf("function settleQuizClock("), app.indexOf("function stopQuizClock("));
  assert.doesNotMatch(clock, /quizMemo|scratch/, "memo must not introduce a timer pause");
  const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/standard-browser-gate.yml"), "utf8");
  assert.match(workflow, /tests\/standard-quiz-scratch\.test\.cjs/);
});
