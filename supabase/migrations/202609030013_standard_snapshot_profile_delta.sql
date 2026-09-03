-- Avoid returning the full owner profile on every room refresh.

create or replace function fcg_private.fcg_standard_safe_appearance(p_profile_state jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'board',case when p_profile_state #>> '{equipped,board}' in
      ('boardDefault','boardAurora','boardGold','boardCartographer')
      then p_profile_state #>> '{equipped,board}' else 'boardDefault' end,
    'effect',case when p_profile_state #>> '{equipped,effect}' in
      ('effectDefault','effectSakura','effectPrism','effectMasterpiece')
      then p_profile_state #>> '{equipped,effect}' else 'effectDefault' end,
    'nameplate',case when p_profile_state #>> '{equipped,nameplate}' in
      ('nameplateDefault','nameplateGold')
      then p_profile_state #>> '{equipped,nameplate}' else 'nameplateDefault' end,
    'title',case when p_profile_state #>> '{equipped,title}' in
      ('titleNone','titleArtisan')
      then p_profile_state #>> '{equipped,title}' else 'titleNone' end
  );
$$;

revoke all on function fcg_private.fcg_standard_safe_appearance(jsonb) from public, anon, authenticated;
grant execute on function fcg_private.fcg_standard_safe_appearance(jsonb) to service_role;

alter table public.fcg_standard_profiles
  add column if not exists appearance jsonb not null default
    '{"board":"boardDefault","effect":"effectDefault","nameplate":"nameplateDefault","title":"titleNone"}'::jsonb;

update public.fcg_standard_profiles profile
set appearance = fcg_private.fcg_standard_safe_appearance(profile.profile_state)
where profile.appearance is distinct from fcg_private.fcg_standard_safe_appearance(profile.profile_state);

create or replace function fcg_private.fcg_standard_sync_profile_appearance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.appearance := fcg_private.fcg_standard_safe_appearance(new.profile_state);
  return new;
end;
$$;

revoke all on function fcg_private.fcg_standard_sync_profile_appearance() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'fcg_standard_profile_appearance_sync'
      and tgrelid = 'public.fcg_standard_profiles'::regclass and not tgisinternal
  ) then
    create trigger fcg_standard_profile_appearance_sync
    before insert or update of profile_state on public.fcg_standard_profiles
    for each row execute function fcg_private.fcg_standard_sync_profile_appearance();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fcg_standard_profiles_safe_appearance_check'
      and conrelid = 'public.fcg_standard_profiles'::regclass
  ) then
    alter table public.fcg_standard_profiles add constraint fcg_standard_profiles_safe_appearance_check
      check (appearance = fcg_private.fcg_standard_safe_appearance(profile_state));
  end if;
end
$$;

create or replace function public.fcg_standard_room_snapshot_v2(p_room_id uuid, p_known_profile_revision bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_snapshot jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_room_id is null or (p_known_profile_revision is not null and p_known_profile_revision < 0) then
    raise exception 'invalid snapshot request' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'snapshot_schema_version',2,'snapshot_version',room.version,'server_time',statement_timestamp(),
    'room',jsonb_build_object('id',room.id,'status',room.status,'version',room.version,'game_mode',room.game_mode,
      'access_mode',room.access_mode,'opponent_kind',room.opponent_kind,'cpu_character_id',room.cpu_character_id,
      'cpu_policy_version',room.cpu_policy_version,'public_state',room.public_state,'winner_seat',room.winner_seat,'expires_at',room.expires_at),
    'members',members.value,'view',player_view.value,'profile_revision',own_profile.revision,
    'profile',case when p_known_profile_revision = own_profile.revision then null
      else jsonb_build_object('revision',own_profile.revision,'display_name',own_profile.display_name,'profile_state',own_profile.profile_state) end
  ) into v_snapshot
  from public.fcg_rooms room
  join public.fcg_room_members actor on actor.room_id=room.id and actor.user_id=v_user_id
  join public.fcg_standard_profiles own_profile on own_profile.user_id=v_user_id
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',member.user_id,'seat',member.seat,'display_name',member.display_name,
      'is_cpu',member.user_id=room.cpu_user_id,'last_seen_at',member.last_seen_at,
      'appearance',coalesce(member_profile.appearance,
        '{"board":"boardDefault","effect":"effectDefault","nameplate":"nameplateDefault","title":"titleNone"}'::jsonb)
    ) order by member.seat),'[]'::jsonb) value
    from public.fcg_room_members member
    left join public.fcg_standard_profiles member_profile on member_profile.user_id=member.user_id
    where member.room_id=room.id
  ) members
  left join lateral (
    select jsonb_build_object('seat',own_view.seat,'version',own_view.version,'private_state',own_view.private_state) value
    from public.fcg_player_views own_view where own_view.room_id=room.id and own_view.user_id=v_user_id
  ) player_view on true
  where room.id=p_room_id and room.game_mode='standard_v5';
  if v_snapshot is null then raise exception 'room not found or caller is not a member' using errcode = 'P0002'; end if;
  return v_snapshot;
end;
$$;

revoke all on function public.fcg_standard_room_snapshot_v2(uuid, bigint) from public, anon;
grant execute on function public.fcg_standard_room_snapshot_v2(uuid, bigint) to authenticated;
