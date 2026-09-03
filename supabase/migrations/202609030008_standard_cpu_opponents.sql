-- Explicit-consent CPU opponents backed by one per-room, login-impossible profile.

alter table public.fcg_rooms
  add column if not exists cpu_character_id text,
  add column if not exists cpu_policy_version text,
  add column if not exists cpu_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fcg_rooms_cpu_identity_check'
      and conrelid = 'public.fcg_rooms'::regclass
  ) then
    alter table public.fcg_rooms add constraint fcg_rooms_cpu_identity_check check (
      (opponent_kind = 'cpu') = (cpu_character_id is not null and cpu_policy_version is not null and cpu_user_id is not null)
    );
  end if;
end
$$;

create table if not exists fcg_private.standard_cpu_profile_owners (
  room_id uuid primary key references public.fcg_rooms(id) on delete cascade,
  cpu_user_id uuid not null unique
);
alter table fcg_private.standard_cpu_profile_owners enable row level security;
revoke all on table fcg_private.standard_cpu_profile_owners from public, anon, authenticated;

create or replace function fcg_private.fcg_delete_standard_cpu_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.fcg_standard_profiles profile where profile.user_id = old.cpu_user_id;
  return old;
end;
$$;
revoke all on function fcg_private.fcg_delete_standard_cpu_profile() from public, anon, authenticated;

drop trigger if exists fcg_delete_standard_cpu_profile_after_room on fcg_private.standard_cpu_profile_owners;
create trigger fcg_delete_standard_cpu_profile_after_room
after delete on fcg_private.standard_cpu_profile_owners
for each row execute function fcg_private.fcg_delete_standard_cpu_profile();

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
      or p_character_id not in ('yuzu','ren','minato','koharu','aoi','kai','tsubasa','shion','rei','kurogane')
      or p_policy_version <> 'standard-character-roster-v1:' || p_character_id
      or char_length(btrim(coalesce(p_display_name, ''))) < 1 or char_length(btrim(p_display_name)) > 20
      or p_profile_state is null or p_loadout is null or p_loadout_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid Standard CPU opponent' using errcode = '22023';
  end if;

  select ticket.* into v_ticket from fcg_private.standard_matchmaking_tickets ticket
  where ticket.ticket_id = p_ticket_id and ticket.user_id = p_user_id for update;
  if not found then raise exception 'MATCHMAKING_TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ticket.state = 'claimed' then
    select room.id into v_room_id from public.fcg_rooms room
    where room.id = v_ticket.room_id and room.opponent_kind = 'cpu' and room.cpu_character_id = p_character_id;
    if v_room_id is null then raise exception 'MATCHMAKING_ALREADY_RESOLVED' using errcode = '55000'; end if;
    return query select 'matched'::text, v_room_id, 'A'::text, p_character_id, true;
    return;
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

create or replace function public.fcg_standard_server_load_room_v2(p_room_id uuid, p_actor_id uuid)
returns table (
  room_status text, room_version bigint, actor_seat text, authoritative_state jsonb,
  action_public_state jsonb, actor_private_state jsonb, setup_a jsonb, setup_b jsonb,
  profile_a_state jsonb, profile_b_state jsonb, profile_a_revision bigint, profile_b_revision bigint,
  opponent_kind text, cpu_character_id text, cpu_policy_version text, cpu_user_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select room.status, room.version, actor.seat, authority.state, room.public_state,
    actor_view.private_state, setup_a.loadout, setup_b.loadout,
    profile_a.profile_state, profile_b.profile_state, profile_a.revision, profile_b.revision,
    room.opponent_kind, room.cpu_character_id, room.cpu_policy_version, room.cpu_user_id
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

revoke all on function public.fcg_standard_server_accept_cpu(uuid, uuid, uuid, text, text, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.fcg_standard_server_load_room_v2(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fcg_standard_server_accept_cpu(uuid, uuid, uuid, text, text, text, jsonb, jsonb, text) to service_role;
grant execute on function public.fcg_standard_server_load_room_v2(uuid, uuid) to service_role;

create or replace function public.fcg_standard_room_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_snapshot jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_room_id is null then raise exception 'room id required' using errcode = '22023'; end if;
  select jsonb_build_object(
    'snapshot_schema_version',1,'snapshot_version',room.version,'server_time',statement_timestamp(),
    'room',jsonb_build_object('id',room.id,'status',room.status,'version',room.version,'game_mode',room.game_mode,
      'access_mode',room.access_mode,'opponent_kind',room.opponent_kind,'cpu_character_id',room.cpu_character_id,
      'cpu_policy_version',room.cpu_policy_version,'public_state',room.public_state,'winner_seat',room.winner_seat,'expires_at',room.expires_at),
    'members',members.value,'view',player_view.value,'profile',profile.value
  ) into v_snapshot
  from public.fcg_rooms room
  join public.fcg_room_members actor on actor.room_id=room.id and actor.user_id=v_user_id
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object('user_id',member.user_id,'seat',member.seat,
      'display_name',member.display_name,'is_cpu',member.user_id=room.cpu_user_id,'last_seen_at',member.last_seen_at) order by member.seat),'[]'::jsonb) value
    from public.fcg_room_members member where member.room_id=room.id
  ) members
  left join lateral (
    select jsonb_build_object('seat',own_view.seat,'version',own_view.version,'private_state',own_view.private_state) value
    from public.fcg_player_views own_view where own_view.room_id=room.id and own_view.user_id=v_user_id
  ) player_view on true
  left join lateral (
    select jsonb_build_object('revision',own_profile.revision,'display_name',own_profile.display_name,'profile_state',own_profile.profile_state) value
    from public.fcg_standard_profiles own_profile where own_profile.user_id=v_user_id
  ) profile on true
  where room.id=p_room_id and room.game_mode='standard_v5';
  if v_snapshot is null then raise exception 'room not found or caller is not a member' using errcode = 'P0002'; end if;
  return v_snapshot;
end;
$$;
revoke all on function public.fcg_standard_room_snapshot(uuid) from public, anon;
grant execute on function public.fcg_standard_room_snapshot(uuid) to authenticated;
