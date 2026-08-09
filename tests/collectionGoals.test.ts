import { describe, expect, it } from 'vitest';
import { COLLECTION_GOALS } from '../src/data/collectionGoals';
import { PRODUCTS } from '../src/data/products';
import { validateCollectionGoals } from '../src/game/dataValidation';
import type { CollectionGoal, CollectionGoalCondition } from '../src/game/types';

function goalsWithCondition(id: string, condition: CollectionGoalCondition): CollectionGoal[] {
  return COLLECTION_GOALS.map((goal) => (goal.id === id ? { ...goal, condition } : goal));
}

function productsByName(names: string[]) {
  return names.map((name) => {
    const product = PRODUCTS.find((candidate) => candidate.name === name);
    if (!product) throw new Error(`找不到測試產品：${name}`);
    return product;
  });
}

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

  it.each([
    {
      name: '不存在的tag',
      condition: { kind: 'tag-count', tag: 'not-found', count: 1 } as const,
      message: 'tag "not-found" 只有0項產品，需求1項',
    },
    {
      name: 'tag-count需求99',
      condition: { kind: 'tag-count', tag: 'mountain', count: 99 } as const,
      message: 'tag "mountain" 只有5項產品，需求99項',
    },
    {
      name: 'distinct-counties-with-tag需求99',
      condition: { kind: 'distinct-counties-with-tag', tag: 'tea', count: 99 } as const,
      message: 'tag "tea" 只有4個不同縣市，需求99個',
    },
    {
      name: '空字串tag',
      condition: { kind: 'tag-count', tag: '', count: 1 } as const,
      message: 'tag不可為空字串',
    },
    {
      name: '負count',
      condition: { kind: 'tag-count', tag: 'mountain', count: -1 } as const,
      message: 'count必須為正整數',
    },
    {
      name: 'count為0',
      condition: { kind: 'distinct-counties-with-tag', tag: 'tea', count: 0 } as const,
      message: 'count必須為正整數',
    },
  ])('拒絕$name', ({ condition, message }) => {
    expect(() =>
      validateCollectionGoals(goalsWithCondition('mountain-delicacies', condition), PRODUCTS),
    ).toThrow(message);
  });

  it('臺灣好茶只計算來自不同縣市的tea產品', () => {
    const teaGoal = COLLECTION_GOALS.find(({ id }) => id === 'taiwan-tea')!;
    expect(teaGoal.condition).toEqual({
      kind: 'distinct-counties-with-tag',
      tag: 'tea',
      count: 3,
    });

    const qualifying = productsByName(['木柵鐵觀音', '文山包種茶', '東方美人茶']);
    expect(qualifying.every(({ tags }) => tags.includes('tea'))).toBe(true);
    expect(new Set(qualifying.map(({ countyId }) => countyId)).size).toBe(3);

    const nonTea = productsByName(['阿里山咖啡', '金針', '洛神葵']);
    expect(nonTea.every(({ tags }) => !tags.includes('tea'))).toBe(true);
  });

  it('稻米達人只計算來自不同縣市的rice產品', () => {
    const riceGoal = COLLECTION_GOALS.find(({ id }) => id === 'rice-master')!;
    expect(riceGoal.condition).toEqual({
      kind: 'distinct-counties-with-tag',
      tag: 'rice',
      count: 4,
    });

    const rice = productsByName(['桃園稻米', '彰化稻米', '嘉義稻米', '花蓮稻米']);
    expect(rice.every(({ tags }) => tags.includes('rice'))).toBe(true);
    expect(new Set(rice.map(({ countyId }) => countyId)).size).toBe(4);

    const nonRice = productsByName(['花生', '毛豆', '小米']);
    expect(nonRice.every(({ tags }) => !tags.includes('rice'))).toBe(true);
  });

  it('海線與山城任務具有足夠且合理的語意標籤資料', () => {
    const coastal = PRODUCTS.filter(({ tags }) => tags.includes('coastal'));
    const mountain = PRODUCTS.filter(({ tags }) => tags.includes('mountain'));

    expect(new Set(coastal.map(({ countyId }) => countyId)).size).toBeGreaterThanOrEqual(4);
    expect(coastal.every(({ category }) => category === 'seafood')).toBe(true);
    expect(mountain).toHaveLength(5);
    expect(mountain.every(({ sourceNote }) => /山|東勢|和平/.test(sourceNote))).toBe(true);
  });
});
