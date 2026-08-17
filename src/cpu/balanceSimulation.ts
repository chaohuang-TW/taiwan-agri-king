import { COLLECTION_GOALS } from '../data/collectionGoals';
import { PRODUCTS } from '../data/products';
import {
  advanceMovementStep,
  chooseIslandPurchase,
  choosePurchase,
  chooseSale,
  chooseTransport,
  createGameWithPlayers,
  endTurn,
  rollDice,
  skipIslandPurchase,
  skipPurchase,
  skipSale,
  skipTransport,
} from '../game/engine';
import { getCompletedCollectionGoals } from '../game/collections';
import { decideCpuAction } from './cpuStrategy';
import type { GameState, RandomSource } from '../game/types';

export interface BalanceTelemetry {
  games: number;
  completedGames: number;
  invalidGames: number;
  deadlocks: number;
  seatWinEquivalent: number[];
  tieRate: number;
  averageScore: number;
  medianScore: number;
  scoreStdDev: number;
  averageFunds: number;
  minFinalFunds: number;
  maxFinalFunds: number;
  averageProducts: number;
  averageLapRewardsPerPlayer: number;
  lapCompletionDistribution: Record<string, number>;
  averageCompletedGoals: number;
  averagePurchasesPerPlayer: number;
  averageSalesPerPlayer: number;
  averageTransportsPerPlayer: number;
  collectionCompletionRate: number;
  collectionGoalCompletionRates: Record<string, number>;
  actions: { purchases: number; sales: number; transports: number; skips: number; events: number };
  maxActions: number;
}

