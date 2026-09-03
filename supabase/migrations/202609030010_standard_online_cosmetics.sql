-- Server-authoritative, capability-neutral cosmetic purchase and equip.

create table if not exists fcg_private.standard_cosmetic_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null,
  action_fingerprint text not null check (action_fingerprint ~ '^[0-9a-f]{64}$'),
  profile_revision bigint not null check (profile_revision >= 1),
  action_result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, action_id)
);
alter table fcg_private.standard_cosmetic_receipts enable row level security;
revoke all on table fcg_private.standard_cosmetic_receipts from public, anon, authenticated;

create or replace function public.fcg_standard_server_replay_cosmetic(
  p_user_id uuid, p_action_id uuid, p_action_fingerprint text
)
returns table (found boolean, profile_revision bigint, action_result jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare v_receipt fcg_private.standard_cosmetic_receipts%rowtype;
begin
  if p_user_id is null or p_action_id is null or p_action_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid Standard cosmetic replay' using errcode = '22023';
  end if;
  select receipt.* into v_receipt from fcg_private.standard_cosmetic_receipts receipt
  where receipt.user_id = p_user_id and receipt.action_id = p_action_id;
  if not found then return query select false, null::bigint, null::jsonb; return; end if;
  if v_receipt.action_fingerprint <> p_action_fingerprint then
    raise exception 'cosmetic action ID reused with different input' using errcode = '23505';
  end if;
  return query select true, v_receipt.profile_revision, v_receipt.action_result;
end;
$$;

create or replace function public.fcg_standard_server_commit_cosmetic(
  p_user_id uuid,
  p_expected_revision bigint,
  p_action_id uuid,
  p_action_fingerprint text,
  p_profile_state jsonb,
  p_action_result jsonb
)
returns table (new_revision bigint, duplicate boolean, action_result jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current bigint;
  v_receipt fcg_private.standard_cosmetic_receipts%rowtype;
begin
  if p_user_id is null or p_expected_revision < 0 or p_action_id is null
      or p_action_fingerprint !~ '^[0-9a-f]{64}$' or p_profile_state is null or p_action_result is null then
    raise exception 'invalid Standard cosmetic commit' using errcode = '22023';
  end if;
  select profile.revision into v_current from public.fcg_standard_profiles profile
  where profile.user_id = p_user_id for update;
  if not found then raise exception 'standard profile required' using errcode = 'P0002'; end if;

  select receipt.* into v_receipt from fcg_private.standard_cosmetic_receipts receipt
  where receipt.user_id = p_user_id and receipt.action_id = p_action_id;
  if found then
    if v_receipt.action_fingerprint <> p_action_fingerprint then
      raise exception 'cosmetic action ID reused with different input' using errcode = '23505';
    end if;
    return query select v_receipt.profile_revision, true, v_receipt.action_result;
    return;
  end if;

  if v_current <> p_expected_revision then raise exception 'stale profile revision' using errcode = 'PT409'; end if;
  update public.fcg_standard_profiles
  set revision = p_expected_revision + 1, profile_state = p_profile_state, updated_at = now()
  where user_id = p_user_id and revision = p_expected_revision;
  if not found then raise exception 'stale profile revision' using errcode = 'PT409'; end if;

  insert into fcg_private.standard_cosmetic_receipts
    (user_id, action_id, action_fingerprint, profile_revision, action_result)
  values (p_user_id, p_action_id, p_action_fingerprint, p_expected_revision + 1, p_action_result);
  return query select p_expected_revision + 1, false, p_action_result;
end;
$$;

revoke all on function public.fcg_standard_server_replay_cosmetic(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.fcg_standard_server_commit_cosmetic(uuid, bigint, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.fcg_standard_server_replay_cosmetic(uuid, uuid, text) to service_role;
grant execute on function public.fcg_standard_server_commit_cosmetic(uuid, bigint, uuid, text, jsonb, jsonb) to service_role;
