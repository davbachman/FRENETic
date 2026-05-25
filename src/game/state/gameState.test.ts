import { describe, expect, it } from 'vitest';
import { authoredLevels } from '../curves/levels';
import { sampleLevelCurve } from '../curves/sampler';
import { createSimulationState } from '../simulation/player';
import { buildTextState } from '../testing/textState';
import { createGameState } from './gameState';

describe('game state', () => {
  it('starts and remains in centerline demo mode on the fourth authored level', () => {
    const state = createGameState(authoredLevels);

    expect(state.mode).toBe('demo');
    expect(state.levelIndex).toBe(3);
    expect(state.level.id).toBe('granny-knot');
  });

  it('falls back to the last authored level when fewer than four levels exist', () => {
    const state = createGameState(authoredLevels.slice(0, 2));

    expect(state.mode).toBe('demo');
    expect(state.levelIndex).toBe(1);
    expect(state.level.id).toBe('lifted-wave');
  });

  it('requires at least one level', () => {
    expect(() => createGameState([])).toThrow('FRENETic requires at least one level.');
  });

  it('builds concise render_game_to_text payload for a passive visualization', () => {
    const game = createGameState(authoredLevels);
    const sampled = sampleLevelCurve(game.level);
    const simulation = createSimulationState(sampled);
    const payload = JSON.parse(buildTextState(game, simulation));

    expect(payload.mode).toBe('demo');
    expect(payload.level.id).toBe('granny-knot');
    expect(payload.camera.progress).toBe(0);
    expect(payload.camera.distanceFromCenterline).toBe(0);
    expect(payload).not.toHaveProperty('player');
    expect(payload.hud.tangentBinormalPlaneVisible).toBe(true);
    expect(payload.hud).not.toHaveProperty('normalPlaneVisible');
    expect(payload.hud.meterStyle).toBe('vector-colored-retro-arc');
    expect(payload.hud).not.toHaveProperty('curvatureMeterColor');
    expect(payload.hud).not.toHaveProperty('torsionMeterColor');
    expect(payload.hud).not.toHaveProperty('steeringTracePoints');
  });
});
