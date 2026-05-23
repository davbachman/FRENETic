import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
} from 'three';
import type { CurveSample } from '../curves/types';
import type { SimulationState } from '../simulation/types';
import { hudColors } from './colors';

const RING_COUNT = 46;
const RING_SEGMENTS = 64;
const MIN_OPACITY = 0.08;
const MAX_OPACITY = 0.56;
const UNIT_CIRCLE = Array.from({ length: RING_SEGMENTS }, (_, segment) => {
  const angle = (segment / RING_SEGMENTS) * Math.PI * 2;
  return {
    cos: Math.cos(angle),
    sin: Math.sin(angle),
  };
});

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function writeRingPositions(sample: CurveSample, radius: number, positions: Float32Array): void {
  for (let segment = 0; segment < RING_SEGMENTS; segment += 1) {
    const normalScale = UNIT_CIRCLE[segment].cos * radius;
    const binormalScale = UNIT_CIRCLE[segment].sin * radius;
    const positionIndex = segment * 3;
    positions[positionIndex] =
      sample.position.x + sample.normal.x * normalScale + sample.binormal.x * binormalScale;
    positions[positionIndex + 1] =
      sample.position.y + sample.normal.y * normalScale + sample.binormal.y * binormalScale;
    positions[positionIndex + 2] =
      sample.position.z + sample.normal.z * normalScale + sample.binormal.z * binormalScale;
  }
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
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(RING_SEGMENTS * 3), 3),
      );
      geometry.setDrawRange(0, 0);
      const ring = new LineLoop(geometry, material);
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
      const position = geometry.getAttribute('position') as BufferAttribute;
      writeRingPositions(sample, level.tubeRadius, position.array as Float32Array);
      position.needsUpdate = true;
      geometry.setDrawRange(0, RING_SEGMENTS);
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
