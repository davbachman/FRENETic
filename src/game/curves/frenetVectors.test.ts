import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  calculateFrenetDerivativeVectors,
  projectNormalDerivativeToTangentBinormalDisplay,
} from './frenetVectors';

describe('frenet derivative vectors', () => {
  it('computes tangent derivative and normal derivative from the current frame', () => {
    const vectors = calculateFrenetDerivativeVectors({
      tangent: new Vector3(1, 0, 0),
      normal: new Vector3(0, 1, 0),
      binormal: new Vector3(0, 0, 1),
      tangentDerivative: new Vector3(0, 0.4, 0),
      curvature: 0.4,
      torsion: 0.25,
    });

    expect(vectors.tangentDerivative.x).toBeCloseTo(0);
    expect(vectors.tangentDerivative.y).toBeCloseTo(0.4);
    expect(vectors.tangentDerivative.z).toBeCloseTo(0);
    expect(vectors.normalDerivative.x).toBeCloseTo(-0.4);
    expect(vectors.normalDerivative.y).toBeCloseTo(0);
    expect(vectors.normalDerivative.z).toBeCloseTo(0.25);
    expect(vectors.normalDerivativeTProjection.x).toBeCloseTo(-0.4);
    expect(vectors.normalDerivativeBProjection.z).toBeCloseTo(0.25);
  });

  it('falls back to curvature times normal when tangentDerivative is absent', () => {
    const vectors = calculateFrenetDerivativeVectors({
      tangent: new Vector3(1, 0, 0),
      normal: new Vector3(0, 1, 0),
      binormal: new Vector3(0, 0, 1),
      curvature: 0.5,
      torsion: 0,
    });

    expect(vectors.tangentDerivative.y).toBeCloseTo(0.5);
    expect(vectors.normalDerivative.x).toBeCloseTo(-0.5);
    expect(vectors.normalDerivative.length()).toBeCloseTo(0.5);
  });

  it('maps normal derivative components into +B right and +T up display coordinates', () => {
    const vectors = calculateFrenetDerivativeVectors({
      tangent: new Vector3(1, 0, 0),
      normal: new Vector3(0, 1, 0),
      binormal: new Vector3(0, 0, 1),
      curvature: 0.5,
      torsion: 0.25,
    });

    const display = projectNormalDerivativeToTangentBinormalDisplay(vectors, 1, 0.5);

    expect(display.normalDerivative.start).toEqual({ x: 0, y: 0 });
    expect(display.normalDerivative.end.x).toBeCloseTo(0.5);
    expect(display.normalDerivative.end.y).toBeCloseTo(-0.5);
    expect(display.tProjection.end).toEqual({ x: 0, y: -0.5 });
    expect(display.bProjection.end).toEqual({ x: 0.5, y: 0 });
  });

  it('preserves torsion sign in the B-axis display projection', () => {
    const vectors = calculateFrenetDerivativeVectors({
      tangent: new Vector3(1, 0, 0),
      normal: new Vector3(0, 1, 0),
      binormal: new Vector3(0, 0, 1),
      curvature: 0.5,
      torsion: -0.25,
    });

    const display = projectNormalDerivativeToTangentBinormalDisplay(vectors, 1, 0.5);

    expect(display.normalDerivative.end.x).toBeCloseTo(-0.5);
    expect(display.normalDerivative.end.y).toBeCloseTo(-0.5);
    expect(display.bProjection.end).toEqual({ x: -0.5, y: 0 });
  });
});
