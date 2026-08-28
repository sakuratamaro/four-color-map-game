import type { CellKey } from '../domain/types';
import { isOrthogonallyConnected } from './connectivity';

export function validateTwoWaySplit(
  original: readonly CellKey[],
  childA: readonly CellKey[],
  childB: readonly CellKey[],
): boolean {
  if (childA.length === 0 || childB.length === 0) return false;
  if (!isOrthogonallyConnected(childA) || !isOrthogonallyConnected(childB)) return false;

  const originalSet = new Set(original);
  const union = new Set([...childA, ...childB]);
  if (union.size !== originalSet.size) return false;
  if ([...union].some((key) => !originalSet.has(key))) return false;
  if (childA.some((key) => childB.includes(key))) return false;
  return true;
}
