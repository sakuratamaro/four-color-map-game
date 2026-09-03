-- Four Color Map Game v5.0 Standard deliberate-mode online foundation.
-- UNAPPLIED: additive only; the existing quick-mode objects and RPC contracts remain valid.

alter table public.fcg_rooms
  add column if not exists game_mode text not null default 'quick_v5';

alter table fcg_private.authoritative_matches
  add column if not exists game_mode text not null default 'quick_v5';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fcg_rooms_game_mode_check'
      and conrelid = 'public.fcg_rooms'::regclass
  ) then
    alter table public.fcg_rooms
      add constraint fcg_rooms_game_mode_check
      check (game_mode in ('quick_v5', 'standard_v5'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'fcg_authoritative_matches_game_mode_check'
      and conrelid = 'fcg_private.authoritative_matches'::regclass
  ) then
    alter table fcg_private.authoritative_matches
      add constraint fcg_authoritative_matches_game_mode_check
      check (game_mode in ('quick_v5', 'standard_v5'));
  end if;
end
$$;

-- Browser-readable only by the owning authenticated user. This table is not
-- added to Realtime; room invalidation remains the sole realtime signal.
create table if not exists public.fcg_standard_profiles (
  user_id uuid primary key,
  revision bigint not null default 0 check (revision >= 0),
  display_name text not null check (char_length(display_name) between 1 and 20),
  profile_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fcg_standard_profiles enable row level security;
alter table public.fcg_standard_profiles replica identity default;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fcg_standard_profiles'
      and policyname = 'fcg_standard_profiles_owner_select'
  ) then
    create policy fcg_standard_profiles_owner_select
      on public.fcg_standard_profiles
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$$;

revoke all on table public.fcg_standard_profiles from public, anon, authenticated;
grant select on table public.fcg_standard_profiles to authenticated;

-- Submitted loadouts stay server-private until both seats have been validated
-- and the server has committed the match start and inventory reservations.
create table if not exists fcg_private.standard_room_setups (
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  user_id uuid not null,
  seat text not null check (seat in ('A', 'B')),
  setup_revision bigint not null default 0 check (setup_revision >= 0),
  profile_revision bigint not null check (profile_revision >= 0),
  quote_id uuid not null,
  quote_expires_at timestamptz not null,
  loadout jsonb not null,
  loadout_fingerprint text not null check (loadout_fingerprint ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat),
  unique (room_id, quote_id)
);

create table if not exists fcg_private.standard_action_receipts (
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  action_id uuid not null,
  actor_id uuid not null,
  expected_version bigint not null check (expected_version >= 0),
  action_type text not null,
  action_fingerprint text not null check (action_fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  accepted_at timestamptz not null default now(),
  primary key (room_id, action_id)
);

create index if not exists fcg_standard_receipts_actor_idx
  on fcg_private.standard_action_receipts (actor_id, accepted_at desc);

alter table fcg_private.standard_room_setups enable row level security;
alter table fcg_private.standard_action_receipts enable row level security;
revoke all on table fcg_private.standard_room_setups from public, anon, authenticated;
revoke all on table fcg_private.standard_action_receipts from public, anon, authenticated;

create or replace function public.fcg_standard_create_room(p_display_name text)
returns table (
  room_id uuid,
  room_code text,
  seat text,
  room_status text,
  room_version bigint,
  game_mode text
)
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
      insert into public.fcg_rooms (code_hash, host_user_id, game_mode)
      values (encode(extensions.digest(v_code, 'sha256'), 'hex'), v_user_id, 'standard_v5')
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      v_room_id := null;
    end;
  end loop;

  if v_room_id is null then raise exception 'could not allocate room code' using errcode = 'P0001'; end if;
  insert into public.fcg_room_members (room_id, user_id, seat, display_name)
  values (v_room_id, v_user_id, 'A', v_name);
  return query select v_room_id, v_code, 'A'::text, 'waiting'::text, 0::bigint, 'standard_v5'::text;
end;
$$;

create or replace function public.fcg_standard_server_commit_profile(
  p_user_id uuid,
  p_expected_revision bigint,
  p_display_name text,
  p_profile_state jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current bigint;
begin
  if p_user_id is null or p_expected_revision < 0 or p_profile_state is null then
    raise exception 'invalid profile commit' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_display_name, ''))) < 1 or char_length(btrim(p_display_name)) > 20 then
    raise exception 'display name must be 1 to 20 characters' using errcode = '22023';
  end if;

  select profile.revision into v_current
  from public.fcg_standard_profiles profile
  where profile.user_id = p_user_id
  for update;

  if not found then
    if p_expected_revision <> 0 then raise exception 'stale profile revision' using errcode = 'PT409'; end if;
    insert into public.fcg_standard_profiles (user_id, revision, display_name, profile_state)
    values (p_user_id, 1, btrim(p_display_name), p_profile_state);
    return 1;
  end if;

  if v_current <> p_expected_revision then raise exception 'stale profile revision' using errcode = 'PT409'; end if;
  update public.fcg_standard_profiles
  set revision = p_expected_revision + 1,
      display_name = btrim(p_display_name),
      profile_state = p_profile_state,
      updated_at = now()
  where user_id = p_user_id and revision = p_expected_revision;
  if not found then raise exception 'stale profile revision' using errcode = 'PT409'; end if;
  return p_expected_revision + 1;
