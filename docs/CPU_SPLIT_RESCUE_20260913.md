# CPU ordered split rescue — isolated implementation boundary
Version: UDL-051-split-v1.1 (candidate specification; not release approved)

## Current continuation receipt

CANON_RECEIPT version=shared-canon-v1.1 base=f507c0b2dd9701f3ac1867131150b5e48d0ada8d request=UDL-20260910-051,REG-CPU-F3-SPLIT-ORIENTATION specs=docs/SHARED_CANON.md@codex/dev-brain-current-20260910,docs/CPU_SUCCESSOR_PREPARATION_20260912.md@codex/dev-brain-current-20260910,docs/CPU_TIERS_INTAKE_20260911.md@codex/dev-brain-current-20260910,docs/CPU_SPLIT_RESCUE_20260913.md tests=tests/standard-cpu-split-rescue.test.cjs,tests/standard-cpu-split-policy-migration.test.cjs,tests/standard-edge-handler.test.cjs,tests/standard-live-release-preflight-static.test.cjs,tests/standard-local-ui-static.test.cjs

Normal goal continuation01a09721-e553-7bf0-a6a7-64afdd99f7bc started2026-09-12T19:39:36Z. Fresh GitHub main remainsf507; clean local22b includes it. Prior turn was PROGRESS (F3 implementation/real034/public067/raw failed live record), not unchanged waiting. CPU clean143 non-Playwright files later952/954,2 cache-contract failures are retained in governance docs/CPU_SPLIT_FULL_TEST_20260913.md. This turn resolves generation activation and final cache markers, adds isolated SQL runtime validation, and prepares the exact CPU review candidate. No new067review read or live allowance. The earlier preparation snapshots below remain historical.

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

## Fixed candidate specification UDL-051-split-v1.1

This section supersedes only the preparation requirements above, not their historical results. Release scope is Pages + Edge source/bundle + the single SQL migration + one explicitly reviewed managed setting. Candidate commit, spec blob, all changed file hashes and test receipts are bound externally in the existing governance review ledger after this file is frozen. It is not approved by this document.

### Managed compatibility-first activation

The exact setting is `FCG_CPU_SPLIT_RESCUE=standard-character-split-rescue-v1`. Absent, empty, typo or any other value selects legacy. It is read only from the managed Edge environment, never from a client request. The same fixed compatible Edge artifact supports all old saved policies and the new ones regardless of activation. Its server-selected profile factory options apply only to start, accepted fallback and finished-room rematch. Every turn still dispatches the saved room policy. Current new/rematched selection does not upgrade a playing room.

Unauthenticated OPTIONS remains a write-free 200/ok response and adds only static capability/generation headers: `X-FCG-CPU-Policy-Capability: standard-character-split-rescue-v1` and `X-FCG-CPU-Policy-Generation: legacy|current`. It creates no profile and invokes no SQL. Authenticated cpu-roster reports the same generation and exact per-character policy versions. No JWT enforcement for POST or private-data boundary is relaxed.

The release operator must obtain genuine Astra approval for the exact candidate/spec/DB/Edge/setting tuple and same-candidate Windows success, then:

1. Read fresh main/Pages, current Edge source and migration tail, preserve the deployment rollback record, and check the managed setting is absent/off. If another candidate or an unexpected active value is present, reconcile before writes.
2. Apply only `supabase/migrations/202609130001_standard_cpu_split_rescue.sql`. Run read-only `supabase/verification/standard_cpu_split_rescue_verify.sql`; require all five rows true. It checks normalized exact function bodies, private/service ACLs, old/new/invalid policy semantics and support for active CPU rooms without exposing IDs. No existing rows are rewritten or cleaned.
3. Deploy the exact compatible index.ts and generated engine bundle with activation still off. Record successful deployment completion, read back those artifacts, and require OPTIONS capability with generation=legacy. Do not create a new-policy room while old incompatible workers may exist.
4. Wait at least 460 seconds after confirmed compatible deployment completion before activation. Supabase documents a maximum worker wall-clock duration of 400 seconds on paid plans (150 free). The extra 60 seconds is a conservative rollout margin, not a new platform guarantee. This staging argument combines confirmed deployment with that documented bound; one region's OPTIONS probe is not proof of all regional workers or native concurrency. If completion/artifact verification or the applicable worker bound cannot be established, keep activation off and report the deployment gate instead of guessing.
5. Set only the exact managed value above, retain the same compatible source/bundle, and require OPTIONS generation=current. If the platform requires redeployment for setting uptake, redeploy the same approved artifact and record the new deployment ID; do not rebuild or silently change its SHA.
6. Publish the same approved candidate to main/Pages without force; verify the final Pages run, existing protected-RPC preflight and exact changed asset bytes. Local bundle marker is `20260913-9-4f66b9b284ba`, SHA256 `4f66b9b284ba6df6a03cfc1458ad49847d9f30f7d916ded929ee5986f6f3e9cd`. Run only the separately bounded live acceptance Astra accepts; preserve partial/failed outcomes, no automatic extra profile/room/retry quota.

