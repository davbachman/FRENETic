import { describe, expect, it } from 'vitest';
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
});
