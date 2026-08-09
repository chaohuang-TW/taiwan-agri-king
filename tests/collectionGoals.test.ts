import { describe, expect, it } from 'vitest';
import { COLLECTION_GOALS } from '../src/data/collectionGoals';
import { PRODUCTS } from '../src/data/products';
import { validateCollectionGoals } from '../src/game/dataValidation';

describe('收藏任務資料', () => {
  it('恰好12張且全部可由目前產品達成', () => {
    expect(COLLECTION_GOALS).toHaveLength(12);
    expect(() => validateCollectionGoals()).not.toThrow();
  });

  it('加成介於6至12且不完全相同', () => {
    for (const goal of COLLECTION_GOALS) {
      expect(goal.bonusValue).toBeGreaterThanOrEqual(6);
      expect(goal.bonusValue).toBeLessThanOrEqual(12);
    }
    expect(new Set(COLLECTION_GOALS.map(({ bonusValue }) => bonusValue)).size).toBeGreaterThan(1);
  });

  it('拒絕理論上無法完成的任務', () => {
    const goals = structuredClone(COLLECTION_GOALS);
    const fruitGoal = goals.find(({ id }) => id === 'fruit-kingdom')!;
    if (fruitGoal.condition.kind !== 'category-count') throw new Error('測試資料類型不符');
    fruitGoal.condition.count = 99;
    expect(() => validateCollectionGoals(goals, PRODUCTS)).toThrow('目前無法完成');
  });
});
