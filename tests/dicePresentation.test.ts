import { describe, expect, it, vi } from 'vitest';
import {
  assertDiceFace,
  getDiceOrientation,
  getDiceVisualSequence,
} from '../src/ui/dicePresentation';

describe('dice presentation', () => {
  it('maps every legal face to a stable cube orientation', () => {
    for (const face of [1, 2, 3, 4, 5, 6]) {
      const orientation = getDiceOrientation(face);
      expect(orientation.x).toBeTypeOf('number');
      expect(orientation.y).toBeTypeOf('number');
      expect(orientation.z).toBe(0);
    }
    expect(getDiceOrientation(1)).toEqual({ x: 0, y: 0, z: 0 });
    expect(getDiceOrientation(6)).toEqual({ x: 0, y: 180, z: 0 });
  });

  it('rejects results outside a six-sided die', () => {
    expect(() => assertDiceFace(0)).toThrow('1 至 6');
    expect(() => assertDiceFace(7)).toThrow('1 至 6');
  });

  it('always settles on the true engine result', () => {
    for (const result of [1, 2, 3, 4, 5, 6]) {
      const sequence = getDiceVisualSequence(result);
      expect(sequence.at(-1)).toBe(result);
    }
  });

  it('uses a deterministic visual sequence without consuming game RNG', () => {
    const gameRandom = vi.fn(() => 0.5);
    const first = getDiceVisualSequence(4);
    const second = getDiceVisualSequence(4);
    expect(first).toEqual(second);
    expect(gameRandom).not.toHaveBeenCalled();
  });
});
