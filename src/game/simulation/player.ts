import { Vector3 } from 'three';
import type { SampledCurve } from '../curves/types';
import { clampSteering, smoothSteering } from './smoothing';
import { updateCollision } from './collision';
import type { SimulationConfig, SimulationState, Vec2 } from './types';

function signedSteeringTurn(previous: Vec2, current: Vec2, dt: number): number {
  const previousLength = Math.hypot(previous.x, previous.y);
  const currentLength = Math.hypot(current.x, current.y);

  if (previousLength < 1e-4 || currentLength < 1e-4) {
    return 0;
  }

  const dot = (previous.x * current.x + previous.y * current.y) / (previousLength * currentLength);
  const cross = previous.x * current.y - previous.y * current.x;
  const angle = Math.atan2(cross, Math.max(-1, Math.min(1, dot)));
  return angle / Math.max(dt, 1e-6);
}

function rebuildFrame(state: SimulationState): void {
  const screenUp = new Vector3(0, 0, 1);
  const fallback = new Vector3(0, 1, 0);
  const source = Math.abs(state.player.tangent.dot(screenUp)) > 0.96 ? fallback : screenUp;
  state.player.normal.copy(source.sub(state.player.tangent.clone().multiplyScalar(source.dot(state.player.tangent))).normalize());
  state.player.binormal.copy(state.player.tangent.clone().cross(state.player.normal).normalize());
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
      rawSteering: { x: 0, y: 0 },
      smoothedSteering: { x: 0, y: 0 },
      currentCurvature: 0,
      currentTorsion: 0,
      previousCurvatureDirection: { x: 0, y: 0 },
      health: 1,
      warning: 0,
      damageFlash: 0,
      progress: 0,
      nearestSample: first,
      distanceFromCenterline: 0,
      steeringHistory: [],
    },
  };
}

export function updateSimulation(
  state: SimulationState,
  rawSteering: Vec2,
  dt: number,
  config: SimulationConfig,
): void {
  const clamped = clampSteering(rawSteering);
  const previousSmoothed = state.player.smoothedSteering;
  const smoothed = smoothSteering(
    previousSmoothed,
    clamped,
    dt,
    config.steeringResponseSeconds,
  );

  state.player.rawSteering = clamped;
  state.player.smoothedSteering = smoothed;
  state.player.currentCurvature = Math.hypot(smoothed.x, smoothed.y) * config.maxCurvature;
  state.player.currentTorsion = signedSteeringTurn(
    state.player.previousCurvatureDirection,
    smoothed,
    dt,
  );
  state.player.previousCurvatureDirection = smoothed;

  const curvatureDirection = state.player.binormal
    .clone()
    .multiplyScalar(smoothed.x)
    .add(state.player.normal.clone().multiplyScalar(smoothed.y));

  if (curvatureDirection.lengthSq() > 1e-8) {
    curvatureDirection.normalize().multiplyScalar(state.player.currentCurvature * state.sampled.level.speed * dt);
    state.player.tangent.add(curvatureDirection).normalize();
    rebuildFrame(state);
  }

  state.player.position.add(state.player.tangent.clone().multiplyScalar(state.sampled.level.speed * dt));
  state.elapsed += dt;

  updateCollision(state.player, state.sampled, dt, config);

  state.player.steeringHistory.unshift({
    age: 0,
    raw: clamped,
    smoothed,
    curvature: state.player.currentCurvature,
    torsion: state.player.currentTorsion,
  });

  for (const point of state.player.steeringHistory) {
    point.age += dt;
  }

  state.player.steeringHistory = state.player.steeringHistory.filter(
    (point) => point.age <= config.maxHistorySeconds,
  );
}
