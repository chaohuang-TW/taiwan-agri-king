import { SEASON_BY_ROUND } from '../data/seasons';
import { LAP_COMPLETION_REWARD, STARTING_FUNDS, TOTAL_ROUNDS } from './constants';
import {
  createMarketDeck,
  getCurrentProductValue,
  getCurrentPurchaseCost,
  replaceActiveMarketCard,
} from './market';
import { createMovement } from './movement';
import { defaultRandomSource, rollSixSidedDie } from './random';
import { rankPlayers } from './scoring';
import {
  getActiveMarketCard,
  getCurrentPlayer,
  getProductById,
  getTileById,
  getTileByPosition,
} from './selectors';
import type {
  GamePhase,
  GameState,
  PendingAction,
  PlayerState,
  PurchaseSource,
  PlayerController,
  RandomSource,
  TurnSummary,
} from './types';

export interface PlayerConfig {
  id?: string;
  name: string;
  controller?: PlayerController;
}

function assertActionAllowed(state: GameState, phase: GamePhase, action: string): void {
  if (state.completed || state.phase === 'game-over') throw new Error('遊戲已結束。');
  if (state.phase !== phase) throw new Error(`目前phase不是${phase}，不能${action}。`);
}

function updateCurrentPlayer(state: GameState, player: PlayerState): GameState {
  const players = state.players.map((candidate, index) =>
    index === state.currentPlayerIndex ? player : candidate,
  );
  return { ...state, players };
}

function awaitingTurnEnd(state: GameState, summary: TurnSummary): GameState {
  return {
    ...state,
    phase: 'awaiting-turn-end',
    pendingAction: null,
    temporaryDestinationId: null,
    turnSummary: summary,
  };
}

function replaceMarketCard(state: GameState, random: RandomSource): GameState {
  return {
    ...state,
    marketDeck: replaceActiveMarketCard(state.marketDeck, random),
    marketCardUsageByPlayer: [],
  };
}

function getPurchasePending(state: GameState): Extract<PendingAction, { kind: 'purchase' }> {
  const pending = state.pendingAction;
  if (pending?.kind !== 'purchase') throw new Error('目前沒有一般採購選擇。');
  return pending;
}

function getLapRewardLines(state: GameState): string[] {
  return (state.turnSummary?.lines ?? []).filter(
    (line) => line.startsWith('完成環島一圈！') || line.startsWith('目前採購金'),
  );
}

function usesAvailableAssociationDiscount(state: GameState, source: PurchaseSource): boolean {
  return (
    source === 'farmers-association' &&
    getActiveMarketCard(state)?.effect.kind === 'next-association-discount' &&
    !state.marketCardUsageByPlayer.includes(getCurrentPlayer(state).id)
  );
}

function purchaseProduct(
  state: GameState,
  productId: string,
  productIds: string[],
  source: PurchaseSource,
  title: string,
): GameState {
  if (!productIds.includes(productId)) throw new Error('產品不屬於目前格子。');
  const player = getCurrentPlayer(state);
  if (player.productIds.includes(productId)) throw new Error('玩家已持有此產品。');
  const product = getProductById(productId);
  if (source === 'fishers-association' && product.category !== 'seafood') {
    throw new Error('漁會只能購買水產。');
  }

  const useAssociationDiscount = usesAvailableAssociationDiscount(state, source);
  const cost = getCurrentPurchaseCost(
    product,
    source,
    getActiveMarketCard(state),
    useAssociationDiscount,
  );
  if (player.funds < cost) throw new Error('玩家採購金不足。');

  const nextPlayer = {
    ...player,
    funds: player.funds - cost,
    productIds: [...player.productIds, productId],
  };
  let next = updateCurrentPlayer(state, nextPlayer);
  if (useAssociationDiscount) {
    next = {
      ...next,
      marketCardUsageByPlayer: [...next.marketCardUsageByPlayer, player.id],
    };
  }
  return awaitingTurnEnd(next, {
    title,
    lines: [
      ...getLapRewardLines(state),
      `購買${product.name}，花費${cost}採購金`,
      `目前剩餘${nextPlayer.funds}採購金`,
    ],
  });
}

function resolveArrival(
  state: GameState,
  random: RandomSource,
  lapRewardLines: string[] = [],
): GameState {
  const player = getCurrentPlayer(state);
  const tile = getTileByPosition(player.position);
  const arrival = `抵達${tile.name}`;
  switch (tile.type) {
    case 'production':
    case 'farmers-association':
    case 'fishers-association': {
      const source = tile.type;
      const productIds = (tile.productIds ?? []).filter((id) =>
        source === 'fishers-association' ? getProductById(id).category === 'seafood' : true,
      );
      return {
        ...state,
        phase: 'awaiting-purchase',
        pendingAction: { kind: 'purchase', tileId: tile.id, productIds, source },
        turnSummary: { title: arrival, lines: [...lapRewardLines, '可購買0或1項產品'] },
      };
    }
    case 'market':
      return {
        ...state,
        phase: 'awaiting-sale',
        pendingAction: { kind: 'sale', tileId: tile.id },
        turnSummary: { title: arrival, lines: [...lapRewardLines, '可出售0或1項持有產品'] },
      };
    case 'transport':
      return {
        ...state,
        phase: 'awaiting-transport',
        pendingAction: {
          kind: 'transport',
          tileId: tile.id,
          destinationIds: [...(tile.transportDestinationIds ?? [])],
        },
        turnSummary: { title: arrival, lines: [...lapRewardLines, '可選擇一次離島特別行程'] },
      };
    case 'event': {
      const next = replaceMarketCard(state, random);
      const card = getActiveMarketCard(next);
      return awaitingTurnEnd(next, {
        title: arrival,
        lines: [...lapRewardLines, `市場卡更新為「${card?.title ?? '無'}」`],
      });
    }
  }
}

