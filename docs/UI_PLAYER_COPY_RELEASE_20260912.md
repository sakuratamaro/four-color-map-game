# UDL062 player-copy public release

CANON_RECEIPT version=shared-canon-v1.1 base=a757c126e1325532bb11a719cf92d0d13401d3ae request=UDL-20260912-062 specs=AGENTS.md,docs/SHARED_CANON.md,docs/UI_PLAYER_COPY_20260912.md@a1,docs/STANDARD_PUBLIC_RELEASE_RUNBOOK.md tests=tests/standard-player-copy-static.test.cjs,tests/standard-online-browser.test.cjs,scripts/live-standard-player-copy-canary.cjs worktree=.codex-worktrees/ui-player-copy-20260912

Explicit user-resumed NORMAL_WORK turn01a0949e-ab97-7712-8c4f-67ec29f2f551 at07:57:01Z. Genuine completed Astra replyab7578b2 to request7bdcf425 was read at07:57:16Z.020 APPROVE_RELEASE binds candidatea1a9b1c830eceb98464b107f2442deacaf765505,basea757c126e1325532bb11a719cf92d0d13401d3ae,UDL-062-copy-v1.1,specblob5481afd8c2b9ff5354bba0e671615c97fb8ceef7,Pages_only,DB[]/Edge[].021 REQUEST_CHANGES applies separately tod18 governance only and is not a product hold.

Pre-release: clean fixed candidate; fresh origin/maina757,ancestor checkexit0; exact specblob matches. Windows34679764998 freshly retrievedcompleted/success exacta1; prior job evidence Chrome103516091078/Edge103516090978 each132/132+575/575,Edge79/79,skip0. Existing clean local917/917 and Chrome/Edge8/8 remain candidate evidence; no unnecessary full rerun. This product has no.openai/hosting.json and remains on the explicitly requested existing GitHub Pages, not a new Sites deployment.

## Publication and bounded acceptance

**PAGES_PUBLISHED / LIVE_ACCEPTANCE_PARTIAL**, not PUBLIC_VERIFIED. After the fresh ancestor check, the commander pushed exact `a1a9b1c830eceb98464b107f2442deacaf765505` to main without force at08:01:44Z. Remote main and the dedicated branch both read back as a1. Pages run `34682215186` used that SHA; build `103522818303`, deploy `103522877935` and report `103522877941` all completed SUCCESS. No DB, Edge, product follow-up or image change.

Candidate preflight exited0,ok:true before creating any profile (`UI_PLAYER_COPY_PREFLIGHT_20260912.json`). The canary checked public bytes against candidate Git blobs before its one profile: index.html SHA-256 `4e7f1a7f011bba937b3ec9239626c8ce3079536fd516f6052ac36e7e9450f514`, app37 `3ddb272efd6717ae768c3ce2b963b3be537d6bec02cf588dc615f4d1eb356652`.

Initial live canary completed08:05:20.135Z: **52 checks passed, then FAIL `same server profile after all navigation`**. Preserve `UI_PLAYER_COPY_LIVE_20260912.json` unchanged. One account/profile, zero matches, economy actions, browser non-read requests or deletions. All5 tabs at390/1280px, single plain connection badge, home-only explanation, zero horizontal overflow, closed/labelled diagnostics and reload connection passed. Both actual home screenshots were visually inspected and readable. Room-only diagnostic interaction remains NOT_RUN_NO_MATCH, distinct from candidate playing fixtures; no state injection. Physical NOT_RUN.

The failing server equality and the subsequent final browser-operation and console assertions are not claimed passed. The original report's zero operation counters are observations, not substitutes for unexecuted final assertions. Browser/session closed normally; no credentials were retained. Additional profile attempts:0.061 stays closed94/94,cumulative2profiles; do not rerun.

## Harness diagnosis and local correction

The harness compared profile objects with JSON.stringify. Initial `profile` creation returns constructed `committedState`; later reads return stored JSONB (`standard-online/index.ts`517–545 at a1). Object property order can differ without a data change. A key-reordered fixture definitely reproduces this harness defect. However, initial/final live values were not saved: **the actual failed comparison cannot be proved to be order-only** and remains failed, not rewritten as PASS.

Harness-only correction uses node:util isDeepStrictEqual, preserving array order and every persisted value. `profileReadbackComparison` rejects incomplete shapes and checks revision/displayName/full profileState. Redacted equality booleans are saved before the final assertion; credentials and profile identifiers remain excluded. Regression4/4 PASS (294.8575ms), including key-only reordering accepted and revision/name/coins/inventory/array-order changes rejected. Original opt-in, exact bytes before one profile,180s bound and read-only allowlist remain. No second live run was made. Request Astra's bounded acceptance disposition separately from the already-executed product approval.
