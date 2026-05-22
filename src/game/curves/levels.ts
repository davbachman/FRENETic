import { Vector3 } from 'three';
import type { LevelDefinition } from './types';

const TAU = Math.PI * 2;

function planarWave(t: number): Vector3 {
  const a = TAU * t;
  const radius = 8 + 1.1 * Math.sin(5 * a);
  return new Vector3(radius * Math.cos(a), radius * Math.sin(a), 0);
}

function liftedWave(t: number): Vector3 {
  const a = TAU * t;
  const radius = 8 + 0.9 * Math.sin(4 * a);
  return new Vector3(
    radius * Math.cos(a),
    radius * Math.sin(a),
    1.8 * Math.sin(3 * a + 0.35 * Math.sin(2 * a)),
  );
}

function torusKnot(t: number, p: number, q: number, major = 6, minor = 2): Vector3 {
  const a = TAU * t;
  const tube = major + minor * Math.cos(q * a);
  return new Vector3(
    tube * Math.cos(p * a),
    tube * Math.sin(p * a),
    minor * Math.sin(q * a),
  );
}

export const authoredLevels: LevelDefinition[] = [
  {
    id: 'planar-wave',
    name: 'Planar Wave',
    speed: 7,
    tubeRadius: 1.8,
    sampleCount: 720,
    acceptableCurvature: [0.03, 0.42],
    acceptableTorsion: [-0.05, 0.05],
    curve: planarWave,
    visual: { ringColor: '#36f3ff', fogColor: '#02040a' },
  },
  {
    id: 'lifted-wave',
    name: 'Lifted Wave',
    speed: 7.4,
    tubeRadius: 1.65,
    sampleCount: 840,
    acceptableCurvature: [0.04, 0.5],
    acceptableTorsion: [-0.28, 0.28],
    curve: liftedWave,
    visual: { ringColor: '#57f5ff', fogColor: '#02040a' },
  },
  {
    id: 'trefoil-knot',
    name: 'Trefoil Knot',
    speed: 7.8,
    tubeRadius: 1.45,
    sampleCount: 960,
    acceptableCurvature: [0.06, 0.62],
    acceptableTorsion: [-0.46, 0.46],
    curve: (t) => torusKnot(t, 2, 3, 5.8, 2.1),
    visual: { ringColor: '#7cfff0', fogColor: '#02040a' },
  },
  {
    id: 'cinquefoil-knot',
    name: 'Cinquefoil Knot',
    speed: 8.2,
    tubeRadius: 1.25,
    sampleCount: 1200,
    acceptableCurvature: [0.08, 0.75],
    acceptableTorsion: [-0.65, 0.65],
    curve: (t) => torusKnot(t, 2, 5, 5.4, 2.0),
    visual: { ringColor: '#9dffb0', fogColor: '#02040a' },
  },
];
