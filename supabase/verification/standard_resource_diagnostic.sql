-- Read-only aggregate diagnostic for Standard Online resource pressure.
-- This intentionally returns no row identifiers, user identifiers, SQL text, or secrets.

with
publication_rows as (
  select schemaname as schema_name, tablename as table_name
  from pg_catalog.pg_publication_tables
  where pubname = 'supabase_realtime'
  order by schemaname, tablename
),
publication_summary as (
  select coalesce(
    jsonb_agg(jsonb_build_object('schema', schema_name, 'table', table_name)),
    '[]'::jsonb
  ) as value
  from publication_rows
),
replication_summary as (
  select jsonb_build_object(
    'total_slots', count(*),
    'active_slots', count(*) filter (where active),
    'inactive_slots', count(*) filter (where not active),
    'slots_with_restart_lsn', count(*) filter (where restart_lsn is not null),
    'sum_of_per_slot_lag_bytes', coalesce(sum(pg_catalog.pg_wal_lsn_diff(pg_catalog.pg_current_wal_lsn(), restart_lsn)), 0),
    'retained_wal_bytes_max', coalesce(max(pg_catalog.pg_wal_lsn_diff(pg_catalog.pg_current_wal_lsn(), restart_lsn)), 0)
  ) as value
  from pg_catalog.pg_replication_slots
  where database = current_database()
),
relation_rows as (
  select
    namespace.nspname as schema_name,
    relation.relname as relation_name,
    pg_catalog.pg_total_relation_size(relation.oid) as total_bytes,
    pg_catalog.pg_relation_size(relation.oid) as table_bytes,
    pg_catalog.pg_indexes_size(relation.oid) as index_bytes
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where relation.relkind in ('r', 'm')
    and namespace.nspname in ('public', 'fcg_private', 'auth')
  order by total_bytes desc, schema_name, relation_name
  limit 20
),
relation_summary as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', schema_name,
        'relation', relation_name,
        'total_bytes', total_bytes,
        'table_bytes', table_bytes,
        'index_bytes', index_bytes
      ) order by total_bytes desc, schema_name, relation_name
    ),
    '[]'::jsonb
  ) as value
  from relation_rows
),
dead_tuple_rows as (
  select
    schemaname as schema_name,
    relname as relation_name,
    n_live_tup as estimated_live_tuples,
    n_dead_tup as estimated_dead_tuples,
    last_autovacuum,
    last_autoanalyze
  from pg_catalog.pg_stat_user_tables
  where schemaname in ('public', 'fcg_private', 'auth')
  order by n_dead_tup desc, schemaname, relname
  limit 20
),
dead_tuple_summary as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', schema_name,
        'relation', relation_name,
        'estimated_live_tuples', estimated_live_tuples,
        'estimated_dead_tuples', estimated_dead_tuples,
        'last_autovacuum', last_autovacuum,
        'last_autoanalyze', last_autoanalyze
      ) order by estimated_dead_tuples desc, schema_name, relation_name
    ),
    '[]'::jsonb
  ) as value
  from dead_tuple_rows
),
connection_summary as (
  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where state = 'active'),
    'idle_in_transaction', count(*) filter (where state = 'idle in transaction'),
    'blocked', count(*) filter (where cardinality(pg_catalog.pg_blocking_pids(pid)) > 0),
    'realtime_application_connections', count(*) filter (where application_name ilike '%realtime%')
  ) as value
  from pg_catalog.pg_stat_activity
  where datname = current_database()
),
retention_summary as (
  select jsonb_build_object(
    'rooms_older_than_24h', (
      select count(*) from public.fcg_rooms room
      where room.expires_at < now() - interval '24 hours'
        and room.last_activity_at < now() - interval '24 hours'
    ),
    'searching_tickets_older_than_7d', (
      select count(*) from fcg_private.standard_matchmaking_tickets ticket
      where ticket.state = 'searching'
        and ticket.expires_at < now() - interval '7 days'
    ),
    'resolved_tickets_older_than_7d', (
      select count(*) from fcg_private.standard_matchmaking_tickets ticket
      where ticket.state in ('claimed', 'cancelled', 'expired')
        and coalesce(ticket.resolved_at, ticket.expires_at) < now() - interval '7 days'
    ),
    'quiz_sessions_older_than_7d', (
      select count(*) from fcg_private.standard_quiz_sessions quiz
      where coalesce(quiz.completed_at, quiz.expires_at) < now() - interval '7 days'
    ),
    'matchmaking_find_receipts_older_than_30d', (
      select count(*) from fcg_private.standard_matchmaking_find_receipts receipt
      where receipt.created_at < now() - interval '30 days'
    ),
    'gacha_receipts_older_than_30d', (
      select count(*) from fcg_private.standard_gacha_receipts receipt
      where receipt.created_at < now() - interval '30 days'
    ),
    'card_sale_receipts_older_than_30d', (
      select count(*) from fcg_private.standard_card_sale_receipts receipt
      where receipt.created_at < now() - interval '30 days'
    ),
    'cosmetic_receipts_older_than_30d', (
      select count(*) from fcg_private.standard_cosmetic_receipts receipt
      where receipt.created_at < now() - interval '30 days'
    ),
    'matchmaking_limits_older_than_7d', (
      select count(*) from fcg_private.standard_matchmaking_limits limits
      where limits.updated_at < now() - interval '7 days'
        and coalesce(limits.blocked_until, '-infinity'::timestamptz) < now()
    )
  ) as value
)
select jsonb_build_object(
  'captured_at', now(),
  'database_bytes', pg_catalog.pg_database_size(current_database()),
  'publication', publication_summary.value,
  'replication_slots', replication_summary.value,
  'connections', connection_summary.value,
  'largest_relations', relation_summary.value,
  'dead_tuples', dead_tuple_summary.value,
  'retention_candidates', retention_summary.value
) as standard_resource_diagnostic
from publication_summary
cross join replication_summary
cross join connection_summary
cross join relation_summary
cross join dead_tuple_summary
cross join retention_summary;
