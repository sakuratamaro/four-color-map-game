-- UNAPPLIED pilot storage only. No existing rows, room engine or CPU policy changes.
-- Trial start and the validated same-transaction WIN writer are a later slice.
-- There is deliberately no client/service generic grant RPC or direct table ACL.

create table fcg_private.standard_cpu_trial_clears (
  user_id uuid not null references public.fcg_standard_profiles(user_id) on delete cascade,
  trial_id text not null check (trial_id = 'ren-unseal'),
  trial_version integer not null check (trial_version >= 1),
  -- Durable provenance survives ordinary room retention/cleanup; the WIN writer
  -- must validate the actual server-owned trial room before inserting this record.
  winning_room_id uuid not null,
  cleared_at timestamptz not null default now(),
  primary key (user_id, trial_id, trial_version),
  unique (user_id, winning_room_id)
);

create table fcg_private.standard_learned_techniques (
  user_id uuid not null references public.fcg_standard_profiles(user_id) on delete cascade,
  technique_id text not null check (technique_id = 'techUnsealOne'),
  source_trial_id text not null check (source_trial_id = 'ren-unseal'),
  source_trial_version integer not null check (source_trial_version >= 1),
  learned_at timestamptz not null default now(),
  primary key (user_id, technique_id),
  foreign key (user_id, source_trial_id, source_trial_version)
    references fcg_private.standard_cpu_trial_clears(user_id, trial_id, trial_version)
);

create table fcg_private.standard_technique_equipment (
  user_id uuid primary key references public.fcg_standard_profiles(user_id) on delete cascade,
  technique_id text check (technique_id = 'techUnsealOne'),
  updated_at timestamptz not null default now(),
  foreign key (user_id, technique_id)
    references fcg_private.standard_learned_techniques(user_id, technique_id)
);

create table fcg_private.standard_technique_equip_receipts (
  user_id uuid not null references public.fcg_standard_profiles(user_id) on delete cascade,
  action_id uuid not null,
  action_fingerprint text not null check (action_fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, action_id)
);

alter table fcg_private.standard_cpu_trial_clears enable row level security;
alter table fcg_private.standard_learned_techniques enable row level security;
alter table fcg_private.standard_technique_equipment enable row level security;
alter table fcg_private.standard_technique_equip_receipts enable row level security;
revoke all on table fcg_private.standard_cpu_trial_clears,
  fcg_private.standard_learned_techniques, fcg_private.standard_technique_equipment,
  fcg_private.standard_technique_equip_receipts from public, anon, authenticated, service_role;

create function fcg_private.fcg_standard_technique_profile(p_user_id uuid, p_profile_state jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile jsonb := p_profile_state - 'learnedTechniques' - 'equippedTechniqueId' - 'cpuTrialProgress';
  v_learned jsonb;
  v_equipped text;
  v_trial jsonb;
begin
  -- VOLATILE intentionally reads a fresh READ COMMITTED snapshot after a profile
  -- row-lock wait, including ownership committed by another transaction.
  select coalesce(jsonb_agg(learned.technique_id order by learned.technique_id), '[]'::jsonb)
  into v_learned from fcg_private.standard_learned_techniques learned
  where learned.user_id = p_user_id;
  select equipment.technique_id into v_equipped
  from fcg_private.standard_technique_equipment equipment where equipment.user_id = p_user_id;
  if jsonb_array_length(v_learned) > 0 or found then
    v_profile := v_profile || jsonb_build_object('learnedTechniques', v_learned, 'equippedTechniqueId', v_equipped);
  end if;
  select jsonb_object_agg(progress.trial_id, progress.value order by progress.trial_id)
  into v_trial from (
    select clears.trial_id, jsonb_build_object(
      'clearedVersions', jsonb_agg(clears.trial_version order by clears.trial_version),
      'firstClearAt', min(clears.cleared_at)
    ) value from fcg_private.standard_cpu_trial_clears clears
    where clears.user_id = p_user_id group by clears.trial_id
  ) progress;
  if v_trial is not null then
    v_profile := v_profile || jsonb_build_object('cpuTrialProgress', v_trial);
  end if;
  return v_profile;
end;
$$;

create function fcg_private.fcg_standard_protect_technique_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Applies to every old/new profile writer, including gacha, quiz, cosmetics,
  -- card sale and action settlement. No caller-provided ownership is authoritative.
  new.profile_state := fcg_private.fcg_standard_technique_profile(new.user_id, new.profile_state);
  return new;
end;
$$;

create trigger fcg_standard_profile_technique_protect
before insert or update of profile_state on public.fcg_standard_profiles
for each row execute function fcg_private.fcg_standard_protect_technique_profile();

create function fcg_private.fcg_standard_sync_technique_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid;
begin
  v_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  -- The profile BEFORE trigger reads the private authority after this row change.
  -- Revision changes make existing owner snapshots/load RPCs refresh the cache.
  update public.fcg_standard_profiles profile
  set profile_state = profile.profile_state, revision = profile.revision + 1, updated_at = now()
  where profile.user_id = v_user_id;
  return null;
end;
$$;

create trigger fcg_standard_trial_clear_profile_sync
after insert on fcg_private.standard_cpu_trial_clears
for each row execute function fcg_private.fcg_standard_sync_technique_profile();
create trigger fcg_standard_learned_profile_sync
after insert on fcg_private.standard_learned_techniques
for each row execute function fcg_private.fcg_standard_sync_technique_profile();
create trigger fcg_standard_equipment_profile_sync
after insert or update of technique_id on fcg_private.standard_technique_equipment
for each row execute function fcg_private.fcg_standard_sync_technique_profile();

create function fcg_private.fcg_standard_technique_rematch_actor_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rematch already holds its room lock. A try-lock avoids reversing that order
  -- into a deadlock with equipment/another active-room operation.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0)) then
    raise exception 'STANDARD_ACTOR_BUSY' using errcode = '40001';
  end if;
  return new;
