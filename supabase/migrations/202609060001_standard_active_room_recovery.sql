-- Read-only recovery boundary for a caller whose local room identity was lost.
-- Returning at most two rows lets the client distinguish none, one, and an
-- invariant-breaking legacy duplicate without choosing a room arbitrarily.

create or replace function public.fcg_standard_active_room()
returns table (
  room_id uuid,
  seat text,
  room_status text,
  room_version bigint,
  access_mode text,
  opponent_kind text,
  cpu_character_id text,
  setup_revision bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    room.id,
    member.seat,
    room.status,
    room.version,
    room.access_mode,
    room.opponent_kind,
    room.cpu_character_id,
    coalesce(own_setup.setup_revision, 0::bigint)
  from public.fcg_room_members member
  join public.fcg_rooms room on room.id = member.room_id
  left join fcg_private.standard_room_setups own_setup
    on own_setup.room_id = room.id
    and own_setup.user_id = member.user_id
  where member.user_id = (select auth.uid())
    and room.game_mode = 'standard_v5'
    and room.status in ('waiting', 'ready', 'playing')
    and room.expires_at > now()
  order by room.created_at desc, room.id
  limit 2
$$;

revoke all on function public.fcg_standard_active_room() from public, anon;
grant execute on function public.fcg_standard_active_room() to authenticated;
