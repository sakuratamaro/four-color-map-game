# Architecture

## Principle

The game engine is a pure TypeScript domain. Rendering, persistence and networking are adapters around it.

```text
Expo / React Native UI
        |
        +-- Skia board rendering
        +-- Standard screens (quiz/cards/gacha)
        |
        v
Pure TypeScript Game Engine
        |
        +-- local SQLite (later)
        +-- Supabase action API (later)
```

## Layer boundaries

### `src/game`

May import only other pure TypeScript modules. No React/Expo/native/database/network imports.

### `src/board`

Converts `MatchState` into visual geometry and touch selection. Must not decide game legality independently.

### `src/config`

All tunable balance values live here.

### `src/quiz`

Procedural question generators and grading. Numeric-answer problems are preferred in the first version to keep grading deterministic.

### `src/gacha`

Weighted rarity selection and card selection. Inject a seeded RNG for reproducible tests.

### `src/storage`

Local persistence adapter. SQLite is planned after core gameplay is stable.

### `supabase`

Reserved for future online multiplayer. Do not add dependencies until requested.

## Online boundary (future)

The client should send intentions such as `COLOR_REGION(regionId, blue)` rather than an already-mutated final MatchState. Server logic validates turn, ownership, secret palette, cards and legality, then commits the authoritative state.
