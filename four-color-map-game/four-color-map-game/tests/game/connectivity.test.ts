import { isOrthogonallyConnected } from '../../src/game/rules/connectivity';

describe('isOrthogonallyConnected', () => {
  test('accepts edge-connected cells', () => {
    expect(isOrthogonallyConnected(['0,0', '0,1', '1,1'])).toBe(true);
  });

  test('rejects diagonal-only connection', () => {
    expect(isOrthogonallyConnected(['0,0', '1,1'])).toBe(false);
  });
});