end;
$$;

create trigger fcg_standard_technique_rematch_actor_guard
before insert or update on fcg_private.standard_rematch_votes
for each row execute function fcg_private.fcg_standard_technique_rematch_actor_lock();

revoke all on function fcg_private.fcg_standard_technique_profile(uuid, jsonb),
  fcg_private.fcg_standard_protect_technique_profile(), fcg_private.fcg_standard_sync_technique_profile(),
  fcg_private.fcg_standard_technique_rematch_actor_lock() from public, anon, authenticated, service_role;

create function public.fcg_standard_server_equip_technique(
  p_user_id uuid, p_expected_revision bigint, p_action_id uuid, p_technique_id text
)
returns table (duplicate boolean, revision bigint, profile_state jsonb, receipt jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.fcg_standard_profiles%rowtype;
  v_receipt fcg_private.standard_technique_equip_receipts%rowtype;
  v_fingerprint text;
  v_current text;
  v_result jsonb;
begin
  if p_user_id is null or p_expected_revision is null or p_expected_revision < 0
      or p_action_id is null or (p_technique_id is not null and p_technique_id <> 'techUnsealOne') then
    raise exception 'INVALID_TECHNIQUE_EQUIP' using errcode = '22023';
  end if;
  v_fingerprint := encode(extensions.digest(jsonb_build_object('techniqueId', p_technique_id)::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  select profile.* into v_profile from public.fcg_standard_profiles profile
  where profile.user_id = p_user_id for update;
  if not found then raise exception 'STANDARD_PROFILE_REQUIRED' using errcode = 'P0002'; end if;

  select saved.* into v_receipt from fcg_private.standard_technique_equip_receipts saved
  where saved.user_id = p_user_id and saved.action_id = p_action_id;
  if found then
    if v_receipt.action_fingerprint <> v_fingerprint then
      raise exception 'technique equip action ID reused' using errcode = '23505';
    end if;
    -- A lost ACK remains replayable even during a later match. Never apply the
    -- old selection again: return its receipt plus the latest owner profile.
    return query select true, v_profile.revision, v_profile.profile_state, v_receipt.result;
    return;
  end if;
  if v_profile.revision <> p_expected_revision then
    raise exception 'stale profile revision' using errcode = 'PT409';
  end if;
  if p_technique_id is not null and not exists (
    select 1 from fcg_private.standard_learned_techniques learned
    where learned.user_id = p_user_id and learned.technique_id = p_technique_id
  ) then raise exception 'TECHNIQUE_NOT_LEARNED' using errcode = '42501'; end if;
  if exists (
    select 1 from public.fcg_room_members member join public.fcg_rooms room on room.id = member.room_id
    where member.user_id = p_user_id and room.game_mode = 'standard_v5'
      and room.status in ('waiting', 'ready', 'playing') and room.expires_at > now()
  ) or exists (
    select 1 from fcg_private.standard_matchmaking_tickets ticket
    where ticket.user_id = p_user_id and ticket.state = 'searching' and ticket.expires_at > now()
  ) or exists (
    select 1 from fcg_private.standard_rematch_votes vote
    join public.fcg_rooms room on room.id = vote.room_id
    join public.fcg_room_members member on member.room_id = room.id and member.user_id = vote.user_id
    where vote.user_id = p_user_id and room.game_mode = 'standard_v5'
      and room.status = 'finished' and room.expires_at > now() and vote.room_version = room.version
  ) then raise exception 'TECHNIQUE_EQUIP_MATCH_LOCKED' using errcode = '55000'; end if;

  select equipment.technique_id into v_current
  from fcg_private.standard_technique_equipment equipment where equipment.user_id = p_user_id;
  if v_current is distinct from p_technique_id then
    insert into fcg_private.standard_technique_equipment(user_id, technique_id)
    values (p_user_id, p_technique_id)
    on conflict (user_id) do update set technique_id = excluded.technique_id, updated_at = now();
    select profile.* into v_profile from public.fcg_standard_profiles profile where profile.user_id = p_user_id;
  end if;
  v_result := jsonb_build_object('actionId', p_action_id, 'techniqueId', p_technique_id, 'appliedRevision', v_profile.revision);
  insert into fcg_private.standard_technique_equip_receipts(user_id, action_id, action_fingerprint, result)
  values (p_user_id, p_action_id, v_fingerprint, v_result);
  return query select false, v_profile.revision, v_profile.profile_state, v_result;
end;
$$;

revoke all on function public.fcg_standard_server_equip_technique(uuid, bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.fcg_standard_server_equip_technique(uuid, bigint, uuid, text) to service_role;
