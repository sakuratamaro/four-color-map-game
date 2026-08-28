-- Four Color Map Game v5.0: additive online quick-match foundation.
-- Idempotent by object name. This migration never drops unrelated objects.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists fcg_private;

create table if not exists public.fcg_rooms (
  id uuid primary key default extensions.gen_random_uuid(),
  code_hash text not null unique,
  host_user_id uuid not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'ready', 'playing', 'finished', 'abandoned')),
  version bigint not null default 0 check (version >= 0),
  public_state jsonb not null default '{}'::jsonb,
  winner_seat text check (winner_seat is null or winner_seat in ('A', 'B')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.fcg_room_members (
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  user_id uuid not null,
  seat text not null check (seat in ('A', 'B')),
  display_name text not null check (char_length(display_name) between 1 and 20),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

-- This is a browser-readable projection containing only the row owner's secrets.
-- The complete authoritative state is kept outside the exposed public schema.
create table if not exists public.fcg_player_views (
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  user_id uuid not null,
  seat text not null check (seat in ('A', 'B')),
  version bigint not null default 0 check (version >= 0),
  private_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create table if not exists fcg_private.authoritative_matches (
  room_id uuid primary key references public.fcg_rooms(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists fcg_private.action_receipts (
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  action_id uuid not null,
  actor_id uuid not null,
  expected_version bigint not null check (expected_version >= 0),
  action_type text not null,
  result jsonb not null,
  accepted_at timestamptz not null default now(),
  primary key (room_id, action_id)
);

create index if not exists fcg_rooms_status_expiry_idx
  on public.fcg_rooms (status, expires_at);
create index if not exists fcg_rooms_activity_idx
  on public.fcg_rooms (last_activity_at);
create index if not exists fcg_members_user_idx
  on public.fcg_room_members (user_id, room_id);
create index if not exists fcg_player_views_user_idx
  on public.fcg_player_views (user_id, room_id);
create index if not exists fcg_receipts_actor_idx
  on fcg_private.action_receipts (actor_id, accepted_at desc);

alter table public.fcg_rooms enable row level security;
alter table public.fcg_room_members enable row level security;
alter table public.fcg_player_views enable row level security;
alter table public.fcg_rooms replica identity full;
alter table public.fcg_room_members replica identity full;
alter table public.fcg_player_views replica identity full;

create or replace function public.fcg_is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fcg_room_members member
    where member.room_id = p_room_id
      and member.user_id = (select auth.uid())
  );
$$;

revoke all on function public.fcg_is_room_member(uuid) from public;
grant execute on function public.fcg_is_room_member(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fcg_rooms'
      and policyname = 'fcg_rooms_member_select'
  ) then
    create policy fcg_rooms_member_select on public.fcg_rooms
      for select to authenticated
      using ((select public.fcg_is_room_member(id)));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fcg_room_members'
      and policyname = 'fcg_members_member_select'
  ) then
    create policy fcg_members_member_select on public.fcg_room_members
      for select to authenticated
      using ((select public.fcg_is_room_member(room_id)));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fcg_player_views'
      and policyname = 'fcg_player_views_owner_select'
  ) then
    create policy fcg_player_views_owner_select on public.fcg_player_views
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$$;

revoke all on table public.fcg_rooms from anon, authenticated;
revoke all on table public.fcg_room_members from anon, authenticated;
revoke all on table public.fcg_player_views from anon, authenticated;
grant select on table public.fcg_rooms to authenticated;
grant select on table public.fcg_room_members to authenticated;
grant select on table public.fcg_player_views to authenticated;

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
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 20 then
    raise exception 'display name must be 1 to 20 characters' using errcode = '22023';
  end if;
  if v_code !~ '^[0-9A-F]{6}$' then raise exception 'invalid room code' using errcode = '22023'; end if;

  select room.* into v_room
  from public.fcg_rooms room
  where room.code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
  for update;

  if not found or v_room.expires_at <= now() then raise exception 'room not found' using errcode = 'P0002'; end if;

  select member.seat into v_existing_seat
  from public.fcg_room_members member
  where member.room_id = v_room.id and member.user_id = v_user_id;

  if v_existing_seat is not null then
    update public.fcg_room_members set last_seen_at = now()
    where fcg_room_members.room_id = v_room.id and user_id = v_user_id;
    return query select v_room.id, v_existing_seat, v_room.status, v_room.version;
    return;
  end if;

  if v_room.status <> 'waiting' then raise exception 'room is not joinable' using errcode = '55000'; end if;
  if exists (select 1 from public.fcg_room_members member where member.room_id = v_room.id and member.seat = 'B') then
    raise exception 'room is full' using errcode = '55000';
  end if;

  insert into public.fcg_room_members (room_id, user_id, seat, display_name)
  values (v_room.id, v_user_id, 'B', v_name);

  update public.fcg_rooms
  set status = 'ready', updated_at = now(), last_activity_at = now(), expires_at = now() + interval '24 hours'
  where id = v_room.id;

  return query select v_room.id, 'B'::text, 'ready'::text, v_room.version;
end;
$$;

revoke all on function public.fcg_create_room(text) from public;
revoke all on function public.fcg_join_room(text, text) from public;
grant execute on function public.fcg_create_room(text) to authenticated;
grant execute on function public.fcg_join_room(text, text) to authenticated;

-- Edge Function-only RPCs. Their values are safe to declare in source; the
-- service_role credential itself remains an environment secret and is never stored here.
create or replace function public.fcg_server_initialize_room(
  p_room_id uuid,
  p_authoritative_state jsonb,
  p_public_state jsonb,
  p_private_a jsonb,
  p_private_b jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a uuid;
  v_b uuid;
  v_status text;
begin
  select room.status into v_status from public.fcg_rooms room where room.id = p_room_id for update;
  if v_status is null then raise exception 'room not found' using errcode = 'P0002'; end if;
  if v_status not in ('ready', 'playing') then raise exception 'room is not ready' using errcode = '55000'; end if;
  select user_id into v_a from public.fcg_room_members where room_id = p_room_id and seat = 'A';
  select user_id into v_b from public.fcg_room_members where room_id = p_room_id and seat = 'B';
  if v_a is null or v_b is null then raise exception 'two players required' using errcode = '55000'; end if;

  insert into fcg_private.authoritative_matches (room_id, version, state)
  values (p_room_id, 0, p_authoritative_state)
  on conflict (room_id) do nothing;

  insert into public.fcg_player_views (room_id, user_id, seat, version, private_state)
  values (p_room_id, v_a, 'A', 0, p_private_a), (p_room_id, v_b, 'B', 0, p_private_b)
  on conflict (room_id, user_id) do nothing;

  update public.fcg_rooms
  set status = 'playing', version = 0, public_state = p_public_state,
      started_at = coalesce(started_at, now()), updated_at = now(), last_activity_at = now(),
      expires_at = now() + interval '24 hours'
  where id = p_room_id and status = 'ready';
end;
$$;

create or replace function public.fcg_server_load_room(p_room_id uuid, p_actor_id uuid)
returns table (
  room_status text,
  room_version bigint,
  actor_seat text,
  authoritative_state jsonb,
  action_public_state jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select room.status, room.version, member.seat, authority.state, room.public_state
  from public.fcg_rooms room
  join public.fcg_room_members member on member.room_id = room.id and member.user_id = p_actor_id
  left join fcg_private.authoritative_matches authority on authority.room_id = room.id
  where room.id = p_room_id;
$$;

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
  if v_room.version <> p_expected_version then raise exception 'stale match version' using errcode = '40001'; end if;
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
  if not found then raise exception 'stale authoritative version' using errcode = '40001'; end if;

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

create or replace function public.fcg_server_cleanup_expired(p_before timestamptz default now())
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  delete from public.fcg_rooms where expires_at < p_before;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.fcg_server_initialize_room(uuid, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.fcg_server_load_room(uuid, uuid) from public;
revoke all on function public.fcg_server_commit_action(uuid, uuid, uuid, bigint, text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean, text) from public;
revoke all on function public.fcg_server_cleanup_expired(timestamptz) from public;
grant execute on function public.fcg_server_initialize_room(uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.fcg_server_load_room(uuid, uuid) to service_role;
grant execute on function public.fcg_server_commit_action(uuid, uuid, uuid, bigint, text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean, text) to service_role;
grant execute on function public.fcg_server_cleanup_expired(timestamptz) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fcg_rooms'
  ) then alter publication supabase_realtime add table public.fcg_rooms; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fcg_room_members'
  ) then alter publication supabase_realtime add table public.fcg_room_members; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fcg_player_views'
  ) then alter publication supabase_realtime add table public.fcg_player_views; end if;
end
$$;
