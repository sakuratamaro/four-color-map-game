-- One-click CPU rematch: reset the synthetic opponent and keep the human setup explicit.

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
      or p_character_id not in ('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei','kurogane')
      or p_policy_version <> 'standard-character-roster-v1:' || p_character_id
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

  if v_room.game_mode <> 'standard_v5' or v_room.status <> 'finished' or v_room.opponent_kind <> 'cpu'
      or v_room.cpu_character_id <> p_character_id or v_room.cpu_policy_version <> p_policy_version
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
      last_activity_at = now(), expires_at = now() + interval '24 hours'
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
