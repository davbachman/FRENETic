import { describe, expect, it } from 'vitest';
import { authoredLevels } from '../curves/levels';
import { sampleLevelCurve } from '../curves/sampler';
import { createSimulationState, sampleAtArcLength, updateDemoSimulation } from './player';

const config = {
  maxHistorySeconds: 3,
};

describe('demo simulation', () => {
  it('creates compact centerline state for the passive visualization', () => {
    const sampled = sampleLevelCurve(authoredLevels[3]);
    const state = createSimulationState(sampled);

    expect(state.player.position).toEqual(sampled.samples[0].position);
    expect(state.player.currentCurvature).toBe(0);
    expect(state.player.currentTorsion).toBe(0);
    expect(state.player.progress).toBe(0);
    expect(state.player.nearestSample).toBe(sampled.samples[0]);
    expect(state.player.invariantHistory).toHaveLength(0);
  });

  it('samples closed curves continuously by arc length', () => {
    const sampled = sampleLevelCurve(authoredLevels[3]);
    const wrapped = sampleAtArcLength(sampled, sampled.totalLength + 1);
    const direct = sampleAtArcLength(sampled, 1);

    expect(wrapped.position.distanceTo(direct.position)).toBeLessThan(1e-6);
    expect(wrapped.tangent.distanceTo(direct.tangent)).toBeLessThan(1e-6);
    expect(wrapped.progress).toBeCloseTo(direct.progress);
  });

  it('advances the camera exactly along the sampled centerline', () => {
    const sampled = sampleLevelCurve(authoredLevels[3]);
    const state = createSimulationState(sampled);

    updateDemoSimulation(state, 1, config);

    const expected = sampleAtArcLength(sampled, sampled.level.speed);
    expect(state.player.position.distanceTo(expected.position)).toBeLessThan(1e-6);
    expect(state.player.progress).toBeCloseTo(expected.progress);
    expect(state.player.currentCurvature).toBeCloseTo(expected.curvature);
    expect(state.player.currentTorsion).toBeCloseTo(expected.torsion);
    expect(state.player.invariantHistory[0]).toMatchObject({
      age: 0,
      curvature: expected.curvature,
      torsion: expected.torsion,
    });
  });

  it('keeps invariant history within the configured display window', () => {
    const state = createSimulationState(sampleLevelCurve(authoredLevels[3]));

    for (let step = 0; step < 5; step += 1) {
      updateDemoSimulation(state, 1, config);
    }

    expect(state.player.invariantHistory.length).toBeGreaterThan(0);
    expect(Math.max(...state.player.invariantHistory.map((point) => point.age))).toBeLessThanOrEqual(3);
  });
});
