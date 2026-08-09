import { describe, expect, it } from 'vitest';
import { createGame, rollDice } from '../src/game/engine';
import { getUiPhaseForGameState } from '../src/ui/presentation';

describe('UI presentation mapping', () => {
  it('maps moving state to following', () => {
    const moving = rollDice(
      createGame(1, () => 0),
      () => 0,
    );
    expect(getUiPhaseForGameState(moving, false)).toBe('following');
  });

  it('holds action UI while camera returns and exposes it when settled', () => {
    const state = {
      ...createGame(1, () => 0),
      phase: 'awaiting-purchase' as const,
    };
    expect(getUiPhaseForGameState(state, false)).toBe('returning');
    expect(getUiPhaseForGameState(state, true)).toBe('idle');
  });

  it('maps game over to idle so cleanup can own camera teardown', () => {
    const state = { ...createGame(1, () => 0), phase: 'game-over' as const, completed: true };
    expect(getUiPhaseForGameState(state, false)).toBe('idle');
  });
});
