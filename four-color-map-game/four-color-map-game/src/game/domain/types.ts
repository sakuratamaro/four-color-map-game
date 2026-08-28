export type PlayerId = 'A' | 'B';
export type RegionId = string;
export type CellKey = string;
export type ColorId = 'red' | 'blue' | 'yellow' | 'green' | 'purple';
export type ShiftAxis = 'NONE' | 'ROW' | 'COLUMN';
export type MatchStatus = 'SETUP' | 'IN_PROGRESS' | 'WON';
export type WinReason = 'FORCED_NO_COLOR' | 'MAP_COMPLETE' | null;

export interface Cell {
  row: number;
  column: number;
  regionId: RegionId | null;
  canCreateRegion: boolean;
  rowOffset: number;
  columnOffset: number;
  cornerExpanded: boolean;
}

export interface Region {
  id: RegionId;
  cellKeys: CellKey[];
  color: ColorId | null;
  createdByPlayerId: PlayerId;
  coloredByPlayerId: PlayerId | null;
  isPendingColor: boolean;
}

export interface Player {
  id: PlayerId;
  palette: ColorId[];
  revealedColors: ColorId[];
  handCardIds: string[];
}

export interface MatchState {
  width: number;
  height: number;
  cells: Record<CellKey, Cell>;
  regions: Record<RegionId, Region>;
  players: Record<PlayerId, Player>;
  activePlayerId: PlayerId;
  pendingRegionId: RegionId | null;
  turnNumber: number;
  shiftAxis: ShiftAxis;
  status: MatchStatus;
  winnerPlayerId: PlayerId | null;
  winReason: WinReason;
}
