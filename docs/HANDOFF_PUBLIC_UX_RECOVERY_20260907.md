# Public UX recovery handoff — 2026-09-07

## Mission

Restore the Four Color Map Standard Online experience to the latest user-approved intent. The current public build is `main@5d6d794` with Pages run `34066040550`, `app.js?v=20260907-42`, and `style.css?v=20260907-40`. Do not treat a previously `PUBLIC_VERIFIED` implementation as current intent when a later user decision supersedes it.

This document is the project handoff ledger, not a seven-item task brief. The seven numbered findings below are only the current `P0-public-regression` queue. Completion of those seven findings does not complete this handoff or the project. Maintain the earlier explicit decisions, supersessions, already-implemented directions, held work, and governance sections as a separate master backlog with status and evidence for every item.

Work from current `origin/main` in an isolated worktree. Inventory other dirty worktrees, preserve their changes, and do not merge the held portrait/feedback candidate blindly. Release only after Chrome and Edge product tests, the official gate, force-free main integration, Pages success, and public visual/behavioral verification.

## Current user priority order — 2026-09-07 latest decision

Prioritize changes by direct game-experience value, in this order:

1. Show the bonus-color remaining-use count on the color action button.
2. Make `areaCornerBloom` / 「角膨張」 actually usable. This is distinct from `areaMicroBloom` / 「ひとふくらみ」; investigate both, but the latest named priority is Corner Bloom.
3. Show registry-authoritative skill-card rarity in the skill-use and target-selection UI.
4. Make the quiz difficulty follow the approved balance direction: preserve hard Level 5 while giving it more answer time, strengthen Levels 3 and 4, and keep memo/calculator support optional. Do not invent an unapproved exact time value.
5. Integrate the CPU defeat illustrations. The portrait product work is no longer HOLD, but unrelated IndexedDB feedback edits in the same candidate worktree remain HOLD and must not be mixed.
6. Replace inner-label drift with physical movement and collision of the quiz answer buttons inside the larger arena.

Minor responsive/layout cleanup, including the intermediate-width lobby breakage, is lower priority even if it appears quick. Contact-feedback and sealed-color regressions remain tracked, but this latest order supersedes the earlier ordering of the seven urgent findings. Do not promise that all work will finish within three hours; publish safe, verified slices in this order.

## P0 public regression queue (seven urgent findings, not the full backlog)

These are explicit current user reports and acceptance requirements.

1. Contact-count feedback is shown for the opponent's action.
   - Public code `observeCommittedContact` presents every new public `CREATE_REGION` trace with contact count >= 2, without actor/seat filtering.
   - Required behavior: show feedback immediately while the local player selects cells; only the selecting player sees it; do not wait for required-size completion, submit, server commit, poll, reload, or opponent replay; a 2-to-3 transition layers the next stage.
   - Separate local draft presentation from authoritative committed trace/history.

2. Bonus-color remaining uses are absent from the actual color button.
   - Public UI shows `bonusUsesRemaining` in the random-result summary, but `paletteControls` buttons contain only the color label.
   - Required behavior: the bonus-color action button itself clearly shows `残りN回`.
   - Correctly handle a bonus color duplicated by a basic slot, zero uses, temporary colors, prism, palette corruption/replacement, and refill.

3. A sealed color disappears instead of remaining visible with a lock.
   - Source code contains an `is-sealed` disabled button and `🔒`, so reproduce the real public path rather than assuming the static marker proves the feature.
   - Inspect private projection, zero-use bonus colors, temporary colors, palette replacement, and seal duration.
   - Required behavior: every still-owned sealed color stays visible as a disabled button with a clear lock and remaining seal duration when that duration is public to the affected player. Never expose the opponent's private palette.

4. Quiz option buttons still do not move and collide.
   - Public code fixes the button rectangles in a grid and moves only `span.quiz-option-float` by about 2–3 px. This is the opposite of the user's latest decision.
   - History: `87604e6` moved buttons without collision; `1704c5a` replaced moving click targets with glow; `dca8765` formalized fixed hitboxes plus label drift.
   - Correct reference: repository `index.html` and `reference/v4.9/four-color-map-game-browser-v4-9-modes-economy.html`, whose `.number-arena`, `.number-orb`, `createOrbs`, and `animateQuiz` implement whole-button wall reflection and pair collisions.
   - Required behavior: large whole buttons move inside one arena and visibly collide. Keep bounds and non-overlap, freeze the whole arena immediately on pointer/touch/hover/focus, keep it stopped through answer feedback, preserve DOM-order keyboard operation, stop for hidden/background/handoff/hint/pending answer/reduced motion, and repack on resize. Preserve exactly-once server scoring and reward settlement.

5. Skill-use UI lacks rarity.
   - User reference: `C:\Users\user\AppData\Local\Temp\codex-clipboard-2f0017ae-6043-43cc-8cae-46ecdddb3f59.png`.
   - Required behavior: show registry-authoritative star rarity alongside each skill in the six-card list and target-selection panel. Do not infer from inventory count or leak private data.

6. Lobby layout remains broken.
   - User reference: `C:\Users\user\AppData\Local\Temp\codex-clipboard-3735a23c-94e6-44f4-8d35-9757c44a30dd.png`.
   - At an intermediate desktop width, friend/public-match cards squeeze into overlapping and vertical text; buttons and input collide.
   - Required behavior: responsive cards with no text overlap or horizontal overflow at 390 px, the reported intermediate width, and wide desktop; all controls at least 44 px; no clipped labels.

