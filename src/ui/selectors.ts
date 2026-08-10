import { COLLECTION_GOALS } from '../data/collectionGoals';
import { COUNTIES } from '../data/counties';
import { PRODUCT_CATEGORY_NAMES, PRODUCTS } from '../data/products';
import { evaluateCollectionGoal } from '../game/collections';
import { calculateFinalScore } from '../game/scoring';
import { getActiveMarketCard } from '../game/selectors';
import type {
  CollectionGoal,
  GameState,
  PlayerState,
  Product,
  ProductCategory,
  PurchaseSource,
  Season,
} from '../game/types';

export const SEASON_LABELS: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

export const SEASON_SYMBOLS: Record<Season, string> = {
  spring: '花',
  summer: '日',
  autumn: '穗',
  winter: '雪',
};

export function getCategoryLabel(category: ProductCategory): string {
  return PRODUCT_CATEGORY_NAMES[category];
}

export function getSeasonLabel(season: Season): string {
  return SEASON_LABELS[season];
}

export function getCountyName(countyId: string): string {
  return COUNTIES.find(({ id }) => id === countyId)?.name ?? countyId;
}

export function getOwnedProducts(player: PlayerState): Product[] {
  return player.productIds
    .map((id) => PRODUCTS.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
}

export interface CollectionProgress {
  goalId: string;
  completed: boolean;
  current: number;
  required: number;
  label: string;
}

export function getCollectionGoalProgress(
  goal: CollectionGoal,
  ownedProducts: Product[],
): CollectionProgress {
  const completed = evaluateCollectionGoal(goal, ownedProducts);
  const condition = goal.condition;
  let current = 0;
  let required = 0;
  let label = '';

  switch (condition.kind) {
    case 'category-count':
      current = ownedProducts.filter(({ category }) => category === condition.category).length;
      required = condition.count;
      label = `${current} / ${required}`;
      break;
    case 'region-count':
      current = ownedProducts.filter(({ region }) => region === condition.region).length;
      required = condition.count;
      label = `${current} / ${required}`;
      break;
    case 'distinct-regions':
      current = new Set(ownedProducts.map(({ region }) => region)).size;
      required = condition.count;
      label = `${current} / ${required}`;
      break;
    case 'distinct-counties':
      current = new Set(ownedProducts.map(({ countyId }) => countyId)).size;
      required = condition.count;
      label = `${current} / ${required}`;
      break;
    case 'category-diversity':
      current = new Set(ownedProducts.map(({ category }) => category)).size;
      required = condition.count;
      label = `${current} / ${required}`;
      break;
    case 'mixed-agri-seafood': {
      const seafood = ownedProducts.filter(({ category }) => category === 'seafood').length;
      const agriculture = ownedProducts.length - seafood;
      current =
        Math.min(agriculture, condition.agriCount) + Math.min(seafood, condition.seafoodCount);
      required = condition.agriCount + condition.seafoodCount;
      label = `農產 ${agriculture}/${condition.agriCount}、水產 ${seafood}/${condition.seafoodCount}`;
      break;
    }
    case 'tag-count':
      current = ownedProducts.filter(({ tags }) => tags.includes(condition.tag)).length;
      required = condition.count;
      label = `${current} / ${required}`;
      break;
    case 'distinct-counties-with-tag':
      current = new Set(
        ownedProducts
          .filter(({ tags }) => tags.includes(condition.tag))
          .map(({ countyId }) => countyId),
      ).size;
      required = condition.count;
      label = `${current} / ${required}`;
      break;
  }

  return { goalId: goal.id, completed, current, required, label };
}

export function getAllCollectionProgress(player: PlayerState): CollectionProgress[] {
  const products = getOwnedProducts(player);
  return COLLECTION_GOALS.map((goal) => getCollectionGoalProgress(goal, products));
}

export interface PurchaseBreakdown {
  original: number;
  associationDiscount: number;
  marketDiscount: number;
  final: number;
}

export function getPurchaseBreakdown(
  product: Product,
  source: PurchaseSource,
  state: GameState,
): PurchaseBreakdown {
  const associationDiscount = source === 'farmers-association' ? 1 : 0;
  const card = getActiveMarketCard(state);
  const effect = card?.effect;
  let marketDiscount = 0;
  if (
    effect?.kind === 'purchase-discount' &&
    (effect.category === undefined || effect.category === product.category)
  ) {
    marketDiscount += effect.amount;
  }
  if (
    source === 'farmers-association' &&
    effect?.kind === 'next-association-discount' &&
    !state.marketCardUsageByPlayer.includes(state.players[state.currentPlayerIndex]!.id)
  ) {
    marketDiscount += effect.amount;
  }
  return {
    original: product.purchaseCost,
    associationDiscount,
    marketDiscount,
    final: Math.max(1, product.purchaseCost - associationDiscount - marketDiscount),
  };
}

export function getPlayerEstimatedScore(player: PlayerState, state: GameState) {
  return calculateFinalScore(player, state.season, getActiveMarketCard(state));
}
