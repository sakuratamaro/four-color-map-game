# Online Multiplayer — Later Phase

Online multiplayer is desirable because collectible consumable cards gain more value in human-vs-human play, but it is intentionally deferred until the local rules engine is stable.

## Secret information

Future server-authoritative information includes:

- Full palettes of both players
- Unused carried skill cards
- Random draw results until they become public

Each client receives only public match state plus its own private information.

## Minimum future architecture

Candidate backend: Supabase.

- Auth: player identity
- PostgreSQL: matches, inventory, quiz rewards, match actions
- Row Level Security: player-specific data access
- Realtime: turn updates
- Edge Functions / server logic: validate intended actions

## Important rule

Do not trust the client to submit a finished board state.

Client sends an action request, for example:

```text
COLOR_REGION(regionId=R14, color=blue)
```

Server validates:

- correct turn
- pending Region is R14
- player actually owns blue
- blue is legal after adjacency calculation
- any used card is actually in inventory/hand

Only then is authoritative state updated.
