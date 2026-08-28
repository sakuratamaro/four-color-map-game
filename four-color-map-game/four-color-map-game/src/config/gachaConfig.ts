import type { RarityWeights } from '@/gacha/types';

// PROVISIONAL BALANCE VALUES. Keep ★5 > 0 at every difficulty.
export const GACHA_CONFIG: { rarityWeightsByQuizLevel: Record<number, RarityWeights> } = {
  rarityWeightsByQuizLevel: {
    1: { 1: 55, 2: 30, 3: 12, 4: 2.8, 5: 0.2 },
    2: { 1: 40, 2: 35, 3: 19, 4: 5.5, 5: 0.5 },
    3: { 1: 25, 2: 35, 3: 28, 4: 10, 5: 2 },
    4: { 1: 10, 2: 25, 3: 35, 4: 24, 5: 6 },
    5: { 1: 2, 2: 8, 3: 30, 4: 40, 5: 20 },
  },
};
