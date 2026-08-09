import { BOARD_TILES } from '../data/board';
import { COLLECTION_GOALS } from '../data/collectionGoals';
import { COUNTIES } from '../data/counties';
import { MARKET_CARDS } from '../data/marketCards';
import { PRODUCTS } from '../data/products';
import { REGIONS } from '../data/regions';
import { SEASON_BY_ROUND } from '../data/seasons';
import type {
  BoardTile,
  BoardTileType,
  CollectionGoal,
  MarketCard,
  Product,
  ProductCategory,
  Season,
  TaiwanRegion,
} from './types';

const PRODUCT_CATEGORIES: ProductCategory[] = [
  'fruit',
  'grain',
  'vegetable',
  'tea-specialty',
  'seafood',
  'livestock-other',
];
const TAIWAN_REGIONS: TaiwanRegion[] = ['north', 'central', 'south', 'east', 'offshore'];
const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const TILE_TYPES: BoardTileType[] = [
  'production',
  'farmers-association',
  'fishers-association',
  'market',
  'event',
  'transport',
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertUnique(values: string[], label: string): void {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  assert(duplicates.length === 0, `${label}不得重複：${[...new Set(duplicates)].join('、')}`);
}

export function validateProducts(products: Product[] = PRODUCTS): void {
  assert(products.length === 48, `產品必須恰好48項，目前為${products.length}項`);
  assertUnique(
    products.map(({ id }) => id),
    '產品ID',
  );
  const countyById = new Map(COUNTIES.map((county) => [county.id, county]));

  for (const product of products) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.id), `產品ID不是kebab-case：${product.id}`);
    const county = countyById.get(product.countyId);
    assert(county, `產品 ${product.id} 引用不存在的縣市：${product.countyId}`);
    assert(TAIWAN_REGIONS.includes(product.region), `產品 ${product.id} 的region不合法`);
    assert(county.region === product.region, `產品 ${product.id} 的region與縣市不一致`);
    assert(PRODUCT_CATEGORIES.includes(product.category), `產品 ${product.id} 的category不合法`);
    assert(Number.isFinite(product.purchaseCost), `產品 ${product.id} 的purchaseCost不是有限數字`);
    assert(
      product.purchaseCost >= 1 && product.purchaseCost <= 5,
      `產品 ${product.id} 的purchaseCost必須為1至5`,
    );
    assert(Number.isFinite(product.baseValue), `產品 ${product.id} 的baseValue不是有限數字`);
    assert(
      product.baseValue >= 2 && product.baseValue <= 8,
      `產品 ${product.id} 的baseValue必須為2至8`,
    );
    assert(product.peakSeasons.length > 0, `產品 ${product.id} 至少需要一個旺季`);
    assert(
      product.peakSeasons.every((season) => SEASONS.includes(season)),
      `產品 ${product.id} 含不合法旺季`,
    );
    assert(product.tags.length > 0, `產品 ${product.id} 至少需要一個標籤`);
    assert(product.sourceNote.trim().length > 0, `產品 ${product.id} 缺少sourceNote`);
  }

  for (const region of TAIWAN_REGIONS) {
    assert(
      products.some((product) => product.region === region),
      `地區 ${region} 至少需要一項產品`,
    );
  }
  for (const category of PRODUCT_CATEGORIES) {
    const count = products.filter((product) => product.category === category).length;
    assert(count >= 5, `類別 ${category} 至少需要5項產品，目前為${count}項`);
  }
}

export function validateCounties(): void {
  assert(COUNTIES.length === 22, `縣市必須恰好22個，目前為${COUNTIES.length}個`);
  assertUnique(
    COUNTIES.map(({ id }) => id),
    '縣市ID',
  );
  assertUnique(
    COUNTIES.map(({ name }) => name),
    '縣市中文名稱',
  );
  for (const county of COUNTIES) {
    assert(TAIWAN_REGIONS.includes(county.region), `縣市 ${county.id} 的region不合法`);
    assert(!county.name.includes('台'), `縣市 ${county.id} 必須使用「臺」字`);
  }
}

export function validateBoard(
  board: BoardTile[] = BOARD_TILES,
  products: Product[] = PRODUCTS,
): void {
  assert(board.length === 30, `棋盤必須恰好30格，目前為${board.length}格`);
  assertUnique(
    board.map(({ id }) => id),
    '棋盤格ID',
  );
  assertUnique(
    board.map(({ position }) => String(position)),
    '棋盤position',
  );
  const expectedPositions = Array.from({ length: 30 }, (_, index) => index);
  assert(
    expectedPositions.every((position) => board.some((tile) => tile.position === position)),
    '棋盤position必須完整涵蓋0至29',
  );
  const countyIds = new Set(COUNTIES.map(({ id }) => id));
  const productIds = new Set(products.map(({ id }) => id));
  const tileIds = new Set(board.map(({ id }) => id));

  for (const tile of board) {
    assert(TILE_TYPES.includes(tile.type), `棋盤格 ${tile.id} 的type不合法`);
    assert(tile.position >= 0 && tile.position <= 29, `棋盤格 ${tile.id} 的position超出0至29`);
    if (tile.countyId) assert(countyIds.has(tile.countyId), `棋盤格 ${tile.id} 引用不存在的縣市`);
    if (tile.region)
      assert(TAIWAN_REGIONS.includes(tile.region), `棋盤格 ${tile.id} 的region不合法`);
    if (tile.type === 'production') assert(tile.countyId, `產地格 ${tile.id} 必須有countyId`);
    for (const productId of tile.productIds ?? []) {
      assert(productIds.has(productId), `棋盤格 ${tile.id} 引用不存在的產品：${productId}`);
    }
    for (const destinationId of tile.transportDestinationIds ?? []) {
      assert(tileIds.has(destinationId), `交通格 ${tile.id} 引用不存在的目的地：${destinationId}`);
      assert(destinationId !== tile.id, `交通格 ${tile.id} 不可指向自己`);
    }
    if (tile.transportDestinationIds) {
      assert(tile.type === 'transport', `非交通格 ${tile.id} 不得設定transportDestinationIds`);
    }
  }
}

