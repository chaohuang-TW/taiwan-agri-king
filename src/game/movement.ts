import { MAIN_ROUTE_POSITIONS } from './constants';
import type { MovementPresentation } from './types';

export function createMovement(startPosition: number, dice: number): MovementPresentation {
  const routeIndex = MAIN_ROUTE_POSITIONS.indexOf(startPosition);
  if (routeIndex < 0) throw new Error(`起始位置 ${startPosition} 不在主環島路線。`);
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new Error('骰子點數必須介於1至6。');

  const path = Array.from(
    { length: dice },
    (_, step) => MAIN_ROUTE_POSITIONS[(routeIndex + step + 1) % MAIN_ROUTE_POSITIONS.length]!,
  );
  return {
    startPosition,
    dice,
    path,
    crossedStart: path.includes(0),
    stepIndex: 0,
    destinationPosition: path.at(-1)!,
  };
}
