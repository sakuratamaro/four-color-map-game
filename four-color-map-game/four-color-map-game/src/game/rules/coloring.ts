import type { ColorId, MatchState, PlayerId, RegionId } from '../domain/types';
import { getAdjacentColors } from './adjacency';

export function getPlayableColors(
  state: MatchState,
  playerId: PlayerId,
  regionId: RegionId,
): ColorId[] {
  const blocked = new Set(getAdjacentColors(state, regionId));
  return state.players[playerId].palette.filter((color) => !blocked.has(color));
}

export function canColorRegion(
  state: MatchState,
  playerId: PlayerId,
  regionId: RegionId,
  color: ColorId,
): boolean {
  return getPlayableColors(state, playerId, regionId).includes(color);
}
