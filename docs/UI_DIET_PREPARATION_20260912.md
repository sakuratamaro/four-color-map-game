# UI design simplification: successor-goal preparation

CANON_RECEIPT version=shared-canon-v1.1 base=a6c24f496338412a7cb4e933b0faba06cb28ccce request=UDL-20260907-023,UDL-20260910-052,UDL-20260910-054 specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md tests=tests/standard-online-browser.test.cjs,tests/standard-online-ui-static.test.cjs

This is a preparation snapshot, not another request ledger or an active replacement goal. The explicit user instruction in commander task01a07b56-616e-7733-9aae-90575659688e on2026-09-12 is to finish memo/calculator, then create and start the next goal for UI simplification. The currently active memo goal is not closed by this document.

## Sources and delivery boundary

- Designated ChatGPT conversation: `6aa229e7-e098-83ee-ac5e-d366a12653a4`.
- Actual paired user message `bbb21715-8ab0-4dfb-ad2f-b46883434765` and design response `c1c1a98e-749e-42ec-8a95-2ef30abd5035` were read completely. Only product requirements are retained here; unrelated personal details are excluded.
- Latest package retrieval was requested from the existing transfer task `01a08d9e-ae35-7f70-a879-cb342dafef47`. Its latest compact status is active/waitingOnApproval; no completed v8 handoff has arrived. Do not duplicate that retrieval, infer a hash, or pretend v8 manifest verification is done. v7 was already checked40/40 and is not re-downloaded.
- The paired text is available independently of the ZIP. Package arrival will add exact aliases/hashes and supersession links to the existing canonical ledger; it is not an additional requirement approval gate.

## Small release slices, in order

1. **Battle entrance (existing UDL023)**: first viewport shows CPU, then a non-clickable 人と対戦 heading with 友だち／だれか. Show only the selected route's controls. CPU portrait roster, friend code creation/join and public matching keep their existing authoritative flows and in-flight identities. Remove normal home/battle Local/Quick links, not their implementation or saved data. Normal battle entry must not be buried below a full profile editor.
2. **Board, role palette and hand (UDL052/054)**: the user explicitly withdrew color-position-fixed design. Use separate basic①/basic②/bonus/remaining role slots in one row; identical colors never merge. Button contents ∞/count/🔒/❌, external role labels and accessible names. ❌ is unowned/exhausted, not adjacent-color legality. Multiple remaining/borrowed/prism colors stay selectable from slot4 without losing usable colors. Preserve server consumption semantics and private-data rules. Hand is3×2 with positions retained for used cards; descriptions are optional, never a mandatory activation step. Board and palette fit one usable viewport, with reasonable cell sizes and explicit small-screen/zoom fallback.
3. **Result-local continuation**: rematch, another opponent, earned-ticket gacha and lobby actions stay by the result. Navigating elsewhere does not create a match, discard rewards or replay a finished start reveal. Preserve UDL055/059.
4. **Item-local cosmetic purchase/equip**: complete on the item after one explicit buy/equip action; local pending/success/retry. Preserve funds/trophy checks (UDL049), server ACK, idempotency and a genuinely changed-price confirmation. No actual-money purchase or price/economy changes are authorized here.
5. **Player-facing copy**: replace internal jargon with outcome and next action, incrementally in the touched flows. Retain prices, odds access, rules, credits and real errors. Fold random setup/history detail below the play area; keep opponent palette-change cause notifications visible. UDL057 public-event history is not reconstructed from missing data.

Assign new canonical IDs only for genuinely distinct result/item/copy/hand requests after checking existing rows. Keep old release evidence and explicitly mark superseded color-position proposals; do not rewrite historical design snapshots as if they had always said role-position.

## Implementation entrypoints already inspected

- `standard-online-v5/index.html`: all-tab profileCard, home Quick callout, lobby-choice-grid, separate matching panels, cosmeticConfirmation after the full catalog.
- `standard-online-v5/app.js`: activateAppTab/renderAppShell, current new-match guards and CPU saga, findPublicOpponent, renderCosmetics. These existing paths own state; new presentation must not bypass them.
- `standard-online-v5/style.css`: responsive bottom tabs, board viewport, existing portrait roster and palette/hand controls.
- Existing browser suites cover active-room entry denial, pending CPU/matching retries, setup/finished recovery, cosmetics and palette. They are baseline protection, not yet tests of the new simplified design.

## Acceptance and next-goal stop condition

After UDL048 public completion, create the successor goal in the existing task. Reconcile latest available source, start from fresh published main in a separate clean codex/UI worktree, and implement the slices serially around shared state. For each slice: actionable role/source/spec/test receipt, exact candidate, relevant Chrome/Edge and Windows tests, actual designated Astra review, force-free main/Pages and bounded public verification. Finished slices may publish without waiting for all UI work. Goal completion means the adopted UI slices are publicly verified and remaining physical acceptance/manual operations are explicitly distinguished—not merely a plan or a ZIP receipt.

No CPU strength/image/card expansion, new controller, duplicate queue, unbounded review polling, private-state exposure, database schema change or Edge deployment is part of this initial UI goal. If the implementation reveals such a dependency, separate it and request a precise scope decision rather than mixing it into a cosmetic release.
