# Supabase setup for v5.0

Project: `qkcuhludisairpgzhryl`

Only the Project URL and publishable key in `online/supabase-config.js` are browser configuration. Never place a secret key, service-role value, database password, connection string, or personal access token in this repository or a browser bundle.

## Migration

Run `supabase/migrations/202608280001_online_quick_mvp.sql` once in the project's SQL Editor. It is additive and idempotent by object name. It creates only `fcg_*` objects and the `fcg_private` schema; it does not delete or alter unrelated application objects.

The deployed project received this first migration manually through the Dashboard SQL Editor, so it does not have a `supabase_migrations.schema_migrations` history relation. The local Supabase CLI is also unavailable. Treat the applied file as immutable; its recorded SHA-256 is `0A9ABEC7DD86F30FEA5DECE458C38DC8DF94590D286A78554980DBB7A15846B3`, and any future database change must be a new migration file.

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

Do not schedule or invoke cleanup in production until retention boundaries are approved and a dry-run has been reviewed. Migration `202609030012_batched_cleanup.sql` adds the preview-first `fcg_server_cleanup_expired_batched` service RPC, caps each category at 500 rows per call, requires profile-scoped receipts to be at least seven days old, and keeps the legacy room-only entry point compatible but capped at 100 rooms. The intended initial policy to validate in staging is: expired rooms older than 24 hours, resolved tickets/quiz sessions older than 7 days, and profile-scoped idempotency receipts older than 30 days. Scheduling remains a separate production change.

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
- [x] Anonymous C cannot join an occupied A/B room and reads zero rows for that room.
- [x] A/B each return only their own `fcg_player_views` row; the opposite seat and C are hidden.
- [x] Direct authenticated updates to `fcg_rooms`, `fcg_room_members`, and `fcg_player_views` are denied through PostgREST.
- [x] Realtime sends the filtered room-member update to A and sends no matching update to subscribed outsider C.
- [x] Edge handler initializes, loads, validates, and atomically commits normal actions.
- [x] Missing, modified, and publishable-key Bearer tokens are rejected; valid anonymous JWT succeeds.
- [x] Same-ID replay, same-version conflicts, stale/off-turn/nonmember/post-finish actions all follow the expected server result.
- [x] Dashboard Security Advisor reports no errors; game-related warnings match the intentional anonymous-auth API surface.
- [x] Dashboard Performance Advisor reports no errors or warnings.

The remaining game-related Security Advisor warnings are expected: anonymous-authenticated players must be able to call room create/join and the RLS membership helper, and the three public projections intentionally allow only authenticated anonymous participants through RLS. The separate warnings for `public.rls_auto_enable()` are unrelated pre-existing project objects and were not changed. Post-run SQL and live HTTP/WebSocket probes confirmed the intended isolation.