export function createGameWithPlayers(
  playerConfigs: PlayerConfig[],
  random: RandomSource = defaultRandomSource,
): GameState {
  if (playerConfigs.length < 1) throw new Error('玩家人數不得少於1人。');
  if (playerConfigs.length > 4) throw new Error('玩家人數不得超過4人。');
  const ids = playerConfigs.map((config, index) => config.id?.trim() || `player-${index + 1}`);
  if (new Set(ids).size !== ids.length) throw new Error('玩家ID必須穩定且唯一。');

  return {
    phase: 'awaiting-roll',
    round: 1,
    season: 'spring',
    players: playerConfigs.map((config, index) => ({
      id: ids[index]!,
      name: config.name.trim() || `玩家${index + 1}`,
      position: 0,
      funds: STARTING_FUNDS,
      productIds: [],
      controller: config.controller ?? 'human',
    })),
    currentPlayerIndex: 0,
    marketDeck: createMarketDeck(random),
    marketCardUsageByPlayer: [],
    movement: null,
    pendingAction: null,
    temporaryDestinationId: null,
    lastDiceRoll: null,
    turnSummary: { title: '遊戲開始', lines: ['Round 1・春'] },
    completed: false,
    rankings: null,
  };
}

export function createGame(
  playerNames: string[] | number,
  random: RandomSource = defaultRandomSource,
): GameState {
  const names =
    typeof playerNames === 'number'
      ? Array.from({ length: playerNames }, (_, index) => `玩家${index + 1}`)
      : playerNames;
  return createGameWithPlayers(
    names.map((name) => ({ name, controller: 'human' })),
    random,
  );
}

export function rollDice(state: GameState, random: RandomSource = defaultRandomSource): GameState {
  assertActionAllowed(state, 'awaiting-roll', '擲骰');
  const dice = rollSixSidedDie(random);
  const player = getCurrentPlayer(state);
  return {
    ...state,
    phase: 'moving',
    lastDiceRoll: dice,
    movement: createMovement(player.position, dice),
    pendingAction: null,
    turnSummary: { title: `${player.name}擲出${dice}點`, lines: ['準備逐格前進'] },
  };
}

export function advanceMovementStep(
  state: GameState,
  random: RandomSource = defaultRandomSource,
): GameState {
  assertActionAllowed(state, 'moving', '前進');
  const movement = state.movement;
  if (!movement) throw new Error('目前沒有移動資料。');
  const stepIndex = movement.stepIndex + 1;
  const nextMovement = { ...movement, stepIndex };
  if (stepIndex < movement.path.length) return { ...state, movement: nextMovement };

  const currentPlayer = getCurrentPlayer(state);
  const lapReward = movement.crossedStart ? LAP_COMPLETION_REWARD : 0;
  const player = {
    ...currentPlayer,
    position: movement.destinationPosition,
    funds: currentPlayer.funds + lapReward,
  };
  const lapRewardLines = lapReward
    ? [`完成環島一圈！獲得${LAP_COMPLETION_REWARD}採購金`, `目前採購金${player.funds}`]
    : [];
  return resolveArrival(
    updateCurrentPlayer({ ...state, movement: nextMovement }, player),
    random,
    lapRewardLines,
  );
}

export function choosePurchase(state: GameState, productId: string): GameState {
  assertActionAllowed(state, 'awaiting-purchase', '購買');
  const pending = getPurchasePending(state);
  const tile = getTileById(pending.tileId);
  return purchaseProduct(state, productId, pending.productIds, pending.source, `抵達${tile.name}`);
}

export function skipPurchase(state: GameState): GameState {
  assertActionAllowed(state, 'awaiting-purchase', '略過採購');
  const pending = getPurchasePending(state);
  const tile = getTileById(pending.tileId);
  return awaitingTurnEnd(state, {
    title: `抵達${tile.name}`,
    lines: [...getLapRewardLines(state), '略過採購'],
  });
}

export function chooseSale(state: GameState, productId: string): GameState {
  assertActionAllowed(state, 'awaiting-sale', '出售');
  if (state.pendingAction?.kind !== 'sale') throw new Error('目前不是市場格，不能出售。');
  const player = getCurrentPlayer(state);
  if (!player.productIds.includes(productId)) throw new Error('玩家沒有持有此產品。');
  const product = getProductById(productId);
  const value = getCurrentProductValue(product, state.season, getActiveMarketCard(state));
  const nextPlayer = {
    ...player,
    funds: player.funds + value,
    productIds: player.productIds.filter((id) => id !== productId),
  };
  const tile = getTileById(state.pendingAction.tileId);
  return awaitingTurnEnd(updateCurrentPlayer(state, nextPlayer), {
    title: `抵達${tile.name}`,
    lines: [...getLapRewardLines(state), `出售${product.name}，獲得${value}採購金`],
  });
}

