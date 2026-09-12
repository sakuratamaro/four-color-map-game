# CPU palette efficiency — F1 bounded release specification

Version: `UDL-051-palette-v1.0`
Base: `d9ce111d7d97019d55b3e90842602001e045ea04`
Branch: `codex/cpu-palette-efficiency-20260913`
Owner: existing commander `01a07b56-616e-7733-9aae-90575659688e`

CANON_RECEIPT version=shared-canon-v1.1 base=d9ce111d7d97019d55b3e90842602001e045ea04 request=UDL-20260910-051,REG-CPU-F1-PALETTE-WASTE specs=docs/SHARED_CANON.md@codex/dev-brain-current-20260910,docs/CPU_PALETTE_EFFICIENCY_PLAN_20260913.md@codex/dev-brain-current-20260910,docs/CPU_SPLIT_RESCUE_20260913.md@d9ce111,docs/CPU_PALETTE_EFFICIENCY_20260913.md tests=standard-cpu-palette-efficiency,standard-cpu-palette-sql-runtime,standard-cpu-rollout,standard-cpu-split-rescue,standard-cpu-split-sql-runtime,standard-cpu-roster,standard-kurogane-lookahead

## Authority and boundaries

UDL051 adopts efficient, genuinely stronger CPU play, not deliberate elementary mistakes. Genuine Astra038 (ChatGPT 改修ロールバック防止策, thread6aa229e7-e098-83ee-ac5e-d366a12653a4, response93dc7316-940b-46d7-b1f7-9dbc4a19d987 to result6d2304e2-a209-468b-9ba1-bea3f2a65e58) directs F1 next: pair needless-change suppression with necessary-change rescue; retain useful changes, all saved policies and F3's two roles. That direction and prior036 F3 approval are not approval of this new candidate. The full genuine source is in the existing governance review ledger.

F1 cause in the authored ordinary COLOR fixture: Kurogane's fixed palette-skill priority/favorite terms score144.72 while legal basic paint scores87.4, even when the palette swap provides no defined benefit. This slice filters only objectively unhelpful palette-change candidates under the bounded criteria below. It does not alter cross-action score scales (F2), strengths/tiers, names/gender/epithets/portraits, charge counts, economy, skill effects, seals, game rules, RNG or private information. F3 d9ce remains published; its one live allowance is consumed and cannot be reused. Partial067 is not reclassified or retried.

## Versioned decision contract

Only exact `standard-character-palette-efficiency-v1:<characterId>` policies enable the filter. All21 saved earlier policies retain their original enumeration, scoring and RNG choices, including the ten split-rescue policies, ten pre-split policies and retired Kurogane v1. The roster's current default remains the split policy; the online factory's explicit `palette` generation selects F1. Quick/default CPU and alpha.1 dispatch stay unchanged.

The filter runs after authoritative skill/category/charge and legal-rescue enumeration, only in COLOR. It keeps every non-palette candidate unchanged. For each eligible palette slot/color it compares the current own palette with a copied hypothetical palette, using public adjacency/seals and only its own private state:

- Legal available colors for this pending region (including currently active prism/borrow colors).
- Legal unsealed basic colors for this region, which can conserve a finite bonus/borrowed color.
- Distinct unsealed basic colors.
- Distinct unsealed persistent colors (basic plus bonus only if bonus uses remain), excluding temporary prism/borrow colors.

Keep a palette change only if at least one legal color remains afterward and at least one of those four counts strictly increases. A useless same-diversity swap, zero-use bonus edit or sealed/dead change is removed. A needed color rescue, increased useful basic availability or repaired duplicate palette is retained, including useful diversity repair while prism is active. An already-used color category or empty charge is not bypassed. This is a small deterministic heuristic, not a future-board search or proof that every strategically useful same-count exchange is recognized. Lower change counts alone are not the success criterion.

## Compatibility and exact production change set

Scope: Pages + Edge + additive SQL + one new managed activation setting. Not Pages-only/DB[].

DB: `supabase/migrations/202609130002_standard_cpu_palette_efficiency.sql` only. It adds ten exact versions to the private supported/current helpers and the existing start-receipt policy overlap. The matrix becomes31 supported/30 current; retired Kurogane v1 remains supported but cannot create a new room. Null, invented and cross-character versions remain false. Existing rooms/profiles/receipts are not rewritten. Accept/rematch function bodies, all other fingerprint fields, rate/locking order and ACLs are unchanged.

Edge: `supabase/functions/standard-game-action/index.ts` and generated `standard-engine.bundle.js` only. New exact environment value `FCG_CPU_PALETTE_EFFICIENCY=standard-character-palette-efficiency-v1` selects `palette`. Absent/empty/invalid values fall through to the existing split activation, selecting `current` when `FCG_CPU_SPLIT_RESCUE=standard-character-split-rescue-v1`, otherwise `legacy`. Client input cannot activate it. New immediate starts, accepted fallback and finished-room rematches use the same server-selected generation. Every existing turn dispatches its saved exact policy, independently of current activation.

Write-free unauthenticated OPTIONS retains200/ok, old split capability header, and adds `X-FCG-CPU-Palette-Capability: standard-character-palette-efficiency-v1`; generation becomes `legacy|current|palette`. Authenticated roster exposes both capabilities and the actual selected versions. POST authentication/RPC/private-state boundaries are unchanged.

Local bundle is regenerated only because it includes the shared CPU module. Local play still does not select this new character policy. Its exact marker is `app.bundle.js?v=20260913-10-0bf2ff58555d`, SHA256 `0bf2ff58555d2a33fd4576ea784c3eba1c256ebcabdea0e9e99718da1596f094`. Generated files are never hand edited. Candidate SHA, spec blob, complete changed paths/bytes, Windows run and genuine decision are bound in the existing governance record after this file is frozen.

