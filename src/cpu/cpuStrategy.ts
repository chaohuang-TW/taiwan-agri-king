import { COLLECTION_GOALS } from '../data/collectionGoals';
import { PRODUCTS } from '../data/products';
import { getCurrentProductValue, getCurrentPurchaseCost } from '../game/market';
import { evaluateCollectionGoal, getCompletedCollectionGoals } from '../game/collections';
import {
  getActiveMarketCard,
  getCurrentPlayer,
  getProductById,
  getTileById,
} from '../game/selectors';
import type {
  CollectionGoal,
  GameState,
  PendingAction,
  PlayerState,
  Product,
  PurchaseSource,
} from '../game/types';
import type { CpuDecision, CpuPurchaseEvaluation } from './cpuTypes';

function ownedProducts(player: PlayerState): Product[] {
  return player.productIds.map((id) => getProductById(id));
}

function conditionProgress(goal: CollectionGoal, products: Product[]): number {
  const condition = goal.condition;
  switch (condition.kind) {
    case 'category-count':
      return Math.min(
        condition.count,
        products.filter(({ category }) => category === condition.category).length,
      );
    case 'region-count':
      return Math.min(
        condition.count,
        products.filter(({ region }) => region === condition.region).length,
      );
    case 'distinct-regions':
      return Math.min(condition.count, new Set(products.map(({ region }) => region)).size);
    case 'distinct-counties':
      return Math.min(condition.count, new Set(products.map(({ countyId }) => countyId)).size);
    case 'category-diversity':
      return Math.min(condition.count, new Set(products.map(({ category }) => category)).size);
    case 'mixed-agri-seafood': {
      const seafood = products.filter(({ category }) => category === 'seafood').length;
      const agri = products.length - seafood;
      return Math.min(condition.agriCount, agri) + Math.min(condition.seafoodCount, seafood);
    }
    case 'tag-count':
      return Math.min(
        condition.count,
        products.filter(({ tags }) => tags.includes(condition.tag)).length,
      );
    case 'distinct-counties-with-tag':
      return Math.min(
        condition.count,
        new Set(
          products
            .filter(({ tags }) => tags.includes(condition.tag))
            .map(({ countyId }) => countyId),
        ).size,
      );
  }
}

function collectionProgress(products: Product[]): number {
  return COLLECTION_GOALS.reduce((total, goal) => total + conditionProgress(goal, products), 0);
}

export function evaluateCpuPurchase(
  state: GameState,
  productId: string,
  source: PurchaseSource,
): CpuPurchaseEvaluation | null {
  const player = getCurrentPlayer(state);
  const product = PRODUCTS.find(({ id }) => id === productId);
  if (!product || player.productIds.includes(productId)) return null;
  if (source === 'fishers-association' && product.category !== 'seafood') return null;
  const cost = getCurrentPurchaseCost(
    product,
    source,
    getActiveMarketCard(state),
    source === 'farmers-association' && !state.marketCardUsageByPlayer.includes(player.id),
  );
  if (player.funds < cost) return null;
  if (player.funds <= 0) return null;

  const before = ownedProducts(player);
  const after = [...before, product];
  const completedBefore = getCompletedCollectionGoals(player, PRODUCTS).length;
  const completedAfter = COLLECTION_GOALS.filter((goal) =>
    evaluateCollectionGoal(goal, after),
  ).length;
  const progressGain = collectionProgress(after) - collectionProgress(before);
  const value = getCurrentProductValue(product, state.season, getActiveMarketCard(state));
  const newCounty = !before.some(({ countyId }) => countyId === product.countyId);
  const newRegion = !before.some(({ region }) => region === product.region);
  const newCategory = !before.some(({ category }) => category === product.category);
  const completesGoal = completedAfter > completedBefore;
  const utility =
    (completesGoal ? 12 : 0) +
    progressGain * 3 +
    (newCounty ? 2 : 0) +
    (newRegion ? 1 : 0) +
    (newCategory ? 1 : 0) +
    value -
    cost;
  if (player.funds - cost < (completesGoal ? 1 : 3)) return null;
  return {
    productId,
    source,
    cost,
    value,
    utility,
    completesGoal,
    progressGain,
    newCounty,
    newRegion,
    newCategory,
  };
}

function comparePurchase(a: CpuPurchaseEvaluation, b: CpuPurchaseEvaluation): number {
  return (
    b.utility - a.utility ||
    b.value - a.value ||
    a.cost - b.cost ||
    a.productId.localeCompare(b.productId)
  );
}

