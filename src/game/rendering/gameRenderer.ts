import {
  AmbientLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { RendererLike } from '../app';
import type { GameState } from '../state/gameState';
import type { SimulationState } from '../simulation/types';
import { hudColors } from './colors';
import { HudOverlay } from './hud';
import { Starfield } from './starfield';
import { TunnelRings } from './tunnel';

const SCREEN_UP = new Vector3(0, 0, 1);
const CENTERLINE_LOOKAHEAD_FRACTION = 24;

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

export function calculateCameraLookTarget(simulation: SimulationState): Vector3 {
  const { player } = simulation;
  const { samples } = simulation.sampled;
  if (samples.length === 0) {
    return player.position.clone().add(player.tangent);
  }
  const lookahead = Math.max(1, Math.floor(samples.length / CENTERLINE_LOOKAHEAD_FRACTION));
  const previewSample =
    samples[wrap(player.nearestSample.index + lookahead, samples.length)] ?? player.nearestSample;
  return previewSample.position.clone();
}

export class GameRenderer implements RendererLike {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(74, 1, 0.03, 180);
  private readonly starfield = new Starfield();
  private readonly tunnel = new TunnelRings();
  private readonly hud = new HudOverlay();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(hudColors.background, 1);
    this.renderer.setPixelRatio(Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio));

    this.scene.add(new AmbientLight(0xffffff, 1.15));
    this.scene.add(this.starfield.points);
    this.scene.add(this.tunnel.group);
    this.camera.up.copy(SCREEN_UP);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.hud.resize(width, height);
  }

  render(game: GameState, simulation: SimulationState): void {
    this.tunnel.update(simulation);
    this.starfield.points.position.copy(simulation.player.position);

    this.camera.position.copy(simulation.player.position);
    this.camera.up.copy(SCREEN_UP);
    this.camera.lookAt(calculateCameraLookTarget(simulation));

    this.hud.draw(game, simulation);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.hud.scene, this.hud.camera);
  }

  dispose(): void {
    this.hud.dispose();
    this.tunnel.dispose();
    this.starfield.dispose();
    this.renderer.dispose();
  }
}
