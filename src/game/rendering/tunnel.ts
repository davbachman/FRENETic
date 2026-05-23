import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
  Vector3,
} from 'three';
import type { CurveSample } from '../curves/types';
import type { SimulationState } from '../simulation/types';
import { hudColors } from './colors';

const RING_COUNT = 46;
const RING_SEGMENTS = 64;
const MIN_OPACITY = 0.08;
const MAX_OPACITY = 0.56;

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function ringPositions(sample: CurveSample, radius: number): Float32Array {
  const positions = new Float32Array(RING_SEGMENTS * 3);

  for (let segment = 0; segment < RING_SEGMENTS; segment += 1) {
    const angle = (segment / RING_SEGMENTS) * Math.PI * 2;
    const offset = sample.normal
      .clone()
      .multiplyScalar(Math.cos(angle) * radius)
      .add(sample.binormal.clone().multiplyScalar(Math.sin(angle) * radius));
    const point = sample.position.clone().add(offset);
    const positionIndex = segment * 3;
    positions[positionIndex] = point.x;
    positions[positionIndex + 1] = point.y;
    positions[positionIndex + 2] = point.z;
  }

  return positions;
}

export class TunnelRings {
  public readonly group = new Group();

  private readonly rings: LineLoop[];

  constructor() {
    this.rings = Array.from({ length: RING_COUNT }, (_, index) => {
      const opacityT = 1 - index / Math.max(1, RING_COUNT - 1);
      const material = new LineBasicMaterial({
        color: hudColors.cyan,
        transparent: true,
        opacity: MIN_OPACITY + opacityT * (MAX_OPACITY - MIN_OPACITY),
        depthWrite: false,
      });
      const ring = new LineLoop(new BufferGeometry(), material);
      this.group.add(ring);
      return ring;
    });
  }

  update(simulation: SimulationState): void {
    const { samples, level } = simulation.sampled;
    if (samples.length === 0) {
      return;
    }

    const color = new Color(level.visual.ringColor);
    const sampleStride = Math.max(1, Math.floor(samples.length / (RING_COUNT * 4)));
    const startIndex = simulation.player.nearestSample.index;

    for (let ringIndex = 0; ringIndex < this.rings.length; ringIndex += 1) {
      const sample = samples[wrap(startIndex + ringIndex * sampleStride, samples.length)];
      const ring = this.rings[ringIndex];
      const geometry = ring.geometry as BufferGeometry;
      geometry.setAttribute(
        'position',
        new BufferAttribute(ringPositions(sample, level.tubeRadius), 3),
      );
      geometry.computeBoundingSphere();

      const material = ring.material as LineBasicMaterial;
      const distanceT = ringIndex / Math.max(1, this.rings.length - 1);
      material.color.copy(color);
      material.opacity = Math.max(MIN_OPACITY, MAX_OPACITY * (1 - distanceT));
      material.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const ring of this.rings) {
      ring.geometry.dispose();
      (ring.material as LineBasicMaterial).dispose();
    }
  }
}
