# Codex work status

- Last update: 2026-09-05 JST
- Stage: Standard Online / Quick P0 correction bundle is public; next UX state-machine correction is ready for implementation
- Integration branch: `codex/standard-release-command`
- Public baseline: `origin/main@881bd1721924d2f5ebe8f19905046d5783836cc9`
- Public URL: `https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/`
- Supabase project: `qkcuhludisairpgzhryl`; `standard-game-action` deployment 14

## Public in this release

- Standard terminal results now remain visible after overlay dismissal and reload. A losing player receives an exact `NO_LEGAL_COLOR` / `SEALED_OUT` explanation derived only from that player's private palette and public board/seal state. Finished rooms no longer keep stale waiting or CPU-thinking UI alive.
- Quick CPU persistence now accepts legal Half Shift regions in the 12x12 world, strictly derives source macros from connected micro cells, and canonicalizes compatible legacy v1 saves. This removes the public `invalid region macros` freeze path.
- The mid-width Standard lobby reflows without crushed columns, and gacha results no longer repeat the same acquisition summary.
- Every quiz question now carries a short mission, format label, and one-to-three thinking-step hint; server-confirmed answers drive reload-safe streak feedback without changing rewards.
- Public assets are `standard-online-v5` v18 and `solo-v5/save-codec.js?v=20260905-2`.

## Verification

- Focused non-browser integration: 123/123 passed.
- Candidate Windows browser gate `33961455909`: Chrome and Edge both passed at `881bd17`.
- Pages run `33961706817`: build and deployment succeeded at `881bd17`.
- Production Edge canary after deployment 14: 7/7 passed, including anonymous auth, missing/modified JWT rejection, profile, cosmetics, ten-character CPU roster, and ten quiz prompts with the new metadata.
- Public candidate preflight returned `ok:true`; protected snapshot and matchmaking RPC boundaries remained intact.
- Fresh public Standard and Quick pages returned HTTP 200, correct cache markers, and no captured browser warning/error. The existing Standard CPU room also survived a public-page reload.
- The long aggregate product runner encountered the known shared-browser host timeout after unrelated contact-effect cases. The release decision therefore used the changed focused suites plus the clean Windows Chrome/Edge gate; no product assertion from this release bundle failed.

## Next command priorities

1. P0: stop the lobby from offering a new match while a server-side active room exists. “Close this room on this device” must become screen-only navigation; a ready CPU room needs explicit no-reward abandon, and a playing room needs exactly-once surrender before it can be cleared.
2. P1: make the Cards CTA open a real room-independent six-card draft editor. Selecting a CPU must be local-only; one final “start with this CPU and these six cards” action should resume an immutable, reload-safe `cpu-start` + `setup` saga.
3. P1: add cumulative contact-color feedback tiers and a public “last move -> board change -> next decision” tactical trace without revealing private information.
4. P1 experiment: formalize `legalRecolor` as “塗り直し・乱” behind a lab/loadout gate. Keep the proposed two-color checkerboard card out of Standard until it has a separate ruleset.
5. Acceptance/operations: complete a physical two-device match/reload/rematch loop and the T+24h Supabase resource comparison. These remain `PENDING`, not inferred from automation.

No SQL migration was required by release `881bd17`. Production SQL, cleanup deletion/scheduling, billing, and secret values were not changed.