export function chooseCpuPurchase(
  state: GameState,
  productIds: string[],
  source: PurchaseSource,
): CpuDecision {
  const candidates = productIds
    .map((productId) => evaluateCpuPurchase(state, productId, source))
    .filter((candidate): candidate is CpuPurchaseEvaluation => Boolean(candidate))
    .sort(comparePurchase);
  const best = candidates[0];
  if (!best || best.utility <= 0) {
    return {
      kind: 'skip-purchase',
      reason: best ? `最佳效用${best.utility}，保留採購金` : '沒有符合資金與收藏條件的產品',
    };
  }
  const flags = [
    best.completesGoal ? '完成收藏' : '',
    best.progressGain > 0 ? `收藏進度+${best.progressGain}` : '',
    best.newCounty ? '新縣市' : '',
    best.newRegion ? '新地區' : '',
    best.newCategory ? '新類別' : '',
  ].filter(Boolean);
  return {
    kind: 'purchase',
    productId: best.productId,
    source: best.source,
    utility: best.utility,
    reason: `${flags.join('、') || '產值高於成本'}；效用${best.utility}`,
  };
}

function saleBreaksCompletedGoal(player: PlayerState, productId: string): boolean {
  const before = getCompletedCollectionGoals(player, PRODUCTS);
  const after = getCompletedCollectionGoals(
    { ...player, productIds: player.productIds.filter((id) => id !== productId) },
    PRODUCTS,
  );
  return before.some(({ id }) => !after.some((goal) => goal.id === id));
}

export function chooseCpuSale(state: GameState): CpuDecision {
  const player = getCurrentPlayer(state);
  const candidates = player.productIds
    .map((productId) => {
      const product = getProductById(productId);
      const value = getCurrentProductValue(product, state.season, getActiveMarketCard(state));
      const premium = value - product.baseValue;
      const breaksGoal = saleBreaksCompletedGoal(player, productId);
      return {
        productId,
        value,
        premium,
        breaksGoal,
        // Prefer a low strategic value item when cash is tight; preserve premium goods for scoring.
        utility: 9 - value + premium * 2 - (breaksGoal ? 15 : 0),
      };
    })
    .sort(
      (a, b) =>
        b.utility - a.utility || b.value - a.value || a.productId.localeCompare(b.productId),
    );
  const best = candidates[0];
  if (!best || (player.funds > 4 && best.premium < 2) || best.breaksGoal) {
    return {
      kind: 'skip-sale',
      reason: best?.breaksGoal ? '出售會破壞已完成收藏' : '資金充足且沒有市場溢價',
    };
  }
  return {
    kind: 'sale',
    productId: best.productId,
    utility: best.utility,
    reason: best.premium >= 2 ? `市場溢價${best.premium}` : `資金僅${player.funds}`,
  };
}

export function chooseCpuTransport(state: GameState): CpuDecision {
  const pending = state.pendingAction;
  if (pending?.kind !== 'transport') return { kind: 'skip-transport', reason: '沒有合法交通選項' };
  const choices = pending.destinationIds
    .map((destinationId) => {
      const destination = getTileById(destinationId);
      const best = chooseCpuPurchase(state, destination.productIds ?? [], 'production');
      return { destinationId, best };
    })
    .filter(({ best }) => best.kind === 'purchase')
    .sort((a, b) => {
      if (a.best.kind !== 'purchase' || b.best.kind !== 'purchase') return 0;
      return b.best.utility - a.best.utility || a.destinationId.localeCompare(b.destinationId);
    });
  const best = choices[0];
  if (!best || best.best.kind !== 'purchase')
    return { kind: 'skip-transport', reason: '離島產品效用不足或資金不足' };
  return {
    kind: 'transport',
    destinationId: best.destinationId,
    utility: best.best.utility,
    reason: `離島最佳採購；效用${best.best.utility}`,
  };
}

export function decideCpuAction(state: GameState): CpuDecision {
  const pending: PendingAction | null = state.pendingAction;
  if (state.phase === 'awaiting-purchase') {
    if (pending?.kind === 'island-purchase')
      return chooseCpuPurchase(state, pending.productIds, 'production');
    if (pending?.kind === 'purchase')
      return chooseCpuPurchase(state, pending.productIds, pending.source);
  }
  if (state.phase === 'awaiting-sale') return chooseCpuSale(state);
  if (state.phase === 'awaiting-transport') return chooseCpuTransport(state);
  throw new Error(`CPU無法在${state.phase}階段決策。`);
}

export function isCpuPlayer(player: PlayerState): boolean {
  return player.controller === 'cpu';
}
