import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/data/products';
import {
  advanceMovementStep,
  chooseIslandPurchase,
  choosePurchase,
  chooseSale,
  chooseTransport,
  createGameWithPlayers,
  rollDice,
  skipPurchase,
} from '../src/game/engine';
import { decideCpuAction, evaluateCpuPurchase, isCpuPlayer } from '../src/cpu/cpuStrategy';
import { runBalanceSimulation } from '../src/cpu/balanceSimulation';
import type { GameState, RandomSource } from '../src/game/types';

const zero: RandomSource = () => 0;

function atPosition(game: GameState, position: number): GameState {
  return {
    ...game,
    players: game.players.map((player, index) =>
      index === game.currentPlayerIndex ? { ...player, position } : player,
    ),
  };
}

function cpuGame(): GameState {
  return createGameWithPlayers(
    [
      { name: '真人', controller: 'human' },
      { name: '電腦', controller: 'cpu' },
    ],
    zero,
  );
}

describe('CPU控制器與可解釋策略', () => {
  it('建立穩定ID並保留human/cpu控制器', () => {
    const game = cpuGame();
    expect(game.players.map(({ id }) => id)).toEqual(['player-1', 'player-2']);
    expect(game.players.map(({ controller }) => controller)).toEqual(['human', 'cpu']);
    expect(isCpuPlayer(game.players[1]!)).toBe(true);
  });

  it('以收藏進度與產值成本排序採購，並由引擎完成購買', () => {
    const pending = advanceMovementStep(rollDice(atPosition(cpuGame(), 0), zero), zero);
    const cpuPending = { ...pending, currentPlayerIndex: 1 };
    const decision = decideCpuAction(cpuPending);
    expect(decision.kind).toBe('purchase');
    if (decision.kind !== 'purchase') return;
    const evaluated = evaluateCpuPurchase(cpuPending, decision.productId, decision.source);
    expect(evaluated?.utility).toBe(decision.utility);
    expect(choosePurchase(cpuPending, decision.productId).phase).toBe('awaiting-turn-end');
  });

  it('資金為0時穩定略過採購，不會產生負數', () => {
    const pending = advanceMovementStep(rollDice(atPosition(cpuGame(), 0), zero), zero);
    const broke = {
      ...pending,
      currentPlayerIndex: 1,
      players: pending.players.map((player, index) =>
        index === 1 ? { ...player, funds: 0 } : player,
      ),
    };
    expect(decideCpuAction(broke).kind).toBe('skip-purchase');
    expect(skipPurchase(broke).players[1]!.funds).toBe(0);
  });

  it('市場缺錢時出售產品，且不直接變更遊戲狀態', () => {
    const market = advanceMovementStep(rollDice(atPosition(cpuGame(), 6), zero), zero);
    const state = {
      ...market,
      currentPlayerIndex: 1,
      players: market.players.map((player, index) =>
        index === 1 ? { ...player, funds: 3, productIds: ['taoyuan-rice'] } : player,
      ),
    };
    const decision = decideCpuAction(state);
    expect(decision.kind).toBe('sale');
    if (decision.kind !== 'sale') return;
    expect(chooseSale(state, decision.productId).phase).toBe('awaiting-turn-end');
    expect(state.players[1]!.funds).toBe(3);
  });

  it('交通選擇只回傳合法目的地，採購仍交給engine action', () => {
    const transport = advanceMovementStep(rollDice(atPosition(cpuGame(), 12), zero), zero);
    const state = { ...transport, currentPlayerIndex: 1 };
    const decision = decideCpuAction(state);
    expect(decision.kind).toBe('transport');
    if (decision.kind !== 'transport') return;
    expect(state.pendingAction?.kind).toBe('transport');
    const island = chooseTransport(state, decision.destinationId);
    expect(island.pendingAction?.kind).toBe('island-purchase');
    if (island.pendingAction?.kind === 'island-purchase') {
      const product = island.pendingAction.productIds[0];
      if (product) expect(chooseIslandPurchase(island, product).phase).toBe('awaiting-turn-end');
    }
  });

  it.each(PRODUCTS.map(({ id }) => id))('公開產品%s可被CPU以有限效用評估', (productId) => {
    const evaluation = evaluateCpuPurchase(cpuGame(), productId, 'production');
    expect(evaluation).not.toBeNull();
    expect(Number.isFinite(evaluation?.utility)).toBe(true);
    expect(evaluation?.cost).toBeGreaterThanOrEqual(1);
    expect(evaluation?.value).toBeGreaterThanOrEqual(1);
  });
});

it('2,000場seeded CPU平衡模擬全部完成且經濟數值有限', () => {
  const report = runBalanceSimulation(2_000);
  expect(report.completedGames).toBe(2_000);
  expect(report.seatWinEquivalent).toHaveLength(4);
  expect(report.seatWinEquivalent.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
  expect(report.maxActions).toBeLessThan(5_000);
  expect(report.averageFunds).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(report.averageScore)).toBe(true);
}, 60_000);
