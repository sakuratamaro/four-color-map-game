# Online MVP status

## Public alpha

- Repository: `https://github.com/sakuratamaro/four-color-map-game`
- v4.9 local game: `https://sakuratamaro.github.io/four-color-map-game/`
- Online quick lobby: `https://sakuratamaro.github.io/four-color-map-game/online-v5/`

The online quick MVP is deployed and its primary path is playable. The company GitHub remote is not configured; legacy import history is local-only on `codex/legacy-import`.

## Implemented

- Supabase anonymous authentication
- Six-character room creation/joining
- Atomic fixed Player A/B assignment and occupied-room rejection
- Public, seat-private, and server-authoritative state separation
- Server-owned turn/rule/skill validation
- UUID action receipts and optimistic version checks
- Realtime invalidation with persisted polling/reload recovery
- Surrender, authoritative victory, and post-finish rejection
- Color Prism, Half Shift, and Color Seal with later curse rebound

## Real-environment evidence

- JWT/RLS/concurrency harness: 25/25
  - missing/modified JWT and publishable-key-as-Bearer rejected;
  - request-body user/seat spoofing and nonmember actions rejected;
  - simultaneous B/C join assigns exactly one B;
  - duplicate action ID applies once;
  - same-version competing actions have one winner and one stale rejection;
  - off-turn, explicit stale, and post-finish actions rejected;
  - A/B see their member room and own private row; C sees zero rows;
  - direct browser-table writes denied;
  - A/B polling returns the final authoritative state.
- Realtime harness: 2/2
  - a member receives the authorized membership update;
  - a third party subscribed to the same filtered topic receives no update.
- Skill harness: 21/21
  - Color Seal blocks the chosen color without advancing version;
  - an alternate legal color succeeds;
  - the seal curse later rebounds onto its user;
  - Four Color Release can cover a cursed palette;
  - adjacent same-color play causes authoritative `ILLEGAL_COLOR` defeat;
  - further operations after finish are rejected.
- Manual browser path additionally covered Half Shift, reload reconnection, Japanese rule-error rendering, and connection-health preservation.

## Remaining scope outside the online quick MVP

- Standard-mode quiz hint UX and difficulty curve
- Additional existing-region skill variants
- Broader balance simulation and long-session device testing

These are the next product phase, not missing security primitives of the published quick MVP.
