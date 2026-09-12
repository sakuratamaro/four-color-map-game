-- UDL-051 F3: additive policy compatibility; no row/schema/reward rewrite.
-- Apply only with the separately reviewed compatibility-first Edge rollout.
-- Old current versions remain accepted for in-flight starts/rematches. The Edge
-- profile factory controls activation; stored room policy versions never change
-- except through the existing successful finished-room rematch transaction.

create or replace function fcg_private.fcg_standard_cpu_policy_is_supported(
  p_character_id text, p_policy_version text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_character_id = 'kurogane' then p_policy_version in (
      'standard-character-roster-v1:kurogane',
      'standard-character-roster-v1:kurogane-lookahead-v2',
      'standard-character-split-rescue-v1:kurogane'
    )
    when p_character_id in ('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei')
      then p_policy_version in (
        'standard-character-roster-v1:' || p_character_id,
        'standard-character-split-rescue-v1:' || p_character_id
      )
    else false
  end;
$$;

create or replace function fcg_private.fcg_standard_cpu_policy_is_current(
  p_character_id text, p_policy_version text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- An overlap set, deliberately retaining the pre-split production default.
  -- Do not retire it during the initial rollout or a supported Edge rollback.
  select case
    when p_character_id = 'kurogane' then p_policy_version in (
      'standard-character-roster-v1:kurogane-lookahead-v2',
      'standard-character-split-rescue-v1:kurogane'
    )
    when p_character_id in ('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei')
      then p_policy_version in (
        'standard-character-roster-v1:' || p_character_id,
        'standard-character-split-rescue-v1:' || p_character_id
      )
    else false
  end;
$$;

revoke all on function fcg_private.fcg_standard_cpu_policy_is_supported(text, text) from public, anon, authenticated;
revoke all on function fcg_private.fcg_standard_cpu_policy_is_current(text, text) from public, anon, authenticated;

create or replace function public.fcg_standard_server_start_cpu(
  p_user_id uuid,
  p_action_id uuid,
  p_cpu_user_id uuid,
  p_character_id text,
  p_policy_version text,
  p_cpu_display_name text,
  p_cpu_profile_state jsonb,
  p_cpu_loadout jsonb,
  p_loadout_fingerprint text
)
returns table (
  room_id uuid,
  seat text,
  opponent_kind text,
  cpu_character_id text,
  duplicate boolean,
  recovered_existing boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_compatible_fingerprints text[];
  v_receipt fcg_private.standard_cpu_start_receipts%rowtype;
  v_searching_ticket fcg_private.standard_matchmaking_tickets%rowtype;
  v_room_id uuid;
  v_seat text;
  v_opponent_kind text;
  v_cpu_character_id text;
  v_human_display_name text;
  v_human_profile_revision bigint;
  v_code text;
  v_attempt integer;
begin
  if p_user_id is null or p_action_id is null or p_cpu_user_id is null or p_cpu_user_id = p_user_id
      or not fcg_private.fcg_standard_cpu_policy_is_supported(p_character_id, p_policy_version)
      or char_length(btrim(coalesce(p_cpu_display_name, ''))) < 1
      or char_length(btrim(p_cpu_display_name)) > 20
      or p_cpu_profile_state is null or p_cpu_loadout is null
      or p_loadout_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid immediate Standard CPU opponent' using errcode = '22023';
  end if;

  v_fingerprint := encode(extensions.digest(
    jsonb_build_object(
      'operation', 'cpu-start',
      'character_id', p_character_id,
      'policy_version', p_policy_version,
      'display_name', btrim(p_cpu_display_name),
      'profile_state', p_cpu_profile_state,
      'loadout', p_cpu_loadout,
      'loadout_fingerprint', p_loadout_fingerprint
    )::text,
    'sha256'
  ), 'hex');
  -- A retry may cross an Edge policy rollout in either direction. Only the
  -- server-selected policy string may differ; every other original input is
  -- still hashed. Never recover by room identity or accept another character.
  select array_agg(encode(extensions.digest(
    jsonb_build_object(
      'operation', 'cpu-start',
      'character_id', p_character_id,
      'policy_version', compatible.policy_version,
      'display_name', btrim(p_cpu_display_name),
      'profile_state', p_cpu_profile_state,
      'loadout', p_cpu_loadout,
      'loadout_fingerprint', p_loadout_fingerprint
    )::text, 'sha256'
  ), 'hex')) into v_compatible_fingerprints
  from unnest(array[
    'standard-character-split-rescue-v1:' || p_character_id,
    'standard-character-roster-v1:' || p_character_id,
    case when p_character_id = 'kurogane'
      then 'standard-character-roster-v1:kurogane-lookahead-v2' end
  ]) as compatible(policy_version)
  where fcg_private.fcg_standard_cpu_policy_is_supported(p_character_id, compatible.policy_version);

  if fcg_private.fcg_standard_matchmaking_rate_limited(p_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select receipt.* into v_receipt
  from fcg_private.standard_cpu_start_receipts receipt
  where receipt.user_id = p_user_id and receipt.action_id = p_action_id
  for update;
  if found then
    if not coalesce(v_receipt.action_fingerprint = any(v_compatible_fingerprints), false) then
      raise exception 'CPU start action ID reused with different input' using errcode = '23505';
    end if;
    return query select v_receipt.room_id, v_receipt.seat, v_receipt.opponent_kind,
      v_receipt.cpu_character_id, true, v_receipt.result_kind = 'recovered_existing';
    return;
  end if;
  if not fcg_private.fcg_standard_cpu_policy_is_current(p_character_id, p_policy_version) then
    raise exception 'retired Standard CPU policy cannot create a room' using errcode = '22023';
  end if;

  select ticket.* into v_searching_ticket
  from fcg_private.standard_matchmaking_tickets ticket
  where ticket.user_id = p_user_id and ticket.state = 'searching'
  order by ticket.created_at, ticket.ticket_id
  limit 1 for update;
  if found then
    update fcg_private.standard_matchmaking_tickets ticket
    set state = 'cancelled', resolved_at = now(), heartbeat_at = now()
    where ticket.ticket_id = v_searching_ticket.ticket_id and ticket.state = 'searching';
  end if;

  select room.id, member.seat, room.opponent_kind, room.cpu_character_id
  into v_room_id, v_seat, v_opponent_kind, v_cpu_character_id
  from public.fcg_room_members member
  join public.fcg_rooms room on room.id = member.room_id
  where member.user_id = p_user_id and room.game_mode = 'standard_v5'
    and room.status in ('waiting', 'ready', 'playing') and room.expires_at > now()
  order by room.created_at desc, room.id
  limit 1 for update of room;
  if found then
    insert into fcg_private.standard_cpu_start_receipts
      (user_id, action_id, action_fingerprint, result_kind, room_id, seat, opponent_kind, cpu_character_id)
    values
      (p_user_id, p_action_id, v_fingerprint, 'recovered_existing', v_room_id, v_seat, v_opponent_kind, v_cpu_character_id);
    return query select v_room_id, v_seat, v_opponent_kind, v_cpu_character_id, false, true;
    return;
  end if;

  select profile.display_name, profile.revision
  into v_human_display_name, v_human_profile_revision
  from public.fcg_standard_profiles profile
  where profile.user_id = p_user_id
  for share;
  if not found then raise exception 'STANDARD_PROFILE_REQUIRED' using errcode = 'P0002'; end if;

  for v_attempt in 1..12 loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
    begin
      insert into public.fcg_rooms
        (code_hash, host_user_id, game_mode, access_mode, opponent_kind, status, expires_at,
         cpu_character_id, cpu_policy_version, cpu_user_id)
      values
        (encode(extensions.digest(v_code, 'sha256'), 'hex'), p_user_id, 'standard_v5', 'cpu', 'cpu',
         'ready', now() + interval '24 hours', p_character_id, p_policy_version, p_cpu_user_id)
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      v_room_id := null;
    end;
  end loop;
  if v_room_id is null then raise exception 'could not allocate immediate CPU room' using errcode = 'P0001'; end if;

  insert into public.fcg_standard_profiles (user_id, revision, display_name, profile_state)
  values (p_cpu_user_id, 1, btrim(p_cpu_display_name), p_cpu_profile_state);
  insert into fcg_private.standard_cpu_profile_owners (room_id, cpu_user_id)
  values (v_room_id, p_cpu_user_id);
  insert into public.fcg_room_members (room_id, user_id, seat, display_name)
  values (v_room_id, p_user_id, 'A', v_human_display_name),
         (v_room_id, p_cpu_user_id, 'B', btrim(p_cpu_display_name));
  insert into fcg_private.standard_room_setups
    (room_id, user_id, seat, setup_revision, profile_revision, quote_id, quote_expires_at, loadout, loadout_fingerprint)
  values
    (v_room_id, p_cpu_user_id, 'B', 1, 1, extensions.gen_random_uuid(), now() + interval '24 hours',
     p_cpu_loadout, p_loadout_fingerprint);

  insert into fcg_private.standard_cpu_start_receipts
    (user_id, action_id, action_fingerprint, result_kind, room_id, seat, opponent_kind, cpu_character_id)
  values
    (p_user_id, p_action_id, v_fingerprint, 'created', v_room_id, 'A', 'cpu', p_character_id);
  return query select v_room_id, 'A'::text, 'cpu'::text, p_character_id, false, false;
end;
$$;

revoke all on function public.fcg_standard_server_start_cpu(uuid, uuid, uuid, text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_start_cpu(uuid, uuid, uuid, text, text, text, jsonb, jsonb, text)
  to service_role;
