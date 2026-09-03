-- Four Color Map Game v5.0 Standard server-authoritative match transaction RPCs.
-- UNAPPLIED: additive only. Quick-mode RPCs and their deployed handler are unchanged.

create or replace function public.fcg_standard_server_load_room(
  p_room_id uuid,
  p_actor_id uuid
)
returns table (
  room_status text,
  room_version bigint,
  actor_seat text,
  authoritative_state jsonb,
  action_public_state jsonb,
  actor_private_state jsonb,
  setup_a jsonb,
  setup_b jsonb,
  profile_a_state jsonb,
  profile_b_state jsonb,
  profile_a_revision bigint,
  profile_b_revision bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    room.status,
    room.version,
    actor.seat,
    authority.state,
    room.public_state,
    actor_view.private_state,
    setup_a.loadout,
    setup_b.loadout,
    profile_a.profile_state,
    profile_b.profile_state,
    profile_a.revision,
    profile_b.revision
  from public.fcg_rooms room
  join public.fcg_room_members actor
    on actor.room_id = room.id and actor.user_id = p_actor_id
  left join fcg_private.authoritative_matches authority
    on authority.room_id = room.id and authority.game_mode = 'standard_v5'
  left join public.fcg_player_views actor_view
    on actor_view.room_id = room.id and actor_view.user_id = p_actor_id
  left join fcg_private.standard_room_setups setup_a
    on setup_a.room_id = room.id and setup_a.seat = 'A'
  left join fcg_private.standard_room_setups setup_b
    on setup_b.room_id = room.id and setup_b.seat = 'B'
  left join public.fcg_standard_profiles profile_a
    on profile_a.user_id = setup_a.user_id
  left join public.fcg_standard_profiles profile_b
    on profile_b.user_id = setup_b.user_id
  where room.id = p_room_id and room.game_mode = 'standard_v5';
$$;

create or replace function public.fcg_standard_server_initialize_room(
  p_room_id uuid,
  p_expected_version bigint,
  p_authoritative_state jsonb,
  p_public_state jsonb,
  p_private_a jsonb,
  p_private_b jsonb
)
returns table (new_version bigint, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.fcg_rooms%rowtype;
  v_setup_a fcg_private.standard_room_setups%rowtype;
  v_setup_b fcg_private.standard_room_setups%rowtype;
  v_profile_a_revision bigint;
  v_profile_b_revision bigint;
begin
  if p_expected_version < 0 or p_authoritative_state is null or p_public_state is null
      or p_private_a is null or p_private_b is null then
    raise exception 'invalid Standard initialization' using errcode = '22023';
  end if;

  select room.* into v_room
  from public.fcg_rooms room
  where room.id = p_room_id
  for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;
  if v_room.game_mode <> 'standard_v5' then
    raise exception 'room is not Standard mode' using errcode = '55000';
  end if;

  if exists (
    select 1 from fcg_private.authoritative_matches authority
    where authority.room_id = p_room_id and authority.game_mode = 'standard_v5'
  ) then
    return query select v_room.version, true;
    return;
  end if;

  if v_room.status <> 'ready' then raise exception 'room is not ready' using errcode = '55000'; end if;
  if v_room.version <> p_expected_version then
    raise exception 'stale match version' using errcode = 'PT409';
  end if;

  select setup.* into v_setup_a
  from fcg_private.standard_room_setups setup
  where setup.room_id = p_room_id and setup.seat = 'A'
  for update;
  if not found then raise exception 'seat A loadout required' using errcode = '55000'; end if;
  select setup.* into v_setup_b
  from fcg_private.standard_room_setups setup
  where setup.room_id = p_room_id and setup.seat = 'B'
  for update;
  if not found then raise exception 'seat B loadout required' using errcode = '55000'; end if;
  if v_setup_a.quote_expires_at <= now() or v_setup_b.quote_expires_at <= now() then
    raise exception 'loadout quote expired' using errcode = 'PT409';
  end if;

  select profile.revision into v_profile_a_revision
  from public.fcg_standard_profiles profile
  where profile.user_id = v_setup_a.user_id
  for update;
  if not found or v_profile_a_revision <> v_setup_a.profile_revision then
    raise exception 'stale seat A profile revision' using errcode = 'PT409';
  end if;
  select profile.revision into v_profile_b_revision
  from public.fcg_standard_profiles profile
  where profile.user_id = v_setup_b.user_id
  for update;
  if not found or v_profile_b_revision <> v_setup_b.profile_revision then
    raise exception 'stale seat B profile revision' using errcode = 'PT409';
  end if;

  insert into fcg_private.authoritative_matches (room_id, version, state, game_mode)
  values (p_room_id, p_expected_version, p_authoritative_state, 'standard_v5');

  insert into public.fcg_player_views (room_id, user_id, seat, version, private_state)
  values
    (p_room_id, v_setup_a.user_id, 'A', p_expected_version, p_private_a),
    (p_room_id, v_setup_b.user_id, 'B', p_expected_version, p_private_b)
  on conflict (room_id, user_id) do update
  set version = excluded.version,
      private_state = excluded.private_state,
      updated_at = now();

  update public.fcg_rooms
  set status = 'playing',
      version = p_expected_version,
      public_state = p_public_state,
      started_at = coalesce(started_at, now()),
      updated_at = now(),
      last_activity_at = now(),
      expires_at = now() + interval '24 hours'
  where id = p_room_id and status = 'ready' and version = p_expected_version;
  if not found then raise exception 'stale match version' using errcode = 'PT409'; end if;

  return query select p_expected_version, false;
end;
$$;

create or replace function public.fcg_standard_server_commit_action(
  p_room_id uuid,
  p_actor_id uuid,
  p_action_id uuid,
  p_expected_version bigint,
  p_action_type text,
  p_action_fingerprint text,
  p_authoritative_state jsonb,
  p_public_state jsonb,
  p_private_a jsonb,
  p_private_b jsonb,
  p_result jsonb,
  p_profile_a_expected_revision bigint default null,
  p_profile_a_state jsonb default null,
  p_profile_b_expected_revision bigint default null,
  p_profile_b_state jsonb default null,
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
  v_receipt fcg_private.standard_action_receipts%rowtype;
  v_a uuid;
  v_b uuid;
  v_projection_count bigint;
begin
  if p_action_id is null or p_expected_version < 0 or p_action_type is null
      or p_action_fingerprint !~ '^[0-9a-f]{64}$'
      or p_authoritative_state is null or p_public_state is null
      or p_private_a is null or p_private_b is null or p_result is null then
    raise exception 'invalid Standard action commit' using errcode = '22023';
  end if;
  if (p_profile_a_state is null) <> (p_profile_a_expected_revision is null)
      or (p_profile_b_state is null) <> (p_profile_b_expected_revision is null) then
    raise exception 'profile update requires state and revision' using errcode = '22023';
  end if;

  select receipt.* into v_receipt
  from fcg_private.standard_action_receipts receipt
  where receipt.room_id = p_room_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.actor_id <> p_actor_id or v_receipt.action_fingerprint <> p_action_fingerprint then
      raise exception 'action id reuse' using errcode = '23505';
    end if;
    return query select (v_receipt.result->>'version')::bigint, true, v_receipt.result;
    return;
  end if;

  select room.* into v_room
  from public.fcg_rooms room
  where room.id = p_room_id
  for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;

  select receipt.* into v_receipt
  from fcg_private.standard_action_receipts receipt
  where receipt.room_id = p_room_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.actor_id <> p_actor_id or v_receipt.action_fingerprint <> p_action_fingerprint then
      raise exception 'action id reuse' using errcode = '23505';
    end if;
    return query select (v_receipt.result->>'version')::bigint, true, v_receipt.result;
    return;
  end if;

  if v_room.game_mode <> 'standard_v5' or v_room.status <> 'playing' then
    raise exception 'Standard room is not active' using errcode = '55000';
  end if;
  if v_room.version <> p_expected_version then
    raise exception 'stale match version' using errcode = 'PT409';
  end if;
  select member.user_id into v_a
  from public.fcg_room_members member
  where member.room_id = p_room_id and member.seat = 'A';
  select member.user_id into v_b
  from public.fcg_room_members member
  where member.room_id = p_room_id and member.seat = 'B';
  if v_a is null or v_b is null or p_actor_id not in (v_a, v_b) then
    raise exception 'actor is not a member' using errcode = '42501';
  end if;
  if p_finished and p_winner_seat not in ('A', 'B') then
    raise exception 'winner seat required' using errcode = '22023';
  end if;

  update fcg_private.authoritative_matches
  set version = p_expected_version + 1,
      state = p_authoritative_state,
      updated_at = now()
  where room_id = p_room_id
    and game_mode = 'standard_v5'
    and version = p_expected_version;
  if not found then raise exception 'stale authoritative version' using errcode = 'PT409'; end if;

  if p_profile_a_state is not null then
    update public.fcg_standard_profiles
    set revision = p_profile_a_expected_revision + 1,
        profile_state = p_profile_a_state,
        updated_at = now()
    where user_id = v_a and revision = p_profile_a_expected_revision;
    if not found then raise exception 'stale seat A profile revision' using errcode = 'PT409'; end if;
  end if;
  if p_profile_b_state is not null then
    update public.fcg_standard_profiles
    set revision = p_profile_b_expected_revision + 1,
        profile_state = p_profile_b_state,
        updated_at = now()
    where user_id = v_b and revision = p_profile_b_expected_revision;
    if not found then raise exception 'stale seat B profile revision' using errcode = 'PT409'; end if;
  end if;

  update public.fcg_player_views
  set version = p_expected_version + 1,
      private_state = case when seat = 'A' then p_private_a else p_private_b end,
      updated_at = now()
  where room_id = p_room_id and user_id in (v_a, v_b);
  get diagnostics v_projection_count = row_count;
  if v_projection_count <> 2 then
    raise exception 'player projections missing' using errcode = 'P0002';
  end if;

  update public.fcg_rooms
  set version = p_expected_version + 1,
      public_state = p_public_state,
      status = case when p_finished then 'finished' else 'playing' end,
      winner_seat = case when p_finished then p_winner_seat else null end,
      finished_at = case when p_finished then now() else null end,
      updated_at = now(),
      last_activity_at = now(),
      expires_at = now() + interval '24 hours'
  where id = p_room_id and version = p_expected_version;
  if not found then raise exception 'stale room version' using errcode = 'PT409'; end if;

  insert into fcg_private.standard_action_receipts
    (room_id, action_id, actor_id, expected_version, action_type, action_fingerprint, result)
  values
    (p_room_id, p_action_id, p_actor_id, p_expected_version, p_action_type,
     p_action_fingerprint, p_result || jsonb_build_object('version', p_expected_version + 1));

  return query select p_expected_version + 1, false,
    p_result || jsonb_build_object('version', p_expected_version + 1);
end;
$$;

revoke all on function public.fcg_standard_server_load_room(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.fcg_standard_server_initialize_room(uuid, bigint, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.fcg_standard_server_commit_action(uuid, uuid, uuid, bigint, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, bigint, jsonb, bigint, jsonb, boolean, text)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_load_room(uuid, uuid)
  to service_role;
grant execute on function public.fcg_standard_server_initialize_room(uuid, bigint, jsonb, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.fcg_standard_server_commit_action(uuid, uuid, uuid, bigint, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, bigint, jsonb, bigint, jsonb, boolean, text)
  to service_role;
