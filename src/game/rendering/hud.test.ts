import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { CurveSample } from '../curves/types';
import { getRadarRect } from '../input/pointerTrackpad';
import {
  calculateMeterGeometry,
  calculateMinimapProjection,
  calculateRadarVectors,
  calculateRadarHudRect,
  calculateResponsiveHudLayout,
  calculateSignedMeterGeometry,
  calculateStatusTextY,
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

  it('preserves signed torsion in meter geometry with zero centered on the track', () => {
    const positive = calculateSignedMeterGeometry(0.25, [-0.5, 0.5], 0.75);
    const negative = calculateSignedMeterGeometry(-0.25, [-0.5, 0.5], 0.75);

    expect(positive.indicator).toBeGreaterThan(0.5);
    expect(negative.indicator).toBeLessThan(0.5);
    expect(positive.indicator).toBeCloseTo(2 / 3);
    expect(negative.indicator).toBeCloseTo(1 / 3);
    expect(positive.acceptableStart).toBeCloseTo(1 / 6);
    expect(positive.acceptableEnd).toBeCloseTo(5 / 6);
  });

  it('uses the same radar rectangle as pointer input for HUD drawing', () => {
    expect(calculateRadarHudRect(1000, 700)).toEqual(getRadarRect(1000, 700));
  });

  it('keeps HUD panels from overlapping on narrow mobile viewports', () => {
    const layout = calculateResponsiveHudLayout(320, 568);

    expect(layout.curvatureMeter.x + layout.curvatureMeter.width).toBeLessThanOrEqual(layout.torsionMeter.x);
    expect(layout.minimap.x + layout.minimap.width).toBeLessThanOrEqual(layout.radar.x);
    expect(layout.curvatureMeter.x).toBeGreaterThanOrEqual(0);
    expect(layout.radar.x + layout.radar.width).toBeLessThanOrEqual(320);
  });

  it('keeps the responsive radar rectangle aligned with pointer input coordinates', () => {
    expect(calculateResponsiveHudLayout(320, 568).radar).toEqual(getRadarRect(320, 568));
  });

  it('reserves cinematic top meter space on desktop viewports', () => {
    const layout = calculateResponsiveHudLayout(1440, 900);

    expect(layout.curvatureMeter.height).toBeGreaterThanOrEqual(78);
    expect(layout.torsionMeter.height).toBe(layout.curvatureMeter.height);
    expect(layout.curvatureMeter.width).toBeGreaterThanOrEqual(360);
    expect(layout.torsionMeter.x).toBeGreaterThan(layout.curvatureMeter.x + layout.curvatureMeter.width);
    expect(layout.curvatureMeter.y).toBeGreaterThanOrEqual(16);
  });

  it('keeps core HUD panels separated on compact screens after cinematic sizing', () => {
    const layout = calculateResponsiveHudLayout(320, 568);
    const topMeterBottom = Math.max(
      layout.curvatureMeter.y + layout.curvatureMeter.height,
      layout.torsionMeter.y + layout.torsionMeter.height,
    );

    expect(layout.curvatureMeter.x + layout.curvatureMeter.width).toBeLessThanOrEqual(layout.torsionMeter.x);
    expect(layout.minimap.x + layout.minimap.width).toBeLessThanOrEqual(layout.radar.x);
    expect(layout.minimap.y).toBeGreaterThan(topMeterBottom + 180);
    expect(layout.minimap.width).toBeGreaterThanOrEqual(96);
    expect(layout.radar.width).toBeGreaterThanOrEqual(168);
    expect(layout.radar.x + layout.radar.width).toBeLessThanOrEqual(320);
  });

  it('places compact status text below top meters on narrow viewports', () => {
    const layout = calculateResponsiveHudLayout(320, 568);

    expect(calculateStatusTextY(320, layout)).toBeGreaterThan(
      Math.max(layout.curvatureMeter.y + layout.curvatureMeter.height, layout.torsionMeter.y + layout.torsionMeter.height),
    );
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

  it('anchors the red orthogonal radar vector at the current steering endpoint', () => {
    const vectors = calculateRadarVectors({ x: 0.5, y: 0.25 }, 100, 100, 50);

    expect(vectors.blue.start).toEqual({ x: 100, y: 100 });
    expect(vectors.blue.end.x).toBeCloseTo(125);
    expect(vectors.blue.end.y).toBeCloseTo(87.5);
    expect(vectors.red.start).toEqual(vectors.blue.end);
    expect(vectors.red.end.x).toBeLessThan(vectors.red.start.x);
    expect(vectors.red.end.y).toBeLessThan(vectors.red.start.y);
  });
});
