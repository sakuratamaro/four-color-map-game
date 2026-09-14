-- Unapplied local pilot. Start from a private versioned template; settle in the
-- existing action transaction. No browser RPC can submit a win or a template.
create table fcg_private.standard_cpu_trial_rooms (
  room_id uuid primary key references public.fcg_rooms(id) on delete cascade,
  user_id uuid not null references public.fcg_standard_profiles(user_id) on delete cascade,
  trial_id text not null,
  trial_version integer not null,
  foreign key (trial_id, trial_version) references fcg_private.standard_cpu_trial_templates(trial_id, trial_version)
);
create table fcg_private.standard_cpu_trial_start_receipts (
  user_id uuid not null references public.fcg_standard_profiles(user_id) on delete cascade,
  action_id uuid not null,
  trial_id text not null,
  trial_version integer not null,
  room_id uuid not null, -- Durable retry identity, even after old room cleanup.
  primary key (user_id, action_id)
);
alter table fcg_private.standard_cpu_trial_rooms enable row level security;
alter table fcg_private.standard_cpu_trial_start_receipts enable row level security;
revoke all on fcg_private.standard_cpu_trial_rooms, fcg_private.standard_cpu_trial_start_receipts
  from public, anon, authenticated, service_role;

create function public.fcg_standard_server_start_cpu_trial(
  p_user_id uuid, p_action_id uuid, p_cpu_user_id uuid,
  p_trial_id text, p_trial_version integer, p_rng_snapshot jsonb
)
returns table (room_id uuid, duplicate boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_receipt fcg_private.standard_cpu_trial_start_receipts%rowtype;
  v_profile public.fcg_standard_profiles%rowtype;
  v_template jsonb;
  v_state jsonb;
  v_public jsonb;
  v_room uuid;
  v_wins jsonb;
  v_loadout jsonb;
  v_policy text;
  v_rng_keys text[];
begin
  if p_user_id is null or p_action_id is null or p_cpu_user_id is null or p_cpu_user_id = p_user_id
      or p_trial_id is null or p_trial_version is null then
    raise exception 'INVALID_CPU_TRIAL_START' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  select r.* into v_receipt from fcg_private.standard_cpu_trial_start_receipts r
  where r.user_id = p_user_id and r.action_id = p_action_id;
  if found then
    if v_receipt.trial_id <> p_trial_id or v_receipt.trial_version <> p_trial_version then
      raise exception 'trial start action ID reused' using errcode = '23505';
    end if;
    return query select v_receipt.room_id, true;
    return;
  end if;
  if p_trial_id <> 'ren-unseal' or p_trial_version <> 1 then
    raise exception 'UNKNOWN_CPU_TRIAL_VERSION' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rng_snapshot) is distinct from 'object' then
    raise exception 'INVALID_TRIAL_RNG' using errcode = '22023';
  end if;
  select array_agg(k order by k) into v_rng_keys from jsonb_object_keys(p_rng_snapshot) k;
  if v_rng_keys is distinct from array['bonus-color','bonus-use-count','cpu-A','cpu-B','cpu-tie-break','die','gacha','match-init','palette','quiz-choice-order','quiz-choice-rank','quiz-content','quiz-cosmetic-motion','quiz-structure','skill-effect']::text[]
      or exists (select 1 from jsonb_each(p_rng_snapshot) e where jsonb_typeof(e.value) <> 'number') then
    raise exception 'INVALID_TRIAL_RNG' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each_text(p_rng_snapshot) e
      where e.value::numeric < 0 or e.value::numeric > 4294967295 or trunc(e.value::numeric) <> e.value::numeric) then
    raise exception 'INVALID_TRIAL_RNG' using errcode = '22023';
  end if;
  select p.* into v_profile from public.fcg_standard_profiles p where p.user_id = p_user_id for update;
  if not found then raise exception 'STANDARD_PROFILE_REQUIRED' using errcode = 'P0002'; end if;
  v_wins := v_profile.profile_state #> '{cpuCharacterStats,ren,wins}';
  if jsonb_typeof(v_wins) is distinct from 'number' then
    raise exception 'CPU_TRIAL_LOCKED' using errcode = '42501';
  end if;
  if v_wins::text::numeric < 1 or v_wins::text::numeric > 9007199254740991
      or trunc(v_wins::text::numeric) <> v_wins::text::numeric then
    raise exception 'CPU_TRIAL_LOCKED' using errcode = '42501';
  end if;
  if exists (select 1 from public.fcg_room_members m join public.fcg_rooms r on r.id = m.room_id
      where m.user_id = p_user_id and r.game_mode = 'standard_v5'
        and r.status in ('waiting','ready','playing') and r.expires_at > now())
      or exists (select 1 from fcg_private.standard_matchmaking_tickets t
        where t.user_id = p_user_id and t.state = 'searching' and t.expires_at > now())
      or exists (select 1 from fcg_private.standard_rematch_votes v join public.fcg_rooms r on r.id = v.room_id
        where v.user_id = p_user_id and r.status = 'finished' and r.expires_at > now() and v.room_version = r.version) then
    raise exception 'CPU_TRIAL_MATCH_LOCKED' using errcode = '55000';
  end if;
  if fcg_private.fcg_standard_matchmaking_rate_limited(p_user_id) then
    raise exception 'MATCHMAKING_RATE_LIMIT' using errcode = '54000';
  end if;
  select t.template, t.policy_version into strict v_template, v_policy
  from fcg_private.standard_cpu_trial_templates t where t.trial_id = p_trial_id and t.trial_version = p_trial_version;
  v_room := extensions.gen_random_uuid();
  v_state := v_template->'state' || jsonb_build_object('matchId',v_room::text || ':0','version',0);
  v_public := v_template->'publicState' || jsonb_build_object('matchId',v_room::text || ':0','version',0);
  v_loadout := v_state #> '{loadouts,A}';
  insert into public.fcg_rooms(id,code_hash,host_user_id,game_mode,access_mode,opponent_kind,status,version,
      cpu_character_id,cpu_policy_version,cpu_user_id,public_state,started_at,expires_at)
  values (v_room,encode(extensions.digest(v_room::text,'sha256'),'hex'),p_user_id,'standard_v5','cpu','cpu','playing',0,
      'ren',v_policy,p_cpu_user_id,v_public,now(),now()+interval '24 hours');
  insert into public.fcg_standard_profiles(user_id,revision,display_name,profile_state)
  values(p_cpu_user_id,1,'せっかちレン',v_template->'cpuProfile');
  insert into fcg_private.standard_cpu_profile_owners(room_id,cpu_user_id) values(v_room,p_cpu_user_id);
  insert into public.fcg_room_members(room_id,user_id,seat,display_name)
  values(v_room,p_user_id,'A',v_profile.display_name),(v_room,p_cpu_user_id,'B','せっかちレン');
  insert into fcg_private.standard_cpu_trial_rooms(room_id,user_id,trial_id,trial_version)
  values(v_room,p_user_id,p_trial_id,p_trial_version);
  insert into fcg_private.standard_room_setups(room_id,user_id,seat,setup_revision,profile_revision,quote_id,quote_expires_at,loadout,loadout_fingerprint)
  values(v_room,p_user_id,'A',1,v_profile.revision,extensions.gen_random_uuid(),now()+interval '24 hours',v_loadout,encode(extensions.digest(v_loadout::text,'sha256'),'hex')),
        (v_room,p_cpu_user_id,'B',1,1,extensions.gen_random_uuid(),now()+interval '24 hours',v_loadout,encode(extensions.digest(v_loadout::text,'sha256'),'hex'));
  insert into fcg_private.authoritative_matches(room_id,version,state,game_mode)
  values(v_room,0,jsonb_build_object('state',v_state,'rngSnapshot',p_rng_snapshot),'standard_v5');
  insert into public.fcg_player_views(room_id,user_id,seat,version,private_state)
  values(v_room,p_user_id,'A',0,v_template->'privateA'),(v_room,p_cpu_user_id,'B',0,v_template->'privateB');
  insert into fcg_private.standard_cpu_trial_start_receipts(user_id,action_id,trial_id,trial_version,room_id)
  values(p_user_id,p_action_id,p_trial_id,p_trial_version,v_room);
  return query select v_room,false;
