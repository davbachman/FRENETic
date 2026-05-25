import { afterEach, describe, expect, it, vi } from 'vitest';
import { FreneticApp } from './app';

class RecordingRenderer {
  renderCalls = 0;
  resizeCalls: Array<{ width: number; height: number }> = [];

  resize(width: number, height: number): void {
    this.resizeCalls.push({ width, height });
  }

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
  } as unknown as HTMLCanvasElement;
}

function renderPayload(app: FreneticApp): ReturnType<typeof JSON.parse> {
  return JSON.parse(app.renderGameToText());
}

describe('FreneticApp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts as a passive demo on the fourth authored level', () => {
    const app = new FreneticApp(createCanvas(), new RecordingRenderer());
    const payload = renderPayload(app);

    expect(payload.mode).toBe('demo');
    expect(payload.level.id).toBe('granny-knot');
    expect(payload.level.index).toBe(3);
  });

  it('advances the demo camera along the centerline without exposing player controls', () => {
    const renderer = new RecordingRenderer();
    const app = new FreneticApp(createCanvas(), renderer);
    const before = renderPayload(app);

    app.advanceTime(1000);
    const after = renderPayload(app);

    expect(after.mode).toBe('demo');
    expect(after.level.id).toBe('granny-knot');
    expect(after.camera.progress).toBeGreaterThan(before.camera.progress + 0.01);
    expect(after.camera.distanceFromCenterline).toBe(0);
    expect(after.camera.currentCurvature).toBeGreaterThan(0);
    expect(Math.abs(after.camera.currentTorsion)).toBeGreaterThan(0);
    expect(after).not.toHaveProperty('player');
    expect(after.hud).not.toHaveProperty('steeringTracePoints');
    expect(renderer.renderCalls).toBe(1);
  });

  it('does not register pointer or keyboard gameplay input listeners', () => {
    const windowListeners: string[] = [];
    vi.stubGlobal('window', {
      innerWidth: 800,
      innerHeight: 600,
      devicePixelRatio: 1,
      addEventListener: vi.fn((type: string) => {
        windowListeners.push(type);
      }),
      removeEventListener: vi.fn(),
    });

    const canvas = createDomCanvas();
    new FreneticApp(canvas, new RecordingRenderer());

    expect(canvas.addEventListener).not.toHaveBeenCalled();
    expect(windowListeners).toEqual(['resize']);
  });

  it('continues deterministic demo stepping after live animation is stopped', () => {
    const scheduledFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      scheduledFrames.push(callback);
      return scheduledFrames.length;
    });
    const app = new FreneticApp(createCanvas(), new RecordingRenderer());

    app.start();
    app.advanceTime(1000);
    const afterDeterministicStep = renderPayload(app);

    scheduledFrames[0](1000);
    const afterScheduledFrame = renderPayload(app);

    expect(afterDeterministicStep.camera.progress).toBeGreaterThan(0);
    expect(afterScheduledFrame.camera.progress).toBe(afterDeterministicStep.camera.progress);
    expect(scheduledFrames).toHaveLength(1);
  });

  it('resizes to the canvas client size and window fallback', () => {
    vi.stubGlobal('window', {
      innerWidth: 1024,
      innerHeight: 768,
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const renderer = new RecordingRenderer();

    new FreneticApp(createDomCanvas(), renderer);
    new FreneticApp(createCanvas(), renderer);

    expect(renderer.resizeCalls).toContainEqual({ width: 800, height: 600 });
    expect(renderer.resizeCalls).toContainEqual({ width: 1024, height: 768 });
  });

  it('exposes an explicit resize hook for fullscreen changes', () => {
    vi.stubGlobal('window', {
      innerWidth: 1024,
      innerHeight: 768,
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const renderer = new RecordingRenderer();
    const canvas = createDomCanvas();
    const app = new FreneticApp(canvas, renderer);

    Object.assign(canvas, { clientWidth: 1200, clientHeight: 700 });
    app.resize();

    expect(renderer.resizeCalls.at(-1)).toEqual({ width: 1200, height: 700 });
  });
});
