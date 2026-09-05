"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "202609030004_standard_online_quiz.sql"), "utf8");
const feedbackMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "202609050004_standard_quiz_answer_feedback.sql"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase", "functions", "standard-game-action", "index.ts"), "utf8");
const html = fs.readFileSync(path.join(root, "standard-online-v5", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "standard-online-v5", "app.js"), "utf8");

test("online quiz answers stay private and ticket rewards commit atomically", () => {
  assert.match(migration, /create table if not exists fcg_private\.standard_quiz_sessions/i);
  assert.match(migration, /alter table fcg_private\.standard_quiz_sessions enable row level security/i);
  assert.match(migration, /revoke all on table fcg_private\.standard_quiz_sessions from public, anon, authenticated/i);
  assert.match(migration, /create or replace function public\.fcg_standard_server_start_quiz/i);
  assert.match(migration, /create or replace function public\.fcg_standard_server_finish_quiz/i);
  assert.match(migration, /for update[\s\S]+update public\.fcg_standard_profiles[\s\S]+profile_state = v_profile/i);
  assert.match(migration, /v_correct = 10[\s\S]+v_draws := 10/i);
  assert.match(migration, /v_best_streak >= 5[\s\S]+v_draws := 5/i);
  assert.match(migration, /v_correct >= 7[\s\S]+v_draws := 3/i);
  assert.match(migration, /started_at >= now\(\) - interval '1 hour'/i);
  assert.match(migration, /started_at > now\(\) - interval '5 seconds'/i);
  assert.doesNotMatch(migration, /grant execute[\s\S]+to authenticated/i);
});

test("Edge creates server quiz questions and returns no answer key", () => {
  assert.match(edge, /createQuizChallenge/);
  assert.match(edge, /operation === "quiz-start"/);
  assert.match(edge, /operation === "quiz-finish"/);
  const startResponse = edge.slice(edge.indexOf('if (operation === "quiz-start")'), edge.indexOf('if (operation === "quiz-answer")'));
  assert.match(startResponse, /questions: started\?\.questions/);
  assert.match(startResponse, /timeoutAnswerId: QUIZ_TIMEOUT_ANSWER/);
  assert.match(startResponse, /answerMode: started\?\.feedback_ready === true \? "per-question-v1" : undefined/);
  assert.match(startResponse, /p_explanations: challenge\.explanations/);
  assert.doesNotMatch(startResponse, /answerIds:/);
  assert.doesNotMatch(startResponse, /correctOptionId|correct_option_id/);
});

test("Edge reveals one sealed answer and requests the final review only through service RPCs", () => {
  assert.match(edge, /"quiz-start", "quiz-answer", "quiz-finish"/);
  const answer = edge.slice(edge.indexOf('if (operation === "quiz-answer")'), edge.indexOf('if (operation === "quiz-finish")'));
  assert.match(answer, /fcg_standard_server_answer_quiz/);
  assert.match(answer, /p_user_id: actorId/);
  assert.match(answer, /p_answer_action_id: actionId/);
  assert.match(answer, /p_question_index: questionIndex/);
  assert.match(answer, /p_answer_id: answerId/);
  assert.match(answer, /quizAnswerProjection\(answered \|\| \{\}\)/);
  assert.doesNotMatch(answer, /answer_ids|questions:|explanations:/);

  const finish = edge.slice(edge.indexOf('if (operation === "quiz-finish")'), edge.indexOf("const roomId = body.roomId"));
  assert.match(finish, /fcg_standard_server_finish_quiz_v2/);
  assert.match(finish, /answerReview: finished\?\.answer_review/);
  assert.match(feedbackMigration, /correct_option_label text[\s\S]+explanation text/i);
});

test("online quiz timing and hint metadata cross the Edge boundary without exposing correctness", () => {
  assert.match(edge, /timeLimitSeconds: generated\.timeLimitSeconds/);
  assert.match(edge, /hintOptions: quizHintOptions\(generated\.hint\)/);
  assert.match(edge, /hintDurationMs: level >= 4 \? 5000 : 3500/);
  assert.match(edge, /answer !== QUIZ_TIMEOUT_ANSWER && !QUIZ_ANSWER_PATTERN\.test\(answer\)/);
  const challenge = edge.slice(edge.indexOf("function createQuizChallenge"), edge.indexOf("function mapDatabaseError"));
  assert.doesNotMatch(challenge, /questions\.push\(\{[\s\S]*?correctId:/);
});

test("online quiz UI resumes after a hint and rejects answers at the timeout boundary", () => {
  for (const id of ["quizTimer", "quizTimeBar", "quizHint", "quizHintText"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /const hintWasActive = Number\(previousState\?\.hintActiveUntil \|\| 0\) > 0/);
  assert.match(app, /if \(hintWasActive && !hintRemaining\) \{[\s\S]+renderQuizHint\(question, state\)[\s\S]+option\.disabled = quizBusy \|\| remaining <= 0/);
  assert.match(app, /answerOnlineQuiz\(pendingQuiz\.timeoutAnswerId \|\| QUIZ_TIMEOUT_ANSWER, \{ timedOut: true \}\)/);
  assert.match(app, /if \(!timedOut && Number\(questionState\?\.remainingMs \|\| 0\) <= 0\) return/);
});

test("Standard Online exposes a server-backed quiz and a published CPU entry", () => {
  assert.match(html, /id="quizPanel"/);
  assert.match(html, /ガチャ券クイズ/);
  assert.match(html, /href="\.\.\/solo-v5\/index\.html"/);
  assert.match(html, /CPU対戦を始める/);
  assert.match(app, /client\.startQuiz/);
  assert.match(app, /client\.finishQuiz/);
  assert.match(app, /QUIZ_PENDING_KEY/);
  for (const file of ["index.html", "style.css", "app.js", "save-codec.js"]) {
    assert.ok(fs.existsSync(path.join(root, "solo-v5", file)), `missing published CPU asset ${file}`);
  }
});
