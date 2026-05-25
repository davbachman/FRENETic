import { Vector3 } from 'three';

export type CurveFunction = (t: number) => Vector3;

export interface LevelDefinition {
  id: string;
  name: string;
  speed: number;
  tubeRadius: number;
  sampleCount: number;
  acceptableCurvature: [number, number];
  acceptableTorsion: [number, number];
  curve: CurveFunction;
}

export interface CurveSample {
  index: number;
  t: number;
  position: Vector3;
  tangent: Vector3;
  normal: Vector3;
  binormal: Vector3;
  tangentDerivative?: Vector3;
  curvature: number;
  torsion: number;
  arcLength: number;
}

export interface SampledCurve {
  level: LevelDefinition;
  samples: CurveSample[];
  totalLength: number;
}
