-- Use an application-level conflict status for optimistic-version misses.
-- SQLSTATE 40001 is reserved for retryable transaction serialization failures;
-- PostgREST maps the explicit PT409 code to HTTP 409 without classifying the
-- request as a database transaction rollback.

create or replace function public.fcg_server_commit_action(
  p_room_id uuid,
  p_actor_id uuid,
  p_action_id uuid,
  p_expected_version bigint,
  p_action_type text,
  p_authoritative_state jsonb,
  p_public_state jsonb,
  p_private_a jsonb,
  p_private_b jsonb,
  p_result jsonb,
  p_finished boolean default false,
  p_winner_seat text default null
)
returns table (new_version bigint, duplicate boolean, action_result jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.fcg_rooms%rowtype;
  v_receipt fcg_private.action_receipts%rowtype;
  v_a uuid;
  v_b uuid;
begin
  select receipt.* into v_receipt
  from fcg_private.action_receipts receipt
  where receipt.room_id = p_room_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.actor_id <> p_actor_id then raise exception 'action id belongs to another actor' using errcode = '23505'; end if;
    return query select (v_receipt.result->>'version')::bigint, true, v_receipt.result;
    return;
  end if;

  select room.* into v_room from public.fcg_rooms room where room.id = p_room_id for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;

  -- Re-check after acquiring the room lock so simultaneous retries of the same
  -- action id deterministically receive the first committed result.
  select receipt.* into v_receipt
  from fcg_private.action_receipts receipt
  where receipt.room_id = p_room_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.actor_id <> p_actor_id then raise exception 'action id belongs to another actor' using errcode = '23505'; end if;
    return query select (v_receipt.result->>'version')::bigint, true, v_receipt.result;
    return;
  end if;

  if v_room.status <> 'playing' then raise exception 'room is not active' using errcode = '55000'; end if;
  if v_room.version <> p_expected_version then raise exception 'stale match version' using errcode = 'PT409'; end if;
  if not exists (
    select 1 from public.fcg_room_members member
    where member.room_id = p_room_id and member.user_id = p_actor_id
  ) then raise exception 'actor is not a member' using errcode = '42501'; end if;
  if p_finished and p_winner_seat not in ('A', 'B') then raise exception 'winner seat required' using errcode = '22023'; end if;

  select user_id into v_a from public.fcg_room_members where room_id = p_room_id and seat = 'A';
  select user_id into v_b from public.fcg_room_members where room_id = p_room_id and seat = 'B';

  update fcg_private.authoritative_matches
  set version = p_expected_version + 1, state = p_authoritative_state, updated_at = now()
  where room_id = p_room_id and version = p_expected_version;
  if not found then raise exception 'stale authoritative version' using errcode = 'PT409'; end if;

  update public.fcg_player_views
  set version = p_expected_version + 1,
      private_state = case when seat = 'A' then p_private_a else p_private_b end,
      updated_at = now()
  where room_id = p_room_id and user_id in (v_a, v_b);

  update public.fcg_rooms
  set version = p_expected_version + 1,
      public_state = p_public_state,
      status = case when p_finished then 'finished' else 'playing' end,
      winner_seat = case when p_finished then p_winner_seat else null end,
      finished_at = case when p_finished then now() else null end,
      updated_at = now(), last_activity_at = now(), expires_at = now() + interval '24 hours'
  where id = p_room_id;

  insert into fcg_private.action_receipts
    (room_id, action_id, actor_id, expected_version, action_type, result)
  values
    (p_room_id, p_action_id, p_actor_id, p_expected_version, p_action_type,
     p_result || jsonb_build_object('version', p_expected_version + 1));

  return query select p_expected_version + 1, false,
    p_result || jsonb_build_object('version', p_expected_version + 1);
end;
$$;

revoke all on function public.fcg_server_commit_action(
  uuid, uuid, uuid, bigint, text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean, text
) from public, anon, authenticated;

grant execute on function public.fcg_server_commit_action(
  uuid, uuid, uuid, bigint, text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean, text
) to service_role;

