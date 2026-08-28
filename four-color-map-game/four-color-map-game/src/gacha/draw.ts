import type { Rarity, RarityWeights } from './types';

export function validateWeights(weights: RarityWeights): void {
  const entries = Object.values(weights);
  if (entries.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Rarity weights must be finite non-negative numbers.');
  }
  const total = entries.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 1e-9) {
    throw new Error(`Rarity weights must total 100; received ${total}.`);
  }
  if (weights[5] <= 0) throw new Error('Highest rarity must remain possible.');
}

export function drawRarity(weights: RarityWeights, rng: () => number): Rarity {
  validateWeights(weights);
  const roll = rng() * 100;
  let cumulative = 0;
  for (const rarity of [1, 2, 3, 4, 5] as const) {
    cumulative += weights[rarity];
    if (roll < cumulative) return rarity;
  }
  return 5;
}
