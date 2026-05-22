import { Vector3 } from 'three';
import type { CurveSample, SampledCurve } from './types';

export interface NearestSampleResult {
  sample: CurveSample;
  index: number;
  distance: number;
}

export function findNearestSample(sampled: SampledCurve, point: Vector3): NearestSampleResult {
  let best = sampled.samples[0];
  let bestDistanceSq = best.position.distanceToSquared(point);

  for (let index = 1; index < sampled.samples.length; index += 1) {
    const sample = sampled.samples[index];
    const distanceSq = sample.position.distanceToSquared(point);
    if (distanceSq < bestDistanceSq) {
      best = sample;
      bestDistanceSq = distanceSq;
    }
  }

  return {
    sample: best,
    index: best.index,
    distance: Math.sqrt(bestDistanceSq),
  };
}

export function progressRatioForSample(sampled: SampledCurve, sample: CurveSample): number {
  return sample.arcLength / sampled.totalLength;
}
