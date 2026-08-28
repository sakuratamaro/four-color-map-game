import { orthogonalNeighborKeys } from '../domain/cellKey';
import type { ColorId, MatchState, RegionId } from '../domain/types';

export function getAdjacentRegionIds(state: MatchState, regionId: RegionId): RegionId[] {
  const region = state.regions[regionId];
  if (!region) throw new Error(`Unknown region: ${regionId}`);

  const adjacent = new Set<RegionId>();
  for (const cellKey of region.cellKeys) {
    for (const neighborKey of orthogonalNeighborKeys(cellKey)) {
      const neighborRegionId = state.cells[neighborKey]?.regionId;
      if (neighborRegionId && neighborRegionId !== regionId) adjacent.add(neighborRegionId);
    }
  }
  return [...adjacent];
}

export function getAdjacentColors(state: MatchState, regionId: RegionId): ColorId[] {
  const colors = new Set<ColorId>();
  for (const neighborId of getAdjacentRegionIds(state, regionId)) {
    const color = state.regions[neighborId]?.color;
    if (color) colors.add(color);
  }
  return [...colors];
}
