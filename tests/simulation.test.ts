import { expect, it } from 'vitest';
import { PRODUCTS } from '../src/data/products';
import {
  advanceMovementStep,
  chooseIslandPurchase,
  choosePurchase,
  chooseSale,
  chooseTransport,
  createGame,
  endTurn,
  getCurrentPurchaseCost,
  rollDice,
  skipIslandPurchase,
  skipPurchase,
  skipSale,
  skipTransport,
} from '../src/game/engine';
import { getActiveMarketCard, getCurrentPlayer } from '../src/game/selectors';
import type { GameState, PurchaseSource, RandomSource } from '../src/game/types';

function seededRandom(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function affordableProduct(
  game: GameState,
  ids: string[],
  source: PurchaseSource,
): string | undefined {
  const current = getCurrentPlayer(game);
  return ids.find((id) => {
    const product = PRODUCTS.find((candidate) => candidate.id === id);
    if (!product || current.productIds.includes(id)) return false;
    const useAssociation =
      source === 'farmers-association' &&
      getActiveMarketCard(game)?.effect.kind === 'next-association-discount' &&
      !game.marketCardUsageByPlayer.includes(current.id);
    return (
      current.funds >=
      getCurrentPurchaseCost(product, source, getActiveMarketCard(game), useAssociation)
    );
  });
}

function testPolicy(game: GameState, random: RandomSource): GameState {
  switch (game.phase) {
    case 'awaiting-roll':
      return rollDice(game, random);
    case 'moving':
      return advanceMovementStep(game, random);
    case 'awaiting-purchase': {
      if (game.pendingAction?.kind === 'island-purchase') {
        const id = affordableProduct(game, game.pendingAction.productIds, 'production');
        return id ? chooseIslandPurchase(game, id) : skipIslandPurchase(game);
      }
      if (game.pendingAction?.kind === 'purchase') {
        const id = affordableProduct(
          game,
          game.pendingAction.productIds,
          game.pendingAction.source,
        );
        return id ? choosePurchase(game, id) : skipPurchase(game);
      }
      throw new Error('採購phase沒有採購pending action');
    }
    case 'awaiting-sale': {
      const id = getCurrentPlayer(game).productIds[0];
      return id ? chooseSale(game, id) : skipSale(game);
    }
    case 'awaiting-transport': {
      const id =
        game.pendingAction?.kind === 'transport' ? game.pendingAction.destinationIds[0] : undefined;
      return id ? chooseTransport(game, id) : skipTransport(game);
    }
    case 'awaiting-turn-end':
      return endTurn(game, random);
    case 'game-over':
      return game;
  }
}

it('100場seeded全局模擬皆正常到game-over', () => {
  let completed = 0;
  for (let seed = 1; seed <= 100; seed += 1) {
    const random = seededRandom(seed);
    let game = createGame((seed % 4) + 1, random);
    let actions = 0;
    while (game.phase !== 'game-over' && actions < 3000) {
      game = testPolicy(game, random);
      actions += 1;
      expect(game.round).toBeGreaterThanOrEqual(1);
      expect(game.round).toBeLessThanOrEqual(12);
      for (const participant of game.players) {
        expect(participant.funds).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(participant.funds)).toBe(true);
        expect(participant.position).toBeGreaterThanOrEqual(0);
        expect(participant.position).toBeLessThanOrEqual(26);
      }
    }
    expect(game.phase).toBe('game-over');
    expect(actions).toBeLessThan(3000);
    expect(game.completed).toBe(true);
    expect(game.pendingAction).toBeNull();
    expect(game.temporaryDestinationId).toBeNull();
    expect(game.rankings?.every(({ score }) => Number.isFinite(score.total))).toBe(true);
    completed += 1;
  }
  expect(completed).toBe(100);
});
