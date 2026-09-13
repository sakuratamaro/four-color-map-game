# Public identity of the skill just used

Version: `UDL-065-public-skill-v1`

CANON_RECEIPT version=shared-canon-v1.1 base=954e1c5c52d5453fc9fee9872b2d7e922f850a39 request=UDL-20260912-065 source=bbb2135e-cfd1-4da8-845b-9e3d07d8b29a specs=docs/SKILL_CUTIN_READABILITY_20260913.md,docs/STANDARD_MODE_SPEC.md tests=tests/standard-public-skill-event.test.cjs,tests/standard-skill-cutin.test.cjs,tests/standard-online-browser.test.cjs,tests/standard-online-engine-bundle.test.cjs worktree=.codex-worktrees/skill-cutin-public-names-20260913

The existing commander's routing, request ledger and genuine review040 were read on `codex/dev-brain-current-20260910@d82bdb6647a12b0d30b6859d04b464a15ac94c22`. The freshly fetched product base above is separate. Preserve the published954e UI, its failed/consumed one-shot trial, old062/067 partial acceptances and CPU9590/039. None approves this new candidate.

## Adopted outcome and privacy

The user's v14 request asks for a little more reading time and the used skill/result in one short line. The prior UI shipped the reading time and observable-result explanation; the opponent's catalog name is the remaining part of this slice.

After the authoritative engine resolves a USE_SKILL action, its server adapter adds optional `publicState.lastPublicSkill` containing exactly `eventId`, `version`, `actor`, and `skillId`. The ID comes from the dispatched registry definition, not from an unvalidated payload, CPU stock or private hand. It is bound to the same existing public trace. No private target, selected color, slot, unused card, palette, outcome inference or arbitrary name is copied.

This is public presentation metadata for the committed action, not a new authoritative game-state field or an independent event stream. The original `lastPublicTrace` shape, state/RNG snapshot, private projections, skill/category consumption, rules, CPU policy and rewards remain unchanged. Rejected/cancelled actions emit no new annotation. A committed accepted no-op may identify the attempted skill but does not assert that its effect succeeded. Only the matching own ACK may label a hidden outcome as 空振り.

The browser accepts only the exact four-key annotation matching the current validated trace's event/version/actor and an implemented canonical ID in its existing generated registry. It uses that registry's display name for either participant. Unknown, malformed, stale, mismatched or absent metadata falls back to the previous generic title (or the matching own ACK), never to a guess. All text remains textContent, with no HTML interpretation. Old trace-only clients keep their generic cut-in because the trace itself is unchanged.

## Storage, compatibility and release boundary

The existing service-only commit RPC atomically stores the supplied public JSON together with the unchanged authoritative JSON, private projections, version and receipt. The existing snapshot-v2 returns that public JSON. No SQL schema/function change or new management flag is planned. This must be verified by tests of the actual Edge handler/commit boundary, not prose alone. A later projection of authoritative state alone is allowed to omit the ephemeral annotation; it must not reconstruct or replay old names from private state.

The server engine builder and generated Edge bundle change; the shared rule module and local bundle do not. Old/new server-state compatibility will be checked against the exact base engine, and old/new viewer combinations must keep generic or named output without changing action semantics. A retry uses the existing action receipt/version identity; no additional event ID, write or replay is introduced.

Preserve 1800ms, observed-result wording, ordinary-update lifetime, scope/version guards, locks/storage deduplication, priority interruption, reduced motion, input and focus behavior, and optional-module failure handling. No new images, quiz/gacha/economy operation or production trial is included.

A fixed new SHA/spec blob, complete changed-file inventory, executable local/Windows evidence and genuine Astra review are required before release. DB/managed changes are []; Edge has the generated standard-game-action bundle only (the unchanged index must still be paired and byte-checked at deployment). Local implementation is complete; executed results, the fixed SHA and later review/publication status belong to the existing governance evidence record, not a prediction in this specification.

## Executable acceptance and limits

`tests/standard-public-skill-event.test.cjs` runs the actual generated adapter and shared engine. Both actors, work/palette/accepted-no-op/recolor, all implemented catalog entries, alpha.1 through alpha.4, malformed/stale/unknown metadata and locked identity deduplication are covered. The added annotation is the only allowed public difference; authoritative state, RNG, effects, private output and input immutability remain identical.

`tests/standard-public-skill-persistence.test.cjs` executes the unchanged full TypeScript handler, real generated engine and existing application migrations through F3 in isolated PGlite0.5.8. Actual commit/snapshot-v2/replay SQL covers both human seats, an authored CPU-selected action, accepted no-op, real rule rejection, atomic profile-conflict rollback, and lost commit response followed by snapshot and duplicate receipt. CPU selection is explicitly a fixture; this does not prove stock policy selection, production authentication, multi-worker races or native Supabase operation. No production RPC is called. The volatile snapshot `server_time` is excluded only from rollback equality; all persisted authority/public/private/profile/receipt data remain asserted.

`scripts/check-standard-public-skill-compat.cjs --base=954e1c5c52d5453fc9fee9872b2d7e922f850a39` reads the exact fixed-base Git objects, not the candidate's expected output. It checks 16 actor/scenario/version cases and 64 old/new engine/viewer combinations, including alternating old/new workers after the new action. This is separate local compatibility evidence; CI's shallow checkout is not silently assumed to contain that base.

The two added UDL065 browser cases use the generated registry and actual UI at390/1280 for both participants. They check readable names, 1800ms animation, unchanged focus, pointer-transparent hit testing, normal coloring while the card is visible, stale/unknown fallback, deduplication and no extra action. All seven prior UDL065 cases stay in the Chrome/Edge gate. Physical devices and genuine production skill observations remain NOT_RUN unless separately evidenced.

## Publication and rollback sequence

1. Freeze the candidate, feature-spec blob and exact base above; require the same candidate's successful Windows Chrome and Edge gate plus genuine Astra approval. Re-fetch main and reconcile any advancement without reusing this candidate's approval for a changed SHA. Old CPU039 and UI040 approvals and their failed/consumed trial evidence remain separate.
2. Record the current production artifacts and deploy only the approved compatible generated Edge bundle paired with the unchanged approved index. Read back both complete deployed files and compare exact hashes/bytes. Preserve existing JWT, CPU managed flags, SQL, secrets and other functions. Failed or uncertain deployment/readback stops Pages promotion; do not infer success from an HTTP capability probe or toast alone.
3. The fixed-base compatibility evidence permits either old or new worker/viewer without changing game semantics. There is no new persisted policy/state format or activation flag, and no global worker-convergence claim. New names may remain generic on an old worker. No CPU-style activation timer is invented for this presentation-only annotation.
4. Force-free publish the same approved candidate to main/Pages and require the same-SHA successful Pages run, existing protected-RPC preflight and exact served index/app44/cutinJS2 bytes. CSS1 and all other previously published features remain unchanged. This is asset/deployment verification, not a production match acceptance result.
5. No production profile, match, action, purchase, rematch or cleanup is authorized by this document. A requested genuine-play test requires a separately explicit fixed-candidate review scope and locally tested finite harness; the already-consumed040 allowance cannot be reopened. Physical acceptance is separate.

If rollback is necessary, both the fixed-base viewer and engine remain compatible because authoritative state and the old trace are unchanged and old viewers ignore the optional field. Use only the recorded exact compatible artifacts through the existing runbook, preserve committed actions/receipts, and never rewrite game rows or substitute another candidate's approval. An independently discovered code defect requires a new fixed correction and review.
