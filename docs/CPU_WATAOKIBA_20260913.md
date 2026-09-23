# UDL033 Wataokiba CPU artwork

Specification: `UDL-033-wataokiba-v1`

CANON_RECEIPT version=shared-canon-v1.1 base=87f12c0a2da3da3563824d22a2e3c1dc2c645c90 main_last_observed=70e691b6f8f1d808476e80990d20df7862bfb782 request=UDL-20260908-033 specs=docs/CPU_SUCCESSOR_PREPARATION_20260912.md,docs/CPU_ILLUSTRATION_INTAKE_20260911.json,docs/SHARED_CANON.md tests=tests/standard-cpu-portraits.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/cpu-wataokiba-20260913

Owner: existing commander01a07b56-616e-7733-9aae-90575659688e. This Pages-only slice is based on the approved surrender-face integration87, not yet published. It does not include the CPU-policy candidate8dd9 or bypass that candidate's denied push. Fresh exact-candidate review, Windows validation and current-main integration are required before this artwork's publication; no parent approval is reused.

## Contract

- Replace all ten stable CPU IDs with individually selected Wataokiba artwork, consistently across chooser, records, battle, skill cutin, surrender dialogue and terminal views. CPU policy, level, identity, name, history and economy sources remain unchanged in this image-only slice.
- Ordinary contexts use the normal face. A confirmed ordinary CPU loss uses its separate loss expression; the terminal overlay and persistent result show that same person's full body. A player loss, unconfirmed surrender, legal-recolor lab or PvP never reveals a CPU-loss full-body image. Loss reasons retain the existing five public terminal reasons.
- Use only public character ID and confirmed terminal display context, never private palettes/effects or hidden CPU state. Image loading cannot write any game action.
- Lazy-load only images actually selected for a rendered binding. Cache per-image success/failure, isolate one missing CPU image from other CPUs and prevent old load callbacks from changing a cleared/rebound view. Unknown IDs/module/image errors retain an explicit CPU fallback and safe surrender controls.
- Keep portraits decorative, retain accessible textual identity/dialogue, reduced-motion behavior and native keyboard controls. At390px and short landscape, cards and result controls remain reachable without horizontal overflow or clipped bodies.
- Provide a native credit dialog from Home/My Page, official site/terms links and focus return on close/Esc. Opening it causes no profile creation, storage change or game action.
- Ship only20 used original PNGs and provenance/NOTICE. CSS crops the face and contains the full body without editing image pixels. Author contact is the user's responsibility after publication under ARTWORK-USER-20260912-033; do not reopen the same historical permission hold.

## Design and remaining scope

The selected assets are author-labelled five female and five male designs. The local selection preview arranges them as the already-adopted target tiers: yuzu/ren, minato/koharu, aoi/kai, tsubasa/rei, shion/kurogane. This is an explicit new presentation assignment, not a claim that historical formal gender settings were verified. Runtime tiers and the five positive-epithet changes belong toUDL051 and are not silently changed in the portrait module.

Source identity and crop mapping are fixed in `standard-online-v5/assets/cpu-portraits/wataokiba/manifest.json`. Old recognizable cues are retained where available (Yuzu scarf, Aoi elf, Shion silver/blue, Kurogane Japanese outfit); hair, eyewear or age need not match the old generated artwork exactly. The author's vampire/snow-woman source labels are not new game-world lore.

Local verification, candidate SHA, review and publication evidence are separate. At this initial implementation receipt: product testsNOT_RUN, commitNOT_RUN, pushNOT_RUN, WindowsNOT_RUN, AstraNOT_SENT, main/PagesNOT_RUN; DB/Edge/managed changes[]; live attempts0. The selection preview's13PASS is not substituted for product acceptance.
