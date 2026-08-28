# Supabase setup for v5.0

Project: `qkcuhludisairpgzhryl`

Only the Project URL and publishable key in `online/supabase-config.js` are browser configuration. Never place a secret key, service-role value, database password, connection string, or personal access token in this repository or a browser bundle.

## Migration

Run `supabase/migrations/202608280001_online_quick_mvp.sql` once in the project's SQL Editor. It is additive and idempotent by object name. It creates only `fcg_*` objects and the `fcg_private` schema; it does not delete or alter unrelated application objects.

The migration provides:

- anonymous-authenticated room creation and joining via six-character room codes;
- atomic A/B seat assignment and third-player rejection;
- participant-only RLS for room and member projections;
- owner-only RLS for player-secret projections;
- a non-exposed authoritative state schema;
- optimistic match versioning and UUID action receipts;
- Realtime publication for the three browser-readable projections;
- `last_activity_at`, `finished_at`, and `expires_at` cleanup fields;
- service-role-only RPCs for the Edge Function action handler.

Do not invoke `fcg_server_cleanup_expired` until an explicit retention interval is chosen. The function deletes only expired `fcg_rooms` rows and their `fcg_*` dependents.

## Expected security model

Anonymous users receive the `authenticated` role. They can call only `fcg_create_room` and `fcg_join_room`, then select rows allowed by RLS. They cannot insert, update, or delete game tables directly. The deployed Edge Function verifies the caller JWT and uses the service-role credential from its managed environment to invoke the server-only state transition RPCs; the credential value is never sent to the browser.

Realtime is used as an invalidation signal. After a change or reconnect, clients fetch current persisted rows and compare `version` rather than trusting an event payload as the game authority.

## Verification checklist

- [x] Migration succeeds twice without errors. Verified in project `qkcuhludisairpgzhryl` on 2026-08-28 JST.
- [x] Public tables `fcg_rooms`, `fcg_room_members`, and `fcg_player_views` exist with RLS enabled.
- [x] All three public projection tables are in the `supabase_realtime` publication.
- [x] `authenticated` has no direct INSERT, UPDATE, or DELETE privilege on the public game tables.
- [x] Client RPCs are executable by `authenticated`; server-only RPCs are executable by `service_role` and not by `authenticated`.
- [x] Private tables `fcg_private.authoritative_matches` and `fcg_private.action_receipts` exist.
- [x] Anonymous A can create a room.
- [x] Anonymous B can join using the returned code.
- [x] Anonymous C cannot join an occupied A/B room; an explicit cross-room select probe is still pending.
- [x] Normal A/B client queries each return only that seat's `fcg_player_views` row; an explicit malicious cross-seat selector probe is still pending.
- [ ] Direct inserts/updates/deletes as `authenticated` are denied.
- [x] Realtime synchronizes participant-visible room, membership, and own player-view changes; explicit hostile-row subscription remains pending.
- [x] Edge handler initializes, loads, validates, and atomically commits normal actions.

The dashboard warning about tables being created without RLS was expected: the migration creates the tables first and enables RLS later in the same transaction. The migration's own RLS statements were retained, and the post-run catalog query confirmed RLS on all browser-readable tables.
