import { describe, expect, it } from 'vitest';
import { STARTING_FUNDS } from '../src/game/constants';
import {
  advanceMovementStep,
  chooseIslandPurchase,
  choosePurchase,
  chooseSale,
  chooseTransport,
  createGame,
  endTurn,
  rollDice,
  skipIslandPurchase,
  skipPurchase,
  skipSale,
  skipTransport,
} from '../src/game/engine';
import { createMovement } from '../src/game/movement';
import type { GameState, PendingAction, RandomSource } from '../src/game/types';

const zeroRandom: RandomSource = () => 0;

function atPositionBeforeRoll(state: GameState, position: number): GameState {
  return {
    ...state,
    players: state.players.map((player, index) =>
      index === state.currentPlayerIndex ? { ...player, position } : player,
    ),
  };
}

function landOneStep(state: GameState, from: number): GameState {
  return advanceMovementStep(rollDice(atPositionBeforeRoll(state, from), zeroRandom), zeroRandom);
}

describe('建立遊戲與移動', () => {
  it.each([1, 2, 4])('建立%d名真人玩家', (count) => {
    const state = createGame(count, zeroRandom);
    expect(state.players).toHaveLength(count);
    expect(state.players.map(({ id }) => id)).toEqual(
      Array.from({ length: count }, (_, index) => `player-${index + 1}`),
    );
    expect(
      state.players.every(
        ({ funds, position, productIds }) =>
          funds === STARTING_FUNDS && position === 0 && productIds.length === 0,
      ),
    ).toBe(true);
    expect(state.round).toBe(1);
    expect(state.season).toBe('spring');
    expect(state.marketDeck.activeCardId).not.toBeNull();
  });

  it('拒絕0名與5名玩家', () => {
    expect(() => createGame(0, zeroRandom)).toThrow('不得少於1人');
    expect(() => createGame(5, zeroRandom)).toThrow('不得超過4人');
  });

  it('使用自訂名稱並替空白名稱提供穩定預設值', () => {
    expect(createGame(['阿農', '  '], zeroRandom).players.map(({ name }) => name)).toEqual([
      '阿農',
      '玩家2',
    ]);
  });

  it('建立逐格主路線且最後一步才提交position', () => {
    const initial = atPositionBeforeRoll(createGame(1, zeroRandom), 23);
    const rolled = rollDice(initial, () => 0.5);
    expect(rolled.lastDiceRoll).toBe(4);
    expect(rolled.movement).toMatchObject({
      path: [24, 25, 26, 0],
      stepIndex: 0,
      destinationPosition: 0,
    });
    expect(rolled.players[0]!.position).toBe(23);

    let moving = rolled;
    for (let step = 1; step <= 3; step += 1) {
      const previous = moving;
      moving = advanceMovementStep(moving, zeroRandom);
      expect(moving.movement?.stepIndex).toBe(step);
      expect(moving.players[0]!.position).toBe(23);
      expect(previous.movement?.stepIndex).toBe(step - 1);
    }
    const arrived = advanceMovementStep(moving, zeroRandom);
    expect(arrived.players[0]!.position).toBe(0);
    expect(arrived.phase).toBe('awaiting-transport');
  });

  it('主路線循環永遠不進27至29', () => {
    expect(createMovement(26, 1).path).toEqual([0]);
    expect(createMovement(26, 6).path).toEqual([0, 1, 2, 3, 4, 5]);
    for (let start = 0; start <= 26; start += 1) {
      for (let dice = 1; dice <= 6; dice += 1) {
        expect(createMovement(start, dice).path.every((position) => position <= 26)).toBe(true);
      }
    }
  });

  it('拒絕非法骰子、離島起點與錯誤亂數', () => {
    expect(() => createMovement(0, 0)).toThrow('1至6');
    expect(() => createMovement(27, 1)).toThrow('不在主環島路線');
    expect(() => rollDice(createGame(1, zeroRandom), () => 1)).toThrow('亂數來源');
  });

  it('phase限制非法操作且不mutation舊state', () => {
    const initial = createGame(1, zeroRandom);
    const snapshot = structuredClone(initial);
    expect(() => choosePurchase(initial, 'taoyuan-rice')).toThrow('phase不是awaiting-purchase');
    const rolled = rollDice(initial, zeroRandom);
    expect(initial).toEqual(snapshot);
    expect(() => rollDice(rolled, zeroRandom)).toThrow('phase不是awaiting-roll');
    expect(() => endTurn(rolled, zeroRandom)).toThrow('phase不是awaiting-turn-end');
  });
});

