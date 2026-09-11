# Play-surface Windows follow-up

SUBJECT_SHA `32046255e88901ce03dc88c59f51e803529b9f63`

BASE_SHA `93c05c7c68576b28a126588d0716f0f56c015531` (6cd was never published)

CANON `shared-canon-v1.1`; SPEC `UDL-052-054-063-play-v1.1`; PATH `docs/UI_PLAY_SURFACE_20260912.md`; BLOB `977101c8f05d13836c060dedeb1b425a3c96fb16`; scope `Pages_only`; DB[]/Edge[].

[Four-file correction](https://github.com/sakuratamaro/four-color-map-game/compare/6cd12ae888f26c9403fb504596f92f4d9a65b301...32046255e88901ce03dc88c59f51e803529b9f63). [Whole candidate](https://github.com/sakuratamaro/four-color-map-game/compare/93c05c7c68576b28a126588d0716f0f56c015531...32046255e88901ce03dc88c59f51e803529b9f63).

Windows34642709902 failed both browsers113/117, four failures. This invalidates publication despite clean906/906 and local22/22. Earlier review target6cd remains historical and cannot authorize320. No main/Pages changed.

1. LAB borrowed-card keyboard cancellation used an old visible label. Preserve that label in extra/LAB cards rather than changing the old keyboard/action test. Normal six-card design is unchanged.
2. First-move test still asserted the old DOM sibling chain. Change only that selector to explicitly assert playSurface region/palette plus following action status, stable hand, setup/history/trace details. All geometry, one setup write, handoff, focus preservation and keyboard hit assertions remain.
3. Old normal390 board-width>300 guard found280px. Keep the guard. Reserve notice top/height from resolved computed CSS even while hidden, including safe-area inset, and compact mobile guide typography. The retained test confirms a board wider than300px, and the final image shows the complete board with all four color controls;280px remains only short-height fallback.
4. Both Windows CPU-commentary tests reported guide/zoom overlap while local reproduction could pass. Retain that test unchanged, add native guide/zoom scroll margin and compact guide dimensions. Notification content, once-only accounting, pointer transparency, no focus movement and stable-hitbox contract stay unchanged.

Final exact clean320: nonbrowser906/906 PASS,73.579s; Chrome26/26 PASS,291.571s. Local Edge25/26 (286.715s) failed only owned-browser close/kill cleanup after the first test body, not a product assertion; the exact isolated test then passed1/1 with normal close/server cleanup (4.343s). Do not relabel that initial failed suite as26/26. Precommit targeted6/6 also passed but is distinguished from clean evidence. Final revised390px board/hand images were separately viewed; no physical device run. No blanket process termination or user-browser closing was done.

[Windows34644395034](https://github.com/sakuratamaro/four-color-map-game/actions/runs/34644395034) runs the whole candidate320 on Chrome and Edge; both SUCCESS required. Public plan stays five exact asset byte comparisons before one opted-in test profile/owned CPU match, one explicit borrowed card, stable used-hand reload, normal owned surrender. Existing canary script stays on governance branch and takes the final candidate SHA explicitly. Initial6cd has no live run.

Original logical wait starts20:17:19Z, expires22:17:19Z, max3 checks at20/40/100 minutes, never reset by this correction. First immediate two transport readbacks were stale/active despite send API acceptance; no third immediate read or resend was done. New review must bind320/specv1.1/blob977101c8. Result060 work is isolated and not part of this approval.
