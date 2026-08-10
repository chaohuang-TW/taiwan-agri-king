import type { GameState } from '../game/types';

export type UiPhase =
  | 'idle'
  | 'showing-dice'
  | 'camera-focus'
  | 'following'
  | 'arrival'
  | 'returning';

export type BoardCameraMode = 'overview' | 'focus-player' | 'following' | 'arrival' | 'returning';

export interface BoardCameraPresentation {
  mode: BoardCameraMode;
  focusedPlayerId: string | null;
  focusedPosition: number | null;
  scale: number;
  x: number;
  y: number;
  settled: boolean;
  stepIndex: number;
}

export interface UiPresentationState {
  phase: UiPhase;
  locked: boolean;
  diceFace: number | null;
  eventCardVisible: boolean;
  handoffPlayerName: string | null;
}

export function createUiPresentation(): UiPresentationState {
  return {
    phase: 'idle',
    locked: false,
    diceFace: null,
    eventCardVisible: false,
    handoffPlayerName: null,
  };
}

export interface TestScenarioOptions {
  game: GameState;
  diceRandom: () => number;
}
