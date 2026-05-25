import { Vector3 } from 'three';
import type { CurveSample, SampledCurve } from '../curves/types';
import type { SimulationConfig, SimulationState } from './types';

const SCREEN_UP = new Vector3(0, 0, 1);
const FALLBACK_UP = new Vector3(0, 1, 0);
const FALLBACK_RIGHT = new Vector3(1, 0, 0);

export interface ArcLengthFrame extends Pick<CurveSample, 'position' | 'tangent' | 'normal' | 'binormal'> {
  sample: CurveSample;
  progress: number;
  curvature: number;
  torsion: number;
}

function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function fallbackNormalFor(tangent: Vector3): Vector3 {
  const source = Math.abs(tangent.dot(SCREEN_UP)) < 0.96
    ? SCREEN_UP
    : Math.abs(tangent.dot(FALLBACK_UP)) < 0.96
      ? FALLBACK_UP
      : FALLBACK_RIGHT;

  return source.clone().sub(tangent.clone().multiplyScalar(source.dot(tangent))).normalize();
}

export function sampleAtArcLength(sampled: SampledCurve, arcLength: number): ArcLengthFrame {
  const { samples, totalLength } = sampled;
  if (samples.length === 0 || totalLength <= 0) {
    throw new Error('Cannot sample an empty curve.');
  }

  const wrappedArcLength = wrap(arcLength, totalLength);
  let index = 0;
  while (index < samples.length - 1 && samples[index + 1].arcLength <= wrappedArcLength) {
    index += 1;
  }

  const current = samples[index];
  const next = samples[(index + 1) % samples.length];
  const nextArcLength = index === samples.length - 1 ? totalLength : next.arcLength;
  const amount = (wrappedArcLength - current.arcLength) / Math.max(nextArcLength - current.arcLength, 1e-6);
  const tangent = current.tangent.clone().lerp(next.tangent, amount).normalize();
  const blendedNormal = current.normal.clone().lerp(next.normal, amount);
  const transportedNormal = blendedNormal.sub(tangent.clone().multiplyScalar(blendedNormal.dot(tangent)));
  const normal = transportedNormal.lengthSq() > 1e-8
    ? transportedNormal.normalize()
    : fallbackNormalFor(tangent);

  return {
    sample: current,
    progress: wrappedArcLength / totalLength,
    position: current.position.clone().lerp(next.position, amount),
    tangent,
    normal,
    binormal: tangent.clone().cross(normal).normalize(),
    curvature: current.curvature + (next.curvature - current.curvature) * amount,
    torsion: current.torsion + (next.torsion - current.torsion) * amount,
  };
}

export function createSimulationState(sampled: SampledCurve): SimulationState {
  const first = sampled.samples[0];
  return {
    sampled,
    elapsed: 0,
    player: {
      position: first.position.clone(),
      tangent: first.tangent.clone(),
      normal: first.normal.clone(),
      binormal: first.binormal.clone(),
      currentCurvature: 0,
      currentTorsion: 0,
      progress: 0,
      nearestSample: first,
      invariantHistory: [],
    },
  };
}

function recordInvariantHistory(state: SimulationState, dt: number, maxHistorySeconds: number): void {
  for (const point of state.player.invariantHistory) {
    point.age += dt;
  }

  state.player.invariantHistory.unshift({
    age: 0,
    curvature: state.player.currentCurvature,
    torsion: state.player.currentTorsion,
  });

  state.player.invariantHistory = state.player.invariantHistory.filter(
    (point) => point.age <= maxHistorySeconds,
  );
}

export function updateDemoSimulation(
  state: SimulationState,
  dt: number,
  config: SimulationConfig,
): void {
  if (!Number.isFinite(dt) || dt <= 0) {
    return;
  }

  state.elapsed += dt;
  const frame = sampleAtArcLength(state.sampled, state.elapsed * state.sampled.level.speed);

  state.player.position.copy(frame.position);
  state.player.tangent.copy(frame.tangent);
  state.player.normal.copy(frame.normal);
  state.player.binormal.copy(frame.binormal);
  state.player.currentCurvature = frame.curvature;
  state.player.currentTorsion = frame.torsion;
  state.player.progress = frame.progress;
  state.player.nearestSample = frame.sample;
  recordInvariantHistory(state, dt, config.maxHistorySeconds);
}
