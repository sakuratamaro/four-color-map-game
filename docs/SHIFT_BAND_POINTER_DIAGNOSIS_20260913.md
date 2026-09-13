# Shift-band pointer stability diagnosis

CANON_RECEIPT version=shared-canon-v1.1 governance=888e8ae7e62ed002a7eaae21d4a52776af1dc5a8 candidate=84587830730c1f62cf8c502daac4d768886a3f4d base=70e691b6f8f1d808476e80990d20df7862bfb782 public_base=954e1c5c52d5453fc9fee9872b2d7e922f850a39 request=UDL-20260906-014,UDL-20260910-054,REG-20260913-SHIFT-BAND-POINTER specs=docs/SHARED_CANON.md,docs/UI_PLAY_SURFACE_20260912.md,docs/UI_PUBLIC_MATCH_ACTIONS_20260913.md tests=tests/standard-online-browser.test.cjs#actual-browser-selects-Half-Shift-and-Triple-Shift-bands-at-390px worktree=.codex-worktrees/ui-public-match-actions-20260913

The existing commander starts a bounded local diagnosis at2026-09-13T06:09:30Z. Previous goal turn made progress: real845 implementation/push, exact genuine review delivery, finalWindows failure evidence and finite scheduling. This is normal work, not an observed scheduled RECEIVE. No additional review read before the original06:26:14Z slot.

Observed failure is Chrome job103679089219/run34740424933 attempt1, online150/151 with row4 target locator timeout. Edge151/151 passed. The existing test measures board dimensions before native click; product fitPlaySurface is deferred in requestAnimationFrame and target selection changes layout. Timing-related stale geometry is a hypothesis, not a proved cause or permission to ignore CI.

First experiment adds a fixture-only Playwright observer without modifying frozen845. It records bounded pointer events, board geometry, scroll and target text at capture and following frames. No forced/synthetic input, timeout increase or weakened expected row/payload. Existing owned-browser cleanup remains in control. No main/Pages/DB/Edge/CPU settings, user data, profile or match changes. CPU9590/039 and parent70e source hold are unchanged.

## Observed result

Three ordinary Chrome attempts each passed1/1, skip0 (7725.6433ms,5958.5788ms,5756.4612ms). Measured geometry changed304->328 as target controls appeared. No untouched local failure was reproduced, and instrumentation can influence timing.

An explicit local counterexperiment changed viewport390x844 to390x630 after the test measured the board, leaving the test's old relative position intact. The board changed328->292. Native pointer events hit column6/row5; the UI correctly displayed row5, while the unmodified test waited30seconds for row4 and failed0/1 (35296.7592ms). The paired experiment returned a fresh box after native scroll/settling instead: its actual native point selected column5/row4, and the entire original test including exact two action payloads passed1/1 (6282.59ms). No forced/synthetic event or expected result/timeout changes.

The mechanism is proved for this controlled resize, not for the original CI run, which has no pointer trace. Do not relabel originalChrome/CPU039 failures as harmless flakes or PASS. This changes the next safe action to a narrow test-coordinate stability repair plus deterministic resize regression and candidate-specific Windows, rather than blind reruns. Frozen845 is still under genuine review; do not amend it or borrow approval for a successor.

The [Playwright locator reference](https://playwright.dev/docs/api/class-locator#locator-bounding-box), fetched during diagnosis, states that bounding-box input relies on a static page; scroll can change the measured box. The click position uses the element padding box. The repair should settle/scroll first and calculate from the actual canvas geometry, preserving native input and exact target assertions. Newer unrelated APIs from the current reference are not required.

Raw compact measurements, exact test durations and original failure identity are preserved in SHIFT_BAND_POINTER_DIAGNOSIS_20260913.json. The first observer's verbose output was truncated; only its verified summary is retained. Observer output is restricted to localhost/127.0.0.1 and the authored runtime fixture. No product patch, new branch, push or publication is implied by these experiments.

The original40minute review read later returned genuine043HOLD. Its B1 identifies a different failed test than the exact job log. The full response is retained, and UI_PUBLIC_MATCH_ACTIONS_REVIEW_CORRECTION_20260913.md records the once-refetched same-job evidence. This discrepancy is not a release approval or proof that CI was harmless.
