import { describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Group, LineBasicMaterial, LineLoop, Vector3 } from 'three';
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
    visual: { ringColor: '#ff00aa', fogColor: '#000000' },
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
      rawSteering: { x: 0, y: 0 },
      smoothedSteering: { x: 0, y: 0 },
      currentCurvature: 0,
      currentTorsion: 0,
      previousCurvatureDirection: { x: 0, y: 0 },
      health: 1,
      warning: 0,
      damageFlash: 0,
      progress: nearestIndex / sampled.samples.length,
      nearestSample,
      distanceFromCenterline: 0,
      steeringHistory: [],
    },
  };
}

function ringLayers(tunnel: TunnelRings, ringIndex: number): LineLoop[] {
  const ringGroup = tunnel.group.children[ringIndex] as Group;
  return ringGroup.children as LineLoop[];
}

describe('TunnelRings', () => {
  it('creates 46 initially hidden volumetric ring groups with preallocated line layers', () => {
    const tunnel = new TunnelRings();

    expect(tunnel.group.children).toHaveLength(46);
    for (const child of tunnel.group.children) {
      expect(child.type).toBe('Group');
      const group = child as Group;
      expect(group.children).toHaveLength(3);
      for (const layer of group.children as LineLoop[]) {
        expect(layer.type).toBe('LineLoop');
        const geometry = layer.geometry as BufferGeometry;
        const material = layer.material as LineBasicMaterial;
        const position = geometry.getAttribute('position');
        expect(position).toBeDefined();
        expect(position.count).toBe(64);
        expect(geometry.drawRange.count).toBe(0);
        expect(material.transparent).toBe(true);
        expect(material.depthWrite).toBe(false);
        expect(material.opacity).toBeGreaterThan(0);
      }
    }

    tunnel.dispose();
  });

  it('updates ring geometry from sampled frames and wraps through the closed curve', () => {
    const tunnel = new TunnelRings();
    const simulation = makeSimulation(10);

    tunnel.update(simulation);

    const firstRing = ringLayers(tunnel, 0)[0];
    const firstPositions = (firstRing.geometry as BufferGeometry).getAttribute('position');
    const firstCenter = new Vector3().fromBufferAttribute(firstPositions, 0);
    expect(firstCenter.x).toBeCloseTo(simulation.sampled.samples[10].position.x, 5);
    expect(firstCenter.distanceTo(simulation.sampled.samples[10].position)).toBeCloseTo(
      simulation.sampled.level.tubeRadius,
      5,
    );

    const wrappedRing = ringLayers(tunnel, 3)[0];
    const wrappedPositions = (wrappedRing.geometry as BufferGeometry).getAttribute('position');
    const wrappedCenter = new Vector3().fromBufferAttribute(wrappedPositions, 0);
    expect(wrappedCenter.x).toBeCloseTo(simulation.sampled.samples[1].position.x, 5);

    const material = firstRing.material as LineBasicMaterial;
    expect(material.color.getStyle()).toBe('rgb(54,243,255)');
    expect(material.opacity).toBeGreaterThanOrEqual(0.08);

    tunnel.dispose();
  });

  it('reuses position attributes and arrays while mutating ring data across updates', () => {
    const tunnel = new TunnelRings();
    const firstSimulation = makeSimulation(0);
    const secondSimulation = makeSimulation(4);

    tunnel.update(firstSimulation);
    const firstLayerState = ringLayers(tunnel, 0).map((ring) => {
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
    const updatedSample = secondSimulation.sampled.samples[4];
    const layerDistances = firstLayerState.map(({ geometry, attribute, array, firstX }) => {
      const secondAttribute = geometry.getAttribute('position');
      const firstPoint = new Vector3().fromBufferAttribute(secondAttribute, 0);

      expect(secondAttribute).toBe(attribute);
      expect(secondAttribute.array).toBe(array);
      expect(secondAttribute.array[0]).not.toBe(firstX);
      expect(secondAttribute.array[0]).toBeCloseTo(updatedSample.position.x, 5);
      expect(geometry.drawRange.count).toBe(64);

      return firstPoint.distanceTo(updatedSample.position);
    });

    expect(layerDistances[0]).toBeCloseTo(secondSimulation.sampled.level.tubeRadius, 5);
    expect(layerDistances[1]).toBeLessThan(layerDistances[0] - 0.05);
    expect(layerDistances[2]).toBeGreaterThan(layerDistances[0] + 0.05);

    tunnel.dispose();
  });

  it('keeps core layers brighter than halo layers and fades distant rings', () => {
    const tunnel = new TunnelRings();

    tunnel.update(makeSimulation());

    const nearLayers = ringLayers(tunnel, 0);
    const farLayers = ringLayers(tunnel, tunnel.group.children.length - 1);
    const nearCore = nearLayers[0].material as LineBasicMaterial;
    const nearOuterHalo = nearLayers[2].material as LineBasicMaterial;
    const farCore = farLayers[0].material as LineBasicMaterial;

    expect(nearCore.opacity).toBeGreaterThan(nearOuterHalo.opacity);
    expect(nearCore.opacity).toBeGreaterThan(farCore.opacity);
    expect(nearCore.color.getStyle()).toBe('rgb(54,243,255)');

    tunnel.dispose();
  });

  it('disposes ring geometries and materials', () => {
    const tunnel = new TunnelRings();
    tunnel.update(makeSimulation());

    const layers = tunnel.group.children.flatMap((child) => (child as Group).children as LineLoop[]);
    const geometryDispose = layers.map((layer) =>
      vi.spyOn(layer.geometry as BufferGeometry, 'dispose'),
    );
    const materialDispose = layers.map((layer) =>
      vi.spyOn(layer.material as LineBasicMaterial, 'dispose'),
    );

    tunnel.dispose();

    for (const dispose of [...geometryDispose, ...materialDispose]) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  });
});
