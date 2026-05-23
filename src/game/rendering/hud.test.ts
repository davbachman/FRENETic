import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { CurveSample } from '../curves/types';
import { getRadarRect } from '../input/pointerTrackpad';
import {
  calculateMeterGeometry,
  calculateMinimapProjection,
  calculateRadarHudRect,
  calculateTorsionArc,
} from './hud';

function sample(index: number, x: number, y: number): CurveSample {
  return {
    index,
    t: index / 4,
    position: new Vector3(x, y, 0),
    tangent: new Vector3(1, 0, 0),
    normal: new Vector3(0, 1, 0),
    binormal: new Vector3(0, 0, 1),
    curvature: 0,
    torsion: 0,
    arcLength: index,
  };
}

describe('HUD overlay helpers', () => {
  it('normalizes meter indicators and acceptable bands into clamped track coordinates', () => {
    const geometry = calculateMeterGeometry(0.375, [0.25, 0.5], 0.75);

    expect(geometry.indicator).toBeCloseTo(0.5);
    expect(geometry.acceptableStart).toBeCloseTo(1 / 3);
    expect(geometry.acceptableEnd).toBeCloseTo(2 / 3);
  });

  it('clamps meter values outside the configured range', () => {
    expect(calculateMeterGeometry(5, [0.2, 0.4], 1).indicator).toBe(1);
    expect(calculateMeterGeometry(-5, [0.2, 0.4], 1).indicator).toBe(0);
  });

  it('uses the same radar rectangle as pointer input for HUD drawing', () => {
    expect(calculateRadarHudRect(1000, 700)).toEqual(getRadarRect(1000, 700));
  });

  it('projects minimap samples into a padded square while preserving nearest sample identity', () => {
    const samples = [
      sample(0, -2, -1),
      sample(1, 2, -1),
      sample(2, 2, 1),
      sample(3, -2, 1),
    ];

    const projection = calculateMinimapProjection(samples, samples[2], {
      x: 20,
      y: 300,
      width: 200,
      height: 160,
    });

    expect(projection.points).toHaveLength(samples.length);
    expect(projection.points[0].x).toBeCloseTo(36);
    expect(projection.points[0].y).toBeCloseTo(422);
    expect(projection.points[2].x).toBeCloseTo(204);
    expect(projection.points[2].y).toBeCloseTo(338);
    expect(projection.nearest).toEqual(projection.points[2]);
  });

  it('derives torsion circular-arrow direction and opacity from signed torsion', () => {
    expect(calculateTorsionArc(0.4, [-0.8, 0.8])).toEqual({
      direction: 1,
      opacity: 0.5,
    });
    expect(calculateTorsionArc(-0.2, [-0.8, 0.8])).toEqual({
      direction: -1,
      opacity: 0.25,
    });
    expect(calculateTorsionArc(0, [-0.8, 0.8])).toEqual({
      direction: 1,
      opacity: 0,
    });
  });
});
