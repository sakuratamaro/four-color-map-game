# Result-local continuation

Version: UDL-060-result-v1-draft

CANON_RECEIPT version=shared-canon-v1.1 base=32046255e88901ce03dc88c59f51e803529b9f63 public_floor=93c05c7c68576b28a126588d0716f0f56c015531 request=UDL-20260912-060 specs=AGENTS.md,docs/SHARED_CANON.md,docs/PROJECT_COMMAND_CENTER.md,docs/UI_DIET_PREPARATION_20260912.md,docs/BRAIN_V8_PAIRED_INTAKE_20260912.json tests=tests/standard-online-browser.test.cjs,tests/standard-online-ui-static.test.cjs worktree=.codex-worktrees/ui-result-20260912

The predecessor3204625 is a candidate, NOT public yet. Keep this successor isolated while its parent is reviewed and tested. Governance sources live on existing codex/dev-brain-current-20260910, not a copied second ledger. Source is paired v8 userbbb21715-8ab0-4dfb-ad2f-b46883434765/designc1c1a98e-749e-42ec-8a95-2ef30abd5035. The explicit current user asks to complete UI simplification after memo/calculator, now completed; no new controller or CPU/card/DB/Edge work.

## Design and acceptance

Place existing rematch controls directly beside the persistent finished result, above the old board/details. The one-time terminal overlay also offers next steps locally. Preserve authoritative requestRematch/requestCpuRematch identities, busy flags, race handling and room setup; action only follows an explicit click. CPU-other-opponent reuses the existing replace-finished CPU roster flow. Do not create a new match merely by opening an opponent picker or moving tabs.

Show an earned-ticket gacha route only when the current finished match has a matching saved profile history reward with awarded=true, a valid integer ticket level1-5 and positive awarded count, excluding experimental matches. Do not infer level from CPU name, strength or current selected gacha. A remaining balance of0 still permits navigation, never an automatic draw. Pending gacha's own level/actionId retains precedence. Cold reload and persistent result must work after the one-time celebration was already dismissed. CPU draw continuation remains bound to the original room/match, not a stale event.

Normal tab/gacha navigation keeps the current room connection, result, reward and finished-notice suppression. The explicit existing action labelled '結果を閉じてロビーへ' has a narrower, deliberate meaning: close only the displayed client room reference with closeDisplayedRoom, while the server room, saved match history and tickets remain untouched. This is not a silent consequence of merely viewing another tab. A human '別の相手' entry uses this explicit finished-result exit before opening the normal selection controls and does not itself search/recruit/create. Keep this distinction visible in labels and tests; do not claim the client room reference survives explicit close. Failure or pending rematch must not be silently discarded by competing next-match actions.

390x844/768x900/1280x900: readable result reason and local next controls,44px targets, no horizontal overflow or fixed-chrome occlusion, keyboard/focus returns, overlay dismissal/reload, CPU/human, reward hydration/daily limit/zero balance/pending gacha, no automatic write, one explicit rematch and retry identity. Keep UDL048/052/054/055/059 and existing setup/private-state/game rules. Scripted browser fixtures are not real public gameplay or physical-device acceptance.

This draft is an implementation receipt, not an approval. Freeze a final spec and candidate, run relevant and whole Windows gates, obtain genuine exact-SHA Astra approval and fresh-main reconciliation, then force-free same-SHA Pages/public verification. UI goal remains active through060/061/062.
