import { MARKET_CARDS } from '../data/marketCards';
import { MINIMUM_PRODUCT_VALUE, MINIMUM_PURCHASE_COST } from './constants';
import { shuffle } from './random';
import type {
  MarketCard,
  MarketDeckState,
  Product,
  PurchaseSource,
  RandomSource,
  Season,
} from './types';

export function createMarketDeck(random: RandomSource): MarketDeckState {
  const shuffled = shuffle(
    MARKET_CARDS.map(({ id }) => id),
    random,
  );
  return { drawPile: shuffled.slice(1), discardPile: [], activeCardId: shuffled[0] ?? null };
}

export function replaceActiveMarketCard(
  deck: MarketDeckState,
  random: RandomSource,
): MarketDeckState {
  let drawPile = [...deck.drawPile];
  let discardPile = [...deck.discardPile];

  if (drawPile.length === 0) {
    drawPile = shuffle(discardPile, random);
    discardPile = [];
  }
  if (drawPile.length === 0) throw new Error('市場牌庫沒有可抽取的卡片。');

  const activeCardId = drawPile[0]!;
  drawPile = drawPile.slice(1);
  if (deck.activeCardId) discardPile.push(deck.activeCardId);
  return { drawPile, discardPile, activeCardId };
}

export function getCurrentProductValue(
  product: Product,
  season: Season,
  activeMarketCard: MarketCard | null,
): number {
  let value = product.baseValue + (product.peakSeasons.includes(season) ? 1 : 0);
  const effect = activeMarketCard?.effect;
  if (effect?.kind === 'category-value' && effect.category === product.category) {
    value += effect.amount;
  }
  if (effect?.kind === 'categories-value' && effect.categories.includes(product.category)) {
    value += effect.amount;
  }
  return Math.max(MINIMUM_PRODUCT_VALUE, value);
}

export function getCurrentPurchaseCost(
  product: Product,
  source: PurchaseSource,
  activeMarketCard: MarketCard | null,
  applyUnusedAssociationDiscount = false,
): number {
  let cost = product.purchaseCost;
  if (source === 'farmers-association') cost -= 1;

  const effect = activeMarketCard?.effect;
  if (
    effect?.kind === 'purchase-discount' &&
    (effect.category === undefined || effect.category === product.category)
  ) {
    cost -= effect.amount;
  }
  if (
    source === 'farmers-association' &&
    applyUnusedAssociationDiscount &&
    effect?.kind === 'next-association-discount'
  ) {
    cost -= effect.amount;
  }
  return Math.max(MINIMUM_PURCHASE_COST, cost);
}

export function getMarketCard(id: string | null): MarketCard | null {
  if (!id) return null;
  return MARKET_CARDS.find((card) => card.id === id) ?? null;
}
