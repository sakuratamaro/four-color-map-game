# CPU ordered split rescue — isolated implementation boundary
Version: UDL-051-split-v1 (implementation preparation; not release approved)

CANON_RECEIPT version=shared-canon-v1.1 base=2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152 request=UDL-20260910-051,REG-CPU-F3-SPLIT-ORIENTATION specs=docs/CPU_SUCCESSOR_PREPARATION_20260912.md@codex/dev-brain-current-20260910,docs/CPU_TIERS_INTAKE_20260911.md@codex/dev-brain-current-20260910 tests=tests/standard-cpu-roster.test.cjs,tests/standard-kurogane-lookahead.test.cjs,tests/standard-cpu.test.cjs
Owner: existing commander01a07b56-616e-7733-9aae-90575659688e.
Worktree: .codex-worktrees/cpu-split-rescue-20260913
Branch: codex/cpu-split-rescue-20260913
Fresh GitHub main2fc verified2026-09-12T18:34:55Z. The three CPU/roster/match Git blobs remain identical to the saved authoritative F1/F2/F3 baseline; do not rerun unchanged diagnosis or create a live profile merely to reconfirm it.

## Adopted source and small scope

UDL051 adopts genuine available rescue before surrender for all10 CPUs, without intentionally adding basic blunders to weaken Ren. The paired v6/v7 sources and actual engine baseline are preserved in the existing canon; v13 preserved those43 prior records. Source/regression evidence: docs/CPU_SUCCESSOR_DIAGNOSIS_20260912.json and scripts/cpu-successor-diagnosis.cjs on the governance branch. This is an authored valid position, not a user's historical match replay.

F3 cause: splitSelections discards every mask without bit0. A selected half that we must color and the half returned to the opponent are different game roles, so complementary masks cannot be deduplicated. The deterministic fixture finds Rei surrendering when only the omitted right half can be legally colored; its mirror finds the retained left half. The real engine accepts split → safe color → return to opponent.

Repair only ordered split enumeration and versioned character-policy dispatch. Keep connected macro/micro validation, bounded board size and existing rescue eligibility/category/hand checks. Do not claim all CPU strength issues fixed: F1 palette waste and F2 cross-action score imbalance remain separate. No roster epithets, gender ranks, artwork, charge amounts, area-size rules, seal bypass, opponent-private access, game RNG or reward changes in this slice.

## Compatibility and database boundary

Existing games store cpu_policy_version. Preserve exact old enumeration/score/random behavior for all old10 character versions and Kurogane legacy/v2; do not globally change the default enumeration used by legacy/Quick paths. New/rematched character games may use a new explicitly supported policy version. Old alpha.1 engine dispatch remains unchanged.

Current migration202609050005 implements private helpers fcg_standard_cpu_policy_is_supported and fcg_standard_cpu_policy_is_current with exact version strings. New versioning therefore requires a reviewed additive SQL change in addition to the generated Edge engine bundle. Do not label this as Pages_only/DB[] or use067's review for it. Do not update stored active-room versions or change private helper permissions. Inspect start/accept/rematch idempotency and supported/current ordering before choosing the staged compatibility deployment sequence.

The exact migration filename/change set, generated bundle changes, candidate SHA and release sequence must be frozen for Astra review after implementation. No production DB/Edge action has occurred in this preparation.

## Required executable acceptance

- Both split orientations with both player seats and fixed seeds; a chosen rescue must be accepted by the authoritative engine, can be colored, and returns the other half to the opponent.
- All10 new policies avoid surrender when the specific split rescue is available; no opponent-private poison affects choice.
- No card, remaining0, used color category, disconnected halves, already-controlled pending region and genuinely impossible split remain rejected; no unconditional rescue claim.
- Old policy fixed traces and old F3 result remain unchanged under explicit legacy dispatch; current policy switches only on new/rematched game creation.
- Reject unknown/cross-character policy versions and retain Kurogane legacy/v2 scoring distinctions.
- Finite candidate count/runtime on maximum supported region; no exponential unbounded new board domain.
- SQL supports old stored games and exact approved new versions, remains private; in-flight/replayed old starts and rematches are not broken during rollout.
- Existing CPU/engine/server/contract tests plus generated-bundle equality and same-candidate Windows gates. Public and physical acceptance are NOT_RUN until separately authorized and executed.

This preparation is independent of067 f507 pending review. Before fixing a public CPU candidate, rebase/integrate only the confirmed new main and reconcile any overlapping generated sources without force or dirty-root resets.

## Local implementation checkpoint 2026-09-12T18:54Z

Ordered enumeration is opt-in only for exact standard-character-split-rescue-v1:<id> policies. All eleven old character policies (including both Kurogane revisions) and Quick/default/alpha.1 dispatch remain available. New policy guards reject an existing reservation and a malformed pending source region outside2..5 macros; no exponential board-size expansion. Kurogane retains its lookahead-v2 score and seal timing.

Focused CPU/roster/old-trace/generated-server tests46/46 PASS2967.5068ms, skip0. The four authored seat/orientation cases each exercise10 policies and3 seeds through authoritative split, legal color and return to the opponent. Other tests cover private poison, unavailable cards, category use, disconnected geometry, maximum5-source complements and exact old/new dispatch. These are offline authored cases, not historical replays, all-ten-stock-deck claims, win-rate benchmarks or live acceptance. An initial23/24 run failed because the authored reservation referenced a missing region; the fixture was made a real reserved region and the separate next24/24 passed. No product assertion was relaxed.

Draft migration supabase/migrations/202609130001_standard_cpu_split_rescue.sql preserves private permissions and existing room rows. It adds exact new policies to the supported/current overlap set and changes only start receipt policy-version fingerprint compatibility, retaining all other hashed fields and existing rate/lock/replay-before-current ordering. Four SQL-source/fingerprint-model tests PASS231.8585ms; these are not PostgreSQL execution. Local psql/docker/PGlite were not available in the initial read-only check.

Still required before candidate freeze: executable PostgreSQL or equivalent isolated migration validation where feasible; a compatibility-first staged Edge activation plan with separately fixed artifacts so old workers cannot see an unsupported newly-created policy; final current-main integration, full clean tests and Windows gates. The current profile factory uses the new policy locally only. No DB/Edge/main/Pages deployment, new live account or fixed release review has occurred for this slice. This is a useful implementation checkpoint, not a release-ready claim.
