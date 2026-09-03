-- Four Color Map Game v5.0 public-alpha hardening.
-- The already-applied 202608280001 migration remains immutable.

-- DELETE events are not filtered through RLS by Postgres Changes. Keep only
-- the non-secret room invalidation row in Realtime and fetch member/private
-- projections through their existing SELECT policies after each room update.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fcg_room_members'
  ) then
    alter publication supabase_realtime drop table public.fcg_room_members;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fcg_player_views'
  ) then
    alter publication supabase_realtime drop table public.fcg_player_views;
  end if;
end
$$;

alter table public.fcg_rooms replica identity default;
alter table public.fcg_room_members replica identity default;
alter table public.fcg_player_views replica identity default;

create table if not exists fcg_private.join_attempt_limits (
  user_id uuid primary key,
  window_started_at timestamptz not null default now(),
  failure_count integer not null default 0 check (failure_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table fcg_private.join_attempt_limits enable row level security;
revoke all on table fcg_private.join_attempt_limits from public, anon, authenticated;

create or replace function fcg_private.fcg_record_join_failure(p_user_id uuid)
returns boolean
language sql
volatile
set search_path = ''
as $$
  update fcg_private.join_attempt_limits
  set
    failure_count = case
      when window_started_at <= now() - interval '15 minutes' then 1
      else failure_count + 1
    end,
    window_started_at = case
      when window_started_at <= now() - interval '15 minutes' then now()
      else window_started_at
    end,
    blocked_until = case
      when (
        case when window_started_at <= now() - interval '15 minutes' then 1 else failure_count + 1 end
      ) >= 20 then now() + interval '15 minutes'
      else null
    end,
    updated_at = now()
  where user_id = p_user_id
  returning blocked_until > now();
$$;

revoke all on function fcg_private.fcg_record_join_failure(uuid) from public, anon, authenticated;

create or replace function public.fcg_create_room(p_display_name text)
returns table (room_id uuid, room_code text, seat text, room_status text, room_version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
  v_code text;
  v_room_id uuid;
  v_attempt integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'display name must be 1 to 20 characters' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  if (
    select count(*)
    from public.fcg_rooms room
    where room.host_user_id = v_user_id
      and room.status in ('waiting', 'ready', 'playing')
      and room.expires_at > now()
  ) >= 3 then
    raise exception 'active room limit reached' using errcode = '54000';
  end if;

  for v_attempt in 1..12 loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
    begin
      insert into public.fcg_rooms (code_hash, host_user_id)
      values (encode(extensions.digest(v_code, 'sha256'), 'hex'), v_user_id)
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      v_room_id := null;
    end;
  end loop;

  if v_room_id is null then raise exception 'could not allocate room code' using errcode = 'P0001'; end if;

  insert into public.fcg_room_members (room_id, user_id, seat, display_name)
  values (v_room_id, v_user_id, 'A', v_name);

  return query select v_room_id, v_code, 'A'::text, 'waiting'::text, 0::bigint;
end;
$$;

create or replace function public.fcg_join_room(p_room_code text, p_display_name text)
returns table (room_id uuid, seat text, room_status text, room_version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
  v_code text := upper(regexp_replace(coalesce(p_room_code, ''), '\s+', '', 'g'));
  v_room public.fcg_rooms%rowtype;
  v_existing_seat text;
  v_limit fcg_private.join_attempt_limits%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'display name must be 1 to 20 characters' using errcode = '22023';
  end if;

  insert into fcg_private.join_attempt_limits (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select attempt.* into v_limit
  from fcg_private.join_attempt_limits attempt
  where attempt.user_id = v_user_id
  for update;

  if v_limit.blocked_until is not null and v_limit.blocked_until > now() then
    return query select null::uuid, 'ERROR_RATE_LIMIT'::text, 'rate_limited'::text, 0::bigint;
    return;
  end if;

  if v_limit.window_started_at <= now() - interval '15 minutes' then
    update fcg_private.join_attempt_limits
    set window_started_at = now(), failure_count = 0, blocked_until = null, updated_at = now()
    where user_id = v_user_id;
  end if;

  if v_code !~ '^[0-9A-F]{6}$' then
    perform fcg_private.fcg_record_join_failure(v_user_id);
    return query select null::uuid, 'ERROR_JOIN_FAILED'::text, 'join_failed'::text, 0::bigint;
    return;
  end if;

  select room.* into v_room
  from public.fcg_rooms room
  where room.code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
  for update;

  if not found or v_room.expires_at <= now() then
    perform fcg_private.fcg_record_join_failure(v_user_id);
    return query select null::uuid, 'ERROR_JOIN_FAILED'::text, 'join_failed'::text, 0::bigint;
    return;
  end if;

  select member.seat into v_existing_seat
  from public.fcg_room_members member
  where member.room_id = v_room.id and member.user_id = v_user_id;

  if v_existing_seat is not null then
    update public.fcg_room_members member
    set last_seen_at = now()
    where member.room_id = v_room.id and member.user_id = v_user_id;
    update fcg_private.join_attempt_limits
    set failure_count = 0, window_started_at = now(), blocked_until = null, updated_at = now()
    where user_id = v_user_id;
    return query select v_room.id, v_existing_seat, v_room.status, v_room.version;
    return;
  end if;

  if v_room.status <> 'waiting' or exists (
    select 1 from public.fcg_room_members member where member.room_id = v_room.id and member.seat = 'B'
  ) then
    perform fcg_private.fcg_record_join_failure(v_user_id);
    return query select null::uuid, 'ERROR_JOIN_FAILED'::text, 'join_failed'::text, 0::bigint;
    return;
  end if;

  insert into public.fcg_room_members (room_id, user_id, seat, display_name)
  values (v_room.id, v_user_id, 'B', v_name);

  update public.fcg_rooms
  set status = 'ready', updated_at = now(), last_activity_at = now(), expires_at = now() + interval '24 hours'
  where id = v_room.id;

  update fcg_private.join_attempt_limits
  set failure_count = 0, window_started_at = now(), blocked_until = null, updated_at = now()
  where user_id = v_user_id;

  return query select v_room.id, 'B'::text, 'ready'::text, v_room.version;
end;
$$;

revoke all on function public.fcg_create_room(text) from public, anon;
revoke all on function public.fcg_join_room(text, text) from public, anon;
grant execute on function public.fcg_create_room(text) to authenticated;
grant execute on function public.fcg_join_room(text, text) to authenticated;
