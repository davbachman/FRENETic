import { Vector3 } from 'three';
import type { CurveSample, LevelDefinition, SampledCurve } from './types';

const SCREEN_UP = new Vector3(0, 0, 1);
const FALLBACK_UP = new Vector3(0, 1, 0);
const MIN_TORSION_CROSS_LENGTH_SQ = 1e-8;
const LOW_CURVATURE_TORSION_FACTOR = 0.25;

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function frameNormalFor(tangent: Vector3, previousNormal?: Vector3): Vector3 {
  const source = Math.abs(tangent.dot(SCREEN_UP)) > 0.96 ? FALLBACK_UP : SCREEN_UP;
  const normal = source.clone().sub(tangent.clone().multiplyScalar(source.dot(tangent)));

  if (normal.lengthSq() < 1e-8 && previousNormal) {
    return previousNormal.clone();
  }

  return normal.normalize();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function stableTorsionFor(
  level: LevelDefinition,
  numerator: number,
  crossLengthSq: number,
  curvature: number,
): number {
  const [minTorsion, maxTorsion] = level.acceptableTorsion;
  const lowCurvatureLimit = Math.max(
    level.acceptableCurvature[0] * LOW_CURVATURE_TORSION_FACTOR,
    1e-6,
  );

  if (crossLengthSq < MIN_TORSION_CROSS_LENGTH_SQ || curvature < lowCurvatureLimit) {
    return 0;
  }

  const rawTorsion = numerator / crossLengthSq;
  if (!Number.isFinite(rawTorsion)) {
    return 0;
  }

  return clamp(rawTorsion, minTorsion, maxTorsion);
}

export function sampleLevelCurve(level: LevelDefinition): SampledCurve {
  const count = level.sampleCount;
  const positions = Array.from({ length: count }, (_, index) => level.curve(index / count));
  const segmentLengths = positions.map((position, index) =>
    position.distanceTo(positions[wrap(index + 1, count)]),
  );

  const arcLengths: number[] = [];
  let runningLength = 0;
  for (let index = 0; index < count; index += 1) {
    arcLengths[index] = runningLength;
    runningLength += segmentLengths[index];
  }

  const tangents = positions.map((_, index) =>
    positions[wrap(index + 1, count)].clone().sub(positions[wrap(index - 1, count)]).normalize(),
  );

  const normals: Vector3[] = [];
  const binormals: Vector3[] = [];

  for (let index = 0; index < count; index += 1) {
    const normal = frameNormalFor(tangents[index], normals[wrap(index - 1, count)]);
    const binormal = tangents[index].clone().cross(normal).normalize();
    normals[index] = normal;
    binormals[index] = binormal;
  }

  const dt = 1 / count;

  const samples: CurveSample[] = positions.map((position, index) => {
    const prev = wrap(index - 1, count);
    const next = wrap(index + 1, count);
    const prev2 = wrap(index - 2, count);
    const next2 = wrap(index + 2, count);

    const r1 = positions[next].clone().sub(positions[prev]).multiplyScalar(1 / (2 * dt));
    const r2 = positions[next]
      .clone()
      .sub(position.clone().multiplyScalar(2))
      .add(positions[prev])
      .multiplyScalar(1 / (dt * dt));
    const r3 = positions[next2]
      .clone()
      .sub(positions[next].clone().multiplyScalar(2))
      .add(positions[prev].clone().multiplyScalar(2))
      .sub(positions[prev2])
      .multiplyScalar(1 / (2 * dt * dt * dt));
    const cross = r1.clone().cross(r2);
    const crossLengthSq = cross.lengthSq();
    const curvature = cross.length() / Math.max(r1.length() ** 3, 1e-6);
    const torsion = stableTorsionFor(level, cross.dot(r3), crossLengthSq, curvature);

    return {
      index,
      t: index / count,
      position: position.clone(),
      tangent: tangents[index].clone(),
      normal: normals[index].clone(),
      binormal: binormals[index].clone(),
      curvature,
      torsion,
      arcLength: arcLengths[index],
    };
  });

  return {
    level,
    samples,
    totalLength: runningLength,
  };
}
