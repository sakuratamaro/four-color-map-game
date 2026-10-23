# Color permutation candidate — local QA

Spec: UDL011-color-permutation-v1. Base: d68b22bbbafeca896400bedcda1605ce646a5d0e.

## Implemented and checked locally

- Ordinary cards disruptColorSwap and disruptColorRotate; normal catalogue 26, two experiments separate, frozen v4.9 catalogue 19.
- Simultaneous public-geometry legality, selection order, no partial mutation or rejected-card consumption. Exhaustive 384 chain/neighbour configurations are one core test, not 384 reported test cases.
- Saved once-per-actor rotation history, old field-free saves, unsupported older versions, no extra RNG, unchanged geometry and WORK handoff. All control/category/required-size boundaries stay authoritative.
- Real generated worker plus isolated SQL: ordinary inventory/start, refusal atomicity, one consumption, exact action replay, changed-payload rejection, saved public colours/history and CPU continuation.
- Normal persisted gacha acquisition of both cards with exact replay. Rarity-level probabilities and rewards are unchanged; individual probabilities within the expanded same-rarity pool do change.
- Online and local native controls: ordered selection, deselection, cancel, no selection-time network probe, explicit commit, handover, one inventory consumption and no reload resend. Fresh profile-free catalogue exposes all 28 visible entries.

Final local contract run: **994/994 PASS**, fail/skip/cancel 0, 105 selected files, 2026-09-28T03:02:25.197Z–03:06:03.133Z.

Focused native run: **Chrome 5/5 PASS**, 03:02:39.835Z–03:03:19.152Z; **Edge 5/5 PASS**, 03:03:19.375Z–03:04:01.601Z; no failures, skips or cancellations. These are installed local browser tests with test-owned auth/transport/storage, not production play or physical-device acceptance.

Generated workshop bundle and frozen Ren trial-template freshness checks passed. The local bundle is SHA256 19df084a8f0e08c9d43d1dd25d8360068480956139a3a04f1d1ded1195a7d9a3; current page/cache and preflight markers use the permutation generation.

## Earlier failures retained

The first broad run reported 969 PASS / 11 FAIL out of 980: six stale catalogue counts and five render-fixture failures from its missing actual skill-intent dependency. Counts now follow the expanded registry, while exact IDs, frozen v4.9 and experiment separation remain asserted; the fixture now loads the real intent module.

A subsequently added UI guard assertion initially compared an undefined lightweight-fixture property to false. It now applies the native button IDL Boolean conversion, and separately asserts every disabling condition. Focused correction passed 22/22 before the final broad/native runs. These failures were not discarded or relabelled as production regressions.

## Not yet accepted or run

Full candidate-specific Windows Actions, genuine Astra candidate/specification review, main/Pages/Edge publication, live inventory/gacha/gameplay and physical devices are **NOT_RUN**. Local contract selection excludes full browser files, CPU browser and CPU self-play; focused native results do not replace their complete Windows suites.

Normal-card handoff differs from the standalone workshop and requires explicit design review. Existing blanking/whiteout holds, previous releases and their closed verification budgets remain untouched. No DB schema, managed setting, reward, rarity-odds or image changes are included.
