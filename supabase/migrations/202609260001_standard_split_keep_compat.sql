-- UDL-20260906-011: new-card matches only; no existing rows or rewards are rewritten.
-- Apply before the matching Edge bundle; alpha.1-5, Ren template and ACLs are retained.
begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

create or replace function fcg_private.fcg_standard_guard_technique_snapshot()
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
    if s->>'engineVersion' in ('5.0.0-alpha.5','5.0.0-alpha.6') then raise exception 'INVALID_TECHNIQUE_SNAPSHOT' using errcode = '22023'; end if;
    return new;
  end if;
  -- alpha.6 without an equipped technique keeps an explicit disabled snapshot.
  if s->>'engineVersion' = '5.0.0-alpha.6'
      and s->'techniqueRule' = '{"id":"PVP_TECHNIQUES_DISABLED_V1","playerSeat":null}'::jsonb
      and s->'techniques' = '{"A":null,"B":null}'::jsonb then
    return new;
  end if;
  select r.* into strict v_room from public.fcg_rooms r where r.id = new.room_id;
  select m.user_id into v_user from public.fcg_room_members m where m.room_id = new.room_id and m.seat = 'A';
  -- The initializer already locks quoted profiles. Recheck private stores, not
  -- caller-provided source markers or stale whole-profile JSON.
  perform 1 from public.fcg_standard_profiles p where p.user_id = v_user for update;
  if v_room.opponent_kind <> 'cpu' or v_room.access_mode <> 'cpu' or (s->>'engineVersion' is distinct from '5.0.0-alpha.5' and s->>'engineVersion' is distinct from '5.0.0-alpha.6')
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
revoke all on function fcg_private.fcg_standard_guard_technique_snapshot() from public,anon,authenticated,service_role;
commit;
