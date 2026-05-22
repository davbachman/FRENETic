import type { LevelDefinition } from '../curves/types';

export type GameMode = 'start' | 'playing' | 'paused' | 'complete' | 'failed';

export interface GameState {
  mode: GameMode;
  levels: LevelDefinition[];
  levelIndex: number;
  level: LevelDefinition;
}

export function createGameState(levels: LevelDefinition[]): GameState {
  if (levels.length === 0) {
    throw new Error('FRENETic requires at least one level.');
  }

  return {
    mode: 'start',
    levels,
    levelIndex: 0,
    level: levels[0],
  };
}

export function setMode(state: GameState, mode: GameMode): void {
  state.mode = mode;
}

export function restartLevel(state: GameState): void {
  state.level = state.levels[state.levelIndex];
  state.mode = 'playing';
}

export function nextLevel(state: GameState): void {
  state.levelIndex = (state.levelIndex + 1) % state.levels.length;
  state.level = state.levels[state.levelIndex];
  state.mode = 'playing';
}

export function updateProgressMode(state: GameState, progress: number, health: number): void {
  if (state.mode !== 'playing') {
    return;
  }

  if (health <= 0) {
    state.mode = 'failed';
    return;
  }

  if (progress >= 0.99) {
    state.mode = 'complete';
  }
}
