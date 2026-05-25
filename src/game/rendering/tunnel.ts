import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import type { CurveSample } from '../curves/types';
import { sampleAtArcLength } from '../simulation/player';
import type { SimulationState } from '../simulation/types';
import { hudColors } from './colors';

const RING_COUNT = 78;
const RING_SEGMENTS = 64;
const WALL_RING_COUNT = RING_COUNT + 10;
const MIN_OPACITY = 0.06;
const MAX_OPACITY = 0.48;
const WALL_RADIUS_RATIO = 1.04;
const RING_BANDS = [
  { halfWidthRatio: 0.015, opacityScale: 1 },
  { halfWidthRatio: 0.03, opacityScale: 0.18 },
  { halfWidthRatio: 0.055, opacityScale: 0.05 },
] as const;
const RING_INDEX_COUNT = RING_SEGMENTS * 6;
const WALL_INDEX_COUNT = (WALL_RING_COUNT - 1) * RING_SEGMENTS * 6;
const NEAR_RING_SKIP = 0;

interface RingVisual {
  group: Group;
  bands: Mesh[];
}

type RingFrame = Pick<CurveSample, 'position' | 'normal' | 'binormal'>;

const UNIT_CIRCLE = Array.from({ length: RING_SEGMENTS }, (_, segment) => {
  const angle = (segment / RING_SEGMENTS) * Math.PI * 2;
  return {
    cos: Math.cos(angle),
    sin: Math.sin(angle),
  };
});

function createRingIndices(): Uint16Array {
  const indices = new Uint16Array(RING_INDEX_COUNT);
  for (let segment = 0; segment < RING_SEGMENTS; segment += 1) {
    const nextSegment = (segment + 1) % RING_SEGMENTS;
    const inner = segment * 2;
    const outer = inner + 1;
    const nextInner = nextSegment * 2;
    const nextOuter = nextInner + 1;
    const indexOffset = segment * 6;

    indices[indexOffset] = inner;
    indices[indexOffset + 1] = outer;
    indices[indexOffset + 2] = nextOuter;
    indices[indexOffset + 3] = inner;
    indices[indexOffset + 4] = nextOuter;
    indices[indexOffset + 5] = nextInner;
  }

  return indices;
}

function createWallIndices(): Uint32Array {
  const indices = new Uint32Array(WALL_INDEX_COUNT);
  for (let ringIndex = 0; ringIndex < WALL_RING_COUNT - 1; ringIndex += 1) {
    for (let segment = 0; segment < RING_SEGMENTS; segment += 1) {
      const nextSegment = (segment + 1) % RING_SEGMENTS;
      const current = ringIndex * RING_SEGMENTS + segment;
      const nextAround = ringIndex * RING_SEGMENTS + nextSegment;
      const nextForward = (ringIndex + 1) * RING_SEGMENTS + segment;
      const diagonal = (ringIndex + 1) * RING_SEGMENTS + nextSegment;
      const indexOffset = (ringIndex * RING_SEGMENTS + segment) * 6;

      indices[indexOffset] = current;
      indices[indexOffset + 1] = nextForward;
      indices[indexOffset + 2] = diagonal;
      indices[indexOffset + 3] = current;
      indices[indexOffset + 4] = diagonal;
      indices[indexOffset + 5] = nextAround;
    }
  }

  return indices;
}

function writeWallRingPositions(sample: RingFrame, radius: number, positions: Float32Array, ringIndex: number): void {
  const ringOffset = ringIndex * RING_SEGMENTS * 3;
  for (let segment = 0; segment < RING_SEGMENTS; segment += 1) {
    const circle = UNIT_CIRCLE[segment];
    const normalScale = circle.cos * radius;
    const binormalScale = circle.sin * radius;
    const positionIndex = ringOffset + segment * 3;

    positions[positionIndex] =
      sample.position.x + sample.normal.x * normalScale + sample.binormal.x * binormalScale;
    positions[positionIndex + 1] =
      sample.position.y + sample.normal.y * normalScale + sample.binormal.y * binormalScale;
    positions[positionIndex + 2] =
      sample.position.z + sample.normal.z * normalScale + sample.binormal.z * binormalScale;
  }
}

function writeRingStripPositions(
  sample: RingFrame,
  innerRadius: number,
  outerRadius: number,
  positions: Float32Array,
): void {
  for (let segment = 0; segment < RING_SEGMENTS; segment += 1) {
    const circle = UNIT_CIRCLE[segment];
    const positionIndex = segment * 6;

    for (let edge = 0; edge < 2; edge += 1) {
      const radius = edge === 0 ? innerRadius : outerRadius;
      const normalScale = circle.cos * radius;
      const binormalScale = circle.sin * radius;
      const edgeIndex = positionIndex + edge * 3;

      positions[edgeIndex] =
        sample.position.x + sample.normal.x * normalScale + sample.binormal.x * binormalScale;
      positions[edgeIndex + 1] =
        sample.position.y + sample.normal.y * normalScale + sample.binormal.y * binormalScale;
      positions[edgeIndex + 2] =
        sample.position.z + sample.normal.z * normalScale + sample.binormal.z * binormalScale;
    }
  }
}

