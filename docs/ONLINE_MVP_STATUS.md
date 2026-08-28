# Online MVP status

## Implemented locally

- Anonymous-authenticated room create/join flow
- Fixed Player A / Player B seats and third-player rejection
- Public, seat-private, and server-authoritative state separation
- UUID action receipts and optimistic version checks
- Quick-mode server-side action validation
- Realtime invalidation plus persisted-state reload
- Browser reload reconnection path
- Turn lock, surrender, finish, and post-finish rejection paths

## Verified against real Supabase

- Additive migration applies idempotently
- Public projection tables have RLS
- Direct client writes are denied
- Server-only functions are not executable by authenticated clients
- Realtime publication contains all three public projection tables
- Cleanup timestamps and cleanup RPC exist
- Anonymous sign-in works in three independent browser sessions
- A creates an invite-code room; B joins as the fixed second seat; C is rejected after occupancy
- Edge Function initializes and atomically advances the persisted game version
- A/B receive synchronized public state while retaining seat-specific private palettes, hands, and seals
- Region creation, legal coloring, Color Prism, Half Shift, Color Seal, surrender, and finish all traverse the network path
- Browser reload restores Player B, the current version, private state, and board
- Invalid skill targeting returns a specific safe rule reason without degrading connection state

## Not yet verified against real Supabase

- Duplicate action replay and stale-version rejection through the deployed Edge Function
- Forced Realtime interruption followed by polling recovery (ordinary page-reload recovery is verified)
- Color Seal's later rebound through the network path (deterministic engine regression passes locally)
- A direct browser query attempting to read the other seat's private row (catalog/RLS and normal projection behavior are verified)

## Publication status

- Personal public GitHub repository: `https://github.com/sakuratamaro/four-color-map-game`
- Local `origin` points only to the personal repository.
- No push has been performed yet; publish only after secret scanning and the live quick-route gate.
