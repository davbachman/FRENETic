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

function grannyKnot(t: number): Vector3 {
  const u = TAU * t;
  const scale = 0.1;
  return new Vector3(
    scale * (
      -22 * Math.cos(u) -
      128 * Math.sin(u) -
      44 * Math.cos(3 * u) -
      78 * Math.sin(3 * u)
    ),
    scale * (
      -10 * Math.cos(2 * u) -
      27 * Math.sin(2 * u) +
      38 * Math.cos(4 * u) +
      46 * Math.sin(4 * u)
    ),
    scale * (70 * Math.cos(3 * u) - 40 * Math.sin(3 * u)),
  );
}

export const authoredLevels: LevelDefinition[] = [
  {
    id: 'planar-wave',
    name: 'Planar Wave',
    speed: 1.75,
    tubeRadius: 1.8,
    sampleCount: 720,
    acceptableCurvature: [0, 0.5],
    acceptableTorsion: [-0.05, 0.05],
    curve: planarWave,
  },
  {
    id: 'lifted-wave',
    name: 'Lifted Wave',
    speed: 1.85,
    tubeRadius: 1.65,
    sampleCount: 840,
    acceptableCurvature: [0.04, 0.5],
    acceptableTorsion: [-0.28, 0.28],
    curve: liftedWave,
  },
  {
    id: 'trefoil-knot',
    name: 'Trefoil Knot',
    speed: 1.95,
    tubeRadius: 1.45,
    sampleCount: 960,
    acceptableCurvature: [0.06, 0.62],
    acceptableTorsion: [-0.46, 0.46],
    curve: (t) => torusKnot(t, 2, 3, 5.8, 2.1),
  },
  {
    id: 'granny-knot',
    name: 'Granny Knot',
    speed: 2.6,
    tubeRadius: 1.25,
    sampleCount: 1400,
    acceptableCurvature: [0, 0.35],
    acceptableTorsion: [-0.09, 0.09],
    curve: grannyKnot,
  },
];