function arcLengthToNextLattice(arcLength: number, stride: number): number {
  if (stride <= 1e-6) {
    return 0;
  }

  const remainder = ((arcLength % stride) + stride) % stride;
  return remainder <= 1e-6 ? 0 : stride - remainder;
}

function calculateRingArcLengthStride(simulation: SimulationState): number {
  const { samples } = simulation.sampled;
  const sampleStride = Math.max(1, Math.floor(samples.length / (RING_COUNT * 4)));
  return (simulation.sampled.totalLength / samples.length) * sampleStride;
}

export function calculateFirstVisibleRingArcLength(simulation: SimulationState): number {
  const startArcLength = (simulation.player.progress % 1) * simulation.sampled.totalLength;
  const arcLengthStride = calculateRingArcLengthStride(simulation);
  const nearArcLength = startArcLength + NEAR_RING_SKIP * arcLengthStride;
  return nearArcLength + arcLengthToNextLattice(nearArcLength, arcLengthStride);
}

export class TunnelRings {
  public readonly group = new Group();

  private readonly wall: Mesh;

  private readonly rings: RingVisual[];

  constructor() {
    const ringIndices = createRingIndices();
    const wallGeometry = new BufferGeometry();
    wallGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(WALL_RING_COUNT * RING_SEGMENTS * 3), 3),
    );
    wallGeometry.setIndex(new BufferAttribute(createWallIndices(), 1));
    wallGeometry.setDrawRange(0, 0);
    this.wall = new Mesh(
      wallGeometry,
      new MeshBasicMaterial({
        color: hudColors.tunnelWall,
        depthWrite: true,
        side: DoubleSide,
      }),
    );
    this.group.add(this.wall);

    this.rings = Array.from({ length: RING_COUNT }, (_, index) => {
      const opacityT = 1 - index / Math.max(1, RING_COUNT - 1);
      const group = new Group();
      const bands = RING_BANDS.map((band) => {
        const material = new MeshBasicMaterial({
          color: hudColors.tunnelRing,
          transparent: true,
          opacity: (MIN_OPACITY + opacityT * (MAX_OPACITY - MIN_OPACITY)) * band.opacityScale,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
        });
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          'position',
          new BufferAttribute(new Float32Array(RING_SEGMENTS * 2 * 3), 3),
        );
        geometry.setIndex(new BufferAttribute(ringIndices.slice(), 1));
        geometry.setDrawRange(0, 0);
        const mesh = new Mesh(geometry, material);
        group.add(mesh);
        return mesh;
      });
      this.group.add(group);
      return { group, bands };
    });
  }

  update(simulation: SimulationState): void {
    const { samples, level } = simulation.sampled;
    if (samples.length === 0) {
      return;
    }
    const arcLengthStride = calculateRingArcLengthStride(simulation);
    const firstVisibleArcLength = calculateFirstVisibleRingArcLength(simulation);
    const wallPosition = this.wall.geometry.getAttribute('position') as BufferAttribute;
    const wallPositions = wallPosition.array as Float32Array;

    for (let wallRingIndex = 0; wallRingIndex < WALL_RING_COUNT; wallRingIndex += 1) {
      const sample = sampleAtArcLength(
        simulation.sampled,
        firstVisibleArcLength + wallRingIndex * arcLengthStride,
      );
      writeWallRingPositions(sample, level.tubeRadius * WALL_RADIUS_RATIO, wallPositions, wallRingIndex);
    }
    wallPosition.needsUpdate = true;
    this.wall.geometry.setDrawRange(0, WALL_INDEX_COUNT);
    this.wall.geometry.computeBoundingSphere();

    for (let ringIndex = 0; ringIndex < this.rings.length; ringIndex += 1) {
      const sample = sampleAtArcLength(
        simulation.sampled,
        firstVisibleArcLength + ringIndex * arcLengthStride,
      );
      const visual = this.rings[ringIndex];
      const distanceT = ringIndex / Math.max(1, this.rings.length - 1);
      const baseOpacity = Math.max(MIN_OPACITY, MAX_OPACITY * (1 - distanceT));

      for (let bandIndex = 0; bandIndex < visual.bands.length; bandIndex += 1) {
        const ring = visual.bands[bandIndex];
        const geometry = ring.geometry as BufferGeometry;
        const position = geometry.getAttribute('position') as BufferAttribute;
        const band = RING_BANDS[bandIndex];
        const halfWidth = level.tubeRadius * band.halfWidthRatio;
        writeRingStripPositions(
          sample,
          Math.max(0.01, level.tubeRadius - halfWidth),
          level.tubeRadius + halfWidth,
          position.array as Float32Array,
        );
        position.needsUpdate = true;
        geometry.setDrawRange(0, RING_INDEX_COUNT);
        geometry.computeBoundingSphere();

        const material = ring.material as MeshBasicMaterial;
        material.opacity = Math.max(MIN_OPACITY * band.opacityScale, baseOpacity * band.opacityScale);
        material.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    this.wall.geometry.dispose();
    (this.wall.material as MeshBasicMaterial).dispose();
    for (const visual of this.rings) {
      for (const ring of visual.bands) {
        ring.geometry.dispose();
        (ring.material as MeshBasicMaterial).dispose();
      }
    }
  }
}
