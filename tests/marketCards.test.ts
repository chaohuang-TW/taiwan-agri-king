import { describe, expect, it } from 'vitest';
import { MARKET_CARDS } from '../src/data/marketCards';
import { validateMarketCards } from '../src/game/dataValidation';
import type { MarketCard } from '../src/game/types';

describe('市場卡資料', () => {
  it('恰好20張且類型分配正確', () => {
    expect(MARKET_CARDS).toHaveLength(20);
    expect(MARKET_CARDS.filter(({ type }) => type === 'demand')).toHaveLength(6);
    expect(MARKET_CARDS.filter(({ type }) => type === 'festival')).toHaveLength(5);
    expect(MARKET_CARDS.filter(({ type }) => type === 'weather')).toHaveLength(5);
    expect(MARKET_CARDS.filter(({ type }) => type === 'channel')).toHaveLength(4);
    expect(() => validateMarketCards()).not.toThrow();
  });

  it('拒絕零效果與重複ID', () => {
    const zero = structuredClone(MARKET_CARDS);
    zero[0]!.effect.amount = 0;
    expect(() => validateMarketCards(zero)).toThrow('amount不可為0');

    const duplicate = structuredClone(MARKET_CARDS);
    duplicate[1]!.id = duplicate[0]!.id;
    expect(() => validateMarketCards(duplicate)).toThrow('不得重複');
  });

  it('拒絕不支援的effect', () => {
    const cards = structuredClone(MARKET_CARDS) as MarketCard[];
    Object.assign(cards[0]!.effect, { kind: 'destroy-all' });
    expect(() => validateMarketCards(cards)).toThrow('不支援的effect');
  });
});
