"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const app = fs.readFileSync(path.join(__dirname, "../standard-online-v5/app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../standard-online-v5/index.html"), "utf8");
function runtime(overrides = {}) {
  const calls = [];
  let release;
  const context = vm.createContext({
    quizBusy: false, synced: true, pendingQuiz: null, lastQuizResult: null,
    profile: () => ({ id: "fixture" }), hasMatchedRoomHandoff: () => false,
    $: () => ({ textContent: "" }), renderQuiz() {}, savePendingQuiz() {}, toast() {},
    markQuizBoundaryForMatchedRoom() {}, flushMatchedRoomHandoff() {},
    crypto: { randomUUID: () => "fixture-id" }, QUIZ_TIMEOUT_ANSWER: "timeout",
    client: { startQuiz: input => { calls.push(input); return new Promise(resolve => {
      release = () => resolve({ sessionId: "session", selectedLevel: input.selectedLevel,
        questions: Array.from({ length: 10 }, (_, i) => ({ id: String(i) })), answerMode: "per-question-v1" });
    }); } }, ...overrides
  });
  const start = app.indexOf("async function startOnlineQuiz(");
  const end = app.indexOf("async function answerOnlineQuiz(", start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(app.slice(start, end), context);
  return { context, calls, start: level => context.startOnlineQuiz(level), release: () => release() };
}
test("five visible direct-level buttons replace both legacy controls", () => {
  assert.deepEqual([...html.matchAll(/data-quiz-start-level="(\d)"/g)].map(m => m[1]), ["1","2","3","4","5"]);
  assert.doesNotMatch(html, /id="quiz(?:Level|Start)"/);
  assert.match(app, /startOnlineQuiz\(Number\(button.dataset.quizStartLevel\)\)/);
});
test("each level starts that exact ten-question session once", async () => {
  for (let level = 1; level <= 5; level++) {
    const r = runtime(), pending = r.start(level);
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].selectedLevel, level);
    r.release(); await pending;
    assert.equal(r.context.pendingQuiz.selectedLevel, level);
    assert.equal(r.context.pendingQuiz.questions.length, 10);
  }
});
test("invalid levels have no start or busy-state side effects", async () => {
  for (const level of [undefined, null, 0, 6, 1.5, "2", NaN]) {
    const r = runtime(); await r.start(level);
    assert.equal(r.calls.length, 0); assert.equal(r.context.quizBusy, false);
  }
});
test("pending, busy, missing-profile and room handoff preserve their sessions", async () => {
  for (const state of [{ quizBusy: true }, { synced: false }, { profile: () => null },
    { pendingQuiz: { sessionId: "existing" } }, { hasMatchedRoomHandoff: () => true }]) {
    const r = runtime(state); await r.start(3);
    assert.equal(r.calls.length, 0);
    if (state.pendingQuiz) assert.equal(r.context.pendingQuiz.sessionId, "existing");
  }
});
test("rapid different-level clicks cannot dispatch a second quiz", async () => {
  const r = runtime(), first = r.start(4);
  await r.start(2);
  assert.equal(r.calls.length, 1); assert.equal(r.calls[0].selectedLevel, 4);
  r.release(); await first;
  assert.equal(r.context.pendingQuiz.selectedLevel, 4);
});

test("reward rules use native closed disclosure and remove redundant start explanations", () => {
  const help = html.match(/<details id="quizRewardHelp"[^>]*>[\s\S]*?<\/details>/)[0];
  assert.doesNotMatch(help.split(">")[0], /\bopen\b/);
  assert.match(help, /<summary>もらえる券<\/summary>/);
  assert.match(help, /10問すべて正解<\/th><td>10枚/);
  assert.match(help, /5問以上を連続正解<\/th><td>5枚/);
  assert.match(help, /合計7問以上を正解<\/th><td>3枚/);
  assert.match(help, /それ以外<\/th><td>1枚<\/td><td>1つ下のLv（最低Lv.1）/);
  assert.doesNotMatch(help, /onclick|data-quiz-start-level|<button/);
  assert.doesNotMatch(html, /問題と採点はサーバー管理|難易度を選んで始めてください/);
});

test("four help rows match every completed ten-answer reward estimate at all five levels", () => {
  const begin = app.indexOf("function quizRewardEstimate("), end = app.indexOf("function quizNextRewardTarget(", begin);
  const context = vm.createContext({}); vm.runInContext(app.slice(begin, end), context);
  for (let bits = 0; bits < 1024; bits++) {
    let correct = 0, streak = 0, bestStreak = 0;
    for (let i = 0; i < 10; i++) {
      if (bits & (1 << i)) { correct++; streak++; bestStreak = Math.max(bestStreak, streak); }
      else streak = 0;
    }
    for (let level = 1; level <= 5; level++) {
      const reward = context.quizRewardEstimate({ correct, wrong: 10-correct, bestStreak }, level);
      const count = correct === 10 ? 10 : bestStreak >= 5 ? 5 : correct >= 7 ? 3 : 1;
      assert.equal(reward.draws, count);
      assert.equal(reward.ticketLevel, count === 1 ? Math.max(1, level-1) : level);
    }
  }
  const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations/202609100001_standard_quiz_accuracy.sql"), "utf8");
  assert.match(sql, /if v_correct = 10 then\s+v_draws := 10;[\s\S]*?elsif v_best_streak >= 5 then\s+v_draws := 5;[\s\S]*?elsif v_correct >= 7 then\s+v_draws := 3;[\s\S]*?elsif v_wrong >= 3 then\s+v_ticket_level := greatest\(1, v_quiz.selected_level - 1\)/);
});