export function skipSale(state: GameState): GameState {
  assertActionAllowed(state, 'awaiting-sale', '略過出售');
  if (state.pendingAction?.kind !== 'sale') throw new Error('目前不是市場格，不能略過出售。');
  const tile = getTileById(state.pendingAction.tileId);
  return awaitingTurnEnd(state, {
    title: `抵達${tile.name}`,
    lines: [...getLapRewardLines(state), '略過出售'],
  });
}

export function chooseTransport(state: GameState, destinationTileId: string): GameState {
  assertActionAllowed(state, 'awaiting-transport', '選擇交通目的地');
  const pending = state.pendingAction;
  if (pending?.kind !== 'transport') throw new Error('目前不是交通格。');
  if (!pending.destinationIds.includes(destinationTileId))
    throw new Error('目的地不屬於此交通格。');
  const destination = getTileById(destinationTileId);
  if (destination.type !== 'production' || destination.position < 27) {
    throw new Error('交通目的地必須是離島產地格。');
  }
  return {
    ...state,
    phase: 'awaiting-purchase',
    temporaryDestinationId: destinationTileId,
    pendingAction: {
      kind: 'island-purchase',
      sourceTileId: pending.tileId,
      destinationTileId,
      productIds: [...(destination.productIds ?? [])],
    },
    turnSummary: {
      title: `前往${destination.name}`,
      lines: [...getLapRewardLines(state), '可購買0或1項離島產品'],
    },
  };
}

export function skipTransport(state: GameState): GameState {
  assertActionAllowed(state, 'awaiting-transport', '略過交通');
  if (state.pendingAction?.kind !== 'transport') throw new Error('目前不是交通格。');
  const tile = getTileById(state.pendingAction.tileId);
  return awaitingTurnEnd(state, {
    title: `抵達${tile.name}`,
    lines: [...getLapRewardLines(state), '略過離島行程'],
  });
}

export function chooseIslandPurchase(state: GameState, productId: string): GameState {
  assertActionAllowed(state, 'awaiting-purchase', '購買離島產品');
  const pending = state.pendingAction;
  if (pending?.kind !== 'island-purchase') throw new Error('目前沒有離島採購選擇。');
  const destination = getTileById(pending.destinationTileId);
  return purchaseProduct(
    state,
    productId,
    pending.productIds,
    'production',
    `前往${destination.name}`,
  );
}

export function skipIslandPurchase(state: GameState): GameState {
  assertActionAllowed(state, 'awaiting-purchase', '略過離島採購');
  const pending = state.pendingAction;
  if (pending?.kind !== 'island-purchase') throw new Error('目前沒有離島採購選擇。');
  const destination = getTileById(pending.destinationTileId);
  return awaitingTurnEnd(state, {
    title: `前往${destination.name}`,
    lines: [...getLapRewardLines(state), '略過離島採購'],
  });
}

export function endTurn(state: GameState, random: RandomSource = defaultRandomSource): GameState {
  assertActionAllowed(state, 'awaiting-turn-end', '結束回合');
  const lastPlayer = state.currentPlayerIndex === state.players.length - 1;
  if (!lastPlayer) {
    return {
      ...state,
      phase: 'awaiting-roll',
      currentPlayerIndex: state.currentPlayerIndex + 1,
      movement: null,
      pendingAction: null,
      temporaryDestinationId: null,
      lastDiceRoll: null,
    };
  }

  if (state.round === TOTAL_ROUNDS) {
    const rankings = rankPlayers(state.players, 'winter', getActiveMarketCard(state));
    return {
      ...state,
      phase: 'game-over',
      completed: true,
      rankings,
      movement: null,
      pendingAction: null,
      temporaryDestinationId: null,
      turnSummary: {
        title: '遊戲結束',
        lines: [
          `冠軍：${rankings
            .filter(({ rank }) => rank === 1)
            .map(({ playerName }) => playerName)
            .join('、')}`,
        ],
      },
    };
  }

  const nextRound = state.round + 1;
  const next = replaceMarketCard(state, random);
  return {
    ...next,
    phase: 'awaiting-roll',
    round: nextRound,
    season: SEASON_BY_ROUND[nextRound]!,
    currentPlayerIndex: 0,
    movement: null,
    pendingAction: null,
    temporaryDestinationId: null,
    lastDiceRoll: null,
    turnSummary: { title: `Round ${nextRound}`, lines: [`季節：${SEASON_BY_ROUND[nextRound]}`] },
  };
}

export { getCurrentProductValue, getCurrentPurchaseCost } from './market';
export { evaluateCollectionGoal, getCompletedCollectionGoals } from './collections';
export { calculateFinalScore, rankPlayers } from './scoring';
