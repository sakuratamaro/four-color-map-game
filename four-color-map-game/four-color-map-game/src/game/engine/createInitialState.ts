import { GAME_CONFIG } from '@/config/gameConfig';
import { toCellKey } from '../domain/cellKey';
import type { Cell, ColorId, MatchState, PlayerId } from '../domain/types';

function makeCells(width: number, height: number): Record<string, Cell> {
  const cells: Record<string, Cell> = {};
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      cells[toCellKey(row, column)] = {
        row,
        column,
        regionId: null,
        canCreateRegion: true,
        rowOffset: 0,
        columnOffset: 0,
        cornerExpanded: false,
      };
    }
  }
  return cells;
}

export function createInitialState(
  paletteA: ColorId[] = ['red', 'blue', 'yellow'],
  paletteB: ColorId[] = ['green', 'purple', 'yellow'],
): MatchState {
  const players = {
    A: { id: 'A' as PlayerId, palette: [...paletteA], revealedColors: [], handCardIds: [] },
    B: { id: 'B' as PlayerId, palette: [...paletteB], revealedColors: [], handCardIds: [] },
  };

  return {
    width: GAME_CONFIG.boardWidth,
    height: GAME_CONFIG.boardHeight,
    cells: makeCells(GAME_CONFIG.boardWidth, GAME_CONFIG.boardHeight),
    regions: {},
    players,
    activePlayerId: 'A',
    pendingRegionId: null,
    turnNumber: 1,
    shiftAxis: 'NONE',
    status: 'SETUP',
    winnerPlayerId: null,
    winReason: null,
  };
}
