-- Mode-scoped browser join entry point for Standard rooms.
-- UNAPPLIED: delegates to the hardened join transaction and rolls it back if
-- the code belongs to another mode.

create or replace function public.fcg_standard_join_room(
  p_room_code text,
  p_display_name text
)
returns table (
  room_id uuid,
  seat text,
  room_status text,
  room_version bigint,
  game_mode text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_joined record;
  v_mode text;
begin
  select joined.* into v_joined
  from public.fcg_join_room(p_room_code, p_display_name) joined;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;

  select room.game_mode into v_mode
  from public.fcg_rooms room
  where room.id = v_joined.room_id;
  if v_mode <> 'standard_v5' then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  return query select v_joined.room_id, v_joined.seat, v_joined.room_status,
    v_joined.room_version, v_mode;
end;
$$;

revoke all on function public.fcg_standard_join_room(text, text) from public, anon;
grant execute on function public.fcg_standard_join_room(text, text) to authenticated;
