import type { PurchaseSource } from '../game/types';

export type CpuDecision =
  | {
      kind: 'purchase';
      productId: string;
      source: PurchaseSource;
      utility: number;
      reason: string;
    }
  | { kind: 'skip-purchase'; reason: string }
  | { kind: 'sale'; productId: string; utility: number; reason: string }
  | { kind: 'skip-sale'; reason: string }
  | { kind: 'transport'; destinationId: string; utility: number; reason: string }
  | { kind: 'skip-transport'; reason: string };

export interface CpuPurchaseEvaluation {
  productId: string;
  source: PurchaseSource;
  cost: number;
  value: number;
  utility: number;
  completesGoal: boolean;
  progressGain: number;
  newCounty: boolean;
  newRegion: boolean;
  newCategory: boolean;
}
