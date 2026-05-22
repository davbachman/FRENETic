import type { SampledCurve } from '../curves/types';
import { findNearestSample, progressRatioForSample } from '../curves/nearest';
import type { PlayerState, SimulationConfig } from './types';

function unwrappedProgressFor(
  player: PlayerState,
  sampled: SampledCurve,
  nearestIndex: number,
  previousIndex: number,
): number {
  const sampleCount = sampled.samples.length;
  const rawProgress = progressRatioForSample(sampled, sampled.samples[nearestIndex]);
  const previousLap = Math.floor(player.progress);
  const seamLow = sampleCount * 0.25;
  const seamHigh = sampleCount * 0.75;

  let candidate = previousLap + rawProgress;
  if (previousIndex >= seamHigh && nearestIndex <= seamLow) {
    candidate = previousLap + 1 + rawProgress;
  } else if (previousIndex <= seamLow && nearestIndex >= seamHigh) {
    candidate = previousLap - 1 + rawProgress;
  }

  return Math.max(player.progress, candidate);
}

export function updateCollision(
  player: PlayerState,
  sampled: SampledCurve,
  dt: number,
  config: SimulationConfig,
): void {
  const nearest = findNearestSample(sampled, player.position);
  const previousIndex = player.nearestSample.index;
  const warningDistance = sampled.level.tubeRadius * config.warningDistanceRatio;

  player.nearestSample = nearest.sample;
  player.distanceFromCenterline = nearest.distance;
  player.progress = unwrappedProgressFor(player, sampled, nearest.index, previousIndex);
  player.warning = nearest.distance >= warningDistance
    ? Math.min(1, nearest.distance / sampled.level.tubeRadius)
    : 0;

  if (nearest.distance > sampled.level.tubeRadius) {
    const overage = nearest.distance / sampled.level.tubeRadius - 1;
    player.health = Math.max(0, player.health - config.damagePerSecond * (1 + overage) * dt);
    player.damageFlash = 1;
  } else {
    player.health = Math.min(1, player.health + config.recoveryPerSecond * dt);
    player.damageFlash = Math.max(0, player.damageFlash - dt * 2.5);
  }
}
