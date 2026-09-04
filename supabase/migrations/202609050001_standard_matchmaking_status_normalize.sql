-- Keep the private ticket state internal while exposing the stable public
-- matchmaking contract used by both the client and live canary.

create or replace function public.fcg_standard_matchmaking_status(p_ticket_id uuid)
returns table (ticket_id uuid, matchmaking_status text, room_id uuid, seat text, wait_started_at timestamptz, server_time timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ticket fcg_private.standard_matchmaking_tickets%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_ticket_id is null then raise exception 'invalid matchmaking ticket' using errcode = '22023'; end if;
  if fcg_private.fcg_standard_matchmaking_rate_limited(v_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  select ticket.* into v_ticket from fcg_private.standard_matchmaking_tickets ticket
  where ticket.ticket_id = p_ticket_id and ticket.user_id = v_user_id for update;
  if not found then return query select p_ticket_id, 'expired'::text, null::uuid, null::text, null::timestamptz, now(); return; end if;
  if v_ticket.state = 'searching' and v_ticket.expires_at <= now() then
    update fcg_private.standard_matchmaking_tickets ticket set state = 'expired', resolved_at = now()
    where ticket.ticket_id = p_ticket_id;
    v_ticket.state := 'expired';
  elsif v_ticket.state = 'searching' then
    update fcg_private.standard_matchmaking_tickets ticket
    set heartbeat_at = now(), expires_at = now() + interval '2 minutes' where ticket.ticket_id = p_ticket_id;
  end if;
  return query select p_ticket_id,
    case when v_ticket.state = 'claimed' then 'matched'::text else v_ticket.state end,
    case when v_ticket.state = 'claimed' then v_ticket.room_id else null end,
    case when v_ticket.state = 'claimed' then 'A'::text else null::text end,
    v_ticket.created_at, now();
end;
$$;

revoke all on function public.fcg_standard_matchmaking_status(uuid) from public, anon;
grant execute on function public.fcg_standard_matchmaking_status(uuid) to authenticated;
