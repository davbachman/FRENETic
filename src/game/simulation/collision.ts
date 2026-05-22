import type { SampledCurve } from '../curves/types';
import { findNearestSample, progressRatioForSample } from '../curves/nearest';
import type { PlayerState, SimulationConfig } from './types';

export function updateCollision(
  player: PlayerState,
  sampled: SampledCurve,
  dt: number,
  config: SimulationConfig,
): void {
  const nearest = findNearestSample(sampled, player.position);
  const warningDistance = sampled.level.tubeRadius * config.warningDistanceRatio;

  player.nearestSample = nearest.sample;
  player.distanceFromCenterline = nearest.distance;
  player.progress = progressRatioForSample(sampled, nearest.sample);
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
