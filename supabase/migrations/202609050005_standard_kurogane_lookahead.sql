-- Kurogane-only public-information lookahead policy. Existing rooms retain the
-- v1 policy until a successful rematch; new Kurogane rooms receive v2.

create or replace function fcg_private.fcg_standard_cpu_policy_is_supported(
  p_character_id text,
  p_policy_version text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_character_id = 'kurogane' then p_policy_version in (
      'standard-character-roster-v1:kurogane',
      'standard-character-roster-v1:kurogane-lookahead-v2'
    )
    when p_character_id in ('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei')
      then p_policy_version = 'standard-character-roster-v1:' || p_character_id
    else false
  end;
$$;

create or replace function fcg_private.fcg_standard_cpu_policy_is_current(
  p_character_id text,
  p_policy_version text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_character_id = 'kurogane'
      then p_policy_version = 'standard-character-roster-v1:kurogane-lookahead-v2'
    when p_character_id in ('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei')
      then p_policy_version = 'standard-character-roster-v1:' || p_character_id
    else false
  end;
$$;

revoke all on function fcg_private.fcg_standard_cpu_policy_is_supported(text, text) from public, anon, authenticated;
revoke all on function fcg_private.fcg_standard_cpu_policy_is_current(text, text) from public, anon, authenticated;

create or replace function public.fcg_standard_server_accept_cpu(
  p_user_id uuid,
  p_ticket_id uuid,
  p_cpu_user_id uuid,
  p_character_id text,
  p_policy_version text,
  p_display_name text,
  p_profile_state jsonb,
  p_loadout jsonb,
  p_loadout_fingerprint text
)
returns table (matchmaking_status text, room_id uuid, seat text, cpu_character_id text, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket fcg_private.standard_matchmaking_tickets%rowtype;
  v_room_id uuid;
  v_code text;
  v_attempt integer;
begin
  if p_user_id is null or p_ticket_id is null or p_cpu_user_id is null
      or not fcg_private.fcg_standard_cpu_policy_is_supported(p_character_id, p_policy_version)
      or char_length(btrim(coalesce(p_display_name, ''))) < 1 or char_length(btrim(p_display_name)) > 20
      or p_profile_state is null or p_loadout is null or p_loadout_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid Standard CPU opponent' using errcode = '22023';
  end if;

  select ticket.* into v_ticket from fcg_private.standard_matchmaking_tickets ticket
  where ticket.ticket_id = p_ticket_id and ticket.user_id = p_user_id for update;
  if not found then raise exception 'MATCHMAKING_TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ticket.state = 'claimed' then
    select room.id into v_room_id from public.fcg_rooms room
    where room.id = v_ticket.room_id and room.opponent_kind = 'cpu'
      and room.cpu_character_id = p_character_id
      and fcg_private.fcg_standard_cpu_policy_is_supported(room.cpu_character_id, room.cpu_policy_version);
    if v_room_id is null then raise exception 'MATCHMAKING_ALREADY_RESOLVED' using errcode = '55000'; end if;
    return query select 'matched'::text, v_room_id, 'A'::text, p_character_id, true;
    return;
  end if;
  if not fcg_private.fcg_standard_cpu_policy_is_current(p_character_id, p_policy_version) then
    raise exception 'retired Standard CPU policy cannot create a room' using errcode = '22023';
  end if;
  if v_ticket.state <> 'searching' or v_ticket.expires_at <= now() then
    if v_ticket.state = 'searching' then
      update fcg_private.standard_matchmaking_tickets set state = 'expired', resolved_at = now() where ticket_id = p_ticket_id;
    end if;
    raise exception 'MATCHMAKING_TICKET_EXPIRED' using errcode = '55000';
  end if;
  if v_ticket.created_at > now() - interval '90 seconds' then
    raise exception 'CPU_CONSENT_TOO_EARLY' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.fcg_room_members member join public.fcg_rooms room on room.id = member.room_id
    where member.user_id = p_user_id and room.game_mode = 'standard_v5'
      and room.status in ('waiting','ready','playing') and room.expires_at > now()
  ) then raise exception 'MATCHMAKING_ALREADY_IN_ROOM' using errcode = '55000'; end if;

  for v_attempt in 1..12 loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
    begin
      insert into public.fcg_rooms
        (code_hash, host_user_id, game_mode, access_mode, opponent_kind, status, expires_at, cpu_character_id, cpu_policy_version, cpu_user_id)
      values
        (encode(extensions.digest(v_code, 'sha256'), 'hex'), p_user_id, 'standard_v5', 'cpu', 'cpu', 'ready', now() + interval '24 hours', p_character_id, p_policy_version, p_cpu_user_id)
      returning id into v_room_id;
      exit;
    exception when unique_violation then v_room_id := null;
    end;
  end loop;
  if v_room_id is null then raise exception 'could not allocate CPU room' using errcode = 'P0001'; end if;

  insert into public.fcg_standard_profiles (user_id, revision, display_name, profile_state)
  values (p_cpu_user_id, 1, btrim(p_display_name), p_profile_state);
  insert into fcg_private.standard_cpu_profile_owners (room_id, cpu_user_id) values (v_room_id, p_cpu_user_id);
  insert into public.fcg_room_members (room_id, user_id, seat, display_name)
  values (v_room_id, p_user_id, 'A', v_ticket.display_name),
         (v_room_id, p_cpu_user_id, 'B', btrim(p_display_name));
  insert into fcg_private.standard_room_setups
    (room_id, user_id, seat, setup_revision, profile_revision, quote_id, quote_expires_at, loadout, loadout_fingerprint)
  values
    (v_room_id, p_cpu_user_id, 'B', 1, 1, extensions.gen_random_uuid(), now() + interval '24 hours', p_loadout, p_loadout_fingerprint);
  update fcg_private.standard_matchmaking_tickets ticket
  set state = 'claimed', room_id = v_room_id, resolved_at = now(), heartbeat_at = now()
  where ticket.ticket_id = p_ticket_id and ticket.state = 'searching';
  if not found then raise exception 'MATCHMAKING_ALREADY_RESOLVED' using errcode = '40001'; end if;
  return query select 'matched'::text, v_room_id, 'A'::text, p_character_id, false;
end;
$$;

revoke all on function public.fcg_standard_server_accept_cpu(uuid, uuid, uuid, text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_accept_cpu(uuid, uuid, uuid, text, text, text, jsonb, jsonb, text)
  to service_role;

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
  v_legacy_fingerprint text;
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
  if p_character_id = 'kurogane'
      and p_policy_version = 'standard-character-roster-v1:kurogane-lookahead-v2' then
    v_legacy_fingerprint := encode(extensions.digest(
      jsonb_build_object(
        'operation', 'cpu-start',
        'character_id', p_character_id,
        'policy_version', 'standard-character-roster-v1:kurogane',
        'display_name', btrim(p_cpu_display_name),
        'profile_state', p_cpu_profile_state,
        'loadout', p_cpu_loadout,
        'loadout_fingerprint', p_loadout_fingerprint
      )::text,
      'sha256'
    ), 'hex');
  end if;

  if fcg_private.fcg_standard_matchmaking_rate_limited(p_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select receipt.* into v_receipt
  from fcg_private.standard_cpu_start_receipts receipt
  where receipt.user_id = p_user_id and receipt.action_id = p_action_id
  for update;
  if found then
    if v_receipt.action_fingerprint <> v_fingerprint
        and v_receipt.action_fingerprint is distinct from v_legacy_fingerprint then
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

create or replace function public.fcg_standard_server_request_cpu_rematch(
  p_user_id uuid,
  p_room_id uuid,
  p_expected_version bigint,
  p_action_id uuid,
  p_character_id text,
  p_policy_version text,
  p_cpu_display_name text,
  p_cpu_profile_state jsonb,
  p_cpu_loadout jsonb,
  p_loadout_fingerprint text
)
returns table (room_status text, room_version bigint, ready_to_setup boolean, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.fcg_rooms%rowtype;
  v_receipt fcg_private.standard_rematch_receipts%rowtype;
  v_fingerprint text;
  v_cpu_profile_revision bigint;
  v_result jsonb;
begin
  if p_user_id is null or p_room_id is null or p_action_id is null or p_expected_version < 0
      or not fcg_private.fcg_standard_cpu_policy_is_supported(p_character_id, p_policy_version)
      or char_length(btrim(coalesce(p_cpu_display_name, ''))) < 1 or char_length(btrim(p_cpu_display_name)) > 20
      or p_cpu_profile_state is null or p_cpu_loadout is null or p_loadout_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid Standard CPU rematch' using errcode = '22023';
  end if;
  v_fingerprint := encode(extensions.digest(
    p_user_id::text || ':' || p_room_id::text || ':' || p_expected_version::text,
    'sha256'
  ), 'hex');

  select room.* into v_room from public.fcg_rooms room where room.id = p_room_id for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;

  select receipt.* into v_receipt from fcg_private.standard_rematch_receipts receipt
  where receipt.room_id = p_room_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.actor_id <> p_user_id or v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'rematch action id reuse' using errcode = '23505';
    end if;
    return query select v_receipt.result->>'roomStatus', (v_receipt.result->>'roomVersion')::bigint,
      (v_receipt.result->>'readyToSetup')::boolean, true;
    return;
  end if;
  if not fcg_private.fcg_standard_cpu_policy_is_current(p_character_id, p_policy_version) then
    raise exception 'retired Standard CPU policy cannot start a rematch' using errcode = '22023';
  end if;

  if v_room.game_mode <> 'standard_v5' or v_room.status <> 'finished' or v_room.opponent_kind <> 'cpu'
      or v_room.cpu_character_id <> p_character_id
      or not fcg_private.fcg_standard_cpu_policy_is_supported(v_room.cpu_character_id, v_room.cpu_policy_version)
      or v_room.cpu_user_id is null then
    raise exception 'Standard CPU room is not ready for rematch' using errcode = '55000';
  end if;
  if v_room.version <> p_expected_version then raise exception 'stale match version' using errcode = 'PT409'; end if;
  if not exists (
    select 1 from public.fcg_room_members member
    where member.room_id = p_room_id and member.user_id = p_user_id and member.seat = 'A'
  ) then raise exception 'actor is not the human CPU-room member' using errcode = '42501'; end if;

  perform 1 from public.fcg_standard_profiles profile where profile.user_id = v_room.cpu_user_id for update;
  if not found then raise exception 'CPU profile not found' using errcode = 'P0002'; end if;

  delete from fcg_private.standard_room_setups where room_id = p_room_id;
  delete from public.fcg_player_views where room_id = p_room_id;
  delete from fcg_private.authoritative_matches where room_id = p_room_id and game_mode = 'standard_v5';
  delete from fcg_private.standard_rematch_votes where room_id = p_room_id;

  update public.fcg_standard_profiles
  set revision = revision + 1, display_name = btrim(p_cpu_display_name), profile_state = p_cpu_profile_state, updated_at = now()
  where user_id = v_room.cpu_user_id
  returning revision into v_cpu_profile_revision;

  insert into fcg_private.standard_room_setups
    (room_id, user_id, seat, setup_revision, profile_revision, quote_id, quote_expires_at, loadout, loadout_fingerprint)
  values
    (p_room_id, v_room.cpu_user_id, 'B', 1, v_cpu_profile_revision, extensions.gen_random_uuid(), now() + interval '24 hours', p_cpu_loadout, p_loadout_fingerprint);

  update public.fcg_rooms
  set status = 'ready', version = p_expected_version + 1, public_state = '{}'::jsonb,
      winner_seat = null, started_at = null, finished_at = null, updated_at = now(),
      last_activity_at = now(), expires_at = now() + interval '24 hours', cpu_policy_version = p_policy_version
  where id = p_room_id and status = 'finished' and version = p_expected_version;
  if not found then raise exception 'stale match version' using errcode = 'PT409'; end if;

  v_result := jsonb_build_object('roomStatus','ready','roomVersion',p_expected_version + 1,'readyToSetup',true);
  insert into fcg_private.standard_rematch_receipts
    (room_id, action_id, actor_id, request_fingerprint, result)
  values (p_room_id, p_action_id, p_user_id, v_fingerprint, v_result);

  return query select 'ready'::text, p_expected_version + 1, true, false;
end;
$$;

revoke all on function public.fcg_standard_server_request_cpu_rematch(uuid, uuid, bigint, uuid, text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_request_cpu_rematch(uuid, uuid, bigint, uuid, text, text, text, jsonb, jsonb, text)
  to service_role;
