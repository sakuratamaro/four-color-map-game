# v5 online quick MVP test checklist

## Local gates

- [x] Migration is additive and limited to `fcg_*` objects.
- [x] Every `fcg_*` SECURITY DEFINER function pins `search_path = ''` and fully qualifies data objects.
- [x] Public tables enable RLS and deny direct writes.
- [x] Server-only RPCs are limited to `service_role`.
- [x] Edge handler derives identity from a verified JWT and ignores body identity claims.
- [x] Function deployment config requires JWT verification.
- [x] Edge handler uses versioned UUID actions and the shared quick engine.
- [x] Entire local automated suite passes (28/28).
- [x] Published local game is byte-identical to the verified v4.9 baseline.
- [x] Quiz distribution regression covers all 36 answer-slot × numeric-rank cells over 60,000 questions.

## Live identity, RLS, and concurrency

- [x] Missing JWT is rejected.
- [x] Modified JWT is rejected.
- [x] Publishable key used as a Bearer token is rejected.
- [x] Valid anonymous JWT succeeds.
- [x] Fake body `userId` / `seat` cannot impersonate a player.
- [x] Simultaneous B/C join assigns exactly one Player B.
- [x] Same `action_id` applies once.
- [x] Different action IDs with the same expected version produce one success and one stale rejection.
- [x] Explicit stale, off-turn, nonmember, and post-finish actions are rejected.
- [x] A/B read their member room and both public seats; C reads zero rows.
- [x] A and B each read only their own private projection.
- [x] Direct authenticated updates to all three public game tables are denied.

## Live delivery and match rules

- [x] Member receives an authorized Realtime update.
- [x] Third-party subscriber receives no matching Realtime update.
- [x] Polling/reload restores the final persisted version and status for A/B.
- [x] Color Prism, Half Shift, and Color Seal traverse the live network path.
- [x] Sealed color rejection does not advance state.
- [x] Color Seal curse rebounds onto its user on the later turn.
- [x] Adjacent same color causes authoritative loss.
- [x] Surrender and post-finish rejection synchronize.
- [x] Invalid rule reasons render in Japanese without falsely marking Realtime disconnected.

## Dashboard and publication

- [x] Security Advisor reports no errors; expected anonymous-game warnings are documented.
- [x] Performance Advisor reports no errors or warnings.
- [x] GitHub Pages bundle contains no secret/service-role credential value.
- [x] Personal public repository and both Pages URLs are live.
- [x] Delivery ZIP and SHA regenerated after the final hardening changes.

## Repeatable commands

The live scripts create disposable anonymous users and rooms; they require an explicit flag and never print tokens or user IDs.

```powershell
node scripts/live-security-smoke.mjs --confirm-live
node scripts/live-realtime-smoke.mjs --confirm-live
node scripts/live-skill-smoke.mjs --confirm-live
```
