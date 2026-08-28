# Codex work status

- Last update: 2026-08-29 01:54 JST
- Stage: online quick MVP — public alpha hardening complete
- Branch / base commit: `main` / `abcad3e`
- GitHub: personal public repository `sakuratamaro/four-color-map-game`; Pages enabled

## Completed

- Preserved the verified v4.9 game byte-for-byte as the local two-player baseline.
- Added the server-authoritative online quick engine, lobby/UI, Supabase migration, RLS projections, and Edge Function.
- Enabled anonymous sign-in and deployed `game-action` without reading or exposing managed secret values.
- Published both the v4.9 root game and `/online-v5/` lobby from the personal repository.
- Verified the normal A/B path: room code, fixed seats, private hands/palettes, all three quick skills, reload, surrender, and synchronized finish.
- Verified a third anonymous player cannot enter, query, write, impersonate, or subscribe to another match.
- Added a byte-identical v4.9 publication gate and a 60,000-question distribution gate for answer-slot and numeric-rank fairness.
- Added repeatable live test harnesses for JWT/RLS/concurrency, Realtime RLS, and networked skill behavior. They print only pass/fail labels and never tokens or user IDs.
- Kept the applied migration immutable at SHA-256 `0A9ABEC7DD86F30FEA5DECE458C38DC8DF94590D286A78554980DBB7A15846B3`.

## Latest verification

- Local automated suite: 28/28 passed.
- Live security/concurrency: 25/25 passed.
- Live Realtime isolation: 2/2 passed.
- Live skills: 21/21 passed.
- SQL transaction-local RLS probe: A isolated = true, B isolated = true, C blocked = true.
- Security Advisor: no errors. Expected warnings remain for the three anonymous-auth game tables and the three intentionally callable `fcg_*` SECURITY DEFINER entry/helper functions. Two `public.rls_auto_enable()` warnings predate and are unrelated to this game, so they were not changed.
- Performance Advisor: no errors and no warnings; three informational suggestions only.
- GitHub Pages build #1 succeeded; both public URLs passed HTTPS browser smoke checks.

## Migration history note

The first migration was applied manually in the Dashboard SQL Editor. This project has no `supabase_migrations.schema_migrations` relation and the Supabase CLI is not installed locally, so CLI history/dry-run output is unavailable. The exact applied SQL is retained immutably by its SHA-256 above; future schema changes must use a new numbered migration instead of editing it.

## Current

- Delivery ZIP regenerated with 100 entries and no `.git` or nested `artifacts`; the companion manifest records its SHA-256.
- Commit and push the verified hardening changes to the personal public repository.
- Keep quiz/hint and additional existing-region skills frozen until this online-MVP checkpoint is recorded, then resume them as the next design phase.

## Next design phase

1. Add the one-use, 3–5 second timer-pausing formula hint and the instant/normal/challenge/spike question curve.
2. Implement a server-validated legal recolor/blanking skill before adding random variants.
3. Run paired-seat simulations and loadout-dominance checks before expanding the card pool.

## Processed collaboration messages

- Thread `6a90ba06-d1cc-83e8-b66a-b8b7a3794acd`, agent messages `b0ac2eb3-8f97-4cee-95f1-9ae70c9f8779`, `0180592b-5448-40fe-8908-f39ac6ad174f`, and `cbac4e41-89b8-4f5b-b9e6-9d8442cec7ef`.
