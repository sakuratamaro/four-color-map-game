-- Standard action replay preflight for retries that arrive after state advanced.
-- UNAPPLIED: service-only and additive; it does not alter Quick-mode contracts.

create or replace function public.fcg_standard_server_replay_action(
  p_room_id uuid,
  p_actor_id uuid,
  p_action_id uuid,
  p_action_fingerprint text
)
returns table (found boolean, action_result jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_receipt fcg_private.standard_action_receipts%rowtype;
begin
  if p_room_id is null or p_actor_id is null or p_action_id is null
      or p_action_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid action replay lookup' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.fcg_room_members member
    join public.fcg_rooms room on room.id = member.room_id
    where member.room_id = p_room_id
      and member.user_id = p_actor_id
      and room.game_mode = 'standard_v5'
  ) then
    raise exception 'actor is not a Standard room member' using errcode = '42501';
  end if;

  select receipt.* into v_receipt
  from fcg_private.standard_action_receipts receipt
  where receipt.room_id = p_room_id and receipt.action_id = p_action_id;
  if not found then
    return query select false, null::jsonb;
    return;
  end if;
  if v_receipt.actor_id <> p_actor_id or v_receipt.action_fingerprint <> p_action_fingerprint then
    raise exception 'action id reuse' using errcode = '23505';
  end if;
  return query select true, v_receipt.result;
end;
$$;

revoke all on function public.fcg_standard_server_replay_action(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_replay_action(uuid, uuid, uuid, text)
  to service_role;
