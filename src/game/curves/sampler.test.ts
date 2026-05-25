import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { authoredLevels } from './levels';
import { sampleLevelCurve } from './sampler';

describe('sampleLevelCurve', () => {
  it('uses the reduced training pace for authored levels', () => {
    expect(authoredLevels.map((level) => level.speed)).toEqual([1.75, 1.85, 1.95, 2.6]);
  });

  it('keeps the first level curvature safe band broad enough for its centerline', () => {
    const planar = authoredLevels[0];
    const sampled = sampleLevelCurve(planar);
    const [safeMin, safeMax] = planar.acceptableCurvature;

    expect(Math.min(...sampled.samples.map((sample) => sample.curvature))).toBeGreaterThanOrEqual(safeMin);
    expect(Math.max(...sampled.samples.map((sample) => sample.curvature))).toBeLessThanOrEqual(safeMax);
  });

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
    for (const id of ['lifted-wave', 'trefoil-knot', 'granny-knot']) {
      const level = authoredLevels.find((candidate) => candidate.id === id);
      expect(level).toBeDefined();

      const sampled = sampleLevelCurve(level!);
      const averageTorsion =
        sampled.samples.reduce((sum, sample) => sum + Math.abs(sample.torsion), 0) /
        sampled.samples.length;
      expect(averageTorsion).toBeGreaterThan(0.01);
    }
  });

  it('uses Bourke-style Granny knot geometry for the default demo curve', () => {
    const granny = authoredLevels[3];
    expect(granny.id).toBe('granny-knot');
    expect(granny.name).toBe('Granny Knot');
    expect(granny.curve(0).distanceTo(granny.curve(1))).toBeLessThan(1e-6);
    expect(granny.curve(0).x).toBeCloseTo(-6.6);
    expect(granny.curve(0).y).toBeCloseTo(2.8);
    expect(granny.curve(0).z).toBeCloseTo(7);

    const sampled = sampleLevelCurve(granny);
    const curvatures = sampled.samples.map((sample) => sample.curvature);
    const torsions = sampled.samples.map((sample) => sample.torsion);
    const midpointSeparation = granny.curve(0).distanceTo(granny.curve(0.5));

    expect(Math.max(...curvatures) - Math.min(...curvatures)).toBeGreaterThan(0.2);
    expect(Math.max(...curvatures)).toBeLessThan(0.35);
    expect(Math.min(...torsions)).toBeLessThan(-0.02);
    expect(Math.max(...torsions)).toBeGreaterThan(0.05);
    expect(midpointSeparation).toBeGreaterThan(2);
  });

  it('keeps authored torsion finite and compatible with level metadata', () => {
    for (const level of authoredLevels) {
      const sampled = sampleLevelCurve(level);
      const maxExpectedTorsion =
        Math.max(Math.abs(level.acceptableTorsion[0]), Math.abs(level.acceptableTorsion[1])) *
        1.25;

      for (const sample of sampled.samples) {
        expect(Number.isFinite(sample.torsion)).toBe(true);
      }

      const maxTorsion = Math.max(...sampled.samples.map((sample) => Math.abs(sample.torsion)));
      expect(maxTorsion).toBeLessThanOrEqual(maxExpectedTorsion);
    }
  });

  it('keeps arc lengths monotonic and includes the closing segment', () => {
    for (const level of authoredLevels) {
      const sampled = sampleLevelCurve(level);

      for (let index = 1; index < sampled.samples.length; index += 1) {
        expect(sampled.samples[index].arcLength).toBeGreaterThan(
          sampled.samples[index - 1].arcLength,
        );
      }

      const closingSegment = sampled.samples
        .at(-1)!
        .position.distanceTo(sampled.samples[0].position);
      expect(sampled.totalLength).toBeCloseTo(
        sampled.samples.at(-1)!.arcLength + closingSegment,
        6,
      );
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
    };

    const sampled = sampleLevelCurve(unitCircle);
    const averageCurvature =
      sampled.samples.reduce((sum, sample) => sum + sample.curvature, 0) /
      sampled.samples.length;

    expect(averageCurvature).toBeGreaterThan(0.95);
    expect(averageCurvature).toBeLessThan(1.05);
  });

  it('stores tangent derivative vectors with the sampled curvature direction', () => {
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
    };

    const first = sampleLevelCurve(unitCircle).samples[0] as {
      tangentDerivative?: Vector3;
    };

    expect(first.tangentDerivative).toBeDefined();
    expect(first.tangentDerivative!.length()).toBeGreaterThan(0.95);
    expect(first.tangentDerivative!.length()).toBeLessThan(1.05);
    expect(first.tangentDerivative!.x).toBeLessThan(-0.95);
    expect(Math.abs(first.tangentDerivative!.dot(new Vector3(0, 1, 0)))).toBeLessThan(1e-4);
  });
});