Rollback after any new-policy room exists means disable activation for future starts/rematches while keeping this compatible Edge and additive SQL. Do not restore the original unsupported Edge, remove the new policy helpers, rewrite saved rooms, delete user matches or silently revert the capability code. Existing new-policy games must continue under their saved version. A defect in the compatible artifact itself requires a separately reviewed supported fix, not an incompatible downgrade.

Source for the worker limit: [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits), read 2026-09-12. The limit is worker wall-clock lifetime, not a promise that every request lasts 400 seconds.

### Executable evidence and boundaries

The complete TypeScript Edge handler is executed under a fixture gateway, with the actual generated engine. Six tests cover absent/invalid/client-spoofed activation, write-free OPTIONS, all three creation paths under both generations, all ten unchanged identities/profiles/loadouts, and saved legacy/current dispatch with receipt replay. Gateway verification and platform Deno environment delivery are fixtures, not a live Supabase cryptographic test.

Dev-only `@electric-sql/pglite@0.5.8` (PostgreSQL 18.3/WASM) is pinned with its integrity in `tests/sql-runtime/pnpm-lock.yaml`. Local setup is `pnpm --dir tests/sql-runtime install --ignore-scripts`; the existing Windows gate installs the same exact version with scripts and npm lock generation disabled. It is not included in any game bundle. [PGlite documentation](https://pglite.dev/docs/) describes its in-memory PostgreSQL interface.

The isolated harness executes every existing baseline migration and the exact candidate SQL. Only unavailable platform pgcrypto registration is replaced; its SHA256 wrapper uses actual PostgreSQL SHA256 over actual jsonb::text, with fixture UUID/random-byte and auth scaffolding. All application DDL/functions/RLS/triggers/receipts remain actual SQL. Nine runtime tests prove row preservation, exact verification SQL, per-identity old/new/null rejection, old-to-new and reverse starts for all ten CPUs, changed-field rejection, actual rate/ACL behavior, fallback replay and finished-room rematch replay. A single in-memory database is not native Supabase/Postgres deployment, pgcrypto/auth service validation, or competing concurrent-client proof; those remain NOT_RUN.

A real initial runtime failure found SQL NULL returning unknown rather than false, allowing a NOT-supported guard to be bypassed on a replay. Both private helpers now explicitly coalesce to false, with NULL regression assertions. The initial 6/8 run is retained as a failed diagnostic; the later 9/9 pass does not erase it. The initial handler fixture lacked TextDecoder and failed authentication before product dispatch; after correcting that fixture the real handler passes without relaxing product assertions.

The previous clean 22b full run's two failures were exact cache-contract expectations. Production generator output is now paired with its actual marker/hash, and exact static assertions are retained. The compatibility factory signature and dedicated workflow branch/pinned SQL dependency required corresponding exact test expectations; the follow-up focused 32/32 passes with no skip. Full clean and same-candidate Windows receipts follow in the governance ledger, not speculative PASS entries here.

Live F3 recreation, live old/new cross-worker race, actual smartphone/physical acceptance, win-rate changes, portraits/gender/epithets, F1 palette efficiency and F2 action scoring are NOT_RUN or separately unimplemented. No live historical F3 match or all-ten stock-deck rescue coverage is claimed.

### Proposed bounded public smoke (requires exact Astra acceptance)

After deployment/activation/Pages verification, propose one new anonymous test profile and one immediate Rei room, maximum 240 seconds and at most eight accepted CPU actions, one explicit test-player surrender and its snapshot-v2/profile readback. No rematch, second profile/room, gacha, purchased content, direct administrative room mutation or bulk cleanup. Never call initialize for a finished room; use the existing authorized snapshot path. Record the raw first failure and any unfinished test-room state; don't rerun the old 067 harness or borrow its exhausted budget. This smoke would confirm ordinary new-policy dispatch/settlement, not force an F3 position or prove legacy worker races. The exact execution harness and approval binding must be saved before execution; if Astra requests a different scope or more proof, continue that preparation without spending a live allowance first.
