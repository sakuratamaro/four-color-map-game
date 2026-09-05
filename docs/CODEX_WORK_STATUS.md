# Codex work status

- Last update: 2026-09-06 JST
- Stage: legal-recolor LAB candidate `ad53bb4` is local-verified and awaiting ordered DB/Edge/Pages release; physical two-device acceptance and T+24h observation remain pending
- Integration branch: `codex/standard-release-command`
- Public product baseline: `958a4da48769bcd145aca4db6b1b75f125f770d9` (active-room product commit `5acee05938a81bf5b0b9362c10ca32535c1e03ce`; later commits harden release evidence)
- Public URL: `https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/`
- Supabase project: `qkcuhludisairpgzhryl`; `standard-game-action` deployment 16

## Public in this release

- Cards now opens a room-independent six-card editor. Direct CPU selection stays local until the final confirmation, then a persisted two-stage start/setup saga reuses the same action IDs across reloads and lost responses.
- Every new-match entry returns to an owned room, matchmaking search, or CPU draft instead of allocating another match. The database now enforces one active Standard room per actor across inserts and room reactivation.
- Closing an active room is screen-only navigation: room identity and synchronization remain live, and the Home CTA returns to the same match. Finished rooms still use the existing result/rematch flow.
- Standard terminal results now remain visible after overlay dismissal and reload. A losing player receives an exact `NO_LEGAL_COLOR` / `SEALED_OUT` explanation derived only from that player's private palette and public board/seal state. Finished rooms no longer keep stale waiting or CPU-thinking UI alive.
- Quick CPU persistence now accepts legal Half Shift regions in the 12x12 world, strictly derives source macros from connected micro cells, and canonicalizes compatible legacy v1 saves. This removes the public `invalid region macros` freeze path.
- The mid-width Standard lobby reflows without crushed columns, and gacha results no longer repeat the same acquisition summary.
- Every quiz question now carries a short mission, format label, and one-to-three thinking-step hint; server-confirmed answers drive reload-safe streak feedback without changing rewards.
- Waiting/ready rooms now offer an explicit server-authoritative no-reward abandon action. It reuses the same room/version/action identity after a lost response, tells the other member what happened, and clears only the matching CPU setup saga. Playing rooms keep the exactly-once surrender path; finished rooms keep result/rematch.
- A committed CREATE now reveals contact-color pressure as a short cumulative 2→3 sequence, while four-color contact remains a terminal result. Selection, polling, reload, replay, and duplicate snapshots do not retrigger it; reduced motion receives the final static tier and screen readers receive one final announcement.
- The public state now carries a strictly allowlisted `lastPublicTrace`. The match screen keeps a compact “last move → board change → next decision” explanation for CREATE/COLOR/USE_SKILL without exposing hand, palette, skill identity, target, or pre-commit legality.
- If a browser loses its local room identity while the authenticated actor still owns one live Standard room, the client now recovers that exact private-code, public-queue, or CPU room instead of showing a raw database conflict or creating another room. Recovery adopts only a strictly validated one-row projection, preserves pending CPU/matchmaking sagas, does not steal focus during background hydration, and never re-displays a lost private room code.
- Public assets are app v22, client v16, style v21, and `solo-v5/save-codec.js?v=20260905-2`.

## Verification

