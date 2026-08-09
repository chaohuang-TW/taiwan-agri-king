import type { RandomSource } from './types';

export const defaultRandomSource: RandomSource = Math.random;

function getRandomValue(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('亂數來源必須回傳大於等於0且小於1的有限數字。');
  }
  return value;
}

export function rollSixSidedDie(random: RandomSource = defaultRandomSource): number {
  return Math.floor(getRandomValue(random) * 6) + 1;
}

export function shuffle<T>(values: readonly T[], random: RandomSource = defaultRandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(getRandomValue(random) * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}
