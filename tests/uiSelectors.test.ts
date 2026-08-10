import { describe, expect, it } from 'vitest';
import { COLLECTION_GOALS } from '../src/data/collectionGoals';
import { MARKET_CARDS } from '../src/data/marketCards';
import { PRODUCTS } from '../src/data/products';
import { createGame, getCurrentProductValue } from '../src/game/engine';
import {
  getCategoryLabel,
  getCollectionGoalProgress,
  getPlayerEstimatedScore,
  getPurchaseBreakdown,
  getSeasonLabel,
} from '../src/ui/selectors';

describe('UI selectors', () => {
  it('translates categories and seasons', () => {
    expect(getCategoryLabel('tea-specialty')).toBe('茶與特色作物');
    expect(getCategoryLabel('livestock-other')).toBe('畜產與其他');
    expect(getSeasonLabel('autumn')).toBe('秋');
  });

  it('reports category collection progress using engine truth', () => {
    const goal = COLLECTION_GOALS.find(({ id }) => id === 'fruit-kingdom')!;
    const products = PRODUCTS.filter(({ category }) => category === 'fruit').slice(0, 4);
    expect(getCollectionGoalProgress(goal, products)).toMatchObject({
      completed: true,
      current: 4,
      required: 4,
      label: '4 / 4',
    });
  });

  it('reports mixed agriculture and seafood progress', () => {
    const goal = COLLECTION_GOALS.find(({ id }) => id === 'agri-and-sea')!;
    const products = [
      PRODUCTS.find(({ id }) => id === 'taoyuan-rice')!,
      PRODUCTS.find(({ id }) => id === 'tainan-milkfish')!,
    ];
    expect(getCollectionGoalProgress(goal, products)).toMatchObject({
      completed: false,
      label: '農產 1/3、水產 1/2',
    });
  });

  it('uses current season and market card for product display value', () => {
    const pineapple = PRODUCTS.find(({ id }) => id === 'pingtung-pineapple')!;
    const card = MARKET_CARDS.find(({ id }) => id === 'fruit-best-seller')!;
    expect(getCurrentProductValue(pineapple, 'summer', card)).toBe(8);
  });

  it('explains association and market discounts with minimum cost', () => {
    const game = createGame(1, () => 0);
    const product = PRODUCTS.find(({ id }) => id === 'nantou-plum')!;
    const state = {
      ...game,
      marketDeck: { ...game.marketDeck, activeCardId: 'local-food-channel' },
    };
    expect(getPurchaseBreakdown(product, 'farmers-association', state)).toEqual({
      original: 2,
      associationDiscount: 1,
      marketDiscount: 1,
      final: 1,
    });
  });

  it('estimates player score through the core score calculator', () => {
    const game = createGame(1, () => 0);
    const player = { ...game.players[0]!, productIds: ['taoyuan-rice'], funds: 12 };
    expect(getPlayerEstimatedScore(player, game).total).toBeGreaterThan(4);
  });
});