describe('採購、出售與交通', () => {
  it('Production可購買1項或略過', () => {
    const pending = landOneStep(createGame(1, zeroRandom), 0);
    expect(pending.phase).toBe('awaiting-purchase');
    expect(pending.pendingAction).toMatchObject({ kind: 'purchase', source: 'production' });
    const bought = choosePurchase(pending, 'taoyuan-rice');
    expect(bought.players[0]!.funds).toBe(13);
    expect(bought.players[0]!.productIds).toEqual(['taoyuan-rice']);
    expect(bought.phase).toBe('awaiting-turn-end');
    expect(skipPurchase(pending).phase).toBe('awaiting-turn-end');
  });

  it('拒絕資金不足、錯誤產品與重複產品', () => {
    const pending = landOneStep(createGame(1, zeroRandom), 0);
    const broke = { ...pending, players: [{ ...pending.players[0]!, funds: 0 }] };
    expect(() => choosePurchase(broke, 'taoyuan-rice')).toThrow('採購金不足');
    expect(() => choosePurchase(pending, 'miaoli-strawberry')).toThrow('不屬於目前格子');
    const duplicate = {
      ...pending,
      players: [{ ...pending.players[0]!, productIds: ['taoyuan-rice'] }],
    };
    expect(() => choosePurchase(duplicate, 'taoyuan-rice')).toThrow('已持有');
  });

  it('農會固定-1並套用市場折扣，最低為1', () => {
    const pending = landOneStep(createGame(1, zeroRandom), 2);
    const localFood = {
      ...pending,
      marketDeck: { ...pending.marketDeck, activeCardId: 'local-food-channel' },
    };
    const bought = choosePurchase(localFood, 'miaoli-taro');
    expect(bought.players[0]!.funds).toBe(14);
  });

  it('next-association-discount每位玩家每張卡最多一次', () => {
    const pending = landOneStep(createGame(2, zeroRandom), 2);
    const showcase = {
      ...pending,
      marketDeck: { ...pending.marketDeck, activeCardId: 'farmers-showcase' },
    };
    const first = choosePurchase(showcase, 'miaoli-strawberry');
    expect(first.players[0]!.funds).toBe(13);
    expect(first.marketCardUsageByPlayer).toEqual(['player-1']);

    const secondPending: GameState = {
      ...first,
      phase: 'awaiting-purchase',
      pendingAction: pending.pendingAction,
      players: first.players.map((player, index) =>
        index === 0 ? { ...player, productIds: [] } : player,
      ),
    };
    expect(choosePurchase(secondPending, 'miaoli-strawberry').players[0]!.funds).toBe(10);

    const otherPlayer: GameState = {
      ...showcase,
      currentPlayerIndex: 1,
      players: showcase.players.map((player, index) =>
        index === 1 ? { ...player, position: 3 } : player,
      ),
    };
    expect(choosePurchase(otherPlayer, 'miaoli-strawberry').players[1]!.funds).toBe(13);
  });

  it('漁會只列出並允許水產', () => {
    const pending = landOneStep(createGame(1, zeroRandom), 11);
    expect(pending.pendingAction).toMatchObject({ productIds: ['pingtung-bluefin-tuna'] });
    const invalid: GameState = {
      ...pending,
      pendingAction: {
        ...(pending.pendingAction as Extract<PendingAction, { kind: 'purchase' }>),
        productIds: ['pingtung-pineapple'],
      },
    };
    expect(() => choosePurchase(invalid, 'pingtung-pineapple')).toThrow('漁會只能購買水產');
  });

  it('市場出售1項並依季節與市場卡增加funds', () => {
    const pending = landOneStep(createGame(1, zeroRandom), 6);
    const saleState: GameState = {
      ...pending,
      season: 'summer',
      marketDeck: { ...pending.marketDeck, activeCardId: 'fruit-best-seller' },
      players: [{ ...pending.players[0]!, productIds: ['tainan-mango'] }],
    };
    const sold = chooseSale(saleState, 'tainan-mango');
    expect(sold.players[0]!.funds).toBe(25);
    expect(sold.players[0]!.productIds).toEqual([]);
    expect(() => chooseSale(saleState, 'taoyuan-rice')).toThrow('沒有持有');
    expect(skipSale(pending).phase).toBe('awaiting-turn-end');
  });

  it('交通離島採購後回到原交通格', () => {
    const transport = landOneStep(createGame(1, zeroRandom), 12);
    expect(transport.phase).toBe('awaiting-transport');
    expect(() => chooseTransport(transport, 'matsu-island-stop')).toThrow('不屬於此交通格');
    const island = chooseTransport(transport, 'penghu-island-stop');
    expect(island.temporaryDestinationId).toBe('penghu-island-stop');
    expect(island.players[0]!.position).toBe(13);
    const bought = chooseIslandPurchase(island, 'penghu-cobia');
    expect(bought.temporaryDestinationId).toBeNull();
    expect(bought.players[0]!.position).toBe(13);
    expect(bought.players[0]!.productIds).toContain('penghu-cobia');

    const skipped = skipIslandPurchase(island);
    expect(skipped.temporaryDestinationId).toBeNull();
    expect(endTurn(skipped, zeroRandom).players[0]!.position).toBe(13);
    expect(skipTransport(transport).phase).toBe('awaiting-turn-end');
  });
});

