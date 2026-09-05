"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202609050004_standard_quiz_answer_feedback.sql"), "utf8");

test("quiz feedback migration is additive and keeps the v1 start and finish boundaries", () => {
  assert.match(sql, /alter table fcg_private\.standard_quiz_sessions[\s\S]+add column if not exists answer_receipts jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /add column if not exists explanations jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /create or replace function public\.fcg_standard_server_start_quiz_v2/i);
  assert.match(sql, /from public\.fcg_standard_server_start_quiz\(/i);
  assert.match(sql, /create or replace function public\.fcg_standard_server_finish_quiz_v2/i);
  assert.match(sql, /from public\.fcg_standard_server_finish_quiz\(/i);
  assert.doesNotMatch(sql, /drop function/i);
});

test("one row lock irreversibly seals each question before revealing its answer", () => {
  const answer = sql.slice(
    sql.indexOf("create or replace function public.fcg_standard_server_answer_quiz"),
    sql.indexOf("create or replace function public.fcg_standard_server_finish_quiz_v2"),
  );
  assert.match(answer, /where quiz\.session_id = p_session_id and quiz\.user_id = p_user_id[\s\S]+for update/i);
  const replay = answer.indexOf("where receipt ->> 'actionId' = p_answer_action_id::text");
  const completionGuard = answer.indexOf("if v_quiz.completed_at is not null");
  assert.ok(replay >= 0 && completionGuard > replay, "exact replay must be resolved before terminal guards");
  assert.match(answer, /v_receipt ->> 'answerId' <> p_answer_id[\s\S]+QUIZ_ACTION_ID_REUSED/i);
  assert.match(answer, /return query select true, p_question_index, p_question_index \+ 1/i);
  assert.match(answer, /p_question_index < v_answered_count[\s\S]+QUIZ_QUESTION_ALREADY_ANSWERED/i);
  assert.match(answer, /p_question_index > v_answered_count[\s\S]+QUIZ_ANSWER_OUT_OF_ORDER/i);
  assert.match(answer, /jsonb_array_elements\(v_quiz\.questions -> p_question_index -> 'options'\)[\s\S]+choice ->> 'id' = p_answer_id/i);
  const seal = answer.indexOf("set answer_receipts =");
  const reveal = answer.lastIndexOf("return query select false");
  assert.ok(seal >= 0 && reveal > seal, "the receipt must be stored before correctness is returned");
  for (const field of ["v_is_correct", "v_correct_option_id", "v_correct_option_label", "v_explanation"]) {
    assert.match(answer.slice(reveal), new RegExp(field));
  }
});

test("finish v2 settles once, validates the sealed prefix, and returns a complete review", () => {
  const finish = sql.slice(sql.indexOf("create or replace function public.fcg_standard_server_finish_quiz_v2"));
  assert.match(finish, /from public\.fcg_standard_server_finish_quiz\(p_user_id, p_session_id, p_finish_action_id, p_answers\)/i);
  assert.match(finish, /v_receipt ->> 'answerId' <> p_answers ->> v_index[\s\S]+QUIZ_ANSWER_CONFLICT/i);
  assert.match(finish, /'submittedAnswers', p_answers/i);
  for (const field of ["questionIndex", "question", "selectedOptionId", "selectedOptionLabel", "correctOptionId", "correctOptionLabel", "isCorrect", "explanation"]) {
    assert.match(finish, new RegExp(`'${field}'`));
  }
  assert.match(finish, /'question', v_question/);
  assert.match(finish, /v_review := v_review \|\| jsonb_build_array/i);
});

test("all new quiz feedback RPCs remain service-only", () => {
  for (const name of ["start_quiz_v2", "answer_quiz", "finish_quiz_v2"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.fcg_standard_server_${name}[\\s\\S]+from public, anon, authenticated`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.fcg_standard_server_${name}[\\s\\S]+to service_role`, "i"));
  }
  assert.doesNotMatch(sql, /grant execute on function public\.fcg_standard_server_(?:start_quiz_v2|answer_quiz|finish_quiz_v2)[^;]+to authenticated/i);
});
