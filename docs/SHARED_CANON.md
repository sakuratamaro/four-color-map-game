# Shared canon entrypoint

Version: `shared-canon-v1`

Baseline: `origin/main@2f855ccfef11d7c099cfb73fb57ec3da79be8789`

Introduced by: `UDL-20260910-050`

This is a routing document, not a second command center. ChatGPT and Codex use these existing repository sources instead of repeatedly exchanging full conversation history.

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
version=shared-canon-v1
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

## Current handoff boundary

The governance migration itself changes no game code, production DB, migration, Edge Function, Pages asset, or main branch. At this baseline, the command center reports public product `7d69d34` as `MERGED / LIVE_CHROME_PENDING`. The separate corner-bloom candidate `98bad1d` has Windows run `34447976952` successful and remains outside this migration branch at the pre-Edge safe point.

## Finite operating loop

1. User/ChatGPT provides a request with provenance.
2. Commander adds or updates one UDL row and, if needed, a REQ alias mapping.
3. Assignee returns only the IDs, base/candidate SHAs, changed paths, tests, and pending evidence.
4. Commander integrates once and records resulting evidence.
5. ChatGPT reviews only when the task calls for its judgment; the decision is saved with exact scope.
6. If no approval or new request is pending, stop. Do not spend model usage polling unchanged state.
