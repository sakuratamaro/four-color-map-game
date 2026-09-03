-- Consent-preserving public Standard matchmaking. No ticket list is exposed.

alter table public.fcg_rooms
  add column if not exists access_mode text not null default 'private_code',
  add column if not exists opponent_kind text not null default 'human';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fcg_rooms_access_mode_check'
      and conrelid = 'public.fcg_rooms'::regclass
  ) then
    alter table public.fcg_rooms add constraint fcg_rooms_access_mode_check
      check (access_mode in ('private_code', 'public_queue', 'cpu'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'fcg_rooms_opponent_kind_check'
      and conrelid = 'public.fcg_rooms'::regclass
  ) then
    alter table public.fcg_rooms add constraint fcg_rooms_opponent_kind_check
      check (opponent_kind in ('human', 'cpu'));
  end if;
end
$$;

create table if not exists fcg_private.standard_matchmaking_tickets (
  ticket_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  profile_revision bigint not null check (profile_revision >= 1),
  state text not null check (state in ('searching', 'claimed', 'cancelled', 'expired')),
  room_id uuid,
  created_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz,
  check ((state = 'claimed') = (room_id is not null))
);

create unique index if not exists fcg_standard_matchmaking_one_search_per_user
  on fcg_private.standard_matchmaking_tickets (user_id) where state = 'searching';
create index if not exists fcg_standard_matchmaking_oldest_search
  on fcg_private.standard_matchmaking_tickets (created_at, ticket_id) where state = 'searching';

create table if not exists fcg_private.standard_matchmaking_find_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null,
  action_fingerprint text not null check (action_fingerprint ~ '^[0-9a-f]{64}$'),
  result_status text not null check (result_status in ('matched', 'none_available')),
  room_id uuid,
  seat text check (seat in ('A', 'B')),
  created_at timestamptz not null default now(),
  primary key (user_id, action_id),
  check ((result_status = 'matched') = (room_id is not null and seat is not null))
);

create table if not exists fcg_private.standard_matchmaking_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table fcg_private.standard_matchmaking_tickets enable row level security;
alter table fcg_private.standard_matchmaking_find_receipts enable row level security;
alter table fcg_private.standard_matchmaking_limits enable row level security;
revoke all on table fcg_private.standard_matchmaking_tickets from public, anon, authenticated;
revoke all on table fcg_private.standard_matchmaking_find_receipts from public, anon, authenticated;
revoke all on table fcg_private.standard_matchmaking_limits from public, anon, authenticated;

create or replace function fcg_private.fcg_standard_matchmaking_rate_limited(p_user_id uuid)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_limit fcg_private.standard_matchmaking_limits%rowtype;
begin
  insert into fcg_private.standard_matchmaking_limits (user_id)
  values (p_user_id) on conflict (user_id) do nothing;
  select limits.* into v_limit from fcg_private.standard_matchmaking_limits limits
  where limits.user_id = p_user_id for update;
  if v_limit.blocked_until is not null and v_limit.blocked_until > now() then return true; end if;
  if v_limit.window_started_at <= now() - interval '1 minute' then
    update fcg_private.standard_matchmaking_limits
    set window_started_at = now(), request_count = 1, blocked_until = null, updated_at = now()
    where user_id = p_user_id;
    return false;
  end if;
  if v_limit.request_count >= 60 then
    update fcg_private.standard_matchmaking_limits
    set blocked_until = now() + interval '1 minute', updated_at = now()
    where user_id = p_user_id;
    return true;
  end if;
  update fcg_private.standard_matchmaking_limits
  set request_count = request_count + 1, updated_at = now() where user_id = p_user_id;
  return false;
end;
$$;

revoke all on function fcg_private.fcg_standard_matchmaking_rate_limited(uuid)
  from public, anon, authenticated;

