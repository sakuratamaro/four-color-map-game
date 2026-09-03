-- Four Color Map Game v5.0 Standard rematch handshake.
-- UNAPPLIED: additive only. A rematch starts only after both room members vote.

create table if not exists fcg_private.standard_rematch_votes (
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  user_id uuid not null,
  room_version bigint not null check (room_version >= 0),
  action_id uuid not null,
  requested_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, action_id)
);

create table if not exists fcg_private.standard_rematch_receipts (
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  action_id uuid not null,
  actor_id uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  accepted_at timestamptz not null default now(),
  primary key (room_id, action_id)
);

alter table fcg_private.standard_rematch_votes enable row level security;
alter table fcg_private.standard_rematch_receipts enable row level security;
revoke all on table fcg_private.standard_rematch_votes from public, anon, authenticated;
revoke all on table fcg_private.standard_rematch_receipts from public, anon, authenticated;

create or replace function public.fcg_standard_request_rematch(
  p_room_id uuid,
  p_expected_version bigint,
  p_action_id uuid
)
returns table (
  room_status text,
  room_version bigint,
  ready_to_setup boolean,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.fcg_rooms%rowtype;
  v_receipt fcg_private.standard_rematch_receipts%rowtype;
  v_fingerprint text;
  v_vote_count bigint;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_room_id is null or p_action_id is null or p_expected_version < 0 then
    raise exception 'invalid rematch request' using errcode = '22023';
  end if;
  v_fingerprint := encode(extensions.digest(
    v_user_id::text || ':' || p_room_id::text || ':' || p_expected_version::text,
    'sha256'
  ), 'hex');

  select room.* into v_room
  from public.fcg_rooms room
  where room.id = p_room_id
  for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;

  select receipt.* into v_receipt
  from fcg_private.standard_rematch_receipts receipt
  where receipt.room_id = p_room_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.actor_id <> v_user_id or v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'rematch action id reuse' using errcode = '23505';
    end if;
    return query select
      v_receipt.result->>'roomStatus',
      (v_receipt.result->>'roomVersion')::bigint,
      (v_receipt.result->>'readyToSetup')::boolean,
      true;
    return;
  end if;

  if v_room.game_mode <> 'standard_v5' or v_room.status <> 'finished' then
    raise exception 'Standard room is not finished' using errcode = '55000';
  end if;
  if v_room.version <> p_expected_version then
    raise exception 'stale match version' using errcode = 'PT409';
  end if;
  if not exists (
    select 1 from public.fcg_room_members member
    where member.room_id = p_room_id and member.user_id = v_user_id
  ) then
    raise exception 'actor is not a member' using errcode = '42501';
  end if;

  insert into fcg_private.standard_rematch_votes
    (room_id, user_id, room_version, action_id)
  values (p_room_id, v_user_id, p_expected_version, p_action_id)
  on conflict (room_id, user_id) do update
  set room_version = excluded.room_version,
      action_id = excluded.action_id,
      requested_at = now();

  select count(*) into v_vote_count
  from fcg_private.standard_rematch_votes vote
  join public.fcg_room_members member
    on member.room_id = vote.room_id and member.user_id = vote.user_id
  where vote.room_id = p_room_id and vote.room_version = p_expected_version;

  if v_vote_count < 2 then
    v_result := jsonb_build_object(
      'roomStatus', 'finished',
      'roomVersion', p_expected_version,
      'readyToSetup', false
    );
  else
    delete from fcg_private.standard_room_setups where room_id = p_room_id;
    delete from public.fcg_player_views where room_id = p_room_id;
    delete from fcg_private.authoritative_matches
    where room_id = p_room_id and game_mode = 'standard_v5';

    update public.fcg_rooms
    set status = 'ready',
        version = p_expected_version + 1,
        public_state = null,
        winner_seat = null,
        started_at = null,
        finished_at = null,
        updated_at = now(),
        last_activity_at = now(),
        expires_at = now() + interval '24 hours'
    where id = p_room_id and status = 'finished' and version = p_expected_version;
    if not found then raise exception 'stale match version' using errcode = 'PT409'; end if;

    delete from fcg_private.standard_rematch_votes where room_id = p_room_id;
    v_result := jsonb_build_object(
      'roomStatus', 'ready',
      'roomVersion', p_expected_version + 1,
      'readyToSetup', true
    );
  end if;

  insert into fcg_private.standard_rematch_receipts
    (room_id, action_id, actor_id, request_fingerprint, result)
  values (p_room_id, p_action_id, v_user_id, v_fingerprint, v_result);

  return query select
    v_result->>'roomStatus',
    (v_result->>'roomVersion')::bigint,
    (v_result->>'readyToSetup')::boolean,
    false;
end;
$$;

revoke all on function public.fcg_standard_request_rematch(uuid, bigint, uuid)
  from public, anon;
grant execute on function public.fcg_standard_request_rematch(uuid, bigint, uuid)
  to authenticated;
