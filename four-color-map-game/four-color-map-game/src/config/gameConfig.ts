export const GAME_CONFIG = {
  boardWidth: 10,
  boardHeight: 10,
  baseMaxRegionCells: 5,
  allColors: ['red', 'blue', 'yellow', 'green', 'purple'] as const,
  initialPaletteSize: 3,
  minCarriedCards: 2,
  maxCarriedCards: 4,
} as const;
