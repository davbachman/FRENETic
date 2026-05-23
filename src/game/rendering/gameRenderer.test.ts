import { describe, expect, it } from 'vitest';
import { authoredLevels } from '../curves/levels';
import { sampleLevelCurve } from '../curves/sampler';
import { createSimulationState } from '../simulation/player';
import { calculateCameraLookTarget } from './gameRenderer';

describe('calculateCameraLookTarget', () => {
  it('looks along the player tangent while centered in the tunnel', () => {
    const simulation = createSimulationState(sampleLevelCurve(authoredLevels[0]));
    const expected = simulation.player.position.clone().add(simulation.player.tangent);

    const target = calculateCameraLookTarget(simulation);

    expect(target.distanceTo(expected)).toBeLessThan(1e-6);
  });

  it('pulls the view toward the centerline when the player drifts far from the tunnel', () => {
    const simulation = createSimulationState(sampleLevelCurve(authoredLevels[0]));
    simulation.player.position.add(simulation.player.normal.clone().multiplyScalar(8));
    simulation.player.tangent.copy(simulation.player.normal);

    const pureTangentTarget = simulation.player.position.clone().add(simulation.player.tangent);
    const centerlinePreview = simulation.player.nearestSample.position
      .clone()
      .add(simulation.player.nearestSample.tangent);

    const target = calculateCameraLookTarget(simulation);

    expect(target.distanceTo(centerlinePreview)).toBeLessThan(
      pureTangentTarget.distanceTo(centerlinePreview),
    );
    expect(
      target
        .clone()
        .sub(simulation.player.position)
        .dot(simulation.player.nearestSample.position.clone().sub(simulation.player.position)),
    ).toBeGreaterThan(0);
  });
});
