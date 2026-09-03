-- Server-authored Standard online quiz sessions and atomic ticket rewards.

create table if not exists fcg_private.standard_quiz_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_action_id uuid not null,
  start_fingerprint text not null check (start_fingerprint ~ '^[0-9a-f]{64}$'),
  selected_level smallint not null check (selected_level between 1 and 5),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) = 10),
  answer_ids jsonb not null check (jsonb_typeof(answer_ids) = 'array' and jsonb_array_length(answer_ids) = 10),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finish_action_id uuid,
  completed_at timestamptz,
  result jsonb,
  unique (user_id, start_action_id),
  unique (user_id, finish_action_id)
);

alter table fcg_private.standard_quiz_sessions enable row level security;
revoke all on table fcg_private.standard_quiz_sessions from public, anon, authenticated;

create or replace function public.fcg_standard_server_start_quiz(
  p_user_id uuid,
  p_session_id uuid,
  p_start_action_id uuid,
  p_start_fingerprint text,
  p_selected_level integer,
  p_questions jsonb,
  p_answer_ids jsonb,
  p_expires_at timestamptz
)
returns table (session_id uuid, duplicate boolean, questions jsonb, selected_level integer, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing fcg_private.standard_quiz_sessions%rowtype;
  v_recent_count integer;
begin
  if p_user_id is null or p_session_id is null or p_start_action_id is null
      or p_start_fingerprint !~ '^[0-9a-f]{64}$'
      or p_selected_level not between 1 and 5
      or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> 10
      or jsonb_typeof(p_answer_ids) <> 'array' or jsonb_array_length(p_answer_ids) <> 10
      or p_expires_at <= now() or p_expires_at > now() + interval '30 minutes' then
    raise exception 'INVALID_QUIZ_START' using errcode = '22023';
  end if;

  perform 1 from public.fcg_standard_profiles where user_id = p_user_id;
  if not found then raise exception 'STANDARD_PROFILE_REQUIRED' using errcode = 'P0002'; end if;

  select quiz.* into v_existing
  from fcg_private.standard_quiz_sessions quiz
  where quiz.user_id = p_user_id and quiz.start_action_id = p_start_action_id;
  if found then
    if v_existing.start_fingerprint <> p_start_fingerprint then
      raise exception 'QUIZ_ACTION_ID_REUSED' using errcode = '23505';
    end if;
    return query select v_existing.session_id, true, v_existing.questions,
      v_existing.selected_level::integer, v_existing.expires_at;
    return;
  end if;

  select count(*)::integer into v_recent_count
  from fcg_private.standard_quiz_sessions quiz
  where quiz.user_id = p_user_id
    and quiz.started_at >= now() - interval '1 hour';
  if v_recent_count >= 30 then
    raise exception 'QUIZ_RATE_LIMIT' using errcode = 'P0001';
  end if;

  insert into fcg_private.standard_quiz_sessions
    (session_id, user_id, start_action_id, start_fingerprint, selected_level, questions, answer_ids, expires_at)
  values
    (p_session_id, p_user_id, p_start_action_id, p_start_fingerprint, p_selected_level, p_questions, p_answer_ids, p_expires_at);

  return query select p_session_id, false, p_questions, p_selected_level, p_expires_at;
end;
$$;

create or replace function public.fcg_standard_server_finish_quiz(
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
  reward jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz fcg_private.standard_quiz_sessions%rowtype;
  v_profile_revision bigint;
  v_profile jsonb;
  v_index integer;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_streak integer := 0;
  v_best_streak integer := 0;
  v_draws integer := 1;
  v_ticket_level integer;
  v_reason text := '参加報酬';
  v_current_tickets integer;
  v_previous_record jsonb;
  v_record jsonb;
  v_reward jsonb;
begin
  if p_user_id is null or p_session_id is null or p_finish_action_id is null
      or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 10 then
    raise exception 'INVALID_QUIZ_FINISH' using errcode = '22023';
  end if;
  for v_index in 0..9 loop
    if jsonb_typeof(p_answers -> v_index) <> 'string' then
      raise exception 'INVALID_QUIZ_ANSWER' using errcode = '22023';
    end if;
  end loop;

  select quiz.* into v_quiz
  from fcg_private.standard_quiz_sessions quiz
  where quiz.session_id = p_session_id and quiz.user_id = p_user_id
  for update;
  if not found then raise exception 'QUIZ_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;

  select profile.revision, profile.profile_state into v_profile_revision, v_profile
  from public.fcg_standard_profiles profile
  where profile.user_id = p_user_id
  for update;
  if not found then raise exception 'STANDARD_PROFILE_REQUIRED' using errcode = 'P0002'; end if;

  if v_quiz.completed_at is not null then
    if v_quiz.finish_action_id <> p_finish_action_id then
      raise exception 'QUIZ_ALREADY_COMPLETED' using errcode = '23505';
    end if;
    return query select v_profile_revision, true, v_profile,
      (v_quiz.result ->> 'correct')::integer,
      (v_quiz.result ->> 'wrong')::integer,
      (v_quiz.result ->> 'bestStreak')::integer,
      v_quiz.result -> 'reward';
    return;
  end if;
  if v_quiz.expires_at <= now() then raise exception 'QUIZ_EXPIRED' using errcode = 'P0001'; end if;
  if v_quiz.started_at > now() - interval '5 seconds' then raise exception 'QUIZ_TOO_FAST' using errcode = 'P0001'; end if;

  for v_index in 0..9 loop
    if (p_answers ->> v_index) = (v_quiz.answer_ids ->> v_index) then
      v_correct := v_correct + 1;
      v_streak := v_streak + 1;
      v_best_streak := greatest(v_best_streak, v_streak);
    else
      v_wrong := v_wrong + 1;
      v_streak := 0;
    end if;
  end loop;

  v_ticket_level := v_quiz.selected_level;
  if v_correct = 10 then
    v_draws := 10;
    v_reason := '全問正解';
  elsif v_best_streak >= 5 then
    v_draws := 5;
    v_reason := '五問以上の連続正解';
  elsif v_correct >= 7 then
    v_draws := 3;
    v_reason := '累計七問以上正解';
  elsif v_wrong >= 3 then
    v_ticket_level := greatest(1, v_quiz.selected_level - 1);
    v_reason := '三回目のミスによる救済';
  end if;

  v_current_tickets := coalesce((v_profile #>> array['gachaTickets', v_ticket_level::text])::integer, 0);
  v_profile := jsonb_set(v_profile, array['gachaTickets', v_ticket_level::text], to_jsonb(v_current_tickets + v_draws), true);
  v_previous_record := coalesce(v_profile #> array['quizRecords', v_quiz.selected_level::text], '{}'::jsonb);
  v_record := jsonb_build_object(
    'attempts', coalesce((v_previous_record ->> 'attempts')::integer, 0) + 1,
    'bestCorrect', greatest(coalesce((v_previous_record ->> 'bestCorrect')::integer, 0), v_correct),
    'bestStreak', greatest(coalesce((v_previous_record ->> 'bestStreak')::integer, 0), v_best_streak),
    'lastCorrect', v_correct,
    'lastWrong', v_wrong,
    'lastCompletedAt', now()
  );
  v_profile := jsonb_set(v_profile, array['quizRecords', v_quiz.selected_level::text], v_record, true);
  v_reward := jsonb_build_object('draws', v_draws, 'ticketLevel', v_ticket_level, 'reason', v_reason);

  update public.fcg_standard_profiles
  set revision = v_profile_revision + 1,
      profile_state = v_profile,
      updated_at = now()
  where user_id = p_user_id and revision = v_profile_revision;
  if not found then raise exception 'STALE_PROFILE_REVISION' using errcode = 'PT409'; end if;

  update fcg_private.standard_quiz_sessions
  set finish_action_id = p_finish_action_id,
      completed_at = now(),
      result = jsonb_build_object(
        'correct', v_correct,
        'wrong', v_wrong,
        'bestStreak', v_best_streak,
        'reward', v_reward
      )
  where session_id = p_session_id and completed_at is null;
  if not found then raise exception 'QUIZ_ALREADY_COMPLETED' using errcode = '23505'; end if;

  return query select v_profile_revision + 1, false, v_profile,
    v_correct, v_wrong, v_best_streak, v_reward;
end;
$$;

revoke all on function public.fcg_standard_server_start_quiz(uuid, uuid, uuid, text, integer, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function public.fcg_standard_server_finish_quiz(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_start_quiz(uuid, uuid, uuid, text, integer, jsonb, jsonb, timestamptz)
  to service_role;
grant execute on function public.fcg_standard_server_finish_quiz(uuid, uuid, uuid, jsonb)
  to service_role;
