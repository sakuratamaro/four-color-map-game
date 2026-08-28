# First GitHub upload checklist

1. Create repository: `four-color-map-game`.
2. Suggested description:
   `Turn-based four-color map strategy game with hidden palettes, tactical skills, math quizzes, and collectible skill cards.`
3. Upload/extract this repository content at the repository root.
4. Do not add a public OSS license until licensing is intentionally decided.
5. Clone locally.

> Current scaffold targets Expo SDK 57. During the current transition period, Expo documents SDK 54 for physical-device Expo Go usage; choose explicitly before first device testing.

6. Install Node.js 22.13+.
7. Run:

```bash
npm install
npm run deps:fix
npm run doctor
npm run typecheck
npm test
npm start
```

8. Replace the placeholder Android/iOS app identifiers before store distribution.
9. Let Codex read `AGENTS.md`, `docs/GAME_DESIGN.md`, and `docs/ARCHITECTURE.md` before implementation work.
