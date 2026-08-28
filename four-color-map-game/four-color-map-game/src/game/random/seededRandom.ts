export type RandomSource = () => number;

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: RandomSource, minInclusive: number, maxInclusive: number): number {
  if (maxInclusive < minInclusive) throw new Error('Invalid random range');
  return Math.floor(rng() * (maxInclusive - minInclusive + 1)) + minInclusive;
}
