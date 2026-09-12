# Repository-wide Codex entrypoint

Before changing this repository, read `docs/SHARED_CANON.md` and follow its routing table. It points to the existing command center, specifications, executable tests, release evidence, and worktree rules; it does not replace them.

At task start, record a short receipt in the work report:

`CANON_RECEIPT version=<version> base=<sha> request=<UDL/REQ IDs> specs=<paths> tests=<paths>`

Only load the routed material needed for the active request. Preserve dirty worktrees and existing task ownership. The root Codex commander owns assignment, shared-ledger integration, and release. Subagents receive the exact request IDs, spec paths, test paths, base SHA, and non-change boundaries; they do not edit the shared ledger concurrently or publish directly.

For commander continuation, run `node scripts/check-commander-continuation.cjs` at start and `node scripts/check-commander-continuation.cjs --end-turn` before ending an automation/review/publication turn. Use the bundled Node runtime when Node is not on PATH. Follow the current phase rules in `docs/CHATGPT_COLLABORATION_OPERATION.md`. A self-addressed message or a successful scheduling API call is not evidence that normal work actually ran. Never leave eligible review/approved unpublished work with the only heartbeat PAUSED. Do not create a second queue or scheduler; persist the next actual run in the existing coordination record and verify the actual automation setting.

Existing privacy and authority boundaries survive a goal change: do not expose hidden game state to the CPU or public presentation, and do not infer permission for purchases or paid configuration changes. Preserve the distinction between implementation, verification, commit, push, deployment, and confirmed publication. A documentation review authorizes none of those external steps by itself.

The nested `four-color-map-game/four-color-map-game/AGENTS.md` still governs that legacy/local prototype subtree. When it conflicts with a later explicit user decision or the repository-wide canon, stop and reconcile instead of silently choosing the current code.
