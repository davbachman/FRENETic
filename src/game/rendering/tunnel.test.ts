import { describe, expect, it, vi } from 'vitest';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import type { CurveSample, LevelDefinition, SampledCurve } from '../curves/types';
import type { SimulationState } from '../simulation/types';
import { TunnelRings } from './tunnel';

function makeSample(index: number, count: number): CurveSample {
  return {
    index,
    t: index / count,
    position: new Vector3(index * 10, 0, 0),
    tangent: new Vector3(1, 0, 0),
    normal: new Vector3(0, 1, 0),
    binormal: new Vector3(0, 0, 1),
    curvature: 0,
    torsion: 0,
    arcLength: index * 10,
  };
}

function makeSimulation(nearestIndex = 3): SimulationState {
  const level: LevelDefinition = {
    id: 'test',
    name: 'Test',
    speed: 1,
    tubeRadius: 2,
    sampleCount: 12,
    acceptableCurvature: [0, 1],
    acceptableTorsion: [-1, 1],
    curve: () => new Vector3(),
  };
  const sampled: SampledCurve = {
    level,
    samples: Array.from({ length: level.sampleCount }, (_, index) => makeSample(index, level.sampleCount)),
    totalLength: 120,
  };
  const nearestSample = sampled.samples[nearestIndex];

  return {
    sampled,
    elapsed: 0,
    player: {
      position: nearestSample.position.clone(),
      tangent: nearestSample.tangent.clone(),
      normal: nearestSample.normal.clone(),
      binormal: nearestSample.binormal.clone(),
      currentCurvature: 0,
      currentTorsion: 0,
      progress: nearestIndex / sampled.samples.length,
      nearestSample,
      invariantHistory: [],
    },
  };
}

function ringBands(tunnel: TunnelRings, ringIndex: number): Mesh[] {
  const ringGroup = tunnel.group.children.filter((child) => child.type === 'Group')[ringIndex] as Group;
  return ringGroup.children as Mesh[];
}

function tunnelWall(tunnel: TunnelRings): Mesh {
  return tunnel.group.children.find((child) => child.type === 'Mesh') as Mesh;
}

function attributeCentroid(attribute: BufferAttribute | InterleavedBufferAttribute): Vector3 {
  const center = new Vector3();
  for (let index = 0; index < attribute.count; index += 1) {
    center.add(new Vector3().fromBufferAttribute(attribute, index));
  }
  return center.multiplyScalar(1 / Math.max(1, attribute.count));
}

