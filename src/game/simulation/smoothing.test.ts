import { describe, expect, it } from 'vitest';
import { smoothSteering } from './smoothing';

describe('smoothSteering', () => {
  it('lags behind a sudden target change', () => {
    const result = smoothSteering({ x: 0, y: 0 }, { x: 1, y: 0 }, 1 / 60, 0.18);
    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(0.2);
    expect(result.y).toBe(0);
  });

  it('approaches the target after repeated updates', () => {
    let current = { x: 0, y: 0 };
    for (let i = 0; i < 80; i += 1) {
      current = smoothSteering(current, { x: 0.8, y: -0.4 }, 1 / 60, 0.18);
    }

    expect(current.x).toBeCloseTo(0.8, 2);
    expect(current.y).toBeCloseTo(-0.4, 2);
  });

  it('returns toward neutral when target is neutral', () => {
    const result = smoothSteering({ x: 0.7, y: -0.2 }, { x: 0, y: 0 }, 1 / 12, 0.18);
    expect(result.x).toBeLessThan(0.7);
    expect(result.y).toBeGreaterThan(-0.2);
  });
});
