-- Expose only allowlisted, capability-neutral equipped appearance to room members.

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
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',member.user_id,'seat',member.seat,'display_name',member.display_name,
      'is_cpu',member.user_id=room.cpu_user_id,'last_seen_at',member.last_seen_at,
      'appearance',jsonb_build_object(
        'board',case when member_profile.profile_state #>> '{equipped,board}' in
          ('boardDefault','boardAurora','boardGold','boardCartographer')
          then member_profile.profile_state #>> '{equipped,board}' else 'boardDefault' end,
        'effect',case when member_profile.profile_state #>> '{equipped,effect}' in
          ('effectDefault','effectSakura','effectPrism','effectMasterpiece')
          then member_profile.profile_state #>> '{equipped,effect}' else 'effectDefault' end,
        'nameplate',case when member_profile.profile_state #>> '{equipped,nameplate}' in
          ('nameplateDefault','nameplateGold')
          then member_profile.profile_state #>> '{equipped,nameplate}' else 'nameplateDefault' end,
        'title',case when member_profile.profile_state #>> '{equipped,title}' in
          ('titleNone','titleArtisan')
          then member_profile.profile_state #>> '{equipped,title}' else 'titleNone' end
      )) order by member.seat),'[]'::jsonb) value
    from public.fcg_room_members member
    left join public.fcg_standard_profiles member_profile on member_profile.user_id=member.user_id
    where member.room_id=room.id
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
