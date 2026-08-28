import { createInitialState } from '../../src/game/engine/createInitialState';
import { validateNewRegion } from '../../src/game/rules/regionValidation';

describe('validateNewRegion', () => {
  test('first region may be placed without touching an existing region', () => {
    const state = createInitialState();
    expect(validateNewRegion(state, ['2,2', '2,3'], { maxCells: 5, isFirstRegion: true })).toEqual({ valid: true });
  });

  test('diagonal-only region is invalid', () => {
    const state = createInitialState();
    expect(validateNewRegion(state, ['2,2', '3,3'], { maxCells: 5, isFirstRegion: true })).toEqual({
      valid: false,
      reason: 'NOT_CONNECTED',
    });
  });
});
