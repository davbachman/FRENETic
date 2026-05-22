import { Vector3 } from 'three';
import type { CurveSample, SampledCurve } from '../curves/types';

export interface Vec2 {
  x: number;
  y: number;
}

export interface SteeringHistoryPoint {
  age: number;
  raw: Vec2;
  smoothed: Vec2;
  curvature: number;
  torsion: number;
}

export interface PlayerState {
  position: Vector3;
  tangent: Vector3;
  normal: Vector3;
  binormal: Vector3;
  rawSteering: Vec2;
  smoothedSteering: Vec2;
  currentCurvature: number;
  currentTorsion: number;
  previousCurvatureDirection: Vec2;
  health: number;
  warning: number;
  damageFlash: number;
  progress: number;
  nearestSample: CurveSample;
  distanceFromCenterline: number;
  steeringHistory: SteeringHistoryPoint[];
}

export interface SimulationConfig {
  steeringResponseSeconds: number;
  maxCurvature: number;
  maxHistorySeconds: number;
  recoveryPerSecond: number;
  damagePerSecond: number;
  warningDistanceRatio: number;
}

export interface SimulationState {
  sampled: SampledCurve;
  player: PlayerState;
  elapsed: number;
}
