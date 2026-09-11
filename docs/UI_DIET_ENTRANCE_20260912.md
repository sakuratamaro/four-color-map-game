# UI diet — battle entrance

Version: `UDL-023-entrance-v1`

CANON_RECEIPT version=shared-canon-v1.1 base=a26ffd14a8f896d9d087dac032d8f079ece82f7d request=UDL-20260907-023,UDL-20260912-062 specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/UI_DIET_PREPARATION_20260912.md tests=tests/standard-online-browser.test.cjs,tests/standard-online-ui-static.test.cjs worktree=.codex-worktrees/ui-diet-20260912

Governance references above are on existing `codex/dev-brain-current-20260910@7544c59406f95aefdcf5c1b8235f7cc49667eabd`, not silently claimed to be integrated into product main. Canonical ledger remains there until its separate integration. One owner: existing commander01a07b56-616e-7733-9aae-90575659688e.

## Source and adopted scope

User explicitly requested the UI goal after completed memo/calculator. Actual v8 source: designated ChatGPT6aa229e7-e098-83ee-ac5e-d366a12653a4, paired userbbb21715-8ab0-4dfb-ad2f-b46883434765 → responsec1c1a98e-749e-42ec-8a95-2ef30abd5035. ZIP retrieval stays with existing transfer task; unreceived ZIP hash/manifest are not invented or treated as a new permission gate.

First viewport: CPU, non-clickable 人と対戦 heading, 友だちと対戦 and だれかと対戦. Only selected human route shows its controls. Selecting a route alone creates no profile, room, ticket or CPU match. Name/profile preparation stays available to a new player; returning players see the editor only on My Page. Normal home/battle Local/Quick links are removed; files, rules and legacy saves are unchanged.

CPU opens the existing ten-person roster and requires the existing six-card confirmation. Friend route preserves code creation/join. Public primary 相手を探す performs the existing find operation. Only a successful explicit-click `none_available` result then enters the existing recruitment path, after releasing its busy flag and rechecking the existing entry guards. A lost response never starts recruitment. Automatic resume retains the old search identity and does not infer a new waiting intent. Existing optional wait-only action remains under a closed disclosure. Pending ticket/search always makes recovery/cancel status visible; changing UI route does not reset it.

## Acceptance

- 390x844, intermediate768px, desktop1280px: all three choices visible without initial scrolling; hit targets>=44px; no horizontal overflow, overlap or clipping. Small-height/zoom may scroll instead of shrinking controls.
- Only selected route is visible/accessibly expanded; keyboard reaches real buttons; hidden controls cannot receive normal input. Human heading is not a button. CPU dialog focus restoration and optional wait disclosure work.
- Search matched: enter existing room, no recruitment. Empty successful explicit search: one recruit, persisted ticket; double-click cannot duplicate. Error/lost response: retain search identity; no recruit. Pending reload/cancel/race recovery unaffected.
- New-player name creation, active-room return, pending CPU saga, finished return, quiz/calculator048, role labels052, finished reveal055 and reward level059 stay protected by executable existing tests.

## Non-changes and release

Pages_only; DB[]; Edge[]. No game/CPU rules, prices, cards, art, credentials, legacy saves, private projections, rewards or generated engine changes. Further board/role-palette/hand/result/cosmetics slices remain unimplemented by this entrance slice. Exact candidate Astra review and both Windows jobs precede force-free main/Pages; served-asset equality and real public navigation are verified separately from fixture browser tests. Physical devices remain NOT_RUN unless actually tested.
