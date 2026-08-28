# v5.0 online design

## Baseline and scope

The root `index.html` plus the verified `payload/v4.9.part*.js` payload remains the behavioral baseline. Online support is an additive v5.0 path; local v4.9 remains available and is not replaced by the older Expo scaffold.

The first shippable milestone is a complete two-player **quick tutorial** match. Deliberation mode and the full skill catalogue follow only after this route is verified in two isolated browser sessions.

## Trust boundary

- Browsers submit intended actions such as `CREATE_REGION`, `COLOR_REGION`, `USE_SKILL`, `SURRENDER`, and `REMATCH`.
- A server-side action handler authenticates the JWT and derives the player id from it. A player id supplied in a request body is never trusted.
- The handler validates membership, seat, turn, expected match version, action payload, legal targets, palette, and remaining skills.
- A match version is incremented once per accepted action. Stale actions fail without changing state.
- Every action has a client-generated UUID. Repeating an accepted UUID returns its previous result and never applies the action twice.
- Random results that affect play are generated and persisted by the server-side handler.

## State split

The server stores three categories separately:

1. **Room metadata**: room id, hashed/normalized join code, status, timestamps, expiry, and current version.
2. **Public match state**: board geometry, painted regions, active seat, phase, public skill effects, winner, and action log entries safe for both players.
3. **Seat-private state**: palette, limited-color slot and remaining count, hand/skill counts, and unrevealed random results. RLS exposes each row only to its owning authenticated user.

Server-only rule state is not directly selectable through the Data API. The browser receives a composed view consisting of shared public state plus only its own private state.

## Room lifecycle

1. Anonymous authentication creates a stable browser-local user session.
2. Player A creates a room and receives a short normalized code.
3. Player B joins with the code; an atomic server operation claims the remaining seat.
4. A third user, the same user in both seats, or a join after start/expiry is rejected.
5. Once both seats are present, the server initializes the quick-mode authoritative state and changes the room to `playing`.
6. Realtime is a notification channel. On every event or reconnect, the client fetches the latest persisted version rather than treating the event payload as authoritative.
7. Finished and abandoned rooms retain `finished_at`, `last_activity_at`, and `expires_at` for safe scheduled cleanup.

## Database/RLS plan

- Public-schema tables contain only room/member/public projection/action receipt data needed by authenticated clients.
- Private and authoritative state use a non-exposed schema and are accessible only to narrowly granted server functions/Edge Functions.
- RLS is enabled on every public table. Policies require `auth.uid()` membership for reads and expose no direct client writes.
- Join/create/action functions use `SECURITY DEFINER`, an empty fixed `search_path`, schema-qualified names, explicit input validation, and execute grants only for `authenticated`.
- Membership, action id, room code, status, expiry, and realtime lookup columns are indexed.
- Migration is additive and idempotent; it never drops or alters unrelated objects.

## v4.9 state compatibility

The existing game object contains `Set`, `Map`, and non-finite numeric values that plain JSON cannot preserve. `online/state-codec.js` provides an explicit round-trip codec. This codec is a compatibility boundary, not permission to accept a complete client-authored game state. Final online actions still transition authoritative state on the server.

## Delivery checkpoints

- [x] Audit the v4.9 root payload and state shape.
- [x] Add and test an explicit state codec.
- [x] Extract the minimum quick-mode rules into a pure shared engine with injectable randomness (initial region/color/three loaned skills/action locking).
- [x] Add additive, idempotent Supabase migration with RLS and cleanup fields (remote execution still pending).
- [x] Add authenticated server-side action handler (remote deployment still pending).
- [x] Add lobby, room join, online quick-game UI, reconnect, and turn locking as an additive v5 path alongside v4.9.
- [ ] Verify A/B/C access isolation and two-browser match completion.
- [ ] Preserve local v4.9 smoke routes.
- [ ] Produce GitHub Pages artifacts and a local ZIP.