- Legal-recolor LAB candidate `ad53bb4`: official non-browser runner 110 files with zero failures; CI unit-equivalent 191/191; full local Edge 60/60 and Chrome 60/60; responsive Edge/Chrome 4/4 each; lifecycle 76/76; deterministic regeneration of both bundles; three independent reviews reported no P0/P1. This is `LOCAL_VERIFIED`, not yet public.
- Local final Edge browser suite: 50/50 passed; the post-review CPU setup-saga race fixture passed separately. Changed static/client/SQL/runbook checks passed, and all four stale v19/006 expectations found by the aggregate non-browser run were updated and rechecked 23/23.
- Candidate Windows browser gate `33969830340`: Chrome job `101316251520` and Edge job `101316251312` passed at product commit `5c072ae`.
- Supabase migration `202609050007_standard_pregame_abandon.sql` is applied. Candidate verification was 66/66 true; live pregame-abandon canary was 33/33 with profiles unchanged and active/unknown/nonterminal residue all 0.
- Pages run `33970429997` succeeded at `426dc41`. Public v20/client-v15 markers and candidate preflight `ok:true` were verified. A preserved playing CPU room showed screen-only close plus “敗北として投了する” and no pregame-abandon action.
- Candidate Windows browser gate `33966896517`: Chrome job `101308503116` and Edge job `101308503120` passed at `03c5628`.
- Supabase migration `202609050006_standard_single_active_room.sql` is applied. After one unused ten-hour-old private waiting room with zero setup/action/view state was conditionally marked `abandoned` (no deletion; the existing CPU room was preserved), duplicate-active preflight was 0 and candidate verification was 61/61.
- The rollback-only database canary rejected a second active membership and an inactive-room reactivation, then reported residue 0.
- Pages run `33967367304` succeeded. Public v19 HTML/app/style markers, candidate preflight `ok:true`, and an existing CPU match's reload plus screen-only close/return were verified in Chrome.
- Focused non-browser integration: 123/123 passed.
- Candidate Windows browser gate `33961455909`: Chrome and Edge both passed at `881bd17`.
- Pages run `33961706817`: build and deployment succeeded at `881bd17`.
- Production Edge canary after deployment 14: 7/7 passed, including anonymous auth, missing/modified JWT rejection, profile, cosmetics, ten-character CPU roster, and ten quiz prompts with the new metadata.
- Product commit `ecafdd1` passed Windows browser gate `33973264978`: Edge job `101325424224` and Chrome job `101325424357` both succeeded. Three independent final reviews reported no P0/P1 release blocker.
- Deployment 15 live verification passed Runbook A 44/44, including the committed CREATE trace shape and private-field boundary; the basic Edge canary also passed 7/7.
- Pages run `33973971235` succeeded at `3e2b959`. Public HTML/app/style returned HTTP 200 with v21 and tactical-trace markers, candidate preflight returned `ok:true`, and the public browser loaded the five-tab app with anonymous auth and zero captured console errors.
- Public candidate preflight returned `ok:true`; protected snapshot and matchmaking RPC boundaries remained intact.
- Fresh public Standard and Quick pages returned HTTP 200, correct cache markers, and no captured browser warning/error. The existing Standard CPU room also survived a public-page reload.
- The long aggregate product runner encountered the known shared-browser host timeout after unrelated contact-effect cases. The release decision therefore used the changed focused suites plus the clean Windows Chrome/Edge gate; no product assertion from this release bundle failed.
- Active-room recovery passed the full local Edge browser suite 56/56 and the new recovery scenarios 3/3 in both Edge and Chrome. Windows gate `33976873376` passed at `ffdf8e5` (Edge job `101335024647`, Chrome job `101335024735`); the later two commits change release/canary scripts only and passed their local static checks.
- Migration `202609060001_standard_active_room_recovery.sql` is applied. Candidate verification is 68/68 true, including stable SQL/security-definer/empty-search-path, authenticated-only ACL, exact eight-column result, caller/setup scoping, live/expiry filters, two-row ambiguity cap, and zero duplicate active actors.
- `standard-game-action` deployment 16 passed the basic Edge canary 7/7. The strengthened immediate-CPU canary passed 10/10: the RPC returned only the caller's CPU room, a second CPU start recovered the same room, and the active-room count remained one.
- Pages run `33977699993` succeeded at `958a4da`. Candidate preflight returned `ok:true`; public HTML/app/client returned app v22/client v16 and all private/public/CPU Japanese recovery markers. The public browser loaded the five-tab app with anonymous authentication.

## Next command priorities

1. Release `ad53bb4` in the only compatible order: additive migration `202609060002_standard_setup_revision_guard.sql`, Edge source and generated bundle together, live canary, then Pages. Never publish Pages first because an older Edge would ignore the LAB opt-in.
2. Acceptance/operations: complete a physical two-device match/reload/rematch loop and the T+24h Supabase resource comparison. These remain `PENDING`, not inferred from automation.
3. P2: add first-hydration/reload coverage for the persistent tactical trace and explicit CPU/opponent display-name coverage; the public-only contract is already enforced.

Release `958a4da` applies additive migration `202609060001`, updates `standard-game-action` index source to deployment 16, and publishes Standard app v22/client v16. No secret, billing, deletion, cleanup schedule, game rule, reward, inventory, or engine bundle was changed.
