-- Idempotent, server-authoritative cancellation for Standard rooms that have
-- not started. Room membership and match-adjacent records are retained so the
-- other participant can observe the terminal pregame state.

create table if not exists fcg_private.standard_pregame_abandon_receipts (
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  action_id uuid not null,
  actor_id uuid not null,
  expected_version bigint not null check (expected_version >= 0),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  accepted_at timestamptz not null default now(),
  primary key (room_id, action_id)
);

create index if not exists fcg_standard_pregame_abandon_receipts_actor_idx
  on fcg_private.standard_pregame_abandon_receipts (actor_id, accepted_at desc);

alter table fcg_private.standard_pregame_abandon_receipts enable row level security;
revoke all on table fcg_private.standard_pregame_abandon_receipts
  from public, anon, authenticated;

create or replace function public.fcg_standard_abandon_room(
  p_room_id uuid,
  p_expected_version bigint,
  p_action_id uuid
)
returns table (
  room_status text,
  room_version bigint,
  abandon_result text,
  duplicate boolean,
  server_time timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.fcg_rooms%rowtype;
  v_receipt fcg_private.standard_pregame_abandon_receipts%rowtype;
  v_member_id uuid;
  v_fingerprint text;
  v_result jsonb;
  v_accepted_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_room_id is null or p_action_id is null
      or p_expected_version is null or p_expected_version < 0 then
    raise exception 'invalid Standard pregame abandon request' using errcode = '22023';
  end if;

  v_fingerprint := encode(extensions.digest(
    jsonb_build_object(
      'operation', 'standard-pregame-abandon',
      'actor_id', v_user_id,
      'room_id', p_room_id,
      'expected_version', p_expected_version
    )::text,
    'sha256'
  ), 'hex');

  -- The room row is the serialization point shared with join, setup,
  -- initialize, action commit, rematch, and another abandon request.
  select room.* into v_room
  from public.fcg_rooms room
  where room.id = p_room_id
  for update;
  if not found then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_room.game_mode <> 'standard_v5' then
    raise exception 'STANDARD_PREGAME_ABANDON_NOT_ALLOWED' using errcode = '55000';
  end if;
  if not exists (
    select 1
    from public.fcg_room_members member
    where member.room_id = p_room_id and member.user_id = v_user_id
  ) then
    raise exception 'actor is not a member' using errcode = '42501';
  end if;

  select receipt.* into v_receipt
  from fcg_private.standard_pregame_abandon_receipts receipt
  where receipt.room_id = p_room_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.actor_id <> v_user_id
        or v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'pregame abandon action id reuse' using errcode = '23505';
    end if;
    return query select
      v_receipt.result->>'roomStatus',
      (v_receipt.result->>'roomVersion')::bigint,
      v_receipt.result->>'abandonResult',
      true,
      v_receipt.accepted_at;
    return;
  end if;

  -- A different action may arrive after the first participant already
  -- abandoned the room. Record a no-op receipt so either member can finish
  -- the same UI workflow without changing the terminal room a second time.
  if v_room.status = 'abandoned' then
    v_result := jsonb_build_object(
      'roomStatus', 'abandoned',
      'roomVersion', v_room.version,
      'abandonResult', 'already_abandoned'
    );
    v_accepted_at := statement_timestamp();
    insert into fcg_private.standard_pregame_abandon_receipts
      (room_id, action_id, actor_id, expected_version, request_fingerprint, result, accepted_at)
    values
      (p_room_id, p_action_id, v_user_id, p_expected_version, v_fingerprint, v_result, v_accepted_at);
    return query select 'abandoned'::text, v_room.version, 'already_abandoned'::text, false, v_accepted_at;
    return;
  end if;

  if v_room.status not in ('waiting', 'ready') then
    raise exception 'STANDARD_PREGAME_ABANDON_NOT_ALLOWED' using errcode = '55000';
  end if;
  if v_room.version <> p_expected_version then
    raise exception 'stale match version' using errcode = 'PT409';
  end if;

  -- Room-producing paths take the actor advisory lock before inspecting an
  -- existing room. Blocking here while holding the room row could deadlock
  -- against those paths, so acquire every participant with try-locks in UUID
  -- order and expose finite serialization failure for an unchanged retry.
  for v_member_id in
    select member.user_id
    from public.fcg_room_members member
    where member.room_id = p_room_id
    order by member.user_id
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended(v_member_id::text, 0)
    ) then
      raise exception 'STANDARD_ACTOR_BUSY' using errcode = '40001';
    end if;
  end loop;

  update public.fcg_rooms
  set status = 'abandoned',
      version = p_expected_version + 1,
      finished_at = now(),
      updated_at = now(),
      last_activity_at = now(),
      expires_at = now() + interval '24 hours'
  where id = p_room_id
    and status in ('waiting', 'ready')
    and version = p_expected_version;
  if not found then
    raise exception 'stale match version' using errcode = 'PT409';
  end if;

  v_result := jsonb_build_object(
    'roomStatus', 'abandoned',
    'roomVersion', p_expected_version + 1,
    'abandonResult', 'applied'
  );
  v_accepted_at := statement_timestamp();
  insert into fcg_private.standard_pregame_abandon_receipts
    (room_id, action_id, actor_id, expected_version, request_fingerprint, result, accepted_at)
  values
    (p_room_id, p_action_id, v_user_id, p_expected_version, v_fingerprint, v_result, v_accepted_at);

  return query select 'abandoned'::text, p_expected_version + 1,
    'applied'::text, false, v_accepted_at;
end;
$$;

revoke all on function public.fcg_standard_abandon_room(uuid, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_abandon_room(uuid, bigint, uuid)
  to authenticated;
