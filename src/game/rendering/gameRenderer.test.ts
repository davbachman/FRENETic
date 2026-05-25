import { describe, expect, it } from 'vitest';
import { authoredLevels } from '../curves/levels';
import { sampleLevelCurve } from '../curves/sampler';
import { createSimulationState } from '../simulation/player';
import { calculateCameraLookTarget } from './gameRenderer';

describe('calculateCameraLookTarget', () => {
  it('looks down the sampled centerline while centered in the tunnel', () => {
    const simulation = createSimulationState(sampleLevelCurve(authoredLevels[0]));
    const expected = simulation.sampled.samples[Math.floor(simulation.sampled.samples.length / 24)].position;

    const target = calculateCameraLookTarget(simulation);

    expect(target.distanceTo(expected)).toBeLessThan(0.25);
  });

});
