# Standard mode skill matrix

Source: verified v4.9 `SKILLS`, `SKILL_POOL_BY_CATEGORY_RARITY`, `QUICK_LOANED_SKILLS`, action handlers, gacha, and loadout code in `index.html`. The flags deliberately distinguish catalog membership, mode enablement, per-match loadout, engine implementation, alpha UI exposure, gacha availability, and experimental status.

## Counts and loadout rules

- Catalogued v4.9 skills: 19.
- Modular registry entries: 20 total (the 19 v4.9 cards plus the separately identified experimental `legalRecolor`).
- v4.9 standard-enabled skills: all 19 catalogued skills.
- v4.9 quick-mode loaned skills: exactly 3 (`colorPrism`, `areaHalfShift`, `disruptChoiceOne`). They are loaned, not owned or consumed.
- Standard loadout: two distinct selected cards from each of color, area, and disruption; six total. Six is a per-match loadout size, not a skill-pool size.
- Accepted v4.9 handlers in the new standard engine/UI: all 19 canonical cards.
- Experimental handler outside the 19-card catalog: 1 (`legalRecolor`).
- Remaining existing v4.9 cards to close: 0. The experimental loan remains outside the 19-card catalog.
- A match copy is created only when profile inventory was positive at match start. Standard mode decrements inventory only at the verified successful effect boundary.
- Wrong phase, absent inventory, active target/split flow, cancelled modal, and rejected precondition do not consume.
- Human-facing color legality is never previewed by skill UI.

| Column | Meaning |
|---|---|
| `catalogued` | A catalog definition exists. |
| `v49StandardEnabled` | Available in the v4.9 standard-mode pool. |
| `quickLoaned` | Loaned by v4.9 quick mode. |
| `standardEngineImplemented` | Runs in the new modular standard engine. |
| `alphaUiEnabled` | Selectable in the standard alpha UI contract. |
| `gachaEnabled` | Eligible for the ordinary gacha pool. |
| `experimental` | Balance approval is pending. |
| `timing` | Engine timing boundary. |
| `consumeOnSuccessOnly` | Rejected/cancelled/no-candidate paths consume zero. |
| `privateInformation` | Effect reads or changes non-public per-seat information. |

## Skill matrix

| Key | Card | Category | Rarity | catalogued | v49StandardEnabled | quickLoaned | standardEngineImplemented | alphaUiEnabled | gachaEnabled | experimental | timing | consumeOnSuccessOnly | privateInformation |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| `colorRandomBorrow` | 色拾い・乱 | color | ★1 | true | true | false | true | true | true | false | COLOR | true | true |
| `colorChoiceBorrow` | 色借り | color | ★2 | true | true | false | true | true | true | false | COLOR | true | true |
| `colorPrism` | 四色解放 | color | ★3 | true | true | true | true | true | true | false | COLOR | true | false |
| `colorRegionSplit` | エリア二分 | color | ★4 | true | true | false | true | true | true | false | COLOR | true | false |
| `colorPaletteChange` | 持ち色変更 | color | ★5 | true | true | false | true | true | true | false | COLOR | true | true |
| `areaMicroBloom` | ひとふくらみ | area | ★1 | true | true | false | true | true | true | false | WORK | true | false |
| `areaDiePlus` | エリア拡張 | area | ★2 | true | true | false | true | true | true | false | WORK | true | false |
| `areaResize` | 拡大縮小 | area | ★3 | true | true | false | true | true | true | false | WORK | true | false |
| `areaCornerBloom` | 角膨張 | area | ★4 | true | true | false | true | true | true | false | WORK | true | false |
| `areaHalfShift` | 半マスシフト | area | ★4 | true | true | true | true | true | true | false | WORK | true | false |
| `areaTripleShift` | 三層断層 | area | ★5 | true | true | false | true | true | true | false | WORK | true | false |
| `disruptRandomOne` | 色封じ・乱 | disrupt | ★1 | true | true | false | true | true | true | false | WORK | true | false |
| `disruptChoiceOne` | 色封じ | disrupt | ★2 | true | true | true | true | true | true | false | WORK | true | false |
| `disruptRandomTwo` | 二重封じ・乱 | disrupt | ★3 | true | true | false | true | true | true | false | WORK | true | false |
| `disruptPaletteRandom` | 持ち色汚染・乱 | disrupt | ★3 | true | true | false | true | true | true | false | WORK | true | true |
| `disruptChoiceTwo` | 追封 | disrupt | ★4 | true | true | false | true | true | true | false | WORK | true | false |
| `disruptPaletteChoice` | 持ち色汚染 | disrupt | ★4 | true | true | false | true | true | true | false | WORK | true | true |
| `disruptChoiceThree` | 長封 | disrupt | ★5 | true | true | false | true | true | true | false | WORK | true | false |
| `disruptForcedPalette` | 強制持ち替え | disrupt | ★5 | true | true | false | true | true | true | false | WORK | true | true |
| `legalRecolor` | サーバー抽選による合法リカラー | experimental | ★3 proposed | true | false | false | true | true | false | true | WORK | true | false |

`consumeOnSuccessOnly=true` means rule rejection, cancellation, and a declared no-candidate outcome do not consume. Some valid v4.9 random effects can still be tactically useless after resolution; those are successful activations and retain the verified v4.9 consumption rule.

`legalRecolor` is explicitly **experimental** and **not in ordinary gacha**. Its alpha UI may expose it only as an experimental test card. This does not change the 19-card v4.9 catalog or the six-card standard loadout rule.

## Explicitly not implemented

| Candidate | Status | Reason |
|---|---|---|
| Targeted blanking / 風化 | `implemented: false` | Pending restoration, merged-region meaning, hidden-color oracle, failure leakage, tempo, and forced-loss questions remain unresolved. |
| Random blanking | `implemented: false` | Depends on the same blank-state and tempo contract. |
| Color swap | `implemented: false` | Requires two-target atomic legality and merge semantics. |
| Delayed recolor | `implemented: false` | Requires deterministic delayed-event ownership and cancellation rules. |
| Chain rotation | `implemented: false` | Requires multi-region atomic validation and merge behavior. |
| `colorRegionSplitKeep` / エリア二分・保持（仮） | `implemented: false` | User-requested counterpart to エリア二分: after splitting the received region, the user colors both components instead of returning one. Timing, second-color choice, and action economy need a small balance decision before it enters the 19-card pool. |

## Test obligations before implementation is accepted

- every v4.9 catalog row is machine-extracted or contract-checked;
- no duplicate loadout card within a category;
- success consumes exactly once; cancel/reject/no-candidate consumes zero;
- legal recolor candidate set uses public board only;
- zero-candidate action changes no state, version, turn, card, or RNG snapshot;
- successful legal recolor creates zero same-color adjacent edges and performs zero merges;
- numeric-minimum region ID merge remains the deterministic common rule after geometry-changing effects;
- interference chaining is blocked for exactly one WORK cycle;
- standard save key/schema never reads or writes the solo RC1 or v4.9 key.