7. `areaMicroBloom` / 「ひとふくらみ」 still errors and cannot be used.
   - Reproduce the exact error through the public-equivalent UI and authoritative engine/Edge path.
   - Verify target selection and payload shape, partial macro legality, bounds, turn/phase, card consumption, and interactions with alpha.4 board targeting.
   - A legal use must work. An illegal use must be write-free, consume no card, and show actionable Japanese feedback.

## Earlier explicit user decisions that must be retained

### User-approved or user-explicit

- Build a small Japanese discovery/introduction entry for search, social sharing, and referrals: Japanese title/description, short rules, current screenshots, a CPU CTA, friend-match guidance, OGP, and Search Console verification. External posting, advertising, and large SEO work require separate approval.
- Make the board the visual focus: remove the pink board/cell/multiple-frame noise; reduce persistent explanatory text, oversized random-result blocks, and duplicate surrender routes.
- At zero selected cells, guide the first legal candidate. Keep connected-selection guidance after the first choice.
- Put bonus-color remaining uses inside the color button.
- Tell the affected player immediately when forced palette replacement or palette contamination occurs.
- Keep the improved Level 5 difficulty and lengthen its time. Make Levels 3 and 4 substantially harder because the former Level 4 felt like Level 2. A memo area and mini calculator are optional backlog items, not yet required.
- Fix curse-backlash avoidance: using a seal after coloring must not erase the backlash. Reserve it for the user's next coloring after an opponent turn regardless of skill-use timing.
- Raise the rarity and actual acquisition difficulty of color-seal cards, with a consistent upward shift for existing rarity-3-or-higher seal cards. Preserve existing owned cards.
- Consider a weaker rarity-2 seal card, but the specific proposed `色封じ・二択` effect has not been user-approved.
- When a CPU is defeated, show its character-specific disappointed presentation and a large full-body illustration as a reward every win; once per terminal result; never in PvP; image failure must not block settlement; do not silently expand this into a collection encyclopedia.
- For integrated licensed character art, web delivery and GitHub management of only the processed 256×256 WebP assets is accepted and is not treated as prohibited redistribution. Keep NOTICE, manifest, and in-game credit; do not commit source PNG/ZIP or unused assets; no additional author contact is required.
- Skill use/target-selection UI must show rarity.

### Explicit supersessions

- Supersede the earlier `PUBLIC_VERIFIED` contract that contact feedback appears only after committed `CREATE_REGION`. The latest requirement is local selection-time feedback for the acting player only.
- Supersede the earlier `PUBLIC_VERIFIED` fixed quiz hitbox plus floating inner label. The latest requirement is whole-button movement and collision inside the large arena.
- Supersede the older optional author-contact TODO. Latest decision: no additional contact is required under the accepted processed-asset policy.

### ChatGPT proposals still requiring user approval

- Exact Level 5 time value such as 120 seconds.
- The exact mechanics/name of a new weak rarity-2 seal card.
- Any expansion of CPU portrait rewards into a gallery/encyclopedia.
- External promotion, ad spend, or broad SEO campaigns.

## Already implemented directions to preserve unless a newer decision conflicts

- Five-tab top-level navigation.
- Anonymous-first play and the separate Phase 0 audit for optional Google linking.
- No automatic defeat merely because ordinary legal colors are zero when a rescue response may exist.
- One card per skill category window where specified.
- SVG geometry and visible horizontal-scroll affordance for long math.
- Kurogane CPU improvements.
- Corner-bloom card -> cell -> immediate activation flow.
- Palette-contamination no-op does not consume the card and cannot be retried to fish for a different random result.
- CPU reward -> gacha -> six-card reconfiguration loop.
- Quiz correct/incorrect feedback and one-line solution.
- Existing active-room recovery, waiting-opponent availability, public/private projections, exactly-once actions, and settlement boundaries.

## Held work that must remain isolated

- Branch/worktree `codex/standard-cpu-portraits-p1-20260907` contains licensed CPU portrait integration plus an unfinished IndexedDB rewrite for cross-tab basic-feedback claims. The portrait product commits are approved for content audit and selective adoption; the unrelated IndexedDB rewrite remains HOLD and must not hitchhike.
- The IndexedDB work found and fixed two genuine issues (stale localStorage ring reinjection and unsafe no-IDB Web Locks fallback), but its docs/release review is incomplete and it must not hitchhike into this UX recovery.
- Another task has dirty root-worktree changes around bonus refill/hard CPU and one browser-test scrolling adjustment. Inventory and preserve; do not overwrite or merge without independent review.

## Governance and release checklist

1. Update `docs/PROJECT_COMMAND_CENTER.md` User Decision Ledger before calling superseded behavior complete.
2. Record each of the seven urgent items as an independently testable row with owner, state, and evidence.
3. Diagnose first; preserve the failing public behavior in regression tests.
4. Keep private hand, palette, user, room, action, and profile identifiers out of public traces and presentation logs.
5. Run syntax, focused unit/static, actual Chrome and Edge at 390 px/intermediate/wide sizes, and the official full contract gate with zero skips for the touched product paths.
6. Use force-free pushes only. Do not change Supabase SQL/Edge unless `areaMicroBloom` proves that the deployed authoritative path requires it; if so, verify source/bundle parity and read back the deployment.
7. After main and Pages succeed, verify public asset generations, no console warnings/errors, no horizontal overflow, the seven repaired behaviors, and candidate preflight.
8. Physical two-device acceptance remains `PENDING`; automation must not claim it passed.

## Delivery cadence

Do not leave verified improvements sitting locally for a long batch. Keep the current HOLD while a reported regression is still unexplained, but once an independent repair slice passes its focused tests and release audit, finish that slice through commit, force-free main integration, Pages, and public-URL verification. Prefer several small, user-verifiable releases over one large mixed release. After each slice, record the public commit, workflow run, Pages run, asset generation, and remaining HOLD items.