describe('Round與Season', () => {
  const readyToEnd = (count: number, round = 1, currentPlayerIndex = 0): GameState => ({
    ...createGame(count, zeroRandom),
    phase: 'awaiting-turn-end',
    round,
    season: round <= 3 ? 'spring' : round <= 6 ? 'summer' : round <= 9 ? 'autumn' : 'winter',
    currentPlayerIndex,
  });

  it('2人依序完成後才進Round 2', () => {
    const p2 = endTurn(readyToEnd(2), zeroRandom);
    expect(p2.currentPlayerIndex).toBe(1);
    expect(p2.round).toBe(1);
    const round2 = endTurn({ ...p2, phase: 'awaiting-turn-end' }, zeroRandom);
    expect(round2.currentPlayerIndex).toBe(0);
    expect(round2.round).toBe(2);
  });

  it('4人只有P4結束才換輪', () => {
    const state = readyToEnd(4, 1, 2);
    expect(endTurn(state, zeroRandom).round).toBe(1);
    expect(endTurn(readyToEnd(4, 1, 3), zeroRandom).round).toBe(2);
  });

  it.each([
    [3, 'summer'],
    [6, 'autumn'],
    [9, 'winter'],
  ] as const)('Round %d結束後切換季節為%s', (round, season) => {
    expect(endTurn(readyToEnd(1, round), zeroRandom).season).toBe(season);
  });

  it('Round 12最後玩家結束後game-over且不能再動作', () => {
    const over = endTurn(readyToEnd(2, 12, 1), zeroRandom);
    expect(over.phase).toBe('game-over');
    expect(over.completed).toBe(true);
    expect(over.rankings).toHaveLength(2);
    expect(() => rollDice(over, zeroRandom)).toThrow('遊戲已結束');
  });
});
