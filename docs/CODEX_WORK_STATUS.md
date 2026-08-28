# Codex work status

- Last update: 2026-08-29 01:35 JST
- Stage: online quick MVP — real Supabase integration
- Branch / base commit: `main` / `7c3692c`
- GitHub: personal public repository `sakuratamaro/four-color-map-game` connected as `origin`; no push performed yet

## Completed

- Preserved the verified v4.9 game as the baseline.
- Added the online state codec, pure quick engine, lobby/UI, Supabase migration, and Edge Function handler.
- Added local migration, Edge handler, engine, codec, and UI tests.
- Applied `202608280001_online_quick_mvp.sql` to Supabase project `qkcuhludisairpgzhryl` twice successfully.
- Verified live database objects, public-table RLS, Realtime publication, direct-write denial, and client/server RPC separation.
- Received and authenticated the older v5.0 RC1 ZIP by SHA-256; it is a regression reference and does not replace the safer server-authoritative design.
- Added a deterministic 60,000-question v4.9 regression gate for answer-slot and numeric-rank fairness, including all 36 joint combinations, independence, maximum deviation, and slot-only predictability.
- Incorporated ChatGPT design review for 3–5 second timer-pausing hints and tempo-costed existing-region interference skills.
- Created the personal public GitHub destination and verified that no company GitHub remote is configured.
- Deployed `game-action` with its function-local shared-engine copy; no managed secret value was read or exposed.
- Enabled Supabase anonymous sign-in and verified three distinct anonymous browser sessions.
- Completed a real A/B quick-match route through room creation/join, server initialization, region creation, coloring, all three loaned skills, reload reconnection, surrender, and synchronized finish.
- Verified that anonymous Player C is rejected from an occupied room.
- Added human-readable rule-rejection messages; invalid Half Shift targeting now explains the actual rule without falsely showing a connection outage.
- Expanded the local regression suite to 27/27, including a byte-identical published v4.9 gate, Half Shift geometry, Color Seal rebound, and post-finish rejection.
- Replaced the broken compressed v4.9 loader with the byte-identical verified v4.9 source; the published local entry now opens and advances to first-area selection.
- Built `artifacts/four-color-map-game-v5-online-rc1.zip`; the archive contains the local v4.9 entry, online client, Supabase migration/function, documentation, and tests, but excludes `.git` and the artifact directory itself.

## Current

- Harden the final delivery bundle and verify it contains no non-public credential.
- Exercise deployed duplicate-action and stale-version conflicts with a controlled test harness.
- Implement the one-use formula hint UI and constrained instant/normal/challenge/spike effort curve after the quick online network gate.
- Implement legal server-side recolor first, then validate later existing-region skill variants in priority order.

## Next

1. Verify deployed duplicate-action and stale-version handling without exposing browser tokens.
2. Push the verified quick MVP to the personal public repository and enable Pages.
3. Implement the one-use hint system and legal existing-region recolor skill.
4. Run paired-seat simulations, loadout dominance checks, and a Codex/ChatGPT adversarial playtest before declaring balance complete.

## Blockers

- No code has been pushed to the personal repository until the public-secret scan, v4.9 smoke route, and deploy-conflict checks complete.
- Standard-mode quiz/hint and existing-region skill expansion remains after the quick online MVP gate.

## Latest verification

- Local migration and Edge handler tests: 9/9 passed immediately before live migration.
- Supabase migration run 1: success, no rows returned.
- Supabase migration run 2: success, no rows returned.
- Applied migration SHA-256: `0A9ABEC7DD86F30FEA5DECE458C38DC8DF94590D286A78554980DBB7A15846B3`.
- Live verification: public tables, RLS, private tables, Realtime, direct-write blocking, client RPC ACL, and server RPC ACL all returned `true`.
- Processed collaboration instruction: thread `6a90ba06-d1cc-83e8-b66a-b8b7a3794acd`, agent message `b0ac2eb3-8f97-4cee-95f1-9ae70c9f8779`.
- Processed collaboration review: thread `6a90ba06-d1cc-83e8-b66a-b8b7a3794acd`, agent message `0180592b-5448-40fe-8908-f39ac6ad174f`.
- Quiz fairness regression: 1/1 passed after adding the 6×6 joint-distribution checks.
- Full local suite: 26/26 passed after the live-route fixes; the new byte-identical v4.9 publication gate brings the expected next run to 27 tests.
- Live room `C4376A`: A/B reached version 11; Color Prism, Half Shift, Color Seal, reload reconnect, surrender, and synchronized finish passed; occupied-room C join was rejected.
- Live rule-error room `12438F`: server reason was rendered in Japanese while the Realtime connection stayed healthy; room was then finished by surrender.
- Local v4.9 browser smoke: original UI loaded, secret-information handoff completed, and the game advanced to the first-area selection phase.
