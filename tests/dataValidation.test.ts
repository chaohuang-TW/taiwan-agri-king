import { describe, expect, it } from 'vitest';
import { SEASON_BY_ROUND } from '../src/data/seasons';
import { validateGameData, validateSeasons } from '../src/game/dataValidation';

describe('跨資料與季節驗證', () => {
  it('完整遊戲資料通過跨資料驗證', () => {
    expect(() => validateGameData()).not.toThrow();
  });

  it('12輪季節依3輪一季配置', () => {
    expect(Object.keys(SEASON_BY_ROUND)).toHaveLength(12);
    expect(Object.values(SEASON_BY_ROUND)).toEqual([
      'spring',
      'spring',
      'spring',
      'summer',
      'summer',
      'summer',
      'autumn',
      'autumn',
      'autumn',
      'winter',
      'winter',
      'winter',
    ]);
    expect(() => validateSeasons()).not.toThrow();
  });

  it('拒絕錯誤輪次季節', () => {
    expect(() => validateSeasons({ ...SEASON_BY_ROUND, 4: 'winter' })).toThrow(
      '第4輪季節應為summer',
    );
  });
});
