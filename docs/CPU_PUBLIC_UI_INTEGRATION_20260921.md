# CPU pilot on the published compact UI

Version: `UDL011064-public-ui-v1`
Base: `4d91bbd4ea407be428144fe04ff5eb8821b3a8a0`
Pilot source: `2e30e9a25db674fe4168bac3ec745fe04641b3c9`
Branch: `codex/cpu-progression-public-ui-20260921`

This candidate carries the already adopted `UDL011064-pilot-design-v2` (canonical design SHA256 `d81198558f0e20b4891f1d6082239c42b8dd7815c80ca5ad0f699eb24109a285`) onto the published UI. The full CPU pilot contract and AC-011-01/02, AC-064-01 through07 remain in STANDARD_MODE_SPEC.md. This document changes no effect, unlock, grant, stock, CPU policy or acquisition rule. It is not release approval.

## Combined acceptance

- Preserve UI_NAVIGATION_RELEASE_20260920.md v1.1 and the published palette origins/four roles, gray/white board guidance, Half Shift parity, short turn guidance, compact stable six-card hand, Home/Profile, corrected tutorial and terminal/gacha recovery.
- Add the adopted separate technique control after the hand target controls, before palette history. Do not restore the removed matchSetupDetails panel or place the technique in the six-card hand. Keep current-color targets, keyboard access and44px controls.
- Trial start, equip and result recovery retain one pending request ID and never create a second action while uncertain. Preserve the normal match pending/rematch guards and explicit public recruit/find distinction.
- Demonstrate the existing full saved-win unlock → trial committed WIN → once-only permanent grant → equip → ordinary use → reload consumed → next eligible game reset journey. Both fixed trial initial routes remain legal; 解封 is not mandatory for clearing.
- Preserve alpha1-4 compatibility and alpha5 provenance; default OFF remains the production policy until separately approved gates. Disabling new starts must retain saved rooms and learned/equipped progress. No new portrait, private-hand exposure, PvP technique, all-ten-trial expansion or adoption of pending069/070.

## Current asset identity

Changed entry assets: `app.js?v=20260921-1`, `style.css?v=20260921-1`, `standard-online-client.js?v=20260914-1`, `standard-skill-registry.generated.js?v=20260914-2`.
Pilot models: `result-continuation.js?v=20260914-2`, `cpu-progression-model.js?v=20260914-1`.
Local pilot bundle: `app.bundle.js?v=20260914-11-63d4f2b526f1`. The earlier alpha.4 publication keeps its original local-bundle identifier.
Retained: `play-surface.css?v=20260915-5`, `play-surface-model.js?v=20260915-1`, `action-recovery.js?v=20260914-1`, `ui-diet.css?v=20260914-2`, `progression.css?v=20260914-1`, `terminal-result.css?v=20260914-1`, `surrender-confirmation.css?v=20260913-2`.

Registry and engine/local bundles are generated from the authoritative sources, not hand-edited. The previous UI specification and release-lane cache identifiers are immutable historical snapshots; only current-generation tests map them to this candidate.

## Verification and release boundary

The executable gate retains both source candidates' contract tests, Chrome/Edge online tests, Chrome isolated native-PostgreSQL races and Edge local lifecycle tests, with the current finite45-minute job cap and no new skips. standard-cpu-progression-public-ui.test.cjs covers the combined identity and retained public assets; standard-ui-navigation-integration.test.cjs keeps the frozen parent identity distinct from the current combined assets. Existing full pilot and UI browser suites establish runtime behavior; static text alone does not establish the journey.

Local integration and tests are in progress. Own Windows, genuine Astra review, push, main/Pages and production live acceptance are NOT_RUN for this candidate. Old052/057 do not authorize it. The old three-migration execution rejection remains held without retry or alternate route. The three migration files and compatible worker are source-only here; no DB, Edge or managed-setting operation is performed. Any future DB/Edge/activation/publication must bind this exact frozen candidate, its specification, exact change sets and new genuine review. Preserve original failures and closed budgets; do not reuse old live attempts.
