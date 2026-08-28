# ADR 0001: Initial technology stack

## Status

Accepted for prototype.

## Decision

Use Expo + React Native + TypeScript. Use React Native Skia for board rendering. Use Jest for pure-rule tests. Reserve expo-sqlite for local persistence and Supabase for a later online phase.

## Rationale

- Turn-based game; no need for a full 3D/physics engine.
- TypeScript can be shared conceptually between app rules and future server functions.
- Expo supports Android/iOS/web from one project.
- Skia is appropriate for custom grid deformation and board animation.
- Keeping the game engine pure TypeScript makes rule testing independent from mobile UI.

## Constraint

Do not add online/backend complexity before the local prototype is playable.