## Staged release and supported rollback

1. Require a new genuine exact-candidate/spec/DB/Edge/setting approval and same-candidate successful Windows Chrome/Edge gates. Verify fresh main remains the stated base (otherwise reconcile), current public/Edge bytes match preserved d9ce proof, SQL tail matches F3, old split setting is exact and new palette setting is absent/off. Preserve rollback evidence. No author-permission hold or new user push-permission loop is introduced.
2. Apply only SQL002 once, transactionally. Require all five rows of read-only `supabase/verification/standard_cpu_palette_efficiency_verify.sql` true. It checks exact normalized bodies/ACLs, the policy matrix and support for active CPU rooms without exporting IDs.
3. Deploy the exact compatible Edge pair with new palette activation off and old split activation unchanged. Establish successful completion/time and read back both full artifacts for strict equality. Require the new static capability plus generation=current by a finite write-free OPTIONS probe. A single probe does not prove all workers or source equality.
4. Wait at least460 seconds from confirmed compatible deployment completion before palette activation, using the existing F3 staging rationale: documented maximum worker wall-clock duration400 seconds plus60 seconds margin. Recheck the applicable documented limit before execution. This is not a guarantee of global propagation. Missing completion/artifact/bound evidence keeps the new flag off.
5. Set only the new exact palette value; retain the same compatible source and additive SQL and leave the old split flag unchanged. Require OPTIONS generation=palette. If setting uptake requires deployment, redeploy only the exact approved artifact and record the new completion/source evidence; do not rebuild or invent a deployment ID.
6. Force-free publish the same approved candidate to main/Pages; require final same-SHA Pages success, existing protected-RPC preflight and exact changed served bytes. Run only the newly approved finite live smoke below. Preserve its actual failures/NOT_RUN outcomes.

Disabling the new palette flag rolls future selection back to split while retaining the F1-compatible Edge and additive SQL. All new-policy saved games must still execute their saved F1 version. Do not restore d9ce's F1-incompatible Edge after any F1 room exists, delete rows, retire policies or reuse another approval. A bug in the compatible artifact needs a separately reviewed compatible correction.

Sources for the already-used staging rationale: [Supabase limits](https://supabase.com/docs/guides/functions/limits) and [managed secrets](https://supabase.com/docs/guides/functions/secrets). Actual deployment remains NOT_RUN for this candidate.

## Executable acceptance and evidence limits

`tests/standard-cpu-palette-efficiency.test.cjs`: ten tests, authored valid fixtures. All10 characters, exchanged seats and fixed seeds pair ordinary legal painting/no wasted charge with necessary palette rescue followed by real accepted paint. Useful diversity/prism/bonus conservation, exhausted/category/sealed dead cases, F3 both orientations through split/color/opponent return, immutable/private-blind choice, alpha.1/exact-ID guards and unchanged WORK/F2 choices are checked. Golden traces from clean frozen d9ce record84 authored observations for each of all21 saved policies; these are not84 unique historical positions or stock-hand/win-rate evidence.

`tests/standard-cpu-rollout.test.cjs`: nine full TypeScript-handler tests with the actual generated bundle, fixture gateway/env/auth/RPC. All three creation paths and all10 profile/loadout identities, absent/typo/client-spoofed activation, saved policies and replay are covered. This is not native Supabase gateway/env propagation proof.

`tests/standard-cpu-palette-sql-runtime.test.cjs`: nine actual in-memory PostgreSQL tests. It executes the complete baseline throughF3 then exactSQL002. Twenty real old/split fixture receipts and ten new F1 starts cross activation in both directions without duplicate or rewritten game records. All31 policy identities, real source/ACL verification, changed-field rejection, rate gate, fallback and finished-room rematch replay are covered. The original F3 nine-test suite stays isolated at its original migration boundary.

PGlite0.5.8 uses the existing pinned dev-only dependency. Supabase auth/pgcrypto registration wrappers remain explicit fixtures; all application DDL/functions/RLS/receipts execute as actual SQL. Native Supabase/auth/pgcrypto and simultaneous competing clients are NOT_RUN. Candidate SQL is not applied to production by tests.

Observed implementation checkpoint: combined F1+handler19/19PASS8388.7693ms; old+new SQL18/18PASS14045.3746ms; generated/Edge/cache/workflow five files91/91PASS1002.4379ms, allskip0. Earlier F1 fixture failures were corrected (real first-seat/category-window invariant, COLOR returns to ownWORK) without relaxing game validation; baseline traces were generated from frozen d9ce, not candidate output. Full clean product and fixed Windows results are recorded later externally, not predicted here.

## Proposed separate bounded live acceptance

Requires genuine acceptance for this exact F1 candidate; no previous test allowance transfers. Propose one new anonymous profile, one immediate Rei room,240 seconds, one attempt, at most8 CPU send attempts and one SURRENDER send. Require exact saved new policy/own membership, an observed accepted CPU action if available, and terminal snapshot-v2 plus own-profile settlement readback. Never initialize a finished room. If the CPU does not act before the permitted terminal path, label it NOT_OBSERVED; do not add a second room or retry allowance.

Use a locally verified one-shot harness with a durable reservation before the first production mutation; output no tokens/user/room/action IDs. Record independent operation/network/terminal/profile outcomes even on failure. No rematch, gacha, purchase, privileged recovery, direct game-row changes or cleanup. This ordinary smoke is not a forced F1/F3 position, all-ten stock-hand test, live cross-worker race, measured strength increase, browser UI/console or physical acceptance.
