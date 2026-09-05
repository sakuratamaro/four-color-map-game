-- Seal each Standard quiz answer before revealing feedback, while preserving the v1 start/finish RPCs.

alter table fcg_private.standard_quiz_sessions
  add column if not exists answer_receipts jsonb not null default '[]'::jsonb,
  add column if not exists explanations jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'standard_quiz_answer_receipts_shape'
      and conrelid = 'fcg_private.standard_quiz_sessions'::regclass
  ) then
    alter table fcg_private.standard_quiz_sessions
      add constraint standard_quiz_answer_receipts_shape
      check (jsonb_typeof(answer_receipts) = 'array' and jsonb_array_length(answer_receipts) <= 10);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'standard_quiz_explanations_shape'
      and conrelid = 'fcg_private.standard_quiz_sessions'::regclass
  ) then
    alter table fcg_private.standard_quiz_sessions
      add constraint standard_quiz_explanations_shape
      check (jsonb_typeof(explanations) = 'array' and jsonb_array_length(explanations) in (0, 10));
  end if;
end;
$$;

create or replace function public.fcg_standard_server_start_quiz_v2(
  p_user_id uuid,
  p_session_id uuid,
  p_start_action_id uuid,
  p_start_fingerprint text,
  p_selected_level integer,
  p_questions jsonb,
  p_answer_ids jsonb,
  p_explanations jsonb,
  p_expires_at timestamptz
)
returns table (
  session_id uuid,
  duplicate boolean,
  questions jsonb,
  selected_level integer,
  expires_at timestamptz,
  feedback_ready boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started record;
  v_explanations jsonb;
  v_index integer;
begin
  if jsonb_typeof(p_explanations) <> 'array' or jsonb_array_length(p_explanations) <> 10 then
    raise exception 'INVALID_QUIZ_START' using errcode = '22023';
  end if;
  for v_index in 0..9 loop
    if jsonb_typeof(p_explanations -> v_index) <> 'string'
        or length(p_explanations ->> v_index) not between 1 and 240 then
      raise exception 'INVALID_QUIZ_START' using errcode = '22023';
    end if;
  end loop;

  select * into v_started
  from public.fcg_standard_server_start_quiz(
    p_user_id,
    p_session_id,
    p_start_action_id,
    p_start_fingerprint,
    p_selected_level,
    p_questions,
    p_answer_ids,
    p_expires_at
  );

  if v_started.duplicate is not true then
    update fcg_private.standard_quiz_sessions quiz
    set explanations = p_explanations
    where quiz.session_id = v_started.session_id and quiz.user_id = p_user_id;
  end if;

  select quiz.explanations into v_explanations
  from fcg_private.standard_quiz_sessions quiz
  where quiz.session_id = v_started.session_id and quiz.user_id = p_user_id;

  return query select
    v_started.session_id,
    v_started.duplicate,
    v_started.questions,
    v_started.selected_level,
    v_started.expires_at,
    jsonb_typeof(v_explanations) = 'array' and jsonb_array_length(v_explanations) = 10;
end;
$$;

create or replace function public.fcg_standard_server_answer_quiz(
  p_user_id uuid,
  p_session_id uuid,
  p_answer_action_id uuid,
  p_question_index integer,
  p_answer_id text
)
returns table (
  duplicate boolean,
  question_index integer,
  answered_count integer,
  is_correct boolean,
  correct_option_id text,
  correct_option_label text,
  explanation text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz fcg_private.standard_quiz_sessions%rowtype;
  v_receipt jsonb;
  v_answered_count integer;
  v_correct_option_id text;
  v_correct_option_label text;
  v_explanation text;
  v_is_correct boolean;
begin
  if p_user_id is null or p_session_id is null or p_answer_action_id is null
      or p_question_index not between 0 and 9
      or p_answer_id is null or length(p_answer_id) not between 1 and 32 then
    raise exception 'INVALID_QUIZ_ANSWER' using errcode = '22023';
  end if;

  select quiz.* into v_quiz
  from fcg_private.standard_quiz_sessions quiz
  where quiz.session_id = p_session_id and quiz.user_id = p_user_id
  for update;
  if not found then raise exception 'QUIZ_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;

  select receipt into v_receipt
  from jsonb_array_elements(v_quiz.answer_receipts) receipt
  where receipt ->> 'actionId' = p_answer_action_id::text;
  if found then
    if (v_receipt ->> 'questionIndex')::integer <> p_question_index
        or v_receipt ->> 'answerId' <> p_answer_id then
      raise exception 'QUIZ_ACTION_ID_REUSED' using errcode = '23505';
    end if;
    v_correct_option_id := v_quiz.answer_ids ->> p_question_index;
    select choice ->> 'label' into v_correct_option_label
    from jsonb_array_elements(v_quiz.questions -> p_question_index -> 'options') choice
    where choice ->> 'id' = v_correct_option_id;
    v_explanation := v_quiz.explanations ->> p_question_index;
    v_is_correct := p_answer_id = v_correct_option_id;
    return query select true, p_question_index, p_question_index + 1,
      v_is_correct, v_correct_option_id, v_correct_option_label, v_explanation;
    return;
  end if;

  if jsonb_typeof(v_quiz.explanations) <> 'array' or jsonb_array_length(v_quiz.explanations) <> 10 then
    raise exception 'QUIZ_FEEDBACK_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_quiz.completed_at is not null then raise exception 'QUIZ_ALREADY_COMPLETED' using errcode = '23505'; end if;
  if v_quiz.expires_at <= now() then raise exception 'QUIZ_EXPIRED' using errcode = 'P0001'; end if;

  v_answered_count := jsonb_array_length(v_quiz.answer_receipts);
  if p_question_index < v_answered_count then
    raise exception 'QUIZ_QUESTION_ALREADY_ANSWERED' using errcode = '23505';
  end if;
  if p_question_index > v_answered_count then
    raise exception 'QUIZ_ANSWER_OUT_OF_ORDER' using errcode = 'P0001';
  end if;
  if p_answer_id <> '__timeout__' and not exists (
    select 1
    from jsonb_array_elements(v_quiz.questions -> p_question_index -> 'options') choice
    where choice ->> 'id' = p_answer_id
  ) then
    raise exception 'INVALID_QUIZ_ANSWER' using errcode = '22023';
  end if;

  v_correct_option_id := v_quiz.answer_ids ->> p_question_index;
  select choice ->> 'label' into v_correct_option_label
  from jsonb_array_elements(v_quiz.questions -> p_question_index -> 'options') choice
  where choice ->> 'id' = v_correct_option_id;
  v_explanation := v_quiz.explanations ->> p_question_index;
  if v_correct_option_id is null or v_correct_option_label is null or v_explanation is null then
    raise exception 'QUIZ_FEEDBACK_UNAVAILABLE' using errcode = 'P0001';
  end if;
  v_is_correct := p_answer_id = v_correct_option_id;

  update fcg_private.standard_quiz_sessions quiz
  set answer_receipts = quiz.answer_receipts || jsonb_build_array(jsonb_build_object(
    'actionId', p_answer_action_id,
    'questionIndex', p_question_index,
    'answerId', p_answer_id
  ))
  where quiz.session_id = p_session_id and quiz.user_id = p_user_id;

  return query select false, p_question_index, v_answered_count + 1,
    v_is_correct, v_correct_option_id, v_correct_option_label, v_explanation;
end;
$$;

create or replace function public.fcg_standard_server_finish_quiz_v2(
  p_user_id uuid,
  p_session_id uuid,
  p_finish_action_id uuid,
  p_answers jsonb
)
returns table (
  new_revision bigint,
  duplicate boolean,
  profile_state jsonb,
  correct integer,
  wrong integer,
  best_streak integer,
  reward jsonb,
  answer_review jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finished record;
  v_quiz fcg_private.standard_quiz_sessions%rowtype;
  v_receipt jsonb;
  v_index integer;
  v_question jsonb;
  v_selected_id text;
  v_selected_label text;
  v_correct_id text;
  v_correct_label text;
  v_explanation text;
  v_review jsonb := '[]'::jsonb;
begin
  select * into v_finished
  from public.fcg_standard_server_finish_quiz(p_user_id, p_session_id, p_finish_action_id, p_answers);

  select quiz.* into v_quiz
  from fcg_private.standard_quiz_sessions quiz
  where quiz.session_id = p_session_id and quiz.user_id = p_user_id
  for update;
  if not found then raise exception 'QUIZ_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;

  if jsonb_array_length(v_quiz.answer_receipts) > 0 then
    for v_index in 0..jsonb_array_length(v_quiz.answer_receipts) - 1 loop
      v_receipt := v_quiz.answer_receipts -> v_index;
      if (v_receipt ->> 'questionIndex')::integer <> v_index
          or v_receipt ->> 'answerId' <> p_answers ->> v_index then
        raise exception 'QUIZ_ANSWER_CONFLICT' using errcode = '23505';
      end if;
    end loop;
  end if;

  if v_quiz.result ? 'submittedAnswers' then
    if v_quiz.result -> 'submittedAnswers' <> p_answers then
      raise exception 'QUIZ_ANSWER_CONFLICT' using errcode = '23505';
    end if;
  else
    update fcg_private.standard_quiz_sessions quiz
    set result = quiz.result || jsonb_build_object('submittedAnswers', p_answers)
    where quiz.session_id = p_session_id and quiz.user_id = p_user_id;
  end if;

  for v_index in 0..9 loop
    v_question := v_quiz.questions -> v_index;
    v_selected_id := p_answers ->> v_index;
    v_correct_id := v_quiz.answer_ids ->> v_index;
    v_selected_label := null;
    if v_selected_id = '__timeout__' then
      v_selected_label := '時間切れ';
    else
      select choice ->> 'label' into v_selected_label
      from jsonb_array_elements(v_question -> 'options') choice
      where choice ->> 'id' = v_selected_id;
    end if;
    select choice ->> 'label' into v_correct_label
    from jsonb_array_elements(v_question -> 'options') choice
    where choice ->> 'id' = v_correct_id;
    v_explanation := coalesce(v_quiz.explanations ->> v_index, '正解は「' || coalesce(v_correct_label, '') || '」です。');
    v_review := v_review || jsonb_build_array(jsonb_build_object(
      'questionIndex', v_index,
      'question', v_question,
      'selectedOptionId', v_selected_id,
      'selectedOptionLabel', coalesce(v_selected_label, '不明な選択肢'),
      'correctOptionId', v_correct_id,
      'correctOptionLabel', v_correct_label,
      'isCorrect', v_selected_id = v_correct_id,
      'explanation', v_explanation
    ));
  end loop;

  return query select
    v_finished.new_revision,
    v_finished.duplicate,
    v_finished.profile_state,
    v_finished.correct,
    v_finished.wrong,
    v_finished.best_streak,
    v_finished.reward,
    v_review;
end;
$$;

revoke all on function public.fcg_standard_server_start_quiz_v2(uuid, uuid, uuid, text, integer, jsonb, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function public.fcg_standard_server_answer_quiz(uuid, uuid, uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.fcg_standard_server_finish_quiz_v2(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_start_quiz_v2(uuid, uuid, uuid, text, integer, jsonb, jsonb, jsonb, timestamptz)
  to service_role;
grant execute on function public.fcg_standard_server_answer_quiz(uuid, uuid, uuid, integer, text)
  to service_role;
grant execute on function public.fcg_standard_server_finish_quiz_v2(uuid, uuid, uuid, jsonb)
  to service_role;
