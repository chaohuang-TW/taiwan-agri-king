import type { BoardCameraMode, BoardCameraPresentation } from './uiTypes';

export interface CameraMathInput {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  targetX: number;
  targetY: number;
  scale: number;
}

export interface CameraTransform {
  scale: number;
  x: number;
  y: number;
}

const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

function clampAxis(viewport: number, content: number, target: number, scale: number): number {
  const scaledContent = content * scale;
  if (scaledContent <= viewport) return (viewport - scaledContent) / 2;
  const ideal = viewport / 2 - target * scale;
  return Math.min(0, Math.max(viewport - scaledContent, ideal));
}

export function calculateCameraTransform(input: CameraMathInput): CameraTransform {
  const values = Object.values(input);
  if (values.some((value) => !Number.isFinite(value))) return { scale: 1, x: 0, y: 0 };
  if (
    !finitePositive(input.viewportWidth) ||
    !finitePositive(input.viewportHeight) ||
    !finitePositive(input.contentWidth) ||
    !finitePositive(input.contentHeight) ||
    !finitePositive(input.scale)
  ) {
    return { scale: 1, x: 0, y: 0 };
  }
  return {
    scale: input.scale,
    x: clampAxis(input.viewportWidth, input.contentWidth, input.targetX, input.scale),
    y: clampAxis(input.viewportHeight, input.contentHeight, input.targetY, input.scale),
  };
}

export function createCameraPresentation(): BoardCameraPresentation {
  return {
    mode: 'overview',
    focusedPlayerId: null,
    focusedPosition: null,
    scale: 1,
    x: 0,
    y: 0,
    settled: true,
    stepIndex: 0,
  };
}

export class BoardCameraController {
  readonly viewport: HTMLElement;
  readonly content: HTMLElement;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private generation = 0;
  private presentation = createCameraPresentation();

  constructor(viewport: HTMLElement, content: HTMLElement) {
    this.viewport = viewport;
    this.content = content;
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.presentation.mode === 'overview') this.settleOverview();
        else if (this.presentation.mode === 'returning') this.overview('returning');
        else this.applyCurrent();
      });
      this.resizeObserver.observe(viewport);
    }
    this.settleOverview();
  }

  get state(): BoardCameraPresentation {
    return { ...this.presentation };
  }

  focus(
    token: HTMLElement,
    mode: BoardCameraMode,
    playerId: string,
    position: number,
    stepIndex: number,
  ): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const viewportRect = this.viewport.getBoundingClientRect();
    const contentRect = this.content.getBoundingClientRect();
    const tokenRect = token.getBoundingClientRect();
    const currentScale = this.presentation.scale || 1;
    const targetX = (tokenRect.left - contentRect.left + tokenRect.width / 2) / currentScale;
    const targetY = (tokenRect.top - contentRect.top + tokenRect.height / 2) / currentScale;
    const desiredScale = reduced ? 1 : window.innerWidth <= 600 ? 1.32 : 1.72;
    const transform = reduced
      ? { scale: 1, x: 0, y: 0 }
      : calculateCameraTransform({
          viewportWidth: viewportRect.width,
          viewportHeight: viewportRect.height,
          contentWidth: this.content.offsetWidth,
          contentHeight: this.content.offsetHeight,
          targetX,
          targetY,
          scale: desiredScale,
        });
    this.presentation = {
      mode,
      focusedPlayerId: playerId,
      focusedPosition: position,
      ...transform,
      settled: false,
      stepIndex,
    };
    this.scheduleApply();
  }

  overview(mode: BoardCameraMode = 'returning'): void {
    const transform = this.getOverviewTransform();
    this.presentation = {
      ...createCameraPresentation(),
      mode,
      ...transform,
      settled: false,
    };
    this.scheduleApply();
  }

  settleOverview(): void {
    this.presentation = {
      ...createCameraPresentation(),
      ...this.getOverviewTransform(),
    };
    this.applyCurrent();
  }

  cleanup(): void {
    this.generation += 1;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.presentation = createCameraPresentation();
    this.applyCurrent();
  }

  private scheduleApply(): void {
    this.generation += 1;
    const generation = this.generation;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      if (generation !== this.generation) return;
      this.applyCurrent();
      this.rafId = null;
    });
  }

  private getOverviewTransform(): CameraTransform {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return { scale: 1, x: 0, y: 0 };
    }
    const viewportWidth = this.viewport.clientWidth;
    const viewportHeight = this.viewport.clientHeight;
    const contentWidth = this.content.offsetWidth;
    const contentHeight = this.content.offsetHeight;
    if (
      !finitePositive(viewportWidth) ||
      !finitePositive(viewportHeight) ||
      !finitePositive(contentWidth) ||
      !finitePositive(contentHeight)
    ) {
      return { scale: 1, x: 0, y: 0 };
    }
    const scale = Math.min(1, viewportWidth / contentWidth, viewportHeight / contentHeight);
    return {
      scale,
      x: (viewportWidth - contentWidth * scale) / 2,
      y: (viewportHeight - contentHeight * scale) / 2,
    };
  }

  private applyCurrent(): void {
    const state = this.presentation;
    this.content.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
    this.viewport.dataset.cameraState = state.mode;
    this.viewport.dataset.cameraScale = String(state.scale);
    this.viewport.dataset.cameraX = String(state.x);
    this.viewport.dataset.cameraY = String(state.y);
    this.viewport.dataset.cameraSettled = String(state.settled);
    this.viewport.dataset.focusedPlayerId = state.focusedPlayerId ?? '';
    this.viewport.dataset.focusedPosition = state.focusedPosition?.toString() ?? '';
    this.viewport.dataset.cameraStepIndex = String(state.stepIndex);
  }
}