create or replace function public.fcg_standard_matchmaking_recruit(
  p_ticket_id uuid,
  p_display_name text
)
returns table (ticket_id uuid, matchmaking_status text, room_id uuid, seat text, wait_started_at timestamptz, server_time timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
  v_profile_revision bigint;
  v_ticket fcg_private.standard_matchmaking_tickets%rowtype;
  v_room_id uuid;
  v_seat text;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_ticket_id is null or char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'invalid matchmaking recruit' using errcode = '22023';
  end if;
  if fcg_private.fcg_standard_matchmaking_rate_limited(v_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select room.id, member.seat into v_room_id, v_seat
  from public.fcg_room_members member join public.fcg_rooms room on room.id = member.room_id
  where member.user_id = v_user_id and room.game_mode = 'standard_v5'
    and room.status in ('waiting', 'ready', 'playing') and room.expires_at > now()
  order by room.created_at desc limit 1;
  if v_room_id is not null then
    return query select null::uuid, 'matched'::text, v_room_id, v_seat, null::timestamptz, now();
    return;
  end if;

  select ticket.* into v_ticket from fcg_private.standard_matchmaking_tickets ticket
  where ticket.ticket_id = p_ticket_id and ticket.user_id = v_user_id for update;
  if found then
    if v_ticket.state = 'searching' and v_ticket.expires_at > now() then
      update fcg_private.standard_matchmaking_tickets ticket
      set display_name = v_name, heartbeat_at = now(), expires_at = now() + interval '2 minutes'
      where ticket.ticket_id = p_ticket_id;
      return query select p_ticket_id, 'searching'::text, null::uuid, null::text, v_ticket.created_at, now();
      return;
    end if;
    if v_ticket.state = 'claimed' then
      return query select p_ticket_id, 'matched'::text, v_ticket.room_id, 'A'::text, v_ticket.created_at, now();
      return;
    end if;
    if v_ticket.state = 'searching' then
      update fcg_private.standard_matchmaking_tickets ticket
      set state = 'expired', resolved_at = now() where ticket.ticket_id = p_ticket_id;
      v_ticket.state := 'expired';
    end if;
    return query select p_ticket_id, v_ticket.state, null::uuid, null::text, v_ticket.created_at, now();
    return;
  end if;

  update fcg_private.standard_matchmaking_tickets ticket
  set state = 'expired', resolved_at = now()
  where ticket.user_id = v_user_id and ticket.state = 'searching' and ticket.expires_at <= now();
  if exists (
    select 1 from fcg_private.standard_matchmaking_tickets ticket
    where ticket.user_id = v_user_id and ticket.state = 'searching'
  ) then
    raise exception 'another matchmaking ticket is active' using errcode = '23505';
  end if;
  select profile.revision into v_profile_revision from public.fcg_standard_profiles profile
  where profile.user_id = v_user_id;
  if not found then raise exception 'standard profile required' using errcode = 'P0002'; end if;
  insert into fcg_private.standard_matchmaking_tickets
    (ticket_id, user_id, display_name, profile_revision, state, expires_at)
  values (p_ticket_id, v_user_id, v_name, v_profile_revision, 'searching', now() + interval '2 minutes')
  returning created_at into v_ticket.created_at;
  return query select p_ticket_id, 'searching'::text, null::uuid, null::text, v_ticket.created_at, now();
end;
$$;

create or replace function public.fcg_standard_matchmaking_find(
  p_action_id uuid,
  p_display_name text
)
returns table (matchmaking_status text, room_id uuid, seat text, server_time timestamptz, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
  v_fingerprint text;
  v_receipt fcg_private.standard_matchmaking_find_receipts%rowtype;
  v_candidate fcg_private.standard_matchmaking_tickets%rowtype;
  v_room_id uuid;
  v_code text;
  v_attempt integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_action_id is null or char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'invalid matchmaking find' using errcode = '22023';
  end if;
  if fcg_private.fcg_standard_matchmaking_rate_limited(v_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  v_fingerprint := encode(extensions.digest(v_name, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select receipt.* into v_receipt from fcg_private.standard_matchmaking_find_receipts receipt
  where receipt.user_id = v_user_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.action_fingerprint <> v_fingerprint then
      raise exception 'matchmaking action ID reused with different input' using errcode = '23505';
    end if;
    return query select v_receipt.result_status, v_receipt.room_id, v_receipt.seat, now(), true;
    return;
  end if;
  if exists (
    select 1 from public.fcg_room_members member join public.fcg_rooms room on room.id = member.room_id
    where member.user_id = v_user_id and room.game_mode = 'standard_v5'
      and room.status in ('waiting', 'ready', 'playing') and room.expires_at > now()
  ) then
    raise exception 'MATCHMAKING_ALREADY_IN_ROOM' using errcode = '55000';
  end if;
  if exists (
    select 1 from fcg_private.standard_matchmaking_tickets ticket
    where ticket.user_id = v_user_id and ticket.state = 'searching' and ticket.expires_at > now()
  ) then
    raise exception 'MATCHMAKING_OWN_SEARCH_ACTIVE' using errcode = '55000';
  end if;
  if not exists (select 1 from public.fcg_standard_profiles profile where profile.user_id = v_user_id) then
    raise exception 'standard profile required' using errcode = 'P0002';
  end if;

  select ticket.* into v_candidate
  from fcg_private.standard_matchmaking_tickets ticket
  where ticket.state = 'searching' and ticket.expires_at > now() and ticket.user_id <> v_user_id
    and not exists (
      select 1 from public.fcg_room_members member join public.fcg_rooms room on room.id = member.room_id
      where member.user_id = ticket.user_id and room.game_mode = 'standard_v5'
        and room.status in ('waiting', 'ready', 'playing') and room.expires_at > now()
    )
  order by ticket.created_at, ticket.ticket_id
  limit 1 for update skip locked;

  if not found then
    insert into fcg_private.standard_matchmaking_find_receipts
      (user_id, action_id, action_fingerprint, result_status)
    values (v_user_id, p_action_id, v_fingerprint, 'none_available');
    return query select 'none_available'::text, null::uuid, null::text, now(), false;
    return;
  end if;

  for v_attempt in 1..12 loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
    begin
      insert into public.fcg_rooms (code_hash, host_user_id, game_mode, access_mode, opponent_kind, status, expires_at)
      values (encode(extensions.digest(v_code, 'sha256'), 'hex'), v_candidate.user_id, 'standard_v5', 'public_queue', 'human', 'ready', now() + interval '24 hours')
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      v_room_id := null;
    end;
  end loop;
  if v_room_id is null then raise exception 'could not allocate matchmaking room' using errcode = 'P0001'; end if;

  insert into public.fcg_room_members (room_id, user_id, seat, display_name)
  values (v_room_id, v_candidate.user_id, 'A', v_candidate.display_name),
         (v_room_id, v_user_id, 'B', v_name);
  update fcg_private.standard_matchmaking_tickets ticket
  set state = 'claimed', room_id = v_room_id, resolved_at = now(), heartbeat_at = now()
  where ticket.ticket_id = v_candidate.ticket_id and ticket.state = 'searching';
  if not found then raise exception 'matchmaking ticket already resolved' using errcode = '40001'; end if;
  insert into fcg_private.standard_matchmaking_find_receipts
    (user_id, action_id, action_fingerprint, result_status, room_id, seat)
  values (v_user_id, p_action_id, v_fingerprint, 'matched', v_room_id, 'B');
  return query select 'matched'::text, v_room_id, 'B'::text, now(), false;
end;
$$;

create or replace function public.fcg_standard_matchmaking_status(p_ticket_id uuid)
returns table (ticket_id uuid, matchmaking_status text, room_id uuid, seat text, wait_started_at timestamptz, server_time timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ticket fcg_private.standard_matchmaking_tickets%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_ticket_id is null then raise exception 'invalid matchmaking ticket' using errcode = '22023'; end if;
  if fcg_private.fcg_standard_matchmaking_rate_limited(v_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  select ticket.* into v_ticket from fcg_private.standard_matchmaking_tickets ticket
  where ticket.ticket_id = p_ticket_id and ticket.user_id = v_user_id for update;
  if not found then return query select p_ticket_id, 'expired'::text, null::uuid, null::text, null::timestamptz, now(); return; end if;
  if v_ticket.state = 'searching' and v_ticket.expires_at <= now() then
    update fcg_private.standard_matchmaking_tickets ticket set state = 'expired', resolved_at = now()
    where ticket.ticket_id = p_ticket_id;
    v_ticket.state := 'expired';
  elsif v_ticket.state = 'searching' then
    update fcg_private.standard_matchmaking_tickets ticket
    set heartbeat_at = now(), expires_at = now() + interval '2 minutes' where ticket.ticket_id = p_ticket_id;
  end if;
  return query select p_ticket_id, v_ticket.state,
    case when v_ticket.state = 'claimed' then v_ticket.room_id else null end,
    case when v_ticket.state = 'claimed' then 'A'::text else null::text end,
    v_ticket.created_at, now();
end;
$$;

create or replace function public.fcg_standard_matchmaking_cancel(p_ticket_id uuid)
returns table (ticket_id uuid, matchmaking_status text, room_id uuid, seat text, server_time timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ticket fcg_private.standard_matchmaking_tickets%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_ticket_id is null then raise exception 'invalid matchmaking ticket' using errcode = '22023'; end if;
  if fcg_private.fcg_standard_matchmaking_rate_limited(v_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  select ticket.* into v_ticket from fcg_private.standard_matchmaking_tickets ticket
  where ticket.ticket_id = p_ticket_id and ticket.user_id = v_user_id for update;
  if not found then return query select p_ticket_id, 'expired'::text, null::uuid, null::text, now(); return; end if;
  if v_ticket.state = 'claimed' then
    return query select p_ticket_id, 'matched'::text, v_ticket.room_id, 'A'::text, now();
    return;
  end if;
  if v_ticket.state = 'searching' then
    update fcg_private.standard_matchmaking_tickets ticket
    set state = 'cancelled', resolved_at = now(), heartbeat_at = now()
    where ticket.ticket_id = p_ticket_id;
    v_ticket.state := 'cancelled';
  end if;
  return query select p_ticket_id, v_ticket.state, null::uuid, null::text, now();
end;
$$;

revoke all on function public.fcg_standard_matchmaking_recruit(uuid, text) from public, anon;
revoke all on function public.fcg_standard_matchmaking_find(uuid, text) from public, anon;
revoke all on function public.fcg_standard_matchmaking_status(uuid) from public, anon;
revoke all on function public.fcg_standard_matchmaking_cancel(uuid) from public, anon;
grant execute on function public.fcg_standard_matchmaking_recruit(uuid, text) to authenticated;
grant execute on function public.fcg_standard_matchmaking_find(uuid, text) to authenticated;
grant execute on function public.fcg_standard_matchmaking_status(uuid) to authenticated;
grant execute on function public.fcg_standard_matchmaking_cancel(uuid) to authenticated;

-- Extend the already member-scoped snapshot with non-secret opponent labels so
-- public rooms never need to expose or synthesize an invitation code.
create or replace function public.fcg_standard_room_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_snapshot jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_room_id is null then raise exception 'room id required' using errcode = '22023'; end if;
  select jsonb_build_object(
    'snapshot_schema_version', 1,
    'snapshot_version', room.version,
    'server_time', statement_timestamp(),
    'room', jsonb_build_object(
      'id', room.id, 'status', room.status, 'version', room.version,
      'game_mode', room.game_mode, 'access_mode', room.access_mode,
      'opponent_kind', room.opponent_kind, 'public_state', room.public_state,
      'winner_seat', room.winner_seat, 'expires_at', room.expires_at
    ),
    'members', members.value,
    'view', player_view.value,
    'profile', profile.value
  ) into v_snapshot
  from public.fcg_rooms room
  join public.fcg_room_members actor on actor.room_id = room.id and actor.user_id = v_user_id
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', member.user_id, 'seat', member.seat,
      'display_name', member.display_name, 'last_seen_at', member.last_seen_at
    ) order by member.seat), '[]'::jsonb) as value
    from public.fcg_room_members member where member.room_id = room.id
  ) members
  left join lateral (
    select jsonb_build_object('seat', own_view.seat, 'version', own_view.version, 'private_state', own_view.private_state) as value
    from public.fcg_player_views own_view
    where own_view.room_id = room.id and own_view.user_id = v_user_id
  ) player_view on true
  left join lateral (
    select jsonb_build_object('revision', own_profile.revision, 'display_name', own_profile.display_name, 'profile_state', own_profile.profile_state) as value
    from public.fcg_standard_profiles own_profile where own_profile.user_id = v_user_id
  ) profile on true
  where room.id = p_room_id and room.game_mode = 'standard_v5';
  if v_snapshot is null then raise exception 'room not found or caller is not a member' using errcode = 'P0002'; end if;
  return v_snapshot;
end;
$$;

revoke all on function public.fcg_standard_room_snapshot(uuid) from public, anon;
grant execute on function public.fcg_standard_room_snapshot(uuid) to authenticated;
