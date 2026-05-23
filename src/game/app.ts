import { authoredLevels } from './curves/levels';
import { sampleLevelCurve } from './curves/sampler';
import { PointerTrackpad } from './input/pointerTrackpad';
import { createSimulationState, updateSimulation } from './simulation/player';
import type { SimulationConfig, SimulationState } from './simulation/types';
import { createGameState, nextLevel, restartLevel, setMode, updateProgressMode } from './state/gameState';
import type { GameState } from './state/gameState';
import { buildTextState } from './testing/textState';

export interface RendererLike {
  resize(width: number, height: number): void;
  render(game: GameState, simulation: SimulationState): void;
  dispose(): void;
}

const FIXED_STEP = 1 / 60;

const DEFAULT_CONFIG: SimulationConfig = {
  steeringResponseSeconds: 0.18,
  maxCurvature: 0.75,
  maxHistorySeconds: 3,
  recoveryPerSecond: 0.12,
  damagePerSecond: 0.45,
  warningDistanceRatio: 0.72,
};

export class FreneticApp {
  private readonly game = createGameState(authoredLevels);
  private sampled = sampleLevelCurve(this.game.level);
  private simulation = createSimulationState(this.sampled);
  private accumulator = 0;
  private running = false;
  private lastTime = 0;
  private trackpad: PointerTrackpad | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: RendererLike,
    private readonly config: SimulationConfig = DEFAULT_CONFIG,
  ) {
    if (typeof window !== 'undefined' && 'addEventListener' in canvas) {
      this.trackpad = new PointerTrackpad(canvas);
      window.addEventListener('keydown', this.onKeyDown);
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

  startPlaying(): void {
    setMode(this.game, 'playing');
  }

  restartLevel(): void {
    restartLevel(this.game);
    this.resetSimulation();
  }

  nextLevel(): void {
    nextLevel(this.game);
    this.resetSimulation();
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

  dispose(): void {
    this.running = false;
    this.trackpad?.destroy();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('resize', this.onResize);
    }
    this.renderer.dispose();
  }

  private resetSimulation(): void {
    this.sampled = sampleLevelCurve(this.game.level);
    this.simulation = createSimulationState(this.sampled);
    this.accumulator = 0;
  }

  private step(dt: number): void {
    if (this.game.mode === 'playing') {
      updateSimulation(this.simulation, this.trackpad?.getSteering() ?? { x: 0, y: 0 }, dt, this.config);
      updateProgressMode(this.game, this.simulation.player.progress, this.simulation.player.health);
    }
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

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && this.game.mode === 'start') {
      this.startPlaying();
    } else if (event.key === 'Escape') {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else if (this.game.mode === 'paused') {
        setMode(this.game, 'playing');
      }
    } else if (event.key.toLowerCase() === 'r') {
      this.restartLevel();
    } else if (event.key.toLowerCase() === 'n' || event.key.toLowerCase() === 'b') {
      this.nextLevel();
    } else if (event.key.toLowerCase() === 'p') {
      setMode(this.game, this.game.mode === 'paused' ? 'playing' : 'paused');
    } else if (event.key.toLowerCase() === 'f') {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void this.canvas.requestFullscreen?.();
      }
    }
  };
}
