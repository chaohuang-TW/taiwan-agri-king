import type { Season } from '../game/types';

export const SEASONS: { id: Season; name: string; rounds: readonly number[] }[] = [
  { id: 'spring', name: '春', rounds: [1, 2, 3] },
  { id: 'summer', name: '夏', rounds: [4, 5, 6] },
  { id: 'autumn', name: '秋', rounds: [7, 8, 9] },
  { id: 'winter', name: '冬', rounds: [10, 11, 12] },
];

export const SEASON_BY_ROUND: Record<number, Season> = {
  1: 'spring',
  2: 'spring',
  3: 'spring',
  4: 'summer',
  5: 'summer',
  6: 'summer',
  7: 'autumn',
  8: 'autumn',
  9: 'autumn',
  10: 'winter',
  11: 'winter',
  12: 'winter',
};
