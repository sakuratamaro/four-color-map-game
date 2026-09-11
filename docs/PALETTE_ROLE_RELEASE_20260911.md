# UDL-052 role-identification release receipt

CANON_RECEIPT version=shared-canon-v1.1 base=5c03e6c2d0e94c843776ea7eae0d7bbe2917a174 request=UDL-20260910-052 specs=AGENTS.md,docs/SHARED_CANON.md,docs/PALETTE_ROLE_IDENTIFICATION_20260911.md,docs/STANDARD_PUBLIC_RELEASE_RUNBOOK.md tests=tests/standard-online-skill-intents.test.cjs,tests/standard-online-browser.test.cjs,scripts/live-standard-release-preflight.mjs

- Owner: existing commander task `01a07b56-616e-7733-9aae-90575659688e`; normal work, not the receive-only heartbeat.
- Product worktree: `.codex-worktrees/palette-role-identification-20260911`, clean candidate `ce6fab535235d7aff90d0bc846bbfb648c9a56e4`.
- Review: `CHATGPT-REVIEW-20260911-007`, genuine Astra response `a5e21358-7545-41cd-8c57-0f4d1b2fdd4b`, `APPROVE_RELEASE`, `UDL-052-roles-v1`, spec blob `5652a3f41caa453c67cb69fbe80a7a14a6a5c2ef`, Pages only, DB/Edge `[]`.
- Existing evidence: final candidate nonbrowser 845/845; focused Chrome/Edge 3/3 each; Windows run `34533968562` on this exact SHA successful. Chrome's separate local lifecycle CI step is intentionally skipped, not counted as executed.
- Publication starts only after a fresh remote main/base and candidate/spec comparison; never force push. New v4/v5/v6 intake is independent and is not part of this approved product diff.
- As of 2026-09-11T02:19:44Z: main integration, candidate Pages delivery, and public role checks are PENDING. Physical devices are NOT_RUN. Completion covers attribute identification only, not all UDL-052 or UDL-054.

This is release evidence on the existing governance branch, not a new canonical specification or a replacement ledger.

## Completed normal release

- Immediately before integration, fetched origin/main and verified it was still the exact approved base. Candidate clean, spec blob unchanged, base is an ancestor. Non-force `git push origin HEAD:main` succeeded; remote main readback was exact `ce6fab535235d7aff90d0bc846bbfb648c9a56e4`.
- Pages run [34554265788](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34554265788) succeeded on that exact SHA.
- `node scripts/live-standard-release-preflight.mjs --expect=candidate`: `ok:true`, candidate generation true, protected RPCs maintained. No DB/Edge deployment or schema change.
- `scripts/live-standard-palette-role-canary.cjs --confirm-live`: **30/30 PASS**, completed `2026-09-11T02:26:27.225Z`. One newly created test profile and one ordinary CPU match, regular setup/opening/CPU actions to the human COLOR phase. No backend mock, state injection, or existing-player writes.
- Fresh public Chrome at 390x844, reload, then resize to 1280x900: both basic colors have unlimited-role labels and accessible names; saved bonus remaining shown; horizontal overflow 0; same owned room; inspection game writes 0; console warnings/errors/page errors 0; room state unchanged by inspection.
- After inspection, the new test match was ended through normal SURRENDER. Test records remain; no deletion or cleanup of other data. Owned browser/context closed.
- Index/app/intents HTTP 200 and exact byte equality to the candidate Git blobs, not merely marker matches:

| File | Delivered SHA-256 |
|---|---|
| index.html | `4c1ff90e7b69fa0fb31fde521da248cbf171b9d775ec1fd0b7d85d0e24bffe6d` |
| app.js (`v20260911-26`) | `9c0dbeba945c86607ce5eac96b1c61cc4798732e1f8b4b1433ee161231ac362b` |
| standard-online-skill-intents.js (`v20260911-21`) | `bcaa039d6071b3bbef45ac379aadba0e390c5f9ee633cf12e91f0cab8039307f` |

Public URL: https://sakuratamaro.github.io/four-color-map-game/standard-online-v5/

Scope: **PUBLIC_VERIFIED for the role-identification slice only**. Overlap, double-basic, exhausted-bonus, seal and temporary-color combinations were covered by the fixed-candidate automated browser gate; these combinations were not manufactured in the live game. Physical two-device acceptance remains NOT_RUN. Position/fixed-four-color layout and UDL-054 remain unfinished. The actual review-wait automation remains PAUSED; no additional review wait is needed for this delivered candidate.
