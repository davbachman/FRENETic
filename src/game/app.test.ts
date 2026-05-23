import { describe, expect, it } from 'vitest';
import { FreneticApp } from './app';

class RecordingRenderer {
  renderCalls = 0;

  resize(): void {}
  render(): void {
    this.renderCalls += 1;
  }
  dispose(): void {}
}

describe('FreneticApp', () => {
  it('advances simulation through deterministic time steps', () => {
    const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
    const renderer = new RecordingRenderer();
    const app = new FreneticApp(canvas, renderer);
    const before = JSON.parse(app.renderGameToText());

    app.startPlaying();
    app.advanceTime(1000);
    const after = JSON.parse(app.renderGameToText());

    expect(after.mode).toBe('playing');
    expect(after.player.progress).toBeGreaterThan(before.player.progress + 0.05);
    expect(after.hud.steeringTracePoints).toBeGreaterThan(before.hud.steeringTracePoints);
    expect(after.player.health).toBeGreaterThan(0);
    expect(renderer.renderCalls).toBe(1);
  });

  it('resets simulation when advancing level', () => {
    const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
    const app = new FreneticApp(canvas, new RecordingRenderer());
    app.startPlaying();
    app.advanceTime(1000);
    const played = JSON.parse(app.renderGameToText());

    expect(played.player.progress).toBeGreaterThan(0.05);
    expect(played.hud.steeringTracePoints).toBeGreaterThan(0);

    app.nextLevel();
    const payload = JSON.parse(app.renderGameToText());
    expect(payload.level.id).toBe('lifted-wave');
    expect(payload.mode).toBe('playing');
    expect(payload.player.progress).toBe(0);
    expect(payload.player.distanceFromCenterline).toBe(0);
    expect(payload.player.health).toBe(1);
    expect(payload.player.currentCurvature).toBe(0);
    expect(payload.hud.steeringTracePoints).toBe(0);
  });
});
