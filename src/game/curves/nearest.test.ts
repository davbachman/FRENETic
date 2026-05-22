import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { authoredLevels } from './levels';
import { findNearestSample, progressRatioForSample } from './nearest';
import { sampleLevelCurve } from './sampler';

describe('nearest centerline lookup', () => {
  it('finds exact sampled positions', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const target = sampled.samples[123];
    const nearest = findNearestSample(sampled, target.position.clone());

    expect(nearest.index).toBe(123);
    expect(nearest.distance).toBeLessThan(1e-6);
    expect(nearest.sample.position.distanceTo(target.position)).toBeLessThan(1e-6);
  });

  it('reports distance from an offset point', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const sample = sampled.samples[20];
    const point = sample.position.clone().add(new Vector3(0, 0, 0.75));
    const nearest = findNearestSample(sampled, point);

    expect(nearest.distance).toBeGreaterThan(0.7);
    expect(nearest.distance).toBeLessThan(0.8);
  });

  it('maps sample arc length to progress ratio', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    expect(progressRatioForSample(sampled, sampled.samples[0])).toBeCloseTo(0);
    expect(
      progressRatioForSample(sampled, sampled.samples[Math.floor(sampled.samples.length / 2)]),
    ).toBeGreaterThan(0.45);
    expect(
      progressRatioForSample(sampled, sampled.samples[Math.floor(sampled.samples.length / 2)]),
    ).toBeLessThan(0.55);
  });
});
