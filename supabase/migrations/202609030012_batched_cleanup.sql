-- Bounded, preview-first cleanup. Scheduling is intentionally separate from schema installation.

create index if not exists fcg_standard_matchmaking_resolved_cleanup_idx
  on fcg_private.standard_matchmaking_tickets (resolved_at, ticket_id)
  where state in ('claimed', 'cancelled', 'expired');
create index if not exists fcg_standard_matchmaking_expiry_cleanup_idx
  on fcg_private.standard_matchmaking_tickets (expires_at, ticket_id)
  where state = 'searching';
create index if not exists fcg_standard_matchmaking_find_cleanup_idx
  on fcg_private.standard_matchmaking_find_receipts (created_at, user_id, action_id);
create index if not exists fcg_standard_quiz_cleanup_idx
  on fcg_private.standard_quiz_sessions (expires_at, session_id);
create index if not exists fcg_standard_gacha_receipt_cleanup_idx
  on fcg_private.standard_gacha_receipts (created_at, user_id, action_id);
create index if not exists fcg_standard_card_sale_receipt_cleanup_idx
  on fcg_private.standard_card_sale_receipts (created_at, user_id, action_id);
create index if not exists fcg_standard_cosmetic_receipt_cleanup_idx
  on fcg_private.standard_cosmetic_receipts (created_at, user_id, action_id);
create index if not exists fcg_standard_matchmaking_limit_cleanup_idx
  on fcg_private.standard_matchmaking_limits (updated_at, user_id);

