# Flat battle entrance
Version: UDL-023-entrance-v2

CANON_RECEIPT version=shared-canon-v1.1 base=3b1d4e65197c476686b7b8a13c49f97ffd591e68 public_base=a1a9b1c830eceb98464b107f2442deacaf765505 request=UDL-20260907-023,UDL-20260912-062,ADD-20260912-ENTRY-FLAT-THREE-BUTTONS specs=docs/SHARED_CANON.md@codex/dev-brain-current-20260910,docs/UI_DIET_ENTRANCE_20260912.md,docs/UI_FLAT_ENTRANCE_20260912.md tests=tests/standard-online-browser.test.cjs,tests/standard-online-ui-static.test.cjs worktree=.codex-worktrees/ui-flat-entry-20260912

User source: designated Astra thread6aa229e7-e098-83ee-ac5e-d366a12653a4, userbbb2137d-8aaa-4432-ab40-0938b5a4cde2, verifiedv13 intake aliasADD-20260912-ENTRY-FLAT-THREE-BUTTONS. This later requirement withdraws the CPU/human nested grouping and yellow boxed heading. It supersedes that presentation in UDL-023-entrance-v1.1, not its behavioral safeguards or historical publication evidence. Existing commander is sole owner; canonical ledger remains on the existing governance branch.

## Small successor slice
Three peer buttons, CPU / 友だち / だれとでも, in one row at390/768/1280px. No extra CPU card, 人と対戦 subgroup, introductory badge, arrow or explanation above the choices. Accessible names include対戦. The plain heading remains the lifecycle return focus target; focus is indicated without the large yellow outline around a heading. All buttons have at least44px width/height; narrow/zoom layouts may wrap text rather than clip or shrink the target.

Preserve stable button IDs and handlers. CPU opens existing10-person selector, restores focus on cancel and requires the existing6-card confirmation before a match. Friend still reveals create/join controls; public still reveals find/recruit/wait/recovery controls. Route selection writes no profile/room/ticket. Pending ticket or unresolved find retains visible public recovery even if friend is selected. Search probabilities, automatic queue behavior, clocks, active-room protection, CPU policies, game/economy rules and data remain unchanged.

## Executable acceptance
Extend existing route browser test with same-row/same-parent peer buttons, no nested heading, accurate accessible names, >=44px target hit tests and no horizontal overflow at390/768/1280. Verify Enter/Tab navigation, selectedaria-expanded, nativeCPUdialog10choices/focusrestore, oldpending-search/reload/lifecycle recovery and no writes on route-only changes. Focused heading has no yellow frame, but is still the focused DOM target and visibly underlined when keyboard focus is appropriate. Keep all065cut-in browser regressions and existing quiz notice focus positioning.

OnlyHTML/CSS and their test/release marker contracts change; no app.js or server logic. Generated bundles unchanged. Newui-diet CSS cache marker3. No images, private data, DB or Edge changes. Physical acceptance NOT_RUN until tested.

## Release ordering
Local preparation starts from frozen065candidate3b1 while its genuine review is pending, not from an already-published parent. Do not publish this UI before065. After065 publication, freshly verify main equals/contains the required parent and reconcile any change before fixing the UI release SHA. Candidate/spec changes need genuine exact Astra review and Windows gates. Public byte/preflight/live navigation evidence is separate from mocked local browsers. No reopening062's closed2-profile acceptance; any later UI canary has a separate explicit candidate-bound scope.
