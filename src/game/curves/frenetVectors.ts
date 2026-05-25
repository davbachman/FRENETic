import { Vector3 } from 'three';

export interface FrenetVectorFrame {
  tangent: Vector3;
  normal: Vector3;
  binormal: Vector3;
  tangentDerivative?: Vector3;
  curvature: number;
  torsion: number;
}

export interface FrenetDerivativeVectors {
  tangent: Vector3;
  normal: Vector3;
  binormal: Vector3;
  tangentDerivative: Vector3;
  normalDerivative: Vector3;
  normalDerivativeTProjection: Vector3;
  normalDerivativeBProjection: Vector3;
}

export interface DisplayPoint {
  x: number;
  y: number;
}

export interface DisplayVector {
  start: DisplayPoint;
  end: DisplayPoint;
}

export interface TangentBinormalDisplayVectors {
  normalDerivative: DisplayVector;
  tProjection: DisplayVector;
  bProjection: DisplayVector;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function normalizedOr(vector: Vector3, fallback: Vector3): Vector3 {
  const candidate = vector.clone();
  if (candidate.lengthSq() > 1e-12) {
    return candidate.normalize();
  }

  const fallbackCandidate = fallback.clone();
  if (fallbackCandidate.lengthSq() > 1e-12) {
    return fallbackCandidate.normalize();
  }

  return new Vector3(1, 0, 0);
}

function clampDisplayPoint(point: DisplayPoint): DisplayPoint {
  const length = Math.hypot(point.x, point.y);
  if (length <= 1) {
    return point;
  }

  return {
    x: point.x / length,
    y: point.y / length,
  };
}

export function calculateFrenetDerivativeVectors(frame: FrenetVectorFrame): FrenetDerivativeVectors {
  const tangent = normalizedOr(frame.tangent, new Vector3(1, 0, 0));
  const normalSeed = frame.normal
    .clone()
    .sub(tangent.clone().multiplyScalar(frame.normal.dot(tangent)));
  const normal = normalizedOr(normalSeed, new Vector3(0, 1, 0));
  const binormalSeed = frame.binormal
    .clone()
    .sub(tangent.clone().multiplyScalar(frame.binormal.dot(tangent)))
    .sub(normal.clone().multiplyScalar(frame.binormal.dot(normal)));
  const binormal = normalizedOr(binormalSeed, tangent.clone().cross(normal));
  const curvature = finiteOrZero(frame.curvature);
  const torsion = finiteOrZero(frame.torsion);
  const tangentDerivativeSeed = frame.tangentDerivative?.clone() ?? normal.clone().multiplyScalar(curvature);
  const tangentDerivative = tangentDerivativeSeed.sub(
    tangent.clone().multiplyScalar(tangentDerivativeSeed.dot(tangent)),
  );

  if (tangentDerivative.lengthSq() <= 1e-12 && Math.abs(curvature) > 1e-8) {
    tangentDerivative.copy(normal).multiplyScalar(curvature);
  }

  const normalDerivativeTProjection = tangent.clone().multiplyScalar(-curvature);
  const normalDerivativeBProjection = binormal.clone().multiplyScalar(torsion);

  return {
    tangent,
    normal,
    binormal,
    tangentDerivative,
    normalDerivative: normalDerivativeTProjection.clone().add(normalDerivativeBProjection),
    normalDerivativeTProjection,
    normalDerivativeBProjection,
  };
}

export function projectNormalDerivativeToTangentBinormalDisplay(
  vectors: FrenetDerivativeVectors,
  maxCurvature: number,
  maxTorsionMagnitude: number,
): TangentBinormalDisplayVectors {
  const curvatureScale = Math.max(1e-6, Math.abs(finiteOrZero(maxCurvature)));
  const torsionScale = Math.max(1e-6, Math.abs(finiteOrZero(maxTorsionMagnitude)));
  const origin = { x: 0, y: 0 };
  const tComponent = vectors.normalDerivativeTProjection.dot(vectors.tangent) / curvatureScale;
  const bComponent = vectors.normalDerivativeBProjection.dot(vectors.binormal) / torsionScale;
  const tProjectionEnd = clampDisplayPoint({ x: 0, y: tComponent });
  const bProjectionEnd = clampDisplayPoint({ x: bComponent, y: 0 });

  return {
    normalDerivative: {
      start: origin,
      end: clampDisplayPoint({ x: bComponent, y: tComponent }),
    },
    tProjection: {
      start: origin,
      end: tProjectionEnd,
    },
    bProjection: {
      start: origin,
      end: bProjectionEnd,
    },
  };
}