create or replace function public.fcg_server_cleanup_expired_batched(
  p_room_before timestamptz,
  p_ephemeral_before timestamptz,
  p_receipt_before timestamptz,
  p_batch_size integer default 100,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rooms bigint := 0;
  v_tickets_expired bigint := 0;
  v_tickets_deleted bigint := 0;
  v_find_receipts bigint := 0;
  v_quizzes bigint := 0;
  v_gacha_receipts bigint := 0;
  v_card_sale_receipts bigint := 0;
  v_cosmetic_receipts bigint := 0;
  v_limits bigint := 0;
begin
  if p_room_before is null or p_ephemeral_before is null or p_receipt_before is null
      or p_room_before > now() or p_ephemeral_before > now() - interval '1 hour'
      or p_receipt_before > now() - interval '7 days'
      or p_batch_size is null or p_batch_size not between 1 and 500 or p_dry_run is null then
    raise exception 'invalid cleanup boundary' using errcode = '22023';
  end if;

  if p_dry_run then
    select count(*) into v_rooms from (
      select room.id from public.fcg_rooms room
      where room.expires_at < p_room_before and room.last_activity_at < p_room_before
      order by room.expires_at, room.id limit p_batch_size
    ) candidates;
    select count(*) into v_tickets_expired from (
      select ticket.ticket_id from fcg_private.standard_matchmaking_tickets ticket
      where ticket.state = 'searching' and ticket.expires_at < p_ephemeral_before
      order by ticket.expires_at, ticket.ticket_id limit p_batch_size
    ) candidates;
    select count(*) into v_tickets_deleted from (
      select ticket.ticket_id from fcg_private.standard_matchmaking_tickets ticket
      where ticket.state in ('claimed','cancelled','expired')
        and coalesce(ticket.resolved_at, ticket.expires_at) < p_ephemeral_before
      order by coalesce(ticket.resolved_at, ticket.expires_at), ticket.ticket_id limit p_batch_size
    ) candidates;
    select count(*) into v_find_receipts from (
      select receipt.user_id from fcg_private.standard_matchmaking_find_receipts receipt
      where receipt.created_at < p_receipt_before order by receipt.created_at, receipt.user_id, receipt.action_id limit p_batch_size
    ) candidates;
    select count(*) into v_quizzes from (
      select quiz.session_id from fcg_private.standard_quiz_sessions quiz
      where coalesce(quiz.completed_at, quiz.expires_at) < p_ephemeral_before
      order by coalesce(quiz.completed_at, quiz.expires_at), quiz.session_id limit p_batch_size
    ) candidates;
    select count(*) into v_gacha_receipts from (
      select receipt.user_id from fcg_private.standard_gacha_receipts receipt
      where receipt.created_at < p_receipt_before order by receipt.created_at, receipt.user_id, receipt.action_id limit p_batch_size
    ) candidates;
    select count(*) into v_card_sale_receipts from (
      select receipt.user_id from fcg_private.standard_card_sale_receipts receipt
      where receipt.created_at < p_receipt_before order by receipt.created_at, receipt.user_id, receipt.action_id limit p_batch_size
    ) candidates;
    select count(*) into v_cosmetic_receipts from (
      select receipt.user_id from fcg_private.standard_cosmetic_receipts receipt
      where receipt.created_at < p_receipt_before order by receipt.created_at, receipt.user_id, receipt.action_id limit p_batch_size
    ) candidates;
    select count(*) into v_limits from (
      select limits.user_id from fcg_private.standard_matchmaking_limits limits
      where limits.updated_at < p_ephemeral_before and coalesce(limits.blocked_until, '-infinity'::timestamptz) < now()
      order by limits.updated_at, limits.user_id limit p_batch_size
    ) candidates;
  else
    with candidates as (
      select ticket.ticket_id from fcg_private.standard_matchmaking_tickets ticket
      where ticket.state = 'searching' and ticket.expires_at < p_ephemeral_before
      order by ticket.expires_at, ticket.ticket_id limit p_batch_size for update skip locked
    )
    update fcg_private.standard_matchmaking_tickets ticket
    set state = 'expired', resolved_at = coalesce(ticket.resolved_at, now())
    from candidates where ticket.ticket_id = candidates.ticket_id;
    get diagnostics v_tickets_expired = row_count;

    with candidates as (
      select ticket.ticket_id from fcg_private.standard_matchmaking_tickets ticket
      where ticket.state in ('claimed','cancelled','expired')
        and coalesce(ticket.resolved_at, ticket.expires_at) < p_ephemeral_before
      order by coalesce(ticket.resolved_at, ticket.expires_at), ticket.ticket_id limit p_batch_size for update skip locked
    )
    delete from fcg_private.standard_matchmaking_tickets ticket using candidates
    where ticket.ticket_id = candidates.ticket_id;
    get diagnostics v_tickets_deleted = row_count;

    with candidates as (
      select receipt.ctid from fcg_private.standard_matchmaking_find_receipts receipt
      where receipt.created_at < p_receipt_before order by receipt.created_at, receipt.user_id, receipt.action_id limit p_batch_size for update skip locked
    ) delete from fcg_private.standard_matchmaking_find_receipts receipt using candidates where receipt.ctid = candidates.ctid;
    get diagnostics v_find_receipts = row_count;

    with candidates as (
      select quiz.session_id from fcg_private.standard_quiz_sessions quiz
      where coalesce(quiz.completed_at, quiz.expires_at) < p_ephemeral_before
      order by coalesce(quiz.completed_at, quiz.expires_at), quiz.session_id limit p_batch_size for update skip locked
    ) delete from fcg_private.standard_quiz_sessions quiz using candidates where quiz.session_id = candidates.session_id;
    get diagnostics v_quizzes = row_count;

    with candidates as (
      select receipt.ctid from fcg_private.standard_gacha_receipts receipt
      where receipt.created_at < p_receipt_before order by receipt.created_at, receipt.user_id, receipt.action_id limit p_batch_size for update skip locked
    ) delete from fcg_private.standard_gacha_receipts receipt using candidates where receipt.ctid = candidates.ctid;
    get diagnostics v_gacha_receipts = row_count;

    with candidates as (
      select receipt.ctid from fcg_private.standard_card_sale_receipts receipt
      where receipt.created_at < p_receipt_before order by receipt.created_at, receipt.user_id, receipt.action_id limit p_batch_size for update skip locked
    ) delete from fcg_private.standard_card_sale_receipts receipt using candidates where receipt.ctid = candidates.ctid;
    get diagnostics v_card_sale_receipts = row_count;

    with candidates as (
      select receipt.ctid from fcg_private.standard_cosmetic_receipts receipt
      where receipt.created_at < p_receipt_before order by receipt.created_at, receipt.user_id, receipt.action_id limit p_batch_size for update skip locked
    ) delete from fcg_private.standard_cosmetic_receipts receipt using candidates where receipt.ctid = candidates.ctid;
    get diagnostics v_cosmetic_receipts = row_count;

    with candidates as (
      select limits.user_id from fcg_private.standard_matchmaking_limits limits
      where limits.updated_at < p_ephemeral_before and coalesce(limits.blocked_until, '-infinity'::timestamptz) < now()
      order by limits.updated_at, limits.user_id limit p_batch_size for update skip locked
    ) delete from fcg_private.standard_matchmaking_limits limits using candidates where limits.user_id = candidates.user_id;
    get diagnostics v_limits = row_count;

    with candidates as (
      select room.id from public.fcg_rooms room
      where room.expires_at < p_room_before and room.last_activity_at < p_room_before
      order by room.expires_at, room.id limit p_batch_size for update skip locked
    ) delete from public.fcg_rooms room using candidates where room.id = candidates.id;
    get diagnostics v_rooms = row_count;
  end if;

  return jsonb_build_object(
    'dry_run',p_dry_run,'batch_size',p_batch_size,'rooms',v_rooms,
    'tickets_expired',v_tickets_expired,'tickets_deleted',v_tickets_deleted,
    'find_receipts',v_find_receipts,'quiz_sessions',v_quizzes,'gacha_receipts',v_gacha_receipts,
    'card_sale_receipts',v_card_sale_receipts,'cosmetic_receipts',v_cosmetic_receipts,'rate_limit_rows',v_limits
  );
end;
$$;

revoke all on function public.fcg_server_cleanup_expired_batched(timestamptz, timestamptz, timestamptz, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.fcg_server_cleanup_expired_batched(timestamptz, timestamptz, timestamptz, integer, boolean)
  to service_role;

-- Keep the legacy entry point compatible, but bound every call to at most 100 rooms.
create or replace function public.fcg_server_cleanup_expired(p_before timestamptz default now())
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted bigint;
begin
  if p_before is null or p_before > now() then raise exception 'invalid cleanup boundary' using errcode = '22023'; end if;
  with candidates as (
    select room.id from public.fcg_rooms room
    where room.expires_at < p_before and room.last_activity_at < p_before
    order by room.expires_at, room.id limit 100 for update skip locked
  ) delete from public.fcg_rooms room using candidates where room.id = candidates.id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.fcg_server_cleanup_expired(timestamptz) from public, anon, authenticated;
grant execute on function public.fcg_server_cleanup_expired(timestamptz) to service_role;
