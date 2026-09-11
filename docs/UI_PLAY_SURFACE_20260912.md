# UI diet — board, role palette and stable hand (in preparation)

Version: UDL-052-054-063-play-v1-draft

CANON_RECEIPT version=shared-canon-v1.1 base=a9b2ff984c448819483286eae5acfa91530fc5db request=UDL-20260910-052,UDL-20260910-054,UDL-20260912-063 specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/UI_DIET_PREPARATION_20260912.md tests=tests/standard-play-surface-model.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/ui-play-surface-20260912

Governance references are on existing codex/dev-brain-current-20260910. This local successor starts from the frozen entrance candidate, which is not yet claimed published; reconcile its final accepted SHA before integrating. It does not modify the submitted entrance worktree or inherit its approval.

Source: actual v8 userbbb21715-8ab0-4dfb-ad2f-b46883434765/designc1c1a98e-749e-42ec-8a95-2ef30abd5035, and Astra continuation36b63473-e10a-4dad-88a1-b46aae53407d. Color-position-fixed is withdrawn. Four roles stay basic1/basic2/bonus/remaining even when the first three have the same color.

## Presentation model first

Only the viewer's own authoritative projection is passed. Basic resources display∞; bonus displays remaining count; unavailable/exhausted displays❌; available but sealed displays🔒. No adjacency/legal-answer prediction. Server receives color, never a resource-slot consumption instruction, preserving unlimited/basic/prism/temporary priority.

The fourth role offers every color not already covered by an available basic/bonus resource. Duplicate colors can leave multiple alternatives. Borrow/prism may make an exhausted bonus color available through this independent fourth-role grant; it must not disappear when the bonus role shows❌. Each temporary grant is one color action: existing standard-match.js clears prism/temporary effects after that action. Role buttons do not merge and all alternative colors remain reachable from an accessible selector outside the color button.

Hand order comes from own private projection.loadout (color/area/disrupt), not another player's state or inferred history. The engine retains zero-count hand keys and publishes the viewer's own loadout; render used slots instead of dropping them. Optional loan cards remain separate beyond the normal six. Main grid3x2, descriptions optional, original action timing/category/pending guards unchanged.

## Still to implement/verify

DOM integration; board and palette usable same viewport with small-height/zoom fallback; six-card layout and disabled used state; folded setup/history details; visible opponent palette-change cause notice; browser geometry/a11y/actual payload regressions. No implementation/publication claim is made by this model-only preparation. DB[]/Edge[], no CPU/card/economy changes.
