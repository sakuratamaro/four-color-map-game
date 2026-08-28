import type { CellKey } from './types';

export function toCellKey(row: number, column: number): CellKey {
  return `${row},${column}`;
}

export function fromCellKey(key: CellKey): { row: number; column: number } {
  const [rowText, columnText] = key.split(',');
  const row = Number(rowText);
  const column = Number(columnText);
  if (!Number.isInteger(row) || !Number.isInteger(column)) {
    throw new Error(`Invalid cell key: ${key}`);
  }
  return { row, column };
}

export function orthogonalNeighborKeys(key: CellKey): CellKey[] {
  const { row, column } = fromCellKey(key);
  return [
    toCellKey(row - 1, column),
    toCellKey(row + 1, column),
    toCellKey(row, column - 1),
    toCellKey(row, column + 1),
  ];
}
