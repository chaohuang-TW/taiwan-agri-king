import { describe, expect, it } from 'vitest';
import { calculateCameraTransform } from '../src/ui/boardCamera';

const base = {
  viewportWidth: 400,
  viewportHeight: 300,
  contentWidth: 800,
  contentHeight: 600,
  targetX: 400,
  targetY: 300,
  scale: 1,
};

describe('board camera math', () => {
  it('scale 1 centers target', () => {
    expect(calculateCameraTransform(base)).toEqual({ scale: 1, x: -200, y: -150 });
  });

  it('centers a target at larger scale', () => {
    expect(calculateCameraTransform({ ...base, scale: 2 })).toEqual({ scale: 2, x: -600, y: -450 });
  });

  it('clamps the left edge', () => {
    expect(calculateCameraTransform({ ...base, targetX: 0, scale: 2 }).x).toBe(0);
  });

  it('clamps the right edge', () => {
    expect(calculateCameraTransform({ ...base, targetX: 800, scale: 2 }).x).toBe(-1200);
  });

  it('clamps the top edge', () => {
    expect(calculateCameraTransform({ ...base, targetY: 0, scale: 2 }).y).toBe(0);
  });

  it('clamps the bottom edge', () => {
    expect(calculateCameraTransform({ ...base, targetY: 600, scale: 2 }).y).toBe(-900);
  });

  it('centers content smaller than the viewport', () => {
    expect(calculateCameraTransform({ ...base, contentWidth: 200, contentHeight: 100 })).toEqual({
      scale: 1,
      x: 100,
      y: 100,
    });
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('falls back for %s', (_, value) => {
    expect(calculateCameraTransform({ ...base, targetX: value })).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it.each(['viewportWidth', 'viewportHeight', 'contentWidth', 'contentHeight'] as const)(
    'falls back for zero %s',
    (key) => {
      expect(calculateCameraTransform({ ...base, [key]: 0 })).toEqual({ scale: 1, x: 0, y: 0 });
    },
  );
});
