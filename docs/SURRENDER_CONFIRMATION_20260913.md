# Voluntary surrender confirmation and CPU dialogue
Version: UDL-067-surrender-v1.1

CANON_RECEIPT version=shared-canon-v1.1 base=2fcfea9bb2a3d1ad7e22a5e8e3b61983f0404152 public_base=9515f9bed9536dc2c44b71817129abb9c86ef24f request=UDL-20260912-067 specs=docs/SHARED_CANON.md@codex/dev-brain-current-20260910,docs/SURRENDER_CONFIRMATION_20260913.md tests=tests/standard-surrender-confirmation.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/surrender-confirmation-20260913

## Provenance and scope
Verified v13 archivec0da3f30fe4361eaed33bb5272d918ef5c0b16f7f125d73429c864a4b1dc6290: sources/USER_SCREENSHOT_UI_REFINEMENT_20260912.md and sources/USER_CPU_SURRENDER_DIALOGUE_20260912.md, docs/CPU_SURRENDER_DIALOGUE_HANDOFF.md. Actual user IDs bbb2137d-8aaa-4432-ab40-0938b5a4cde2 and bbb213cb-7d07-47a9-be57-a928abfe955e resolved by the v13 intake. The archive itself says these IDs were not captured there; do not overwrite that historical statement.

The later CPU dialogue requirement refines the same confirmation request; it does not reopen old automatic-loss rules or add confirmations to every skill. Two user example lines have no assigned character. Any assignment, shortening and pre-surrender tense adjustment below are AI design choices, not verbatim final user approval.

## Required behavior
Replace the long surrender labels with a short 投了 entry. In the COLOR response area remove the redundant 色操作カードを見る entry; the six direct skill cards remain accessible. A native confirmation dialog is required before an ordinary user's surrender. Title 投了しますか？; actions 対戦を続ける and 投了する. Safe cancel receives initial focus. No nested confirmation, delay, timer pause or automatic defeat.

CPU matches show the current CPU public name and one lightly teasing line in that character's existing voice, selected by immutable match CPU ID, not list position, appearance or unimplemented new CPU tiers. Lines are deterministic and fixed for the open dialog, without game RNG. Unknown CPU or human opponent uses concise generic text. No asserted rescue card, winning color, legal-color oracle or already-decided victory. No insult toward the player. No reward-only full-body art, image acquisition or roster-strength changes.

Open/cancel/Escape/close emit zero server operations. Explicit affirmative action uses the existing SURRENDER action exactly once and preserves its normal server CAS, pending identity and lost-response retry. Capture room ID, match ID, view/room version and viewer seat when opened; revalidate them and ACTIVE/playing, own turn, connected/nonbusy/no existing pending action immediately before confirmation. Polling/realtime room/version/seat change, terminal result, leaving battle or loss of actionable state cancels the stale confirmation without a write. New room action cannot inherit old approval. Optional presentation failure must fail closed rather than bypass the confirmation.

## Verification
Pure tests: complete ten known IDs, stable copy, human/unknown fallback, source-derived scope guards; malformed/stale/other-turn/terminal/busy/pending rejection. Real Chrome and Edge: both surrender entries, safe focus/Tab/Enter/Escape, cancelwrite0, explicitonewrite including doubleclick, terminal/room/seat/version change, same-snapshot rerender, lost-response exact retry, 390/768/1280 and readable text, CPU/public name correctness, no private data or early result. Existing blocked-COLOR voluntary-loss regression must adopt the explicit confirmation without weakening the no-auto-loss condition. Preserve six hand, rolepalette, cut-in and catalogue.

This worktree was prepared on the then-unpublished catalogue candidate. Parent2fc is now main/Pages34705612667; catalogue live acceptance remains partial because of a separately recorded harness screenshot filename failure. It is not a confirmed product regression or a new067publicationhold. Keep 065/flat UI/066 boundaries and failures intact; reconcile exact fresh main before fixing/reviewing a release SHA. Pages_only, DB[] and Edge[]. Exact Astra and Windows gates and bounded public acceptance are still required; implementation alone is not approval.

Cache contract: app20260913-42, surrender-confirmation.js/css20260913-1. Existing layout/classes are reused; a dialog-only cyan focus-visible outline keeps the safe initial choice legible on the dark background. All generated registry/local/Edge bundles unchanged. The pure guard includes room/view version equality as required by the current client snapshot contract. Fault tests distinguish network failure beforecommit from lostACK after one committed surrender with temporarily stale snapshot; both must reuse the exact action envelope once, not allocate a new surrender.

## Regression found by the Windows gate

REG-UDL048-ROOM-SYNC: existing private-room synchronization recreated unchanged quiz options during Level 5 memo use. Windows34708897042 Edge failed the original node-identity assertion; a deterministic local invalidation reproduced the path refreshRoom → render → renderQuiz → replaceChildren on unchanged231. This is a real existing UI regression, not an assertion to remove.

For the same session, answer index, question/options and lock/retry/hint state, retain the existing option nodes, positions and motion listeners across room refresh. Do not suppress room synchronization, quiz time, lock updates, ACK advancement, retry or handoff. Changed render inputs rebuild through the existing path. Regression coverage forces two real mock-room invalidations while memo is active and checks node/position preservation and zero answers; existing memo timeout, failed-answer/ACK, handoff and motion tests remain required.

This narrowly scoped regression repair changes app code and this specification. Review033 for231 is not reused for the revised SHA/specification. A new exact review and complete Windows gates are required; the former CI failures stay failed. Separately, genuine032 has since accepted066 from its preserved combined evidence; no new066 trial is requested.
