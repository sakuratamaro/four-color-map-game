-- Privacy-preserving availability signal for the global matchmaking notice.
-- The caller learns only whether at least one joinable foreign ticket exists.

create or replace function public.fcg_standard_matchmaking_availability()
returns table (
  has_waiting_opponent boolean,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return query
  select
    exists (
      select 1
      from fcg_private.standard_matchmaking_tickets ticket
      where ticket.state = 'searching'
        and ticket.expires_at > pg_catalog.statement_timestamp()
        and ticket.user_id <> v_user_id
        and not exists (
          select 1
          from public.fcg_room_members member
          join public.fcg_rooms room on room.id = member.room_id
          where member.user_id = ticket.user_id
            and room.game_mode = 'standard_v5'
            and room.status in ('waiting', 'ready', 'playing')
            and room.expires_at > pg_catalog.statement_timestamp()
        )
    ) as has_waiting_opponent,
    pg_catalog.statement_timestamp() as observed_at;
end;
$$;

revoke all on function public.fcg_standard_matchmaking_availability() from public, anon;
grant execute on function public.fcg_standard_matchmaking_availability() to authenticated;
