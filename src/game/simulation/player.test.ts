import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { authoredLevels } from '../curves/levels';
import { sampleLevelCurve } from '../curves/sampler';
import { createSimulationState, updateSimulation } from './player';

const config = {
  steeringResponseSeconds: 0.18,
  maxCurvature: 0.75,
  maxHistorySeconds: 3,
  recoveryPerSecond: 0.12,
  damagePerSecond: 0.45,
  warningDistanceRatio: 0.72,
};

const immediateSteeringConfig = {
  ...config,
  steeringResponseSeconds: 1e-6,
};

describe('player simulation', () => {
  it('moves the player at constant speed when steering is neutral', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const start = state.player.position.clone();

    updateSimulation(state, { x: 0, y: 0 }, 1, config);

    const distance = state.player.position.distanceTo(start);
    expect(distance).toBeGreaterThan(sampled.level.speed * 0.95);
    expect(distance).toBeLessThan(sampled.level.speed * 1.05);
    expect(state.player.currentCurvature).toBeLessThan(0.01);
  });

  it('turns tangent when steering has curvature', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const startTangent = state.player.tangent.clone();

    for (let i = 0; i < 30; i += 1) {
      updateSimulation(state, { x: 1, y: 0 }, 1 / 60, config);
    }

    expect(state.player.tangent.angleTo(startTangent)).toBeGreaterThan(0.02);
    expect(state.player.currentCurvature).toBeGreaterThan(0.1);
  });

  it('records recent steering history and expires old points', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);

    for (let i = 0; i < 300; i += 1) {
      updateSimulation(state, { x: 0.5, y: 0.2 }, 1 / 60, config);
    }

    expect(state.player.steeringHistory.length).toBeGreaterThan(10);
    expect(state.player.steeringHistory[0].age).toBe(0);
    expect(Math.max(...state.player.steeringHistory.map((point) => point.age))).toBeLessThanOrEqual(
      config.maxHistorySeconds,
    );
  });

  it('applies warning and damage when outside the tube', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    state.player.position.add(state.player.normal.clone().multiplyScalar(sampled.level.tubeRadius * 1.2));

    updateSimulation(state, { x: 0, y: 0 }, 1 / 10, config);

    expect(state.player.warning).toBeGreaterThan(0);
    expect(state.player.health).toBeLessThan(1);
    expect(state.player.damageFlash).toBeGreaterThan(0);
  });

  it('ramps warning smoothly from threshold to tube wall', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const center = sampled.samples[0];
    const tubeRadius = sampled.level.tubeRadius;
    const warningDistance = tubeRadius * config.warningDistanceRatio;

    const setDistanceAndUpdate = (distance: number): number => {
      state.player.position.copy(center.position).add(center.normal.clone().multiplyScalar(distance));
      updateSimulation(state, { x: 0, y: 0 }, 0, config);
      return state.player.warning;
    };

    expect(setDistanceAndUpdate(warningDistance - 0.01)).toBe(0);
    expect(setDistanceAndUpdate(warningDistance)).toBe(0);
    expect(setDistanceAndUpdate((warningDistance + tubeRadius) / 2)).toBeCloseTo(0.5, 1);
    expect(setDistanceAndUpdate(tubeRadius)).toBeCloseTo(1);
    expect(setDistanceAndUpdate(tubeRadius * 1.2)).toBeCloseTo(1);
  });

  it('keeps positive torsion magnitude meaningful for sub-unit steering turns', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const turnAngle = 0.35;
    const previous = { x: 0.2, y: 0 };
    const current = { x: 0.2 * Math.cos(turnAngle), y: 0.2 * Math.sin(turnAngle) };
    const dt = 0.25;

    state.player.previousCurvatureDirection = { ...previous };
    state.player.smoothedSteering = { ...previous };

    updateSimulation(state, current, dt, immediateSteeringConfig);

    expect(state.player.currentTorsion).toBeCloseTo(turnAngle / dt, 5);
  });

  it('keeps negative torsion magnitude meaningful for sub-unit steering turns', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const turnAngle = -0.35;
    const previous = { x: 0.2, y: 0 };
    const current = { x: 0.2 * Math.cos(turnAngle), y: 0.2 * Math.sin(turnAngle) };
    const dt = 0.25;

    state.player.previousCurvatureDirection = { ...previous };
    state.player.smoothedSteering = { ...previous };

    updateSimulation(state, current, dt, immediateSteeringConfig);

    expect(state.player.currentTorsion).toBeCloseTo(turnAngle / dt, 5);
  });

  it('unwraps progress across the centerline seam without regression', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const lastIndex = sampled.samples.length - 1;
    const beforeLast = sampled.samples[lastIndex - 1];
    const last = sampled.samples[lastIndex];
    const first = sampled.samples[0];

    state.player.nearestSample = beforeLast;
    state.player.progress = beforeLast.arcLength / sampled.totalLength;

    state.player.position.copy(last.position);
    updateSimulation(state, { x: 0, y: 0 }, 0, config);
    const progressBeforeWrap = state.player.progress;

    state.player.position.copy(first.position);
    updateSimulation(state, { x: 0, y: 0 }, 0, config);

    expect(progressBeforeWrap).toBeGreaterThan(0.99);
    expect(state.player.progress).toBeGreaterThanOrEqual(1);
    expect(state.player.progress).toBeGreaterThanOrEqual(progressBeforeWrap);
  });

  it('preserves frame normal continuity near vertical tangents', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);
    const tangent = new Vector3(0.2, 0, Math.sqrt(1 - 0.2 ** 2)).normalize();
    const previousNormal = new Vector3(tangent.z, 0, -tangent.x).normalize();

    state.player.tangent.copy(tangent);
    state.player.normal.copy(previousNormal);
    state.player.binormal.copy(state.player.tangent.clone().cross(state.player.normal).normalize());

    updateSimulation(state, { x: 0, y: 0.05 }, 1 / 60, immediateSteeringConfig);

    expect(state.player.normal.angleTo(previousNormal)).toBeLessThan(0.2);
    expect(Math.abs(state.player.normal.dot(state.player.tangent))).toBeLessThan(1e-6);
    expect(Math.abs(state.player.binormal.dot(state.player.tangent))).toBeLessThan(1e-6);
  });

  it('stores independent steering snapshots', () => {
    const sampled = sampleLevelCurve(authoredLevels[0]);
    const state = createSimulationState(sampled);

    updateSimulation(state, { x: 0.4, y: -0.2 }, 1 / 60, config);

    const latest = state.player.steeringHistory[0];
    expect(latest.raw).toEqual(state.player.rawSteering);
    expect(latest.raw).not.toBe(state.player.rawSteering);
    expect(latest.smoothed).toEqual(state.player.smoothedSteering);
    expect(latest.smoothed).not.toBe(state.player.smoothedSteering);
    expect(state.player.previousCurvatureDirection).toEqual(state.player.smoothedSteering);
    expect(state.player.previousCurvatureDirection).not.toBe(state.player.smoothedSteering);
  });
});
