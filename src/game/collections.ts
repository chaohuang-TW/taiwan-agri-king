import { COLLECTION_GOALS } from '../data/collectionGoals';
import type { CollectionGoal, PlayerState, Product } from './types';

const AGRICULTURAL_CATEGORIES = new Set([
  'fruit',
  'grain',
  'vegetable',
  'tea-specialty',
  'livestock-other',
]);

export function evaluateCollectionGoal(goal: CollectionGoal, ownedProducts: Product[]): boolean {
  const { condition } = goal;
  switch (condition.kind) {
    case 'category-count':
      return (
        ownedProducts.filter(({ category }) => category === condition.category).length >=
        condition.count
      );
    case 'region-count':
      return (
        ownedProducts.filter(({ region }) => region === condition.region).length >= condition.count
      );
    case 'distinct-regions':
      return new Set(ownedProducts.map(({ region }) => region)).size >= condition.count;
    case 'distinct-counties':
      return new Set(ownedProducts.map(({ countyId }) => countyId)).size >= condition.count;
    case 'category-diversity':
      return new Set(ownedProducts.map(({ category }) => category)).size >= condition.count;
    case 'mixed-agri-seafood':
      return (
        ownedProducts.filter(({ category }) => category === 'seafood').length >=
          condition.seafoodCount &&
        ownedProducts.filter(({ category }) => AGRICULTURAL_CATEGORIES.has(category)).length >=
          condition.agriCount
      );
    case 'tag-count':
      return (
        ownedProducts.filter(({ tags }) => tags.includes(condition.tag)).length >= condition.count
      );
    case 'distinct-counties-with-tag':
      return (
        new Set(
          ownedProducts
            .filter(({ tags }) => tags.includes(condition.tag))
            .map(({ countyId }) => countyId),
        ).size >= condition.count
      );
  }
}

export function getCompletedCollectionGoals(
  player: PlayerState,
  products: Product[],
  goals: CollectionGoal[] = COLLECTION_GOALS,
): CollectionGoal[] {
  const owned = player.productIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
  return goals.filter((goal) => evaluateCollectionGoal(goal, owned));
}
