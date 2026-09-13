# CPU face in the surrender confirmation

Version: UDL-067-face-v1
CANON_RECEIPT version=shared-canon-v1.1 governance=7592ee57695299b77d00d876abc13fa1737b4fb8 base=954e1c5c52d5453fc9fee9872b2d7e922f850a39 request=UDL-20260912-067,ADD-20260913-SURRENDER-CPU-FACE specs=docs/SURRENDER_CONFIRMATION_20260913.md,docs/BRAIN_V14_DELTA_INTAKE_20260913.json@codex/dev-brain-current-20260910 tests=tests/standard-surrender-confirmation.test.cjs,tests/standard-cpu-portraits.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/surrender-cpu-face-20260913

## Source and exact scope

Adopted v14 user message bbb2135e-cfd1-4da8-845b-9e3d07d8b29a in actual ChatGPT task6aa229e7-e098-83ee-ac5e-d366a12653a4: 「ここのウィンドウでもCPUの顔のイラストが見られると嬉しいです。」 Package5339aea3-bc6b-4fb2-9467-ef8a082c0538, canonical UDL067. The existing root commander owns this independent Pages-only slice. No new asset bytes; reuse the current public portrait presenter and normal face selected by the same validated public CPU ID as the dialogue. This is not completion or substitution of the separately requested Wataokiba replacement.

Place the normal face next to the existing CPU name/line in the surrender dialog. Portrait is decorative because the visible name already identifies the opponent; no extra focus stop, live announcement, victory/loss treatment or reward-only full-body art. The frame is76px on desktop,64px at390px (AI layout choice, not user-stated number). Unknown CPU and PvP retain generic confirmation with no portrait. Missing module, missing/failed atlas or presentation error must fall back without preventing cancel/confirm.

Keep native dialog, safe initial cancel focus, both44px actions, existing room/match/version/seat/current-state guards, exactly-one SURRENDER and exact pending retry. Cancel/Escape/open/portrait loading do not send operations. Closing or stale-scope cancellation clears the portrait; same-snapshot refresh must keep it stable. Existing fixed CPU lines, skill cut-ins, gameplay, CPU decisions, counts, saved rooms, DB/Edge/managed settings and all image bytes remain unchanged.

## Required evidence and release boundary

Executable tests cover all10 public IDs with matching name/line/normal atlas cell; unknown/PvP, missing module/atlas and loading/fallback;390/768/1280 plus short landscape; keyboard focus/cancel/Enter/Escape and exact-one affirmative; unchanged-snapshot stable portrait and stale CPU/room/version invalidation; no extra game/profile/match operation. Check rendered screenshots and scoped portrait/confirmation regressions. Existing Windows Chrome/Edge gate and own genuine exact review are required before release. If the base changes, reconcile and rebind the candidate rather than borrowing an old approval.

Base is fresh main954e, not the unpublished70e/b9 chain. Old067f507 publication/partial acceptance/rawFAIL and its used live allowance remain unchanged. This candidate grants no new profile/match/live test. CPU100/9590/039 and UIb9 delivery-unconfirmed expiredwait remain frozen; this new independent request does not restart that review. Production/main/Pages/DB/Edge/managed changes NOT_RUN. This specification and implementation are not self-approval.
