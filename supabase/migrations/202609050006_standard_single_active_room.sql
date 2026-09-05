-- Enforce one live Standard membership per actor at the final database write.
-- Existing rows are never deleted or rewritten by this migration.

create or replace function fcg_private.fcg_standard_guard_member_active_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.fcg_rooms%rowtype;
begin
  select room.* into v_room
  from public.fcg_rooms room
  where room.id = new.room_id
  for share;

  if not found or v_room.game_mode <> 'standard_v5'
      or v_room.status not in ('waiting', 'ready', 'playing')
      or v_room.expires_at <= now() then
    return new;
  end if;

  -- A finder can hold its own actor lock while inserting the waiting actor.
  -- Do not wait into a reciprocal-lock deadlock; expose a finite retry instead.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0)) then
    raise exception 'STANDARD_ACTOR_BUSY' using errcode = '40001';
  end if;

  if exists (
    select 1
    from public.fcg_room_members member
    join public.fcg_rooms room on room.id = member.room_id
    where member.user_id = new.user_id
      and member.room_id <> new.room_id
      and room.game_mode = 'standard_v5'
      and room.status in ('waiting', 'ready', 'playing')
      and room.expires_at > now()
  ) then
    raise exception 'STANDARD_ALREADY_IN_ROOM' using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function fcg_private.fcg_standard_guard_room_reactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not (
    new.game_mode = 'standard_v5'
    and new.status in ('waiting', 'ready', 'playing')
    and new.expires_at > now()
    and not (
      old.game_mode = 'standard_v5'
      and old.status in ('waiting', 'ready', 'playing')
      and old.expires_at > now()
    )
  ) then
    return new;
  end if;

  -- Lock every participant in a stable order before checking another room.
  for v_user_id in
    select member.user_id
    from public.fcg_room_members member
    where member.room_id = new.id
    order by member.user_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  end loop;

  if exists (
    select 1
    from public.fcg_room_members own_member
    join public.fcg_room_members other_member on other_member.user_id = own_member.user_id
    join public.fcg_rooms other_room on other_room.id = other_member.room_id
    where own_member.room_id = new.id
      and other_member.room_id <> new.id
      and other_room.game_mode = 'standard_v5'
      and other_room.status in ('waiting', 'ready', 'playing')
      and other_room.expires_at > now()
  ) then
    raise exception 'STANDARD_ALREADY_IN_ROOM' using errcode = '55000';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname = 'fcg_standard_member_single_active_room'
      and tgrelid = 'public.fcg_room_members'::regclass
      and not tgisinternal
  ) then
    create trigger fcg_standard_member_single_active_room
      before insert or update of room_id, user_id on public.fcg_room_members
      for each row execute function fcg_private.fcg_standard_guard_member_active_room();
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname = 'fcg_standard_room_reactivation_single_active'
      and tgrelid = 'public.fcg_rooms'::regclass
      and not tgisinternal
  ) then
    create trigger fcg_standard_room_reactivation_single_active
      before update of status, expires_at, game_mode on public.fcg_rooms
      for each row execute function fcg_private.fcg_standard_guard_room_reactivation();
  end if;
end
$$;

revoke all on function fcg_private.fcg_standard_guard_member_active_room()
  from public, anon, authenticated;
revoke all on function fcg_private.fcg_standard_guard_room_reactivation()
  from public, anon, authenticated;

-- Read-only rollout evidence: report pre-existing duplicate actors without
-- mutating historical rooms. New writes are guarded by the triggers above.
do $$
declare
  v_existing_duplicate_actors bigint;
begin
  select count(*) into v_existing_duplicate_actors
  from (
    select member.user_id
    from public.fcg_room_members member
    join public.fcg_rooms room on room.id = member.room_id
    where room.game_mode = 'standard_v5'
      and room.status in ('waiting', 'ready', 'playing')
      and room.expires_at > now()
    group by member.user_id
    having count(*) > 1
  ) duplicates;
  raise notice 'existing Standard actors with multiple active rooms: %', v_existing_duplicate_actors;
end
$$;
