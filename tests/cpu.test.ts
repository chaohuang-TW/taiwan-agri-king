import { describe, expect, it } from 'vitest';
import { COLLECTION_GOALS } from '../src/data/collectionGoals';
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
import {
  chooseCpuSale,
  chooseCpuTransport,
  decideCpuAction,
  evaluateCpuPurchase,
  isCpuPlayer,
} from '../src/cpu/cpuStrategy';
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

function cpuPurchaseState(
  productIds: string[],
  funds = 15,
  playerProductIds: string[] = [],
): GameState {
  const game = cpuGame();
  return {
    ...game,
    phase: 'awaiting-purchase',
    currentPlayerIndex: 1,
    pendingAction: {
      kind: 'purchase',
      tileId: 'taoyuan-pond-fields',
      productIds,
      source: 'production',
    },
    players: game.players.map((player, index) =>
      index === 1 ? { ...player, funds, productIds: playerProductIds } : player,
    ),
  };
}

function cpuSaleState(productIds: string[], funds = 3): GameState {
  const game = cpuGame();
  return {
    ...game,
    phase: 'awaiting-sale',
    currentPlayerIndex: 1,
    pendingAction: { kind: 'sale', tileId: 'yunlin-wholesale-market' },
    marketDeck: { ...game.marketDeck, activeCardId: null },
    players: game.players.map((player, index) =>
      index === 1 ? { ...player, funds, productIds } : player,
    ),
  };
}

