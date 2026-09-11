# UI diet — board, role palette and stable hand

Version: UDL-052-054-063-play-v1.2

CANON_RECEIPT version=shared-canon-v1.1 base=93c05c7c68576b28a126588d0716f0f56c015531 request=UDL-20260910-052,UDL-20260910-054,UDL-20260912-063 specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/UI_DIET_PREPARATION_20260912.md tests=tests/standard-play-surface-model.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/ui-play-surface-20260912

Governance references are on existing codex/dev-brain-current-20260910. Model preparation becf83c started from a9 while entrance was reviewed; public93 was subsequently merged normally, preserving history. Entrance is PUBLIC_VERIFIED (UI_ENTRANCE_RELEASE_20260912.md on governance branch). Its approval012 does not cover this successor. Astra completed continuation d7a96f4c-12db-45ca-b50b-b12b95edb727 confirms the next scope, not a release approval.

Source: actual v8 userbbb21715-8ab0-4dfb-ad2f-b46883434765/designc1c1a98e-749e-42ec-8a95-2ef30abd5035, and Astra continuation36b63473-e10a-4dad-88a1-b46aae53407d. Color-position-fixed is withdrawn. Four roles stay basic1/basic2/bonus/remaining even when the first three have the same color.

## Presentation model first

Only the viewer's own authoritative projection is passed. Basic resources display∞; bonus displays remaining count; unavailable/exhausted displays❌; available but sealed displays🔒. No adjacency/legal-answer prediction. Server receives color, never a resource-slot consumption instruction, preserving unlimited/basic/prism/temporary priority.

The fourth role offers every color not already covered by an available basic/bonus resource. Duplicate colors can leave multiple alternatives. Borrow/prism may make an exhausted bonus color available through this independent fourth-role grant; it must not disappear when the bonus role shows❌. Each temporary grant is one color action: existing standard-match.js clears prism/temporary effects after that action. Role buttons do not merge and all alternative colors remain reachable from an accessible selector outside the color button.

Hand order comes from own private projection.loadout (color/area/disrupt), not another player's state or inferred history. The engine retains zero-count hand keys and publishes the viewer's own loadout; render used slots instead of dropping them. Optional loan cards remain separate beyond the normal six. Main grid3x2, descriptions optional, original action timing/category/pending guards unchanged.

## DOM contract and acceptance

Four role-labelled buttons are present throughout an active match; they are disabled outside the viewer's color turn. Counts/symbols alone are drawn inside, with full color/resource/seal text in accessible names and titles. Newly usable remaining colors replace a previously unavailable default, while an explicitly selected available but sealed grant keeps its lock. Alternative selection alone sends nothing. Every actual paint uses the existing COLOR_REGION {color} path and its server/seal/retry guard.

Fit the board and palette using actual fixed/sticky chrome dimensions, keeping top navigation distinct from bottom bars. Normal390x844,768x900,1280x900 must show the complete board and all four44px-or-larger color controls without occlusion or page overflow. The current turn guide is included when possible. A visible palette-change cause takes priority over duplicate turn prose; it stays adjacent to the board and is never folded or silently dismissed. Viewport fitting is presentation-only, coalesced in requestAnimationFrame, and must not choose cells, infer legal answers or move keyboard focus. Tab return is explicit navigation; resizing only follows a board already in view.

Keep a minimum280px board on short screens, and give a visible scroll/portrait/zoom fallback instead of claiming impossible all-at-once fit. Existing twofold pan/keyboard zoom supports12-column boards; alpha.4 fine-cell zoom remains unchanged. Test normal viewports, landscape short-height fallback, a200-percent CSS-zoom proxy, palette-cause notice, CPU torn/coherent projections and voluntary surrender. CSS zoom is not physical-device acceptance.

The first full Windows gate on6cd12ae was113/117 in both browsers, not releasable. Preserve the old normal390px board width>300 check, zoom/guide clearance, CPU public-commentary stable-hitbox check and LAB loan keyboard/payload test. Reserve notice space from resolved CSS top/height even while hidden, including safe-area inset; compact mobile guide typography and native scroll margin keep controls clear without hiding the guide or changing on notice arrival. Update only the first-move test's obsolete sibling selector to the adopted playSurface/hand/details structure; all its geometry/focus/action assertions remain. LAB loan cards retain their existing visible label and keyboard cancellation target. Review the successor SHA/spec anew; no6cd approval or wait-budget reset may authorize it.

The320 follow-up left the Windows board at295px while local was above300. Replace the guessed extra48px with the measured vertical flow from guide/notice through board, creation controls and palette, subtracting the actual board height. Keep8px slack, the280px short-screen minimum and the unchanged normal>300 assertion. This avoids double-counting margins and uses the browser's own font metrics; no viewport/test threshold, rule or public-state behavior is relaxed.

Own six-card loadout stays3x2 in authoritative category order, including disabled used cards. Description buttons are optional and44px-or-larger, including for used cards; activation still calls existing beginSkill directly. Loan cards span a separate following row. Preserve timing/category/debug/pending guards and no opponent hand inspection. Fold only match setup and public trace details after the hand; palette-change notice remains outside details.

Pages-only scope: HTML/app v20260912-31, play-surface model and CSS v20260912-1, focused tests and current cache contract/runbook. Existing Windows workflow adds this exact candidate branch only; no permissions or wildcard expansion. DB[]/Edge[]; no new CPU/card/economy logic, no existing saved data deletion, no result/cosmetic slice mixed in. Memo048, entrance023, terminal055 and gacha059 are regressions to preserve. Actual exact-SHA Astra review, clean tests, Windows Chrome/Edge and same-SHA Pages plus bounded public verification remain required. No public completion is asserted by this spec.
