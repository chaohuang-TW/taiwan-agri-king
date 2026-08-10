import type { GameState } from '../game/types';
import type { UiPhase } from './uiTypes';

export function getUiPhaseForGameState(state: GameState, cameraSettled: boolean): UiPhase {
  if (state.phase === 'moving') return 'following';
  if (
    state.phase === 'awaiting-purchase' ||
    state.phase === 'awaiting-sale' ||
    state.phase === 'awaiting-transport'
  ) {
    return cameraSettled ? 'idle' : 'returning';
  }
  if (state.phase === 'game-over') return 'idle';
  return 'idle';
}
