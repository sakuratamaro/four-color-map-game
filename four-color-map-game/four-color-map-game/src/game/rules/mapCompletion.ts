import type { MatchState } from '../domain/types';
import { validateNewRegion } from './regionValidation';

// Brute-force MVP check for 1-cell legal creation. If at least one unused playable
// cell can legally form a Region, map completion has not occurred. Larger Regions
// cannot be legal when no legal 1-cell starting point exists under the current base rules.
export function canCreateAnyRegion(state: MatchState, maxCells: number): boolean {
  for (const key of Object.keys(state.cells)) {
    const result = validateNewRegion(state, [key], { maxCells, isFirstRegion: false });
    if (result.valid) return true;
  }
  return false;
}
