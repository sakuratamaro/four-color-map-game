# UI follow-up release: palette origin and reward-gacha exit

Version: `UDL-052-060-followup-v1`

CANON_RECEIPT version=shared-canon-v1.1 base=98d23900f1b8cac25f73740dfe8ae31674268cb9 request=UDL-20260910-052,UDL-20260909-035,UDL-20260912-060 specs=docs/UI_PLAY_SURFACE_20260912.md,docs/UI_FOLLOWUP_RELEASE_20260915.md tests=tests/standard-palette-origin-rim.test.cjs,tests/standard-play-surface-model.test.cjs,tests/standard-gacha-lobby.test.cjs,tests/standard-online-browser.test.cjs

## Adopted requirements and exact boundary

This is the next two adopted v13 UI follow-ups, reconstructed on the already-public source candidate98d, not a claim that98d is published to main/Pages. The existing commander retains the original user provenance, source slices and review records. ADD-20260912-PALETTE-ORIGINAL-RIM-NO-DROPDOWN belongs to UDL052/035; the post-draw lobby continuation belongs to ADD-20260912-TERMINAL-HIERARCHY-THREE-ACTIONS / UDL060. This release does not claim completion of the separate broader terminal hierarchy.

Preserve all four98d UI slices: current palette-cause lifetime, neutral free-cell candidates, one short guide without custom zoom/duplicate settings, and compact stable3x2 hand with independent information buttons. This follow-up replaces the former extra-color selector and emoji-only unavailability presentation, and the reward-gacha direct-rematch shortcut. Prior specification and test evidence remain history, not approval of this changed candidate.

DB/Edge/managed settings are each `[]`; new image bytes0. No engine, online client, CPU, progression, registry, migration, API, portrait or secret changes. Preserve the currently compatible Edge without redeployment/downgrade. No cumulative unpublished CPU/Home/Profile/terminal code or private governance/review history is included in this source branch.

## Palette acceptance

- Keep basic1/basic2/bonus/remaining as four stable roles; do not merge same-color resources.
- Only valid own privateEffects.paletteDebuffs entries with slot, previousColor, injectedColor and remaining1..2 matching the current basic slot produce an original-color rim around the current-color fill. Reject stale, invalid, duplicate-slot and mismatched entries. Never infer an old color from initial palettes, notices or public history; permanent changes keep ordinary current-color fill.
- Use a static soft boundary, with no new animation. Keep infinity/counts, readable current/original color names and lifetime in accessible names/title. Unavailable is the font glyph×; sealing is a CSS line-drawn lock, not an emoji-dependent color.
- Only actually available temporary colors not represented by a usable basic/bonus resource become direct44px-or-larger buttons inside the fourth role. Multiple grants stack there; no dropdown or hidden menu. With no usable grant, show one unavailable control rather than listing unowned colors.
- Preserve original color consumption order and the exact existing COLOR_REGION {color} path. No extra sends from rendering, no slot-based consumption, legal-answer inference or opponent private-state inspection. Keep seal, turn, target and busy guards. An explicit failed-action retry uses its existing actionId; choosing another color after failure remains a new explicit operation, not an added blanket pending-action block.
- Exhaustively compare6144 availability projections with existing availableColorChoices. Cover polluted and duplicate resources, sealed colors, torn/coherent polls, notice lifetime, keyboard/double activation, narrow/landscape/enlarged text, real44px hit regions and normal board visibility. CSS scale is not physical-device acceptance.

## Gacha-exit acceptance

- After a completed saved CPU-reward draw, use one explicit 結果を閉じてロビーへ button and a short note that opponent/six cards are chosen in the lobby. Close only the client finished-room reference through the existing handler and focus the lobby. Do not delete server history or alter tickets, inventory, profile, settlement, rematch or match start.
- If a persisted same-version rematch request is unresolved, display 前回の申請を確認する画面へ and focus the existing result recovery button. Navigation submits zero writes and preserves roomId/actionId/version. Only a later explicit recovery activation resubmits that same identity.
- Require a matching current finished CPU room/version/matchId and saved completion origin. Preserve laboratory/stale/newer-room rejection and saved result restoration after reload. Busy/pending draws retain their original level/count/actionId and recovery route; the new action cannot discard them even via programmatic activation.
- Rematch busy, unsynced/profile syncing and matched-room handoff prevent the action. Ordinary gacha, rewards, odds, result cards, announcements and existing non-gacha result actions remain unchanged.
- Verify real handler unit guards plus native browser pointer/keyboard, reload, same-ID recovery and zero-write navigation at320x740,390x844,844x390 and enlarged text. Retain all original result/gacha and protected input assertions. The test mock must preserve unresolved finished-CPU request storage across reload just as the real client does.

## Exact review and bounded publication

Candidate branch: `codex/ui-followup-release-20260915`; dependency/base: `98d23900f1b8cac25f73740dfe8ae31674268cb9`. Fixed subject SHA, this spec blob and play-v1.6 blob must be captured after commit. Own Windows Chrome/Edge gate and a new genuine Astra decision are mandatory. Prior053/98d review is parent evidence only; it does not approve this follow-up.

Use the existing Windows workflow and both45-minute jobs with unchanged assertions, permissions and tool pins. No new scheduler/controller. Any observation window must be attached to this new exact candidate/run: at most3 observations around5/20/50minutes,60-minute deadline, with no reset on resend, retry, SHA change or automatic continuation. A materially changed candidate needs an explicitly recorded new logical request, not recycled approval or a reopened expired wait.

Do not merge to main until parent98d is genuinely published and its release gate is satisfied. Then verify fresh main equals98d, own exact candidate review/gate and unchanged protected bytes; integrate without force, wait for same-SHA Pages through an eligible finite procedure, and verify changed assets byte-for-byte. A changed main or scope returns to reconciliation/review. The existing stuck Pages operation is not retried, cancelled, toggled or bypassed by this document.

Current assets: `app.js?v=20260915-8`, `style.css?v=20260915-8`, `play-surface.css?v=20260915-5`, imported `play-surface-model.js?v=20260915-1`, plus index.html. Other generations stay at the public parent values. Freeze98d app/style5, playCSS3 and model20260912-1 only as historical parent references.

Proposed post-publication verification scope, NOT an executed or self-approved budget:5 exact changed-asset GETs including HTML/model, then one existing preflight of10 GETs and8 unauthenticated negative POSTs. Bind approval to the fixed candidate/spec and DB/Edge/settings[]; reserve once only after actual same-SHA Pages. No authenticated profile/draw/match, DB writes or automatic reuse of earlier live trials. Extra/live failure recovery requires separately scoped authority. Preserve PUBLIC_VERIFIED, local mocked browser evidence and PHYSICAL_NOT_RUN as distinct states.

## Evidence map

| Requirement | Executable evidence | Remaining gate at preparation |
|---|---|---|
| UDL052/035 original rim, no dropdown | standard-palette-origin-rim, standard-play-surface-model, native palette browser cases | own Windows; new exact review; public bytes |
| UDL060 reward-gacha lobby and pending identity | standard-gacha-lobby; native gacha/reload/recovery cases | own Windows; new exact review; public bytes |
| Preserve parent four UI slices | palette-notice-lifecycle, board-affordance, half-shift parity, turn-guide-diet, hand-compact and full existing browser suite | own candidate rerun |

Readme/spec text is not an implemented automated test. Failed baseline, intermediate failures, actual test counts, protected manifests, fixed Git bytes, real CI logs and genuine review outcome belong to the existing commander evidence. No public or physical success is inferred from preparation.
