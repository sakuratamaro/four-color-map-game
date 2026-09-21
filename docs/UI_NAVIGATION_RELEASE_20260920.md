# UI navigation integration

Version: `UDL-023-060-062-067-068-navigation-v1.1`

Base: `fc089450e3a4e41e6c287f5359fc076f085f2903`
Source UI tree: `172c35651b2e6c5afd44179733d34ed269e88daf`
Common baseline: `70e691b6f8f1d808476e80990d20df7862bfb782`
Branch: `codex/ui-navigation-release-20260920`

## Purpose and boundaries

Integrate the already implemented/adopted navigation, Home, Profile and recovery UI into the newer fc UI. The 47-file source delta is carried as source changes, not a merge of unrelated private history. This is a local combined candidate, not evidence of publication. Implementation and specification changes require their own exact tests and genuine Astra review; no parent approval is inherited.

Keep fc palette origins, four distinct palette roles, stable compact hand, gray/white board guidance, candidate contours, short turn guidance and reward-gacha lobby recovery. Keep unchanged game rules, CPU logic/roster, engine/client protocol, ownership, sale/gacha/quiz economy, odds, DB, Edge, images and management settings. DB/Edge/management change sets: `[]`. No new image.

The registry build exposes the existing transaction's GACHA_ODDS solely for a collapsed odds table. Regenerate from the authoritative source; do not edit probability numbers or generated code by hand.

## Authoritative requirement mapping

| Requirement | Retained specification | Executable regression entry |
| --- | --- | --- |
| UDL-20260907-023 explicit wait/join | UI_PUBLIC_MATCH_ACTIONS_20260913.md / UDL-023-public-actions-v1 | standard-online-ui-static, standard-online-browser |
| UDL-20260912-067 CPU face on surrender | SURRENDER_CPU_FACE_20260913.md / UDL-067-face-v1.1 | standard-surrender-confirmation, standard-online-browser |
| UDL-20260912-060 terminal hierarchy | UI_TERMINAL_HIERARCHY_20260914.md / UDL-060-terminal-v2 | standard-result-continuation, standard-online-browser |
| UDL-20260912-062 quiz and gacha entry | QUIZ_LEVEL_START_20260914.md / UDL-062-quiz-entry-v1.1; GACHA_ENTRY_DIET_20260914.md / UDL-062-gacha-entry-v1 | standard-quiz-level-start, standard-gacha-entry, standard-quiz-reward-gacha, standard-online-browser |
| UDL-20260912-062 / UDL-20260913-068 Home and tutorial | HOME_RULES_DIET_20260914.md / UDL-062-068-home-rules-v1.2 | standard-home-rules, standard-online-browser |
| UDL-20260912-062 Profile and recovery | PROFILE_COMPACT_20260914.md / UDL-062-profile-compact-v1.1; BLOCKED_ACTION_RECOVERY_20260914.md / UDL-062-action-recovery-v1.1 | standard-profile-compact, standard-action-recovery, standard-online-browser |
| Retained fc UI | UI_PLAY_SURFACE_20260912.md / v1.6; UI_FOLLOWUP_RELEASE_20260915.md / UDL-052-060-followup-v1 | standard-palette-origin-rim, standard-palette-notice-lifecycle, standard-hand-compact, standard-board-affordance, standard-half-shift-candidate-parity, standard-turn-guide-diet, standard-gacha-lobby, standard-online-browser |

Test names above resolve to `tests/<name>.test.cjs`. The workflow retains the full existing engine/SQL contract suite and serial Chrome/Edge browser suites, bounded to 45 minutes per job. Documentation is not an automated test result.

## Combined acceptance

- Public wait invokes only recruit; join invokes only find. Busy/pending paths preserve the original request ID.
- Existing public CPU identity is reused by surrender confirmation. Cancel sends nothing; explicit confirmation sends once. No hidden state or new portrait asset is introduced.
- Terminal reward feedback uses persisted ACK data and at most three main actions. No extra game/economy write is caused by navigation.
- Quiz has five direct level starts. Gacha has five level buttons, count feedback and collapsed odds/help; invalid level, 100-card cap, busy/pending, actionId/count, reload and retry guards remain exact.
- Result-gacha return retains fc's “結果を閉じてロビーへ”. An unresolved rematch returns to its existing recovery control, never creates another rematch, clears a pending ID or accepts an unrelated/stale result.
- Home settings/tutorial and compact Profile remain navigable at 390/768/1280 widths and 320-wide enlarged layout. Recovery links preserve CPU/setup/sale pending data, last-card/protection constraints and confirmation semantics.
- Tutorial item 4 distinguishes the non-consuming ⓘ information control from the card body used to activate a skill immediately or select its target. This copy-only clarification preserves existing skill behavior and adds static and native-browser tutorial regression coverage.
- Existing startup and native-canvas diagnostics are retained. Prior failures remain historical; a new local pass does not erase or replace the failed Home Windows run.

## Candidate assets and release boundary

New combined cache markers: `app.js?v=20260920-1`, `style.css?v=20260920-1`. Retained fc markers: `play-surface.css?v=20260915-5`, `play-surface-model.js?v=20260915-1`.
Source UI dependencies: `ui-diet.css?v=20260914-2`, `progression.css?v=20260914-1`, `terminal-result.css?v=20260914-1`, `surrender-confirmation.css?v=20260913-2`, `result-continuation.js?v=20260914-1`, `action-recovery.js?v=20260914-1`, `standard-skill-registry.generated.js?v=20260914-1`.

Current phase: local integrated candidate. Its identity is the exact commit containing this specification; local test evidence must bind that commit and distinguish the original failures from their repaired cases. Own Windows/genuine review/push/main/Pages/live/physical are NOT_RUN in this snapshot. The historical 98d→fc publication sequence and original source lanes are unchanged. Consolidating those source lanes into a future publication plan needs explicit exact-scope review; this document does not bypass a hold.

Before any future publication: freeze candidate → own Windows all required steps → exact genuine Astra review of the combined scope and publication order → resolve the existing Pages technical hold → fresh main compatibility → force-free integration → same-SHA Pages → full changed-asset byte verification → only separately authorized finite live checks. No old live/CI/review budget is reset or reused. No new scheduler or queue.