function cpuTransportState(funds = 15, playerProductIds: string[] = []): GameState {
  const game = cpuGame();
  return {
    ...game,
    phase: 'awaiting-transport',
    currentPlayerIndex: 1,
    pendingAction: {
      kind: 'transport',
      tileId: 'taipei-harbor-gateway',
      destinationIds: ['penghu-island-stop', 'kinmen-island-stop'],
    },
    marketDeck: { ...game.marketDeck, activeCardId: 'mid-autumn-reunion' },
    players: game.players.map((player, index) =>
      index === 1 ? { ...player, funds, productIds: playerProductIds } : player,
    ),
  };
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

  it('只讀公開狀態，不會因未來市場牌順序改變決策', () => {
    const state = cpuPurchaseState(['taoyuan-rice', 'taoyuan-persimmon']);
    const stateA = {
      ...state,
      marketDeck: { ...state.marketDeck, drawPile: ['a', 'b', 'c'] },
    };
    const stateB = {
      ...state,
      marketDeck: { ...state.marketDeck, drawPile: ['c', 'a', 'b'] },
    };
    expect(decideCpuAction(stateA)).toEqual(decideCpuAction(stateB));
  });

  it('同一個GameState連續決策結果完全相同', () => {
    const state = cpuPurchaseState(['taoyuan-rice', 'taoyuan-persimmon']);
    const a = decideCpuAction(state);
    const b = decideCpuAction(state);
    const c = decideCpuAction(state);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('一般採購保留3：成本3時資金5拒絕、資金6允許', () => {
    const productId = 'new-taipei-wendan';
    const rejected = evaluateCpuPurchase(cpuPurchaseState([productId], 5), productId, 'production');
    const allowed = evaluateCpuPurchase(cpuPurchaseState([productId], 6), productId, 'production');
    expect(rejected).toBeNull();
    expect(allowed).not.toBeNull();
  });

  it('完成收藏保留1：最後一項資金1允許、資金0拒絕', () => {
    const productId = 'miaoli-strawberry';
    const owned = ['new-taipei-wendan', 'taoyuan-persimmon', 'hsinchu-persimmon'];
    const allowed = evaluateCpuPurchase(
      cpuPurchaseState([productId], 5, owned),
      productId,
      'production',
    );
    const rejected = evaluateCpuPurchase(
      cpuPurchaseState([productId], 4, owned),
      productId,
      'production',
    );
    expect(allowed?.completesGoal).toBe(true);
    expect(allowed?.cost).toBe(4);
    expect(rejected).toBeNull();
  });

  it('臺灣好茶只認真正tea tag，不把咖啡當茶任務進度', () => {
    const owned = ['hsinchu-oriental-beauty-tea', 'nantou-high-mountain-tea'];
    const tea = evaluateCpuPurchase(
      cpuPurchaseState(['taipei-tieguanyin'], 15, owned),
      'taipei-tieguanyin',
      'production',
    );
    const coffee = evaluateCpuPurchase(
      cpuPurchaseState(['chiayi-coffee'], 15, owned),
      'chiayi-coffee',
      'production',
    );
    expect(tea?.completesGoal).toBe(true);
    expect(coffee?.completesGoal).toBe(false);
  });

  it('稻米達人只認rice tag，不把花生增加為稻米任務進度', () => {
    const owned = ['taoyuan-rice', 'changhua-rice', 'chiayi-rice'];
    const rice = evaluateCpuPurchase(
      cpuPurchaseState(['hualien-rice'], 15, owned),
      'hualien-rice',
      'production',
    );
    const peanut = evaluateCpuPurchase(
      cpuPurchaseState(['yunlin-peanut'], 15, owned),
      'yunlin-peanut',
      'production',
    );
    expect(rice?.completesGoal).toBe(true);
    expect(peanut?.completesGoal).toBe(false);
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

  it('出售保護已完成收藏：優先賣非必要品，只有必要品時略過', () => {
    const fourFruits = [
      'new-taipei-wendan',
      'taoyuan-persimmon',
      'hsinchu-persimmon',
      'miaoli-strawberry',
    ];
    const withAlternative = chooseCpuSale(cpuSaleState([...fourFruits, 'taoyuan-rice']));
    expect(withAlternative.kind).toBe('sale');
    if (withAlternative.kind === 'sale') expect(withAlternative.productId).toBe('taoyuan-rice');
    expect(chooseCpuSale(cpuSaleState(fourFruits)).kind).toBe('skip-sale');
  });

  it('出售市場溢價邊界：premium 1略過、premium 2可出售', () => {
    const normal = cpuSaleState(['taoyuan-rice'], 5);
    const premium = {
      ...normal,
      marketDeck: { ...normal.marketDeck, activeCardId: 'rice-demand' },
    };
    expect(chooseCpuSale(normal).kind).toBe('skip-sale');
    expect(chooseCpuSale(premium).kind).toBe('sale');
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

  it('交通會選擇最佳離島utility，而不是只選第一個合法目的地', () => {
    const decision = chooseCpuTransport(
      cpuTransportState(15, [
        'keelung-squid',
        'new-taipei-flower-crab',
        'changhua-clam',
        'chiayi-oyster',
      ]),
    );
    expect(decision.kind).toBe('transport');
    if (decision.kind === 'transport') expect(decision.destinationId).toBe('kinmen-island-stop');
  });

  it('所有離島產品都買不起時略過交通', () => {
    expect(chooseCpuTransport(cpuTransportState(0)).kind).toBe('skip-transport');
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
  expect(report.invalidGames).toBe(0);
  expect(report.deadlocks).toBe(0);
  expect(report.seatWinEquivalent).toHaveLength(4);
  expect(report.seatWinEquivalent.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
  const maxSeatShare = Math.max(...report.seatWinEquivalent);
  const minSeatShare = Math.min(...report.seatWinEquivalent);
  const seatGap = maxSeatShare - minSeatShare;
  expect(
    seatGap,
    `座位勝率差距過大：\n${report.seatWinEquivalent
      .map((value, index) => `P${index + 1}: ${(value * 100).toFixed(3)}%`)
      .join('\n')}\ngap=${(seatGap * 100).toFixed(3)}pp`,
  ).toBeLessThanOrEqual(0.08);
  expect(report.maxActions).toBeLessThan(5_000);
  expect(report.averageFunds).toBeGreaterThanOrEqual(0);
  expect(report.minFinalFunds).toBeGreaterThanOrEqual(0);
  expect(report.maxFinalFunds).toBeGreaterThanOrEqual(report.minFinalFunds);
  expect(report.averageProducts).toBeGreaterThanOrEqual(0);
  expect(report.averageLapRewardsPerPlayer).toBeGreaterThan(0);
  expect(
    Object.values(report.lapCompletionDistribution).reduce((sum, value) => sum + value, 0),
  ).toBeCloseTo(1, 8);
  expect(report.tieRate).toBeGreaterThanOrEqual(0);
  expect(report.tieRate).toBeLessThanOrEqual(1);
  expect(report.averageCompletedGoals).toBeGreaterThanOrEqual(0);
  expect(report.averagePurchasesPerPlayer).toBeGreaterThanOrEqual(0);
  expect(report.averageSalesPerPlayer).toBeGreaterThanOrEqual(0);
  expect(report.averageTransportsPerPlayer).toBeGreaterThanOrEqual(0);
  for (const goal of COLLECTION_GOALS) {
    const rate = report.collectionGoalCompletionRates[goal.id];
    expect(rate, `${goal.id} 完成率不是有限的0～1數值`).toBeGreaterThanOrEqual(0);
    expect(rate, `${goal.id} 完成率不是有限的0～1數值`).toBeLessThanOrEqual(1);
  }
  expect(Number.isFinite(report.averageScore)).toBe(true);
  expect(Number.isFinite(report.medianScore)).toBe(true);
  expect(Number.isFinite(report.scoreStdDev)).toBe(true);
}, 60_000);
