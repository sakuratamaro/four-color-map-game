# Codex work status

- Last update: 2026-09-03 JST
- Stage: Standard online public-release candidate — local integration and hardening complete, production rollout not yet authorized
- Branch: `codex/standard-transport-lite`
- Public baseline: `origin/main` at `274e3a7`; candidate branch is 18 commits ahead before this status update
- Public URL currently points to the earlier accepted Standard build and must not be described as containing the candidate features

## Locally integrated

- Existing invitation-code Standard two-player flow and all 19 canonical skills.
- Server-authoritative profile, loadout, action, settlement, quiz, gacha, card-sale, trophy, history, and cosmetic boundaries.
- Code-free public matchmaking with atomic ticket claim, cancel/reconnect handling, and DB-side abuse limits.
- Consent-only CPU fallback after 90 seconds with a second offer at 180 seconds; no human impersonation and no automatic acceptance.
- Ten versioned named CPU characters, one-action-at-a-time authoritative play, separate CPU records, and same-character rematch.
- Snapshot v2 profile deltas, a small allowlisted appearance projection, single-flight Realtime refresh, and fallback polling controls.
- Preview-first bounded cleanup and a bounded per-isolate Edge request brake.
- Reproducible source-to-Edge bundle generation and a staged public-release runbook.

The authoritative adoption/deferral inventory is `docs/ONLINE_COMPLETION_INVENTORY.md`. Experimental `legalRecolor`, blanking, color exchange, delayed recolor, chain rotation, and split-and-hold remain intentionally outside the public card pool pending rules and balance decisions. The nested Expo/React Native early prototype is retained as historical reference, not as the current product source.

## Current verification

- Worktree was clean before the 2026-09-03 continuation audit.
- A serial repository audit produced 659 passing product tests. The only four failures came from Node auto-discovering the nested Expo prototype's Jest/TypeScript tests; those are not root Standard product tests.
- The earlier parallel root run had two timing-sensitive browser leaves fail; both passed independently, and neither reproduced in the serial product run.
- The supported root entry point is now `node scripts/run-standard-product-tests.mjs`, which enumerates only `tests/*.test.cjs` and defaults to serial execution.
- Local Postgres, Docker, and the Supabase CLI are unavailable, so migrations `202609030006` through `202609030013` have static/security coverage but have not been parsed or executed by a local database.
- Read-only live preflight on 2026-09-03 confirmed `origin/main` is still `274e3a7`, Pages returns HTTP 200 with the earlier Standard title, and its JavaScript contains none of public matchmaking, CPU roster, or cosmetics.
- Secret-free RPC probes confirmed the live `fcg_standard_room_snapshot` exists and rejects the anonymous role, while snapshot v2 and public matchmaking return PostgREST `PGRST202` absent-function responses. No user, room, row, or cleanup action was created.

## External state and next gate

No production DB, Edge Function, Pages, billing, secret, or cleanup-execution change was made by this candidate branch work. The next authorized phase is:

1. Reconfirm the live Supabase project, deployed function, Pages commit, advisors, and usage baseline by read-only inspection.
2. Apply migrations `202609030006` through `202609030013` one at a time. Installing the cleanup function is included; executing or scheduling cleanup is not.
3. Deploy `standard-game-action`, then publish Pages in that order.
4. Run invitation, economy/appearance, public matchmaking, and CPU canaries, followed by separate-device human and CPU full matches.
5. Record persistence, privacy, concurrency, rate-limit, snapshot-byte, RPC-count, p50/p95, error-rate, and usage evidence.

These production mutations require the user's narrow approval. Cleanup deletion/scheduling and billing changes require their own later approvals.