end;
$$;

create or replace function public.fcg_standard_server_submit_loadout(
  p_room_id uuid,
  p_actor_id uuid,
  p_expected_setup_revision bigint,
  p_profile_revision bigint,
  p_quote_id uuid,
  p_quote_expires_at timestamptz,
  p_loadout jsonb,
  p_loadout_fingerprint text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.fcg_rooms%rowtype;
  v_seat text;
  v_profile_revision bigint;
  v_current_setup fcg_private.standard_room_setups%rowtype;
  v_next_revision bigint;
begin
  select room.* into v_room from public.fcg_rooms room where room.id = p_room_id for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;
  if v_room.game_mode <> 'standard_v5' or v_room.status not in ('waiting', 'ready') then
    raise exception 'standard room is not configurable' using errcode = '55000';
  end if;
  select member.seat into v_seat from public.fcg_room_members member
  where member.room_id = p_room_id and member.user_id = p_actor_id;
  if v_seat is null then raise exception 'actor is not a member' using errcode = '42501'; end if;
  select profile.revision into v_profile_revision from public.fcg_standard_profiles profile
  where profile.user_id = p_actor_id for share;
  if not found then raise exception 'standard profile required' using errcode = 'P0002'; end if;
  if v_profile_revision <> p_profile_revision then raise exception 'stale profile revision' using errcode = 'PT409'; end if;
  if p_quote_id is null or p_quote_expires_at <= now() or p_loadout is null
      or p_expected_setup_revision < 0
      or p_loadout_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid loadout quote' using errcode = '22023';
  end if;

  select setup.* into v_current_setup
  from fcg_private.standard_room_setups setup
  where setup.room_id = p_room_id and setup.user_id = p_actor_id
  for update;
  if found then
    if v_current_setup.quote_id = p_quote_id
        and v_current_setup.loadout_fingerprint = p_loadout_fingerprint
        and v_current_setup.profile_revision = p_profile_revision then
      return v_current_setup.setup_revision;
    end if;
    if v_current_setup.setup_revision <> p_expected_setup_revision then
      raise exception 'stale setup revision' using errcode = 'PT409';
    end if;
    v_next_revision := v_current_setup.setup_revision + 1;
  else
    if p_expected_setup_revision <> 0 then
      raise exception 'stale setup revision' using errcode = 'PT409';
    end if;
    v_next_revision := 1;
  end if;

  insert into fcg_private.standard_room_setups
    (room_id, user_id, seat, setup_revision, profile_revision, quote_id, quote_expires_at, loadout, loadout_fingerprint)
  values
    (p_room_id, p_actor_id, v_seat, v_next_revision, p_profile_revision, p_quote_id, p_quote_expires_at, p_loadout, p_loadout_fingerprint)
  on conflict (room_id, user_id) do update
  set setup_revision = excluded.setup_revision,
      profile_revision = excluded.profile_revision,
      quote_id = excluded.quote_id,
      quote_expires_at = excluded.quote_expires_at,
      loadout = excluded.loadout,
      loadout_fingerprint = excluded.loadout_fingerprint,
      updated_at = now();
  return v_next_revision;
end;
$$;

revoke all on function public.fcg_standard_create_room(text) from public, anon;
grant execute on function public.fcg_standard_create_room(text) to authenticated;

revoke all on function public.fcg_standard_server_commit_profile(uuid, bigint, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.fcg_standard_server_submit_loadout(uuid, uuid, bigint, bigint, uuid, timestamptz, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_commit_profile(uuid, bigint, text, jsonb)
  to service_role;
grant execute on function public.fcg_standard_server_submit_loadout(uuid, uuid, bigint, bigint, uuid, timestamptz, jsonb, text)
  to service_role;
