-- Immediate, explicit Standard CPU play. The existing 90-second fallback RPC is
-- intentionally left unchanged; this is a separate service-only operation.

create table if not exists fcg_private.standard_cpu_start_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null,
  action_fingerprint text not null check (action_fingerprint ~ '^[0-9a-f]{64}$'),
  result_kind text not null check (result_kind in ('created', 'recovered_existing')),
  room_id uuid not null references public.fcg_rooms(id) on delete cascade,
  seat text not null check (seat in ('A', 'B')),
  opponent_kind text not null check (opponent_kind in ('human', 'cpu')),
  cpu_character_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, action_id),
  check ((opponent_kind = 'cpu') = (cpu_character_id is not null))
);

create index if not exists fcg_standard_cpu_start_receipt_cleanup_idx
  on fcg_private.standard_cpu_start_receipts (created_at, user_id, action_id);

alter table fcg_private.standard_cpu_start_receipts enable row level security;
revoke all on table fcg_private.standard_cpu_start_receipts from public, anon, authenticated;

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
      or p_character_id not in ('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei','kurogane')
      or p_policy_version <> 'standard-character-roster-v1:' || p_character_id
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

  if fcg_private.fcg_standard_matchmaking_rate_limited(p_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select receipt.* into v_receipt
  from fcg_private.standard_cpu_start_receipts receipt
  where receipt.user_id = p_user_id and receipt.action_id = p_action_id
  for update;
  if found then
    if v_receipt.action_fingerprint <> v_fingerprint then
      raise exception 'CPU start action ID reused with different input' using errcode = '23505';
    end if;
    return query select v_receipt.room_id, v_receipt.seat, v_receipt.opponent_kind,
      v_receipt.cpu_character_id, true, v_receipt.result_kind = 'recovered_existing';
    return;
  end if;

  -- A direct CPU choice supersedes this user's public search, but locks the
  -- ticket first so a simultaneous human finder and this operation cannot win.
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

  -- Recheck after resolving the ticket lock. A finder that won just before the
  -- lock is recovered here, rather than creating a second CPU room.
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