describe('TunnelRings', () => {
  it('creates many initially hidden ring groups with preallocated thicker neon rim strips', () => {
    const tunnel = new TunnelRings();

    const ringGroups = tunnel.group.children.filter((child) => child.type === 'Group');
    expect(ringGroups).toHaveLength(78);
    for (const child of ringGroups) {
      expect(child.type).toBe('Group');
      const group = child as Group;
      expect(group.children).toHaveLength(3);
      for (const band of group.children as Mesh[]) {
        expect(band.type).toBe('Mesh');
        const geometry = band.geometry as BufferGeometry;
        const material = band.material as MeshBasicMaterial;
        const position = geometry.getAttribute('position');
        expect(position).toBeDefined();
        expect(position.count).toBe(64 * 2);
        expect(geometry.index?.count).toBe(64 * 6);
        expect(geometry.drawRange.count).toBe(0);
        expect(material.transparent).toBe(true);
        expect(material.depthWrite).toBe(false);
        expect(material.blending).toBe(AdditiveBlending);
        expect(material.side).toBe(DoubleSide);
        expect(material.opacity).toBeGreaterThan(0);
      }
    }

    tunnel.dispose();
  });

  it('creates a dark opaque tunnel wall surface behind the neon rims', () => {
    const tunnel = new TunnelRings();
    const wall = tunnelWall(tunnel);
    const geometry = wall.geometry as BufferGeometry;
    const material = wall.material as MeshBasicMaterial;

    expect(wall).toBeDefined();
    expect(geometry.getAttribute('position').count).toBeGreaterThan(64 * 20);
    expect(geometry.index?.count).toBeGreaterThan(64 * 20 * 3);
    expect(geometry.drawRange.count).toBe(0);
    expect(material.color.getStyle()).toBe('rgb(3,11,17)');
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.side).toBe(DoubleSide);

    tunnel.dispose();
  });

  it('does not cap the far tunnel aperture with a fill mesh', () => {
    const tunnel = new TunnelRings();

    expect(tunnel.group.children.filter((child) => child.type === 'Mesh')).toHaveLength(1);

    tunnel.dispose();
  });

  it('updates ring geometry from sampled frames and wraps through the closed curve', () => {
    const tunnel = new TunnelRings();
    const simulation = makeSimulation(10);

    tunnel.update(simulation);

    const wallGeometry = tunnelWall(tunnel).geometry as BufferGeometry;
    expect(wallGeometry.drawRange.count).toBeGreaterThan(64 * 20 * 3);

    const firstRing = ringBands(tunnel, 0)[0];
    const firstPositions = (firstRing.geometry as BufferGeometry).getAttribute('position');
    const firstCenter = attributeCentroid(firstPositions);
    const radialDistances = Array.from({ length: firstPositions.count }, (_, index) =>
      new Vector3().fromBufferAttribute(firstPositions, index).distanceTo(firstCenter),
    );
    expect(firstCenter.x).toBeCloseTo(simulation.sampled.samples[10].position.x, 5);
    const coreWidth = Math.max(...radialDistances) - Math.min(...radialDistances);
    expect(coreWidth).toBeGreaterThan(0.045);
    expect(coreWidth).toBeLessThan(0.09);

    const wrappedRing = ringBands(tunnel, 3)[0];
    const wrappedPositions = (wrappedRing.geometry as BufferGeometry).getAttribute('position');
    const wrappedCenter = attributeCentroid(wrappedPositions);
    expect(wrappedCenter.x).toBeCloseTo(simulation.sampled.samples[1].position.x, 5);

    const material = firstRing.material as MeshBasicMaterial;
    expect(material.color.getStyle()).toBe('rgb(255,159,47)');
    expect(material.opacity).toBeGreaterThanOrEqual(0.32);
    expect(material.opacity).toBeLessThan(0.55);

    tunnel.dispose();
  });

  it('reuses position attributes and arrays while mutating ring data across updates', () => {
    const tunnel = new TunnelRings();
    const firstSimulation = makeSimulation(0);
    const secondSimulation = makeSimulation(4);

    tunnel.update(firstSimulation);
    const firstBandState = ringBands(tunnel, 0).map((ring) => {
      const geometry = ring.geometry as BufferGeometry;
      const attribute = geometry.getAttribute('position');
      return {
        geometry,
        attribute,
        array: attribute.array,
        firstX: attribute.array[0],
      };
    });

    tunnel.update(secondSimulation);
    const visibleSample = secondSimulation.sampled.samples[4];
    const bandState = firstBandState.map(({ geometry, attribute, array, firstX }) => {
      const secondAttribute = geometry.getAttribute('position');
      const ringCenter = attributeCentroid(secondAttribute);
      const rimPoint = new Vector3().fromBufferAttribute(secondAttribute, 0);
      const radialDistances = Array.from({ length: secondAttribute.count }, (_, index) =>
        new Vector3().fromBufferAttribute(secondAttribute, index).distanceTo(ringCenter),
      );

      expect(secondAttribute).toBe(attribute);
      expect(secondAttribute.array).toBe(array);
      expect(secondAttribute.array[0]).not.toBe(firstX);
      expect(secondAttribute.array[0]).toBeCloseTo(visibleSample.position.x, 5);
      expect(geometry.drawRange.count).toBe(64 * 6);

      return {
        radius: rimPoint.distanceTo(visibleSample.position),
        radialWidth: Math.max(...radialDistances) - Math.min(...radialDistances),
      };
    });

    expect(bandState[0].radius).toBeGreaterThan(secondSimulation.sampled.level.tubeRadius - 0.1);
    expect(bandState[0].radialWidth).toBeGreaterThan(0.045);
    expect(bandState[0].radialWidth).toBeLessThan(0.09);
    expect(bandState[1].radialWidth).toBeGreaterThan(bandState[0].radialWidth);
    expect(bandState[2].radialWidth).toBeGreaterThan(bandState[1].radialWidth);

    tunnel.dispose();
  });

  it('keeps ring geometry on the same world lattice within a spacing interval', () => {
    const tunnel = new TunnelRings();
    const firstSimulation = makeSimulation(3);
    const secondSimulation = makeSimulation(3);
    firstSimulation.player.progress = 3.1 / firstSimulation.sampled.samples.length;
    secondSimulation.player.progress = 3.6 / secondSimulation.sampled.samples.length;

    tunnel.update(firstSimulation);
    const firstCenter = attributeCentroid(
      (ringBands(tunnel, 0)[0].geometry as BufferGeometry).getAttribute('position'),
    );

    tunnel.update(secondSimulation);
    const secondCenter = attributeCentroid(
      (ringBands(tunnel, 0)[0].geometry as BufferGeometry).getAttribute('position'),
    );

    expect(secondCenter.x).toBeCloseTo(firstCenter.x, 5);
    expect(secondCenter.distanceTo(firstCenter)).toBeLessThan(0.01);

    tunnel.dispose();
  });

  it('anchors ring spacing so rings move toward the camera between lattice resets', () => {
    const tunnel = new TunnelRings();
    const firstSimulation = makeSimulation(3);
    const secondSimulation = makeSimulation(3);
    firstSimulation.player.progress = 3.1 / firstSimulation.sampled.samples.length;
    secondSimulation.player.progress = 3.6 / secondSimulation.sampled.samples.length;
    firstSimulation.player.position.setX(31);
    secondSimulation.player.position.setX(36);

    tunnel.update(firstSimulation);
    const firstCenter = attributeCentroid(
      (ringBands(tunnel, 0)[0].geometry as BufferGeometry).getAttribute('position'),
    );

    tunnel.update(secondSimulation);
    const secondCenter = attributeCentroid(
      (ringBands(tunnel, 0)[0].geometry as BufferGeometry).getAttribute('position'),
    );

    const firstDistanceAhead = firstCenter.x - firstSimulation.player.position.x;
    const secondDistanceAhead = secondCenter.x - secondSimulation.player.position.x;

    expect(secondDistanceAhead).toBeLessThan(firstDistanceAhead - 2);

    tunnel.dispose();
  });

  it('keeps core layers brighter than halo layers and fades distant rings', () => {
    const tunnel = new TunnelRings();

    tunnel.update(makeSimulation());

    const nearBands = ringBands(tunnel, 0);
    const farBands = ringBands(tunnel, tunnel.group.children.filter((child) => child.type === 'Group').length - 1);
    const nearCore = nearBands[0].material as MeshBasicMaterial;
    const nearOuterHalo = nearBands[2].material as MeshBasicMaterial;
    const farCore = farBands[0].material as MeshBasicMaterial;

    expect(nearCore.opacity).toBeGreaterThan(nearOuterHalo.opacity);
    expect(nearCore.opacity).toBeGreaterThan(farCore.opacity);
    expect(nearCore.opacity).toBeGreaterThan(0.32);
    expect(farCore.opacity).toBeGreaterThanOrEqual(0.06);
    expect(nearCore.color.getStyle()).toBe('rgb(255,159,47)');

    tunnel.dispose();
  });

  it('disposes ring geometries and materials', () => {
    const tunnel = new TunnelRings();
    tunnel.update(makeSimulation());

    const wall = tunnelWall(tunnel);
    const bands = tunnel.group.children
      .filter((child) => child.type === 'Group')
      .flatMap((child) => (child as Group).children as Mesh[]);
    const geometryDispose = bands.map((band) =>
      vi.spyOn(band.geometry as BufferGeometry, 'dispose'),
    );
    const materialDispose = bands.map((band) =>
      vi.spyOn(band.material as MeshBasicMaterial, 'dispose'),
    );

    const wallGeometryDispose = vi.spyOn(wall.geometry as BufferGeometry, 'dispose');
    const wallMaterialDispose = vi.spyOn(wall.material as MeshBasicMaterial, 'dispose');

    tunnel.dispose();

    for (const dispose of [...geometryDispose, ...materialDispose]) {
      expect(dispose).toHaveBeenCalledOnce();
    }
    expect(wallGeometryDispose).toHaveBeenCalledOnce();
    expect(wallMaterialDispose).toHaveBeenCalledOnce();
  });
});
