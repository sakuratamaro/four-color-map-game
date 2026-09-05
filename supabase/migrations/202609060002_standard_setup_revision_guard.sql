-- Close the Standard initialization TOCTOU window without replacing deployed RPC signatures.
-- v3 returns each setup revision beside the loadout from the same statement snapshot;
-- the eight-argument initialize overload rechecks both revisions after taking DB locks.

begin;

create function public.fcg_standard_server_load_room_v3(p_room_id uuid, p_actor_id uuid)
returns table (
  room_status text, room_version bigint, actor_seat text, authoritative_state jsonb,
  action_public_state jsonb, actor_private_state jsonb, setup_a jsonb, setup_b jsonb,
  profile_a_state jsonb, profile_b_state jsonb, profile_a_revision bigint, profile_b_revision bigint,
  opponent_kind text, cpu_character_id text, cpu_policy_version text, cpu_user_id uuid,
  access_mode text, setup_a_revision bigint, setup_b_revision bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select room.status, room.version, actor.seat, authority.state, room.public_state,
    actor_view.private_state, setup_a.loadout, setup_b.loadout,
    profile_a.profile_state, profile_b.profile_state, profile_a.revision, profile_b.revision,
    room.opponent_kind, room.cpu_character_id, room.cpu_policy_version, room.cpu_user_id,
    room.access_mode, setup_a.setup_revision, setup_b.setup_revision
  from public.fcg_rooms room
  join public.fcg_room_members actor on actor.room_id = room.id and actor.user_id = p_actor_id
  left join fcg_private.authoritative_matches authority on authority.room_id = room.id and authority.game_mode = 'standard_v5'
  left join public.fcg_player_views actor_view on actor_view.room_id = room.id and actor_view.user_id = p_actor_id
  left join fcg_private.standard_room_setups setup_a on setup_a.room_id = room.id and setup_a.seat = 'A'
  left join fcg_private.standard_room_setups setup_b on setup_b.room_id = room.id and setup_b.seat = 'B'
  left join public.fcg_standard_profiles profile_a on profile_a.user_id = setup_a.user_id
  left join public.fcg_standard_profiles profile_b on profile_b.user_id = setup_b.user_id
  where room.id = p_room_id and room.game_mode = 'standard_v5';
$$;

create function public.fcg_standard_server_initialize_room(
  p_room_id uuid,
  p_expected_version bigint,
  p_setup_a_revision bigint,
  p_setup_b_revision bigint,
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
  if p_expected_version < 0 or p_setup_a_revision < 1 or p_setup_b_revision < 1
      or p_authoritative_state is null or p_public_state is null
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
  if v_setup_a.setup_revision <> p_setup_a_revision
      or v_setup_b.setup_revision <> p_setup_b_revision then
    raise exception 'stale setup revision' using errcode = 'PT409';
  end if;
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

revoke all on function public.fcg_standard_server_load_room_v3(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_load_room_v3(uuid, uuid)
  to service_role;

revoke all on function public.fcg_standard_server_initialize_room(uuid, bigint, bigint, bigint, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_initialize_room(uuid, bigint, bigint, bigint, jsonb, jsonb, jsonb, jsonb)
  to service_role;

commit;
