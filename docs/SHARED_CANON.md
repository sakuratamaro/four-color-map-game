# Shared canon entrypoint

Version: `shared-canon-v1.1`

Baseline: `origin/main@2f855ccfef11d7c099cfb73fb57ec3da79be8789`

Introduced by: `UDL-20260910-050`

This is a routing document, not a second command center. ChatGPT and Codex use these existing repository sources instead of repeatedly exchanging full conversation history.

The integration proposal lives on local branch `codex/dev-brain-current-20260910` in `.codex-worktrees/dev-brain-current-20260910`. It is not yet on remote main. Until integration is separately authorized, both reviewers use the exact candidate SHA and preserved-path review packet; the routing below identifies existing authorities at the pinned baseline, not an already installed remote configuration.

## Canonical locations

| Concern | Canonical repository / branch / path | Authority |
|---|---|---|
| User requests, decisions, ownership, lifecycle | `sakuratamaro/four-color-map-game`, current `origin/main`, `docs/PROJECT_COMMAND_CENTER.md#user-decision-ledger` | Primary request ledger |
| Detailed Standard rules | same repository/branch, `docs/STANDARD_MODE_SPEC.md` and feature-specific `docs/*SPEC*.md` | Rule contract; later UDL decisions supersede older text explicitly |
| Acceptance criteria | UDL `受入条件` column plus the linked detailed spec | Primary acceptance record |
| Executable regression tests | `tests/*.test.cjs` and the workflow-selected test lists | Test truth; prose is never counted as an implemented test |
| Current release evidence | `docs/STANDARD_RELEASE_EVIDENCE.md` | Finite evidence record |
| Release procedure | `docs/STANDARD_PUBLIC_RELEASE_RUNBOOK.md` | Production procedure |
| Worktree and uncommitted-change ownership | `docs/WORKTREE_HYGIENE_INVENTORY.md` | Preservation record |
| Imported ChatGPT request aliases | `docs/SHARED_CANON_REQUEST_INDEX.json` | Crosswalk only; never overrides UDL |
| ChatGPT review decisions | `docs/CHATGPT_REVIEW_DECISIONS.json` | Review record; scope and subject SHA are mandatory |

## State dimensions

Do not compress these into one ambiguous word:

- `intent_state`: proposed, decided, spec_ready, held, superseded.
- `implementation_state`: not_started, in_progress, implemented, stale_candidate.
- `verification_state`: not_run, local_pass, windows_gate_pass, live_pass, physical_pass.
- `release_state`: not_merged, merged, pages_published, public_verified.

The command center lifecycle remains `INBOX → DECIDED → SPEC_READY → IMPLEMENTING → LOCAL_VERIFIED → MERGED → PUBLIC_VERIFIED → PHYSICAL_ACCEPTED`. The crosswalk decomposes that lifecycle for imported REQ aliases; it does not invent a replacement workflow.

## Task-start receipt

At startup and before each new request slice, record:

```text
CANON_RECEIPT
version=shared-canon-v1.1
base=<exact origin/main SHA>
request=<UDL and optional REQ aliases>
specs=<exact paths read>
tests=<exact paths selected>
worktree=<clean task worktree>
```

If the baseline or candidate changes, issue a new receipt. A stale receipt, task final, or review cannot be reused.

## Ownership and concurrency

- The existing root Codex commander assigns work and integrates results.
- One active owner per UDL request. Related edits to the same state machine are serialized.
- Shared-ledger updates are performed only during commander integration, never concurrently by subagents.
- Subagents receive the request IDs, relevant specification and test paths, base SHA, and non-change boundaries.
- Subagents never deploy to Edge, Pages, main, or production DB directly.
- Do not create another resident command center, queue, scheduler, or AI polling loop.

## ChatGPT review contract

ChatGPT review is stored with `review_kind`, exact `subject_sha`, `canon_version`, `base_sha`, DB/Edge change set, decision, and source thread/message. A changed candidate or spec snapshot invalidates reuse. Silence is not approval; Codex cannot self-author a ChatGPT approval. A documentation-introduction review is not a game-production release approval.

The spec snapshot is the Git blob SHA of this entrypoint, while the exact candidate commit binds all referenced changes. The existing `scripts/check-standard-decision-reconciliation.mjs` accepts `--review-file=<log.json> --subject-file=<subject.json> --review-id=<id> --json` to reject mismatched or absent documentation approvals. The commander must first retrieve the genuine response from the designated ChatGPT. This local checker neither authenticates a copied JSON claim nor deploys anything; production still uses the existing runbook.

Store the review as a later evidence commit without amending its reviewed subject. Any further implementation or specification change needs a new subject. The evidence commit itself is not retrospectively covered by the preceding approval.

## Current handoff boundary

The governance migration itself changes no game code, production DB, migration, Edge Function, Pages asset, or main branch. At this baseline, the command center reports public product `7d69d34` as `MERGED / LIVE_CHROME_PENDING`. The separate corner-bloom candidate `98bad1d` has Windows run `34447976952` successful and remains outside this migration branch at the pre-Edge safe point.

## Finite operating loop

1. User/ChatGPT provides a request with provenance.
2. Commander adds or updates one UDL row and, if needed, a REQ alias mapping.
3. Assignee returns only the IDs, base/candidate SHAs, changed paths, tests, and pending evidence.
4. Commander integrates once and records resulting evidence.
5. ChatGPT reviews only when the task calls for its judgment; the decision is saved with exact scope.
6. When waiting for approval, stop the current turn and use the existing finite heartbeat under `docs/CHATGPT_COLLABORATION_OPERATION.md`. If an approved unpublished slice is ready, reserve its separate normal-work run instead of pausing all continuation. With no eligible work or review, pause the actual automation. Do not spend model usage polling unchanged state.

Current transport: the existing app can send text to ChatGPT task `改修ロールバック防止策` and read its completed response. A message received while that chat is busy may be rejected; do not claim delivery without verification. `wait_threads` cannot await a ChatGPT chat. The single existing heartbeat now provides separate RECEIVE and NORMAL_WORK runs under the operation document. A self-send is not a separately started worker. Artifact delivery, source completion, scheduling acceptance, and actual execution evidence remain distinct. No additional scheduler is installed.
