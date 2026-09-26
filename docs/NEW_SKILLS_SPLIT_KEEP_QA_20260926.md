# Split-keep candidate: local verification

Date: 2026-09-26 JST. Base: `9cea88bd9e2ac51bd07dbc9c977620548d1e849b`.
Branch: `codex/new-skills-20260926`.
Specification: [UDL011-split-keep-draft-v1](NEW_SKILLS_SPLIT_KEEP_20260926.md).

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

## Post-push Windows failure and bounded test repair

The first fixed candidate `d507aa336cf51e2ac13c8c2982cecc50b3bea8fb` was pushed to
`codex/new-skills-20260926`. Its own Windows run `36212680895`, attempt 1, finished with
2,380 PASS / 4 FAIL / 0 skipped: each browser passed 933 contracts and 212/214 online cases;
Chrome also passed 11 native PostgreSQL race cases, and Edge passed 79 lifecycle cases.
Both browsers failed the same two stale catalogue-count assertions (actual 22, expected 21),
not the new-card state transition cases. This failed run remains failed.

The specified catalogue is now 20 ordinary cards plus the two existing experimental cards.
The first test already checks every registry ID and opens every detail dialog; its count/name
are corrected to 22 and the new card is asserted exactly once. The optional-module-failure
test now checks all 22 IDs against the implemented public registry as well as the count.
No product, specification, migration, bundle, workflow, timeout or test selection is changed.

Before repair, a local Chrome two-case attempt produced one startup `page-ready` timeout and
one reproduced 22-versus-21 assertion failure (0/2 PASS). That startup failure is preserved
separately; it is not attributed to the catalogue assertion or erased by the later pass.
After repair, Chrome passed 5/5 targeted browser cases, 0 skipped, 81.479 s, covering the two
catalogue cases plus old/new split interaction and retained-stage/category cues.
Catalogue/harness contracts passed 11/11, 0 skipped, 0.607 s. A repaired remote gate and
genuine fixed-candidate review remain required before production.
Edge separately passed the two repaired catalogue cases, 2/2 PASS, 0 skipped, 27.533 s.
