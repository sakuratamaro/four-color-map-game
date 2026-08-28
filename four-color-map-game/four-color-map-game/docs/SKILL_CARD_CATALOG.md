# Skill Card Catalog — Draft

This file contains current confirmed concepts. **Rarity and numeric strength are provisional and must not be treated as final balance.**

## Design principle

Prefer cards that change map/color/adjacency rules over generic numeric power boosts. Low rarity must remain strategically useful; high rarity means rarity/specialness, not strict superiority.

| Skill | Category | Timing | Core effect | Status |
|---|---|---|---|---|
| Area Expansion | Construction | Work | Increase max cells of next created Region | Confirmed concept |
| Palette Change | Color | Color | Replace part of own current palette; new color remains hidden | Confirmed concept |
| Region Recolor | Color/Map | Color | Change one already-colored Region; can rescue a forced loss | Confirmed concept |
| Region Split | Counter | Color | Split pending Region; color one child and return the other | Confirmed concept |
| Half-cell Grid Shift | Geometry | Work | Shift one row/column by ±0.5; first use locks axis for match | Confirmed concept |
| Playable Area Expansion | Space | Work | Enable more unused cells for future Region creation | Confirmed concept |
| Playable Area Reduction | Space | Work | Disable unused cells for future Region creation; never delete existing Regions | Confirmed concept |
| Corner Expansion | Geometry | Work | Visually bulge corners so diagonal contact becomes real adjacency | Confirmed concept |

## Same-color interaction

Current preferred rule: when a skill causes two same-color Regions to become edge-adjacent, they merge into one Region.

## Future card-design slots

Do not implement these yet. They are categories to discuss later.

- Counter cards
- Geometry manipulation
- Information manipulation
- Palette manipulation
- Region topology manipulation
- Playable-space manipulation

Avoid adding cards that merely duplicate a stronger version of an existing card without a new strategic trade-off.
