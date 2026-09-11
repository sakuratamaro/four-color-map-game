# UDL-059 quiz reward ticket-level navigation

Version: `UDL-059-quiz-v1`

CANON_RECEIPT version=shared-canon-v1.1 base=ce6fab535235d7aff90d0bc846bbfb648c9a56e4 request=UDL-20260911-059 specs=docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/BRAIN_V4_V6_INTAKE_20260911.json tests=tests/standard-online-browser.test.cjs,tests/standard-gacha-transaction.test.cjs

Owner: existing Codex commander `01a07b56-616e-7733-9aae-90575659688e`. Shared intake/UDL stays on the existing `codex/dev-brain-current-20260910` branch; this dedicated product worktree does not copy that ledger or re-open the migration.

Source: actual user `0832e679-e775-4622-8f09-08a2900ca109`, Astra follow-up `3709f277-5a0b-4fb1-be6e-58375acd6c0f` replying to report `9a175c4b-6ab1-4236-b5b6-1d47fbf84ad4` in `改修ロールバック防止策`. This is implementation direction, not APPROVE_RELEASE for a new candidate.

## Scope

The CPU result route already passes the saved reward ticket level to `goToGacha`; the quiz result route omits it. Pass the completed, persisted quiz result's `reward.ticketLevel` from that missing entry only. Do not infer from selected quiz difficulty, previous gacha selection, displayed text, or CPU identity. If the saved level is missing or invalid, do not navigate using a guessed level.

## Acceptance

1. Previously selected Lv5 + saved Lv2 reward (even if quiz difficulty differs) opens Lv2, with matching odds and explicit draw payload/inventory consumption.
2. Re-render/profile synchronization preserves the chosen level. A subsequent manual change is not repeatedly overwritten by the old reward. Ordinary tab navigation is unchanged.
3. At target-level inventory zero, remain on that level and disable new draws; do not switch to another stocked level.
4. Navigation sends no gacha request and consumes no ticket. Only the user's explicit draw does so.
5. Preserve an unresolved draw's actionId/ticketLevel/count exactly. Reuse `goToGacha`'s existing pending-draw precedence: while resolving an old draw, keep its displayed level as well as its immutable retry payload. Do not create a new draw or replace the pending one through a reward link.
6. Keep the existing CPU reward route and result/retry continuation behavior.

Tests: new actual-browser cases for the missing quiz route and pending/zero/manual/synchronization boundaries, existing gacha retry/CPU reward cases, nonbrowser product contracts, exact-candidate Windows Chrome/Edge gate. Invalid result guards get a focused unit contract. Browser fixtures are not live server results.

Non-change: rewards, odds, transaction semantics, CPU behavior, engine, DB, Edge, general tab layout, new cards. Pages-only candidate; DB/Edge change sets `[]`. Public confirmation and physical acceptance remain separate from local tests. No production publication before the exact candidate review and gates.
