import type { Vector3 } from 'three';
import type { CurveSample, SampledCurve } from '../curves/types';

export interface InvariantHistoryPoint {
  age: number;
  curvature: number;
  torsion: number;
}

export interface PlayerState {
  position: Vector3;
  tangent: Vector3;
  normal: Vector3;
  binormal: Vector3;
  currentCurvature: number;
  currentTorsion: number;
  progress: number;
  nearestSample: CurveSample;
  invariantHistory: InvariantHistoryPoint[];
}

export interface SimulationConfig {
  maxHistorySeconds: number;
}

export interface SimulationState {
  sampled: SampledCurve;
  player: PlayerState;
  elapsed: number;
}
