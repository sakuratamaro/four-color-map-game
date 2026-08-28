import { drawRarity, validateWeights } from '../../src/gacha/draw';

const weights = { 1: 55, 2: 30, 3: 12, 4: 2.8, 5: 0.2 } as const;

describe('gacha rarity', () => {
  test('valid weights total 100 and retain ★5', () => {
    expect(() => validateWeights(weights)).not.toThrow();
  });

  test('top tail can return ★5', () => {
    expect(drawRarity(weights, () => 0.9999)).toBe(5);
  });
});
