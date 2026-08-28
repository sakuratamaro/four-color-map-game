import { randomInt, type RandomSource } from '@/game/random/seededRandom';
import type { NumericQuestion, QuizDifficulty } from '../types';

let serial = 0;

export function generateNumericQuestion(difficulty: QuizDifficulty, rng: RandomSource): NumericQuestion {
  serial += 1;
  const id = `q-${difficulty}-${serial}`;

  if (difficulty === 1) {
    const a = randomInt(rng, 10, 99);
    const b = randomInt(rng, 10, 99);
    return { id, difficulty, prompt: `${a} + ${b} = ?`, answer: a + b, explanation: `${a} + ${b} = ${a + b}` };
  }

  if (difficulty === 2) {
    const percent = [10, 20, 25, 50][randomInt(rng, 0, 3)] ?? 10;
    const baseUnit = percent === 25 ? 4 : percent === 20 ? 5 : percent === 10 ? 10 : 2;
    const whole = baseUnit * randomInt(rng, 5, 40);
    const answer = (whole * percent) / 100;
    return { id, difficulty, prompt: `${whole} の ${percent}% は？`, answer, explanation: `${whole} × ${percent}/100 = ${answer}` };
  }

  if (difficulty === 3) {
    const x = randomInt(rng, -12, 12);
    const a = randomInt(rng, 2, 9);
    const b = randomInt(rng, -15, 15);
    const c = a * x + b;
    return { id, difficulty, prompt: `${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = ${c} のとき x = ?`, answer: x, explanation: `x = ${x}` };
  }

  if (difficulty === 4) {
    const r1 = randomInt(rng, -9, 9);
    let r2 = randomInt(rng, -9, 9);
    if (r2 === r1) r2 += 1;
    const sum = r1 + r2;
    const product = r1 * r2;
    const larger = Math.max(r1, r2);
    return {
      id, difficulty,
      prompt: `x² ${-sum >= 0 ? '+' : '-'} ${Math.abs(sum)}x ${product >= 0 ? '+' : '-'} ${Math.abs(product)} = 0 の大きい方の解は？`,
      answer: larger,
      explanation: `解は ${r1}, ${r2}`,
    };
  }

  const first = randomInt(rng, -10, 10);
  const diff = randomInt(rng, 2, 9);
  const n = randomInt(rng, 8, 20);
  const answer = first + (n - 1) * diff;
  return {
    id, difficulty,
    prompt: `初項 ${first}、公差 ${diff} の等差数列の第${n}項は？`,
    answer,
    explanation: `${first} + (${n} - 1) × ${diff} = ${answer}`,
  };
}
