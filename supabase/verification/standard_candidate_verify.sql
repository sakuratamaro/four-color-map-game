-- Read-only verification after applying migrations through 202609050005.
-- Expected result: every row has ok = true. This statement performs no writes.

with
expected_relations(schema_name, relation_name) as (
  values
    ('fcg_private', 'standard_card_sale_receipts'),
    ('fcg_private', 'standard_matchmaking_tickets'),
    ('fcg_private', 'standard_matchmaking_find_receipts'),
    ('fcg_private', 'standard_matchmaking_limits'),
    ('fcg_private', 'standard_cpu_profile_owners'),
    ('fcg_private', 'standard_cpu_start_receipts'),
    ('fcg_private', 'standard_cosmetic_receipts')
),
relation_state as (
  select expected.*,
    relation.oid,
    coalesce(relation.relrowsecurity, false) as rls_enabled,
    coalesce(pg_catalog.has_table_privilege('anon', relation.oid, 'SELECT'), false)
      or coalesce(pg_catalog.has_table_privilege('anon', relation.oid, 'INSERT'), false)
      or coalesce(pg_catalog.has_table_privilege('anon', relation.oid, 'UPDATE'), false)
      or coalesce(pg_catalog.has_table_privilege('anon', relation.oid, 'DELETE'), false) as anon_access,
    coalesce(pg_catalog.has_table_privilege('authenticated', relation.oid, 'SELECT'), false)
      or coalesce(pg_catalog.has_table_privilege('authenticated', relation.oid, 'INSERT'), false)
      or coalesce(pg_catalog.has_table_privilege('authenticated', relation.oid, 'UPDATE'), false)
      or coalesce(pg_catalog.has_table_privilege('authenticated', relation.oid, 'DELETE'), false) as authenticated_access
  from expected_relations expected
  left join pg_catalog.pg_namespace namespace on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace.oid and relation.relname = expected.relation_name and relation.relkind = 'r'
),
expected_columns(schema_name, table_name, column_name) as (
  values
    ('public', 'fcg_rooms', 'access_mode'),
    ('public', 'fcg_rooms', 'opponent_kind'),
    ('public', 'fcg_rooms', 'cpu_character_id'),
    ('public', 'fcg_rooms', 'cpu_policy_version'),
    ('public', 'fcg_rooms', 'cpu_user_id'),
    ('public', 'fcg_standard_profiles', 'appearance'),
    ('fcg_private', 'standard_quiz_sessions', 'answer_receipts'),
    ('fcg_private', 'standard_quiz_sessions', 'explanations')
),
column_state as (
  select expected.*,
    columns.column_name is not null as present
  from expected_columns expected
  left join information_schema.columns columns
    on columns.table_schema = expected.schema_name
    and columns.table_name = expected.table_name
    and columns.column_name = expected.column_name
),
expected_functions(signature, audience) as (
  values
    ('public.fcg_standard_server_replay_card_sale(uuid,uuid,text)', 'service_role'),
    ('public.fcg_standard_server_commit_card_sale(uuid,bigint,uuid,text,jsonb,jsonb)', 'service_role'),
    ('public.fcg_standard_matchmaking_recruit(uuid,text)', 'authenticated'),
    ('public.fcg_standard_matchmaking_find(uuid,text)', 'authenticated'),
    ('public.fcg_standard_matchmaking_status(uuid)', 'authenticated'),
    ('public.fcg_standard_matchmaking_cancel(uuid)', 'authenticated'),
    ('public.fcg_standard_server_accept_cpu(uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)', 'service_role'),
    ('public.fcg_standard_server_start_cpu(uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)', 'service_role'),
    ('public.fcg_standard_server_load_room_v2(uuid,uuid)', 'service_role'),
    ('public.fcg_standard_server_request_cpu_rematch(uuid,uuid,bigint,uuid,text,text,text,jsonb,jsonb,text)', 'service_role'),
    ('public.fcg_standard_server_replay_cosmetic(uuid,uuid,text)', 'service_role'),
    ('public.fcg_standard_server_commit_cosmetic(uuid,bigint,uuid,text,jsonb,jsonb)', 'service_role'),
    ('public.fcg_server_cleanup_expired_batched(timestamptz,timestamptz,timestamptz,integer,boolean)', 'service_role'),
    ('public.fcg_server_cleanup_expired(timestamptz)', 'service_role'),
    ('public.fcg_standard_room_snapshot(uuid)', 'authenticated'),
    ('public.fcg_standard_room_snapshot_v2(uuid,bigint)', 'authenticated'),
    ('public.fcg_standard_server_start_quiz_v2(uuid,uuid,uuid,text,integer,jsonb,jsonb,jsonb,timestamptz)', 'service_role'),
    ('public.fcg_standard_server_answer_quiz(uuid,uuid,uuid,integer,text)', 'service_role'),
    ('public.fcg_standard_server_finish_quiz_v2(uuid,uuid,uuid,jsonb)', 'service_role')
),
function_state as (
  select expected.*,
    procedure.oid,
    coalesce(procedure.prosecdef, false) as security_definer,
    coalesce(procedure.proconfig, '{}'::text[]) @> array['search_path=""']::text[]
      or coalesce(procedure.proconfig, '{}'::text[]) @> array['search_path=']::text[] as empty_search_path,
    coalesce(pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE'), false) as anon_execute,
    coalesce(pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE'), false) as authenticated_execute,
    coalesce(pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE'), false) as service_execute
  from expected_functions expected
  left join pg_catalog.pg_proc procedure on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
),
expected_policy_helpers(signature) as (
  values
    ('fcg_private.fcg_standard_cpu_policy_is_supported(text,text)'),
    ('fcg_private.fcg_standard_cpu_policy_is_current(text,text)')
),
policy_helper_state as (
  select expected.signature,
    procedure.oid,
    coalesce(pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE'), false) as anon_execute,
    coalesce(pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE'), false) as authenticated_execute,
    coalesce(pg_get_functiondef(procedure.oid), '') as definition
  from expected_policy_helpers expected
  left join pg_catalog.pg_proc procedure on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
),
expected_constraints(relation_name, constraint_name) as (
  values
    ('public.fcg_rooms', 'fcg_rooms_access_mode_check'),
    ('public.fcg_rooms', 'fcg_rooms_opponent_kind_check'),
    ('public.fcg_rooms', 'fcg_rooms_cpu_identity_check'),
    ('public.fcg_standard_profiles', 'fcg_standard_profiles_safe_appearance_check'),
    ('fcg_private.standard_quiz_sessions', 'standard_quiz_answer_receipts_shape'),
    ('fcg_private.standard_quiz_sessions', 'standard_quiz_explanations_shape')
),
constraint_state as (
  select expected.*,
    constraint_row.oid is not null as present,
    coalesce(constraint_row.convalidated, false) as validated
  from expected_constraints expected
  left join pg_catalog.pg_constraint constraint_row
    on constraint_row.conrelid = pg_catalog.to_regclass(expected.relation_name)
    and constraint_row.conname = expected.constraint_name
),
expected_triggers(relation_name, trigger_name) as (
  values
    ('fcg_private.standard_cpu_profile_owners', 'fcg_delete_standard_cpu_profile_after_room'),
    ('public.fcg_standard_profiles', 'fcg_standard_profile_appearance_sync')
),
trigger_state as (
  select expected.*,
    trigger_row.oid is not null as present,
    coalesce(trigger_row.tgenabled <> 'D', false) as enabled
  from expected_triggers expected
  left join pg_catalog.pg_trigger trigger_row
    on trigger_row.tgrelid = pg_catalog.to_regclass(expected.relation_name)
    and trigger_row.tgname = expected.trigger_name
    and not trigger_row.tgisinternal
),
expected_indexes(index_name) as (
  values
    ('fcg_standard_matchmaking_one_search_per_user'),
    ('fcg_standard_matchmaking_oldest_search'),
    ('fcg_standard_matchmaking_resolved_cleanup_idx'),
    ('fcg_standard_matchmaking_expiry_cleanup_idx'),
    ('fcg_standard_matchmaking_find_cleanup_idx'),
    ('fcg_standard_quiz_cleanup_idx'),
    ('fcg_standard_gacha_receipt_cleanup_idx'),
    ('fcg_standard_card_sale_receipt_cleanup_idx'),
    ('fcg_standard_cosmetic_receipt_cleanup_idx'),
    ('fcg_standard_matchmaking_limit_cleanup_idx'),
    ('fcg_standard_cpu_start_receipt_cleanup_idx')
),
index_state as (
  select expected.index_name,
    index_row.indexrelid is not null as present,
    coalesce(index_row.indisvalid and index_row.indisready, false) as usable
  from expected_indexes expected
  left join pg_catalog.pg_class index_class on index_class.relname = expected.index_name and index_class.relkind = 'i'
  left join pg_catalog.pg_index index_row on index_row.indexrelid = index_class.oid
),
appearance_state as (
  select count(*)::bigint as drift_count
  from public.fcg_standard_profiles profile
  where to_jsonb(profile) -> 'appearance' is distinct from jsonb_build_object(
    'board', case when profile.profile_state #>> '{equipped,board}' in
      ('boardDefault','boardAurora','boardGold','boardCartographer')
      then profile.profile_state #>> '{equipped,board}' else 'boardDefault' end,
    'effect', case when profile.profile_state #>> '{equipped,effect}' in
      ('effectDefault','effectSakura','effectPrism','effectMasterpiece')
      then profile.profile_state #>> '{equipped,effect}' else 'effectDefault' end,
    'nameplate', case when profile.profile_state #>> '{equipped,nameplate}' in
      ('nameplateDefault','nameplateGold')
      then profile.profile_state #>> '{equipped,nameplate}' else 'nameplateDefault' end,
    'title', case when profile.profile_state #>> '{equipped,title}' in
      ('titleNone','titleArtisan')
      then profile.profile_state #>> '{equipped,title}' else 'titleNone' end
  )
),
checks(check_name, ok, detail) as (
  select 'private relation ' || schema_name || '.' || relation_name,
    oid is not null and rls_enabled and not anon_access and not authenticated_access,
    jsonb_build_object('present', oid is not null, 'rls', rls_enabled, 'anon_access', anon_access, 'authenticated_access', authenticated_access)
  from relation_state
  union all
  select 'column ' || schema_name || '.' || table_name || '.' || column_name,
    present,
    jsonb_build_object('present', present)
  from column_state
  union all
  select 'function ' || signature,
    oid is not null and security_definer and empty_search_path and not anon_execute
      and case audience when 'authenticated' then authenticated_execute else service_execute and not authenticated_execute end,
    jsonb_build_object('present', oid is not null, 'audience', audience, 'security_definer', security_definer,
      'empty_search_path', empty_search_path, 'anon_execute', anon_execute,
      'authenticated_execute', authenticated_execute, 'service_execute', service_execute)
  from function_state
  union all
  select 'private policy helper ' || signature,
    oid is not null and not anon_execute and not authenticated_execute
      and definition like '%standard-character-roster-v1:kurogane%'
      and definition like '%standard-character-roster-v1:kurogane-lookahead-v2%',
    jsonb_build_object('present', oid is not null, 'anon_execute', anon_execute,
      'authenticated_execute', authenticated_execute, 'has_legacy_kurogane', definition like '%standard-character-roster-v1:kurogane%',
      'has_current_kurogane', definition like '%standard-character-roster-v1:kurogane-lookahead-v2%')
  from policy_helper_state
  union all
  select 'constraint ' || constraint_name,
    present and validated,
    jsonb_build_object('relation', relation_name, 'present', present, 'validated', validated)
  from constraint_state
  union all
  select 'trigger ' || trigger_name,
    present and enabled,
    jsonb_build_object('relation', relation_name, 'present', present, 'enabled', enabled)
  from trigger_state
  union all
  select 'index ' || index_name,
    present and usable,
    jsonb_build_object('present', present, 'usable', usable)
  from index_state
  union all
  select 'appearance backfill consistency',
    drift_count = 0,
    jsonb_build_object('drift_count', drift_count)
  from appearance_state
)
select check_name, ok, detail
from checks
order by ok, check_name;
