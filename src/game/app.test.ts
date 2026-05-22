import { describe, expect, it } from 'vitest';
import { FreneticApp } from './app';

class NullRenderer {
  resize(): void {}
  render(): void {}
  dispose(): void {}
}

describe('FreneticApp', () => {
  it('advances simulation through deterministic time steps', () => {
    const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
    const app = new FreneticApp(canvas, new NullRenderer());
    const before = JSON.parse(app.renderGameToText());

    app.startPlaying();
    app.advanceTime(1000);
    const after = JSON.parse(app.renderGameToText());

    expect(after.mode).toBe('playing');
    expect(after.player.progress).toBeGreaterThanOrEqual(before.player.progress);
    expect(after.player.health).toBeGreaterThan(0);
  });

  it('resets simulation when advancing level', () => {
    const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
    const app = new FreneticApp(canvas, new NullRenderer());
    app.nextLevel();
    const payload = JSON.parse(app.renderGameToText());
    expect(payload.level.id).toBe('lifted-wave');
    expect(payload.mode).toBe('playing');
  });
});
