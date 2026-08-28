import type { CellKey, MatchState } from '../domain/types';
import { orthogonalNeighborKeys } from '../domain/cellKey';
import { isOrthogonallyConnected } from './connectivity';

export interface RegionValidationOptions {
  maxCells: number;
  isFirstRegion: boolean;
}

export function validateNewRegion(
  state: MatchState,
  selectedCellKeys: readonly CellKey[],
  options: RegionValidationOptions,
): { valid: true } | { valid: false; reason: string } {
  const unique = [...new Set(selectedCellKeys)];
  if (unique.length === 0) return { valid: false, reason: 'EMPTY_SELECTION' };
  if (unique.length !== selectedCellKeys.length) return { valid: false, reason: 'DUPLICATE_CELL' };
  if (unique.length > options.maxCells) return { valid: false, reason: 'TOO_MANY_CELLS' };

  for (const key of unique) {
    const cell = state.cells[key];
    if (!cell) return { valid: false, reason: 'OUT_OF_BOARD' };
    if (cell.regionId !== null) return { valid: false, reason: 'CELL_ALREADY_USED' };
    if (!cell.canCreateRegion) return { valid: false, reason: 'CELL_NOT_PLAYABLE' };
  }

  if (!isOrthogonallyConnected(unique)) return { valid: false, reason: 'NOT_CONNECTED' };

  if (!options.isFirstRegion) {
    const touchesExisting = unique.some((key) =>
      orthogonalNeighborKeys(key).some((neighborKey) => state.cells[neighborKey]?.regionId != null),
    );
    if (!touchesExisting) return { valid: false, reason: 'NOT_ADJACENT_TO_EXISTING_REGION' };
  }

  return { valid: true };
}
