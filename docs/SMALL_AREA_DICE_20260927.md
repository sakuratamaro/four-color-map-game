# Small-area die balance v1

Request: UDL-20260927-071. This changes ordinary required-area size only. New matches use `[1,1,2,2,2,2,3,3,4]`, with each of the nine entries equally likely.

| Macrocell count | Prior probability | New probability |
| --- | --- | --- |
| 1 | 2/6 | 2/9 |
| 2 | 2/6 | 4/9 |
| 3 | 1/6 | 2/9 |
| 4 | 1/6 | 1/9 |

The total probability of one or two cells remains 2/3. Mean size changes from 13/6 to 20/9. This reduces one-cell cases while preserving the small-area focus for corner expansion and shifts. It is not a claim that every region can be split: existing geometry and skill legality still apply.

## Compatibility and non-changes

- New match state records `diePoolVersion: "small-v2"`; both the first and subsequent rolls use that pool.
- Existing state without the field retains the old six-entry pool. An explicit `small-v1` is accepted for deterministic fixtures and compatibility. Stored rolls, pending regions, saved actions, and RNG cursors are not rewritten.
- Explicit legacy creation preserves the original field-free state shape, so historical replay hashes remain unchanged. Historical golden fixtures select the legacy pool explicitly; their expected hashes are not replaced.
- Reload and subsequent successful colors retain the stored pool version. Unknown versions are rejected before effects or RNG use. The public projection includes the version when present; no private state is added.
- Each normal roll consumes one draw from the existing `die` stream. Bonus-color uses retain `[1,1,2,2,3,4]` and their separate RNG stream.
- Cell count limits, late-board size fallback, corner expansion, half/triple shifts, category limits, and split return turns remain unchanged. A split return is not an extra die roll.
- Rewards, gacha odds, card acquisition, CPU strength, stored results, DB schema and migrations are outside this slice.
- Source and generated local, Edge and workshop bundles must match before release. Existing online matches need the updated Edge implementation, not a UI-only numeric change.

## Acceptance

`tests/standard-die-pool.test.cjs` covers all nine first-roll buckets, old/new subsequent rolls after serialized reload, unchanged bonus draws, invalid-version rejection, public projection, and the exact probabilities. Existing match, transaction, save, geometry/shift, CPU, and generated-bundle tests remain required. Publication is a separate release operation after candidate-specific validation and review.

## Candidate validation

- Final selected contract suite: 30 files, 329 PASS, zero failures/skips/cancellations. This includes exact old replay hashes, CPU self-play, isolated SQL/CPU fixtures, local cache integrity, and unchanged reward/gacha contracts.
- Real local browser workshop suite: Chrome 5/5 and Edge 5/5 PASS. These are local fixtures, not production acceptance or physical-device testing.
- The initial full pass attempt had eight historical replay mismatches and one missing local PGlite dependency. Legacy fixture selection/state shape and dependency resolution were corrected; expected historical hashes were not replaced. A later obsolete cache-hash expectation was updated to the rebuilt local bundle and reverified.
- `.github/workflows/small-area-balance-windows.yml` runs the 329 selected contracts and five browser cases on each Windows Chrome/Edge job, plus generated-bundle checks. Candidate-specific remote results and Astra's decision are still required; this document does not claim publication.
- The local bundle URL uses `20260927-1-beda137a9f6e`; the workshop engine URL uses `20260927-small-v2`. The Edge bundle must be deployed for ordinary online matches. No production DB migration is required.
