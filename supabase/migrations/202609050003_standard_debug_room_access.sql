-- Supply the service-loaded room policy required by private debug setup.
-- Existing result columns keep their order; access_mode is appended.

begin;

drop function public.fcg_standard_server_load_room_v2(uuid, uuid);

create function public.fcg_standard_server_load_room_v2(p_room_id uuid, p_actor_id uuid)
returns table (
  room_status text, room_version bigint, actor_seat text, authoritative_state jsonb,
  action_public_state jsonb, actor_private_state jsonb, setup_a jsonb, setup_b jsonb,
  profile_a_state jsonb, profile_b_state jsonb, profile_a_revision bigint, profile_b_revision bigint,
  opponent_kind text, cpu_character_id text, cpu_policy_version text, cpu_user_id uuid,
  access_mode text
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
    room.access_mode
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

revoke all on function public.fcg_standard_server_load_room_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_load_room_v2(uuid, uuid)
  to service_role;

commit;
