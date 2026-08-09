import { describe, expect, it } from 'vitest';
import { MARKET_CARDS } from '../src/data/marketCards';
import { PRODUCTS } from '../src/data/products';
import { advanceMovementStep, createGame, endTurn, rollDice } from '../src/game/engine';
import {
  createMarketDeck,
  getCurrentProductValue,
  getCurrentPurchaseCost,
  replaceActiveMarketCard,
} from '../src/game/market';
import { rollSixSidedDie, shuffle } from '../src/game/random';
import type { GameState, MarketCard } from '../src/game/types';

const zero = () => 0;
const mango = PRODUCTS.find(({ id }) => id === 'tainan-mango')!;

describe('亂數與市場牌庫', () => {
  it('骰子涵蓋1與6且洗牌不修改輸入', () => {
    expect(rollSixSidedDie(zero)).toBe(1);
    expect(rollSixSidedDie(() => 0.999999)).toBe(6);
    const source = ['a', 'b', 'c'];
    expect(shuffle(source, zero)).toEqual(['b', 'c', 'a']);
    expect(source).toEqual(['a', 'b', 'c']);
  });

  it('遊戲開始抽1張active並留下19張draw', () => {
    const deck = createMarketDeck(zero);
    expect(deck.activeCardId).not.toBeNull();
    expect(deck.drawPile).toHaveLength(19);
    expect(deck.discardPile).toEqual([]);
    expect(new Set([deck.activeCardId, ...deck.drawPile])).toHaveLength(20);
  });

  it('換卡時舊active進discard', () => {
    const deck = { activeCardId: 'old', drawPile: ['new', 'later'], discardPile: ['past'] };
    expect(replaceActiveMarketCard(deck, zero)).toEqual({
      activeCardId: 'new',
      drawPile: ['later'],
      discardPile: ['past', 'old'],
    });
  });

  it('draw為空時只重洗discard，當前active不會進入重洗', () => {
    const next = replaceActiveMarketCard(
      { activeCardId: 'current', drawPile: [], discardPile: ['a', 'b'] },
      zero,
    );
    expect(next.activeCardId).toBe('b');
    expect(next.drawPile).toEqual(['a']);
    expect(next.discardPile).toEqual(['current']);
    expect(next.drawPile).not.toContain('current');
  });

  it('完全沒有可抽卡時回報清楚錯誤', () => {
    expect(() =>
      replaceActiveMarketCard({ activeCardId: 'only', drawPile: [], discardPile: [] }, zero),
    ).toThrow('市場牌庫沒有可抽取的卡片');
  });

  it('每輪結束與event格都替換active並重設usage', () => {
    const game = createGame(1, zero);
    const oldActive = game.marketDeck.activeCardId;
    const round2 = endTurn(
      { ...game, phase: 'awaiting-turn-end', marketCardUsageByPlayer: ['player-1'] },
      zero,
    );
    expect(round2.marketDeck.activeCardId).not.toBe(oldActive);
    expect(round2.marketDeck.discardPile).toContain(oldActive);
    expect(round2.marketCardUsageByPlayer).toEqual([]);

    const onEvent: GameState = {
      ...game,
      players: [{ ...game.players[0]!, position: 17 }],
      marketCardUsageByPlayer: ['player-1'],
    };
    const arrived = advanceMovementStep(rollDice(onEvent, zero), zero);
    expect(arrived.phase).toBe('awaiting-turn-end');
    expect(arrived.marketDeck.activeCardId).not.toBe(oldActive);
    expect(arrived.marketDeck.discardPile).toContain(oldActive);
    expect(arrived.marketCardUsageByPlayer).toEqual([]);
  });
});

describe('市場效果純函式', () => {
  const card = (effect: MarketCard['effect']): MarketCard => ({
    id: 'test',
    title: '測試',
    type: 'demand',
    description: '測試',
    effect,
  });

  it('category-value只調整符合類別並支援負值與最低1', () => {
    expect(
      getCurrentProductValue(
        mango,
        'summer',
        card({ kind: 'category-value', category: 'fruit', amount: 2 }),
      ),
    ).toBe(mango.baseValue + 3);
    expect(
      getCurrentProductValue(
        mango,
        'winter',
        card({ kind: 'category-value', category: 'grain', amount: 2 }),
      ),
    ).toBe(mango.baseValue);
    expect(
      getCurrentProductValue(
        mango,
        'winter',
        card({ kind: 'category-value', category: 'fruit', amount: -99 }),
      ),
    ).toBe(1);
  });

  it('categories-value正確套用多類別及負值邊界', () => {
    expect(
      getCurrentProductValue(
        mango,
        'winter',
        card({ kind: 'categories-value', categories: ['fruit', 'seafood'], amount: 3 }),
      ),
    ).toBe(mango.baseValue + 3);
    expect(
      getCurrentProductValue(
        mango,
        'winter',
        card({ kind: 'categories-value', categories: ['grain'], amount: -3 }),
      ),
    ).toBe(mango.baseValue);
  });

  it('purchase-discount依類別套用且最低成本1', () => {
    expect(
      getCurrentPurchaseCost(
        mango,
        'production',
        card({ kind: 'purchase-discount', category: 'fruit', amount: 2 }),
      ),
    ).toBe(mango.purchaseCost - 2);
    expect(
      getCurrentPurchaseCost(
        mango,
        'production',
        card({ kind: 'purchase-discount', category: 'grain', amount: 2 }),
      ),
    ).toBe(mango.purchaseCost);
    expect(
      getCurrentPurchaseCost(
        mango,
        'farmers-association',
        card({ kind: 'purchase-discount', amount: 99 }),
      ),
    ).toBe(1);
  });

  it('next-association-discount只在農會且明確啟用時套用', () => {
    const association = card({ kind: 'next-association-discount', amount: 2 });
    expect(getCurrentPurchaseCost(mango, 'farmers-association', association, true)).toBe(
      Math.max(1, mango.purchaseCost - 3),
    );
    expect(getCurrentPurchaseCost(mango, 'farmers-association', association, false)).toBe(
      mango.purchaseCost - 1,
    );
    expect(getCurrentPurchaseCost(mango, 'fishers-association', association, true)).toBe(
      mango.purchaseCost,
    );
  });

  it('Phase 1四種市場effect都有資料實例', () => {
    expect(new Set(MARKET_CARDS.map(({ effect }) => effect.kind))).toEqual(
      new Set([
        'category-value',
        'categories-value',
        'purchase-discount',
        'next-association-discount',
      ]),
    );
  });
});
