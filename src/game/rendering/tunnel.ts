import {
  BufferAttribute,
  BufferGeometry,
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
const RING_LAYERS = [
  { radiusOffset: 0, opacityScale: 1 },
  { radiusOffset: -0.035, opacityScale: 0.38 },
  { radiusOffset: 0.035, opacityScale: 0.3 },
] as const;

interface RingVisual {
  group: Group;
  layers: LineLoop[];
}

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

  private readonly rings: RingVisual[];

  constructor() {
    this.rings = Array.from({ length: RING_COUNT }, (_, index) => {
      const opacityT = 1 - index / Math.max(1, RING_COUNT - 1);
      const group = new Group();
      const layers = RING_LAYERS.map((layer) => {
        const material = new LineBasicMaterial({
          color: hudColors.cyan,
          transparent: true,
          opacity: (MIN_OPACITY + opacityT * (MAX_OPACITY - MIN_OPACITY)) * layer.opacityScale,
          depthWrite: false,
        });
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          'position',
          new BufferAttribute(new Float32Array(RING_SEGMENTS * 3), 3),
        );
        geometry.setDrawRange(0, 0);
        const line = new LineLoop(geometry, material);
        group.add(line);
        return line;
      });
      this.group.add(group);
      return { group, layers };
    });
  }

  update(simulation: SimulationState): void {
    const { samples, level } = simulation.sampled;
    if (samples.length === 0) {
      return;
    }
    const sampleStride = Math.max(1, Math.floor(samples.length / (RING_COUNT * 4)));
    const startIndex = simulation.player.nearestSample.index;

    for (let ringIndex = 0; ringIndex < this.rings.length; ringIndex += 1) {
      const sample = samples[wrap(startIndex + ringIndex * sampleStride, samples.length)];
      const visual = this.rings[ringIndex];
      const distanceT = ringIndex / Math.max(1, this.rings.length - 1);
      const baseOpacity = Math.max(MIN_OPACITY, MAX_OPACITY * (1 - distanceT));

      for (let layerIndex = 0; layerIndex < visual.layers.length; layerIndex += 1) {
        const ring = visual.layers[layerIndex];
        const geometry = ring.geometry as BufferGeometry;
        const position = geometry.getAttribute('position') as BufferAttribute;
        const layer = RING_LAYERS[layerIndex];
        const layerRadius = level.tubeRadius * (1 + layer.radiusOffset);
        writeRingPositions(sample, layerRadius, position.array as Float32Array);
        position.needsUpdate = true;
        geometry.setDrawRange(0, RING_SEGMENTS);
        geometry.computeBoundingSphere();

        const material = ring.material as LineBasicMaterial;
        material.opacity = Math.max(MIN_OPACITY * layer.opacityScale, baseOpacity * layer.opacityScale);
        material.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const visual of this.rings) {
      for (const ring of visual.layers) {
        ring.geometry.dispose();
        (ring.material as LineBasicMaterial).dispose();
      }
    }
  }
}
