export type DiceFace = 1 | 2 | 3 | 4 | 5 | 6;

export type DiceAnimationState =
  | 'hidden'
  | 'entering'
  | 'rolling'
  | 'settling'
  | 'result'
  | 'exiting';

export interface DiceOrientation {
  x: number;
  y: number;
  z: number;
}

export interface DicePresentationDurations {
  entering: number;
  rolling: number;
  settling: number;
  result: number;
  exiting: number;
}

export const DICE_VISUAL_SEQUENCE: readonly DiceFace[] = [1, 4, 2, 6, 3, 5];

const DICE_DOT_POSITIONS: Record<DiceFace, readonly number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const DICE_ORIENTATIONS: Record<DiceFace, DiceOrientation> = {
  1: { x: 0, y: 0, z: 0 },
  2: { x: 90, y: 0, z: 0 },
  3: { x: 0, y: -90, z: 0 },
  4: { x: 0, y: 90, z: 0 },
  5: { x: -90, y: 0, z: 0 },
  6: { x: 0, y: 180, z: 0 },
};

const DEFAULT_DURATIONS: DicePresentationDurations = {
  entering: 110,
  rolling: 560,
  settling: 200,
  result: 300,
  exiting: 140,
};

const TEST_DURATIONS: DicePresentationDurations = {
  entering: 20,
  rolling: 65,
  settling: 25,
  result: 40,
  exiting: 20,
};

function isDiceFace(value: number): value is DiceFace {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export function assertDiceFace(value: number): DiceFace {
  if (!isDiceFace(value)) throw new Error('骰子結果必須為 1 至 6。');
  return value;
}

export function getDiceOrientation(face: number): DiceOrientation {
  return { ...DICE_ORIENTATIONS[assertDiceFace(face)] };
}

export function getDiceVisualSequence(result: number): DiceFace[] {
  return [...DICE_VISUAL_SEQUENCE, assertDiceFace(result)];
}

export function getDiceDotPositions(face: number): readonly number[] {
  return DICE_DOT_POSITIONS[assertDiceFace(face)];
}

function renderFace(face: DiceFace): string {
  const activeDots = new Set(getDiceDotPositions(face));
  const dots = Array.from({ length: 9 }, (_, index) => {
    const position = index + 1;
    return activeDots.has(position)
      ? `<span class="dice-dot" data-dot-position="${position}"></span>`
      : '<span aria-hidden="true"></span>';
  }).join('');
  return `<div class="dice-cube-face dice-cube-face-${face}" data-dice-face="${face}" aria-hidden="true"><span class="dice-face-dots">${dots}</span></div>`;
}

export interface DiceAnimationOptions {
  testMode?: boolean;
  durations?: Partial<DicePresentationDurations>;
  document?: Document;
}

/**
 * UI-only dice presentation. The engine result is supplied by the caller and
 * this controller never reads or advances a game RandomSource.
 */
export class DiceAnimationController {
  private readonly document: Document;
  private readonly testMode: boolean;
  private readonly durations: DicePresentationDurations;
  private overlay: HTMLElement | null = null;
  private timer: number | null = null;
  private generation = 0;
  private pendingResolve: (() => void) | null = null;

  constructor(
    private readonly host: HTMLElement,
    options: DiceAnimationOptions = {},
  ) {
    this.document = options.document ?? host.ownerDocument;
    this.testMode = options.testMode ?? false;
    const defaults = this.testMode ? TEST_DURATIONS : DEFAULT_DURATIONS;
    this.durations = { ...defaults, ...options.durations };
  }

  show(result: number, playerId = '', playerName = ''): Promise<void> {
    const finalFace = assertDiceFace(result);
    this.cleanup();
    const generation = this.generation;
    const sequence = getDiceVisualSequence(finalFace);
    const overlay = this.document.createElement('div');
    overlay.className = 'dice-overlay';
    overlay.dataset.testid = 'dice-overlay';
    overlay.dataset.diceResult = String(finalFace);
    overlay.dataset.dicePlayerId = playerId;
    overlay.dataset.diceState = 'hidden';
    overlay.dataset.diceVisualFace = '';
    overlay.setAttribute('aria-label', '骰子動畫');
    overlay.innerHTML = `<div class="dice-stage"><div class="dice-cube" data-testid="dice-cube">${(
      [1, 2, 3, 4, 5, 6] as DiceFace[]
    )
      .map(renderFace)
      .join('')}</div></div><p class="dice-result-label" aria-live="polite"></p>`;
    this.host.append(overlay);
    this.overlay = overlay;

    return new Promise<void>((resolve) => {
      this.pendingResolve = resolve;
      const setState = (state: DiceAnimationState, face: DiceFace): void => {
        if (generation !== this.generation || !this.overlay) return;
        const current = this.overlay;
        current.dataset.diceState = state;
        current.dataset.diceVisualFace = String(face);
        current.classList.toggle('is-visible', state !== 'hidden');
        const cube = current.querySelector<HTMLElement>('.dice-cube');
        if (cube) {
          const orientation = getDiceOrientation(face);
          cube.style.setProperty('--dice-rx', `${orientation.x}deg`);
          cube.style.setProperty('--dice-ry', `${orientation.y}deg`);
          cube.style.setProperty('--dice-rz', `${orientation.z}deg`);
          cube.dataset.diceVisualFace = String(face);
        }
        const label = current.querySelector<HTMLElement>('.dice-result-label');
        if (label) {
          label.textContent =
            state === 'result' ? `${playerName ? `${playerName} ` : ''}骰出 ${finalFace} 點` : '';
        }
      };
      const finish = (): void => {
        if (generation !== this.generation) return;
        setState('hidden', finalFace);
        after(0, () => {
          if (generation !== this.generation) return;
          this.timer = null;
          this.overlay?.remove();
          this.overlay = null;
          const pending = this.pendingResolve;
          this.pendingResolve = null;
          pending?.();
        });
      };
      const after = (duration: number, callback: () => void): void => {
        this.timer =
          this.document.defaultView?.setTimeout(callback, this.motionDuration(duration)) ?? null;
      };
      const reducedMotion =
        this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
        false;
      const visualDurations = reducedMotion
        ? { entering: 20, rolling: 0, settling: 20, result: 80, exiting: 20 }
        : this.durations;

      setState('entering', sequence[0]!);
      after(visualDurations.entering, () => {
        setState('rolling', sequence[1]!);
        after(visualDurations.rolling, () => {
          setState('settling', sequence[2]!);
          after(visualDurations.settling, () => {
            setState('result', finalFace);
            after(visualDurations.result, () => {
              setState('exiting', finalFace);
              after(visualDurations.exiting, finish);
            });
          });
        });
      });
    });
  }

  cleanup(): void {
    this.generation += 1;
    if (this.timer !== null) {
      this.document.defaultView?.clearTimeout(this.timer);
      this.timer = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    const pending = this.pendingResolve;
    this.pendingResolve = null;
    pending?.();
  }

  private motionDuration(duration: number): number {
    return this.testMode ? Math.min(duration, 200) : duration;
  }
}
