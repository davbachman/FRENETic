import { describe, expect, it } from 'vitest';
import { authoredLevels } from '../curves/levels';
import { sampleLevelCurve } from '../curves/sampler';
import { createSimulationState } from '../simulation/player';
import { buildTextState } from '../testing/textState';
import { createGameState, nextLevel, restartLevel, setMode, updateProgressMode } from './gameState';

describe('game state', () => {
  it('starts on the first authored level', () => {
    const state = createGameState(authoredLevels);
    expect(state.mode).toBe('start');
    expect(state.levelIndex).toBe(0);
    expect(state.level.id).toBe('planar-wave');
  });

  it('restarts the current level without changing level index', () => {
    const state = createGameState(authoredLevels);
    state.levelIndex = 2;
    restartLevel(state);
    expect(state.levelIndex).toBe(2);
    expect(state.level.id).toBe('trefoil-knot');
    expect(state.mode).toBe('playing');
  });

  it('normalizes invalid level index when restarting', () => {
    const state = createGameState(authoredLevels);

    state.levelIndex = -1;
    restartLevel(state);
    expect(state.levelIndex).toBe(authoredLevels.length - 1);
    expect(state.level.id).toBe('cinquefoil-knot');

    state.levelIndex = -2;
    restartLevel(state);
    expect(state.levelIndex).toBe(authoredLevels.length - 2);
    expect(state.level.id).toBe('trefoil-knot');

    state.levelIndex = 99;
    restartLevel(state);
    expect(state.levelIndex).toBe(3);
    expect(state.level.id).toBe('cinquefoil-knot');

    state.levelIndex = 1.8;
    restartLevel(state);
    expect(state.levelIndex).toBe(1);
    expect(state.level.id).toBe('lifted-wave');
  });

  it('advances to the next level and wraps at the end', () => {
    const state = createGameState(authoredLevels);
    nextLevel(state);
    expect(state.level.id).toBe('lifted-wave');

    state.levelIndex = authoredLevels.length - 1;
    nextLevel(state);
    expect(state.level.id).toBe('planar-wave');
  });

  it('normalizes invalid level index before advancing', () => {
    const state = createGameState(authoredLevels);

    state.levelIndex = -1;
    nextLevel(state);
    expect(state.levelIndex).toBe(0);
    expect(state.level.id).toBe('planar-wave');

    state.levelIndex = -2;
    nextLevel(state);
    expect(state.levelIndex).toBe(authoredLevels.length - 1);
    expect(state.level.id).toBe('cinquefoil-knot');

    state.levelIndex = 99;
    nextLevel(state);
    expect(state.levelIndex).toBe(0);
    expect(state.level.id).toBe('planar-wave');

    state.levelIndex = 1.8;
    nextLevel(state);
    expect(state.levelIndex).toBe(2);
    expect(state.level.id).toBe('trefoil-knot');
  });

  it('marks level complete near the end of the loop', () => {
    const state = createGameState(authoredLevels);
    setMode(state, 'playing');
    updateProgressMode(state, 0.995, 0.8);
    expect(state.mode).toBe('complete');
  });

  it('marks failed when health reaches zero', () => {
    const state = createGameState(authoredLevels);
    setMode(state, 'playing');
    updateProgressMode(state, 0.2, 0);
    expect(state.mode).toBe('failed');
  });

  it('prioritizes failure over completion when health is depleted near loop end', () => {
    const state = createGameState(authoredLevels);
    setMode(state, 'playing');
    updateProgressMode(state, 0.995, 0);
    expect(state.mode).toBe('failed');
  });

  it('builds concise render_game_to_text payload', () => {
    const game = createGameState(authoredLevels);
    const sampled = sampleLevelCurve(game.level);
    const simulation = createSimulationState(sampled);
    const payload = JSON.parse(buildTextState(game, simulation));

    expect(payload.mode).toBe('start');
    expect(payload.level.id).toBe('planar-wave');
    expect(payload.player.health).toBe(1);
    expect(payload.hud.curvatureMeterColor).toBe('blue');
    expect(payload.hud.torsionMeterColor).toBe('green');
  });
});
