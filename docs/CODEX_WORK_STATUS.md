# Codex work status

- Last update: 2026-09-05 JST
- Stage: Standard active-room exclusivity and recoverable CPU-start UX are public; physical two-device acceptance remains pending
- Integration branch: `codex/standard-release-command`
- Public baseline: `origin/main@03c5628d9daf2dd516ca448ebe2b799835dfcfd7`
- Public URL: `https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/`
- Supabase project: `qkcuhludisairpgzhryl`; `standard-game-action` deployment 14

## Public in this release

- Cards now opens a room-independent six-card editor. Direct CPU selection stays local until the final confirmation, then a persisted two-stage start/setup saga reuses the same action IDs across reloads and lost responses.
- Every new-match entry returns to an owned room, matchmaking search, or CPU draft instead of allocating another match. The database now enforces one active Standard room per actor across inserts and room reactivation.
- Closing an active room is screen-only navigation: room identity and synchronization remain live, and the Home CTA returns to the same match. Finished rooms still use the existing result/rematch flow.
- Standard terminal results now remain visible after overlay dismissal and reload. A losing player receives an exact `NO_LEGAL_COLOR` / `SEALED_OUT` explanation derived only from that player's private palette and public board/seal state. Finished rooms no longer keep stale waiting or CPU-thinking UI alive.
- Quick CPU persistence now accepts legal Half Shift regions in the 12x12 world, strictly derives source macros from connected micro cells, and canonicalizes compatible legacy v1 saves. This removes the public `invalid region macros` freeze path.
- The mid-width Standard lobby reflows without crushed columns, and gacha results no longer repeat the same acquisition summary.
- Every quiz question now carries a short mission, format label, and one-to-three thinking-step hint; server-confirmed answers drive reload-safe streak feedback without changing rewards.
- Public assets are `standard-online-v5` v19 and `solo-v5/save-codec.js?v=20260905-2`.

## Verification

- Local final browser suite: 46/46 passed. Changed static/client/SQL/runbook checks: 80/80 passed after the v19 cache marker update.
- Candidate Windows browser gate `33966896517`: Chrome job `101308503116` and Edge job `101308503120` passed at `03c5628`.
- Supabase migration `202609050006_standard_single_active_room.sql` is applied. After one unused ten-hour-old private waiting room with zero setup/action/view state was conditionally marked `abandoned` (no deletion; the existing CPU room was preserved), duplicate-active preflight was 0 and candidate verification was 61/61.
- The rollback-only database canary rejected a second active membership and an inactive-room reactivation, then reported residue 0.
- Pages run `33967367304` succeeded. Public v19 HTML/app/style markers, candidate preflight `ok:true`, and an existing CPU match's reload plus screen-only close/return were verified in Chrome.
- Focused non-browser integration: 123/123 passed.
- Candidate Windows browser gate `33961455909`: Chrome and Edge both passed at `881bd17`.
- Pages run `33961706817`: build and deployment succeeded at `881bd17`.
- Production Edge canary after deployment 14: 7/7 passed, including anonymous auth, missing/modified JWT rejection, profile, cosmetics, ten-character CPU roster, and ten quiz prompts with the new metadata.
- Public candidate preflight returned `ok:true`; protected snapshot and matchmaking RPC boundaries remained intact.
- Fresh public Standard and Quick pages returned HTTP 200, correct cache markers, and no captured browser warning/error. The existing Standard CPU room also survived a public-page reload.
- The long aggregate product runner encountered the known shared-browser host timeout after unrelated contact-effect cases. The release decision therefore used the changed focused suites plus the clean Windows Chrome/Edge gate; no product assertion from this release bundle failed.

## Next command priorities

1. Acceptance/operations: complete a physical two-device match/reload/rematch loop and the T+24h Supabase resource comparison. These remain `PENDING`, not inferred from automation.
2. P1: add an idempotent server-authoritative no-reward abandon/cancel for waiting/ready rooms; playing remains the existing exactly-once surrender path.
3. P1: add cumulative contact-color feedback tiers and a public “last move -> board change -> next decision” tactical trace without revealing private information.
4. P1: translate rare single-active-room conflicts into a dedicated Japanese recovery message and resynchronize the existing room.
5. P1 experiment: formalize `legalRecolor` as “塗り直し・乱” behind a lab/loadout gate. Keep the proposed two-color checkerboard card out of Standard until it has a separate ruleset.

Release `03c5628` applied migration `202609050006`. No Edge bundle, secret, billing, deletion, or cleanup schedule was changed.
