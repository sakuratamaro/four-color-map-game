-- Preserve hardened join-failure accounting without allowing Standard callers
-- to enter Quick rooms. Failed joins return the same generic row and commit the
-- base RPC's rate-limit update instead of raising and rolling it back.

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
  v_code text := upper(regexp_replace(coalesce(p_room_code, ''), '\s+', '', 'g'));
  v_mode text;
begin
  if v_code ~ '^[0-9A-F]{6}$' then
    select room.game_mode into v_mode
    from public.fcg_rooms room
    where room.code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex');
  end if;

  -- A real code for another mode is deliberately reduced to the same generic
  -- failed attempt as an unknown code. The base transaction records it.
  select joined.* into v_joined
  from public.fcg_join_room(
    case when v_mode is not null and v_mode <> 'standard_v5'
      then 'STANDARD_MODE_MISMATCH'
      else p_room_code
    end,
    p_display_name
  ) joined;

  if not found or v_joined.room_id is null then
    return query select null::uuid, 'ERROR_JOIN_FAILED'::text,
      coalesce(v_joined.room_status, 'join_failed'::text),
      coalesce(v_joined.room_version, 0::bigint), null::text;
    return;
  end if;

  select room.game_mode into v_mode
  from public.fcg_rooms room
  where room.id = v_joined.room_id;
  if v_mode <> 'standard_v5' then
    raise exception 'room mode changed during join' using errcode = '40001';
  end if;
  return query select v_joined.room_id, v_joined.seat, v_joined.room_status,
    v_joined.room_version, v_mode;
end;
$$;

revoke all on function public.fcg_standard_join_room(text, text) from public, anon;
grant execute on function public.fcg_standard_join_room(text, text) to authenticated;
