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
});
