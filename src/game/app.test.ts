import { afterEach, describe, expect, it, vi } from 'vitest';
import { FreneticApp } from './app';

class RecordingRenderer {
  renderCalls = 0;

  resize(): void {}
  render(): void {
    this.renderCalls += 1;
  }
  dispose(): void {}
}

function createCanvas(): HTMLCanvasElement {
  return { width: 800, height: 600 } as HTMLCanvasElement;
}

function createDomCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    requestFullscreen: vi.fn().mockResolvedValue(undefined),
  } as unknown as HTMLCanvasElement;
}

function createAppWithKeyboard() {
  let keydown: ((event: KeyboardEvent) => void) | null = null;
  vi.stubGlobal('window', {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === 'keydown') {
        keydown = listener as (event: KeyboardEvent) => void;
      }
    }),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('document', {
    fullscreenElement: null,
    exitFullscreen: vi.fn().mockResolvedValue(undefined),
  });

  const canvas = createDomCanvas();
  const app = new FreneticApp(canvas, new RecordingRenderer());

  if (!keydown) {
    throw new Error('keydown listener was not registered');
  }

  return {
    app,
    canvas,
    press: (key: string) => keydown?.({ key } as KeyboardEvent),
  };
}

function renderPayload(app: FreneticApp): ReturnType<typeof JSON.parse> {
  return JSON.parse(app.renderGameToText());
}

describe('FreneticApp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('advances simulation through deterministic time steps', () => {
    const renderer = new RecordingRenderer();
    const app = new FreneticApp(createCanvas(), renderer);
    const before = renderPayload(app);

    app.startPlaying();
    app.advanceTime(1000);
    const after = renderPayload(app);

    expect(after.mode).toBe('playing');
    expect(after.player.progress).toBeGreaterThan(before.player.progress + 0.05);
    expect(after.hud.steeringTracePoints).toBeGreaterThan(before.hud.steeringTracePoints);
    expect(after.player.health).toBeGreaterThan(0);
    expect(renderer.renderCalls).toBe(1);
  });

  it('does not step for non-positive or below-fixed-step deltas', () => {
    const app = new FreneticApp(createCanvas(), new RecordingRenderer());
    app.startPlaying();

    app.advanceTime(0);
    app.advanceTime(-100);
    app.advanceTime(1);
    const belowStep = renderPayload(app);

    expect(belowStep.player.progress).toBe(0);
    expect(belowStep.hud.steeringTracePoints).toBe(0);

    app.advanceTime(15);
    const stillBelowStep = renderPayload(app);

    expect(stillBelowStep.player.progress).toBe(0);
    expect(stillBelowStep.hud.steeringTracePoints).toBe(0);

    app.advanceTime(1);
    const afterOneStep = renderPayload(app);

    expect(afterOneStep.player.progress).toBeGreaterThan(0);
    expect(afterOneStep.hud.steeringTracePoints).toBe(1);
  });

  it('accumulates repeated sub-step deltas like one equivalent elapsed delta', () => {
    const repeated = new FreneticApp(createCanvas(), new RecordingRenderer());
    repeated.startPlaying();
    for (let i = 0; i < 17; i += 1) {
      repeated.advanceTime(1);
    }

    const single = new FreneticApp(createCanvas(), new RecordingRenderer());
    single.startPlaying();
    single.advanceTime(17);

    const repeatedPayload = renderPayload(repeated);
    const singlePayload = renderPayload(single);
    expect(repeatedPayload.player.progress).toBe(singlePayload.player.progress);
    expect(repeatedPayload.hud.steeringTracePoints).toBe(singlePayload.hud.steeringTracePoints);
  });

  it('resets simulation when advancing level', () => {
    const app = new FreneticApp(createCanvas(), new RecordingRenderer());
    app.startPlaying();
    app.advanceTime(1000);
    const played = renderPayload(app);

    expect(played.player.progress).toBeGreaterThan(0.05);
    expect(played.hud.steeringTracePoints).toBeGreaterThan(0);

    app.nextLevel();
    const payload = renderPayload(app);
    expect(payload.level.id).toBe('lifted-wave');
    expect(payload.mode).toBe('playing');
    expect(payload.player.progress).toBe(0);
    expect(payload.player.distanceFromCenterline).toBe(0);
    expect(payload.player.health).toBe(1);
    expect(payload.player.currentCurvature).toBe(0);
    expect(payload.hud.steeringTracePoints).toBe(0);
  });

  it('clears partial fixed-step time when advancing level', () => {
    const app = new FreneticApp(createCanvas(), new RecordingRenderer());
    app.startPlaying();
    app.advanceTime(15);

    app.nextLevel();
    app.advanceTime(2);
    const payload = renderPayload(app);

    expect(payload.level.id).toBe('lifted-wave');
    expect(payload.mode).toBe('playing');
    expect(payload.player.progress).toBe(0);
    expect(payload.hud.steeringTracePoints).toBe(0);
  });

  it('clears partial fixed-step time when restarting level', () => {
    const app = new FreneticApp(createCanvas(), new RecordingRenderer());
    app.startPlaying();
    app.advanceTime(15);

    app.restartLevel();
    app.advanceTime(2);
    const payload = renderPayload(app);

    expect(payload.level.id).toBe('planar-wave');
    expect(payload.mode).toBe('playing');
    expect(payload.player.progress).toBe(0);
    expect(payload.hud.steeringTracePoints).toBe(0);
  });

  it('does not schedule duplicate animation loops when started more than once', () => {
    const scheduledFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      scheduledFrames.push(callback);
      return scheduledFrames.length;
    });
    const app = new FreneticApp(createCanvas(), new RecordingRenderer());

    app.start();
    app.start();

    expect(scheduledFrames).toHaveLength(1);
  });

  it('toggles fullscreen with F', () => {
    const { canvas, press } = createAppWithKeyboard();
    const exitFullscreen = vi.mocked(document.exitFullscreen);

    press('F');

    expect(canvas.requestFullscreen).toHaveBeenCalledOnce();
    expect(exitFullscreen).not.toHaveBeenCalled();

    vi.stubGlobal('document', {
      fullscreenElement: canvas,
      exitFullscreen,
    });

    press('f');

    expect(canvas.requestFullscreen).toHaveBeenCalledOnce();
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it('exits fullscreen with Escape before changing pause state', () => {
    const { app, canvas, press } = createAppWithKeyboard();
    app.startPlaying();
    press('P');
    expect(renderPayload(app).mode).toBe('paused');

    const exitFullscreen = vi.mocked(document.exitFullscreen);
    vi.stubGlobal('document', {
      fullscreenElement: canvas,
      exitFullscreen,
    });

    press('Escape');

    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(renderPayload(app).mode).toBe('paused');
  });

  it('unpauses with Escape when fullscreen is inactive', () => {
    const { app, press } = createAppWithKeyboard();
    app.startPlaying();
    press('P');

    press('Escape');

    expect(renderPayload(app).mode).toBe('playing');
  });

  it('advances levels with N and the browser-client-compatible B alias', () => {
    const { app, press } = createAppWithKeyboard();

    press('N');
    expect(renderPayload(app).level.id).toBe('lifted-wave');

    press('b');
    expect(renderPayload(app).level.id).toBe('trefoil-knot');
  });
});
