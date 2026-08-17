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
  | { kind: 'mixed-agri-seafood'; agriCount: number; seafoodCount: number }
  | { kind: 'tag-count'; tag: string; count: number }
  | { kind: 'distinct-counties-with-tag'; tag: string; count: number };

export interface CollectionGoal {
  id: string;
  title: string;
  description: string;
  bonusValue: number;
  condition: CollectionGoalCondition;
}

export type RandomSource = () => number;

export type GamePhase =
  | 'awaiting-roll'
  | 'moving'
  | 'awaiting-purchase'
  | 'awaiting-sale'
  | 'awaiting-transport'
  | 'awaiting-turn-end'
  | 'game-over';

export type PlayerController = 'human' | 'cpu';

export interface PlayerState {
  id: string;
  name: string;
  position: number;
  funds: number;
  productIds: string[];
  /** Optional for backwards-compatible saved states; omitted means human. */
  controller?: PlayerController;
}

export interface MovementPresentation {
  startPosition: number;
  dice: number;
  path: number[];
  crossedStart: boolean;
  stepIndex: number;
  destinationPosition: number;
}

export interface MarketDeckState {
  drawPile: string[];
  discardPile: string[];
  activeCardId: string | null;
}

export type PurchaseSource = 'production' | 'farmers-association' | 'fishers-association';

export type PendingAction =
  | {
      kind: 'purchase';
      tileId: string;
      productIds: string[];
      source: PurchaseSource;
    }
  | { kind: 'sale'; tileId: string }
  | { kind: 'transport'; tileId: string; destinationIds: string[] }
  | {
      kind: 'island-purchase';
      sourceTileId: string;
      destinationTileId: string;
      productIds: string[];
    };

export interface TurnSummary {
  title: string;
  lines: string[];
}

export interface ScoreBreakdown {
  productValue: number;
  collectionBonus: number;
  fundsBonus: number;
  total: number;
}

export interface RankedPlayer {
  playerId: string;
  playerName: string;
  rank: number;
  score: ScoreBreakdown;
  funds: number;
  productCount: number;
  completedGoalIds: string[];
}

export interface GameState {
  phase: GamePhase;
  round: number;
  season: Season;
  players: PlayerState[];
  currentPlayerIndex: number;
  marketDeck: MarketDeckState;
  marketCardUsageByPlayer: string[];
  movement: MovementPresentation | null;
  pendingAction: PendingAction | null;
  temporaryDestinationId: string | null;
  lastDiceRoll: number | null;
  turnSummary: TurnSummary | null;
  completed: boolean;
  rankings: RankedPlayer[] | null;
}
