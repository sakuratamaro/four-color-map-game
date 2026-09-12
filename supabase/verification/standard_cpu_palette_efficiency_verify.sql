-- Read-only post-migration check for the exact UDL-051-palette-v1.0 candidate.
-- Run as the existing SQL Editor operator. Returns no actor/room/action IDs.
-- Source MD5 normalizes CRLF only; it is a deployment readback check, not a
-- cryptographic substitute for the reviewed candidate's Git/blob/SHA256 binding.
with expected_functions(signature, source_md5, definer, language_name, volatility, service_execute) as (
  values
    ('fcg_private.fcg_standard_cpu_policy_is_supported(text,text)', 'a848e4a470f6c367032651acc72b135b', false, 'sql', 'i', false),
    ('fcg_private.fcg_standard_cpu_policy_is_current(text,text)', '280767ea9fe41fe36e223e117f08b24d', false, 'sql', 'i', false),
    ('public.fcg_standard_server_start_cpu(uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)', 'aa26d84704cbcd7b75e2daec8a4bcb91', true, 'plpgsql', 'v', true)
), identities(id) as (
  values ('yuzu'),('ren'),('minato'),('koharu'),('aoi'),('kai'),('tsubasa'),('shion'),('rei'),('kurogane')
), policy_cases(id, version, supported, current) as (
  select id, case when id='kurogane' then 'standard-character-roster-v1:kurogane-lookahead-v2'
    else 'standard-character-roster-v1:' || id end, true, true from identities
  union all select id, 'standard-character-split-rescue-v1:' || id, true, true from identities
  union all select id, 'standard-character-palette-efficiency-v1:' || id, true, true from identities
  union all select 'kurogane', 'standard-character-roster-v1:kurogane', true, false
  union all select id, null::text, false, false from identities
  union all select id, 'invented', false, false from identities
  union all select id, 'standard-character-split-rescue-v1:' || case when id='rei' then 'ren' else 'rei' end, false, false from identities
  union all select id, 'standard-character-palette-efficiency-v1:' || case when id='rei' then 'ren' else 'rei' end, false, false from identities
  union all select null::text, 'standard-character-palette-efficiency-v1:rei', false, false
  union all select null::text, 'standard-character-split-rescue-v1:rei', false, false
), checks(check_name, ok) as (
  select 'exact function/ACL ' || expected.signature,
    coalesce(
      md5(replace(proc.prosrc, chr(13), ''))=expected.source_md5
      and proc.prosecdef=expected.definer
      and lang.lanname=expected.language_name
      and proc.provolatile::text=expected.volatility
      and array_to_string(proc.proconfig, ',') in ('search_path=', 'search_path=""')
      and not has_function_privilege('anon', proc.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', proc.oid, 'EXECUTE')
      and has_function_privilege('service_role', proc.oid, 'EXECUTE')=expected.service_execute
      and not exists(select 1 from aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
        where acl.grantee=0 and acl.privilege_type='EXECUTE'), false)
  from expected_functions expected
  left join pg_proc proc on proc.oid=to_regprocedure(expected.signature)
  left join pg_language lang on lang.oid=proc.prolang
  union all
  select 'exact old/new/null/invalid policy matrix',
    bool_and(fcg_private.fcg_standard_cpu_policy_is_supported(id, version) is not distinct from supported
      and fcg_private.fcg_standard_cpu_policy_is_current(id, version) is not distinct from current)
  from policy_cases
  union all
  select 'active CPU rooms remain supported',
    count(*) filter (where not fcg_private.fcg_standard_cpu_policy_is_supported(cpu_character_id, cpu_policy_version))=0
  from public.fcg_rooms
  where opponent_kind='cpu' and status in ('waiting','ready','playing')
)
select check_name, ok from checks order by ok, check_name;
