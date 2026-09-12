# v11 flat battle entrance — next independent UI slice (preparation)
CANON_RECEIPT version=shared-canon-v1.1 base=a1a9b1c830eceb98464b107f2442deacaf765505 request=UDL-20260907-023,UDL-20260912-062,ADD-20260912-ENTRY-FLAT-THREE-BUTTONS specs=docs/SHARED_CANON.md,docs/BRAIN_V13_DELTA_INTAKE_20260912.json tests=tests/standard-online-browser.test.cjs,tests/standard-online-ui-static.test.cjs worktree=read-only-skill-cutin-20260912

User source bbb2137d-8aaa-4432-ab40-0938b5a4cde2, linked by verifiedv13 intake. Intent DECIDED; implementationNOT_STARTED, testsNOT_RUN, releaseNOT_MERGED for this later acceptance. Old023/062 published history remains true but does not fulfill the later flat-layout request. The existing commander is sole owner; this is a feature preparation note, not another queue. Do not amend the pending065 product candidate.

## Concrete current evidence
- index.html lobby-choice-grid currently contains two nested sections: standardCpuChoice and humanBattleChoice; latter contains friend/public buttons. Existing explanatory headers and boxes visually splitCPU versus humans.
- Buttons already have stable IDs startStandardCpuLobby / chooseFriendBattle / choosePublicBattle. Preserve these handlers and existing friendBattlePanel/matchmakingPanel.
- app.js renderBattleEntrance forces routepublic while matchmakingTicketId or matchmakingFindActionId remains pending, keeping cancellation/retry visible. Preserve this regardless of which flat button is pressed.
- app.js focusBattleLobby currently focuses lobbyTitle on lifecycle return. User withdrew the yellow boxed heading design, not keyboard focus or readable status. Keep an appropriate heading focus target/visible focus treatment without the persistent yellow panel.
- ui-diet.css has human-battle-choice section styling and selected aria-expanded styling. Replace nestedcard layout with three peer buttons; selection/focus remain perceivable, targets >=44px and viewport-contained.
- Existing browser cases cover390/768/1280, Enter-to-open, expanded state, no network mutation on route choice, pending public recovery, reload and lifecycle focus. One test refers to humanBattleTitle; revise that superseded structural assertion to peer-button semantics, not remove keyboard/recovery tests.

## Planned acceptance, not tests already implemented
Three peer choices CPU/friend/anyone with no CPU/human subgroup, no persistent yellow heading box; preserve CPU selection of10, privatecode create/join, find/recruit distinction, active-room guards, pending search recovery, route-choice write0, Enter/Tab/focus and no horizontal overflow at390/768/1280. No matchmaking probabilities, waiting deadlines, CPU policy, game rules, DB/Edge or ended-room rewards change. Keep065 cut-in behavior after integration.

While the corrected065 candidate is frozen for genuine review, prepare this independent UI locally in a separate clean worktree based on that exact candidate. This advances only local implementation, not publication order. Record current publicmain a1 separately from provisional parent3b1. After065 publication, freshly reconcile main and ancestor relationship before fixing this UI's release candidate; if065 changes, reconcile the small UI patch first. No secondreview request yet;065 remains first to publish.
