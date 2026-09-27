# Split-keep candidate: local verification

## Historical pre-commit checkpoint (not current integration results)

Date: 2026-09-26 JST. Base: `9cea88bd9e2ac51bd07dbc9c977620548d1e849b`.
Branch: `codex/new-skills-20260926`.
Historical specification: `UDL011-split-keep-draft-v1`; current revision is linked below.

This records the pre-commit local verification checkpoint, not a released card or a completed remote
Windows gate. At that checkpoint, the first design consultation had been delivered but no designated
reviewer response was recorded. Subsequent commit, CI, review and publication require separate evidence.

## Observed final checks

| Check | Result | Boundary |
|---|---|---|
| Current workflow contract selection | 921/921 PASS, 0 skipped, 73.519 s | All contract-step files except CPU browser, CPU self-play and Half Shift candidate parity |
| New-card engine cases | 9 PASS, included in 921 | Both paints, effects, save/replay, catalogue/economy, malformed states |
| New-card actual worker and isolated SQL | 3 PASS, included in 921 | PostgreSQL/WASM, not native multi-session or production |
| Chrome targeted browser | 3/3 PASS, 0 skipped, 22.403 s | Old/new split pointer/cancel/retry and retained-stage cues |
| Edge targeted browser | 3/3 PASS, 0 skipped, 17.895 s | Same cases as Chrome; mocked transport |
| Generated skill registry check | PASS | Generated current catalogue equals source |
| Fixed Ren trial template check | PASS, unchanged | New migration does not alter trial template |
| git diff --check | PASS | Local diff whitespace |
| Pre-commit new-card core/SQL recheck | 12/12 PASS, 0 skipped, 31.548 s | Re-run after removing the SQL trailing blank line; overlaps the 921-case total |

The excluded CPU self-play and Half Shift candidate parity cases passed earlier in this turn;
they were not re-run for the final 921-case total. Do not add them to that total or claim a complete
remote Windows run. An earlier broad run failed old catalogue/cache expectations; those failures
were retained in the work report and the corresponding expectations were corrected explicitly.

The focused browser command was:

```text
node --test --test-concurrency=1 --test-name-pattern="colorRegionSplitKeep|UDL011 browser|colorRegionSplit " tests/standard-online-browser.test.cjs
```

Run once with STANDARD_BROWSER=chrome and once with STANDARD_BROWSER=edge. The existing Windows
workflow now includes this branch and the new engine/SQL test files; it has not been dispatched.

## Frozen product byte checkpoints

SHA-256, before commit:

- Specification: `a2e5b4acc3d0fcb9eef187a1e30e3cdb54459e2d0b8c0ca7d71cbfe5ba465587`.
- Migration: `6d2724e3b791797142bd72522bcd5175c94bfa984fe1d8e4116407f9d1b76007` (trailing blank line removed before commit; SQL statements unchanged).
- Edge engine bundle: `b2fd561c8cb5debc689f5093fc77dc092d09854b016dd9608834eac6e40305f7`.
- Local app bundle: `f22dfeedbbc468471cd8bc6ed1fdf67e55662a200ff3407e004de3a78db26a29`.

Any subsequent byte change invalidates the corresponding checkpoint. A future release review must
bind the committed candidate SHA, specification blob and exact DB/Edge sets; these hashes are not
a substitute for approval.

## Remaining gates

At the checkpoint, commit and public source push, own remote Windows run, genuine exact-candidate
Astra review, production migration/Edge/Pages, deployed byte readback and bounded canary were NOT_RUN.
Native multi-session SQL and physical-device acceptance remain NOT_RUN.
No images, rewards, existing match rows, CPU decks, secrets or managed settings were changed.

## Preserved Windows history and current integration

The original d507 run36212680895 failed four stale21-versus22 catalogue assertions
(2380PASS/4FAIL/0skipped). The0cc test-only repair checks all22 IDs and the new card
exactly once. Its targeted Chrome5/5, Edge2/2 and catalogue/harness11/11 passed;
the earlier local startup timeout remains a distinct failure.

The repaired0cc run36214575708 still failed one Edge combined finished-close /
CPU-ready /980px-actions test (online213/214), while Chrome passed its full gate.
A later unchanged isolated pass is not proof of the original failure's cause.
Do not replace either historical run with this integration's future results.

2026-09-28: Integrate those same product and catalogue fixes onto publicf897,
preserving the11-skill workshop and new-match small-v2 dice. Both diePoolVersion
and retainedSplit must survive the public projection; legacy fieldless dice
remain fieldless. Rebuild all three shared-source bundles and publish distinct
cache keys. This working tree has no own Windows gate, genuine review or release
yet. No old review or production allowance is inherited.

Integration found an additional reproducible compatibility defect: the fixed Ren trial v1
generator inherited the new ordinary-match default and added diePoolVersion to its state and
public projection. Those were the only differences from the published SQL template. Explicitly
selecting small-v1 for this fixed trial restores the existing exact generated template; normal
matches still use small-v2. This is not a production-template rewrite or a claim of live failure.

## Current integration checkpoint: 2026-09-28 JST

Base: `f897b4d93ca410cfebf1e26c5670cbdd3ddae148`.
Branch: `codex/split-keep-current-20260928`.
Specification: [UDL011-split-keep-v1.1](NEW_SKILLS_SPLIT_KEEP_20260926.md).

| Check | Result | Boundary |
|---|---|---|
| Final local workflow contract selection | 952/952 PASS, 0 failed/skipped/cancelled, 113.292 s | 101 files; excludes CPU browser, CPU self-play and Half Shift candidate parity, which remain in the Windows gate |
| Chrome focused online controls | 6/6 PASS, 60.063 s | Old/new split, retained-stage cues, prior combined close/CPU-ready/980px case and catalogue checks; fixture transport |
| Edge focused online controls | 6/6 PASS, 86.582 s | Same selection; this does not diagnose or overwrite the historical Edge CI failure |
| Published workshop browser preservation | Chrome 5/5 and Edge 5/5 PASS, 32.861/24.966 s | All 11 trials, real controls, reload, atomic rejection and isolated storage |
| Existing fixed Ren SQL template | Exact generated-template check PASS | No byte changes to its existing migration |
| Generated workshop and git whitespace | PASS | Fresh shared-source bundle and clean diff check |

The focused online browser runs preceded the later fixed-trial repair and failure-diagnostic placement
adjustment; they are not full final-candidate Windows runs. The final 952 includes the trial regression,
bounded failure-only overlay diagnostics and command-scoped Git-path portability assertions. No timeout
was increased, no original CI test was removed, and no failure was changed into a skip.

Intermediate local failures remain recorded separately: an incorrect public-projection assertion,
the reproduced fixed-trial default leak, updated workflow expectations, an immutable test RNG fixture,
Windows Git safe.directory slash handling, and two diagnostic assertion/placement mismatches. The final
run above passed after those explicit corrections. Failed d507/0cc CI runs remain failed history.

The candidate needs its own complete Windows gate, genuine exact-candidate Astra decision and bounded
production verification. Source publication is not game publication. Production DB/Edge/Pages and
physical-device checks for this integration remain NOT_RUN. No reward table or rarity odds were changed.