export function seededRandom(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function applyDecision(state: GameState): {
  state: GameState;
  kind: keyof BalanceTelemetry['actions'];
} {
  const decision = decideCpuAction(state);
  switch (decision.kind) {
    case 'purchase':
      return {
        state:
          decision.source === 'production' && state.pendingAction?.kind === 'island-purchase'
            ? chooseIslandPurchase(state, decision.productId)
            : choosePurchase(state, decision.productId),
        kind: 'purchases',
      };
    case 'skip-purchase':
      return {
        state:
          state.pendingAction?.kind === 'island-purchase'
            ? skipIslandPurchase(state)
            : skipPurchase(state),
        kind: 'skips',
      };
    case 'sale':
      return { state: chooseSale(state, decision.productId), kind: 'sales' };
    case 'skip-sale':
      return { state: skipSale(state), kind: 'skips' };
    case 'transport':
      return { state: chooseTransport(state, decision.destinationId), kind: 'transports' };
    case 'skip-transport':
      return { state: skipTransport(state), kind: 'skips' };
  }
}

export function runBalanceSimulation(gameCount = 2_000): BalanceTelemetry {
  const seatWinEquivalent = [0, 0, 0, 0];
  const actions = { purchases: 0, sales: 0, transports: 0, skips: 0, events: 0 };
  let completedGames = 0;
  let ties = 0;
  let totalScore = 0;
  let totalFunds = 0;
  let minFinalFunds = Number.POSITIVE_INFINITY;
  let maxFinalFunds = Number.NEGATIVE_INFINITY;
  let totalProducts = 0;
  let totalLapRewards = 0;
  let completedGoals = 0;
  let maxActions = 0;
  const finalScores: number[] = [];
  const collectionGoalCompletions = Object.fromEntries(
    COLLECTION_GOALS.map((goal) => [goal.id, 0]),
  ) as Record<string, number>;
  const lapCompletionCounts: Record<string, number> = {};

  for (let seed = 1; seed <= gameCount; seed += 1) {
    const random = seededRandom(seed);
    let state = createGameWithPlayers(
      [1, 2, 3, 4].map((seat) => ({
        id: `player-${seat}`,
        name: `電腦${seat}`,
        controller: 'cpu' as const,
      })),
      random,
    );
    let count = 0;
    const lapRewardsByPlayer = [0, 0, 0, 0];
    while (state.phase !== 'game-over' && count < 5000) {
      const previous = state;
      switch (state.phase) {
        case 'awaiting-roll':
          state = rollDice(state, random);
          break;
        case 'moving':
          if (
            previous.movement &&
            previous.movement.stepIndex + 1 >= previous.movement.path.length &&
            previous.movement.crossedStart
          ) {
            lapRewardsByPlayer[previous.currentPlayerIndex] =
              (lapRewardsByPlayer[previous.currentPlayerIndex] ?? 0) + 1;
          }
          state = advanceMovementStep(state, random);
          if (state.phase === 'awaiting-turn-end' && state.turnSummary?.title.includes('抵達')) {
            const oldCard = previous.marketDeck.activeCardId;
            if (oldCard !== state.marketDeck.activeCardId) actions.events += 1;
          }
          break;
        case 'awaiting-purchase':
        case 'awaiting-sale':
        case 'awaiting-transport': {
          const result = applyDecision(state);
          state = result.state;
          actions[result.kind] += 1;
          break;
        }
        case 'awaiting-turn-end':
          state = endTurn(state, random);
          break;
      }
      count += 1;
      for (const player of state.players) {
        if (
          player.funds < 0 ||
          !Number.isFinite(player.funds) ||
          !Number.isFinite(player.position)
        ) {
          throw new Error(`seed ${seed} 出現無效經濟數值`);
        }
      }
    }
    if (state.phase !== 'game-over' || !state.rankings) throw new Error(`seed ${seed} 未完成遊戲`);
    completedGames += 1;
    maxActions = Math.max(maxActions, count);
    const winners = state.rankings.filter(({ rank }) => rank === 1);
    if (winners.length > 1) ties += 1;
    winners.forEach((winner) => {
      const seat = state.players.findIndex(({ id }) => id === winner.playerId);
      if (seat >= 0) seatWinEquivalent[seat] = (seatWinEquivalent[seat] ?? 0) + 1 / winners.length;
    });
    state.players.forEach((player) => {
      const ranking = state.rankings!.find(({ playerId }) => playerId === player.id)!;
      totalScore += ranking.score.total;
      finalScores.push(ranking.score.total);
      totalFunds += player.funds;
      minFinalFunds = Math.min(minFinalFunds, player.funds);
      maxFinalFunds = Math.max(maxFinalFunds, player.funds);
      totalProducts += player.productIds.length;
      const playerCompletedGoals = getCompletedCollectionGoals(player, PRODUCTS);
      completedGoals += playerCompletedGoals.length;
      for (const goal of playerCompletedGoals)
        collectionGoalCompletions[goal.id] = (collectionGoalCompletions[goal.id] ?? 0) + 1;
    });
    lapRewardsByPlayer.forEach((laps) => {
      totalLapRewards += laps;
      const key = String(laps);
      lapCompletionCounts[key] = (lapCompletionCounts[key] ?? 0) + 1;
    });
  }

  const playerCount = gameCount * 4;
  const averageScore = totalScore / playerCount;
  const sortedScores = [...finalScores].sort((a, b) => a - b);
  const middle = Math.floor(sortedScores.length / 2);
  const medianScore =
    sortedScores.length % 2 === 0
      ? ((sortedScores[middle - 1] ?? 0) + (sortedScores[middle] ?? 0)) / 2
      : (sortedScores[middle] ?? 0);
  const scoreVariance =
    finalScores.reduce((sum, score) => sum + (score - averageScore) ** 2, 0) / playerCount;
  return {
    games: gameCount,
    completedGames,
    invalidGames: 0,
    deadlocks: 0,
    seatWinEquivalent: seatWinEquivalent.map((value) => value / gameCount),
    tieRate: ties / gameCount,
    averageScore,
    medianScore,
    scoreStdDev: Math.sqrt(scoreVariance),
    averageFunds: totalFunds / playerCount,
    minFinalFunds,
    maxFinalFunds,
    averageProducts: totalProducts / playerCount,
    averageLapRewardsPerPlayer: totalLapRewards / playerCount,
    lapCompletionDistribution: Object.fromEntries(
      Object.entries(lapCompletionCounts)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([laps, count]) => [laps, count / playerCount]),
    ),
    averageCompletedGoals: completedGoals / playerCount,
    averagePurchasesPerPlayer: actions.purchases / playerCount,
    averageSalesPerPlayer: actions.sales / playerCount,
    averageTransportsPerPlayer: actions.transports / playerCount,
    collectionCompletionRate: completedGoals / (playerCount * 12),
    collectionGoalCompletionRates: Object.fromEntries(
      COLLECTION_GOALS.map((goal) => [
        goal.id,
        (collectionGoalCompletions[goal.id] ?? 0) / playerCount,
      ]),
    ),
    actions,
    maxActions,
  };
}
