import { describe, expect, it, vi } from 'vitest';
import { BufferGeometry, LineBasicMaterial, LineLoop, Vector3 } from 'three';
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

describe('TunnelRings', () => {
  it('creates 46 initially hidden line-loop rings with preallocated position attributes', () => {
    const tunnel = new TunnelRings();

    expect(tunnel.group.children).toHaveLength(46);
    for (const child of tunnel.group.children) {
      const ring = child as LineLoop;
      expect(child.type).toBe('LineLoop');
      const geometry = ring.geometry as BufferGeometry;
      const material = ring.material as LineBasicMaterial;
      const position = geometry.getAttribute('position');
      expect(position).toBeDefined();
      expect(position.count).toBe(64);
      expect(geometry.drawRange.count).toBe(0);
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeGreaterThan(0);
    }

    tunnel.dispose();
  });

  it('updates ring geometry from sampled frames and wraps through the closed curve', () => {
    const tunnel = new TunnelRings();
    const simulation = makeSimulation(10);

    tunnel.update(simulation);

    const firstRing = tunnel.group.children[0] as LineLoop;
    const firstPositions = (firstRing.geometry as BufferGeometry).getAttribute('position');
    const firstCenter = new Vector3().fromBufferAttribute(firstPositions, 0);
    expect(firstCenter.x).toBeCloseTo(simulation.sampled.samples[10].position.x, 5);
    expect(firstCenter.distanceTo(simulation.sampled.samples[10].position)).toBeCloseTo(
      simulation.sampled.level.tubeRadius,
      5,
    );

    const wrappedRing = tunnel.group.children[3] as LineLoop;
    const wrappedPositions = (wrappedRing.geometry as BufferGeometry).getAttribute('position');
    const wrappedCenter = new Vector3().fromBufferAttribute(wrappedPositions, 0);
    expect(wrappedCenter.x).toBeCloseTo(simulation.sampled.samples[1].position.x, 5);

    const material = firstRing.material as LineBasicMaterial;
    expect(material.color.getStyle()).toBe('rgb(255,0,170)');
    expect(material.opacity).toBeGreaterThanOrEqual(0.08);

    tunnel.dispose();
  });

  it('reuses position attributes and arrays while mutating ring data across updates', () => {
    const tunnel = new TunnelRings();
    const firstSimulation = makeSimulation(0);
    const secondSimulation = makeSimulation(4);

    tunnel.update(firstSimulation);
    const firstRing = tunnel.group.children[0] as LineLoop;
    const geometry = firstRing.geometry as BufferGeometry;
    const firstAttribute = geometry.getAttribute('position');
    const firstArray = firstAttribute.array;
    const firstX = firstArray[0];

    tunnel.update(secondSimulation);
    const secondAttribute = geometry.getAttribute('position');

    expect(secondAttribute).toBe(firstAttribute);
    expect(secondAttribute.array).toBe(firstArray);
    expect(secondAttribute.array[0]).not.toBe(firstX);
    expect(secondAttribute.array[0]).toBeCloseTo(secondSimulation.sampled.samples[4].position.x, 5);

    tunnel.dispose();
  });

  it('disposes ring geometries and materials', () => {
    const tunnel = new TunnelRings();
    tunnel.update(makeSimulation());

    const geometryDispose = tunnel.group.children.map((child) =>
      vi.spyOn((child as LineLoop).geometry as BufferGeometry, 'dispose'),
    );
    const materialDispose = tunnel.group.children.map((child) =>
      vi.spyOn((child as LineLoop).material as LineBasicMaterial, 'dispose'),
    );

    tunnel.dispose();

    for (const dispose of [...geometryDispose, ...materialDispose]) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  });
});
