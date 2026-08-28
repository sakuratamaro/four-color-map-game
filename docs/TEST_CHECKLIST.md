# v5 online quick MVP test checklist

## Local gates

- [x] Migration is additive and limited to `fcg_*` objects.
- [x] Public browser-readable tables enable RLS and deny direct writes.
- [x] Server-only RPCs are limited to `service_role`.
- [x] Edge handler derives player identity from the verified JWT.
- [x] Edge handler uses versioned UUID actions and the shared quick engine.
- [x] Entire local automated test suite passes after the latest integration changes (27/27 after the final rerun).
- [x] Original v4.9 local game loads byte-identically and advances to first-area selection.

## Live Supabase foundation

- [x] Migration succeeds on the target project.
- [x] Re-running the migration succeeds.
- [x] Public RLS, private tables, Realtime publication, and RPC ACLs match the design.
- [x] Anonymous authentication succeeds from browser A and browser B.
- [x] Browser A creates a room and becomes Player A.
- [x] Browser B joins by code and becomes Player B.
- [x] Browser C cannot join the occupied room; direct cross-seat read remains a separate explicit probe.

## Match path

- [x] Both clients receive the same initial public board and version.
- [x] Player A selects the first region; Player B receives it.
- [x] Player B colors legally and selects the next region; turn returns to A.
- [x] The inactive player's action controls are disabled.
- [ ] A stale version fails without changing state.
- [ ] Repeating an accepted action ID does not apply it twice.
- [x] Color Prism, Half Shift, and Color Seal synchronize correctly.
- [ ] Illegal color loss and curse rebound traverse the live network path; both pass deterministic engine regression, while live surrender/victory sync is verified.
- [x] Live finished-state controls are disabled and deterministic server-engine actions after finish are rejected.

## Reconnect and delivery

- [x] Reload restores the same seat and current version.
- [ ] Realtime interruption recovers by refetching persisted state.
- [x] GitHub Pages bundle contains no secret or service-role credential value.
- [x] Local distribution ZIP and SHA-256 manifest are generated and checked.
