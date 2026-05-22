import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { authoredLevels } from './levels';
import { sampleLevelCurve } from './sampler';

describe('sampleLevelCurve', () => {
  it('samples every authored level as a closed cyclic curve', () => {
    for (const level of authoredLevels) {
      const sampled = sampleLevelCurve(level);
      expect(sampled.samples).toHaveLength(level.sampleCount);
      expect(sampled.totalLength).toBeGreaterThan(10);

      const first = sampled.samples[0].position;
      const lastParam = level.curve(1);
      expect(first.distanceTo(lastParam)).toBeLessThan(1e-6);
    }
  });

  it('keeps planar level torsion near zero', () => {
    const planar = authoredLevels.find((level) => level.id === 'planar-wave');
    expect(planar).toBeDefined();

    const sampled = sampleLevelCurve(planar!);
    const maxTorsion = Math.max(...sampled.samples.map((sample) => Math.abs(sample.torsion)));
    expect(maxTorsion).toBeLessThan(0.05);
  });

  it('detects nonzero torsion in lifted and knotted levels', () => {
    for (const id of ['lifted-wave', 'trefoil-knot', 'cinquefoil-knot']) {
      const level = authoredLevels.find((candidate) => candidate.id === id);
      expect(level).toBeDefined();

      const sampled = sampleLevelCurve(level!);
      const averageTorsion =
        sampled.samples.reduce((sum, sample) => sum + Math.abs(sample.torsion), 0) /
        sampled.samples.length;
      expect(averageTorsion).toBeGreaterThan(0.01);
    }
  });

  it('builds unit tangents and frames orthogonal to tangents', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);

    for (const sample of sampled.samples.filter((_, index) => index % 37 === 0)) {
      expect(sample.tangent.length()).toBeCloseTo(1, 4);
      expect(sample.normal.length()).toBeCloseTo(1, 4);
      expect(sample.binormal.length()).toBeCloseTo(1, 4);
      expect(Math.abs(sample.tangent.dot(sample.normal))).toBeLessThan(1e-4);
      expect(Math.abs(sample.tangent.dot(sample.binormal))).toBeLessThan(1e-4);
    }
  });

  it('approximates a unit circle curvature near one', () => {
    const unitCircle = {
      id: 'unit-circle',
      name: 'Unit Circle',
      speed: 1,
      tubeRadius: 0.5,
      sampleCount: 360,
      acceptableCurvature: [0.8, 1.2] as [number, number],
      acceptableTorsion: [-0.1, 0.1] as [number, number],
      curve: (t: number) => {
        const a = t * Math.PI * 2;
        return new Vector3(Math.cos(a), Math.sin(a), 0);
      },
      visual: { ringColor: '#36f3ff', fogColor: '#02040a' },
    };

    const sampled = sampleLevelCurve(unitCircle);
    const averageCurvature =
      sampled.samples.reduce((sum, sample) => sum + sample.curvature, 0) /
      sampled.samples.length;

    expect(averageCurvature).toBeGreaterThan(0.95);
    expect(averageCurvature).toBeLessThan(1.05);
  });
});
