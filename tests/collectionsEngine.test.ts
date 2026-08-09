import { describe, expect, it } from 'vitest';
import { COLLECTION_GOALS } from '../src/data/collectionGoals';
import { PRODUCTS } from '../src/data/products';
import { evaluateCollectionGoal, getCompletedCollectionGoals } from '../src/game/collections';
import type { PlayerState } from '../src/game/types';

describe('12項收藏任務引擎', () => {
  it.each(COLLECTION_GOALS.map((goal) => [goal.id, goal] as const))(
    '%s有達成與未達成案例',
    (_id, goal) => {
      expect(evaluateCollectionGoal(goal, PRODUCTS)).toBe(true);
      expect(evaluateCollectionGoal(goal, [])).toBe(false);
    },
  );

  it('茶、稻米、沿海與山區只依鎖定tag判定', () => {
    const goal = (id: string) => COLLECTION_GOALS.find((item) => item.id === id)!;
    const tagged = (tag: string) => PRODUCTS.filter(({ tags }) => tags.includes(tag));
    expect(evaluateCollectionGoal(goal('taiwan-tea'), tagged('tea').slice(0, 3))).toBe(true);
    expect(evaluateCollectionGoal(goal('rice-master'), tagged('rice').slice(0, 4))).toBe(true);
    expect(evaluateCollectionGoal(goal('coastal-journey'), tagged('coastal'))).toBe(true);
    expect(evaluateCollectionGoal(goal('mountain-delicacies'), tagged('mountain'))).toBe(true);
  });

  it('農漁雙全使用五類非水產加seafood', () => {
    const goal = COLLECTION_GOALS.find(({ id }) => id === 'agri-and-sea')!;
    const owned = [
      PRODUCTS.find(({ category }) => category === 'fruit')!,
      PRODUCTS.find(({ category }) => category === 'grain')!,
      PRODUCTS.find(({ category }) => category === 'livestock-other')!,
      ...PRODUCTS.filter(({ category }) => category === 'seafood').slice(0, 2),
    ];
    expect(evaluateCollectionGoal(goal, owned)).toBe(true);
    expect(evaluateCollectionGoal(goal, owned.slice(0, 4))).toBe(false);
  });

  it('每位玩家各自公開判定，未知產品不會誤算', () => {
    const player: PlayerState = {
      id: 'player-1',
      name: '玩家1',
      position: 0,
      funds: 15,
      productIds: [
        'unknown',
        ...PRODUCTS.filter(({ tags }) => tags.includes('tea'))
          .slice(0, 3)
          .map(({ id }) => id),
      ],
    };
    expect(getCompletedCollectionGoals(player, PRODUCTS).map(({ id }) => id)).toContain(
      'taiwan-tea',
    );
  });
});
