-- Four Color Map Game v5.0 Online RC1
-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- Safe to re-run: objects are created or replaced idempotently.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.fc_game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code_hash text not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'finished', 'abandoned')),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete set null,
  host_config jsonb not null default '{}'::jsonb,
  guest_config jsonb,
  game_state jsonb,
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create unique index if not exists fc_game_rooms_waiting_code_uq
  on public.fc_game_rooms (room_code_hash)
  where status = 'waiting';

create index if not exists fc_game_rooms_host_idx
  on public.fc_game_rooms (host_user_id, updated_at desc);

create index if not exists fc_game_rooms_guest_idx
  on public.fc_game_rooms (guest_user_id, updated_at desc)
  where guest_user_id is not null;

create index if not exists fc_game_rooms_expiry_idx
  on public.fc_game_rooms (expires_at);

alter table public.fc_game_rooms enable row level security;
alter table public.fc_game_rooms force row level security;
alter table public.fc_game_rooms replica identity full;

revoke all on table public.fc_game_rooms from anon, authenticated;
grant select on table public.fc_game_rooms to authenticated;

drop policy if exists "fc participants can read their room" on public.fc_game_rooms;
create policy "fc participants can read their room"
  on public.fc_game_rooms
  for select
  to authenticated
  using (
    expires_at > (select pg_catalog.now())
    and (
      (select auth.uid()) = host_user_id
      or (select auth.uid()) = guest_user_id
    )
  );