end;
$$;
revoke all on function public.fcg_standard_server_start_cpu_trial(uuid,uuid,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.fcg_standard_server_start_cpu_trial(uuid,uuid,uuid,text,integer,jsonb) to service_role;

-- Apply this guard to every initializer (including legacy overloads). Snapshot
-- provenance/identity cannot be added, switched or replenished by later actions.
create function fcg_private.fcg_standard_guard_technique_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s jsonb := new.state->'state';
  previous jsonb;
  v_context fcg_private.standard_cpu_trial_rooms%rowtype;
  v_room public.fcg_rooms%rowtype;
  v_expected jsonb;
  v_user uuid;
  v_seat text;
begin
  if new.game_mode <> 'standard_v5' then return new; end if;
  if tg_op = 'UPDATE' then
    previous := old.state->'state';
    if (s->'techniqueRule') is distinct from (previous->'techniqueRule')
        or ((s->'techniques') is null) is distinct from ((previous->'techniques') is null) then
      raise exception 'IMMUTABLE_TECHNIQUE_SNAPSHOT' using errcode = '22023';
    end if;
    if previous->'techniques' is null then return new; end if;
    if s->'engineVersion' is distinct from previous->'engineVersion'
        or ((s->'techniques') - 'A' - 'B') is distinct from ((previous->'techniques') - 'A' - 'B') then
      raise exception 'IMMUTABLE_TECHNIQUE_SNAPSHOT' using errcode = '22023';
    end if;
    foreach v_seat in array array['A','B'] loop
      if (s #> array['techniques',v_seat]) is distinct from (previous #> array['techniques',v_seat]) then
        if (s #> array['techniques',v_seat]) is distinct from
            ((previous #> array['techniques',v_seat]) || '{"usesRemaining":0}'::jsonb)
            or previous #>> array['techniques',v_seat,'usesRemaining'] is distinct from '1' then
          raise exception 'IMMUTABLE_TECHNIQUE_SNAPSHOT' using errcode = '22023';
        end if;
      end if;
    end loop;
    return new;
  end if;
  select c.* into v_context from fcg_private.standard_cpu_trial_rooms c where c.room_id = new.room_id;
  if found then
    select t.template->'state' into strict v_expected from fcg_private.standard_cpu_trial_templates t
    where t.trial_id = v_context.trial_id and t.trial_version = v_context.trial_version;
    v_expected := v_expected || jsonb_build_object('matchId',new.room_id::text || ':0','version',0);
    if s is distinct from v_expected or new.version <> 0 then
      raise exception 'INVALID_CPU_TRIAL_TEMPLATE' using errcode = '22023';
    end if;
    return new;
  end if;
  if s->'techniqueRule' is null and s->'techniques' is null then
    if s->>'engineVersion' = '5.0.0-alpha.5' then raise exception 'INVALID_TECHNIQUE_SNAPSHOT' using errcode = '22023'; end if;
    return new;
  end if;
  select r.* into strict v_room from public.fcg_rooms r where r.id = new.room_id;
  select m.user_id into v_user from public.fcg_room_members m where m.room_id = new.room_id and m.seat = 'A';
  -- The initializer already locks quoted profiles. Recheck private stores, not
  -- caller-provided source markers or stale whole-profile JSON.
  perform 1 from public.fcg_standard_profiles p where p.user_id = v_user for update;
  if v_room.opponent_kind <> 'cpu' or v_room.access_mode <> 'cpu' or s->>'engineVersion' is distinct from '5.0.0-alpha.5'
      or s->'techniqueRule' is distinct from '{"id":"CPU_LEARNED_V1","playerSeat":"A"}'::jsonb
      or s->'techniques' is distinct from '{"A":{"id":"techUnsealOne","definitionVersion":"unseal-v1","source":"LEARNED","usesRemaining":1},"B":null}'::jsonb
      or not exists (select 1 from fcg_private.standard_learned_techniques l join fcg_private.standard_technique_equipment e
          on e.user_id = l.user_id and e.technique_id = l.technique_id
          where l.user_id = v_user and l.technique_id = 'techUnsealOne') then
    raise exception 'INVALID_TECHNIQUE_SNAPSHOT' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger fcg_standard_technique_snapshot_guard before insert or update of state on fcg_private.authoritative_matches
for each row execute function fcg_private.fcg_standard_guard_technique_snapshot();
revoke all on function fcg_private.fcg_standard_guard_technique_snapshot() from public,anon,authenticated,service_role;

-- A trial is explicitly started as a new room; ordinary rematch machinery must
-- neither replace its policy nor leave a one-sided vote locking equipment.
create function fcg_private.fcg_standard_guard_trial_rematch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from fcg_private.standard_cpu_trial_rooms c where c.room_id = new.room_id) then
    raise exception 'CPU_TRIAL_EXPLICIT_RESTART_REQUIRED' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger fcg_standard_trial_rematch_guard before insert or update on fcg_private.standard_rematch_votes
for each row execute function fcg_private.fcg_standard_guard_trial_rematch();
revoke all on function fcg_private.fcg_standard_guard_trial_rematch() from public,anon,authenticated,service_role;

-- Preserve the existing implementation and exact signatures/legacy behavior.
-- Only the wrapper is callable by the worker; a trial cannot bypass its grant
-- transaction through the old function name or write normal profile rewards.
alter function public.fcg_standard_server_commit_action(uuid,uuid,uuid,bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,bigint,jsonb,bigint,jsonb,boolean,text) set schema fcg_private;
revoke all on function fcg_private.fcg_standard_server_commit_action(uuid,uuid,uuid,bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,bigint,jsonb,bigint,jsonb,boolean,text) from public,anon,authenticated,service_role;
create function public.fcg_standard_server_commit_action(
  p_room_id uuid, p_actor_id uuid, p_action_id uuid, p_expected_version bigint,
  p_action_type text, p_action_fingerprint text, p_authoritative_state jsonb,
  p_public_state jsonb, p_private_a jsonb, p_private_b jsonb, p_result jsonb,
  p_profile_a_expected_revision bigint default null, p_profile_a_state jsonb default null,
  p_profile_b_expected_revision bigint default null, p_profile_b_state jsonb default null,
  p_finished boolean default false, p_winner_seat text default null
)
returns table (new_version bigint, duplicate boolean, action_result jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  c fcg_private.standard_cpu_trial_rooms%rowtype;
  v_commit record;
  s jsonb := p_authoritative_state->'state';
begin
  select t.* into c from fcg_private.standard_cpu_trial_rooms t where t.room_id = p_room_id;
  if found then
    if p_profile_a_state is not null or p_profile_b_state is not null
        or p_profile_a_expected_revision is not null or p_profile_b_expected_revision is not null then
      raise exception 'TRIAL_NORMAL_REWARD_FORBIDDEN' using errcode = '22023';
    end if;
    if (s->>'status' = 'FINISHED') is distinct from p_finished
        or (s->>'winner') is distinct from p_winner_seat
        or p_public_state->'status' is distinct from s->'status'
        or p_public_state->'winner' is distinct from s->'winner'
        or s #>> '{techniqueRule,id}' is distinct from 'REN_UNSEAL_TRIAL_V1'
        or (p_finished and p_winner_seat = 'A' and p_action_type = 'SURRENDER' and p_actor_id = c.user_id) then
      raise exception 'INVALID_TRIAL_SETTLEMENT' using errcode = '22023';
    end if;
  end if;
  select * into strict v_commit from fcg_private.fcg_standard_server_commit_action(
    p_room_id,p_actor_id,p_action_id,p_expected_version,p_action_type,p_action_fingerprint,p_authoritative_state,
    p_public_state,p_private_a,p_private_b,p_result,p_profile_a_expected_revision,p_profile_a_state,
    p_profile_b_expected_revision,p_profile_b_state,p_finished,p_winner_seat);
  if c.room_id is not null and not v_commit.duplicate and p_finished and p_winner_seat = 'A' then
    -- Both rows/projection revisions roll back with room, action receipt and WIN.
    perform 1 from public.fcg_standard_profiles p where p.user_id = c.user_id for update;
    insert into fcg_private.standard_cpu_trial_clears(user_id,trial_id,trial_version,winning_room_id)
    values(c.user_id,c.trial_id,c.trial_version,c.room_id) on conflict do nothing;
    insert into fcg_private.standard_learned_techniques(user_id,technique_id,source_trial_id,source_trial_version)
    values(c.user_id,'techUnsealOne',c.trial_id,c.trial_version) on conflict (user_id,technique_id) do nothing;
  end if;
  return query select v_commit.new_version,v_commit.duplicate,v_commit.action_result;
end;
$$;
revoke all on function public.fcg_standard_server_commit_action(uuid,uuid,uuid,bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,bigint,jsonb,bigint,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.fcg_standard_server_commit_action(uuid,uuid,uuid,bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,bigint,jsonb,bigint,jsonb,boolean,text) to service_role;
