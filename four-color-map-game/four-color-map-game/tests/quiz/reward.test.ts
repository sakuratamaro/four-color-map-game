import { calculateQuizDrawCount } from '../../src/quiz/reward/calculateQuizReward';

describe('calculateQuizDrawCount', () => {
  test('perfect result returns only 10 draws', () => {
    expect(calculateQuizDrawCount({ answered: 10, correct: 10, wrong: 0, longestCorrectStreak: 10, failed: false })).toBe(10);
  });

  test('five consecutive correct answers upgrades reward to five draws', () => {
    expect(calculateQuizDrawCount({ answered: 10, correct: 8, wrong: 2, longestCorrectStreak: 5, failed: false })).toBe(5);
  });

  test('third wrong answer yields no draw', () => {
    expect(calculateQuizDrawCount({ answered: 8, correct: 5, wrong: 3, longestCorrectStreak: 3, failed: true })).toBe(0);
  });
});
