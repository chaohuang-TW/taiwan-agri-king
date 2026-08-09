export type ProductCategory =
  | 'fruit'
  | 'grain'
  | 'vegetable'
  | 'tea-specialty'
  | 'seafood'
  | 'livestock-other';

export type TaiwanRegion = 'north' | 'central' | 'south' | 'east' | 'offshore';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Region {
  id: TaiwanRegion;
  name: string;
  description: string;
}

export interface County {
  id: string;
  name: string;
  region: TaiwanRegion;
}

export interface Product {
  id: string;
  name: string;
  countyId: string;
  region: TaiwanRegion;
  category: ProductCategory;
  purchaseCost: number;
  baseValue: number;
  peakSeasons: Season[];
  tags: string[];
  sourceNote: string;
}

export type BoardTileType =
  | 'production'
  | 'farmers-association'
  | 'fishers-association'
  | 'market'
  | 'event'
  | 'transport';

export interface BoardTile {
  id: string;
  position: number;
  type: BoardTileType;
  countyId?: string;
  region?: TaiwanRegion;
  productIds?: string[];
  transportDestinationIds?: string[];
  name: string;
  shortName: string;
  description: string;
}

export type MarketCardType = 'demand' | 'festival' | 'weather' | 'channel';

export interface MarketCard {
  id: string;
  title: string;
  type: MarketCardType;
  description: string;
  effect:
    | { kind: 'category-value'; category: ProductCategory; amount: number }
    | { kind: 'categories-value'; categories: ProductCategory[]; amount: number }
    | { kind: 'purchase-discount'; category?: ProductCategory; amount: number }
    | { kind: 'next-association-discount'; amount: number };
}

export type CollectionGoalCondition =
  | { kind: 'category-count'; category: ProductCategory; count: number }
  | { kind: 'region-count'; region: TaiwanRegion; count: number }
  | { kind: 'distinct-regions'; count: number }
  | { kind: 'distinct-counties'; count: number }
  | { kind: 'category-diversity'; count: number }
  | { kind: 'mixed-agri-seafood'; agriCount: number; seafoodCount: number };

export interface CollectionGoal {
  id: string;
  title: string;
  description: string;
  bonusValue: number;
  condition: CollectionGoalCondition;
}
