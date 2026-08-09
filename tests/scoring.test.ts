import { describe, expect, it } from 'vitest';
import { calculateFinalScore, rankPlayers } from '../src/game/scoring';
import type { MarketCard, PlayerState } from '../src/game/types';

const player = (id: string, funds: number, productIds: string[]): PlayerState => ({
  id,
  name: id,
  position: 0,
  funds,
  productIds,
});

describe('最終計分', () => {
  it('產品20＋收藏8＋資金8換2＝30', () => {
    const teaDown: MarketCard = {
      id: 'tea-down',
      title: '測試',
      type: 'demand',
      description: '測試',
      effect: { kind: 'category-value', category: 'tea-specialty', amount: -1 },
    };
    expect(
      calculateFinalScore(
        player('player-1', 8, [
          'taipei-tieguanyin',
          'new-taipei-baozhong-tea',
          'hsinchu-oriental-beauty-tea',
        ]),
        'summer',
        teaDown,
      ),
    ).toEqual({ productValue: 20, collectionBonus: 8, fundsBonus: 2, total: 30 });
  });

  it.each([
    [0, 0],
    [2, 0],
    [3, 1],
    [8, 2],
    [15, 5],
  ])('funds %d換算%d', (funds, points) => {
    expect(calculateFinalScore(player('p', funds, []), 'winter', null).fundsBonus).toBe(points);
  });

  it('未知產品以清楚錯誤拒絕結算', () => {
    expect(() => calculateFinalScore(player('p', 0, ['unknown']), 'winter', null)).toThrow(
      '持有不存在的產品',
    );
  });
});

describe('排名與平手', () => {
  it('先依總分排序', () => {
    expect(
      rankPlayers([player('低', 0, []), player('高', 6, [])], 'winter', null)[0]!.playerId,
    ).toBe('高');
  });

  it('同總分依收藏加成較高者優先', () => {
    const tea = player('收藏', 0, [
      'taipei-tieguanyin',
      'new-taipei-baozhong-tea',
      'hsinchu-oriental-beauty-tea',
    ]);
    const score = calculateFinalScore(tea, 'winter', null).total;
    expect(rankPlayers([player('資金', score * 3, []), tea], 'winter', null)[0]!.playerId).toBe(
      '收藏',
    );
  });

  it('再同分依funds排序', () => {
    expect(
      rankPlayers([player('三', 3, []), player('五', 5, [])], 'winter', null)[0]!.playerId,
    ).toBe('五');
  });

  it('再同分依產品種類數排序', () => {
    const harshGrain: MarketCard = {
      id: 'grain-down',
      title: '測試',
      type: 'demand',
      description: '測試',
      effect: { kind: 'category-value', category: 'grain', amount: -2 },
    };
    const one = player('一種', 0, ['yunlin-cabbage']);
    const two = player('兩種', 0, ['changhua-rice', 'chiayi-rice']);
    expect(calculateFinalScore(one, 'spring', harshGrain).total).toBe(
      calculateFinalScore(two, 'spring', harshGrain).total,
    );
    expect(rankPlayers([one, two], 'spring', harshGrain)[0]!.playerId).toBe('兩種');
  });

  it('完全相同並列，下一名採競賽排名', () => {
    const ranked = rankPlayers(
      [player('甲', 3, []), player('乙', 3, []), player('丙', 0, [])],
      'winter',
      null,
    );
    expect(ranked.map(({ rank }) => rank)).toEqual([1, 1, 3]);
  });
});
