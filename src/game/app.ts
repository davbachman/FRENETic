import { authoredLevels } from './curves/levels';
import { sampleLevelCurve } from './curves/sampler';
import { createSimulationState, updateDemoSimulation } from './simulation/player';
import type { SimulationConfig, SimulationState } from './simulation/types';
import { createGameState } from './state/gameState';
import type { GameState } from './state/gameState';
import { buildTextState } from './testing/textState';

export interface RendererLike {
  resize(width: number, height: number): void;
  render(game: GameState, simulation: SimulationState): void;
  dispose(): void;
}

const FIXED_STEP = 1 / 60;

export const DEFAULT_CONFIG: SimulationConfig = {
  maxHistorySeconds: 3,
};

export class FreneticApp {
  private readonly game = createGameState(authoredLevels);
  private sampled = sampleLevelCurve(this.game.level);
  private simulation = createSimulationState(this.sampled);
  private accumulator = 0;
  private running = false;
  private lastTime = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: RendererLike,
    private readonly config: SimulationConfig = DEFAULT_CONFIG,
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize);
    }
    this.onResize();
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTime = typeof performance === 'undefined' ? 0 : performance.now();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(this.frame);
    }
  }

  advanceTime(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) {
      return;
    }

    this.running = false;
    this.accumulator += ms / 1000;
    this.drainAccumulator();
    this.renderer.render(this.game, this.simulation);
  }

  renderGameToText(): string {
    return buildTextState(this.game, this.simulation);
  }

  resize(): void {
    this.onResize();
  }

  dispose(): void {
    this.running = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
    this.renderer.dispose();
  }

  private step(dt: number): void {
    updateDemoSimulation(this.simulation, dt, this.config);
  }

  private drainAccumulator(): void {
    while (this.accumulator >= FIXED_STEP) {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
  }

  private frame = (time: number): void => {
    if (!this.running) {
      return;
    }

    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.accumulator += dt;
    this.drainAccumulator();

    this.renderer.render(this.game, this.simulation);
    requestAnimationFrame(this.frame);
  };

  private onResize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || (typeof window === 'undefined' ? 800 : window.innerWidth));
    const height = Math.max(1, this.canvas.clientHeight || (typeof window === 'undefined' ? 600 : window.innerHeight));
    this.renderer.resize(width, height);
  };
}
