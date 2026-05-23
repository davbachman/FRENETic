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
import { TunnelRings } from './tunnel';

const SCREEN_UP = new Vector3(0, 0, 1);

export class GameRenderer implements RendererLike {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(74, 1, 0.03, 180);
  private readonly tunnel = new TunnelRings();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(hudColors.background, 1);
    this.renderer.setPixelRatio(Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio));

    this.scene.add(new AmbientLight(0xffffff, 1.15));
    this.scene.add(this.tunnel.group);
    this.camera.up.copy(SCREEN_UP);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(_game: GameState, simulation: SimulationState): void {
    this.tunnel.update(simulation);

    this.camera.position.copy(simulation.player.position);
    this.camera.up.copy(SCREEN_UP);
    this.camera.lookAt(
      simulation.player.position.clone().add(simulation.player.tangent),
    );

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.tunnel.dispose();
    this.renderer.dispose();
  }
}