export function validateMarketCards(cards: MarketCard[] = MARKET_CARDS): void {
  assert(cards.length === 20, `市場卡必須恰好20張，目前為${cards.length}張`);
  assertUnique(
    cards.map(({ id }) => id),
    '市場卡ID',
  );
  const supportedKinds = [
    'category-value',
    'categories-value',
    'purchase-discount',
    'next-association-discount',
  ];

  for (const card of cards) {
    assert(
      ['demand', 'festival', 'weather', 'channel'].includes(card.type),
      `市場卡 ${card.id} 的type不合法`,
    );
    assert(supportedKinds.includes(card.effect.kind), `市場卡 ${card.id} 使用不支援的effect`);
    assert(
      Number.isFinite(card.effect.amount) && card.effect.amount !== 0,
      `市場卡 ${card.id} 的amount不可為0或非數字`,
    );
    if (card.effect.kind === 'category-value') {
      assert(
        PRODUCT_CATEGORIES.includes(card.effect.category),
        `市場卡 ${card.id} 引用不存在的category`,
      );
    }
    if (card.effect.kind === 'categories-value') {
      assert(card.effect.categories.length > 0, `市場卡 ${card.id} 至少需要一個category`);
      assert(
        card.effect.categories.every((category) => PRODUCT_CATEGORIES.includes(category)),
        `市場卡 ${card.id} 引用不存在的category`,
      );
    }
    if (card.effect.kind === 'purchase-discount' && card.effect.category) {
      assert(
        PRODUCT_CATEGORIES.includes(card.effect.category),
        `市場卡 ${card.id} 引用不存在的category`,
      );
    }
  }
}

function validateGoalAchievable(goal: CollectionGoal, products: Product[]): void {
  const condition = goal.condition;
  switch (condition.kind) {
    case 'category-count':
      assert(
        PRODUCT_CATEGORIES.includes(condition.category),
        `收藏任務 ${goal.id} 引用不存在的category`,
      );
      assert(
        products.filter(({ category }) => category === condition.category).length >=
          condition.count,
        `收藏任務 ${goal.id} 目前無法完成`,
      );
      break;
    case 'region-count':
      assert(TAIWAN_REGIONS.includes(condition.region), `收藏任務 ${goal.id} 引用不存在的region`);
      assert(
        products.filter(({ region }) => region === condition.region).length >= condition.count,
        `收藏任務 ${goal.id} 目前無法完成`,
      );
      break;
    case 'distinct-regions':
      assert(
        new Set(products.map(({ region }) => region)).size >= condition.count,
        `收藏任務 ${goal.id} 目前無法完成`,
      );
      break;
    case 'distinct-counties':
      assert(
        new Set(products.map(({ countyId }) => countyId)).size >= condition.count,
        `收藏任務 ${goal.id} 目前無法完成`,
      );
      break;
    case 'category-diversity':
      assert(
        new Set(products.map(({ category }) => category)).size >= condition.count,
        `收藏任務 ${goal.id} 目前無法完成`,
      );
      break;
    case 'mixed-agri-seafood': {
      const seafood = products.filter(({ category }) => category === 'seafood').length;
      const agriculture = products.length - seafood;
      assert(
        agriculture >= condition.agriCount && seafood >= condition.seafoodCount,
        `收藏任務 ${goal.id} 目前無法完成`,
      );
      break;
    }
  }
}

export function validateCollectionGoals(
  goals: CollectionGoal[] = COLLECTION_GOALS,
  products: Product[] = PRODUCTS,
): void {
  assert(goals.length === 12, `收藏任務必須恰好12張，目前為${goals.length}張`);
  assertUnique(
    goals.map(({ id }) => id),
    '收藏任務ID',
  );
  for (const goal of goals) {
    assert(
      goal.bonusValue >= 6 && goal.bonusValue <= 12,
      `收藏任務 ${goal.id} 的bonusValue必須為6至12`,
    );
    assert(Number.isInteger(goal.bonusValue), `收藏任務 ${goal.id} 的bonusValue必須為整數`);
    validateGoalAchievable(goal, products);
  }
}

export function validateSeasons(seasonByRound: Record<number, Season> = SEASON_BY_ROUND): void {
  const expected: Season[] = [
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
  ];
  expected.forEach((season, index) => {
    const round = index + 1;
    assert(seasonByRound[round] === season, `第${round}輪季節應為${season}`);
  });
}

export function validateGameData(): void {
  assert(REGIONS.length === 5, `地區必須恰好5個，目前為${REGIONS.length}個`);
  validateCounties();
  validateProducts();
  validateBoard();
  validateMarketCards();
  validateCollectionGoals();
  validateSeasons();
}
