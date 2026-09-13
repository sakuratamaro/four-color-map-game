# Explicit public matchmaking actions

Version: `UDL-023-public-actions-v1`

CANON_RECEIPT version=shared-canon-v1.1 governance=8a4ccb45e43e93020a69be9ae7574f808c2d5905 base=70e691b6f8f1d808476e80990d20df7862bfb782 public_base=954e1c5c52d5453fc9fee9872b2d7e922f850a39 request=UDL-20260907-023,ADD-20260913-PUBLIC-MATCH-TWO-ACTIONS specs=docs/SHARED_CANON.md@codex/dev-brain-current-20260910,docs/BRAIN_V14_DELTA_INTAKE_20260913.json@codex/dev-brain-current-20260910,docs/UI_FLAT_ENTRANCE_20260912.md,docs/UI_PUBLIC_MATCH_ACTIONS_20260913.md tests=tests/standard-online-browser.test.cjs,tests/standard-online-ui-static.test.cjs,tests/standard-online-client.test.cjs,tests/standard-matchmaking-activity-handoff.test.cjs worktree=.codex-worktrees/ui-public-match-actions-20260913

Owner: existing commander `01a07b56-616e-7733-9aae-90575659688e`.
User source: genuine Astra conversation `6aa229e7-e098-83ee-ac5e-d366a12653a4`, user message `bbb2135e-cfd1-4da8-845b-9e3d07d8b29a`, verified v14 intake alias above.

The user asks for two obvious buttons after choosing public play: wait for an opponent, or join someone already waiting. This supersedes only UDL023's old automatic recruitment after an empty find and the text-like waiting disclosure. Earlier flat three-way entrance publication remains historical evidence, not acceptance of this new behavior.

## Contract

- Keep the CPU / friend / public entrance. Route selection sends no room/ticket/start operation.
- Show two native buttons together: 「相手を待つ」 and 「待っている相手に参加」. No waiting disclosure or third initial search action. Both have at least44px hit targets, visible focus and readable wrapping at390/768/1280px and narrow/large-text layouts.
- Waiting uses the existing recruit method only. Joining uses the existing find method only. An empty successful search does not recruit; explain that nobody is waiting and leave the two explicit choices available.
- Preserve busy, actor ownership, existing ticket/room/CPU-saga guards. Repeated clicks while a request is pending cannot allocate another operation. Keep each client's persisted ID on lost responses and reload; a resumed find never becomes recruitment.
- Existing waiting status, cancel, expired/error recovery, CPU offer, matched-room handoff and six-card setup remain available. This request does not remove necessary recovery actions.
- No client transaction, RPC, DB, Edge, managed setting, identity/private-data, clock, game/card/reward, CPU or artwork changes. Kurogane100's separate9590 candidate and its gates remain untouched.

## Executable acceptance

Extend existing browser fixtures to prove the visible two-button layout and native Enter/Space operation, empty search with recruit0, successful join with recruit0, busy double-click protection, pending-find same-ID reload with recruit0, and wait-only same-ticket reload/cancel. Retain room/CPU ownership and quiz/handoff tests. These are local real-browser tests with fixture services, not live-user matchmaking or physical acceptance.

Source/static checks bind the removal of automatic waiting to this later user requirement; update the old assertion explicitly, not by weakening it into an existence check. Existing client tests still exercise transaction identity and retry behavior unchanged.

## Release boundary

Prepare locally on approved but unpublished70e without changing it. This UI must follow70e, not replace or publish ahead of it. Fresh main must equal the reviewed UI base before a separately fixed candidate can publish; reconcile and obtain new exact review if it differs. Windows Chrome/Edge must pass on that candidate, followed by genuine Astra review, same-SHA force-free main/Pages and changed-asset byte/preflight evidence. Prior039/040/042 approvals and closed waits cannot authorize this UI.

No real-user find/recruit, new test profile/match, or reopening old065/067/062 trials is authorized here. Publication and physical acceptance are NOT_RUN.
