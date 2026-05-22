import { describe, expect, it } from 'vitest';
import { getRadarRect, normalizePointerToTrackpad } from './pointerTrackpad';

describe('pointer trackpad mapping', () => {
  it('places the radar in the bottom-right corner', () => {
    const rect = getRadarRect(1200, 800);
    expect(rect.x).toBeGreaterThan(800);
    expect(rect.y).toBeGreaterThan(500);
    expect(rect.width).toBe(rect.height);
  });

  it('maps the center to neutral steering', () => {
    const rect = getRadarRect(1000, 700);
    const steering = normalizePointerToTrackpad(rect.x + rect.width / 2, rect.y + rect.height / 2, rect);
    expect(steering.x).toBeCloseTo(0);
    expect(steering.y).toBeCloseTo(0);
  });

  it('maps right and up to positive x and positive y steering', () => {
    const rect = getRadarRect(1000, 700);
    const steering = normalizePointerToTrackpad(rect.x + rect.width, rect.y, rect);
    expect(steering.x).toBeGreaterThan(0.6);
    expect(steering.y).toBeGreaterThan(0.6);
    expect(Math.hypot(steering.x, steering.y)).toBeLessThanOrEqual(1);
  });
});
