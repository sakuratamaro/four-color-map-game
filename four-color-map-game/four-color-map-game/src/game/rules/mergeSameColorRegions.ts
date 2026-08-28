import type { MatchState, RegionId } from '../domain/types';
import { getAdjacentRegionIds } from './adjacency';

export function getSameColorMergeGroups(state: MatchState): RegionId[][] {
  const remaining = new Set(Object.keys(state.regions));
  const groups: RegionId[][] = [];

  while (remaining.size > 0) {
    const start = remaining.values().next().value as RegionId | undefined;
    if (!start) break;
    remaining.delete(start);
    const startColor = state.regions[start]?.color;
    if (!startColor) continue;

    const group: RegionId[] = [start];
    const queue: RegionId[] = [start];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      for (const neighbor of getAdjacentRegionIds(state, current)) {
        if (!remaining.has(neighbor)) continue;
        if (state.regions[neighbor]?.color === startColor) {
          remaining.delete(neighbor);
          group.push(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (group.length > 1) groups.push(group);
  }

  return groups;
}
