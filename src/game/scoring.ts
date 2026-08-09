import { COLLECTION_GOALS } from '../data/collectionGoals';
import { PRODUCTS } from '../data/products';
import { FUNDS_PER_SCORE_POINT } from './constants';
import { getCompletedCollectionGoals } from './collections';
import { getCurrentProductValue } from './market';
import type { MarketCard, PlayerState, RankedPlayer, ScoreBreakdown, Season } from './types';

export function calculateFinalScore(
  player: PlayerState,
  season: Season,
  activeMarketCard: MarketCard | null,
): ScoreBreakdown {
  const productValue = player.productIds.reduce((sum, id) => {
    const product = PRODUCTS.find((candidate) => candidate.id === id);
    if (!product) throw new Error(`玩家 ${player.id} 持有不存在的產品：${id}`);
    return sum + getCurrentProductValue(product, season, activeMarketCard);
  }, 0);
  const collectionBonus = getCompletedCollectionGoals(player, PRODUCTS).reduce(
    (sum, goal) => sum + goal.bonusValue,
    0,
  );
  const fundsBonus = Math.floor(player.funds / FUNDS_PER_SCORE_POINT);
  return {
    productValue,
    collectionBonus,
    fundsBonus,
    total: productValue + collectionBonus + fundsBonus,
  };
}

export function rankPlayers(
  players: PlayerState[],
  season: Season,
  activeMarketCard: MarketCard | null,
): RankedPlayer[] {
  const sorted = players
    .map((player) => ({
      player,
      score: calculateFinalScore(player, season, activeMarketCard),
      completedGoalIds: getCompletedCollectionGoals(player, PRODUCTS, COLLECTION_GOALS).map(
        ({ id }) => id,
      ),
    }))
    .sort(
      (a, b) =>
        b.score.total - a.score.total ||
        b.score.collectionBonus - a.score.collectionBonus ||
        b.player.funds - a.player.funds ||
        b.player.productIds.length - a.player.productIds.length,
    );

  const ranked: RankedPlayer[] = [];
  sorted.forEach((entry, index) => {
    const previous = sorted[index - 1];
    const tied =
      previous &&
      previous.score.total === entry.score.total &&
      previous.score.collectionBonus === entry.score.collectionBonus &&
      previous.player.funds === entry.player.funds &&
      previous.player.productIds.length === entry.player.productIds.length;
    const result: RankedPlayer = {
      playerId: entry.player.id,
      playerName: entry.player.name,
      rank: tied ? ranked[index - 1]!.rank : index + 1,
      score: entry.score,
      funds: entry.player.funds,
      productCount: entry.player.productIds.length,
      completedGoalIds: entry.completedGoalIds,
    };
    ranked.push(result);
  });
  return ranked;
}
