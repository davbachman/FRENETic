import { describe, expect, it } from 'vitest';
import { clampSteering, smoothSteering } from './smoothing';

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

  it('matches one large step with two half steps', () => {
    const target = { x: 0.9, y: -0.3 };
    const oneStep = smoothSteering({ x: 0, y: 0 }, target, 1 / 30, 0.18);
    const halfStep = smoothSteering({ x: 0, y: 0 }, target, 1 / 60, 0.18);
    const twoHalfSteps = smoothSteering(halfStep, target, 1 / 60, 0.18);

    expect(twoHalfSteps.x).toBeCloseTo(oneStep.x, 12);
    expect(twoHalfSteps.y).toBeCloseTo(oneStep.y, 12);
  });
});

describe('clampSteering', () => {
  it('preserves in-range values in a fresh object', () => {
    const input = { x: 0.3, y: -0.4 };
    const result = clampSteering(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('normalizes over-range input to length one', () => {
    const result = clampSteering({ x: 3, y: 4 });

    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1);
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
  });

  it('neutralizes invalid or non-finite values', () => {
    expect(clampSteering({ x: Number.NaN, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(clampSteering({ x: Infinity, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(clampSteering({ x: 0, y: -Infinity })).toEqual({ x: 0, y: 0 });
  });
});