create or replace function public.fc_normalize_room_code(p_room_code text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.upper(pg_catalog.btrim(p_room_code));
$$;

create or replace function public.fc_room_code_hash(p_room_code text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(public.fc_normalize_room_code(p_room_code), 'sha256'),
    'hex'
  );
$$;

create or replace function public.fc_sanitize_player_config(
  p_config jsonb,
  p_forced_mode text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_mode text;
  v_loadout jsonb;
  v_cosmetics jsonb;
begin
  if p_config is null or pg_catalog.jsonb_typeof(p_config) <> 'object' then
    raise exception 'invalid_player_config' using errcode = 'P0001';
  end if;
  if pg_catalog.octet_length(p_config::text) > 65536 then
    raise exception 'player_config_too_large' using errcode = 'P0001';
  end if;

  v_name := pg_catalog.left(
    pg_catalog.btrim(pg_catalog.coalesce(p_config ->> 'display_name', 'PLAYER')),
    20
  );

  if v_name = '' then
    v_name := 'PLAYER';
  end if;

  -- Names are rendered in the browser UI. Reject HTML-significant characters.
  if pg_catalog.strpos(v_name, '<') > 0
     or pg_catalog.strpos(v_name, '>') > 0
     or pg_catalog.strpos(v_name, '&') > 0
     or pg_catalog.strpos(v_name, '"') > 0
     or pg_catalog.strpos(v_name, '''') > 0 then
    raise exception 'invalid_display_name' using errcode = 'P0001';
  end if;

  v_mode := pg_catalog.coalesce(
    p_forced_mode,
    p_config ->> 'mode',
    'standard'
  );

  if v_mode not in ('standard', 'quick') then
    raise exception 'invalid_match_mode' using errcode = 'P0001';
  end if;

  v_loadout := pg_catalog.coalesce(p_config -> 'loadout', '{}'::jsonb);
  if pg_catalog.jsonb_typeof(v_loadout) <> 'object' then
    v_loadout := '{}'::jsonb;
  end if;

  v_cosmetics := pg_catalog.coalesce(p_config -> 'cosmetics', '{}'::jsonb);
  if pg_catalog.jsonb_typeof(v_cosmetics) <> 'object' then
    v_cosmetics := '{}'::jsonb;
  end if;

  return pg_catalog.jsonb_build_object(
    'display_name', v_name,
    'mode', v_mode,
    'loadout', v_loadout,
    'cosmetics', v_cosmetics
  );
end;
$$;

create or replace function public.fc_create_room(
  p_room_code text,
  p_player_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_hash text;
  v_config jsonb;
  v_room public.fc_game_rooms%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  v_code := public.fc_normalize_room_code(p_room_code);
  if pg_catalog.char_length(v_code) < 4 or pg_catalog.char_length(v_code) > 32 then
    raise exception 'room_code_must_be_4_to_32_characters' using errcode = 'P0001';
  end if;
  if v_code ~ '[[:cntrl:]]' then
    raise exception 'invalid_room_code' using errcode = 'P0001';
  end if;

  v_hash := public.fc_room_code_hash(v_code);
  v_config := public.fc_sanitize_player_config(p_player_config, null);

  -- Reclaim a code whose prior waiting room has expired. Without this targeted
  -- cleanup, the partial unique index would reserve that code indefinitely.
  update public.fc_game_rooms
     set status = 'abandoned',
         updated_at = pg_catalog.clock_timestamp(),
         expires_at = pg_catalog.clock_timestamp()
   where room_code_hash = v_hash
     and status = 'waiting'
     and expires_at <= pg_catalog.clock_timestamp();

  update public.fc_game_rooms
     set status = 'abandoned',
         updated_at = pg_catalog.clock_timestamp(),
         expires_at = pg_catalog.clock_timestamp()
   where host_user_id = v_uid
     and status = 'waiting';

  insert into public.fc_game_rooms (
    room_code_hash,
    status,
    host_user_id,
    host_config,
    expires_at
  ) values (
    v_hash,
    'waiting',
    v_uid,
    v_config,
    pg_catalog.clock_timestamp() + interval '24 hours'
  )
  returning * into v_room;

  return pg_catalog.jsonb_build_object(
    'room_id', v_room.id,
    'seat', 'A',
    'status', v_room.status,
    'version', v_room.version
  );
exception
  when unique_violation then
    raise exception 'room_code_in_use' using errcode = 'P0001';
end;
$$;

create or replace function public.fc_join_room(
  p_room_code text,
  p_player_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_hash text;
  v_config jsonb;
  v_room public.fc_game_rooms%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  v_code := public.fc_normalize_room_code(p_room_code);
  if pg_catalog.char_length(v_code) < 4 or pg_catalog.char_length(v_code) > 32 then
    raise exception 'room_code_must_be_4_to_32_characters' using errcode = 'P0001';
  end if;
  v_hash := public.fc_room_code_hash(v_code);

  select r.*
    into v_room
    from public.fc_game_rooms as r
   where r.room_code_hash = v_hash
     and r.status = 'waiting'
     and r.expires_at > pg_catalog.clock_timestamp()
   order by r.created_at desc
   limit 1
   for update skip locked;

  if not found then
    raise exception 'waiting_room_not_found' using errcode = 'P0001';
  end if;
  if v_room.host_user_id = v_uid then
    raise exception 'cannot_join_own_room' using errcode = 'P0001';
  end if;

  v_config := public.fc_sanitize_player_config(
    p_player_config,
    v_room.host_config ->> 'mode'
  );

  update public.fc_game_rooms
     set guest_user_id = v_uid,
         guest_config = v_config,
         status = 'active',
         updated_at = pg_catalog.clock_timestamp(),
         expires_at = pg_catalog.clock_timestamp() + interval '24 hours'
   where id = v_room.id
  returning * into v_room;

  return pg_catalog.jsonb_build_object(
    'room_id', v_room.id,
    'seat', 'B',
    'status', v_room.status,
    'version', v_room.version
  );
end;
$$;

create or replace function public.fc_initialize_room(
  p_room_id uuid,
  p_expected_version bigint,
  p_game_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.fc_game_rooms%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  select r.* into v_room
    from public.fc_game_rooms as r
   where r.id = p_room_id
   for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  if v_room.expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'room_expired' using errcode = 'P0001';
  end if;
  if v_uid <> v_room.host_user_id and v_uid <> v_room.guest_user_id then
    raise exception 'not_a_room_participant' using errcode = 'P0001';
  end if;
  if v_room.status <> 'active' or v_room.guest_user_id is null then
    raise exception 'room_not_ready' using errcode = 'P0001';
  end if;
  if v_room.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  if v_room.game_state is not null then
    raise exception 'room_already_initialized' using errcode = 'P0001';
  end if;
  if p_game_state is null or pg_catalog.jsonb_typeof(p_game_state) <> 'object' then
    raise exception 'invalid_game_state' using errcode = 'P0001';
  end if;
  if pg_catalog.octet_length(p_game_state::text) > 2097152 then
    raise exception 'game_state_too_large' using errcode = 'P0001';
  end if;
  if p_game_state ->> 'active' <> 'A'
     or p_game_state ->> 'phase' <> 'AWAIT_REVEAL'
     or p_game_state ->> 'mode' <> v_room.host_config ->> 'mode' then
    raise exception 'invalid_initial_game_state' using errcode = 'P0001';
  end if;

  update public.fc_game_rooms
     set game_state = p_game_state,
         version = version + 1,
         updated_at = pg_catalog.clock_timestamp(),
         expires_at = pg_catalog.clock_timestamp() + interval '24 hours'
   where id = v_room.id
  returning * into v_room;

  return pg_catalog.jsonb_build_object(
    'room_id', v_room.id,
    'status', v_room.status,
    'version', v_room.version,
    'updated_at', v_room.updated_at
  );
end;
$$;

create or replace function public.fc_submit_state(
  p_room_id uuid,
  p_expected_version bigint,
  p_game_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.fc_game_rooms%rowtype;
  v_seat text;
  v_old_active text;
  v_new_active text;
  v_new_phase text;
  v_old_turn bigint;
  v_new_turn bigint;
  v_new_status text;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  select r.* into v_room
    from public.fc_game_rooms as r
   where r.id = p_room_id
   for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  if v_room.expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'room_expired' using errcode = 'P0001';
  end if;

  if v_uid = v_room.host_user_id then
    v_seat := 'A';
  elsif v_uid = v_room.guest_user_id then
    v_seat := 'B';
  else
    raise exception 'not_a_room_participant' using errcode = 'P0001';
  end if;

  if v_room.status <> 'active' then
    raise exception 'room_is_not_active' using errcode = 'P0001';
  end if;
  if v_room.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  if v_room.game_state is null then
    raise exception 'room_not_initialized' using errcode = 'P0001';
  end if;
  if p_game_state is null or pg_catalog.jsonb_typeof(p_game_state) <> 'object' then
    raise exception 'invalid_game_state' using errcode = 'P0001';
  end if;
  if pg_catalog.octet_length(p_game_state::text) > 2097152 then
    raise exception 'game_state_too_large' using errcode = 'P0001';
  end if;

  v_old_active := v_room.game_state ->> 'active';
  if v_old_active <> v_seat then
    raise exception 'not_your_turn' using errcode = 'P0001';
  end if;

  v_new_active := p_game_state ->> 'active';
  v_new_phase := p_game_state ->> 'phase';
  if v_new_active not in ('A', 'B') then
    raise exception 'invalid_active_player' using errcode = 'P0001';
  end if;
  if v_new_phase not in (
    'AWAIT_REVEAL', 'CREATE_FIRST', 'COLOR', 'WORK', 'GAME_OVER'
  ) then
    raise exception 'invalid_game_phase' using errcode = 'P0001';
  end if;
  if p_game_state ->> 'mode' <> v_room.host_config ->> 'mode' then
    raise exception 'match_mode_mismatch' using errcode = 'P0001';
  end if;

  begin
    v_old_turn := pg_catalog.coalesce((v_room.game_state ->> 'turn')::bigint, 0);
    v_new_turn := pg_catalog.coalesce((p_game_state ->> 'turn')::bigint, 0);
  exception when invalid_text_representation then
    raise exception 'invalid_turn_number' using errcode = 'P0001';
  end;

  if v_new_turn < v_old_turn or v_new_turn > v_old_turn + 1 then
    raise exception 'invalid_turn_transition' using errcode = 'P0001';
  end if;

  v_new_status := case
    when p_game_state ->> 'winner' is not null then 'finished'
    else 'active'
  end;

  update public.fc_game_rooms
     set game_state = p_game_state,
         status = v_new_status,
         version = version + 1,
         updated_at = pg_catalog.clock_timestamp(),
         expires_at = pg_catalog.clock_timestamp() + interval '24 hours'
   where id = v_room.id
  returning * into v_room;

  return pg_catalog.jsonb_build_object(
    'room_id', v_room.id,
    'status', v_room.status,
    'version', v_room.version,
    'updated_at', v_room.updated_at
  );
end;
$$;

create or replace function public.fc_reset_room(
  p_room_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.fc_game_rooms%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  select r.* into v_room
    from public.fc_game_rooms as r
   where r.id = p_room_id
   for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  if v_room.expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'room_expired' using errcode = 'P0001';
  end if;
  if v_uid <> v_room.host_user_id then
    raise exception 'host_only' using errcode = 'P0001';
  end if;
  if v_room.guest_user_id is null then
    raise exception 'guest_not_connected' using errcode = 'P0001';
  end if;
  if v_room.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  if v_room.status not in ('active', 'finished') then
    raise exception 'room_cannot_be_reset' using errcode = 'P0001';
  end if;

  update public.fc_game_rooms
     set game_state = null,
         status = 'active',
         version = version + 1,
         updated_at = pg_catalog.clock_timestamp(),
         expires_at = pg_catalog.clock_timestamp() + interval '24 hours'
   where id = v_room.id
  returning * into v_room;

  return pg_catalog.jsonb_build_object(
    'room_id', v_room.id,
    'status', v_room.status,
    'version', v_room.version
  );
end;
$$;

create or replace function public.fc_leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.fc_game_rooms%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  select r.* into v_room
    from public.fc_game_rooms as r
   where r.id = p_room_id
   for update;

  if not found then
    return pg_catalog.jsonb_build_object('room_id', p_room_id, 'status', 'missing');
  end if;
  if v_uid <> v_room.host_user_id and v_uid <> v_room.guest_user_id then
    raise exception 'not_a_room_participant' using errcode = 'P0001';
  end if;

  if v_room.status = 'waiting' and v_uid = v_room.host_user_id then
    delete from public.fc_game_rooms where id = v_room.id;
    return pg_catalog.jsonb_build_object('room_id', v_room.id, 'status', 'deleted');
  end if;

  update public.fc_game_rooms
     set status = 'abandoned',
         version = version + 1,
         updated_at = pg_catalog.clock_timestamp(),
         expires_at = pg_catalog.clock_timestamp()
   where id = v_room.id
  returning * into v_room;

  return pg_catalog.jsonb_build_object(
    'room_id', v_room.id,
    'status', v_room.status,
    'version', v_room.version
  );
end;
$$;

revoke execute on function public.fc_normalize_room_code(text) from public, anon, authenticated;
revoke execute on function public.fc_room_code_hash(text) from public, anon, authenticated;
revoke execute on function public.fc_sanitize_player_config(jsonb, text) from public, anon, authenticated;

revoke execute on function public.fc_create_room(text, jsonb) from public, anon;
revoke execute on function public.fc_join_room(text, jsonb) from public, anon;
revoke execute on function public.fc_initialize_room(uuid, bigint, jsonb) from public, anon;
revoke execute on function public.fc_submit_state(uuid, bigint, jsonb) from public, anon;
revoke execute on function public.fc_reset_room(uuid, bigint) from public, anon;
revoke execute on function public.fc_leave_room(uuid) from public, anon;

grant execute on function public.fc_create_room(text, jsonb) to authenticated;
grant execute on function public.fc_join_room(text, jsonb) to authenticated;
grant execute on function public.fc_initialize_room(uuid, bigint, jsonb) to authenticated;
grant execute on function public.fc_submit_state(uuid, bigint, jsonb) to authenticated;
grant execute on function public.fc_reset_room(uuid, bigint) to authenticated;
grant execute on function public.fc_leave_room(uuid) to authenticated;

-- Postgres Changes realtime is used for immediate updates. The browser also polls,
-- so the game still reconnects if Realtime is temporarily unavailable.
do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'fc_game_rooms'
  ) then
    alter publication supabase_realtime add table public.fc_game_rooms;
  end if;
end
$$;

commit;
