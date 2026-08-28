import { orthogonalNeighborKeys } from '../domain/cellKey';
import type { CellKey } from '../domain/types';

export function isOrthogonallyConnected(cellKeys: readonly CellKey[]): boolean {
  if (cellKeys.length === 0) return false;
  const target = new Set(cellKeys);
  const first = cellKeys[0];
  if (!first) return false;

  const visited = new Set<CellKey>([first]);
  const queue: CellKey[] = [first];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const neighbor of orthogonalNeighborKeys(current)) {
      if (target.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === target.size;
}
