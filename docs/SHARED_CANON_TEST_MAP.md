# Shared canon test map

Canon version: `shared-canon-v1`

Baseline: `origin/main@2f855ccfef11d7c099cfb73fb57ec3da79be8789`

This is a traceability map. The executable files and named cases below are the tests; this prose is not test evidence by itself.

| Request | Executable test and case | Current evidence |
|---|---|---|
| `REQ-20260906-001` / `UDL-20260906-006` | `tests/standard-no-color-rescue.test.cjs` — `a blocked palette with colorPrism in hand remains active until the player acts` | Existing public evidence; not rerun by the migration unless listed in its result |
| `REQ-20260907-002` / `UDL-20260909-040` | `tests/standard-online-contact-feedback.test.cjs` — `online Standard presents each newly crossed two, three, and four-color contact tier` and local-only case | Existing public evidence |
| `REQ-20260906-008` / `UDL-20260908-029` | `tests/standard-area-corner-bloom.test.cjs` plus candidate-branch normal-cell browser contracts | Candidate `98bad1d`; Windows `34447976952` passed; not merged by this migration |
| `REQ-20260906-009` / `UDL-20260906-012` | `tests/standard-skill-dispatcher.test.cjs`, Edge/category canaries in release evidence | Existing public evidence |
| `REQ-20260907-013` / `UDL-20260908-030` | `tests/standard-cpu-commentary.test.cjs` — `terminal dialogue and narration are separate for both CPU wins and losses` | Windows gate and Pages passed; public Chrome visual check pending |
| `REQ-20260908-014` / `UDL-20260908-031` | `tests/standard-cpu-portraits.test.cjs` — exact ten-character roster and presentation-only integration cases | Windows gate and Pages passed; public Chrome visual check pending |
| `REQ-20260906-017` / latest motion UDL | `tests/standard-online-quiz-polish.test.cjs` — `question choices use one whole-button physics arena with safe pause contracts` | Existing public evidence |
| `REQ-20260905-020`–`024` | `tests/standard-online-quiz-polish.test.cjs` — word problem, diagram, structured math, progress, and feedback cases | Per-row evidence remains in UDL/release evidence |

## Representative migration check

`tests/governance-shared-canon.test.cjs` is the only new executable test in this migration. It proves that:

- the entrypoint routes to existing canonical files;
- the imported 28 REQ aliases are unique and retain separate intent/implementation/verification/release fields;
- the representative corner-bloom alias maps to `UDL-20260908-029`, existing tests, candidate `98bad1d`, and `not_merged`;
- review records cannot omit subject SHA, canon version, scope, decision, or source.

It does not claim that all 28 gameplay requirements were rerun. That broader verification remains finite work attached to each future slice.

Migration candidate result: the five governance contracts plus the existing no-auto-loss, contact-feedback, and corner-bloom representative files passed `15/15` locally on 2026-09-10. No browser, live service, DB, Edge, Pages, or physical-device check was run for this documentation migration.

## First live intake through the shared canon

The user-delivered `kurogane-audit-20260910.zip` is recorded as `REQ-CPU-20260910-KUROGANE-STRENGTH` → `UDL-20260910-051`. Its ZIP SHA-256 and source ChatGPT thread/message are preserved. The reported two scorer violations remain proposal evidence; the migration independently confirmed only that the referenced `standard/standard-cpu-roster.js` git blob is `68847421ad2589cb0edcce8c1021fa75a2add884`. No probe, match audit, game fix, or production operation is claimed here.
